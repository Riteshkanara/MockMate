/**
 * MockMate — Plan Configuration
 * Single source of truth for every plan limit and feature flag.
 * Middleware, controllers AND the client (via GET /interview/usage) read from here,
 * so the UI never has to guess what a plan allows.
 *
 * Free vs Pro philosophy:
 *   - Free keeps the core loop (practice → get scored) so the product feels real.
 *   - Pro unlocks depth (more modes, full feedback, analytics, coach) and volume.
 *   - Every Pro mode can be tried ONCE on free ("taste, don't hand over the meal").
 */

// Every mode the Session schema accepts. 'challenge' exists server-side only.
const ALL_MODES = ['quick', 'full', 'company', 'topic', 'mcq', 'aptitude', 'mixed', 'challenge'];

// Questions generated per mode. Server is authoritative; client reads this via /usage.
const MODE_QUESTION_COUNT = {
  quick: 5, mcq: 8, aptitude: 8, mixed: 10, full: 10, company: 10, topic: 10, challenge: 10,
};

// Modes that are NOT free but can be tried once each. (challenge is not user-selectable.)
const TRIAL_ELIGIBLE_MODES = ['full', 'company', 'topic', 'mcq', 'aptitude', 'mixed'];

// A free user's one-time trial of a Pro mode gets the FULL feedback for that session,
// so they experience what Pro actually feels like. Set false to keep trials basic.
const TRIAL_SESSIONS_GET_FULL_FEEDBACK = true;

const PRO_FEATURES = {
  dailyInterviewLimit:    Infinity,
  maxQuestionsPerSession: 10,
  allowedModes:           ALL_MODES,
  voiceDictation:         true,   // mic → typed answer
  voiceEvaluation:        true,   // pace, filler words, delivery report
  feedbackDepth:          'full', // line-by-line + ideal answer
  aiCoach:                true,
  detailedFeedback:       true,
  retryQuestion:          true,
  analyticsHistoryDays:   Infinity,
  fullAnalytics:          true,
  blindSpots:             true,
  sessionWarmup:          true,
  scorecardDownload:      true,
  badges:                 true,
};

const PLANS = {
  free: {
    dailyInterviewLimit:    3,
    maxQuestionsPerSession: 5,
    allowedModes:           ['quick'],
    voiceDictation:         true,
    voiceEvaluation:        false,
    feedbackDepth:          'basic',
    aiCoach:                false,
    detailedFeedback:       false,
    retryQuestion:          false,
    analyticsHistoryDays:   7,
    fullAnalytics:          false,
    blindSpots:             false,
    sessionWarmup:          false,
    scorecardDownload:      false,
    badges:                 true,   // badges & streaks are open to every plan
  },
  pro:     { ...PRO_FEATURES },
  college: { ...PRO_FEATURES },
};

/**
 * getPlanConfig(user)
 * Resolved plan config for a user. Auto-downgrades to free if a paid plan expired.
 */
const getPlanConfig = (user) => {
  const rawPlan = user?.plan || 'free';

  if ((rawPlan === 'pro' || rawPlan === 'college') && user?.planExpiry) {
    if (new Date(user.planExpiry) < new Date()) {
      return { ...PLANS.free, _effectivePlan: 'free', _expired: true };
    }
  }

  const config = PLANS[rawPlan] || PLANS.free;
  return { ...config, _effectivePlan: rawPlan, _expired: false };
};

/** True for pro/college that has not expired. */
const isPaid = (config) => config._effectivePlan === 'pro' || config._effectivePlan === 'college';

module.exports = {
  PLANS, ALL_MODES, MODE_QUESTION_COUNT, TRIAL_ELIGIBLE_MODES,
  TRIAL_SESSIONS_GET_FULL_FEEDBACK, getPlanConfig, isPaid,
};
