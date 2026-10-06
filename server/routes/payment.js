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

const crypto         = require('crypto');
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
const { setDemoPlan } = require('../controllers/demoController');

// Admin-only guard. Fails CLOSED: with no ADMIN_SECRET configured, nobody can call it.
// (Before this, any logged-in user could POST /payment/refund.)
const requireAdminSecret = (req, res, next) => {
  const secret = process.env.ADMIN_SECRET;
  const given  = String(req.headers['x-admin-secret'] || '');
  const ok = Boolean(secret) && given.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return res.status(403).json({ error: 'Forbidden.' });
  return next();
};

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
router.post('/refund',            authMiddleware, requireAdminSecret, processRefund);
router.post('/expiry-downgrade',  expiredUsersDowngrade);                 // protected by CRON_SECRET internally

// ── Demo switch (viva only). 404s unless DEMO_PLAN_SWITCH=true. ────────────
router.post('/demo-plan', authMiddleware, setDemoPlan);

module.exports = router;