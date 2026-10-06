/**
 * MockMate — usePlan hook
 * Reads the user's plan via useAuth() and exposes helpers for every component.
 *
 * Usage:
 *   const { isPro, canUseMode, canUseFeature } = usePlan();
 *
 * Mirrors server/config/planConfig.js — keep both in sync when limits change.
 * This client copy exists purely so buttons/gates can render without a
 * round-trip; the SERVER config is what's actually enforced (planMiddleware.js
 * and startInterview). Never trust this file alone to gate anything real.
 */

import { useMemo } from 'react';
import useAuth from './useAuth';

const ALL_MODES = ['quick', 'full', 'company', 'topic', 'mcq', 'aptitude', 'mixed'];

const PRO = {
  dailyInterviewLimit:    Infinity,
  maxQuestionsPerSession: 10,
  allowedModes:           ALL_MODES,
  voiceDictation:         true,
  voiceEvaluation:        true,
  feedbackDepth:          'full',
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

const PLAN_CONFIG = {
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
    badges:                 true,
  },
  pro:     { ...PRO },
  college: { ...PRO },
};

const usePlan = () => {
  const { user } = useAuth();

  const planConfig = useMemo(() => {
    const rawPlan = user?.plan || 'free';

    if ((rawPlan === 'pro' || rawPlan === 'college') && user?.planExpiry) {
      if (new Date(user.planExpiry) < new Date()) {
        return { ...PLAN_CONFIG.free, _effectivePlan: 'free', _expired: true };
      }
    }

    return {
      ...(PLAN_CONFIG[rawPlan] || PLAN_CONFIG.free),
      _effectivePlan: rawPlan,
      _expired: false,
    };
  }, [user]);

  const isPro      = planConfig._effectivePlan === 'pro' || planConfig._effectivePlan === 'college';
  const isExpired  = planConfig._expired;
  const planLabel  = isPro ? (planConfig._effectivePlan === 'college' ? 'College' : 'Pro') : 'Free';

  // true for boolean flags, Infinity limits and the 'full' feedback tier
  const canUseFeature = (feature) => {
    const val = planConfig[feature];
    return val === true || val === Infinity || val === 'full';
  };

  const canUseMode = (mode) =>
    Array.isArray(planConfig.allowedModes) && planConfig.allowedModes.includes(mode);

  return { isPro, isExpired, planLabel, planConfig, canUseFeature, canUseMode };
};

export default usePlan;
