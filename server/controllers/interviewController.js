const Session = require('../models/Session');
const User = require('../models/User');
const {
  ALL_MODES, MODE_QUESTION_COUNT, TRIAL_ELIGIBLE_MODES, getPlanConfig, isPaid,
} = require('../config/planConfig');
const { getDayWindowIST, countTodaySessions } = require('../utils/planUsage');
const {
  getFeedbackTier, shapeFeedback, shapeSession, tryParse,
} = require('../utils/feedbackTier');

// Resolve a user's plan config with one tiny projected query.
const loadPlanCfg = async (userId) =>
  getPlanConfig(await User.findById(userId).select('plan planExpiry').lean());
const { evaluateBadges } = require('../utils/badgeEngine');
const {
  buildDimensionProfile,
  computeIRS,
  computeIRSBreakdown  : irsBreakdown,
  tierForScore,
  tierForScoreGated,
  TIERS,
  computeTierReadiness  : tierReadiness,
  findBlockingDimension : blockingDimension,
  buildDimSeries,
  projectSessionsToUnlock  : sessionsToUnlock,
  resolveCanonicalTopic    : resolveTopic,
} = require('../utils/scoringModel');

// CANONICAL_TOPIC_TO_DIMENSIONS is not exported from scoringModel, so we
// mirror the minimal mapping needed for scoreTrend enrichment here.
// (This is display-only — IRS still uses the full buildDimensionProfile.)
const TOPIC_DIMENSIONS = {
  dsa:            ['technical', 'problemSolving'],
  oop:            ['technical', 'design', 'fundamentals'],
  dbms:           ['fundamentals', 'technical'],
  os:             ['fundamentals'],
  javascript:     ['technical', 'fundamentals'],
  webdev:         ['technical'],
  systemdesign:   ['design'],
  networking:     ['fundamentals'],
  hr:             ['communication', 'behavioral'],
  behavioral:     ['behavioral'],
  communication:  ['communication'],
  csfundamentals: ['fundamentals'],
};

const extractIRSEvidence = (sessions) => {
  let totalAnswered = 0;
  const difficultyMix = { easy: 0, medium: 0, hard: 0 };
  sessions.forEach((session) => {
    (session.questions || []).forEach((q) => {
      if (q.skipped || !q.userAnswer) return;
      totalAnswered += 1;
      const d = String(q.difficulty || 'medium').toLowerCase();
      if (difficultyMix[d] != null) difficultyMix[d] += 1;
      else difficultyMix.medium += 1;
    });
  });
  return { totalAnswered: totalAnswered, difficultyMix };
};

const {
  generateQuestions,
  evaluateOpenAnswer,
  getSkippedAnswer,
  evalObjectiveAnswer,
  evaluateOpenAnswerFast,
} = require('../services/aiServices');
const {
  planBatches,
  toStoredQuestion,
  fillRemainingQuestions,
  runEnrichment,
  resolveEnrichState,
  waitForPendingEnrichment,
  QUESTIONS_PENDING_TIMEOUT_MS,
} = require('../services/interviewFlow');
const crypto = require('crypto');
const {
  ROLES, EXPERIENCE_LEVELS, 
  mapCodingExperienceToLevel,
} = require('../data/roleProfiles');

const BADGES = [
  { id: 'first',     label: 'First Rep',          check: u => u.totalInterviews >= 1 },
  { id: 'trio',      label: 'Hat Trick',           check: u => u.totalInterviews >= 3 },
  { id: 'ten',       label: 'The Grinder',         check: u => u.totalInterviews >= 10 },
  { id: 'veteran',   label: 'Veteran',             check: u => u.totalInterviews >= 25 },
  { id: 'hi80',      label: 'High Scorer',         check: u => u.bestScore >= 80 },
  { id: 'elite',     label: 'Elite Pass',          check: u => u.bestScore >= 90 },
  { id: 'streak_3',  label: 'On Fire',             check: u => u.streak.current >= 3 },
  { id: 'streak_30', label: '👑 Placement Ready',  check: u => u.streak.current >= 30 },
];

const EMPTY_IRS_RESPONSE = {
  irs: 0,
  irsBreakdown: null,
  currentTier: null,
  currentTierIsGated: false,
  currentTierRaw: null,
  sessionsNeededForRawTier: null,
  totalAnswered: 0,
  difficultyMix: { easy: 0, medium: 0, hard: 0 },
  tiers: [],
  dimensionProfile: [],
  unmappedTopics: [],
};

const getUserId = req => req.user?._id || req.user?.id;

const getQuestionScore = question => {
  const currentScore = Number(question?.score);
  if (Number.isFinite(currentScore) && currentScore > 10) {
    return Math.max(0, Math.min(100, currentScore));
  }
  const legacyScore = Number(question?.aiFeedback?.score);
  if (Number.isFinite(legacyScore)) {
    return Math.max(0, Math.min(100, Math.round(legacyScore * 10)));
  }
  if (Number.isFinite(currentScore)) {
    return Math.max(0, Math.min(100, currentScore));
  }
  return 0;
};

const getSessionScore = session => {
  const avg = Number(session?.averageScore);
  if (Number.isFinite(avg) && avg >= 0 && avg <= 100) return Math.round(avg);
  const total = Number(session?.totalScore);
  if (Number.isFinite(total) && total >= 0) {
    const count = Array.isArray(session?.questions) ? session.questions.length : 0;
    if (count > 0 && total > 100) return Math.round(total / count);
    return Math.round(Math.min(100, total));
  }
  return 0;
};

const getQuestionCount = mode => MODE_QUESTION_COUNT[mode] ?? 10;

const calculateReadiness = ({ averageScore, bestScore, streak, totalInterviews }) => {
  if (!totalInterviews) return 0;
  const base = averageScore || 0;
  const streakBonus = Math.min((streak || 0) * 1.5, 12);
  const bestBonus = bestScore >= 90 ? 5 : bestScore >= 80 ? 3 : 0;
  return Math.max(0, Math.min(100, Math.round(base + streakBonus + bestBonus)));
};

const updateUserStats = async ({ user, score }) => {
  const now = new Date();
  user.totalInterviews = Number(user.totalInterviews || 0) + 1;
  user.totalSessions = user.totalInterviews;
  const prevTotal = user.totalInterviews - 1;
  const prevAvg = Number(user.averageScore || 0);
  user.averageScore = prevTotal > 0
    ? Math.round(((prevAvg * prevTotal) + score) / user.totalInterviews)
    : Math.round(score);
  user.bestScore = Math.max(Number(user.bestScore || 0), Number(score || 0));
  if (!user.streak) user.streak = { current: 0, longest: 0, lastPracticeDate: null };
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const lastPractice = user.streak.lastPracticeDate
    ? new Date(user.streak.lastPracticeDate)
    : null;
  if (lastPractice) {
    lastPractice.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - lastPractice) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) user.streak.current += 1;
    else if (diffDays > 1) user.streak.current = 1;
  } else {
    user.streak.current = 1;
  }
  user.streak.longest = Math.max(Number(user.streak.longest || 0), Number(user.streak.current || 0));
  user.streak.lastPracticeDate = now;
  user.streak.lastActive = now;
  user.readinessScore = calculateReadiness({
    averageScore: user.averageScore,
    bestScore: user.bestScore,
    streak: user.streak.current,
    totalInterviews: user.totalInterviews,
  });
  await user.save();
  return user;
};

const buildWeakAreas = (recentSessions) => {
  const topicScores = {};
  recentSessions.forEach(s => {
    (s.questions || []).forEach(q => {
      if (q.skipped || !q.score) return;
      if (!topicScores[q.topic]) topicScores[q.topic] = [];
      topicScores[q.topic].push(q.score);
    });
  });
  return Object.entries(topicScores)
    .map(([topic, scores]) => ({ topic, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .filter(t => t.avg < 60)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map(t => t.topic);
};

const buildSessionSummary = (questions) => {
  const topicScores = {};
  questions.forEach(q => {
    const topic = q.topic || 'General';
    if (!topicScores[topic]) topicScores[topic] = [];
    topicScores[topic].push(Number(q.score || 0));
  });
  const strengths = [];
  const weaknesses = [];
  Object.entries(topicScores).forEach(([topic, scores]) => {
    const avg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
    if (avg >= 80) strengths.push(topic);
    if (avg < 60) weaknesses.push(topic);
  });
  return { strengths, weaknesses };
};

// Shared tier-map builder used by getAnalytics and getPerformance.
// currentTier is always the gated tier; isUnlocked respects minSessions.
const buildTierMap = ({ irs, sessionCount, dimProfile, dimTimeSeries, currentTierGated }) =>
  TIERS.map((tier) => {
    const readiness = tierReadiness(dimProfile, tier, sessionCount);
    const blocker   = blockingDimension(readiness);
    const eta       = sessionsToUnlock(blocker, dimTimeSeries);
    return {
      label: tier.label,
      color: tier.color,
      desc: tier.desc,
      advice: tier.advice,
      minIRS: tier.minIRS,
      isCurrentTier: tier.label === currentTierGated.label,
      isUnlocked: irs >= tier.minIRS && sessionCount >= tier.minSessions,
      readinessPct: readiness.readinessPct,
      confidenceGate: readiness.confidenceGate,
      minSessionsRequired: tier.minSessions,
      perDimension: readiness.perDimension,
      blockingDimensions: readiness.blockingDimensions,
      provisional: readiness.provisional,
      primaryBlocker: blocker
        ? { key: blocker.key, label: blocker.label, userScore: blocker.userScore, requiredMin: blocker.requiredMin, gap: blocker.gap }
        : null,
      eta,
    };
  });

const getInterviewMeta = (req, res) => {
  try {
    const { QUICK_PICK_COMPANIES } = require('../data/companyProfiles');
    const { TOPIC_GROUPS } = require('../data/topicGroups');
    const roles = Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label }));
    const experienceLevels = Object.entries(EXPERIENCE_LEVELS).map(([value, e]) => ({ value, label: e.label }));
    return res.json({
      companies: QUICK_PICK_COMPANIES,
      topicGroups: TOPIC_GROUPS,
      roles,
      experienceLevels,
    });
  } catch (error) {
    console.error('getInterviewMeta error:', error);
    return res.status(500).json({ error: 'Failed to load interview setup options.' });
  }
};

const startInterview = async (req, res) => {
  try {
    const userId = getUserId(req);
    const {
      mode = 'quick',
      company = '',
      topic = '',
      topics = [],
      role = '',
      experienceLevel = '',
      difficulty = 'mixed',
    } = req.body || {};

    if (!ALL_MODES.includes(mode)) {
      return res.status(400).json({ error: 'invalid_mode', message: 'Unknown interview mode.' });
    }

    // ── Plan enforcement (server is authoritative; the client only mirrors it) ──
    const planUser = await User.findById(userId).select('plan planExpiry proTrialsUsed').lean();
    const planCfg  = getPlanConfig(planUser);

    // 1) Daily limit
    if (Number.isFinite(planCfg.dailyInterviewLimit)) {
      const used = await countTodaySessions(userId);
      if (used >= planCfg.dailyInterviewLimit) {
        return res.status(403).json({
          error:       'daily_limit_reached',
          feature:     'dailyInterviewLimit',
          currentPlan: planCfg._effectivePlan,
          expired:     planCfg._expired,
          used,
          limit:       planCfg.dailyInterviewLimit,
          resetsAt:    getDayWindowIST().end.toISOString(),
          message:     `You've used all ${planCfg.dailyInterviewLimit} interviews for today.`,
        });
      }
    }

    // 2) Mode access — allowed on plan, or a one-time free trial of a Pro mode
    let isTrialSession = false;
    if (!planCfg.allowedModes.includes(mode)) {
      const trialUsed = (planUser?.proTrialsUsed || []).includes(mode);
      if (TRIAL_ELIGIBLE_MODES.includes(mode) && !trialUsed) {
        isTrialSession = true;
      } else {
        return res.status(403).json({
          error:       'plan_required',
          feature:     `mode_${mode}`,
          currentPlan: planCfg._effectivePlan,
          expired:     planCfg._expired,
          trialUsed,
          message:     trialUsed
            ? 'You have used your free trial of this mode. Upgrade to Pro to keep using it.'
            : 'This mode requires a Pro subscription.',
        });
      }
    }

    const count = getQuestionCount(mode);
    // Long interviews start with a small first batch; the rest is generated
    // in the background while the student answers (see services/interviewFlow).
    const { first: firstBatchSize, rest: remainingCount } = planBatches(count);

    // Fetch last 10 completed sessions once — used for BOTH the
    // previous-questions exclusion list AND the weak-areas signal below.
    // Both lookups are independent — run them together instead of back-to-back.
    const [recentSessions, user] = await Promise.all([
      Session.find(
        { $or: [{ user: userId }, { userId }], status: 'completed' },
        { 'questions.text': 1, 'questions.topic': 1, 'questions.score': 1, 'questions.skipped': 1 },
        { sort: { createdAt: -1 }, limit: 10 }
      ).lean(),
      User.findById(userId).select('targetRole codingExperience').lean(),
    ]);

    const previousQuestions = recentSessions
      .flatMap(s => s.questions || [])
      .map(q => q.text)
      .filter(Boolean)
      .slice(0, 20); // cap at 20 — enough signal without bloating the prompt

    const weakAreas = buildWeakAreas(recentSessions);

    // Fall back to the user's saved target role/experience when the session
    // didn't specify one explicitly — reuses their onboarding profile so
    // returning users get role-calibrated questions without re-selecting
    // every time. codingExperience (onboarding) maps onto our experience
    // levels since it's the closest existing signal on the user profile.
    const effectiveRole       = role || user?.targetRole || '';
    const effectiveExperience = experienceLevel || mapCodingExperienceToLevel(user?.codingExperience) || '';

    const generationParams = {
      mode, company, topic, topics, role: effectiveRole, experienceLevel: effectiveExperience,
      weakAreas, difficulty, previousQuestions,
    };
    const questions = await generateQuestions({ ...generationParams, count: firstBatchSize });
    const splitPending = remainingCount > 0 && questions.length > 0;

    const session = await Session.create({
      user: userId,
      mode,
      company,
      topic: Array.isArray(topics) && topics.length ? topics.join(', ') : topic,
      role: effectiveRole,
      experienceLevel: effectiveExperience,
      isTrial: isTrialSession,
      questions: questions.map(toStoredQuestion),
      expectedQuestionCount: splitPending ? count : questions.length,
      questionsPending: splitPending,
      currentQuestion: 0,
      status: 'active',
      startedAt: new Date(),
    });

    // Burn the trial only once the session really exists (a failed AI call shouldn't cost it).
    if (isTrialSession) {
      await User.updateOne({ _id: userId }, { $addToSet: { proTrialsUsed: mode } });
    }

    const publicQuestions = session.questions.map(q => ({
      id: q.id,
      text: q.text,
      topic: q.topic,
      difficulty: q.difficulty,
      timeLimit: q.timeLimit || (q.questionType === 'aptitude' ? 60 : q.questionType === 'mcq' ? 45 : 90),
      questionType: q.questionType || 'open',
      options: q.questionType === 'open' ? [] : q.options || [],
    }));

    res.status(201).json({
      sessionId: session._id,
      mode,
      trial: isTrialSession,
      questions: publicQuestions,
      totalQuestions: session.expectedQuestionCount,
      questionsPending: splitPending,
    });

    // Fire-and-forget AFTER the response: generate the remaining questions.
    // (fillRemainingQuestions never throws and always clears the pending flag.)
    if (splitPending) {
      fillRemainingQuestions({
        sessionId: session._id,
        params: generationParams,
        remaining: remainingCount,
        existingQuestions: session.questions.map(q => ({ id: q.id, text: q.text })),
        expectedTotal: count,
      }).catch(err => console.error('Background question generation failed:', err));
    }
    return undefined;
  } catch (error) {
    console.error('startInterview error:', error);
    return res.status(500).json({ message: 'Failed to start interview.', error: error.message });
  }
};

// GET /interview/usage — everything the UI needs to render locks, meters and trials.
const getUsage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const planUser = await User.findById(userId).select('plan planExpiry proTrialsUsed').lean();
    const cfg = getPlanConfig(planUser);
    const limit = Number.isFinite(cfg.dailyInterviewLimit) ? cfg.dailyInterviewLimit : null;
    const used = limit === null ? null : await countTodaySessions(userId);
    const trialsUsed = planUser?.proTrialsUsed || [];

    return res.json({
      plan:      cfg._effectivePlan,
      isPro:     isPaid(cfg),
      expired:   cfg._expired,
      daily:     { used, limit, remaining: limit === null ? null : Math.max(0, limit - used), resetsAt: getDayWindowIST().end.toISOString() },
      allowedModes: cfg.allowedModes,
      trialModes:   TRIAL_ELIGIBLE_MODES.filter(m => !cfg.allowedModes.includes(m) && !trialsUsed.includes(m)),
      trialsUsed,
      questionCounts: MODE_QUESTION_COUNT,
      demoSwitch: process.env.DEMO_PLAN_SWITCH === 'true',
    });
  } catch (error) {
    console.error('getUsage error:', error);
    return res.status(500).json({ error: 'Failed to load usage.' });
  }
};

const getInterviewSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const session = await Session.findOne({ _id: sessionId, user: userId });
    if (!session) {
      return res.status(404).json({ message: 'Interview session not found.' });
    }
    // A background job that never reported back (e.g. server restart) must not
    // leave the client waiting: after the timeout, treat it as finished.
    let questionsPending = Boolean(session.questionsPending) && session.status === 'active';
    if (questionsPending && Date.now() - new Date(session.startedAt).getTime() > QUESTIONS_PENDING_TIMEOUT_MS) {
      questionsPending = false;
      Session.updateOne({ _id: session._id, questionsPending: true }, { $set: { questionsPending: false } })
        .catch(err => console.error('Failed to clear stale questionsPending:', err));
    }
    return res.json({
      sessionId: session._id,
      mode: session.mode,
      status: session.status,
      questionsPending,
      totalQuestions: questionsPending
        ? (session.expectedQuestionCount || session.questions.length)
        : session.questions.length,
      questions: session.questions.map(q => ({
        id: q.id,
        text: q.text,
        topic: q.topic,
        difficulty: q.difficulty,
        timeLimit: q.timeLimit,
        questionType: q.questionType,
        options: q.questionType === 'open' ? [] : q.options,
      })),
      currentQuestion: session.currentQuestion,
    });
  } catch (error) {
    console.error('getInterviewSession error:', error);
    return res.status(500).json({ message: 'Failed to load interview session.', error: error.message });
  }
};

// ─── answerQuestion — PATCHED (voice metrics support added) ──────────────────
const answerQuestion = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;

    // CHANGED: added voiceMetrics to destructure
    const {
      questionId,
      answer       = '',
      answerIndex  = null,
      timeTaken    = 0,
      skipped      = false,
      voiceMetrics = null,   // NEW — pre-computed client-side speech metrics
    } = req.body || {};

    const session = await Session.findOne({ _id: sessionId, user: userId, status: 'active' });
    if (!session) {
      return res.status(404).json({ message: 'Active interview session not found.' });
    }
    const question = session.questions.find(q => q.id === questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found.' });
    }

    // If the student presses "Stop" (or their connection drops) while the model
    // is still working, the response socket closes before we finish. `close`
    // on the RESPONSE with writableFinished === false means "the client left".
    let clientGone = false;
    res.on('close', () => { if (!res.writableFinished) clientGone = true; });

    // Set only on the fast open-answer path below.
    let willEnrich  = false;
    let enrichToken = null;
    let fastResult  = null;

    question.timeTaken = Number(timeTaken) || 0;
    question.skipped   = Boolean(skipped);

    // NEW: persist voice metrics so they're available on result/replay pages
    if (voiceMetrics && question.questionType === 'open') {
      question.voiceMetrics = voiceMetrics;
    }

    if (['mcq', 'aptitude'].includes(question.questionType)) {
      question.userAnswerIndex = answerIndex === null || answerIndex === undefined ? null : Number(answerIndex);
      question.userAnswer = answer || (question.userAnswerIndex !== null ? question.options?.[question.userAnswerIndex] || '' : '');
      const result = evalObjectiveAnswer({ question, answerIndex: question.userAnswerIndex });
      question.score    = result.score;
      question.feedback = result.feedback;
    } else {
      question.userAnswer = String(answer || '');
      if (skipped) {
        // Skip must respond instantly — never block the user's "next
        // question" moment on a Gemini call. We save a lightweight static
        // placeholder synchronously, return right away, and kick off the
        // real model-answer generation in the background so the eventual
        // Result/History view still gets a rich sample answer once it's
        // ready (see the fire-and-forget block below the response).
        question.score = 0;
        question.feedback = JSON.stringify({
          good:         '',
          missing:      'Question skipped — no answer submitted.',
          idealHint:    'Loading a model answer…',
          tip:          '',
          sampleAnswer: '',
          aiAvailable:  true,
          fallback:     false,
          skippedPending: true, // client can show a lightweight "generating" state instead of blocking
        });
      } else {
        // FAST PATH: score + core feedback come back in a couple of seconds.
        // The heavier analysis (model answer, STAR, keywords, confidence,
        // follow-ups, voice) is generated AFTER the response and merged in —
        // see runEnrichment() below and services/interviewFlow.js.
        const result = await evaluateOpenAnswerFast({
          question,
          answer: question.userAnswer,
          topic:  question.topic,
        });

        // The student stopped the evaluation while it was running — discard
        // this result instead of saving it over their (still editable) answer.
        if (clientGone) return undefined;

        fastResult     = result;
        question.score = Number(result.score || 0);
        willEnrich     = result.aiAvailable !== false
                      && result.fallback !== true
                      && Boolean(question.userAnswer.trim());
        enrichToken    = willEnrich ? crypto.randomBytes(8).toString('hex') : null;

        question.feedback = JSON.stringify({
          good:         result.good         || '',
          missing:      result.missing      || '',
          idealHint:    result.idealHint    || '',
          tip:          result.tip          || '',
          sampleAnswer: result.sampleAnswer || '',
          deliveryTip:  null,
          aiAvailable:  result.aiAvailable !== false,
          fallback:     result.fallback === true,
          starBreakdown:      null,
          followUpQuestions:  [],
          keywordCoverage:    null,
          confidenceScore:    null,
          toneAnalysis:       null,
          vocabularyRichness: null,
          hesitationPattern:  null,
          complexityRating:   null,
          timeTaken:          timeTaken || 0,
          ...(willEnrich
            ? { enrichPending: true, enrichToken, enrichStartedAt: Date.now() }
            : {}),
        });
      }
    }

    const currentIndex = session.questions.findIndex(q => q.id === questionId);
    session.currentQuestion = Math.min(currentIndex + 1, session.questions.length - 1);
    await session.save();

    const isObjective = ['mcq', 'aptitude'].includes(question.questionType);
    const wasSkippedOpenQuestion = skipped && !isObjective;

    // Decide how much of the evaluation this user may see; locked parts are
    // removed HERE, so they never reach the browser.
    const feedbackTier = getFeedbackTier(await loadPlanCfg(userId), session);

    res.json({
      success:            true,
      questionId,
      feedbackTier,
      score:              question.score,
      feedback:           shapeFeedback(question, feedbackTier),
      skipped:            Boolean(question.skipped),
      correct:            isObjective ? question.score === 100 : null,
      correctAnswerIndex: isObjective ? question.correctAnswerIndex : null,
      explanation:        isObjective ? (question.explanation || '') : '',
      nextQuestion:       session.currentQuestion < session.questions.length - 1,
      // NEW: echo back voiceMetrics so the client can display them in FeedbackPanel
      // without having to store them in React state across a round-trip.
      // Voice delivery data belongs to the Pro voice report. It is still SAVED
      // (so it unlocks on upgrade); it just isn't sent back on the basic tier.
      voiceMetrics:       feedbackTier === 'full' ? (question.voiceMetrics || null) : null,
      enrichPending:      willEnrich,
    });

    // ── Fire-and-forget: generate the heavy analysis for a freshly scored
    // open answer and merge it into the stored feedback. Never throws.
    if (willEnrich) {
      runEnrichment({
        sessionId,
        questionId,
        token:        enrichToken,
        question:     { text: question.text, topic: question.topic },
        answer:       question.userAnswer,
        topic:        question.topic,
        voiceMetrics: question.voiceMetrics || voiceMetrics || null,
        fast: { score: question.score, good: fastResult?.good, missing: fastResult?.missing },
      }).catch(err => console.error('Background enrichment failed:', err));
    }

    // ── Fire-and-forget: fill in a real model answer for skipped open
    // questions AFTER the response has already gone out. The user has
    // already moved to the next question by the time this resolves — it
    // just means the Result/History page shows a proper sample answer
    // instead of the lightweight placeholder, without costing any wait
    // time in the interview flow itself.
    if (wasSkippedOpenQuestion) {
      getSkippedAnswer({ question, topic: question.topic })
        .then(async (result) => {
          try {
            const freshSession = await Session.findOne({ _id: sessionId, user: userId });
            if (!freshSession) return;
            const freshQuestion = freshSession.questions.find(q => q.id === questionId);
            if (!freshQuestion || !freshQuestion.skipped) return;
            freshQuestion.feedback = JSON.stringify({
              good:         '',
              missing:      'Question skipped — no answer submitted.',
              idealHint:    result.idealHint    || '',
              tip:          result.tip          || '',
              sampleAnswer: result.sampleAnswer || '',
              aiAvailable:  result.aiAvailable !== false,
              fallback:     result.fallback === true,
            });
            await freshSession.save();
          } catch (bgErr) {
            console.error('Background skip-answer save failed:', bgErr);
          }
        })
        .catch((bgErr) => {
          console.error('Background getSkippedAnswer failed:', bgErr);
        });
    }

    return undefined;
  } catch (error) {
    console.error('answerQuestion error:', error);
    return res.status(500).json({ message: 'Failed to submit answer.', error: error.message });
  }
};
// ─────────────────────────────────────────────────────────────────────────────

const completeInterview = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    // Stop any in-flight background question generation FIRST, so nothing can
    // be appended between reading the questions and saving the result.
    await Session.updateOne(
      { _id: sessionId, user: userId, status: 'active' },
      { $set: { questionsPending: false } }
    );
    // If the last answer's detailed analysis is still being generated, give it
    // a moment (max 6 s) so the final report includes the model answer etc.
    await waitForPendingEnrichment(sessionId);
    const session = await Session.findOne({ _id: sessionId, user: userId, status: 'active' });
    if (!session) {
      return res.status(404).json({ message: 'Active interview session not found.' });
    }
    const questionScores = session.questions.map(q => Number(q.score || 0));
    const totalScore = questionScores.reduce((sum, s) => sum + s, 0);
    const averageScore = session.questions.length
      ? Math.round(totalScore / session.questions.length)
      : 0;
    const objectiveQuestions = session.questions.filter(q => ['mcq', 'aptitude'].includes(q.questionType));
    const objectiveCorrect = objectiveQuestions.filter(q => q.score === 100).length;
    const { strengths, weaknesses } = buildSessionSummary(session.questions);
    session.totalScore = totalScore;
    session.averageScore = averageScore;
    session.objectiveCorrect = objectiveCorrect;
    session.objectiveTotal = objectiveQuestions.length;
    session.strengths = strengths;
    session.weaknesses = weaknesses;
    session.status = 'completed';
    session.completedAt = new Date();
    session.duration = Math.round((session.completedAt - session.startedAt) / 1000);
    session.readinessScore = calculateReadiness({
      averageScore,
      bestScore: averageScore,
      streak: 0,
      totalInterviews: 1,
    });
    await session.save();
    const user = await User.findById(userId);
    if (user) await updateUserStats({ user, score: averageScore });
    const feedbackTier = getFeedbackTier(getPlanConfig(user), session);
    return res.json({
      success: true,
      sessionId: session._id,
      mode: session.mode,
      isTrial: session.isTrial === true,
      feedbackTier,
      score: averageScore,
      totalScore,
      questionCount: session.questions.length,
      objectiveCorrect,
      objectiveTotal: objectiveQuestions.length,
      strengths,
      weaknesses,
      questions: session.questions.map(q => ({
        id: q.id,
        text: q.text,
        topic: q.topic,
        difficulty: q.difficulty,
        questionType: q.questionType,
        options: q.questionType === 'open' ? [] : q.options,
        userAnswer: q.userAnswer,
        userAnswerIndex: q.userAnswerIndex,
        correctAnswerIndex: q.questionType === 'open' ? null : q.correctAnswerIndex,
        score: q.score,
        feedback: shapeFeedback(q, feedbackTier),
        skipped: q.skipped,
        timeTaken: q.timeTaken,
      })),
    });
  } catch (error) {
    console.error('completeInterview error:', error);
    return res.status(500).json({ message: 'Failed to complete interview.', error: error.message });
  }
};

// Lightweight poll target: lets the client pick up the background analysis
// (model answer, STAR, keywords…) as soon as it has been merged into the
// stored feedback, without re-downloading the whole session.
const getQuestionFeedback = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId, questionId } = req.params;
    const session = await Session.findOne({ _id: sessionId, user: userId })
      .select('isTrial questions.id questions.score questions.feedback questions.questionType questions.skipped questions.voiceMetrics')
      .lean();
    if (!session) return res.status(404).json({ message: 'Interview session not found.' });
    const question = (session.questions || []).find(q => q.id === questionId);
    if (!question) return res.status(404).json({ message: 'Question not found.' });

    let parsed = {};
    try { parsed = JSON.parse(question.feedback || '{}'); } catch { parsed = {}; }
    const { pending, feedback } = resolveEnrichState(parsed);

    // Same plan tiering as every other route: the background analysis (model answer,
    // keywords, STAR, follow-ups) is Pro depth, so free users never receive it.
    const tier = getFeedbackTier(await loadPlanCfg(userId), session);

    return res.json({
      questionId,
      score: question.score,
      enrichPending: pending,
      feedbackTier: tier,
      feedback: shapeFeedback({ ...question, feedback: JSON.stringify(feedback) }, tier),
    });
  } catch (error) {
    console.error('getQuestionFeedback error:', error);
    return res.status(500).json({ message: 'Failed to load feedback.', error: error.message });
  }
};

const retryQuestion = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId, questionId } = req.params;
    const session = await Session.findOne({ _id: sessionId, user: userId });
    if (!session) return res.status(404).json({ message: 'Session not found.' });
    const question = session.questions.find(q => q.id === questionId);
    if (!question) return res.status(404).json({ message: 'Question not found.' });
    if (['mcq', 'aptitude'].includes(question.questionType)) {
      return res.status(400).json({ message: 'Only open-ended questions can be retried.' });
    }
    if (!question.userAnswer) {
      return res.status(400).json({ message: 'This question has no submitted answer to re-evaluate.' });
    }

    // Re-evaluation is a Pro feature — EXCEPT when our own evaluator failed
    // (AI unavailable / fallback answer). Paying to fix our outage would be wrong.
    const planCfg = await loadPlanCfg(userId);
    const prev = tryParse(question.feedback);
    const evaluationFailed = prev?.aiAvailable === false || prev?.fallback === true;
    if (!planCfg.retryQuestion && !evaluationFailed) {
      return res.status(403).json({
        error:       'plan_required',
        feature:     'retryQuestion',
        currentPlan: planCfg._effectivePlan,
        expired:     planCfg._expired,
        message:     'Re-evaluating an answer requires a Pro subscription.',
      });
    }

    const result = await evaluateOpenAnswer({
      question,
      answer: question.userAnswer,
      topic: question.topic,
      voiceMetrics: question.voiceMetrics || null,
    });
    question.score = Number(result.score || 0);
    question.feedback = JSON.stringify({
      good:         result.good         || '',
      missing:      result.missing      || '',
      idealHint:    result.idealHint    || '',
      tip:          result.tip          || '',
      sampleAnswer: result.sampleAnswer || '',
      deliveryTip:  result.deliveryTip  || null,
      aiAvailable:  result.aiAvailable  !== false,
      fallback:     result.fallback     === true,
      starBreakdown:      result.starBreakdown      || null,
      followUpQuestions:  result.followUpQuestions  || [],
      keywordCoverage:    result.keywordCoverage    || null,
      confidenceScore:    result.confidenceScore    || null,
      toneAnalysis:       result.toneAnalysis       || null,
      vocabularyRichness: result.vocabularyRichness || null,
      hesitationPattern:  result.hesitationPattern  || null,
    });
    await session.save();
    const retryTier = getFeedbackTier(planCfg, session);
    return res.json({
      success: true, questionId, feedbackTier: retryTier,
      score: question.score, feedback: shapeFeedback(question, retryTier),
    });
  } catch (error) {
    console.error('retryQuestion error:', error);
    return res.status(500).json({ message: 'Failed to retry question.', error: error.message });
  }
};

const getInterviewHistory = async (req, res) => {
  try {
    const userId = getUserId(req);
    const rawSessions = await Session.find({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const planCfg = await loadPlanCfg(userId);

    // Free plan: only the last N days are listed. Older sessions stay saved and are
    // COUNTED so the UI can say "12 older sessions are waiting" and mean it.
    const windowDays = planCfg.analyticsHistoryDays;
    let visibleSessions = rawSessions;
    let olderCount = 0;
    if (Number.isFinite(windowDays)) {
      const cutoff = new Date(Date.now() - windowDays * 86400000);
      visibleSessions = rawSessions.filter(s => new Date(s.createdAt) >= cutoff);
      olderCount = await Session.countDocuments({
        $or: [{ user: userId }, { userId }],
        status: 'completed',
        createdAt: { $lt: cutoff },
      });
    }

    const sessions = visibleSessions.map(rawSession => {
      const session = shapeSession(rawSession, getFeedbackTier(planCfg, rawSession));
      const score = getSessionScore(session);
      return {
        ...session,
        score,
        averageScore: Number.isFinite(Number(session.averageScore)) ? Number(session.averageScore) : score,
        questionCount: Array.isArray(session.questions) ? session.questions.length : 0,
      };
    });
    return res.json({
      success: true,
      sessions,
      olderCount,
      historyWindowDays: Number.isFinite(windowDays) ? windowDays : null,
    });
  } catch (error) {
    console.error('getInterviewHistory error:', error);
    return res.status(500).json({ message: 'Failed to load interview history.', error: error.message });
  }
};

const getInterviewResult = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const session = await Session.findOne({ _id: sessionId, user: userId });
    if (!session) return res.status(404).json({ message: 'Interview result not found.' });
    const tier = getFeedbackTier(await loadPlanCfg(userId), session);
    return res.json({ session: shapeSession(session.toObject(), tier) });
  } catch (error) {
    console.error('getInterviewResult error:', error);
    return res.status(500).json({ message: 'Failed to load result.', error: error.message });
  }
};

const abandonInterview = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const session = await Session.findOneAndUpdate(
      { _id: sessionId, $or: [{ user: userId }, { userId }], status: 'active' },
      { $set: { status: 'abandoned' } },
      { returnDocument: 'after' }
    );
    if (!session) return res.status(404).json({ message: 'Active session not found.' });
    return res.json({ success: true });
  } catch (error) {
    console.error('abandonInterview error:', error);
    return res.status(500).json({ message: 'Failed to abandon interview.', error: error.message });
  }
};

const getBadges = async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const badgeUser = {
      totalInterviews: Number(user.totalInterviews || 0),
      bestScore: Number(user.bestScore || 0),
      streak: { current: Number(user.streak?.current || 0) },
    };
    const badges = BADGES.map(badge => ({
      id: badge.id,
      label: badge.label,
      unlocked: badge.check(badgeUser),
    }));
    return res.json({ badges });
  } catch (error) {
    console.error('getBadges error:', error);
    return res.status(500).json({ message: 'Failed to load badges.', error: error.message });
  }
};

const computeUserIRS = async (userId) => {
  const sessions = await Session.find({
    $or: [{ user: userId }, { userId }],
    status: 'completed',
  }).sort({ createdAt: 1 }).lean();
  if (!sessions.length) return { irs: 0, averageScore: 0, tierLabel: '₹3–6 LPA' };
  const scores = sessions.map(s => getSessionScore(s));
  const averageScore = Math.round(scores.reduce((a, v) => a + v, 0) / scores.length);
  const scoreTrend = sessions.map((s, i) => ({ interview: i + 1, score: scores[i], date: s.createdAt }));
  const topicStats = {};
  sessions.forEach(session => {
    (session.questions || []).forEach(q => {
      if (!q.userAnswer || q.userAnswer === 'Skipped') return;
      const topic = q.topic || 'General';
      const score = getQuestionScore(q);
      if (!topicStats[topic]) topicStats[topic] = { topic, totalScore: 0, count: 0 };
      topicStats[topic].totalScore += score;
      topicStats[topic].count += 1;
    });
  });
  const topicPerformance = Object.values(topicStats).map(t => ({
    topic: t.topic,
    averageScore: Math.round(t.totalScore / t.count),
    attempts: t.count,
  }));
  const { profile: dimProfile } = buildDimensionProfile(topicPerformance);
  const { totalAnswered, difficultyMix } = extractIRSEvidence(sessions);
  const irs = computeIRS({ dimensionProfile: dimProfile, scoreTrend, topicPerformance, averageScore, totalAnswered, difficultyMix });
  const { tier: gatedTier } = tierForScoreGated(irs, sessions.length);
  return { irs, averageScore, tierLabel: gatedTier.label };
};

const getAnalytics = async (req, res) => {
  try {
    const userId = getUserId(req);
    const sessions = await Session.find({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
      'questions.0': { $exists: true }, // exclude sessions with zero answered questions
    })
      .sort({ createdAt: 1 })
      .lean();

    if (!sessions.length) {
      return res.json({
        totalSessions: 0,
        totalInterviews: 0,
        averageScore: 0,
        highestScore: 0,
        bestScore: 0,
        lowestScore: 0,
        scoreTrend: [],
        topicPerformance: [],
        weakTopics: [],
        timePerformance: { avgTimePerQuestion: 0, totalTime: 0 },
        ...EMPTY_IRS_RESPONSE,
      });
    }

    const scores = sessions.map(s => getSessionScore(s));
    const totalSessions = sessions.length;
    const averageScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    const scoreTrend = sessions.map(session => {
      const sessionScore = getSessionScore(session);
      const dimTotals = {};
      (session.questions || []).forEach(q => {
        if (!q.userAnswer || q.userAnswer === 'Skipped') return;
        const canonical = resolveTopic(q.topic);
        const dims = TOPIC_DIMENSIONS[canonical] || [];
        const score = getQuestionScore(q);
        dims.forEach(dimKey => {
          if (!dimTotals[dimKey]) dimTotals[dimKey] = { sum: 0, count: 0 };
          dimTotals[dimKey].sum += score;
          dimTotals[dimKey].count += 1;
        });
      });
      const topicScores = {};
      Object.entries(dimTotals).forEach(([key, { sum, count }]) => {
        if (count > 0) topicScores[key] = Math.round(sum / count);
      });
      return { date: session.createdAt, score: sessionScore, mode: session.mode, topicScores };
    });

    const answeredQuestions = sessions
      .flatMap(s => s.questions || [])
      .filter(q => q.userAnswer && q.userAnswer !== 'Skipped');

    const topicMap = {};
    answeredQuestions.forEach(q => {
      const topic = q.topic || 'General';
      const score = getQuestionScore(q);
      if (!topicMap[topic]) topicMap[topic] = { topic, totalScore: 0, count: 0 };
      topicMap[topic].totalScore += score;
      topicMap[topic].count += 1;
    });

    const topicPerformance = Object.values(topicMap)
      .map(item => ({ topic: item.topic, averageScore: Math.round(item.totalScore / item.count), attempts: item.count }))
      .sort((a, b) => b.averageScore - a.averageScore);

    const weakTopics = topicPerformance
      .filter(t => t.averageScore < 70)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 3)
      .map(t => t.topic);

    const totalTime = answeredQuestions.reduce((sum, q) => sum + Number(q.timeTaken || 0), 0);
    const avgTimePerQuestion = answeredQuestions.length
      ? Math.round(totalTime / answeredQuestions.length)
      : 0;

    const { profile: dimProfile, unmapped: unmappedTopics } = buildDimensionProfile(topicPerformance);
    const { totalAnswered, difficultyMix } = extractIRSEvidence(sessions);

    const breakdown = irsBreakdown({
      dimensionProfile: dimProfile, scoreTrend, topicPerformance, averageScore, totalAnswered, difficultyMix,
    });
    const irs = breakdown.finalScore;
    const currentTierRaw = tierForScore(irs);
    const { tier: currentTierGated, isGated, sessionsNeededForRawTier } = tierForScoreGated(irs, sessions.length);
    const dimTimeSeries = buildDimSeries(sessions);
    const tiers = buildTierMap({ irs, sessionCount: sessions.length, dimProfile, dimTimeSeries, currentTierGated });

    // ── Badge hydration ───────────────────────────────────────────────────────
    const userForBadges = await User.findById(userId).select('badges streak totalSessions bestScore').lean();
    const evaluatedBadges = evaluateBadges({ user: userForBadges, sessions });
    const badges = evaluatedBadges.map(b => ({
      id: b.id,
      unlocked: b.unlocked,
      progress: b.progress,
      meta: b.meta,
    }));

    return res.json({
      totalSessions,
      totalInterviews: totalSessions,
      averageScore,
      highestScore,
      bestScore: highestScore,
      lowestScore,
      scoreTrend,
      topicPerformance,
      weakTopics,
      timePerformance: { avgTimePerQuestion, totalTime },
      irs,
      irsBreakdown: breakdown,
      currentTier: currentTierGated.label,
      currentTierIsGated: isGated,
      currentTierRaw: currentTierRaw.label,
      sessionsNeededForRawTier,
      totalAnswered,
      difficultyMix,
      tiers,
      dimensionProfile: dimProfile,
      unmappedTopics,
      badges,
      percentile: null,
    });
  } catch (error) {
    console.error('getAnalytics error:', error);
    return res.status(500).json({ error: 'Failed to load analytics.' });
  }
};

const getPerformance = async (req, res) => {
  try {
    const userId = getUserId(req);
    const sessions = await Session.find({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
      'questions.0': { $exists: true }, // exclude sessions with zero answered questions
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!sessions.length) {
      return res.json({
        totalInterviews: 0,
        totalSessions: 0,
        averageScore: 0,
        bestScore: 0,
        scoreTrend: [],
        topicPerformance: [],
        weakTopics: [],
        badges: [],
        ...EMPTY_IRS_RESPONSE,
      });
    }

    const scores = sessions.map(s => getSessionScore(s));
    const averageScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
    const bestScore = Math.max(...scores);
    const chronological = [...sessions].reverse();

    const scoreTrend = chronological.map((session, index) => ({
      interview: index + 1,
      score: getSessionScore(session),
      date: session.createdAt,
    }));

    const topicStats = {};
    sessions.forEach(session => {
      (session.questions || []).forEach(q => {
        if (!q.userAnswer || q.userAnswer === 'Skipped') return;
        const topic = q.topic || 'General';
        const score = getQuestionScore(q);
        if (!topicStats[topic]) topicStats[topic] = { topic, totalScore: 0, count: 0 };
        topicStats[topic].totalScore += score;
        topicStats[topic].count += 1;
      });
    });

    const topicPerformance = Object.values(topicStats)
      .map(item => ({ topic: item.topic, averageScore: Math.round(item.totalScore / item.count), attempts: item.count }))
      .sort((a, b) => b.averageScore - a.averageScore);

    const weakTopics = topicPerformance
      .filter(t => t.averageScore < 70)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 3)
      .map(t => t.topic);

    const { profile: dimProfile, unmapped: unmappedTopics } = buildDimensionProfile(topicPerformance);
    const { totalAnswered, difficultyMix } = extractIRSEvidence(chronological);

    const breakdown = irsBreakdown({
      dimensionProfile: dimProfile, scoreTrend, topicPerformance, averageScore, totalAnswered, difficultyMix,
    });
    const irs = breakdown.finalScore;
    const currentTierRaw = tierForScore(irs);
    const { tier: currentTierGated, isGated, sessionsNeededForRawTier } = tierForScoreGated(irs, sessions.length);
    const dimTimeSeries = buildDimSeries(chronological);

    // NOTE: uses currentTierGated (not raw) so isCurrentTier and isUnlocked are consistent
    // between getAnalytics and getPerformance.
    const tiers = buildTierMap({ irs, sessionCount: sessions.length, dimProfile, dimTimeSeries, currentTierGated });

    const user = await User.findById(userId).lean();
    const badges = evaluateBadges({ user, sessions: chronological });

    return res.json({
      totalInterviews: sessions.length,
      totalSessions: sessions.length,
      averageScore,
      bestScore,
      scoreTrend,
      topicPerformance,
      weakTopics,
      badges,
      irs,
      irsBreakdown: breakdown,
      currentTier: currentTierGated.label,
      currentTierIsGated: isGated,
      currentTierRaw: currentTierRaw.label,
      sessionsNeededForRawTier,
      totalAnswered,
      difficultyMix,
      tiers,
      dimensionProfile: dimProfile,
      unmappedTopics,
    });
  } catch (error) {
    console.error('getAnalytics error:', error);
    return res.status(500).json({ error: 'Failed to load performance analytics.' });
  }
};

const getAICoach = async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const sessions = await Session.find({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const scores = sessions.map(s => getSessionScore(s));
    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 0;
    const bestScore = scores.length ? Math.max(...scores) : 0;

    const topicStats = {};
    sessions.forEach(session => {
      (session.questions || []).forEach(q => {
        if (!q.userAnswer || q.userAnswer === 'Skipped') return;
        const topic = q.topic || 'General';
        const score = getQuestionScore(q);
        if (!topicStats[topic]) topicStats[topic] = { topic, totalScore: 0, count: 0 };
        topicStats[topic].totalScore += score;
        topicStats[topic].count += 1;
      });
    });

    const topicPerformance = Object.values(topicStats)
      .map(item => ({ topic: item.topic, averageScore: Math.round(item.totalScore / item.count), attempts: item.count }))
      .sort((a, b) => b.averageScore - a.averageScore);

    const weakest   = topicPerformance.slice().sort((a, b) => a.averageScore - b.averageScore).slice(0, 3).map(t => t.topic);
    const strongest = topicPerformance[0]?.topic || 'N/A';
    const chronological = [...sessions].reverse();
    const { profile: dimProfile } = buildDimensionProfile(topicPerformance);

    const scoreTrend = chronological.map((session, index) => ({
      interview: index + 1,
      score: getSessionScore(session),
      date: session.createdAt,
    }));

    const { totalAnswered, difficultyMix } = extractIRSEvidence(chronological);
    const irs = computeIRS({
      dimensionProfile: dimProfile, scoreTrend, topicPerformance, averageScore, totalAnswered, difficultyMix,
    });
    const { tier: currentTier } = tierForScoreGated(irs, sessions.length);
    const currentTierIndex = TIERS.findIndex(t => t.label === currentTier.label);
    const nextTier = TIERS[currentTierIndex + 1] || null;
    const dimTimeSeries = buildDimSeries(chronological);
    const nextTierReadiness = nextTier ? tierReadiness(dimProfile, nextTier, sessions.length) : null;
    const blocker = nextTierReadiness ? blockingDimension(nextTierReadiness) : null;
    const eta = blocker ? sessionsToUnlock(blocker, dimTimeSeries) : null;

    const { generateCoachAdvice } = require('../services/aiServices');
    const analysis = await generateCoachAdvice({
      profile: { college: user.college, branch: user.branch, semester: user.semester },
      totalSessions: sessions.length,
      averageScore,
      bestScore,
      streak: Number(user.streak?.current || 0),
      weakest,
      strongest,
      topicPerformance,
      irs,
      currentTierLabel: currentTier.label,
      nextTierLabel: nextTier?.label || null,
      nextTierReadinessPct: nextTierReadiness?.readinessPct ?? null,
      primaryBlockerLabel: blocker?.label || null,
      primaryBlockerGap: blocker?.gap ?? null,
      sessionsToUnlockNextTier: eta?.estimable ? eta.sessionsNeeded : null,
    });

    return res.json({ analysis });
  } catch (error) {
    console.error('getAICoach error:', error);
    return res.status(500).json({ error: 'AI coach unavailable.' });
  }
};

const getAIFreeform = async (req, res) => {
  try {
    const { prompt, maxTokens = 400 } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required.' });
    }
    if (prompt.length > 12000) {
      return res.status(413).json({ error: 'prompt is too long.' });
    }
    const { generateFreeform } = require('../services/aiServices');
    const text = await generateFreeform(prompt, maxTokens);
    return res.json({ text });
  } catch (error) {
    console.error('getAIFreeform error:', error);
    return res.status(500).json({ error: 'AI unavailable.' });
  }
};

const getLastSessionBreakdown = async (req, res) => {
  try {
    const userId = getUserId(req);
    const session = await Session.findOne({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!session) return res.status(404).json({ message: 'No completed sessions found.' });

    const questions = (session.questions || []).map((q, idx) => ({
      index:      idx + 1,
      topic:      q.topic || 'General',
      text:       q.text ? q.text.slice(0, 120) + (q.text.length > 120 ? '…' : '') : '',
      score:      getQuestionScore(q),
      timeTaken:  Number(q.timeTaken) || 0,
      skipped:    Boolean(q.skipped) || !q.userAnswer,
      difficulty: q.difficulty || 'medium',
    }));

    const answered     = questions.filter(q => !q.skipped);
    const avgTime      = answered.length ? Math.round(answered.reduce((a, q) => a + q.timeTaken, 0) / answered.length) : 0;
    const skipRate     = questions.length ? Math.round((questions.filter(q => q.skipped).length / questions.length) * 100) : 0;
    const sessionScore = getSessionScore(session);

    return res.json({
      sessionId:      session._id,
      sessionDate:    session.createdAt,
      sessionMode:    session.mode,
      sessionScore,
      avgTimeTaken:   avgTime,
      skipRate,
      totalQuestions: questions.length,
      questions,
    });
  } catch (err) {
    console.error('getLastSessionBreakdown error:', err);
    return res.status(500).json({ error: 'Failed to load session breakdown.' });
  }
};

const getBlindSpots = async (req, res) => {
  try {
    const userId = getUserId(req);
    const sessions = await Session.find({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('weaknesses createdAt')
      .lean();
    if (!sessions.length) return res.json({ blindSpots: [] });

    const freq = {};
    sessions.forEach(s => {
      const seen = new Set();
      (s.weaknesses || []).forEach(w => {
        const key = w.toLowerCase().trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        freq[key] = (freq[key] || 0) + 1;
      });
    });

    const blindSpots = Object.entries(freq)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({
        topic,
        sessionCount: count,
        severity: count >= 4 ? 'high' : count >= 3 ? 'medium' : 'low',
      }));

    return res.json({ blindSpots, sessionsAnalyzed: sessions.length });
  } catch (err) {
    console.error('getBlindSpots error:', err);
    return res.status(500).json({ error: 'Failed to compute blind spots.' });
  }
};

const getSessionWarmup = async (req, res) => {
  try {
    const userId = getUserId(req);
    const sessions = await Session.find({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
    })
      .sort({ createdAt: 1 })
      .select('createdAt averageScore totalScore questions')
      .lean();

    if (sessions.length < 4) {
      return res.json({ available: false, reason: 'not_enough_sessions', minSessions: 4 });
    }

    const byDate = {};
    sessions.forEach(s => {
      const dateKey = new Date(s.createdAt).toISOString().slice(0, 10);
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(s);
    });

    const positionTotals = { 1: { sum: 0, count: 0 }, 2: { sum: 0, count: 0 }, 3: { sum: 0, count: 0 } };
    Object.values(byDate).forEach(daySessions => {
      daySessions.forEach((s, idx) => {
        const pos = Math.min(idx + 1, 3);
        positionTotals[pos].sum += getSessionScore(s);
        positionTotals[pos].count += 1;
      });
    });

    const positions = Object.entries(positionTotals)
      .filter(([, { count }]) => count > 0)
      .map(([pos, { sum, count }]) => ({
        position: Number(pos),
        label: pos === '1' ? '1st session' : pos === '2' ? '2nd session' : '3rd+ session',
        avgScore: Math.round(sum / count),
        count,
      }));

    if (positions.length < 2) {
      return res.json({ available: false, reason: 'needs_multi_session_days' });
    }

    const first  = positions.find(p => p.position === 1);
    const second = positions.find(p => p.position === 2);
    const pattern = (first && second)
      ? second.avgScore - first.avgScore > 5  ? 'warmup'
      : second.avgScore - first.avgScore < -5 ? 'coldstart'
      : 'consistent'
      : 'insufficient';

    return res.json({ available: true, positions, pattern });
  } catch (err) {
    console.error('getSessionWarmup error:', err);
    return res.status(500).json({ error: 'Failed to compute warmup data.' });
  }
};

module.exports = {
  startInterview,
  getUsage,
  getInterviewMeta,
  getInterviewSession,
  answerQuestion,
  completeInterview,
  getQuestionFeedback,
  retryQuestion,
  getInterviewHistory,
  getInterviewResult,
  abandonInterview,
  getBadges,
  getAnalytics,
  getPerformance,
  getAICoach,
  computeUserIRS,
  getLastSessionBreakdown,
  getBlindSpots,
  getSessionWarmup,
  getAIFreeform,
};