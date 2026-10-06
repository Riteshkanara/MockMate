const { shapeFeedback, shapeSession, makeTeaser } = require('../utils/feedbackTier');

const MODEL = 'Two-Phase Commit coordinates a distributed transaction in two steps: a prepare vote and then a commit. It blocks if the coordinator fails, which hurts availability. Real systems add timeouts and a recovery log.';
const HINT  = 'The key idea you missed is that 2PC blocks when the coordinator crashes after prepare. Say so, then name the fix.';
const stored = () => JSON.stringify({
  good: 'Clear on phases.', missing: 'No availability discussion.', sampleAnswer: MODEL, idealHint: HINT, tip: 'Name the trade-off.',
  deliveryTip: 'Slow down.', keywordCoverage: { hit: ['quorum'], missed: ['idempotency'] }, starBreakdown: { s: 'x' },
  confidenceScore: { score: 70 }, followUpQuestions: ['What if the coordinator crashes?'], aiAvailable: true,
});
const open = (feedback, extra = {}) => ({ feedback, questionType: 'open', ...extra });

describe('free tier teasers', () => {
  test('free feedback keeps the whitelist and adds a real first line for model answer and coaching', () => {
    const out = JSON.parse(shapeFeedback(open(stored()), 'basic'));
    expect(out.tier).toBe('basic');
    expect(out.good).toBeTruthy();
    expect(out.teasers.modelAnswer).toMatch(/^Two-Phase Commit coordinates/);
    expect(out.teasers.coaching).toMatch(/^The key idea you missed/);
  });

  test('free feedback still contains none of the Pro content', () => {
    const raw = shapeFeedback(open(stored()), 'basic');
    ['recovery log', 'hurts availability', 'Slow down', 'quorum', 'idempotency', 'What if the coordinator', 'confidenceScore', 'starBreakdown', 'sampleAnswer', 'followUpQuestions']
      .forEach((s) => expect(raw).not.toContain(s));
  });

  test('a teaser is never the whole text and never longer than 111 characters', () => {
    [MODEL, HINT, 'First sentence is reasonably long here. Second one.', 'One long sentence with enough words to pass the minimum length check easily'].forEach((t) => {
      const tz = makeTeaser(t);
      if (tz) {
        expect(tz.length).toBeLessThanOrEqual(111);
        expect(tz.replace(/…$/, '').length).toBeLessThan(t.length * 0.6);
      }
    });
    expect(makeTeaser('A'.repeat(300)).length).toBeLessThanOrEqual(111);
  });

  test('short or empty text gets no teaser', () => {
    expect(makeTeaser('Short.')).toBe('');
    expect(makeTeaser('')).toBe('');
    expect(makeTeaser(null)).toBe('');
    expect(makeTeaser({ a: 1 })).toBe('');
  });

  test('no teasers key when there is nothing to tease', () => {
    const out = JSON.parse(shapeFeedback(open(JSON.stringify({ good: 'g', missing: 'm' })), 'basic'));
    expect(out.teasers).toBeUndefined();
  });

  test('full tier is unchanged and has no teasers', () => {
    const out = JSON.parse(shapeFeedback(open(stored()), 'full'));
    expect(out.tier).toBe('full');
    expect(out.sampleAnswer).toBe(MODEL);
    expect(out.teasers).toBeUndefined();
  });

  test('MCQ feedback is returned untouched', () => {
    expect(shapeFeedback({ feedback: 'Correct because X.', questionType: 'mcq' }, 'basic')).toBe('Correct because X.');
  });

  test('result sessions carry teasers for free users and not for Pro', () => {
    const session = { questions: [{ ...open(stored()), voiceMetrics: { wpm: 120 } }] };
    const free = shapeSession(session, 'basic');
    expect(JSON.parse(free.questions[0].feedback).teasers.modelAnswer).toBeTruthy();
    expect(free.questions[0].voiceMetrics).toBeUndefined();
    expect(free.lockedInsights).toBeGreaterThan(0);
    const pro = shapeSession(session, 'full');
    expect(JSON.parse(pro.questions[0].feedback).teasers).toBeUndefined();
  });
});
