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

// ─────────────────────────────────────────────────────────────────────────────
// Full example payloads for the REAL Pro pages (Analytics, Coach) rendered as a
// locked preview for free users. Same shape the server sends a Pro user, all values
// invented. Dates are relative to today so calendars and charts always look current.
// ─────────────────────────────────────────────────────────────────────────────
const TOPICS = ['React', 'Node.js', 'System Design', 'SQL', 'Behavioral', 'Data Structures', 'Operating Systems'];
const TOPIC_DIM = {
  technical: ['React', 'Node.js'], problemSolving: ['Data Structures'], communication: ['Behavioral'],
  behavioral: ['Behavioral'], design: ['System Design'], fundamentals: ['SQL', 'Operating Systems'],
};

const trendScores = [38, 44, 41, 52, 49, 58, 55, 63, 61, 70, 66, 72];
export const SAMPLE_PRO_TREND = trendScores.map((score, i) => {
  const topic = TOPICS[i % TOPICS.length];
  return {
    score,
    date: new Date(Date.now() - (trendScores.length - 1 - i) * 2 * DAY).toISOString(),
    topics: [topic],
    topicScores: {
      technical: Math.min(95, 40 + i * 3), problemSolving: Math.min(95, 35 + i * 3),
      communication: Math.min(95, 45 + i * 2), behavioral: Math.min(95, 30 + i * 2),
      design: Math.min(95, 25 + i * 2), fundamentals: Math.min(95, 50 + i * 2),
    },
  };
});

export const SAMPLE_PRO_ANALYTICS = {
  totalSessions: 12, totalInterviews: 12, totalAnsweredQuestions: 74,
  averageScore: 59, highestScore: 72,
  timePerformance: { averageTimePerQuestion: 48 },
  irs: 58, currentTier: '₹6–12 LPA', currentTierRaw: '₹6–12 LPA', currentTierIsGated: false, sessionsNeededForRawTier: 0,
  tiers: [
    { label: '₹3–6 LPA', minIRS: 0, isUnlocked: true, desc: 'Entry service roles', advice: 'Cover the basics in every core subject.' },
    { label: '₹6–12 LPA', minIRS: 45, isUnlocked: true, desc: 'Strong service and mid product roles', advice: 'Add depth and examples to every answer.' },
    { label: '₹12–20 LPA', minIRS: 65, isUnlocked: false, desc: 'Product companies', advice: 'Practise system design and trade-off reasoning.' },
    { label: '₹20 LPA+', minIRS: 82, isUnlocked: false, desc: 'Top product and startups', advice: 'Hold 80+ across every dimension.' },
  ],
  dimensionProfile: SAMPLE_DIMENSIONS.map((d) => ({ ...d, isProvisional: false, contributingTopics: TOPIC_DIM[d.key] || [] })),
  irsBreakdown: {
    maturity: 0.74, rawComposite: 58,
    components: {
      dimension: { score: 61 }, ewma: { score: 57 }, breadth: { score: 64 }, consistency: { score: 52 }, rigor: { score: 55 },
    },
  },
  topicPerformance: [
    ['React', 82, 6], ['Node.js', 74, 5], ['Data Structures', 71, 4], ['SQL', 66, 5], ['Operating Systems', 61, 3], ['Behavioral', 49, 6], ['System Design', 41, 4],
  ].map(([topic, averageScore, sessionCount], i) => ({
    topic, averageScore, sessionCount, trend: i % 3 === 2 ? -6 : 5, lastScore: averageScore + (i % 2 ? -3 : 4),
    sessions: [averageScore - 12, averageScore - 6, averageScore - 2, averageScore],
  })),
  scoreTrend: SAMPLE_PRO_TREND,
};

export const SAMPLE_WARMUP = {
  available: true, pattern: 'warmup',
  positions: [
    { position: 1, label: '1st session', avgScore: 52, count: 8 },
    { position: 2, label: '2nd session', avgScore: 63, count: 5 },
    { position: 3, label: '3rd session', avgScore: 66, count: 3 },
  ],
};

export const SAMPLE_BLIND_SPOTS = {
  sessionsAnalyzed: 8,
  blindSpots: [
    { topic: 'caching and invalidation', severity: 'high', sessionCount: 5 },
    { topic: 'behavioral results', severity: 'medium', sessionCount: 4 },
    { topic: 'database indexing', severity: 'low', sessionCount: 3 },
  ],
};

export const SAMPLE_LAST_SESSION = {
  sessionScore: 72, avgTimeTaken: 46, skipRate: 10, sessionMode: 'full', totalQuestions: 8,
  sessionDate: new Date(Date.now() - DAY).toISOString(),
  questions: [78, 64, 81, 45, 92, 58, 70, 88].map((score, i) => ({
    index: i + 1, score, skipped: i === 5 && false, timeTaken: 28 + ((i * 11) % 40), topic: TOPICS[i % TOPICS.length],
  })),
};

// Coach AI blocks, in the exact shapes the real components cache. Served by readCache()
// for keys that start with the preview prefix, so the real Coach components render them.
const COACH_PREVIEW_KEY = 'mm_preview_';
export const COACH_PREVIEW_PREFIX = COACH_PREVIEW_KEY;
export const COACH_PREVIEW_CACHE = {
  today: {
    text: 'Your weakest area is System Design at 41. Spend today on one scaling question out loud. Start with users, reads versus writes, and the one number that drives the design. Then name one trade-off and say why you chose it. Finish by re-answering in 90 seconds and compare with your first attempt.',
  },
  weekly: {
    plan: [
      { heading: 'DAY 1-2', body: 'System Design: URL shortener, requirements and estimates. Then redo it with a cache layer.', accent: '#EF4444' },
      { heading: 'DAY 3-4', body: 'Behavioral: two STAR stories, each ending in a measurable result. Record and replay them.', accent: '#F59E0B' },
      { heading: 'DAY 5-6', body: 'Technical: caching, invalidation and consistency trade-offs. One timed topic session.', accent: '#4D94FF' },
      { heading: 'DAY 7', body: 'Full mock for your target company. Compare the score with last week and reset the plan.', accent: '#10B981' },
    ],
  },
  debrief: {
    debrief: {
      sections: [
        { heading: 'WHAT HAPPENED', body: 'You answered 8 questions and averaged 46 seconds each. Two answers scored above 85, one fell below 50.', accent: '#4D94FF' },
        { heading: 'THE BRIGHT SPOT', body: 'Your React and Node answers opened with a clear definition in the first ten seconds.', accent: '#10B981' },
        { heading: 'THE LESSON', body: 'Marks were lost where you skipped the trade-off and never quantified the impact.', accent: '#F59E0B' },
      ].concat([{ heading: 'DO THIS NEXT', body: 'Re-answer your lowest question out loud. Say the trade-off first, then give one number.', accent: '#22D3EE' }]),
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Example AI responses for buttons inside the Pro demo. Shown through ProResponseLock
// (first lines readable, the rest blurred). Never a real answer, never a server call.
// The numbers match SAMPLE_PRO_ANALYTICS so the demo tells one consistent story.
// ─────────────────────────────────────────────────────────────────────────────
export const SAMPLE_CHAT_REPLIES = {
  'Why is my IRS stuck?':
    'IRS 58 is stuck because two dimensions are dragging the composite: System Design at 41 and Behavioral at 49. Your Technical score of 72 is already above par, so more of the same practice will not move the number. Do two topic-mode System Design sessions this week and expect about 4 to 6 IRS points.',
  'Which company should I target first?':
    'Target a service company round first. Your readiness there is 86%, against 78% for product and 69% for startups. Use those offers as a safety net, then aim at product once System Design crosses 55. Run one timed mock for the product round on Friday to see the real gap.',
  "What's my biggest weakness right now?":
    'System Design at 41/100, and it is not close. It carries 10% of IRS weight, but it is the exact topic that separates the ₹6–12 LPA and ₹12–20 LPA tiers. Your last four design answers all skipped the trade-off. Fix that one habit first.',
  'How long until I reach the next tier?':
    'About 6 sessions. You need 7 more IRS points for ₹12–20 LPA, and your trend adds roughly 1.3 points per session. Put 4 of those 6 on System Design and Behavioral and the timeline drops to 4 or 5 sessions.',
  'Full sessions or topic sessions?':
    'Topic sessions for the next two weeks. Your full-session average is held down by two weak dimensions, and full sessions only spend 1 or 2 questions on each. Do 15 questions on System Design, then one full session on Sunday to check the gain.',
  'Am I improving fast enough?':
    'Yes, but unevenly. Your score trend is +2.1 per session over the last 12, which is good. The risk is that all of the gain is in Technical. Without a rise in Behavioral and System Design you will plateau around 65.',
};
export const SAMPLE_CHAT_DEFAULT =
  'Based on your numbers, the fastest gain is System Design: it sits at 41 and every point there lifts your IRS more than anything else you could practise. Do one scaling question out loud today, say the trade-off first, then give one number. Re-check your score after three sessions.';

// A short example verdict for the Company Readiness checker, built from the sample gaps.
export const sampleCompanyVerdict = (company, readinessPct, criticalGaps) => {
  const worst = criticalGaps[0];
  const second = criticalGaps[1];
  if (!worst) {
    return `You are ready for ${company.label}: ${readinessPct}% readiness and every dimension meets the bar.\n\nThe one thing to protect is consistency. Run one timed mock a week so a bad session does not cost you the round.`;
  }
  return `At ${readinessPct}% readiness you are ${readinessPct >= 85 ? 'ready' : readinessPct >= 65 ? 'close' : 'not there yet'} for ${company.label}. The biggest gap is ${worst.label}, ${worst.gap} points short${second ? `, followed by ${second.label} at ${second.gap} short` : ''}.\n\nClose ${worst.label} first: two focused topic sessions a week for about three weeks. Then take a full timed mock for ${company.label} before you apply.`;
};
