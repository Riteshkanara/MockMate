const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const interviewController = require('../controllers/interviewController');
const { requirePro } = require('../middleware/planMiddleware');

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

router.get('/usage', authMiddleware, interviewController.getUsage);

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

// Pro-only analytics (server-enforced; the client also shows a designed lock)
router.get(
  '/blind-spots',
  authMiddleware,
  requirePro('blindSpots'),
  interviewController.getBlindSpots
);

router.get(
  '/session-warmup',
  authMiddleware,
  requirePro('sessionWarmup'),
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

// AI Coach + free-form AI both spend real Gemini quota, so they are Pro-only.
// (ai-freeform powers the Coach chat, War Room and Coach insights — all Pro surfaces.)
router.post(
  '/ai-coach',
  authMiddleware,
  requirePro('aiCoach'),
  interviewController.getAICoach
);


router.post(
  '/ai-freeform',
  authMiddleware,
  requirePro('aiCoach'),
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

// Re-evaluate one answer. Plan check lives in the controller because it has one
// exception (our own evaluator failing must stay free to retry).
router.post(
  '/:sessionId/retry/:questionId',
  authMiddleware,
  interviewController.retryQuestion
);

router.post(
  '/:sessionId/abandon',
  authMiddleware,
  interviewController.abandonInterview
);

module.exports = router;





