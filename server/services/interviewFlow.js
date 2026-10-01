// Interview flow helpers that keep the interview feeling instant:
//
//  1. Progressive question generation — a long interview starts with the first
//     few questions and the rest are generated in the background while the
//     student is busy answering.
//  2. Background answer enrichment — the score and core feedback come back
//     immediately; the heavier analysis (model answer, STAR, keywords, voice…)
//     is generated afterwards and merged into the stored feedback.
//
// Everything here is written to FAIL SAFE: a crash, a Gemini outage or a
// server restart must never leave a student stuck. Callers treat both
// background jobs as best-effort and self-heal using the timeouts below.

const Session = require('../models/Session');
const { generateQuestions, enrichOpenAnswer, getFallbackQuestions } = require('./aiServices');

// Quick mode (5 questions) is fast enough as a single call; anything longer
// starts with a small first batch.
const FIRST_BATCH_SIZE = 3;
const SPLIT_THRESHOLD  = 5;

// If a background job never reports back (e.g. the server restarted), the
// session/feedback is treated as "not pending" after this long.
const QUESTIONS_PENDING_TIMEOUT_MS = 90 * 1000;
const ENRICH_PENDING_TIMEOUT_MS    = 90 * 1000;

// When the interview is completed, wait at most this long for answers whose
// analysis is still being generated, so the final report includes it.
const ENRICH_WAIT_ON_COMPLETE_MS = 6000;

const ENRICH_KEYS_TO_CLEAR = ['enrichPending', 'enrichToken', 'enrichStartedAt'];
const ENRICH_MAX_ATTEMPTS  = 3;

const normalizeText = str =>
  String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ── Progressive question generation ────────────────────────────────────────

const planBatches = count => {
  const total = Math.max(1, Number(count) || 1);
  if (total > SPLIT_THRESHOLD) return { first: FIRST_BATCH_SIZE, rest: total - FIRST_BATCH_SIZE };
  return { first: total, rest: 0 };
};

// generateQuestions() numbers each call's questions q1, q2, … so a second
// batch would collide with the first. Re-number so every id in a session is
// unique.
const withUniqueIds = (questions, existing) => {
  const used = new Set(existing.map(q => q.id));
  let n = existing.length;
  return questions.map(q => {
    let id;
    do { n += 1; id = `q${n}`; } while (used.has(id));
    used.add(id);
    return { ...q, id };
  });
};

const toStoredQuestion = q => ({
  ...q,
  userAnswer: '',
  userAnswerIndex: null,
  score: 0,
  feedback: '',
  skipped: false,
  timeTaken: 0,
});

// Generates the remaining questions and appends them to the session.
// ALWAYS clears `questionsPending` at the end — even if generation failed —
// so the client can never wait forever. The update only applies while the
// session is still active and still pending, so a completed/abandoned
// session is never modified after the fact.
const fillRemainingQuestions = async ({ sessionId, params, remaining, existingQuestions, expectedTotal }) => {
  let extra = [];
  try {
    const seen = new Set(existingQuestions.map(q => normalizeText(q.text)));
    const previous = [...existingQuestions.map(q => q.text), ...(params.previousQuestions || [])];

    const generated = await generateQuestions({ ...params, count: remaining, previousQuestions: previous });

    let fresh = generated.filter(q => {
      const key = normalizeText(q.text);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // If generation fell back to the static bank (Gemini outage) it can repeat
    // the first batch — top up from the bank so the student still gets the
    // full number of distinct questions.
    if (fresh.length < remaining) {
      const bank = getFallbackQuestions(params.mode, params.topic || params.topics?.[0], expectedTotal || remaining + existingQuestions.length);
      for (const q of bank) {
        if (fresh.length >= remaining) break;
        const key = normalizeText(q.text);
        if (seen.has(key)) continue;
        seen.add(key);
        fresh.push(q);
      }
    }

    extra = withUniqueIds(fresh.slice(0, remaining), existingQuestions).map(toStoredQuestion);
  } catch (err) {
    console.error('fillRemainingQuestions: generation failed:', err?.message || err);
  }

  try {
    await Session.updateOne(
      { _id: sessionId, status: 'active', questionsPending: true },
      { $push: { questions: { $each: extra } }, $set: { questionsPending: false } }
    );
  } catch (err) {
    console.error('fillRemainingQuestions: save failed:', err?.message || err);
  }
  return extra.length;
};

// ── Background answer enrichment ───────────────────────────────────────────

const parseFeedbackJson = raw => {
  try { return JSON.parse(raw); } catch { return null; }
};

// Generates the heavy analysis and merges it into the stored feedback.
//
// The write is a compare-and-set on the EXACT feedback string that was read
// (`enrichToken` identifies this particular evaluation). If the student
// re-answered or retried in the meantime, the stored feedback no longer
// matches and this result is discarded instead of overwriting newer data.
const runEnrichment = async ({ sessionId, questionId, token, question, answer, topic, voiceMetrics, fast }) => {
  try {
    const outcome = await enrichOpenAnswer({ question, answer, topic, voiceMetrics, fast });

    for (let attempt = 0; attempt < ENRICH_MAX_ATTEMPTS; attempt += 1) {
      const doc = await Session.findOne({ _id: sessionId }).select('questions.id questions.feedback').lean();
      const stored = doc?.questions?.find(q => q.id === questionId);
      if (!stored) return false;

      const current = parseFeedbackJson(stored.feedback);
      if (!current || current.enrichToken !== token) return false; // superseded

      const next = { ...current, ...(outcome.ok ? outcome.fields : { enrichFailed: true }) };
      ENRICH_KEYS_TO_CLEAR.forEach(k => { delete next[k]; });

      const result = await Session.updateOne(
        { _id: sessionId, questions: { $elemMatch: { id: questionId, feedback: stored.feedback } } },
        { $set: { 'questions.$.feedback': JSON.stringify(next) } }
      );
      if (result?.matchedCount === 1) return true;
      // Lost a race with another write — re-read and try again.
    }
  } catch (err) {
    console.error('runEnrichment failed:', err?.message || err);
  }
  return false;
};

// Resolves once no answer in the session is still waiting on its background
// analysis, or after `maxMs` — whichever comes first. Never throws: a slow or
// failed analysis must not be able to block completing an interview.
const waitForPendingEnrichment = async (sessionId, maxMs = ENRICH_WAIT_ON_COMPLETE_MS) => {
  const deadline = Date.now() + maxMs;
  try {
    for (;;) {
      const doc = await Session.findOne({ _id: sessionId }).select('questions.feedback').lean();
      const stillPending = (doc?.questions || []).some(q => {
        const fb = parseFeedbackJson(q.feedback);
        return fb && fb.enrichPending === true
          && Date.now() - Number(fb.enrichStartedAt || 0) <= ENRICH_PENDING_TIMEOUT_MS;
      });
      if (!stillPending || Date.now() >= deadline) return !stillPending;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  } catch (err) {
    console.error('waitForPendingEnrichment failed:', err?.message || err);
    return false;
  }
};

// Reports whether a stored feedback blob is still waiting on enrichment,
// self-healing one that has been "pending" for implausibly long.
const resolveEnrichState = parsed => {
  const feedback = parsed && typeof parsed === 'object' ? { ...parsed } : {};
  let pending = feedback.enrichPending === true;
  if (pending && Date.now() - Number(feedback.enrichStartedAt || 0) > ENRICH_PENDING_TIMEOUT_MS) {
    pending = false;
    feedback.enrichFailed = true;
  }
  if (!pending) ENRICH_KEYS_TO_CLEAR.forEach(k => { delete feedback[k]; });
  return { pending, feedback };
};

module.exports = {
  FIRST_BATCH_SIZE,
  SPLIT_THRESHOLD,
  QUESTIONS_PENDING_TIMEOUT_MS,
  ENRICH_PENDING_TIMEOUT_MS,
  planBatches,
  withUniqueIds,
  toStoredQuestion,
  fillRemainingQuestions,
  runEnrichment,
  waitForPendingEnrichment,
  resolveEnrichState,
  ENRICH_WAIT_ON_COMPLETE_MS,
};
