const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const interviewController = require('../controllers/interviewController');

// --------------------------------------------------
// START
// --------------------------------------------------

router.post(
  '/start',
  authMiddleware,
  interviewController.startInterview
);

// --------------------------------------------------
// STATIC ROUTES FIRST
// --------------------------------------------------

router.get(
  '/history',
  authMiddleware,
  interviewController.getInterviewHistory
);

router.get(
  '/badges',
  authMiddleware,
  interviewController.getBadges
);
router.get(
  '/analytics',
  authMiddleware,
  interviewController.getAnalytics
);

router.get(
  '/performance',
  authMiddleware,
  interviewController.getPerformanceAnalytics
);

router.get(
  '/session/last/breakdown',
  authMiddleware,
  interviewController.getLastSessionBreakdown
);

router.get(
  '/blind-spots',
  authMiddleware,
  interviewController.getBlindSpots
);

router.get(
  '/session-warmup',
  authMiddleware,
  interviewController.getSessionWarmup
);

router.post(
  '/ai-coach',
  authMiddleware,
  interviewController.getAICoach
);


router.get(
  '/:sessionId',
  authMiddleware,
  interviewController.getInterviewSession
);

router.post(
  '/:sessionId/answer',
  authMiddleware,
  interviewController.answerQuestion
);

router.post(
  '/:sessionId/complete',
  authMiddleware,
  interviewController.completeInterview
);

router.get(
  '/:sessionId/result',
  authMiddleware,
  interviewController.getInterviewResult
);

router.post(
  '/:sessionId/abandon',
  interviewController.abandonInterview
);

module.exports = router;