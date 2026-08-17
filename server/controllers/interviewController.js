const Session = require('../models/Session');
const User = require('../models/User');
const { evaluateBadges } = require('../utils/badgeEngine');

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

    const questions = await generateQuestions({
      mode,
      company,
      topic,
      difficulty,
      count,
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
        question.feedback =
          'Question skipped. Try to answer every question when possible.';
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

const getInterviewHistory = async (req, res) => {
  try {
    const userId = getUserId(req);

    const sessions = await Session.find({
      $or: [
        { user: userId },
        { userId: userId },
      ],
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
        user: userId,
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

const getAnalytics = async (req, res) => {
  try {
    const userId = getUserId(req);

    const sessions = await Session.find({
      $or: [
        { user: userId },
        { userId: userId },
      ],
      status: 'completed',
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

    const scoreTrend = sessions.map(
      session => ({
        date: session.createdAt,
        score:
          getNormalizedSessionScore(
            session
          ),
      })
    );

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

    return res.json({
      totalSessions,
      totalInterviews:
        totalSessions,

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
 
      const sessions =
        await Session.find({
          $or: [
            { user: userId },
            { userId: userId },
          ],
          status: 'completed',
        })
          .sort({
            createdAt: -1,
          })
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
        });
      }
 
      const scores = sessions.map(
        session =>
          getNormalizedSessionScore(
            session
          )
      );
 
      const averageScore =
        Math.round(
          scores.reduce(
            (sum, score) =>
              sum + score,
            0
          ) / scores.length
        );
 
      const bestScore =
        Math.max(...scores);
 
      const scoreTrend = [
        ...sessions,
      ]
        .reverse()
        .map(
          (session, index) => ({
            interview:
              index + 1,
 
            score:
              getNormalizedSessionScore(
                session
              ),
 
            date:
              session.createdAt,
          })
        );
 
      const topicStats = {};
 
      sessions.forEach(
        session => {
          (
            session.questions ||
            []
          ).forEach(
            question => {
              if (
                !question.userAnswer ||
                question.userAnswer ===
                  'Skipped'
              ) {
                return;
              }
 
              const topic =
                question.topic ||
                'General';
 
              const score =
                getNormalizedQuestionScore(
                  question
                );
 
              if (
                !topicStats[topic]
              ) {
                topicStats[
                  topic
                ] = {
                  topic,
                  totalScore: 0,
                  count: 0,
                };
              }
 
              topicStats[
                topic
              ].totalScore +=
                score;
 
              topicStats[
                topic
              ].count += 1;
            }
          );
        }
      );
 
      const topicPerformance =
        Object.values(
          topicStats
        )
          .map(item => ({
            topic: item.topic,
 
            averageScore:
              Math.round(
                item.totalScore /
                  item.count
              ),
 
            attempts:
              item.count,
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
              topic.averageScore <
              70
          )
          .sort(
            (a, b) =>
              a.averageScore -
              b.averageScore
          )
          .slice(0, 3)
          .map(
            topic =>
              topic.topic
          );
 
      // ── NEW: compute badges from real session history ──────────────
      const user = await User.findById(userId).lean();
      const chronological = [...sessions].reverse();
      const badges = evaluateBadges({ user, sessions: chronological });
      // ─────────────────────────────────────────────────────────────
 
      return res.json({
        totalInterviews:
          sessions.length,
 
        totalSessions:
          sessions.length,
 
        averageScore,
 
        bestScore,
 
        scoreTrend,
 
        topicPerformance,
 
        weakTopics,
 
        badges,
      });
    } catch (error) {
      console.error(
        'getPerformanceAnalytics error:',
        error
      );
 
      return res.status(500).json({
        error:
          'Failed to load performance analytics.',
      });
    }
  };
 
const getAICoach = async (req, res) => {
    try {
      const userId = getUserId(req);

      const user =
        await User.findById(userId).lean();

      if (!user) {
        return res.status(404).json({
          error: 'User not found.',
        });
      }

      const sessions =
        await Session.find({
          $or: [
            { user: userId },
            { userId: userId },
          ],
          status: 'completed',
        })
          .sort({
            createdAt: -1,
          })
          .limit(30)
          .lean();

      const scores = sessions.map(
        session =>
          getNormalizedSessionScore(
            session
          )
      );

      const averageScore =
        scores.length
          ? Math.round(
              scores.reduce(
                (sum, score) =>
                  sum + score,
                0
              ) / scores.length
            )
          : 0;

      const bestScore =
        scores.length
          ? Math.max(...scores)
          : 0;

      const topicStats = {};

      sessions.forEach(
        session => {
          (
            session.questions ||
            []
          ).forEach(
            question => {
              if (
                !question.userAnswer ||
                question.userAnswer ===
                  'Skipped'
              ) {
                return;
              }

              const topic =
                question.topic ||
                'General';

              const score =
                getNormalizedQuestionScore(
                  question
                );

              if (
                !topicStats[topic]
              ) {
                topicStats[
                  topic
                ] = {
                  topic,
                  totalScore: 0,
                  count: 0,
                };
              }

              topicStats[
                topic
              ].totalScore +=
                score;

              topicStats[
                topic
              ].count += 1;
            }
          );
        }
      );

      const topicPerformance =
        Object.values(
          topicStats
        )
          .map(item => ({
            topic: item.topic,

            averageScore:
              Math.round(
                item.totalScore /
                  item.count
              ),

            attempts:
              item.count,
          }))
          .sort(
            (a, b) =>
              b.averageScore -
              a.averageScore
          );

      const weakest =
        topicPerformance
          .slice()
          .sort(
            (a, b) =>
              a.averageScore -
              b.averageScore
          )
          .slice(0, 3)
          .map(
            item => item.topic
          );

      const strongest =
        topicPerformance[0]
          ?.topic || 'N/A';

      const {
        generateCoachAdvice,
      } = require('../services/aiServices');

      const analysis =
        await generateCoachAdvice({
          profile: {
            college:
              user.college,
            branch:
              user.branch,
            semester:
              user.semester,
          },

          totalSessions:
            sessions.length,

          averageScore,

          bestScore,

          streak:
            Number(
              user.streak?.current || 0
            ),

          weakest,

          strongest,

          topicPerformance,
        });

      return res.json({
        analysis,
      });
    } catch (error) {
      console.error(
        'getAICoach error:',
        error
      );

      return res.status(500).json({
        error:
          'AI coach unavailable.',
      });
    }
  };

module.exports = {
  startInterview,
  getInterviewSession,
  answerQuestion,
  completeInterview,
  getInterviewHistory,
  getInterviewResult,
  abandonInterview,
  getBadges,
  getAnalytics,
  getPerformanceAnalytics,
  getAICoach,
};