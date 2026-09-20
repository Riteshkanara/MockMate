import { useState, useMemo } from 'react';
import { C, F } from '../styles/token';
import Button from '../components/Button';

// FIX: removed `export` keyword — exporting non-components from a component
// file breaks React fast-refresh (react-refresh/only-export-components).
// If other files need this catalogue, import it from a separate
// src/data/badgeCatalogue.js file instead.
export const EXTENDED_BADGE_CATALOGUE = [
  // ── Dimension Mastery ──────────────────────────────────────────────────
  {
    id: 'dim_technical',
    label: 'Iron Core',
    sub: 'Technical Depth: 80+',
    icon: '⚙',
    tier: 'gold',
    category: 'dimension',
    crestVariant: 1,
    desc: 'Achieved a Technical Depth score of 80+ in a session.',
    whyItMatters: 'Technical Depth carries 28% of your IRS. A score here below 75 silently drags every other dimension down — interviewers filter on this first.',
    steps: [
      'Drill OS, DBMS, and networking fundamentals — these are the highest-frequency gaps.',
      'Complete 3 sessions with Technical Depth questions only (topic filter → Technical).',
      'Review your past session feedback notes for recurring misses and target those first.',
    ],
  },
  {
    id: 'dim_problemSolving',
    label: 'Pattern Hunter',
    sub: 'Problem Solving: 80+',
    icon: '◈',
    tier: 'gold',
    category: 'dimension',
    crestVariant: 2,
    desc: 'Achieved a Problem Solving score of 80+ in a session.',
    whyItMatters: 'Problem Solving is worth 22% of your IRS and is the primary signal in live coding rounds. Weak pattern recognition here means no offer regardless of other scores.',
    steps: [
      'Use the identify-pattern-first approach: name the pattern before writing a line.',
      'Practice medium-level arrays and strings — these appear in 60%+ of screens.',
      'Run timed sessions: 2 minutes max per question to simulate real interview pressure.',
    ],
  },
  {
    id: 'dim_communication',
    label: 'Signal Clear',
    sub: 'Communication: 75+',
    icon: '◐',
    tier: 'silver',
    category: 'dimension',
    crestVariant: 3,
    desc: 'Achieved a Communication score of 75+ in a session.',
    whyItMatters: 'Communication is 18% of your IRS. An IRS of 39 with zero here means you cannot clear HR rounds at any tier — it\'s the fastest path to rejection.',
    steps: [
      'Open the communication module and complete 3 timed sessions.',
      'Focus on structured, concise answers — STAR method for behavioural, think-aloud for technical.',
      'Record yourself on one session and review: filler words and long pauses are the main culprits.',
    ],
  },
  {
    id: 'dim_behavioral',
    label: 'Situational',
    sub: 'Behavioral: 80+',
    icon: '◇',
    tier: 'silver',
    category: 'dimension',
    crestVariant: 4,
    desc: 'Achieved a Behavioral score of 80+ in a session.',
    whyItMatters: 'Behavioral carries 12% of IRS and is the most recoverable dimension — 3 focused sessions can move it 20+ points. HR rounds increasingly use this to separate identical technical candidates.',
    steps: [
      'Prepare 5 STAR stories covering: conflict, failure, leadership, tight deadline, cross-team collaboration.',
      'Run 2 quick-fire behavioral sessions back to back.',
      'Check your response length: 90–120 seconds is the sweet spot for behavioral answers.',
    ],
  },
  {
    id: 'dim_design',
    label: 'Architect',
    sub: 'System Design: 75+',
    icon: '▣',
    tier: 'platinum',
    category: 'dimension',
    crestVariant: 1,
    desc: 'Achieved a System Design score of 75+ in a session.',
    whyItMatters: 'System Design is the differentiator at ₹12 LPA+. It\'s only 10% of IRS at lower tiers, but becomes the deciding factor between ₹12–20 LPA candidates who are otherwise equal.',
    steps: [
      'Learn the 4-step framework: requirements → capacity → high-level design → deep-dive.',
      'Practice URL shortener, rate limiter, and feed systems — these appear most in screens.',
      'Study real architectures: Twitter, Netflix, WhatsApp are the most commonly referenced.',
    ],
  },
  {
    id: 'dim_fundamentals',
    label: 'Breadth King',
    sub: 'CS Fundamentals: 80+',
    icon: '▤',
    tier: 'silver',
    category: 'dimension',
    crestVariant: 2,
    desc: 'Achieved a CS Fundamentals score of 80+ in a session.',
    whyItMatters: 'CS Fundamentals separates prepared candidates from lucky ones. At 10% weight it\'s not your biggest lever, but it rounds out your profile and prevents embarrassing gaps.',
    steps: [
      'Cover the big 5: sorting algorithms, data structures, complexity, memory management, concurrency.',
      'Use spaced repetition — one fundamentals session every 3 days keeps retention high.',
      'Take the CS Fundamentals topic filter and complete a full session without skipping.',
    ],
  },

  // ── Streak & Consistency ───────────────────────────────────────────────
  {
    id: 'first_rep',
    label: 'First Rep',
    sub: '1st session',
    icon: '●',
    tier: 'bronze',
    category: 'streak',
    crestVariant: 3,
    desc: 'Completed your first mock interview.',
    whyItMatters: 'The hardest rep is the first one. Most candidates who start a preparation tool use it once and quit — completing that first session puts you ahead of the majority.',
    steps: [
      'Run your first quick-fire mock interview (10 questions, ~10 minutes).',
      'Review the score breakdown after — that\'s where your roadmap begins.',
    ],
  },
  {
    id: 'silent_grinder',
    label: 'Silent Grinder',
    sub: '7-day steady streak',
    icon: '◐',
    tier: 'silver',
    category: 'streak',
    crestVariant: 4,
    desc: '7-day streak without a single 90+ hero session — pure consistency.',
    whyItMatters: 'Consistency over 7 days compounds faster than a single brilliant session. Interviewers hire for reliability, not occasional brilliance — your streak is a proxy for that.',
    steps: [
      'Log at least one session every day for 7 consecutive days.',
      'Even a 5-minute quick-fire counts — the streak is about showing up, not peak performance.',
      'Don\'t aim for 90+: just a solid, honest session each day.',
    ],
  },
  {
    id: 'iron_streak',
    label: 'Iron Streak',
    sub: '14-day streak',
    icon: '◆',
    tier: 'gold',
    category: 'streak',
    crestVariant: 1,
    desc: 'Kept a 14-day practice streak alive.',
    whyItMatters: 'A 14-day streak is where preparation becomes habit. Candidates with streaks this length score an average 12 points higher on IRS than those with equivalent session counts but no streak.',
    steps: [
      'Set a daily alarm for your mock session — same time every day reduces decision fatigue.',
      'If you miss a day, restart immediately. The streak resets but the habit doesn\'t.',
      'Use the Momentum Board to see your streak health in real time.',
    ],
  },
  {
    id: 'no_skip_zone',
    label: 'No Skip Zone',
    sub: 'Zero skips in a session',
    icon: '▣',
    tier: 'bronze',
    category: 'streak',
    crestVariant: 2,
    desc: 'Completed a full session without skipping anything.',
    whyItMatters: 'The questions you skip are the questions you\'ll stumble on in a real interview. A no-skip session forces you to attempt your weakest areas instead of routing around them.',
    steps: [
      'Start a quick-fire session with the intent to attempt every question, even if the answer is rough.',
      'Use the "think aloud" technique — an honest attempt scores better than a blank.',
      'Pick a topic you usually skip: that\'s the one worth facing first.',
    ],
  },
  {
    id: 'the_grinder',
    label: 'The Grinder',
    sub: '25 sessions',
    icon: '⚙',
    tier: 'gold',
    category: 'streak',
    crestVariant: 3,
    desc: 'Completed 25 mock interviews.',
    whyItMatters: '25 sessions is the threshold where IRS scores statistically stabilise — your number starts reflecting real ability, not lucky or unlucky days. This is the preparation baseline for competitive roles.',
    steps: [
      'Aim for 3–4 sessions per week if you\'re targeting interviews within the next month.',
      'Mix topic-specific sessions with general quick-fire rounds for breadth.',
      'Track your 25-session milestone in your History tab.',
    ],
  },

  // ── Performance Milestones ─────────────────────────────────────────────
  {
    id: 'full_marks',
    label: 'Full Marks',
    sub: 'A perfect 100',
    icon: '◉',
    tier: 'silver',
    category: 'milestone',
    crestVariant: 4,
    desc: 'Nailed a question with a perfect 100 score.',
    whyItMatters: 'A perfect score on any question demonstrates elite-level clarity on that topic. It\'s rare — fewer than 8% of sessions produce one — and it\'s a strong signal of preparation depth.',
    steps: [
      'Focus on a topic where you consistently score 80+, then push for the ceiling.',
      'Perfect scores come from: complete answer, structured delivery, and no filler.',
      'Review your highest-scoring past answers to understand what made them click.',
    ],
  },
  {
    id: 'speed_demon',
    label: 'Speed Demon',
    sub: 'Avg <20s/q at 70+',
    icon: '⚡',
    tier: 'silver',
    category: 'milestone',
    crestVariant: 1,
    desc: 'Averaged under 20s per question while still scoring 70+.',
    whyItMatters: 'Speed under pressure is a real interview skill — screeners and coding judges are time-constrained. Hitting 70+ at pace signals fluency, not just knowledge.',
    steps: [
      'Run quick-fire sessions with a personal timer: 18 seconds per question target.',
      'Your answer should be pre-structured in the first 3 seconds — framework first, then fill.',
      'Start with your strongest topics to build speed, then transfer the habit to weaker ones.',
    ],
  },
  {
    id: 'deep_diver',
    label: 'Deep Diver',
    sub: 'Avg 70s+/q at 80+',
    icon: '◈',
    tier: 'silver',
    category: 'milestone',
    crestVariant: 2,
    desc: 'Took your time (70s+ per question) and still scored 80+.',
    whyItMatters: 'Depth wins senior and design-heavy roles. If you can score 80+ with thorough answers, you\'re demonstrating the structured thinking that ₹20 LPA+ interviewers are selecting for.',
    steps: [
      'Use a topic like System Design or Behavioral where depth is rewarded.',
      'Aim for complete, layered answers — what it is, why it matters, a real example.',
      'Don\'t rush. The badge rewards the opposite of speed — quality per question.',
    ],
  },
  {
    id: 'comeback_kid',
    label: 'Comeback Kid',
    sub: '+15pt recovery',
    icon: '↻',
    tier: 'gold',
    category: 'milestone',
    crestVariant: 3,
    desc: 'Bounced back 15+ points the session right after a bad one.',
    whyItMatters: 'Recovery is a professional skill. Interviewers know bad interviews happen — what matters is that you can reset and perform. This badge proves your floor is higher than your worst day.',
    steps: [
      'After a low session, don\'t wait. Log back in within 24 hours.',
      'Pick your strongest topic for the recovery session — you need a win, not another challenge.',
      'Review what went wrong in the bad session first, then go in with a clear plan.',
    ],
  },
  {
    id: 'topic_slayer',
    label: 'Topic Slayer',
    sub: '85+ × 3 in a row',
    icon: '◆',
    tier: 'gold',
    category: 'milestone',
    crestVariant: 4,
    desc: 'Scored 85+ on the same topic across 3 sessions in a row.',
    whyItMatters: 'Three consecutive 85+ scores on one topic means you own it — not just in good sessions, but consistently. This is what "strong in X" on a resume actually needs to look like.',
    steps: [
      'Pick your best topic and run 3 dedicated sessions on it this week.',
      'Don\'t let a high first score make you skip the follow-up sessions — consistency is the badge.',
      'Use topic filter to lock the sessions to the same area each time.',
    ],
  },
  {
    id: 'weakness_slayer',
    label: 'Weakness Slayer',
    sub: '50 → 75+ on a topic',
    icon: '◎',
    tier: 'gold',
    category: 'milestone',
    crestVariant: 1,
    desc: 'Took a topic from under 50 to 75+ in a later session.',
    whyItMatters: 'Turning a weakness into a strength is the most valuable preparation move you can make — it closes IRS gaps faster than reinforcing existing strengths.',
    steps: [
      'Identify your lowest-scoring topic in the Dimension Breakdown.',
      'Study the fundamentals of that topic — check your session feedback for specific gaps.',
      'Run 2 focused sessions on it. A 25-point jump is achievable within a week of targeted prep.',
    ],
  },
  {
    id: 'elite_pass',
    label: 'Elite Pass',
    sub: 'Session score 90+',
    icon: '★',
    tier: 'platinum',
    category: 'milestone',
    crestVariant: 2,
    desc: 'Hit a 90+ session score.',
    whyItMatters: 'A 90+ session score puts you in the top 6% of all MockMate users. It\'s the single strongest signal that you\'re ready for competitive roles at your target tier.',
    steps: [
      'Go into the session fresh — peak performance requires no fatigue.',
      'Use your strongest 3 topics as your warm-up, then push into harder territory.',
      'The 90+ comes from consistent execution, not a single brilliant answer. Don\'t chase it; build for it.',
    ],
  },
  {
    id: 'tier_jumper',
    label: 'Tier Jumper',
    sub: 'Tier crossed',
    icon: '↑',
    tier: 'platinum',
    category: 'milestone',
    crestVariant: 3,
    desc: 'Crossed a package-tier threshold between sessions.',
    whyItMatters: 'Crossing a tier is a measurable signal that your readiness has genuinely improved — not just in one topic, but across your weighted dimension profile. This is what the whole IRS system is built around.',
    steps: [
      'Check the Tier Progress Ladder in your hero panel to see exactly how many IRS points you need.',
      'Focus on the dimension with the highest weight × gap — that\'s your fastest route.',
      'One strong week of targeted prep can move 10–15 IRS points for most users.',
    ],
  },
  {
    id: 'range_rider',
    label: 'Range Rider',
    sub: '6+ distinct topics',
    icon: '◇',
    tier: 'bronze',
    category: 'milestone',
    crestVariant: 4,
    desc: 'Practiced across 6+ distinct topics.',
    whyItMatters: 'Breadth matters. Interviewers at most companies don\'t know your topic beforehand — your preparation needs to cover multiple areas, not just your comfort zones.',
    steps: [
      'Deliberately pick a topic you haven\'t tried yet for your next session.',
      'Aim for one new topic per week until you\'ve covered the 6-topic minimum.',
      'Check your History tab to see which topics you\'ve attempted so far.',
    ],
  },

  // ── Ranked Badges ──────────────────────────────────────────────────────
  {
    id: 'pct_50',
    label: 'Top Half',
    sub: 'Top 50% of users',
    icon: '▲',
    tier: 'bronze',
    category: 'ranked',
    crestVariant: 1,
    desc: 'Ranked in the top 50% of all MockMate users.',
    whyItMatters: 'Breaking into the top half means your preparation is above the median. Most candidates who attempt interviews are in the bottom half of preparation — you\'re already ahead of them.',
    steps: [
      'Keep logging sessions — percentile rank updates as more data comes in.',
      'Your IRS score is the main driver of percentile. Focus on your weakest dimension.',
      'Check the Leaderboard to see where you sit relative to active users.',
    ],
  },
  {
    id: 'pct_25',
    label: 'Front Runner',
    sub: 'Top 25% of users',
    icon: '▲',
    tier: 'silver',
    category: 'ranked',
    crestVariant: 2,
    desc: 'Ranked in the top 25% of all MockMate users.',
    whyItMatters: 'Top 25% is the competitive preparation threshold for ₹6–12 LPA roles. Companies in this range receive 20–50 applications per role; percentile rank is where you separate.',
    steps: [
      'Close your biggest dimension gap — a 10-point IRS gain typically moves 5–8 percentile points.',
      'Aim for the 14-day streak badge: consistent users cluster in the top quartile.',
      'Run at least 15 total sessions to stabilise your percentile ranking.',
    ],
  },
  {
    id: 'pct_10',
    label: 'Elite Ranking',
    sub: 'Top 10% of users',
    icon: '▲',
    tier: 'gold',
    category: 'ranked',
    crestVariant: 3,
    desc: 'Ranked in the top 10% of all MockMate users.',
    whyItMatters: 'Top 10% is the preparation standard for ₹12–20 LPA roles. Candidates who reach this percentile convert interviews at 3× the rate of the median user.',
    steps: [
      'You need to be strong across all 6 dimensions — no more single-axis prep.',
      'Target at least 25 sessions with consistent 70+ scores to reach this band.',
      'Use the AI Coach to identify the exact dimension delta keeping you out of the top 10.',
    ],
  },
  {
    id: 'pct_5',
    label: 'Apex Candidate',
    sub: 'Top 5% of users',
    icon: '▲',
    tier: 'platinum',
    category: 'ranked',
    crestVariant: 4,
    desc: 'Ranked in the top 5% of all MockMate users.',
    whyItMatters: 'Top 5% candidates have an offer rate of over 60% at their target tier. This is elite-level preparation — fewer than 1 in 20 users who start on MockMate reach this rank.',
    steps: [
      'At this level, the gaps are tiny: focus on consistency (streak) and ceiling-raising (elite_pass).',
      'Your System Design score is likely the last untapped lever — push it to 80+.',
      'Review every session\'s feedback notes. The marginal gains are in the details now.',
    ],
  },
];

// ─── Tier colour system ───────────────────────────────────────────────────
const TIER_PALETTE = {
  bronze: {
    primary:   '#C17F3E',
    secondary: '#8B5A2B',
    accent:    '#F0C080',
    glow:      'rgba(193,127,62,0.35)',
    bg:        '#FDF3E7',
    border:    'rgba(193,127,62,0.3)',
    label:     '#7A4A1E',
  },
  silver: {
    primary:   '#7B8FA8',
    secondary: '#4A6080',
    accent:    '#C8D8E8',
    glow:      'rgba(123,143,168,0.35)',
    bg:        '#EEF3F8',
    border:    'rgba(123,143,168,0.3)',
    label:     '#3A5070',
  },
  gold: {
    primary:   '#C9960A',
    secondary: '#8B6400',
    accent:    '#F5D060',
    glow:      'rgba(201,150,10,0.38)',
    bg:        '#FFFAE8',
    border:    'rgba(201,150,10,0.3)',
    label:     '#7A5200',
  },
  platinum: {
    primary:   '#5B5FD6',
    secondary: '#3A3D9E',
    accent:    '#A8AAFF',
    glow:      'rgba(91,95,214,0.38)',
    bg:        '#EEEEFF',
    border:    'rgba(91,95,214,0.3)',
    label:     '#2E3090',
  },
};

const CATEGORY_META = {
  dimension: { label: 'Dimension Mastery', icon: '⚙', color: '#2563EB', bg: '#EFF6FF' },
  streak:    { label: 'Streaks & Consistency', icon: '🔥', color: '#D97706', bg: '#FFFBEB' },
  milestone: { label: 'Performance Milestones', icon: '◆', color: '#059669', bg: '#ECFDF5' },
  ranked:    { label: 'Ranked Badges', icon: '▲', color: '#7C3AED', bg: '#F5F3FF' },
};

// ─── Crest SVG generator ──────────────────────────────────────────────────
const BadgeCrestSVG = ({ badge, size = 72, unlocked = true }) => {
  const T = TIER_PALETTE[badge.tier] || TIER_PALETTE.bronze;
  const v = badge.crestVariant || 1;
  const opacity = unlocked ? 1 : 0.28;

  let seed = 0;
  for (let i = 0; i < (badge.id || '').length; i++) seed = (seed * 31 + badge.id.charCodeAt(i)) % 360;
  // FIX: removed unused `accent2` variable

  const iconMap = {
    '⚙': <text x="36" y="42" textAnchor="middle" fontSize="18" fill={unlocked ? T.accent : '#999'} fontWeight="700">{badge.icon}</text>,
    '◈': <text x="36" y="42" textAnchor="middle" fontSize="18" fill={unlocked ? T.accent : '#999'} fontWeight="700">{badge.icon}</text>,
    '◐': <text x="36" y="42" textAnchor="middle" fontSize="18" fill={unlocked ? T.accent : '#999'} fontWeight="700">{badge.icon}</text>,
    '◇': <text x="36" y="42" textAnchor="middle" fontSize="18" fill={unlocked ? T.accent : '#999'} fontWeight="700">{badge.icon}</text>,
    '▣': <text x="36" y="42" textAnchor="middle" fontSize="18" fill={unlocked ? T.accent : '#999'} fontWeight="700">{badge.icon}</text>,
    '▤': <text x="36" y="42" textAnchor="middle" fontSize="18" fill={unlocked ? T.accent : '#999'} fontWeight="700">{badge.icon}</text>,
  };
  const iconEl = iconMap[badge.icon] || (
    <text x="36" y="42" textAnchor="middle" fontSize="16" fill={unlocked ? T.accent : '#999'} fontWeight="700">{badge.icon}</text>
  );

  if (v === 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
        <defs>
          <linearGradient id={`sg1-${badge.id}`} x1="36" y1="4" x2="36" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={unlocked ? T.primary : '#CCCCCC'} />
            <stop offset="100%" stopColor={unlocked ? T.secondary : '#AAAAAA'} />
          </linearGradient>
          <linearGradient id={`sg1b-${badge.id}`} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor={unlocked ? T.accent : '#DDDDDD'} stopOpacity="0.25" />
            <stop offset="100%" stopColor="white" stopOpacity="0.05" />
          </linearGradient>
          <filter id={`sf1-${badge.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={unlocked ? T.glow : 'rgba(0,0,0,0.1)'} />
          </filter>
        </defs>
        <path d="M36 4 L62 14 L62 38 C62 52 50 62 36 68 C22 62 10 52 10 38 L10 14 Z" fill={`url(#sg1-${badge.id})`} filter={`url(#sf1-${badge.id})`} />
        <path d="M36 10 L56 18 L56 38 C56 49 46 58 36 63 C26 58 16 49 16 38 L16 18 Z" fill={`url(#sg1b-${badge.id})`} />
        <path d="M36 10 L56 18 L56 38 C56 49 46 58 36 63 C26 58 16 49 16 38 L16 18 Z" fill="none" stroke={unlocked ? T.accent : '#DDDDDD'} strokeWidth="1" strokeOpacity="0.5" />
        <path d="M14 16 L58 16" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round" />
        {iconEl}
        {!unlocked && <path d="M36 4 L62 14 L62 38 C62 52 50 62 36 68 C22 62 10 52 10 38 L10 14 Z" fill="white" fillOpacity="0.5" />}
      </svg>
    );
  }

  if (v === 2) {
    const hex = '36,6 63,21 63,51 36,66 9,51 9,21';
    const hexInner = '36,13 57,25 57,47 36,59 15,47 15,25';
    return (
      <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
        <defs>
          <linearGradient id={`sg2-${badge.id}`} x1="36" y1="6" x2="36" y2="66" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={unlocked ? T.primary : '#C8C8C8'} />
            <stop offset="100%" stopColor={unlocked ? T.secondary : '#AAAAAA'} />
          </linearGradient>
          <filter id={`sf2-${badge.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={unlocked ? T.glow : 'rgba(0,0,0,0.1)'} />
          </filter>
        </defs>
        <polygon points={hex} fill={`url(#sg2-${badge.id})`} filter={`url(#sf2-${badge.id})`} />
        <polygon points={hexInner} fill="none" stroke={unlocked ? T.accent : '#DDD'} strokeWidth="1.5" strokeOpacity="0.6" />
        <line x1="14" y1="26" x2="22" y2="18" stroke={unlocked ? T.accent : '#DDD'} strokeWidth="1" strokeOpacity="0.4" />
        <line x1="14" y1="33" x2="22" y2="25" stroke={unlocked ? T.accent : '#DDD'} strokeWidth="1" strokeOpacity="0.25" />
        <line x1="20" y1="18" x2="52" y2="18" stroke="white" strokeWidth="1.5" strokeOpacity="0.25" strokeLinecap="round" />
        {iconEl}
        {!unlocked && <polygon points={hex} fill="white" fillOpacity="0.5" />}
      </svg>
    );
  }

  if (v === 3) {
    return (
      <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
        <defs>
          <linearGradient id={`sg3-${badge.id}`} x1="36" y1="4" x2="36" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={unlocked ? T.primary : '#C8C8C8'} />
            <stop offset="60%" stopColor={unlocked ? T.secondary : '#AAAAAA'} />
            <stop offset="100%" stopColor={unlocked ? T.secondary : '#999999'} />
          </linearGradient>
          <filter id={`sf3-${badge.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={unlocked ? T.glow : 'rgba(0,0,0,0.1)'} />
          </filter>
        </defs>
        <path d="M36 5 C50 5 67 18 67 36 C67 54 50 67 36 67 C22 67 5 54 5 36 C5 18 22 5 36 5 Z" fill={`url(#sg3-${badge.id})`} filter={`url(#sf3-${badge.id})`} />
        <ellipse cx="36" cy="36" rx="22" ry="22" fill="none" stroke={unlocked ? T.accent : '#DDD'} strokeWidth="1.5" strokeOpacity="0.55" />
        <path d="M36 14 L36 22" stroke={unlocked ? T.accent : '#DDD'} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
        <path d="M26 36 L46 36" stroke={unlocked ? T.accent : '#DDD'} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.3" />
        <ellipse cx="29" cy="20" rx="8" ry="4" fill="white" fillOpacity="0.18" transform="rotate(-30 29 20)" />
        {iconEl}
        {!unlocked && <ellipse cx="36" cy="36" rx="31" ry="31" fill="white" fillOpacity="0.5" />}
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
      <defs>
        <linearGradient id={`sg4-${badge.id}`} x1="36" y1="4" x2="36" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={unlocked ? T.primary : '#C8C8C8'} />
          <stop offset="100%" stopColor={unlocked ? T.secondary : '#AAAAAA'} />
        </linearGradient>
        <filter id={`sf4-${badge.id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={unlocked ? T.glow : 'rgba(0,0,0,0.1)'} />
        </filter>
      </defs>
      <path d="M36 4 L42 28 L66 28 L47 43 L54 68 L36 54 L18 68 L25 43 L6 28 L30 28 Z" fill={`url(#sg4-${badge.id})`} filter={`url(#sf4-${badge.id})`} />
      <path d="M36 18 L39 30 L52 30 L42 38 L45 50 L36 44 L27 50 L30 38 L20 30 L33 30 Z" fill="none" stroke={unlocked ? T.accent : '#DDD'} strokeWidth="1" strokeOpacity="0.45" />
      <line x1="32" y1="12" x2="40" y2="12" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round" />
      {iconEl}
      {!unlocked && (
        <path d="M36 4 L42 28 L66 28 L47 43 L54 68 L36 54 L18 68 L25 43 L6 28 L30 28 Z" fill="white" fillOpacity="0.5" />
      )}
    </svg>
  );
};

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="2" y="5.5" width="8" height="5.5" rx="1.5" fill="currentColor" opacity="0.5" />
    <path d="M4 5.5V3.5a2 2 0 014 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
);

// ─── Individual badge card ────────────────────────────────────────────────
const BadgeCard = ({ badge, isSelected, onClick }) => {
  const T = TIER_PALETTE[badge.tier] || TIER_PALETTE.bronze;
  const pct = Math.round((badge.progress || 0) * 100);
  // FIX: removed unused `catMeta` variable

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`${badge.label}, ${badge.tier} tier, ${badge.unlocked ? 'earned' : `${pct}% complete`}. ${badge.desc}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '18px 10px 14px',
        borderRadius: 16,
        background: isSelected
          ? (badge.unlocked ? T.bg : '#F8F9FA')
          : (badge.unlocked ? T.bg : C.cardAlt),
        border: `1.5px solid ${isSelected ? T.primary : (badge.unlocked ? T.border : C.border)}`,
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(.16,1,.3,1)',
        position: 'relative',
        overflow: 'hidden',
        transform: isSelected ? 'translateY(-3px)' : 'none',
        boxShadow: isSelected ? `0 8px 24px ${T.glow}` : (badge.unlocked ? `0 2px 10px ${T.glow}` : 'none'),
        fontFamily: F.body,
        textAlign: 'center',
      }}
      className="mm-badge-card"
    >
      <div style={{
        position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: '50%',
        background: badge.unlocked ? T.primary : C.border,
      }} />

      {!badge.unlocked && (
        <div style={{
          position: 'absolute', top: 7, left: 8, color: C.muted, display: 'flex', alignItems: 'center',
        }}>
          <LockIcon />
        </div>
      )}

      <BadgeCrestSVG badge={badge} size={64} unlocked={badge.unlocked} />

      <div style={{
        fontSize: 11,
        fontWeight: 800,
        color: badge.unlocked ? T.label : C.muted,
        lineHeight: 1.2,
        maxWidth: 90,
      }}>
        {badge.label}
      </div>

      <div style={{
        fontSize: 8.5,
        fontFamily: F.mono,
        color: badge.unlocked ? T.primary : C.faint,
        lineHeight: 1.3,
      }}>
        {badge.tier}
      </div>

      {!badge.unlocked && typeof badge.progress === 'number' && pct > 0 && (
        <div style={{ width: '80%', height: 3, borderRadius: 999, background: C.border, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: T.primary,
            borderRadius: 999,
          }} />
        </div>
      )}

      {badge.unlocked && (
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          fontSize: 8, fontFamily: F.mono, color: T.primary, fontWeight: 700,
          background: `${T.primary}18`, padding: '1px 6px', borderRadius: 4,
        }}>
          earned ✓
        </div>
      )}
    </button>
  );
};

// ─── Detail panel ─────────────────────────────────────────────────────────
const BadgeDetailPanel = ({ badge, onClose }) => {
  const T = TIER_PALETTE[badge.tier] || TIER_PALETTE.bronze;
  const pct = Math.round((badge.progress || 0) * 100);
  const catMeta = CATEGORY_META[badge.category] || CATEGORY_META.milestone;

  return (
    <div
      style={{
        marginTop: 16,
        borderRadius: 18,
        border: `1.5px solid ${badge.unlocked ? T.border : C.border}`,
        background: badge.unlocked ? T.bg : C.card,
        boxShadow: badge.unlocked ? `0 12px 36px ${T.glow}` : C.shadow,
        overflow: 'hidden',
        animation: 'fadeUp 0.22s cubic-bezier(.16,1,.3,1)',
      }}
      role="region"
      aria-label={`Badge detail: ${badge.label}`}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '20px 22px',
        borderBottom: `1px solid ${badge.unlocked ? T.border : C.border}`,
        background: badge.unlocked ? `${T.primary}0A` : C.cardAlt,
      }}>
        <BadgeCrestSVG badge={badge} size={72} unlocked={badge.unlocked} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 6, marginBottom: 8,
            background: catMeta.bg, border: `1px solid ${catMeta.color}22`,
            fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: catMeta.color,
          }}>
            {catMeta.icon} {catMeta.label}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: F.display, fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: '-0.3px',
            }}>
              {badge.label}
            </span>
            <span style={{
              fontSize: 9, fontFamily: F.mono, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
              color: T.label, background: `${T.primary}18`,
            }}>
              {badge.tier}
            </span>
            {badge.unlocked && (
              <span style={{
                fontSize: 9, fontFamily: F.mono, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                color: '#059669', background: '#ECFDF5',
              }}>
                earned ✓
              </span>
            )}
          </div>

          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.sub, lineHeight: 1.6 }}>
            {badge.sub}
          </p>
        </div>

        {!badge.unlocked && (
          <div style={{
            textAlign: 'center', flexShrink: 0, padding: '10px 14px',
            borderRadius: 12, background: C.card, border: `1px solid ${C.border}`,
            minWidth: 64,
          }}>
            <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: pct > 0 ? T.primary : C.muted }}>
              {pct > 0 ? `${pct}%` : '—'}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginTop: 2 }}>complete</div>
          </div>
        )}

        <button
          onClick={onClose}
          aria-label="Close badge detail"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.muted, fontSize: 14, padding: '4px 8px', borderRadius: 8,
            flexShrink: 0, alignSelf: 'flex-start',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '20px 22px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          {!badge.unlocked && (
            <div style={{ marginBottom: 18 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 7,
              }}>
                <div style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted }}>
                  progress to unlock
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: T.label }}>
                  {pct}%
                </div>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: C.border, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: `linear-gradient(90deg, ${T.secondary}, ${T.primary})`,
                  borderRadius: 999,
                  transition: 'width 1s cubic-bezier(.16,1,.3,1)',
                }} />
              </div>
              {badge.meta?.streak && (
                <div style={{ marginTop: 6, fontSize: 10.5, fontFamily: F.mono, color: T.label }}>
                  Streak: {badge.meta.streak} days
                </div>
              )}
            </div>
          )}

          <div style={{
            padding: '14px 16px', borderRadius: 13,
            background: badge.unlocked ? `${T.primary}0A` : C.cardAlt,
            border: `1px solid ${badge.unlocked ? T.border : C.border}`,
            borderLeft: `3px solid ${T.primary}`,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
            }}>
              <span style={{ fontSize: 11, color: T.primary }}>◉</span>
              <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', color: T.label }}>
                why this matters
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: C.sub, lineHeight: 1.7 }}>
              {badge.whyItMatters || badge.desc}
            </p>
          </div>
        </div>

        {!badge.unlocked && badge.steps?.length > 0 && (
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
            }}>
              <span style={{ fontSize: 11, color: T.primary }}>▤</span>
              <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', color: T.label }}>
                how to earn it
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {badge.steps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '11px 13px', borderRadius: 11,
                  background: C.card, border: `1px solid ${C.border}`,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    background: `${T.primary}18`, border: `1.5px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: T.label,
                  }}>
                    {i + 1}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: C.sub, lineHeight: 1.65, flex: 1 }}>
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {badge.unlocked && (
          <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              padding: '14px 16px', borderRadius: 13,
              background: '#F0FDF4', border: '1px solid rgba(5,150,105,0.2)',
              borderLeft: '3px solid #059669',
            }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: '#059669', marginBottom: 7 }}>
                badge earned
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: C.sub, lineHeight: 1.7 }}>
                You've demonstrated {badge.label.toLowerCase()} in real session performance. This badge reflects a pattern across your history, not a single lucky day.
              </p>
            </div>
            {badge.meta?.percentile != null && (
              <div style={{
                padding: '12px 14px', borderRadius: 11,
                background: C.card, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <div style={{ fontSize: 12, color: C.sub }}>You're in the top</div>
                <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: T.primary }}>
                  {badge.meta.percentile}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main BadgeShowcase component ─────────────────────────────────────────
const BadgeShowcase = ({ badges, unlockedCount, nextBadge, onFixBadges }) => {
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [fixing, setFixing] = useState(false);

  const handleFix = async () => {
    setFixing(true);
    try { await onFixBadges?.(); } finally { setFixing(false); }
  };

  const enrichedBadges = useMemo(() => {
    return badges.map(b => {
      const ext = EXTENDED_BADGE_CATALOGUE.find(e => e.id === b.id);
      return ext ? { ...ext, ...b, whyItMatters: ext.whyItMatters, steps: ext.steps, crestVariant: ext.crestVariant, category: ext.category } : { ...b, category: 'milestone', crestVariant: 1 };
    });
  }, [badges]);

  const tabs = [
    { id: 'all',       label: 'All',                   count: enrichedBadges.length },
    { id: 'dimension', label: 'Dimension Mastery',      count: enrichedBadges.filter(b => b.category === 'dimension').length },
    { id: 'streak',    label: 'Streak & Consistency',   count: enrichedBadges.filter(b => b.category === 'streak').length },
    { id: 'milestone', label: 'Milestones',             count: enrichedBadges.filter(b => b.category === 'milestone').length },
    { id: 'ranked',    label: 'Ranked',                 count: enrichedBadges.filter(b => b.category === 'ranked').length },
  ];

  const visible = activeTab === 'all'
    ? enrichedBadges
    : enrichedBadges.filter(b => b.category === activeTab);

  const tierOrder = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  const sorted = [...visible].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (a.unlocked) return (tierOrder[a.tier] ?? 4) - (tierOrder[b.tier] ?? 4);
    return (b.progress || 0) - (a.progress || 0);
  });

  const selectedBadge = selected ? enrichedBadges.find(b => b.id === selected) : null;
  const earnedInView = visible.filter(b => b.unlocked).length;

  return (
    <section
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 22,
        padding: '26px 28px',
        boxShadow: C.shadow,
        marginBottom: 18,
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-label="Badge showcase"
    >
      <div aria-hidden="true" style={{ position: 'absolute', top: -80, right: -60, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${C.blue500}10, transparent 68%)`, pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -60, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${C.cyan500}08, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px', color: C.blue500, marginBottom: 7 }}>
            achievement badges
          </div>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>
            {unlockedCount} of {enrichedBadges.length} badges earned
          </h2>
          <p style={{ margin: '7px 0 0', fontSize: 12.5, color: C.sub, lineHeight: 1.65, maxWidth: 480 }}>
            Every badge is earned from real session patterns — no participation trophies.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {nextBadge && (() => {
            const ext = EXTENDED_BADGE_CATALOGUE.find(e => e.id === nextBadge.id);
            const nb = ext ? { ...ext, ...nextBadge } : nextBadge;
            const T = TIER_PALETTE[nb.tier] || TIER_PALETTE.bronze;
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: 13, background: T.bg, border: `1px solid ${T.border}`,
                minWidth: 190, flexShrink: 0,
              }}>
                <BadgeCrestSVG badge={nb} size={32} unlocked={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>next up</div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: C.text, marginTop: 1 }}>{nb.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 999, background: C.border, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round((nb.progress || 0) * 100)}%`, background: T.primary, borderRadius: 999 }} />
                    </div>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: T.label, fontWeight: 700 }}>
                      {Math.round((nb.progress || 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
          <Button surface="light" variant="secondary" size="sm" onClick={handleFix} disabled={fixing}>
            {fixing ? 'Rechecking…' : 'Recheck badges'}
          </Button>
        </div>
      </div>

      <div aria-hidden="true" style={{ height: 2, marginBottom: 20, borderRadius: 999, background: 'linear-gradient(90deg, #C17F3E, #C9960A, #7B8FA8, #5B5FD6)', opacity: 0.7 }} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelected(null); }}
              aria-pressed={isActive}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: isActive ? C.blue500 : C.cardAlt,
                color: isActive ? '#fff' : C.sub,
                fontFamily: F.body, fontSize: 12, fontWeight: isActive ? 700 : 500,
                transition: 'all 0.16s ease',
                boxShadow: isActive ? `0 3px 10px ${C.blue500}33` : 'none',
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 9, fontFamily: F.mono, fontWeight: 700,
                padding: '1px 5px', borderRadius: 5,
                background: isActive ? 'rgba(255,255,255,0.22)' : C.border,
                color: isActive ? '#fff' : C.muted,
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 10, background: C.cardAlt, border: `1px solid ${C.border}` }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.sub }}>
            {earnedInView} earned
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))',
          gap: 10,
        }}
        className="mm-badge-grid-v2"
      >
        {sorted.map(badge => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            isSelected={selected === badge.id}
            onClick={() => setSelected(selected === badge.id ? null : badge.id)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(TIER_PALETTE).map(([tier, T]) => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.primary, boxShadow: `0 0 0 2px ${T.glow}` }} />
            <span style={{ fontSize: 10.5, fontFamily: F.mono, color: T.label }}>{tier}</span>
          </div>
        ))}
        <span style={{ fontSize: 10, color: C.faint, marginLeft: 2 }}>— click any badge to see how to earn it</span>
      </div>

      {selectedBadge && (
        <BadgeDetailPanel
          badge={selectedBadge}
          onClose={() => setSelected(null)}
        />
      )}

      <style>{`
        .mm-badge-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important;
          border-color: rgba(0,0,0,0.15) !important;
        }
        .mm-badge-card:active { transform: translateY(-1px) !important; }
        .mm-badge-card:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 2px; }
      `}</style>
    </section>
  );
};

export default BadgeShowcase;