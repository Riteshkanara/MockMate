const Session = require('../models/Session');
const User = require('../models/User');
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
} = require('../services/aiServices');

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

const getQuestionCount = mode => {
  if (mode === 'quick') return 5;
  if (['mcq', 'aptitude'].includes(mode)) return 8;
  return 10; // mixed + default
};

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

const startInterview = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { mode = 'quick', company = '', topic = '', difficulty = 'mixed' } = req.body || {};
    const count = getQuestionCount(mode);

    // Fetch last 10 completed sessions once — used for BOTH the
    // previous-questions exclusion list AND the weak-areas signal below.
    const recentSessions = await Session.find(
      { $or: [{ user: userId }, { userId }], status: 'completed' },
      { 'questions.text': 1, 'questions.topic': 1, 'questions.score': 1, 'questions.skipped': 1 },
      { sort: { createdAt: -1 }, limit: 10 }
    ).lean();

    const previousQuestions = recentSessions
      .flatMap(s => s.questions || [])
      .map(q => q.text)
      .filter(Boolean)
      .slice(0, 20); // cap at 20 — enough signal without bloating the prompt

    const weakAreas = buildWeakAreas(recentSessions);

    const questions = await generateQuestions({
      mode, company, topic, weakAreas, difficulty, count, previousQuestions,
    });

    const session = await Session.create({
      user: userId,
      mode,
      company,
      topic,
      questions: questions.map(q => ({
        ...q,
        userAnswer: '',
        userAnswerIndex: null,
        score: 0,
        feedback: '',
        skipped: false,
        timeTaken: 0,
      })),
      currentQuestion: 0,
      status: 'active',
      startedAt: new Date(),
    });

    const publicQuestions = session.questions.map(q => ({
      id: q.id,
      text: q.text,
      topic: q.topic,
      difficulty: q.difficulty,
      timeLimit: q.timeLimit || (q.questionType === 'aptitude' ? 60 : q.questionType === 'mcq' ? 45 : 90),
      questionType: q.questionType || 'open',
      options: q.questionType === 'open' ? [] : q.options || [],
    }));

    return res.status(201).json({ sessionId: session._id, mode, questions: publicQuestions });
  } catch (error) {
    console.error('startInterview error:', error);
    return res.status(500).json({ message: 'Failed to start interview.', error: error.message });
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
    return res.json({
      sessionId: session._id,
      mode: session.mode,
      status: session.status,
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
        question.score = 0;
        const result = await getSkippedAnswer({ question, topic: question.topic });
        question.feedback = JSON.stringify({
          good:         '',
          missing:      'Question skipped — no answer submitted.',
          idealHint:    result.idealHint    || '',
          tip:          result.tip          || '',
          sampleAnswer: result.sampleAnswer || '',
          aiAvailable:  result.aiAvailable !== false,
          fallback:     result.fallback === true,
        });
      } else {
        // CHANGED: pass voiceMetrics so Gemini generates a deliveryTip
        const result = await evaluateOpenAnswer({
          question,
          answer:       question.userAnswer,
          topic:        question.topic,
          voiceMetrics,  // NEW — null when user typed; Gemini prompt adapts
        });
        question.score = Number(result.score || 0);
        question.feedback = JSON.stringify({
          good:         result.good         || '',
          missing:      result.missing      || '',
          idealHint:    result.idealHint    || '',
          tip:          result.tip          || '',
          sampleAnswer: result.sampleAnswer || '',
          deliveryTip:  result.deliveryTip  || '',  // NEW — AI tip based on metrics
          aiAvailable:  result.aiAvailable !== false,
          fallback:     result.fallback === true,
        });
      }
    }

    const currentIndex = session.questions.findIndex(q => q.id === questionId);
    session.currentQuestion = Math.min(currentIndex + 1, session.questions.length - 1);
    await session.save();

    const isObjective = ['mcq', 'aptitude'].includes(question.questionType);

    return res.json({
      success:            true,
      questionId,
      score:              question.score,
      feedback:           question.feedback,
      skipped:            Boolean(question.skipped),
      correct:            isObjective ? question.score === 100 : null,
      correctAnswerIndex: isObjective ? question.correctAnswerIndex : null,
      explanation:        isObjective ? (question.explanation || '') : '',
      nextQuestion:       session.currentQuestion < session.questions.length - 1,
      // NEW: echo back voiceMetrics so the client can display them in FeedbackPanel
      // without having to store them in React state across a round-trip.
      voiceMetrics:       question.voiceMetrics || null,
    });
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
    return res.json({
      success: true,
      sessionId: session._id,
      mode: session.mode,
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
        feedback: q.feedback,
        skipped: q.skipped,
        timeTaken: q.timeTaken,
      })),
    });
  } catch (error) {
    console.error('completeInterview error:', error);
    return res.status(500).json({ message: 'Failed to complete interview.', error: error.message });
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
    const result = await evaluateOpenAnswer({ question, answer: question.userAnswer, topic: question.topic });
    question.score = Number(result.score || 0);
    question.feedback = JSON.stringify({
      good:         result.good         || '',
      missing:      result.missing      || '',
      idealHint:    result.idealHint    || '',
      tip:          result.tip          || '',
      sampleAnswer: result.sampleAnswer || '',
      aiAvailable:  result.aiAvailable !== false,
      fallback:     result.fallback === true,
    });
    await session.save();
    return res.json({ success: true, questionId, score: question.score, feedback: question.feedback });
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
    const sessions = rawSessions.map(session => {
      const score = getSessionScore(session);
      return {
        ...session,
        score,
        averageScore: Number.isFinite(Number(session.averageScore)) ? Number(session.averageScore) : score,
        questionCount: Array.isArray(session.questions) ? session.questions.length : 0,
      };
    });
    return res.json({ success: true, sessions });
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
    return res.json({ session });
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
      { new: true }
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
  getInterviewSession,
  answerQuestion,
  completeInterview,
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