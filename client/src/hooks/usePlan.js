/**
 * MockMate — usePlan hook
 * Reads the user's plan via useAuth() and exposes helpers for every component.
 *
 * Usage:
 *   const { isPro, canUseMode, canUseFeature } = usePlan();
 *
 * Mirrors server/config/planConfig.js exactly — keep both in sync when
 * limits change. This client copy exists purely so buttons/gates can
 * render correctly without a round-trip; the SERVER config is what's
 * actually authoritative and enforced (see planMiddleware.js). Never trust
 * this file alone to gate anything security-sensitive.
 */

import { useMemo } from 'react';
import useAuth from './useAuth';

const PLAN_CONFIG = {
  free: {
    dailyInterviewLimit:    3,
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

  const canUseFeature = (feature) => {
    const val = planConfig[feature];
    return val === true || val === Infinity;
  };

  const canUseMode = (mode) =>
    Array.isArray(planConfig.allowedModes) && planConfig.allowedModes.includes(mode);

  return { isPro, isExpired, planLabel, planConfig, canUseFeature, canUseMode };
};

export default usePlan;
