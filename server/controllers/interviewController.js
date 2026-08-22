const Session = require('../models/Session');
const User = require('../models/User');
const { evaluateBadges } = require('../utils/badgeEngine');
  const {
      buildDimensionProfile,
      computeIRS,
      computeIRSBreakdown,
      tierForScore,
      tierForScoreGated,
      TIERS,
      computeTierReadiness,
      findBlockingDimension,
      buildDimensionTimeSeries,
      projectSessionsToUnlock,
      resolveCanonicalTopic,
    } = require('../utils/scoringModel');

// CANONICAL_TOPIC_TO_DIMENSIONS is not exported from scoringModel, so we
// mirror the minimal mapping needed for scoreTrend enrichment here.
// (This is display-only — IRS still uses the full buildDimensionProfile.)
const CANONICAL_TOPIC_TO_DIMENSIONS = {
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

// ─── Shared evidence extractor ──────────────────────────────────────────────
// Pulls the richer signals the V2 scoring model needs (total answered
// question count + difficulty mix) out of a set of completed sessions.
// Kept here so every call site (getPerformanceAnalytics, getAICoach,
// computeUserIRS, getAnalytics) feeds computeIRS the SAME evidence inputs —
// same failure mode as the old scoringModel duplication this file's header
// comment warns about, just one level up.
const extractIRSEvidence = (sessions) => {
  let totalAnsweredQuestions = 0;
  const difficultyMix = { easy: 0, medium: 0, hard: 0 };

  sessions.forEach((session) => {
    (session.questions || []).forEach((q) => {
      if (q.skipped || !q.userAnswer) return;
      totalAnsweredQuestions += 1;
      const d = String(q.difficulty || 'medium').toLowerCase();
      if (difficultyMix[d] != null) difficultyMix[d] += 1;
      else difficultyMix.medium += 1; // unknown/legacy difficulty strings default to medium
    });
  });

  return { totalAnsweredQuestions, difficultyMix };
};

const {
  generateQuestions,
  evaluateOpenAnswer,
  evaluateObjectiveAnswer,
} = require('../services/aiServices');

const BADGES = [
  {
    id: 'first',
    label: 'First Rep',
    check: user => user.totalInterviews >= 1,
  },
  {
    id: 'trio',
    label: 'Hat Trick',
    check: user => user.totalInterviews >= 3,
  },
  {
    id: 'ten',
    label: 'The Grinder',
    check: user => user.totalInterviews >= 10,
  },
  {
    id: 'veteran',
    label: 'Veteran',
    check: user => user.totalInterviews >= 25,
  },
  {
    id: 'hi80',
    label: 'High Scorer',
    check: user => user.bestScore >= 80,
  },
  {
    id: 'elite',
    label: 'Elite Pass',
    check: user => user.bestScore >= 90,
  },
  {
    id: 'streak_3',
    label: 'On Fire',
    check: user => user.streak.current >= 3,
  },
  {
    id: 'streak_30',
    label: '👑 Placement Ready',
    check: user => user.streak.current >= 30,
  },
];

const getUserId = req => req.user?._id || req.user?.id;

const getNormalizedQuestionScore = question => {
  const currentScore = Number(question?.score);

  // New schema: score is already 0–100.
  // Only treat it as the current score when it is > 10.
  if (
    Number.isFinite(currentScore) &&
    currentScore > 10
  ) {
    return Math.max(
      0,
      Math.min(100, currentScore)
    );
  }

  // Legacy schema: aiFeedback.score was 0–10.
  const legacyScore = Number(
    question?.aiFeedback?.score
  );

  if (Number.isFinite(legacyScore)) {
    return Math.max(
      0,
      Math.min(100, Math.round(legacyScore * 10))
    );
  }

  // New zero score / unanswered fallback.
  if (Number.isFinite(currentScore)) {
    return Math.max(
      0,
      Math.min(100, currentScore)
    );
  }

  return 0;
};

const getNormalizedSessionScore = session => {
  const averageScore = Number(
    session?.averageScore
  );

  if (
    Number.isFinite(averageScore) &&
    averageScore >= 0 &&
    averageScore <= 100
  ) {
    return Math.round(averageScore);
  }

  const totalScore = Number(
    session?.totalScore
  );

  if (
    Number.isFinite(totalScore) &&
    totalScore >= 0
  ) {
    const questionCount =
      Array.isArray(session?.questions)
        ? session.questions.length
        : 0;

    // Legacy sessions may already store totalScore
    // as 0–100. New sessions can store sum of
    // question scores, so normalize when necessary.
    if (
      questionCount > 0 &&
      totalScore > 100
    ) {
      return Math.round(
        totalScore / questionCount
      );
    }

    return Math.round(
      Math.min(100, totalScore)
    );
  }

  return 0;
};

const getQuestionCount = mode => {
  if (mode === 'quick') return 5;

  if (['mcq', 'aptitude'].includes(mode)) {
    return 8;
  }

  if (mode === 'mixed') {
    return 10;
  }

  return 10;
};

const calculateReadiness = ({
  averageScore,
  bestScore,
  streak,
  totalInterviews,
}) => {
  if (!totalInterviews) return 0;

  const base = averageScore || 0;
  const streakBonus = Math.min((streak || 0) * 1.5, 12);
  const bestBonus = bestScore >= 90 ? 5 : bestScore >= 80 ? 3 : 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(base + streakBonus + bestBonus)
    )
  );
};

const updateUserStats = async ({
  user,
  score,
}) => {
  const now = new Date();

  user.totalInterviews =
    Number(user.totalInterviews || 0) + 1;

    user.totalSessions = user.totalInterviews; // keep both fields in sync

  const previousTotal =
    user.totalInterviews - 1;

  const previousAverage =
    Number(user.averageScore || 0);

  user.averageScore =
    previousTotal > 0
      ? Math.round(
          ((previousAverage * previousTotal) + score) /
            user.totalInterviews
        )
      : Math.round(score);

  user.bestScore = Math.max(
    Number(user.bestScore || 0),
    Number(score || 0)
  );

  if (!user.streak) {
    user.streak = {
      current: 0,
      longest: 0,
      lastPracticeDate: null,
    };
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const lastPractice = user.streak.lastPracticeDate
    ? new Date(user.streak.lastPracticeDate)
    : null;

  if (lastPractice) {
    lastPractice.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (today - lastPractice) /
        (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      user.streak.current += 1;
    } else if (diffDays > 1) {
      user.streak.current = 1;
    }
  } else {
    user.streak.current = 1;
  }

  user.streak.longest = Math.max(
    Number(user.streak.longest || 0),
    Number(user.streak.current || 0)
  );

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

const startInterview = async (req, res) => {
  try {
    const userId = getUserId(req);

    const {
      mode = 'quick',
      company = '',
      topic = '',
      difficulty = 'mixed',
    } = req.body || {};

    const count = getQuestionCount(mode);

    // Fetch last 10 completed sessions once — used for BOTH the
    // previous-questions exclusion list AND the weak-areas signal below.
    const recentSessions = await Session.find(
      { user: userId, status: 'completed' },
      { 'questions.text': 1, 'questions.topic': 1, 'questions.score': 1, 'questions.skipped': 1 },
      { sort: { createdAt: -1 }, limit: 10 }
    ).lean();

    const previousQuestions = recentSessions
      .flatMap(s => s.questions || [])
      .map(q => q.text)
      .filter(Boolean)
      .slice(0, 20); // cap at 40 so prompt doesn't bloat

    // Build weakAreas from per-topic average scores across recent sessions.
    // Topics averaging below 60 are treated as weak and prioritized by
    // generateQuestions (see the "Prioritize weak areas" rule in aiServices.js).
    const topicScores = {};
    recentSessions.forEach(s => {
      (s.questions || []).forEach(q => {
        if (q.skipped || !q.score) return;
        if (!topicScores[q.topic]) topicScores[q.topic] = [];
        topicScores[q.topic].push(q.score);
      });
    });

    const weakAreas = Object.entries(topicScores)
      .map(([topic, scores]) => ({
        topic,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .filter(t => t.avg < 60)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3)
      .map(t => t.topic);

    const questions = await generateQuestions({
      mode,
      company,
      topic,
      weakAreas,
      difficulty,
      count,
      previousQuestions,
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
      timeLimit:
        q.timeLimit ||
        (q.questionType === 'aptitude'
          ? 60
          : q.questionType === 'mcq'
            ? 45
            : 120),
      questionType: q.questionType || 'open',
      options:
        q.questionType === 'open'
          ? []
          : q.options || [],
    }));

    return res.status(201).json({
      sessionId: session._id,
      mode,
      questions: publicQuestions,
    });
  } catch (error) {
    console.error('startInterview error:', error);

    return res.status(500).json({
      message: 'Failed to start interview.',
      error: error.message,
    });
  }
};

const getInterviewSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      user: userId,
    });

    if (!session) {
      return res.status(404).json({
        message: 'Interview session not found.',
      });
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
        options:
          q.questionType === 'open'
            ? []
            : q.options,
      })),
      currentQuestion: session.currentQuestion,
    });
  } catch (error) {
    console.error('getInterviewSession error:', error);

    return res.status(500).json({
      message: 'Failed to load interview session.',
      error: error.message,
    });
  }
};

const answerQuestion = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;

    const {
      questionId,
      answer = '',
      answerIndex = null,
      timeTaken = 0,
      skipped = false,
    } = req.body || {};

    const session = await Session.findOne({
      _id: sessionId,
      user: userId,
      status: 'active',
    });

    if (!session) {
      return res.status(404).json({
        message: 'Active interview session not found.',
      });
    }

    const question = session.questions.find(
      q => q.id === questionId
    );

    if (!question) {
      return res.status(404).json({
        message: 'Question not found.',
      });
    }

    question.timeTaken = Number(timeTaken) || 0;
    question.skipped = Boolean(skipped);

    if (['mcq', 'aptitude'].includes(question.questionType)) {
      question.userAnswerIndex =
        answerIndex === null ||
        answerIndex === undefined
          ? null
          : Number(answerIndex);

      question.userAnswer =
        answer ||
        (question.userAnswerIndex !== null
          ? question.options?.[question.userAnswerIndex] || ''
          : '');

      const result = evaluateObjectiveAnswer({
        question,
        answerIndex: question.userAnswerIndex,
      });

      question.score = result.score;
      question.feedback = result.feedback;
    } else {
      question.userAnswer = String(answer || '');

      if (skipped) {
        question.score = 0;
        // Must match the same JSON shape as a real AI evaluation, or the
        // frontend's JSON.parse(feedback) throws and shows a misleading
        // "AI evaluation failed" toast for what was actually just a skip.
        question.feedback = JSON.stringify({
          good: '',
          missing: 'Question skipped. Try to answer every question when possible.',
          idealHint: '',
          tip: '',
          sampleAnswer: '',
          aiAvailable: true,
          fallback: false,
        });
      } else {
       const result = await evaluateOpenAnswer({
  question,
  answer: question.userAnswer,
  topic: question.topic,
});

question.score = Number(result.score || 0);

question.feedback = JSON.stringify({
  good: result.good || '',
  missing: result.missing || '',
  idealHint: result.idealHint || '',
  tip: result.tip || '',
  sampleAnswer: result.sampleAnswer || '',
  aiAvailable: result.aiAvailable !== false,
  fallback: result.fallback === true,
});
      }
    }

    const currentIndex = session.questions.findIndex(
      q => q.id === questionId
    );

    session.currentQuestion = Math.min(
      currentIndex + 1,
      session.questions.length - 1
    );

    await session.save();

    return res.json({
      success: true,
      questionId,
      score: question.score,
      feedback: question.feedback,
      skipped: Boolean(question.skipped),
      correct:
        ['mcq', 'aptitude'].includes(question.questionType)
          ? question.score === 100
          : null,
      nextQuestion:
        session.currentQuestion <
        session.questions.length - 1,
    });
  } catch (error) {
    console.error('answerQuestion error:', error);

    return res.status(500).json({
      message: 'Failed to submit answer.',
      error: error.message,
    });
  }
};

const completeInterview = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      user: userId,
      status: 'active',
    });

    if (!session) {
      return res.status(404).json({
        message: 'Active interview session not found.',
      });
    }

    const questionScores = session.questions.map(
      q => Number(q.score || 0)
    );

    const totalScore = questionScores.reduce(
      (sum, score) => sum + score,
      0
    );

    const averageScore = session.questions.length
      ? Math.round(
          totalScore / session.questions.length
        )
      : 0;

    const objectiveQuestions =
      session.questions.filter(q =>
        ['mcq', 'aptitude'].includes(q.questionType)
      );

    const objectiveCorrect =
      objectiveQuestions.filter(
        q => q.score === 100
      ).length;

    const openQuestions =
      session.questions.filter(
        q => q.questionType === 'open'
      );

    const strengths = [];
    const weaknesses = [];

    const topicScores = {};

    session.questions.forEach(q => {
      const topic = q.topic || 'General';

      if (!topicScores[topic]) {
        topicScores[topic] = [];
      }

      topicScores[topic].push(
        Number(q.score || 0)
      );
    });

    Object.entries(topicScores).forEach(
      ([topic, scores]) => {
        const avg = Math.round(
          scores.reduce(
            (sum, score) => sum + score,
            0
          ) / scores.length
        );

        if (avg >= 80) {
          strengths.push(topic);
        }

        if (avg < 60) {
          weaknesses.push(topic);
        }
      }
    );

    session.totalScore = totalScore;
    session.averageScore = averageScore;
    session.objectiveCorrect = objectiveCorrect;
    session.objectiveTotal =
      objectiveQuestions.length;
    session.strengths = strengths;
    session.weaknesses = weaknesses;
    session.status = 'completed';
    session.completedAt = new Date();
    session.duration =
      Math.round(
        (session.completedAt -
          session.startedAt) /
          1000
      );

    session.readinessScore = calculateReadiness({
      averageScore,
      bestScore: averageScore,
      streak: 0,
      totalInterviews: 1,
    });

    await session.save();

    const user = await User.findById(userId);

    if (user) {
      await updateUserStats({
        user,
        score: averageScore,
      });
    }

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
        options:
          q.questionType === 'open'
            ? []
            : q.options,
        userAnswer: q.userAnswer,
        userAnswerIndex: q.userAnswerIndex,
        correctAnswerIndex:
          q.questionType === 'open'
            ? null
            : q.correctAnswerIndex,
        score: q.score,
        feedback: q.feedback,
        skipped: q.skipped,
        timeTaken: q.timeTaken,
      })),
    });
  } catch (error) {
    console.error('completeInterview error:', error);

    return res.status(500).json({
      message: 'Failed to complete interview.',
      error: error.message,
    });
  }
};

// Re-evaluates an already-submitted open answer with a fresh AI call.
// Useful when the first evaluation fell back due to AI being unavailable,
// or the user just wants a second pass. Does not change the question order
// or session progress — only the stored score/feedback for that question.
const retryQuestion = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId, questionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      user: userId,
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    const question = session.questions.find(q => q.id === questionId);

    if (!question) {
      return res.status(404).json({ message: 'Question not found.' });
    }

    if (['mcq', 'aptitude'].includes(question.questionType)) {
      return res.status(400).json({
        message: 'Only open-ended questions can be retried.',
      });
    }

    if (!question.userAnswer) {
      return res.status(400).json({
        message: 'This question has no submitted answer to re-evaluate.',
      });
    }

    const result = await evaluateOpenAnswer({
      question,
      answer: question.userAnswer,
      topic: question.topic,
    });

    question.score = Number(result.score || 0);
    question.feedback = JSON.stringify({
      good: result.good || '',
      missing: result.missing || '',
      idealHint: result.idealHint || '',
      tip: result.tip || '',
      sampleAnswer: result.sampleAnswer || '',
      aiAvailable: result.aiAvailable !== false,
      fallback: result.fallback === true,
    });

    await session.save();

    return res.json({
      success: true,
      questionId,
      score: question.score,
      feedback: question.feedback,
    });
  } catch (error) {
    console.error('retryQuestion error:', error);

    return res.status(500).json({
      message: 'Failed to retry question.',
      error: error.message,
    });
  }
};

const getInterviewHistory = async (req, res) => {
  try {
    const userId = getUserId(req);

    const sessions = await Session.find({
      $or: [
        { user: userId },
        { userId: userId },
      ],
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const normalizedSessions = sessions.map(
      session => {
        const score =
          getNormalizedSessionScore(session);

        return {
          ...session,

          score,

          averageScore:
            Number.isFinite(
              Number(session.averageScore)
            )
              ? Number(
                  session.averageScore
                )
              : score,

          questionCount:
            Array.isArray(
              session.questions
            )
              ? session.questions.length
              : 0,
        };
      }
    );

    return res.json({
      success: true,
      sessions: normalizedSessions,
    });
  } catch (error) {
    console.error(
      'getInterviewHistory error:',
      error
    );

    return res.status(500).json({
      message:
        'Failed to load interview history.',
      error: error.message,
    });
  }
};

const getInterviewResult = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      user: userId,
    });

    if (!session) {
      return res.status(404).json({
        message: 'Interview result not found.',
      });
    }

    return res.json({
      session,
    });
  } catch (error) {
    console.error('getInterviewResult error:', error);

    return res.status(500).json({
      message: 'Failed to load result.',
      error: error.message,
    });
  }
};

const abandonInterview = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;

    const session = await Session.findOneAndUpdate(
      {
        _id: sessionId,
        $or: [{ user: userId }, { userId: userId }],
        status: 'active',
      },
      {
        $set: {
          status: 'abandoned',
        },
      },
      {
        new: true,
      }
    );

    if (!session) {
      return res.status(404).json({
        message: 'Active session not found.',
      });
    }

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error('abandonInterview error:', error);

    return res.status(500).json({
      message: 'Failed to abandon interview.',
      error: error.message,
    });
  }
};

const getBadges = async (req, res) => {
  try {
    const userId = getUserId(req);

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    const totalInterviews =
      Number(user.totalInterviews || 0);

    const badgeUser = {
      totalInterviews,
      bestScore: Number(user.bestScore || 0),
      streak: {
        current: Number(
          user.streak?.current || 0
        ),
      },
    };

    const badges = BADGES.map(badge => ({
      id: badge.id,
      label: badge.label,
      unlocked: badge.check(badgeUser),
    }));

    return res.json({
      badges,
    });
  } catch (error) {
    console.error('getBadges error:', error);

    return res.status(500).json({
      message: 'Failed to load badges.',
      error: error.message,
    });
  }
};

// ─── Shared IRS computation ────────────────────────────────────────────────
// Single source of truth used by /me (navbar) and getPerformanceAnalytics
// (dashboard/analytics). Both call this so the number is always identical.
const computeUserIRS = async (userId) => {
  const sessions = await Session.find({
    $or: [{ user: userId }, { userId }],
    status: 'completed',
  }).sort({ createdAt: 1 }).lean();

  if (!sessions.length) return { irs: 0, averageScore: 0, tierLabel: '₹3–6 LPA' };

  const chronological = sessions; // already sorted oldest→newest
  const scores = chronological.map(s => getNormalizedSessionScore(s));
  const averageScore = Math.round(scores.reduce((a, v) => a + v, 0) / scores.length);

  const scoreTrend = chronological.map((s, i) => ({
    interview: i + 1,
    score: scores[i],
    date: s.createdAt,
  }));

  const topicStats = {};
  chronological.forEach(session => {
    (session.questions || []).forEach(q => {
      if (!q.userAnswer || q.userAnswer === 'Skipped') return;
      const topic = q.topic || 'General';
      const score = getNormalizedQuestionScore(q);
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

  const { profile: dimensionProfile } = buildDimensionProfile(topicPerformance);
  const { totalAnsweredQuestions, difficultyMix } = extractIRSEvidence(chronological);
  const irs = computeIRS({
    dimensionProfile,
    scoreTrend,
    topicPerformance,
    averageScore,
    totalAnsweredQuestions,
    difficultyMix,
  });
  const { tier: gatedTier } = tierForScoreGated(irs, sessions.length);

  return { irs, averageScore, tierLabel: gatedTier.label };
};

const getAnalytics = async (req, res) => {
  try {
    const userId = getUserId(req);

    const sessions = await Session.find({
      $or: [
        { user: userId },
        { userId: userId },
      ],
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
        timePerformance: {
          averageTimePerQuestion: 0,
          totalTime: 0,
        },
        irs: 0,
        currentTier: null,
        tiers: [],
        dimensionProfile: [],
        unmappedTopics: [],
      });
    }

    const scores = sessions.map(
      session =>
        getNormalizedSessionScore(
          session
        )
    );

    const totalSessions =
      sessions.length;

    const averageScore = Math.round(
      scores.reduce(
        (sum, score) =>
          sum + score,
        0
      ) / scores.length
    );

    const highestScore = Math.max(
      ...scores
    );

    const lowestScore = Math.min(
      ...scores
    );

    // Build scoreTrend with per-dimension scores for the Skill Velocity graph.
    // For each session we compute a quick dimension average from its questions —
    // same synonym resolver as buildDimensionProfile, but lightweight (no shrinkage)
    // because this is only used for relative trend lines, not for IRS computation.
    const scoreTrend = sessions.map(session => {
      const sessionScore = getNormalizedSessionScore(session);
      const dimTotals = {};
      (session.questions || []).forEach(q => {
        if (!q.userAnswer || q.userAnswer === 'Skipped') return;
        const canonical = resolveCanonicalTopic(q.topic);
        const dims = CANONICAL_TOPIC_TO_DIMENSIONS[canonical] || [];
        const score = getNormalizedQuestionScore(q);
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
      return {
        date: session.createdAt,
        score: sessionScore,
        mode: session.mode,
        topicScores, // { technical: 72, problemSolving: 65, … } — only dims with data this session
      };
    });

    const allQuestions =
      sessions.flatMap(
        session =>
          session.questions || []
      );

    const answeredQuestions =
      allQuestions.filter(
        question =>
          question.userAnswer &&
          question.userAnswer !==
            'Skipped'
      );

    const topicMap = {};

    answeredQuestions.forEach(
      question => {
        const topic =
          question.topic ||
          'General';

        const score =
          getNormalizedQuestionScore(
            question
          );

        if (!topicMap[topic]) {
          topicMap[topic] = {
            topic,
            totalScore: 0,
            count: 0,
          };
        }

        topicMap[
          topic
        ].totalScore += score;

        topicMap[
          topic
        ].count += 1;
      }
    );

    const topicPerformance =
      Object.values(topicMap)
        .map(item => ({
          topic: item.topic,

          averageScore:
            Math.round(
              item.totalScore /
                item.count
            ),

          attempts: item.count,
        }))
        .sort(
          (a, b) =>
            b.averageScore -
            a.averageScore
        );

    const weakTopics =
      topicPerformance
        .filter(
          topic =>
            topic.averageScore < 70
        )
        .sort(
          (a, b) =>
            a.averageScore -
            b.averageScore
        )
        .slice(0, 3)
        .map(topic =>
          topic.topic
        );

    const totalTime =
      answeredQuestions.reduce(
        (sum, question) =>
          sum +
          Number(
            question.timeTaken ||
              0
          ),
        0
      );

    const averageTimePerQuestion =
      answeredQuestions.length
        ? Math.round(
            totalTime /
              answeredQuestions.length
          )
        : 0;

    // ── IRS + dimension profile — same engine as getPerformanceAnalytics
    const { profile: dimensionProfile, unmapped: unmappedTopics } =
      buildDimensionProfile(topicPerformance);

    const { totalAnsweredQuestions, difficultyMix } = extractIRSEvidence(sessions);

    const irsBreakdown = computeIRSBreakdown({
      dimensionProfile,
      scoreTrend,
      topicPerformance,
      averageScore,
      totalAnsweredQuestions,
      difficultyMix,
    });
    const irs = irsBreakdown.finalScore;

    const currentTierRaw = tierForScore(irs);
    const { tier: currentTierGated, isGated, sessionsNeededForRawTier } =
      tierForScoreGated(irs, sessions.length);

    const dimensionTimeSeries = buildDimensionTimeSeries(sessions);

    const tiers = TIERS.map((tier) => {
      const readiness = computeTierReadiness(dimensionProfile, tier, sessions.length);
      const blocker = findBlockingDimension(readiness);
      const eta = projectSessionsToUnlock(blocker, dimensionTimeSeries);
      return {
        label: tier.label,
        color: tier.color,
        desc: tier.desc,
        advice: tier.advice,
        minIRS: tier.minIRS,
        isCurrentTier: tier.label === currentTierGated.label,
        isUnlocked: irs >= tier.minIRS && sessions.length >= tier.minSessions,
        readinessPct: readiness.readinessPct,
        confidenceGate: readiness.confidenceGate,
        minSessionsRequired: tier.minSessions,
        perDimension: readiness.perDimension,
        blockingDimensions: readiness.blockingDimensions,
        provisionalDimensions: readiness.provisionalDimensions,
        primaryBlocker: blocker
          ? { key: blocker.key, label: blocker.label, userScore: blocker.userScore, requiredMin: blocker.requiredMin, gap: blocker.gap }
          : null,
        eta,
      };
    });

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
      timePerformance: {
        averageTimePerQuestion,
        totalTime,
      },
      irs,
      irsBreakdown,
      currentTier: currentTierGated.label,
      currentTierIsGated: isGated,
      currentTierRaw: currentTierRaw.label,
      sessionsNeededForRawTier,
      totalAnsweredQuestions,
      difficultyMix,
      tiers,
      dimensionProfile,
      unmappedTopics,
    });
  } catch (error) {
    console.error(
      'getAnalytics error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to load analytics.',
    });
  }
};


const getPerformanceAnalytics = async (req, res) => {
  try {
    const userId = getUserId(req);

    const sessions = await Session.find({
      $or: [{ user: userId }, { userId: userId }],
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
        // NEW — always present, even when empty, so the frontend never
        // has to special-case a missing field
        irs: 0,
        currentTier: null,
        tiers: [],
        dimensionProfile: [],
        unmappedTopics: [],
      });
    }

    const scores = sessions.map((session) => getNormalizedSessionScore(session));

    const averageScore = Math.round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    );

    const bestScore = Math.max(...scores);

    // chronological (oldest -> newest) for trend/slope/badge logic
    const chronological = [...sessions].reverse();

    const scoreTrend = chronological.map((session, index) => ({
      interview: index + 1,
      score: getNormalizedSessionScore(session),
      date: session.createdAt,
    }));

    // ── topicPerformance (unchanged from before — raw topic strings,
    //    exactly as stored) ──────────────────────────────────────────
    const topicStats = {};

    sessions.forEach((session) => {
      (session.questions || []).forEach((question) => {
        if (!question.userAnswer || question.userAnswer === 'Skipped') return;

        const topic = question.topic || 'General';
        const score = getNormalizedQuestionScore(question);

        if (!topicStats[topic]) {
          topicStats[topic] = { topic, totalScore: 0, count: 0 };
        }

        topicStats[topic].totalScore += score;
        topicStats[topic].count += 1;
      });
    });

    const topicPerformance = Object.values(topicStats)
      .map((item) => ({
        topic: item.topic,
        averageScore: Math.round(item.totalScore / item.count),
        attempts: item.count,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    const weakTopics = topicPerformance
      .filter((topic) => topic.averageScore < 70)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 3)
      .map((topic) => topic.topic);

    // ── NEW: real dimension profile, IRS, tier readiness ──────────────
    const { profile: dimensionProfile, unmapped: unmappedTopics } =
      buildDimensionProfile(topicPerformance);

    const { totalAnsweredQuestions, difficultyMix } = extractIRSEvidence(chronological);

    const irsBreakdown = computeIRSBreakdown({
      dimensionProfile,
      scoreTrend,
      topicPerformance,
      averageScore,
      totalAnsweredQuestions,
      difficultyMix,
    });
    const irs = irsBreakdown.finalScore;

    // currentTierRaw = pure IRS-math tier (for "points to next band" math).
    // currentTierGated = what should be SHOWN as "you're eligible for X" —
    // requires enough logged sessions to back the claim, not just the number.
    const currentTierRaw = tierForScore(irs);
    const { tier: currentTierGated, isGated, sessionsNeededForRawTier } =
      tierForScoreGated(irs, sessions.length);

    // per-dimension time series, needed for honest ETA projection —
    // built from raw sessions (questions[].topic/score/skipped), not
    // from the lifetime topicPerformance averages above
    const dimensionTimeSeries = buildDimensionTimeSeries(chronological);

    // compute readiness against ALL 4 tiers at once (not just "next tier") —
    // this is the "how far to every milestone" view, cheap to compute since
    // it's the same function looped
    const tiers = TIERS.map((tier) => {
      const readiness = computeTierReadiness(dimensionProfile, tier, sessions.length);
      const blocker = findBlockingDimension(readiness);
      const eta = projectSessionsToUnlock(blocker, dimensionTimeSeries);

      return {
        label: tier.label,
        color: tier.color,
        desc: tier.desc,
        advice: tier.advice,
        minIRS: tier.minIRS,
        isCurrentTier: tier.label === currentTierRaw.label,
        isUnlocked: irs >= tier.minIRS,
        readinessPct: readiness.readinessPct,
        confidenceGate: readiness.confidenceGate,
        minSessionsRequired: tier.minSessions,
        perDimension: readiness.perDimension,
        blockingDimensions: readiness.blockingDimensions,
        provisionalDimensions: readiness.provisionalDimensions,
        primaryBlocker: blocker
          ? { key: blocker.key, label: blocker.label, userScore: blocker.userScore, requiredMin: blocker.requiredMin, gap: blocker.gap }
          : null,
        eta, // { estimable, sessionsNeeded, slope, gap, dimension } OR { estimable:false, reason }
      };
    });

    // ── badges (unchanged) ──────────────────────────────────────────
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

      // NEW fields — additive, nothing above this line changed shape
      irs,
      irsBreakdown,
      // currentTier is now the EVIDENCE-GATED tier — this is the field the
      // dashboard shows as "you're eligible for X", so it can no longer
      // claim a package tier without enough logged sessions to back it.
      currentTier: currentTierGated.label,
      currentTierIsGated: isGated, // true if the raw IRS math actually points higher
      currentTierRaw: currentTierRaw.label, // for transparency / "on track for" messaging
      sessionsNeededForRawTier, // how many more sessions to unlock currentTierRaw's claim
      totalAnsweredQuestions,
      difficultyMix,
      tiers,
      dimensionProfile,
      unmappedTopics, // watch this in logs/response — non-empty means new topic drift appeared
    });
  } catch (error) {
    console.error('getPerformanceAnalytics error:', error);

    return res.status(500).json({
      error: 'Failed to load performance analytics.',
    });
  }
};

const getAICoach = async (req, res) => {
  try {
    const userId = getUserId(req);

    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const sessions = await Session.find({
      $or: [{ user: userId }, { userId: userId }],
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const scores = sessions.map((session) => getNormalizedSessionScore(session));

    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;

    const bestScore = scores.length ? Math.max(...scores) : 0;

    const topicStats = {};

    sessions.forEach((session) => {
      (session.questions || []).forEach((question) => {
        if (!question.userAnswer || question.userAnswer === 'Skipped') return;

        const topic = question.topic || 'General';
        const score = getNormalizedQuestionScore(question);

        if (!topicStats[topic]) {
          topicStats[topic] = { topic, totalScore: 0, count: 0 };
        }

        topicStats[topic].totalScore += score;
        topicStats[topic].count += 1;
      });
    });

    const topicPerformance = Object.values(topicStats)
      .map((item) => ({
        topic: item.topic,
        averageScore: Math.round(item.totalScore / item.count),
        attempts: item.count,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    const weakest = topicPerformance
      .slice()
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 3)
      .map((item) => item.topic);

    const strongest = topicPerformance[0]?.topic || 'N/A';

    // ── NEW: real IRS + tier readiness, same engine getPerformanceAnalytics uses.
    //    This is what fixes the "coach disagrees with the dashboard" bug —
    //    the LLM now reasons over the SAME numbers the user sees on screen,
    //    not raw topic averages it has to guess a verdict from. ─────────────
    const chronological = [...sessions].reverse();

    const { profile: dimensionProfile } = buildDimensionProfile(topicPerformance);

    const scoreTrend = chronological.map((session, index) => ({
      interview: index + 1,
      score: getNormalizedSessionScore(session),
      date: session.createdAt,
    }));

    const { totalAnsweredQuestions, difficultyMix } = extractIRSEvidence(chronological);

    const irs = computeIRS({
      dimensionProfile,
      scoreTrend,
      topicPerformance,
      averageScore,
      totalAnsweredQuestions,
      difficultyMix,
    });
    const { tier: currentTier } = tierForScoreGated(irs, sessions.length);
    const nextTier = TIERS[TIERS.indexOf(currentTier) + 1] || null;

    const dimensionTimeSeries = buildDimensionTimeSeries(chronological);
    const nextTierReadiness = nextTier
      ? computeTierReadiness(dimensionProfile, nextTier, sessions.length)
      : null;
    const blocker = nextTierReadiness ? findBlockingDimension(nextTierReadiness) : null;
    const eta = blocker ? projectSessionsToUnlock(blocker, dimensionTimeSeries) : null;

    const { generateCoachAdvice } = require('../services/aiServices');

    const analysis = await generateCoachAdvice({
      profile: {
        college: user.college,
        branch: user.branch,
        semester: user.semester,
      },
      totalSessions: sessions.length,
      averageScore,
      bestScore,
      streak: Number(user.streak?.current || 0),
      weakest,
      strongest,
      topicPerformance,

      // NEW — the coach now gets the real, authoritative readiness picture
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


// ── GET /interview/session/last/breakdown — Phase 1B ──────────────────────
// Returns per-question breakdown for the user's most recent completed session.
// Data used: timeTaken, score, skipped, topic, text (truncated).
// No new DB fields needed — all data is in the existing Session model.
const getLastSessionBreakdown = async (req, res) => {
  try {
    const userId = getUserId(req);
    const session = await Session.findOne({
      $or: [{ user: userId }, { userId }],
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!session) {
      return res.status(404).json({ message: 'No completed sessions found.' });
    }

    const questions = (session.questions || []).map((q, idx) => ({
      index:     idx + 1,
      topic:     q.topic || 'General',
      text:      q.text ? q.text.slice(0, 120) + (q.text.length > 120 ? '…' : '') : '',
      score:     getNormalizedQuestionScore(q),
      timeTaken: Number(q.timeTaken) || 0,
      skipped:   Boolean(q.skipped) || !q.userAnswer,
      difficulty: q.difficulty || 'medium',
    }));

    const answered      = questions.filter(q => !q.skipped);
    const avgTime       = answered.length ? Math.round(answered.reduce((a, q) => a + q.timeTaken, 0) / answered.length) : 0;
    const skipRate      = questions.length ? Math.round((questions.filter(q => q.skipped).length / questions.length) * 100) : 0;
    const sessionScore  = getNormalizedSessionScore(session);

    return res.json({
      sessionId:   session._id,
      sessionDate: session.createdAt,
      sessionMode: session.mode,
      sessionScore,
      avgTimeTaken: avgTime,
      skipRate,
      totalQuestions: questions.length,
      questions,
    });
  } catch (err) {
    console.error('getLastSessionBreakdown error:', err);
    return res.status(500).json({ error: 'Failed to load session breakdown.' });
  }
};


// ── GET /interview/blind-spots — Phase 2 ─────────────────────────────────────
// Aggregates weaknesses[] across the last 10 sessions to find topics that
// appear as a weakness in 3+ sessions. Returns sorted by frequency.
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

    if (!sessions.length) {
      return res.json({ blindSpots: [] });
    }

    const freq = {};
    sessions.forEach(s => {
      const seen = new Set(); // only count each topic once per session
      (s.weaknesses || []).forEach(w => {
        const key = w.toLowerCase().trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        freq[key] = (freq[key] || 0) + 1;
      });
    });

    const blindSpots = Object.entries(freq)
      .filter(([, count]) => count >= 2) // threshold: appeared as weakness in 2+ sessions
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


// ── GET /interview/session-warmup — Phase 3 ───────────────────────────────────
// Tags each user's sessions by their position within the same calendar day
// (1st session of the day, 2nd, 3rd+), then computes average score by position.
// Shows whether the student is a "cold start" performer or a "warm up" performer.
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

    // Group sessions by calendar date (local date string)
    const byDate = {};
    sessions.forEach(s => {
      const dateKey = new Date(s.createdAt).toISOString().slice(0, 10);
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(s);
    });

    // Tag each session with its within-day position (1, 2, 3+)
    const positionTotals = { 1: { sum: 0, count: 0 }, 2: { sum: 0, count: 0 }, 3: { sum: 0, count: 0 } };

    Object.values(byDate).forEach(daySessions => {
      daySessions.forEach((s, idx) => {
        const pos = Math.min(idx + 1, 3);
        const score = getNormalizedSessionScore(s);
        positionTotals[pos].sum += score;
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

    const first   = positions.find(p => p.position === 1);
    const second  = positions.find(p => p.position === 2);
    const pattern = (first && second)
      ? (second.avgScore - first.avgScore > 5 ? 'warmup' : second.avgScore - first.avgScore < -5 ? 'coldstart' : 'consistent')
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
  getPerformanceAnalytics,
  getAICoach,
  computeUserIRS,
  getLastSessionBreakdown,
  getBlindSpots,
  getSessionWarmup,
};