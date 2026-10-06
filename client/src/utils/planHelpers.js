/** Human-friendly time until a reset instant, e.g. "4h 12m" or "38m". */
export const timeUntil = (iso) => {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'soon';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const MODE_LABELS = {
  quick: 'Quick Mock', full: 'Full Mock', company: 'Company Specific', topic: 'Topic Focus',
  mcq: 'Technical MCQ', aptitude: 'Aptitude', mixed: 'Mixed Assessment',
};

/** Friendly name for whatever the user was trying to unlock (used on the Pricing page). */
export const FEATURE_LABELS = {
  dailyInterviewLimit: 'Unlimited daily interviews',
  mode_full: 'Full Mock', mode_company: 'Company-specific rounds', mode_topic: 'Topic Focus',
  mode_mcq: 'Technical MCQ', mode_aptitude: 'Aptitude rounds', mode_mixed: 'Mixed Assessment',
  voiceEvaluation: 'Your voice delivery report', detailedFeedback: 'Ideal answers and coaching',
  retryQuestion: 'Answer re-evaluation', aiCoach: 'The AI Coach', fullAnalytics: 'Full analytics',
  blindSpots: 'Blind spot detection', sessionWarmup: 'Warmup analysis',
  scorecardDownload: 'Scorecard download', fullHistory: 'Your full history',
  dashboard: 'Everything in Pro', expired: 'Renewing Pro',
};

const DAY_MS = 86400000;
export const EXPIRY_WARNING_DAYS = 3;

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Where a user's paid plan stands, from the user object alone.
 *   { kind: 'expired',  dateLabel }            paid plan whose expiry has passed
 *   { kind: 'expiring', daysLeft, dateLabel }  paid plan ending within EXPIRY_WARNING_DAYS
 *   { kind: null }                             free, healthy, or no usable expiry date
 * Pure function so it can be tested without React.
 */
export const getPlanStatus = (user, now = Date.now()) => {
  const paid = user?.plan === 'pro' || user?.plan === 'college';
  const t = user?.planExpiry ? new Date(user.planExpiry).getTime() : NaN;
  if (!paid || !Number.isFinite(t)) return { kind: null };
  if (t < now) return { kind: 'expired', dateLabel: fmtDate(t), expiryKey: String(t) };
  const daysLeft = Math.max(1, Math.ceil((t - now) / DAY_MS));
  if (t - now <= EXPIRY_WARNING_DAYS * DAY_MS) return { kind: 'expiring', daysLeft, dateLabel: fmtDate(t), expiryKey: String(t) };
  return { kind: null };
};

export const PRO_WELCOME_KEY = 'mm_pro_welcome';
export { fmtDate };
