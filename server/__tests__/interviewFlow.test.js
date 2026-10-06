// End-to-end tests of the interview flow using the REAL controller +
// interviewFlow code, an in-memory Session stand-in and mocked Gemini.
// Covers: progressive question generation, fast answer evaluation, background
// enrichment (incl. race protection), Stop handling, and self-healing.

const { EventEmitter } = require('events');

jest.mock('../models/Session', () => require('./helpers/fakeSession'));
jest.mock('../models/User', () => ({
  findById: () => {
    const q = { select: () => q, lean: () => q, then: (res, rej) => Promise.resolve(null).then(res, rej) };
    return q;
  },
}));
jest.mock('../services/aiServices', () => ({
  generateQuestions: jest.fn(),
  evaluateOpenAnswer: jest.fn(),
  evaluateOpenAnswerFast: jest.fn(),
  enrichOpenAnswer: jest.fn(),
  getSkippedAnswer: jest.fn(),
  evalObjectiveAnswer: jest.fn(),
  getFallbackQuestions: jest.fn(),
  generateCoachAdvice: jest.fn(),
  generateFreeform: jest.fn(),
}));

const FakeSession = require('../models/Session');
const ai = require('../services/aiServices');
const ctrl = require('../controllers/interviewController');

// ── helpers ────────────────────────────────────────────────────────────────
const user = { _id: 'user1' };
const makeRes = () => {
  const res = new EventEmitter();
  res.statusCode = 200; res.body = null; res.writableFinished = false;
  res.status = c => { res.statusCode = c; return res; };
  res.json = b => { res.body = b; res.writableFinished = true; process.nextTick(() => res.emit('close')); return res; };
  return res;
};
const call = async (fn, { params = {}, body = {} } = {}) => {
  const res = makeRes();
  await fn({ user, params, body }, res);
  return res;
};
const flush = async (predicate, tries = 60) => {
  for (let i = 0; i < tries; i += 1) {
    if (predicate()) return true;
    await new Promise(r => setImmediate(r));
  }
  return predicate();
};
const mkQ = (n, extra = {}) => ({
  id: `q${n}`, text: `Question number ${n} about topic ${n}`, topic: 'JavaScript',
  difficulty: 'medium', timeLimit: 90, questionType: 'open', options: [], correctAnswerIndex: null, ...extra,
});
const batch = (from, n) => Array.from({ length: n }, (_, i) => mkQ(from + i));
const seed = (overrides = {}) => FakeSession.create({
  user: 'user1', mode: 'full', status: 'active', questions: batch(1, 3).map(q => ({
    ...q, userAnswer: '', userAnswerIndex: null, score: 0, feedback: '', skipped: false, timeTaken: 0,
  })), ...overrides,
});
const stored = id => FakeSession._get(id);

beforeEach(() => {
  FakeSession.reset();
  Object.values(ai).forEach(fn => fn.mockReset());
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// ═══════════════════════════════════════════════════════════════════════════
describe('startInterview — progressive question generation', () => {
  test('10-question mode: responds with 3 questions immediately, then fills the other 7 in the background', async () => {
    ai.generateQuestions
      .mockResolvedValueOnce(batch(1, 3))                 // first batch (q1..q3)
      .mockResolvedValueOnce(batch(1, 7).map((q, i) => ({ ...q, text: `Different question ${i}` }))); // 2nd batch also numbered q1..q7

    const res = await call(ctrl.startInterview, { body: { mode: 'full' } });

    expect(res.statusCode).toBe(201);
    expect(res.body.questions).toHaveLength(3);
    expect(res.body.totalQuestions).toBe(10);
    expect(res.body.questionsPending).toBe(true);
    expect(ai.generateQuestions.mock.calls[0][0].count).toBe(3);

    const id = res.body.sessionId;
    await flush(() => stored(id).questionsPending === false);
    const s = stored(id);

    expect(s.questionsPending).toBe(false);
    expect(s.questions).toHaveLength(10);
    // the second batch's ids were re-numbered — all ten are unique
    expect(new Set(s.questions.map(q => q.id)).size).toBe(10);
    expect(s.questions.map(q => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10']);
    // second call asked for 7 and was told what the student already has
    const second = ai.generateQuestions.mock.calls[1][0];
    expect(second.count).toBe(7);
    expect(second.previousQuestions).toEqual(expect.arrayContaining(batch(1, 3).map(q => q.text)));
    // new questions are stored blank, like the first batch
    expect(s.questions[5]).toMatchObject({ userAnswer: '', score: 0, skipped: false });
  });

  test('8-question objective mode also splits (3 + 5)', async () => {
    ai.generateQuestions
      .mockResolvedValueOnce(batch(1, 3))
      .mockResolvedValueOnce(batch(1, 5).map((q, i) => ({ ...q, text: `MCQ ${i}` })));
    const res = await call(ctrl.startInterview, { body: { mode: 'mcq' } });
    expect(res.body.totalQuestions).toBe(8);
    await flush(() => stored(res.body.sessionId).questionsPending === false);
    expect(stored(res.body.sessionId).questions).toHaveLength(8);
  });

  test('quick mode (5) stays a single call with nothing pending', async () => {
    ai.generateQuestions.mockResolvedValueOnce(batch(1, 5));
    const res = await call(ctrl.startInterview, { body: { mode: 'quick' } });
    expect(res.body.questions).toHaveLength(5);
    expect(res.body.questionsPending).toBe(false);
    expect(res.body.totalQuestions).toBe(5);
    expect(ai.generateQuestions).toHaveBeenCalledTimes(1);
    expect(stored(res.body.sessionId).questionsPending).toBe(false);
  });

  test('background generation failure still clears the pending flag (student is never stuck)', async () => {
    ai.generateQuestions.mockResolvedValueOnce(batch(1, 3)).mockRejectedValueOnce(new Error('boom'));
    ai.getFallbackQuestions.mockReturnValue([]);
    const res = await call(ctrl.startInterview, { body: { mode: 'full' } });
    await flush(() => stored(res.body.sessionId).questionsPending === false);
    const s = stored(res.body.sessionId);
    expect(s.questionsPending).toBe(false);
    expect(s.questions).toHaveLength(3);
  });

  test('Gemini outage: static-bank duplicates are removed and topped up to the full count', async () => {
    const bank = batch(1, 10);                                   // static bank of 10 distinct questions
    ai.generateQuestions
      .mockResolvedValueOnce(bank.slice(0, 3))                    // first batch = first 3 of the bank
      .mockResolvedValueOnce(bank.slice(0, 7));                   // outage fallback repeats the first 3
    ai.getFallbackQuestions.mockReturnValue(bank);
    const res = await call(ctrl.startInterview, { body: { mode: 'full' } });
    await flush(() => stored(res.body.sessionId).questionsPending === false);
    const s = stored(res.body.sessionId);
    expect(s.questions).toHaveLength(10);
    expect(new Set(s.questions.map(q => q.text)).size).toBe(10);  // no duplicates
  });

  test('a session completed before generation lands is NOT modified afterwards', async () => {
    let release;
    ai.generateQuestions
      .mockResolvedValueOnce(batch(1, 3))
      .mockReturnValueOnce(new Promise(r => { release = () => r(batch(1, 7).map((q, i) => ({ ...q, text: `Late ${i}` }))); }));
    const res = await call(ctrl.startInterview, { body: { mode: 'full' } });
    const id = res.body.sessionId;

    await call(ctrl.completeInterview, { params: { sessionId: id } });   // finishes while generation is still running
    release();
    await new Promise(r => setTimeout(r, 30));

    const s = stored(id);
    expect(s.status).toBe('completed');
    expect(s.questions).toHaveLength(3);                                 // late questions were dropped
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('getInterviewSession — pending state and self-healing', () => {
  test('reports pending + expected total while questions are still coming', async () => {
    const s = await seed({ expectedQuestionCount: 10, questionsPending: true });
    const res = await call(ctrl.getInterviewSession, { params: { sessionId: s._id } });
    expect(res.body).toMatchObject({ questionsPending: true, totalQuestions: 10 });
    expect(res.body.questions).toHaveLength(3);
  });

  test('a pending flag older than 90s (e.g. server restarted) is treated as finished', async () => {
    const s = await seed({ expectedQuestionCount: 10, questionsPending: true, startedAt: new Date(Date.now() - 120000) });
    const res = await call(ctrl.getInterviewSession, { params: { sessionId: s._id } });
    expect(res.body.questionsPending).toBe(false);
    expect(res.body.totalQuestions).toBe(3);                              // real count, not the never-delivered 10
    await flush(() => stored(s._id).questionsPending === false);
    expect(stored(s._id).questionsPending).toBe(false);
  });

  test('older sessions without the new fields behave exactly as before', async () => {
    const s = await seed();
    const res = await call(ctrl.getInterviewSession, { params: { sessionId: s._id } });
    expect(res.body).toMatchObject({ questionsPending: false, totalQuestions: 3 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('answerQuestion — fast verdict + background enrichment', () => {
  const fast = { score: 72, good: 'Solid core idea', missing: 'No example', idealHint: 'Focus on scope', tip: 'Add an example', aiAvailable: true, fallback: false };
  const enriched = { ok: true, fields: {
    sampleAnswer: 'A closure is…', deliveryTip: null,
    starBreakdown: null, followUpQuestions: ['Why?'], keywordCoverage: { hit: ['scope'], missed: [] },
    confidenceScore: { score: 80, label: 'Assertive', note: 'ok' }, toneAnalysis: null, vocabularyRichness: null, hesitationPattern: null,
  } };
  const answerBody = { questionId: 'q1', answer: 'A closure keeps access to its outer scope.', timeTaken: 20 };

  test('responds with the fast verdict, marked enrichPending, WITHOUT waiting for the analysis', async () => {
    const s = await seed();
    let releaseEnrich;
    ai.evaluateOpenAnswerFast.mockResolvedValue(fast);
    ai.enrichOpenAnswer.mockReturnValue(new Promise(r => { releaseEnrich = () => r(enriched); }));

    const res = await call(ctrl.answerQuestion, { params: { sessionId: s._id }, body: answerBody });

    expect(res.body.success).toBe(true);
    expect(res.body.score).toBe(72);
    expect(res.body.enrichPending).toBe(true);
    const fb = JSON.parse(res.body.feedback);
    expect(fb).toMatchObject({ good: 'Solid core idea', tip: 'Add an example', enrichPending: true, aiAvailable: true });
    expect(fb.sampleAnswer).toBe('');                                   // not yet generated
    expect(ai.evaluateOpenAnswer).not.toHaveBeenCalled();               // the slow all-in-one call is no longer on this path
    expect(stored(s._id).questions[0].score).toBe(72);

    releaseEnrich();                                                    // analysis arrives later…
    await flush(() => !JSON.parse(stored(s._id).questions[0].feedback).enrichPending);
    const merged = JSON.parse(stored(s._id).questions[0].feedback);
    expect(merged).toMatchObject({ sampleAnswer: 'A closure is…', followUpQuestions: ['Why?'], good: 'Solid core idea' });
    expect(merged.enrichPending).toBeUndefined();                       // housekeeping flags removed
    expect(merged.enrichToken).toBeUndefined();
    expect(stored(s._id).questions[0].score).toBe(72);                  // the score is never changed by enrichment
  });

  test('enrichment receives the already-decided verdict and the voice metrics', async () => {
    const s = await seed();
    ai.evaluateOpenAnswerFast.mockResolvedValue(fast);
    ai.enrichOpenAnswer.mockResolvedValue(enriched);
    const voiceMetrics = { wpm: { wpm: 140 }, deliveryScore: 80 };
    await call(ctrl.answerQuestion, { params: { sessionId: s._id }, body: { ...answerBody, voiceMetrics } });
    await flush(() => ai.enrichOpenAnswer.mock.calls.length === 1);
    const arg = ai.enrichOpenAnswer.mock.calls[0][0];
    expect(arg.fast).toEqual({ score: 72, good: 'Solid core idea', missing: 'No example' });
    expect(arg.voiceMetrics).toEqual(voiceMetrics);
  });

  test('enrichment failure marks enrichFailed (no invented analysis) and clears the pending flag', async () => {
    const s = await seed();
    ai.evaluateOpenAnswerFast.mockResolvedValue(fast);
    ai.enrichOpenAnswer.mockResolvedValue({ ok: false });
    await call(ctrl.answerQuestion, { params: { sessionId: s._id }, body: answerBody });
    await flush(() => !JSON.parse(stored(s._id).questions[0].feedback).enrichPending);
    const fb = JSON.parse(stored(s._id).questions[0].feedback);
    expect(fb.enrichFailed).toBe(true);
    expect(fb.enrichPending).toBeUndefined();
    expect(fb.sampleAnswer).toBe('');
    expect(stored(s._id).questions[0].score).toBe(72);
  });

  test('AI fallback verdict (Gemini down) is NOT marked pending — the retry button flow is unchanged', async () => {
    const s = await seed();
    ai.evaluateOpenAnswerFast.mockResolvedValue({ score: 35, good: 'g', missing: 'm', idealHint: 'h', tip: 't', sampleAnswer: 'sample', aiAvailable: false, fallback: true });
    const res = await call(ctrl.answerQuestion, { params: { sessionId: s._id }, body: answerBody });
    expect(res.body.enrichPending).toBe(false);
    const fb = JSON.parse(res.body.feedback);
    expect(fb).toMatchObject({ aiAvailable: false, fallback: true, sampleAnswer: 'sample' });
    expect(fb.enrichPending).toBeUndefined();
    expect(ai.enrichOpenAnswer).not.toHaveBeenCalled();
  });

  test('a stale enrichment can never overwrite a newer evaluation (retry / re-answer race)', async () => {
    const s = await seed();
    let releaseEnrich;
    ai.evaluateOpenAnswerFast.mockResolvedValue(fast);
    ai.enrichOpenAnswer.mockReturnValue(new Promise(r => { releaseEnrich = () => r(enriched); }));
    await call(ctrl.answerQuestion, { params: { sessionId: s._id }, body: answerBody });

    // meanwhile the student hits "Retry evaluation": the stored feedback is replaced
    const doc = FakeSession._get(s._id);
    doc.questions[0].feedback = JSON.stringify({ good: 'NEWER', aiAvailable: true });
    doc.questions[0].score = 90;
    FakeSession._put(doc);

    releaseEnrich();
    await new Promise(r => setTimeout(r, 30));
    const fb = JSON.parse(stored(s._id).questions[0].feedback);
    expect(fb).toEqual({ good: 'NEWER', aiAvailable: true });           // untouched
    expect(stored(s._id).questions[0].score).toBe(90);
  });

  test('Stop: if the client disconnects mid-evaluation, nothing is saved and no enrichment starts', async () => {
    const s = await seed();
    let releaseFast;
    ai.evaluateOpenAnswerFast.mockReturnValue(new Promise(r => { releaseFast = () => r(fast); }));

    const res = makeRes();
    const pending = ctrl.answerQuestion({ user, params: { sessionId: s._id }, body: answerBody }, res);
    await new Promise(r => setImmediate(r));
    res.emit('close');                                                   // socket closed before the response finished
    releaseFast();
    await pending;

    expect(res.body).toBeNull();                                         // no response written
    const q = stored(s._id).questions[0];
    expect(q.score).toBe(0);
    expect(q.feedback).toBe('');
    expect(q.userAnswer).toBe('');
    expect(ai.enrichOpenAnswer).not.toHaveBeenCalled();
  });

  test('re-submitting after a Stop works normally', async () => {
    const s = await seed();
    ai.evaluateOpenAnswerFast.mockResolvedValue(fast);
    ai.enrichOpenAnswer.mockResolvedValue(enriched);
    const res = await call(ctrl.answerQuestion, { params: { sessionId: s._id }, body: answerBody });
    expect(res.body.success).toBe(true);
    expect(stored(s._id).questions[0].userAnswer).toBe(answerBody.answer);
  });

  test('skipping an open question is unchanged: instant, no AI evaluation, no enrichment', async () => {
    const s = await seed();
    ai.getSkippedAnswer.mockResolvedValue({ idealHint: 'h', tip: 't', sampleAnswer: 's' });
    const res = await call(ctrl.answerQuestion, { params: { sessionId: s._id }, body: { questionId: 'q1', skipped: true } });
    expect(res.body).toMatchObject({ success: true, score: 0, skipped: true, enrichPending: false });
    expect(JSON.parse(res.body.feedback).skippedPending).toBe(true);
    expect(ai.evaluateOpenAnswerFast).not.toHaveBeenCalled();
    expect(ai.enrichOpenAnswer).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('getQuestionFeedback — poll endpoint', () => {
  const withFeedback = async fb => {
    const s = await seed();
    const doc = FakeSession._get(s._id);
    doc.questions[0].feedback = JSON.stringify(fb);
    doc.questions[0].score = 66;
    FakeSession._put(doc);
    return s._id;
  };

  test('pending while the analysis is being generated', async () => {
    const id = await withFeedback({ good: 'g', enrichPending: true, enrichToken: 'abc', enrichStartedAt: Date.now() });
    const res = await call(ctrl.getQuestionFeedback, { params: { sessionId: id, questionId: 'q1' } });
    expect(res.body).toMatchObject({ questionId: 'q1', score: 66, enrichPending: true });
  });

  test('done: returns the merged feedback without internal flags', async () => {
    const id = await withFeedback({ good: 'g', sampleAnswer: 'S', followUpQuestions: ['a'] });
    const res = await call(ctrl.getQuestionFeedback, { params: { sessionId: id, questionId: 'q1' } });
    expect(res.body.enrichPending).toBe(false);
    expect(JSON.parse(res.body.feedback)).toMatchObject({ sampleAnswer: 'S', followUpQuestions: ['a'] });
  });

  test('pending for over 90s (server restarted mid-job) self-heals to enrichFailed', async () => {
    const id = await withFeedback({ good: 'g', enrichPending: true, enrichToken: 'abc', enrichStartedAt: Date.now() - 120000 });
    const res = await call(ctrl.getQuestionFeedback, { params: { sessionId: id, questionId: 'q1' } });
    expect(res.body.enrichPending).toBe(false);
    const fb = JSON.parse(res.body.feedback);
    expect(fb.enrichFailed).toBe(true);
    expect(fb.enrichToken).toBeUndefined();
  });

  test('404 for an unknown session, an unknown question, or someone else’s session', async () => {
    const id = await withFeedback({ good: 'g' });
    expect((await call(ctrl.getQuestionFeedback, { params: { sessionId: 'nope', questionId: 'q1' } })).statusCode).toBe(404);
    expect((await call(ctrl.getQuestionFeedback, { params: { sessionId: id, questionId: 'zzz' } })).statusCode).toBe(404);
    const res = makeRes();
    await ctrl.getQuestionFeedback({ user: { _id: 'someone-else' }, params: { sessionId: id, questionId: 'q1' } }, res);
    expect(res.statusCode).toBe(404);
  });

  test('corrupt stored feedback does not crash the endpoint', async () => {
    const s = await seed();
    const doc = FakeSession._get(s._id); doc.questions[0].feedback = '{not json'; FakeSession._put(doc);
    const res = await call(ctrl.getQuestionFeedback, { params: { sessionId: s._id, questionId: 'q1' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.enrichPending).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('completeInterview — waits (briefly) for in-flight analysis', () => {
  const { waitForPendingEnrichment } = require('../services/interviewFlow');
  const pendingFb = (started = Date.now()) => JSON.stringify({ good: 'g', enrichPending: true, enrichToken: 't', enrichStartedAt: started });

  const seedPending = async (started) => {
    const s = await seed();
    const doc = FakeSession._get(s._id);
    doc.questions[0].feedback = pendingFb(started);
    doc.questions[0].userAnswer = 'an answer';
    FakeSession._put(doc);
    return s._id;
  };

  test('the final report includes analysis that lands while completing', async () => {
    const id = await seedPending();
    setTimeout(() => {                                             // analysis lands ~150 ms later
      const doc = FakeSession._get(id);
      doc.questions[0].feedback = JSON.stringify({ good: 'g', sampleAnswer: 'MODEL ANSWER' });
      FakeSession._put(doc);
    }, 150);

    const res = await call(ctrl.completeInterview, { params: { sessionId: id } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(stored(id).questions[0].feedback).sampleAnswer).toBe('MODEL ANSWER');
  });

  test('returns immediately when nothing is pending', async () => {
    const s = await seed();
    const t0 = Date.now();
    expect(await waitForPendingEnrichment(s._id, 5000)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(200);
  });

  test('gives up after the cap — a stuck analysis can never block completing', async () => {
    const id = await seedPending();
    const t0 = Date.now();
    expect(await waitForPendingEnrichment(id, 500)).toBe(false);
    const waited = Date.now() - t0;
    expect(waited).toBeGreaterThanOrEqual(450);
    expect(waited).toBeLessThan(1200);
  });

  test('an implausibly old pending flag (server restarted) is ignored, not waited on', async () => {
    const id = await seedPending(Date.now() - 200000);
    const t0 = Date.now();
    expect(await waitForPendingEnrichment(id, 5000)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(200);
  });
});
