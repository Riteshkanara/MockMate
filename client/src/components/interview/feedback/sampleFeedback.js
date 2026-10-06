/**
 * Example feedback used to render the locked Pro sections.
 *
 * This is the SAME shape the server returns to a Pro user, so a free user sees the
 * exact layout they will get. Every value here is invented. It is rendered blurred,
 * labelled EXAMPLE, and never mixed with the user's own data. The real Pro content
 * never reaches a free user: the server strips it before the response is sent.
 */
export const SAMPLE_FEEDBACK = {
  tip: 'Say the trade-off out loud, then give one number that shows the impact.',
  idealHint: 'A strong answer defines the idea, names the trade-off, then proves it with one example.',
  sampleAnswer:
    '1. Start with a one-sentence definition so the interviewer knows you have the core idea. '
    + '2. Name the trade-off: what you gain, and what you give up to get it. '
    + '3. Give one concrete example with a number, such as latency dropping from 800ms to 120ms. '
    + '4. Close by saying what you would change at larger scale, and why.',
  followUpQuestions: [
    'What happens if the coordinator crashes halfway through?',
    'How would you avoid blocking other requests?',
    'What would you monitor to know this is working?',
  ],
  keywordCoverage: {
    hit: ['transaction', 'rollback', 'consistency', 'commit'],
    missed: ['idempotency', 'timeout', 'coordinator'],
  },
  starBreakdown: {
    S: { score: 70, note: 'The context was clear.' },
    T: { score: 55, note: 'Your own responsibility was vague.' },
    A: { score: 82, note: 'Good detail on what you actually did.' },
    R: { score: 38, note: 'No measurable result was stated.' },
    overall: 'Strong action, weak result. Add one number to the ending.',
  },
  confidenceScore: {
    score: 64, label: 'Neutral', formalPct: 72, hedgingPct: 14,
    note: 'You hedged on the two sentences that mattered most. State them plainly.',
  },
  toneAnalysis: { score: 74, label: 'Professional', note: 'Formal and steady, with a few casual phrases.' },
  vocabularyRichness: { score: 68, label: 'Varied', note: 'Good range, but three sentences were too long to follow.' },
  hesitationPattern: { score: 61, pattern: 'Pauses before key points', note: 'Most pauses came right before the main idea.' },
  deliveryTip: 'Practise the opening line until it takes under ten seconds.',
};

export const SAMPLE_VOICE = {
  wpm: { wpm: 148, band: 'ideal', label: 'Ideal pace', hint: 'Aim for 130 to 160' },
  fillerWords: { total: 6, breakdown: [{ word: 'um', count: 3 }, { word: 'like', count: 2 }, { word: 'basically', count: 1 }] },
  answerLength: { wordCount: 96, min: 80, max: 160, rating: 'ideal', hint: 'Right length for a two-minute answer.' },
};
