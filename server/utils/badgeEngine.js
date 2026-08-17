/**
 * MOCKMATE BADGE ENGINE
 * ──────────────────────
 * Replaces the old flat BADGES array (which only checked totalInterviews /
 * bestScore / streak.current) with genuine, multi-signal criteria computed
 * from real completed-session data. Nothing here is decorative — every
 * badge either required a NEW capability (avoiding a low-quality first
 * attempt) or a SUSTAINED pattern (not a one-off fluke).
 *
 * USAGE:
 *   const { evaluateBadges } = require('./badgeEngine');
 *   const badges = evaluateBadges({ user, sessions }); // sessions = completed, sorted oldest→newest
 *
 * Each returned badge: { id, label, icon, tier, desc, unlocked, progress? }
 *   tier: 'bronze' | 'silver' | 'gold' | 'platinum' — controls card treatment
 *   progress: 0–1, only present for locked badges close enough to be worth showing
 */

const clamp01 = (v) => Math.max(0, Math.min(1, v || 0));

// ─── Helpers over raw session data ───────────────────────────────────────────

/** Per-session average score, using the same normalization as the controller. */
const sessionScore = (s) => {
  if (typeof s.averageScore === 'number' && s.averageScore >= 0 && s.averageScore <= 100) {
    return Math.round(s.averageScore);
  }
  const qs = s.questions || [];
  if (!qs.length) return 0;
  const total = qs.reduce((a, q) => a + (Number(q.score) || 0), 0);
  return Math.round(total / qs.length);
};

/** Flatten all answered (non-skipped) questions across sessions, tagged with session index/date. */
const allAnsweredQuestions = (sessions) =>
  sessions.flatMap((s, i) =>
    (s.questions || [])
      .filter((q) => !q.skipped && q.userAnswer)
      .map((q) => ({ ...q, sessionIndex: i, sessionDate: s.createdAt }))
  );

/** Distinct topics with at least one answered question. */
const distinctTopics = (sessions) => {
  const set = new Set();
  allAnsweredQuestions(sessions).forEach((q) => set.add((q.topic || 'General').trim()));
  return [...set];
};

/** Per-topic chronological score series: { topic: [scores in session order] } */
const topicSeries = (sessions) => {
  const map = {};
  sessions.forEach((s) => {
    const bySessionTopic = {};
    (s.questions || []).forEach((q) => {
      if (q.skipped || !q.userAnswer) return;
      const topic = (q.topic || 'General').trim();
      if (!bySessionTopic[topic]) bySessionTopic[topic] = [];
      bySessionTopic[topic].push(Number(q.score) || 0);
    });
    Object.entries(bySessionTopic).forEach(([topic, scores]) => {
      const avg = scores.reduce((a, v) => a + v, 0) / scores.length;
      if (!map[topic]) map[topic] = [];
      map[topic].push(avg);
    });
  });
  return map;
};

// ─── Individual badge checkers ───────────────────────────────────────────────
// Each returns { unlocked: bool, progress?: 0-1, meta?: any } — meta powers
// the "why you earned this" caption on the frontend.

const checkFirstRep = ({ sessions }) => ({
  unlocked: sessions.length >= 1,
  progress: clamp01(sessions.length / 1),
});

const checkComebackKid = ({ sessions }) => {
  if (sessions.length < 3) return { unlocked: false, progress: sessions.length / 3 };
  const scores = sessions.map(sessionScore);
  for (let i = 1; i < scores.length - 1; i++) {
    const runningAvg = scores.slice(0, i).reduce((a, v) => a + v, 0) / i;
    const dip = runningAvg - scores[i];
    if (dip >= 15) {
      const recovery = scores[i + 1] - scores[i];
      if (recovery >= 15) {
        return { unlocked: true, meta: { dipSession: i + 1, recoverySession: i + 2, dip: Math.round(dip), recovery: Math.round(recovery) } };
      }
    }
  }
  return { unlocked: false, progress: 0.3 };
};

const checkTopicSlayer = ({ sessions }) => {
  const series = topicSeries(sessions);
  let best = { topic: null, streak: 0 };
  Object.entries(series).forEach(([topic, scores]) => {
    let run = 0, maxRun = 0;
    scores.forEach((s) => {
      if (s >= 85) { run += 1; maxRun = Math.max(maxRun, run); } else { run = 0; }
    });
    if (maxRun > best.streak) best = { topic, streak: maxRun };
  });
  return {
    unlocked: best.streak >= 3,
    progress: clamp01(best.streak / 3),
    meta: best.topic ? { topic: best.topic, streak: best.streak } : null,
  };
};

const checkSilentGrinder = ({ user, sessions }) => {
  const current = user?.streak?.current || 0;
  if (current < 7) return { unlocked: false, progress: clamp01(current / 7) };
  const last7 = sessions.slice(-7);
  const noHero = last7.every((s) => sessionScore(s) < 90);
  return { unlocked: noHero, progress: noHero ? 1 : 0.85, meta: { streak: current } };
};

const checkFullMarks = ({ sessions }) => {
  const q = allAnsweredQuestions(sessions).find((q) => Number(q.score) === 100);
  return { unlocked: !!q, meta: q ? { topic: q.topic } : null };
};

const checkNoSkipZone = ({ sessions }) => {
  const hit = sessions.find((s) => {
    const qs = s.questions || [];
    return qs.length >= 5 && qs.every((q) => !q.skipped);
  });
  return { unlocked: !!hit };
};

const checkSpeedDemon = ({ sessions }) => {
  const hit = sessions.find((s) => {
    const qs = (s.questions || []).filter((q) => !q.skipped && q.timeTaken);
    if (qs.length < 3) return false;
    const avgTime = qs.reduce((a, q) => a + q.timeTaken, 0) / qs.length;
    return avgTime < 20 && sessionScore(s) >= 70;
  });
  return { unlocked: !!hit };
};

const checkDeepDiver = ({ sessions }) => {
  const hit = sessions.find((s) => {
    const qs = (s.questions || []).filter((q) => !q.skipped && q.timeTaken);
    if (qs.length < 3) return false;
    const avgTime = qs.reduce((a, q) => a + q.timeTaken, 0) / qs.length;
    return avgTime > 70 && sessionScore(s) >= 80;
  });
  return { unlocked: !!hit };
};

const checkRangeRider = ({ sessions }) => {
  const n = distinctTopics(sessions).length;
  return { unlocked: n >= 6, progress: clamp01(n / 6), meta: { topics: n } };
};

const checkIronStreak = ({ user }) => {
  const current = user?.streak?.current || 0;
  return { unlocked: current >= 14, progress: clamp01(current / 14) };
};

const checkGrinder = ({ sessions }) => ({
  unlocked: sessions.length >= 25,
  progress: clamp01(sessions.length / 25),
});

const checkElitePass = ({ sessions }) => {
  const best = sessions.length ? Math.max(...sessions.map(sessionScore)) : 0;
  return { unlocked: best >= 90, progress: clamp01(best / 90) };
};

const checkWeaknessSlayer = ({ sessions }) => {
  const series = topicSeries(sessions);
  for (const [topic, scores] of Object.entries(series)) {
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] < 50) {
        const later = scores.slice(i + 1);
        if (later.some((s) => s >= 75)) {
          return { unlocked: true, meta: { topic, from: Math.round(scores[i]), to: Math.round(Math.max(...later)) } };
        }
      }
    }
  }
  return { unlocked: false };
};

/** Approximates tier-jump using IRS-equivalent (avg score) crossing 38/60/80 across sessions. */
const checkTierJumper = ({ sessions }) => {
  const THRESHOLDS = [38, 60, 80];
  const scores = sessions.map(sessionScore);
  // rolling average as a simple proxy for "IRS at the time"
  for (let i = 1; i < scores.length; i++) {
    const before = scores.slice(0, i).reduce((a, v) => a + v, 0) / i;
    const afterWindow = scores.slice(Math.max(0, i - 2), i + 1);
    const after = afterWindow.reduce((a, v) => a + v, 0) / afterWindow.length;
    for (const t of THRESHOLDS) {
      if (before < t && after >= t) {
        return { unlocked: true, meta: { threshold: t, atSession: i + 1 } };
      }
    }
  }
  return { unlocked: false };
};

// ─── Registry ─────────────────────────────────────────────────────────────
const BADGE_DEFS = [
  { id: 'first_rep',      label: 'First Rep',        icon: '🎬', tier: 'bronze',   desc: 'Completed your first mock interview.', check: checkFirstRep },
  { id: 'comeback_kid',   label: 'Comeback Kid',     icon: '🔁', tier: 'gold',     desc: 'Bounced back 15+ points the session right after a bad one.', check: checkComebackKid },
  { id: 'topic_slayer',   label: 'Topic Slayer',     icon: '⚔️', tier: 'gold',     desc: 'Scored 85+ on the same topic across 3 sessions in a row.', check: checkTopicSlayer },
  { id: 'silent_grinder', label: 'Silent Grinder',   icon: '🧘', tier: 'silver',   desc: '7-day streak without a single 90+ "hero" session — pure consistency.', check: checkSilentGrinder },
  { id: 'full_marks',     label: 'Full Marks',       icon: '💯', tier: 'silver',   desc: 'Nailed a question with a perfect 100 score.', check: checkFullMarks },
  { id: 'no_skip_zone',   label: 'No Skip Zone',     icon: '🛡️', tier: 'bronze',   desc: 'Completed a full 5+ question session without skipping anything.', check: checkNoSkipZone },
  { id: 'speed_demon',    label: 'Speed Demon',      icon: '⚡', tier: 'silver',   desc: 'Averaged under 20s per question while still scoring 70+.', check: checkSpeedDemon },
  { id: 'deep_diver',     label: 'Deep Diver',       icon: '🧠', tier: 'silver',   desc: 'Took your time (70s+/question) and still scored 80+.', check: checkDeepDiver },
  { id: 'range_rider',    label: 'Range Rider',      icon: '🗺️', tier: 'bronze',   desc: 'Practiced across 6+ distinct topics.', check: checkRangeRider },
  { id: 'iron_streak',    label: 'Iron Streak',      icon: '🔥', tier: 'gold',     desc: 'Kept a 14-day practice streak alive.', check: checkIronStreak },
  { id: 'the_grinder',    label: 'The Grinder',      icon: '⚙️', tier: 'gold',     desc: 'Completed 25 mock interviews.', check: checkGrinder },
  { id: 'elite_pass',     label: 'Elite Pass',       icon: '🏆', tier: 'platinum', desc: 'Hit a 90+ session score.', check: checkElitePass },
  { id: 'weakness_slayer',label: 'Weakness Slayer',  icon: '🎯', tier: 'gold',     desc: 'Took a topic from under 50 to 75+ in a later session.', check: checkWeaknessSlayer },
  { id: 'tier_jumper',    label: 'Tier Jumper',      icon: '🚀', tier: 'platinum', desc: 'Crossed a package-tier threshold (₹6L / ₹12L / ₹20L) between sessions.', check: checkTierJumper },
];

/**
 * Evaluate all badges for a user.
 * @param {{ user: object, sessions: object[] }} ctx — sessions must be status:'completed', sorted oldest→newest
 * @returns {Array} badge objects with unlocked/progress/meta
 */
const evaluateBadges = ({ user, sessions }) => {
  const ctx = { user, sessions: sessions || [] };
  return BADGE_DEFS.map((def) => {
    const result = def.check(ctx) || {};
    return {
      id: def.id,
      label: def.label,
      icon: def.icon,
      tier: def.tier,
      desc: def.desc,
      unlocked: !!result.unlocked,
      progress: result.unlocked ? 1 : (typeof result.progress === 'number' ? clamp01(result.progress) : null),
      meta: result.meta || null,
    };
  });
};

module.exports = { evaluateBadges, BADGE_DEFS };