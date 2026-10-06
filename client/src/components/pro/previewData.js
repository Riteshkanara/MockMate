// Sample content for the locked Pro previews.
// Everything here is invented example data. It is rendered blurred behind a lock,
// so a free user sees what the Pro screen looks like, never anyone's real analysis.

export const SAMPLE_DIMENSIONS = [
  { key: 'technical',      score: 72, hasData: true, answeredCount: 14 },
  { key: 'problemSolving', score: 64, hasData: true, answeredCount: 11 },
  { key: 'communication',  score: 58, hasData: true, answeredCount: 14 },
  { key: 'behavioral',     score: 49, hasData: true, answeredCount: 6 },
  { key: 'design',         score: 41, hasData: true, answeredCount: 4 },
  { key: 'fundamentals',   score: 77, hasData: true, answeredCount: 9 },
];

export const SAMPLE_ANALYTICS = { dimensionProfile: SAMPLE_DIMENSIONS };

// Dates are relative to today so the sample activity calendar always looks current.
const DAY = 86400000;
export const SAMPLE_TREND = [38, 44, 41, 52, 49, 58, 55, 63, 61, 70].map((score, i, a) => ({
  score,
  createdAt: new Date(Date.now() - (a.length - 1 - i) * 4 * DAY).toISOString(),
}));

const DNA_LABELS = {
  technical: ['Technical Depth', '⚙'], problemSolving: ['Problem Solving', '🔍'], communication: ['Communication', '💬'],
  behavioral: ['Behavioral', '🤝'], design: ['System Design', '🏗'], fundamentals: ['CS Fundamentals', '📚'],
};
export const SAMPLE_DNA = SAMPLE_DIMENSIONS.map((d) => ({ ...d, label: DNA_LABELS[d.key][0], icon: DNA_LABELS[d.key][1] }));

export const SAMPLE_IRS = {
  irs: 58,
  irsComponents: { dimScore: 61, ewmaScore: 57, breadth: 64, consistency: 52, rigor: 55 },
};

export const SAMPLE_COACH = {
  today: [
    'Your weakest area is System Design (41%). Spend today on one scaling question out loud.',
    'Start with the requirements: users, reads vs writes, and the one number that drives the design.',
    'Then name one trade-off and say why you chose it. Interviewers score the reasoning, not the diagram.',
    'Finish by re-answering it in 90 seconds. Compare against your first attempt.',
  ],
  week: [
    ['Day 1', 'System Design: URL shortener, requirements and estimates'],
    ['Day 2', 'Behavioral: two STAR stories with a number in each result'],
    ['Day 3', 'Communication: answer 3 questions in under 90 seconds each'],
    ['Day 4', 'Technical: caching, invalidation and consistency trade-offs'],
    ['Day 5', 'Company round: a timed mock for your target company'],
    ['Day 6', 'Weak spots: redo your lowest-scoring answers'],
    ['Day 7', 'Review: compare scores with last week and reset the plan'],
  ],
  companies: [
    ['Product company round', 78],
    ['Service company round', 86],
    ['Startup round', 69],
  ],
  debrief: [
    'You opened strongly and gave a clear definition in the first 10 seconds.',
    'You lost marks by skipping the trade-off and not quantifying the impact.',
    'Next time: say the trade-off out loud, then give one number.',
  ],
  chat: [
    ['you', 'Why do I keep scoring low on behavioral answers?'],
    ['coach', 'Three of your last four answers had no result. Add one measurable outcome to each story and the score rises about 12 points.'],
  ],
};

export const SAMPLE_ANALYTICS_CARDS = {
  roadmap: {
    now: '₹6–12 LPA',
    next: '₹12–20 LPA',
    blocker: 'System Design',
    gap: 19,
    sessions: 6,
  },
  blindSpots: [
    ['Caching and invalidation', 3, 31],
    ['Behavioral: results and numbers', 4, 38],
    ['Database indexing', 2, 44],
  ],
  topics: [
    ['React', 82, 'up'],
    ['Node.js', 74, 'up'],
    ['System Design', 41, 'down'],
    ['SQL', 66, 'flat'],
    ['Behavioral', 49, 'down'],
    ['Data Structures', 71, 'up'],
  ],
};

// Example content for the locked parts of a feedback card (never the user's real answer analysis).
export const SAMPLE_INSIGHTS = {
  modelAnswer: {
    title: 'Model answer',
    lead: 'A top-scoring answer opens with a one-sentence definition, then names the trade-off.',
    rest: [
      'Then it gives one concrete example with a number, such as latency dropping from 800ms to 120ms.',
      'It closes by saying what you would do differently at larger scale, and why.',
      'This is the structure interviewers reward: definition, trade-off, example, next step.',
    ],
  },
  coaching: {
    title: 'Coaching',
    lead: 'Fix this first: say the trade-off out loud, then give one number that shows the impact.',
    rest: [
      'Your answer explained the idea well but never said what you would give up to get it.',
      'Add one sentence beginning with "The cost is..." and your score rises by about 10 points.',
      'Next time, practise the opening line until it takes under 10 seconds.',
    ],
  },
  delivery: {
    title: 'Delivery analysis',
    lead: 'You spoke at a steady pace, with a few long pauses before the key point.',
    rest: [
      'Filler words: 6 in this answer, mostly at the start of sentences.',
      'Vocabulary was varied, but 3 sentences were too long to follow easily.',
      'Pace was 148 words per minute, close to the ideal 130 to 160.',
    ],
  },
  analysis: {
    title: 'Deep analysis',
    lead: 'You covered 4 of the 7 keywords an interviewer listens for on this question.',
    rest: [
      'Missed keywords: blocking, coordinator failure, timeout, idempotency.',
      'Confidence read: moderate. You hedged on the two sentences that mattered most.',
      'Likely follow-ups: "What happens if the coordinator crashes?" and "How would you avoid blocking?"',
    ],
  },
  voice: {
    title: 'Your voice delivery report',
    lead: 'Your pace, filler words and pauses from this spoken answer are ready.',
    rest: [
      'Pace and consistency across the answer, with the fastest and slowest moments marked.',
      'Every filler word counted, with the sentences where it happened most.',
      'Pauses longer than 2 seconds, and where they hurt the flow.',
    ],
  },
};
