/**
 * MockMate — feedback tiers
 *
 * The server decides how much of an evaluation a user may see, and REMOVES the
 * rest before the response leaves the server. A blurred box over data that is
 * still in the network tab is not a lock, so locked content is never sent.
 *
 *   'full'  → everything (Pro, or a free user's one-time trial session)
 *   'basic' → score + "what worked" + "what was missing", nothing else
 *
 * Basic uses a WHITELIST: any new AI field added later is locked by default
 * instead of leaking to free users until someone remembers to block it.
 *
 * Nothing is deleted from the database. If a user upgrades, every past session
 * immediately returns in full — "your old answers unlock" is literally true.
 */
const { TRIAL_SESSIONS_GET_FULL_FEEDBACK } = require('../config/planConfig');

const OBJECTIVE = ['mcq', 'aptitude'];

// Open-answer feedback fields free users keep.
const BASIC_KEEP = ['good', 'missing', 'aiAvailable', 'fallback', 'skippedPending', 'timeTaken', 'complexityRating'];

const has = (v) => {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const tryParse = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  try {
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : null;
  } catch {
    return null;
  }
};


/**
 * A short teaser of a locked text field, so a free user sees the real first line of THEIR
 * answer's model answer / coaching and the rest stays behind the lock.
 * Rules (so a teaser can never give the whole thing away):
 *   - first sentence only, cleaned of markdown and line breaks, at most 110 characters
 *   - if that sentence is most of the text (a one- or two-sentence answer), cut it shorter
 *   - text too short to tease safely returns '' (no teaser)
 */
const TEASER_MAX = 110;
const makeTeaser = (raw) => {
  if (typeof raw !== 'string') return '';
  const text = raw.replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();
  if (text.length < 40) return '';
  const m = text.match(/^(.+?[.!?])(\s|$)/);
  let out = (m ? m[1] : text).trim();
  const cut = (s, n) => {
    if (s.length <= n) return s;
    const slice = s.slice(0, n);
    const at = slice.lastIndexOf(' ');
    return `${slice.slice(0, at > 20 ? at : n).replace(/[\s,;:.-]+$/, '')}…`;
  };
  if (out.length >= text.length * 0.6) out = cut(out, Math.floor(text.length * 0.5));
  out = cut(out, TEASER_MAX);
  return out.length >= 20 ? out : '';
};

/** 'full' | 'basic' for a given plan config + session. */
const getFeedbackTier = (planCfg, session) => {
  if (planCfg?.feedbackDepth === 'full') return 'full';
  if (TRIAL_SESSIONS_GET_FULL_FEEDBACK && session?.isTrial) return 'full';
  return 'basic';
};

/**
 * What is being held back on one open question — real, personal counts that let
 * the UI say "3 insights on this answer" without sending any of the content.
 */
const describeLocked = (fb, { skipped = false, hasVoice = false } = {}) => {
  const locked = {
    modelAnswer: skipped || has(fb.sampleAnswer),
    coaching:    has(fb.idealHint) || has(fb.tip),
    delivery:    has(fb.deliveryTip) || has(fb.toneAnalysis) || has(fb.hesitationPattern) || has(fb.vocabularyRichness) || hasVoice,
    analysis:    has(fb.starBreakdown) || has(fb.keywordCoverage) || has(fb.keywords) || has(fb.confidenceScore)
                 || has(fb.followUpQuestions) || has(fb.frameworkCheck) || has(fb.weakPattern) || has(fb.timeEfficiency),
  };
  return { ...locked, count: Object.values(locked).filter(Boolean).length };
};

/**
 * Shape ONE question's stored feedback for a tier.
 * Returns the feedback in the same form it was stored (JSON string), with a
 * `tier` marker added. Objective (MCQ/aptitude) feedback is plain text and is
 * returned untouched.
 */
const shapeFeedback = (question, tier) => {
  const raw = question?.feedback;
  if (OBJECTIVE.includes(question?.questionType)) return raw;
  const fb = tryParse(raw);
  if (!fb) return raw;

  if (tier === 'full') return JSON.stringify({ ...fb, tier: 'full' });

  const basic = { tier: 'basic' };
  BASIC_KEEP.forEach((k) => { if (fb[k] !== undefined) basic[k] = fb[k]; });
  basic.locked = describeLocked(fb, { skipped: Boolean(question.skipped), hasVoice: has(question.voiceMetrics) });
  // Real first line of the locked model answer / coaching (see makeTeaser for the safety rules).
  const teasers = {};
  const modelT = makeTeaser(fb.sampleAnswer);
  const coachT = makeTeaser(fb.idealHint || fb.tip);
  if (modelT) teasers.modelAnswer = modelT;
  if (coachT) teasers.coaching = coachT;
  if (Object.keys(teasers).length) basic.teasers = teasers;
  return JSON.stringify(basic);
};

/** Shape a plain question object (all fields, e.g. from history / result). */
const shapeQuestion = (q, tier) => {
  const out = { ...q, feedback: shapeFeedback(q, tier) };
  if (tier !== 'full') delete out.voiceMetrics;
  return out;
};

/** Total locked insight count across a session's open questions. */
const countLocked = (questions) => questions.reduce((sum, q) => {
  const fb = tryParse(q.feedback);
  return sum + (fb?.tier === 'basic' ? (fb.locked?.count || 0) : 0);
}, 0);

/** Shape a whole plain session object for a tier. */
const shapeSession = (session, tier) => {
  const questions = (session.questions || []).map((q) => shapeQuestion(q, tier));
  return {
    ...session,
    questions,
    feedbackTier: tier,
    lockedInsights: tier === 'full' ? 0 : countLocked(questions),
  };
};

module.exports = { getFeedbackTier, shapeFeedback, shapeQuestion, shapeSession, describeLocked, tryParse, makeTeaser };
