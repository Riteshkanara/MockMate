// Tests for the split evaluation (fast verdict + background enrichment).
// Gemini is fully mocked — no network, no API key needed.

const mockGenerate = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: (...args) => mockGenerate(...args) },
  })),
}));

process.env.GEMINI_API_KEY = 'test-key';
const svc = require('../services/aiServices');

const question = { text: 'Explain closures in JavaScript.', topic: 'JavaScript' };
const answer = 'A closure is a function that keeps access to its outer scope variables.';
const reply = obj => ({ text: JSON.stringify(obj) });

beforeEach(() => {
  mockGenerate.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('evaluateOpenAnswerFast', () => {
  test('returns score + four feedback fields and asks Gemini for ONLY those', async () => {
    mockGenerate.mockResolvedValue(reply({ score: 72.6, good: ' g ', missing: 'm', idealHint: 'h', tip: 't' }));
    const r = await svc.evaluateOpenAnswerFast({ question, answer, topic: 'JavaScript' });

    expect(r).toMatchObject({ score: 73, good: 'g', missing: 'm', idealHint: 'h', tip: 't', aiAvailable: true, fallback: false });
    const req = mockGenerate.mock.calls[0][0];
    expect(Object.keys(req.config.responseSchema.properties).sort()).toEqual(['good', 'idealHint', 'missing', 'score', 'tip']);
    expect(req.contents).toContain(answer);
    expect(req.contents).not.toMatch(/STAR|keyword|follow-up|sample/i);
  });

  test('clamps out-of-range scores to 0-100', async () => {
    mockGenerate.mockResolvedValue(reply({ score: 140, good: '', missing: '', idealHint: '', tip: '' }));
    expect((await svc.evaluateOpenAnswerFast({ question, answer })).score).toBe(100);
    mockGenerate.mockResolvedValue(reply({ score: -5, good: '', missing: '', idealHint: '', tip: '' }));
    expect((await svc.evaluateOpenAnswerFast({ question, answer })).score).toBe(0);
  });

  test('non-numeric score falls back to the heuristic evaluator (never throws)', async () => {
    mockGenerate.mockResolvedValue(reply({ score: 'high', good: '', missing: '', idealHint: '', tip: '' }));
    const r = await svc.evaluateOpenAnswerFast({ question, answer });
    expect(r.fallback).toBe(true);
    expect(r.aiAvailable).toBe(false);
    expect(typeof r.score).toBe('number');
  });

  test('Gemini failure falls back instead of throwing', async () => {
    mockGenerate.mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }));
    const r = await svc.evaluateOpenAnswerFast({ question, answer });
    expect(r.fallback).toBe(true);
    expect(r.aiAvailable).toBe(false);
  });

  test('empty answer never calls Gemini', async () => {
    const r = await svc.evaluateOpenAnswerFast({ question, answer: '   ' });
    expect(r.score).toBe(0);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

describe('enrichOpenAnswer', () => {
  const enriched = {
    sampleAnswer: ' A closure is… ', deliveryTip: null,
    starBreakdown: { S: { score: 0, note: '' }, T: { score: 0, note: '' }, A: { score: 0, note: '' }, R: { score: 0, note: '' }, overall: 'n/a' },
    followUpQuestions: ['Why?', '', 'How?'],
    keywordCoverage: { hit: ['scope'], missed: ['lexical'] },
    confidenceScore: { score: 80, label: 'Assertive', note: 'ok' },
  };

  test('returns cleaned fields and tells Gemini the score is already final', async () => {
    mockGenerate.mockResolvedValue(reply(enriched));
    const r = await svc.enrichOpenAnswer({ question, answer, topic: 'JavaScript', fast: { score: 72, good: 'g', missing: 'm' } });

    expect(r.ok).toBe(true);
    expect(r.fields.sampleAnswer).toBe('A closure is…');
    expect(r.fields.followUpQuestions).toEqual(['Why?', 'How?']);
    expect(r.fields.toneAnalysis).toBeNull();
    const prompt = mockGenerate.mock.calls[0][0].contents;
    expect(prompt).toContain('Score   : 72 / 100');
    expect(prompt).toMatch(/do not contradict it and do not output a new score/);
    expect(prompt).toContain('No voice metrics were recorded');
    expect(mockGenerate.mock.calls[0][0].config.responseSchema.properties.score).toBeUndefined();
  });

  test('includes the measured voice block when voice metrics exist', async () => {
    mockGenerate.mockResolvedValue(reply(enriched));
    await svc.enrichOpenAnswer({ question, answer, fast: { score: 60 }, voiceMetrics: { wpm: { wpm: 141, label: 'ideal' }, deliveryScore: 77 } });
    const prompt = mockGenerate.mock.calls[0][0].contents;
    expect(prompt).toContain('141 wpm');
    expect(prompt).toContain('77 / 100');
  });

  test('failure returns { ok:false } (no invented analysis)', async () => {
    mockGenerate.mockRejectedValue(Object.assign(new Error('nope'), { status: 400 }));
    expect(await svc.enrichOpenAnswer({ question, answer, fast: { score: 50 } })).toEqual({ ok: false });
  });

  test('malformed JSON returns { ok:false }', async () => {
    mockGenerate.mockResolvedValue({ text: 'not json at all' });
    expect(await svc.enrichOpenAnswer({ question, answer, fast: { score: 50 } })).toEqual({ ok: false });
  });

  test('empty answer returns { ok:false } without calling Gemini', async () => {
    expect(await svc.enrichOpenAnswer({ question, answer: '', fast: { score: 0 } })).toEqual({ ok: false });
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

describe('optional thinking budget (GEMINI_FAST_THINKING_BUDGET)', () => {
  const load = env => {
    let mod;
    const prev = process.env.GEMINI_FAST_THINKING_BUDGET;
    if (env === undefined) delete process.env.GEMINI_FAST_THINKING_BUDGET; else process.env.GEMINI_FAST_THINKING_BUDGET = env;
    jest.isolateModules(() => { mod = require('../services/aiServices'); });
    if (prev === undefined) delete process.env.GEMINI_FAST_THINKING_BUDGET; else process.env.GEMINI_FAST_THINKING_BUDGET = prev;
    return mod;
  };
  const ok = reply({ score: 50, good: '', missing: '', idealHint: '', tip: '' });

  test('unset → request has no thinkingConfig (behaviour unchanged)', async () => {
    mockGenerate.mockResolvedValue(ok);
    await load(undefined).evaluateOpenAnswerFast({ question, answer });
    expect(mockGenerate.mock.calls[0][0].config.thinkingConfig).toBeUndefined();
  });

  test('"0" → thinkingConfig.thinkingBudget = 0', async () => {
    mockGenerate.mockResolvedValue(ok);
    await load('0').evaluateOpenAnswerFast({ question, answer });
    expect(mockGenerate.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  test('garbage value is ignored', async () => {
    mockGenerate.mockResolvedValue(ok);
    await load('abc').evaluateOpenAnswerFast({ question, answer });
    expect(mockGenerate.mock.calls[0][0].config.thinkingConfig).toBeUndefined();
  });
});
