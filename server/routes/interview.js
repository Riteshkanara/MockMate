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

router.get('/performance', authMiddleware, interviewController.getPerformance);

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

// Static config metadata for the interview-setup UI (companies, roles,
// experience levels, topic groups) — kept server-side so the frontend
// picker and the AI prompt logic never drift out of sync with each other.
// Public (no authMiddleware): this is static reference data, not
// user-specific, and the setup page may want it before login completes.
router.get(
  '/meta',
  interviewController.getInterviewMeta
);

router.post(
  '/ai-coach',
  authMiddleware,
  interviewController.getAICoach
);


router.post(
  '/ai-freeform',
  authMiddleware,
  interviewController.getAIFreeform
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

// Poll target for the background analysis of an answer (see interviewFlow.js).
router.get(
  '/:sessionId/question/:questionId/feedback',
  authMiddleware,
  interviewController.getQuestionFeedback
);

// Re-evaluate an already-submitted open answer (client: retryQuestion in
// interviewService.js). Was missing → every retry 404'd.
router.post(
  '/:sessionId/retry/:questionId',
  authMiddleware,
  interviewController.retryQuestion
);

router.get(
  '/:sessionId/result',
  authMiddleware,
  interviewController.getInterviewResult
);

router.post(
  '/:sessionId/abandon',
  authMiddleware,
  interviewController.abandonInterview
);

module.exports = router;





