/**
 * MockMate — Plan Configuration
 * Single source of truth for every plan limit and feature flag.
 * Both middleware and controllers import from here.
 * Mirrored on the client at client/src/hooks/usePlan.js — keep both in sync
 * when limits change (client copy exists so the UI doesn't need a network
 * round-trip just to know whether a button should be disabled).
 */

const PLANS = {
  free: {
    dailyInterviewLimit:    3,
    maxQuestionsPerSession: 5,
    allowedModes:           ['quick'],
    aiCoach:                false,
    detailedFeedback:       false,
    retryQuestion:          false,
    analyticsHistoryDays:   7,
    fullAnalytics:          false,
    blindSpots:             false,
    sessionWarmup:          false,
    scorecardDownload:      false,
    badges:                 false,
  },
  pro: {
    dailyInterviewLimit:    Infinity,
    maxQuestionsPerSession: 10,
    allowedModes:           ['quick', 'mixed', 'mcq', 'aptitude', 'behavioral'],
    aiCoach:                true,
    detailedFeedback:       true,
    retryQuestion:          true,
    analyticsHistoryDays:   Infinity,
    fullAnalytics:          true,
    blindSpots:             true,
    sessionWarmup:          true,
    scorecardDownload:      true,
    badges:                 true,
  },
  college: {
    dailyInterviewLimit:    Infinity,
    maxQuestionsPerSession: 10,
    allowedModes:           ['quick', 'mixed', 'mcq', 'aptitude', 'behavioral'],
    aiCoach:                true,
    detailedFeedback:       true,
    retryQuestion:          true,
    analyticsHistoryDays:   Infinity,
    fullAnalytics:          true,
    blindSpots:             true,
    sessionWarmup:          true,
    scorecardDownload:      true,
    badges:                 true,
  },
};

/**
 * getPlanConfig(user)
 * Returns the resolved plan config for a user.
 * Auto-downgrades to free if the paid plan has expired.
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

module.exports = { PLANS, getPlanConfig };