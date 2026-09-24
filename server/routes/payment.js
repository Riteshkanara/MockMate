/**
 * MockMate — Payment Routes (enhanced)
 *
 * New vs v1:
 *  - POST /cancel      — marks abandoned orders as failed
 *  - POST /refund      — admin-only refund trigger
 *  - POST /expiry-downgrade — cron target (daily plan expiry cleanup)
 *
 * IMPORTANT: mount this BEFORE express.json() in server/index.js so that
 * /webhook can read Razorpay's raw signed bytes via express.raw().
 */

const express        = require('express');
const router         = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  createOrder,
  verifyPayment,
  cancelOrder,
  processRefund,
  handleWebhook,
  getPaymentStatus,
  getPaymentHistory,
  expiredUsersDowngrade,
} = require('../controllers/paymentController');

// ── Webhook — NO auth, raw body for HMAC verification ────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// ── Authenticated user routes ─────────────────────────────────────────────
router.post('/create-order', authMiddleware, createOrder);
router.post('/verify',       authMiddleware, verifyPayment);
router.post('/cancel',       authMiddleware, cancelOrder);      // NEW
router.get ('/status',       authMiddleware, getPaymentStatus);
router.get ('/history',      authMiddleware, getPaymentHistory);

// ── Admin / cron routes ───────────────────────────────────────────────────
// processRefund: add your own admin check middleware before shipping to prod.
// expiredUsersDowngrade: call daily from a cron job with x-cron-secret header.
router.post('/refund',            authMiddleware, processRefund);         // TODO: add requireAdmin
router.post('/expiry-downgrade',  expiredUsersDowngrade);                 // protected by CRON_SECRET internally

module.exports = router;