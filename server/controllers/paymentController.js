/**
 * MockMate — Payment Controller (enhanced)
 *
 * Flow:
 *   1. POST /payment/create-order  → creates Razorpay order + local Payment record
 *   2. Client opens Razorpay checkout (UPI, card, netbanking, wallets)
 *   3. On success client sends: POST /payment/verify with payment_id + signature
 *   4. POST /payment/webhook       → Razorpay async confirmation (belt-and-suspenders)
 *   5. GET  /payment/status        → frontend plan check
 *   6. GET  /payment/history       → billing history UI
 *   7. POST /payment/cancel        → mark a created-but-abandoned order as failed
 *   8. POST /payment/refund        → admin-initiated refund via Razorpay API
 *   9. GET  /payment/expiry-check  → called by a cron/scheduler to downgrade expired users
 *
 * New vs v1:
 *  - cancelOrder() — lets the frontend mark a created order as failed on dismiss
 *  - processRefund() — admin route: triggers a Razorpay refund + sets user back to free
 *  - expiredUsersDowngrade() — cron target: finds expired pro users and writes plan='free'
 *  - webhook handles payment.failed event in addition to payment.captured
 *  - createOrder attaches planLabel + expiry preview in response for UI feedback
 *  - applyPlanUpgrade emits a structured log line for Logtail/Datadog
 *
 * Env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 */

const crypto  = require('crypto');
const User    = require('../models/User');
const Payment = require('../models/Payment');

// ── Razorpay instance (lazy) ─────────────────────────────────────────────
let _razorpay = null;
const getRazorpay = () => {
  if (!_razorpay) {
    const Razorpay = require('razorpay');
    _razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
};

// ── Pricing (amount in paise — 1 INR = 100 paise) ─────────────────────────
const PLAN_PRICING = {
  pro_monthly: { amount: 19900,  durationDays: 30,  label: 'Pro — 1 Month'  },
  pro_3months: { amount: 49900,  durationDays: 90,  label: 'Pro — 3 Months' },
  pro_yearly:  { amount: 149900, durationDays: 365, label: 'Pro — 1 Year'   },
};

const getUserId = (req) => req.user?._id || req.user?.id;

// ── Helpers ──────────────────────────────────────────────────────────────

/** Extend from existing expiry if still active, otherwise from now. */
const computeNewExpiry = (user, durationDays) => {
  const now  = new Date();
  const base = user.planExpiry && new Date(user.planExpiry) > now
    ? new Date(user.planExpiry)
    : now;
  const newExpiry = new Date(base);
  newExpiry.setDate(newExpiry.getDate() + durationDays);
  return newExpiry;
};

/** HMAC-SHA256 checkout signature verification. */
const isValidCheckoutSignature = (orderId, paymentId, signature) => {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch { return false; }
};

/** Apply Pro upgrade to a user. Returns { user, newExpiry, planData } or null. */
const applyPlanUpgrade = async (userId, planKey) => {
  const planData = PLAN_PRICING[planKey];
  const user     = await User.findById(userId);
  if (!user) return null;

  const newExpiry = computeNewExpiry(user, planData.durationDays);
  user.plan       = 'pro';
  user.planExpiry = newExpiry;
  await user.save();

  // Structured log — pipe to Logtail / Datadog / CloudWatch
  console.log(JSON.stringify({
    event:   'plan_upgraded',
    userId:  String(userId),
    planKey,
    expiry:  newExpiry.toISOString(),
    amount:  planData.amount,
  }));

  return { user, newExpiry, planData };
};

// ── Controllers ──────────────────────────────────────────────────────────

/**
 * POST /payment/create-order
 * Body: { planKey }
 */
const createOrder = async (req, res) => {
  try {
    const userId  = getUserId(req);
    const planKey = req.body?.planKey;

    if (typeof planKey !== 'string' || !PLAN_PRICING[planKey]) {
      return res.status(400).json({
        error: 'Invalid plan selected.',
        validPlans: Object.keys(PLAN_PRICING),
      });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('[payment] Razorpay keys not configured.');
      return res.status(503).json({ error: 'Payments are temporarily unavailable. Try again shortly.' });
    }

    const planData  = PLAN_PRICING[planKey];
    const receipt   = `mm_${userId}_${Date.now()}`;

    const order = await getRazorpay().orders.create({
      amount:   planData.amount,
      currency: 'INR',
      receipt,
      notes:    { userId: String(userId), planKey },
    });

    await Payment.create({
      user:            userId,
      planKey,
      amount:          planData.amount,
      currency:        'INR',
      razorpayOrderId: order.id,
      status:          'created',
    });

    // Compute what the new expiry will be (for UI preview — "Pro until Jan 2027")
    const user      = await User.findById(userId).select('plan planExpiry').lean();
    const newExpiry = computeNewExpiry(user || {}, planData.durationDays);

    return res.json({
      orderId:          order.id,
      amount:           order.amount,
      currency:         order.currency,
      keyId:            process.env.RAZORPAY_KEY_ID,
      planKey,
      planLabel:        planData.label,
      previewExpiry:    newExpiry.toISOString(),  // show "Pro until <date>" in modal
    });
  } catch (err) {
    console.error('[payment] createOrder error:', err);
    return res.status(500).json({ error: 'Could not create payment order. Please try again.' });
  }
};

/**
 * POST /payment/verify
 * Body: { orderId, paymentId, signature, planKey }
 */
const verifyPayment = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { orderId, paymentId, signature, planKey } = req.body || {};

    if (!orderId || !paymentId || !signature || !planKey || !PLAN_PRICING[planKey]) {
      return res.status(400).json({ error: 'Missing or invalid payment fields.' });
    }

    if (!isValidCheckoutSignature(orderId, paymentId, signature)) {
      return res.status(400).json({
        error: 'Payment verification failed. If money was deducted, contact support.',
      });
    }

    const payment = await Payment.findOne({ razorpayOrderId: orderId, user: userId });
    if (!payment) {
      return res.status(404).json({ error: 'Order not found for this account.' });
    }

    if (payment.status === 'paid') {
      const user = await User.findById(userId).select('plan planExpiry').lean();
      return res.json({ success: true, plan: user?.plan, planExpiry: user?.planExpiry, alreadyApplied: true });
    }

    const result = await applyPlanUpgrade(userId, planKey);
    if (!result) return res.status(404).json({ error: 'User not found.' });

    payment.razorpayPaymentId = paymentId;
    payment.razorpaySignature = signature;
    payment.status            = 'paid';
    payment.confirmedVia      = 'verify';
    await payment.save();

    return res.json({
      success:    true,
      plan:       'pro',
      planExpiry: result.newExpiry,
      planLabel:  result.planData.label,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const user = await User.findById(getUserId(req)).select('plan planExpiry').lean();
      return res.json({ success: true, plan: user?.plan, planExpiry: user?.planExpiry, alreadyApplied: true });
    }
    console.error('[payment] verifyPayment error:', err);
    return res.status(500).json({ error: 'Payment verification error. Contact support if you were charged.' });
  }
};

/**
 * POST /payment/cancel
 * Body: { orderId }
 * Marks a created-but-abandoned order as failed so billing history stays clean.
 * Called by the frontend when the user dismisses the Razorpay modal.
 */
const cancelOrder = async (req, res) => {
  try {
    const userId  = getUserId(req);
    const { orderId } = req.body || {};

    if (!orderId) return res.status(400).json({ error: 'orderId required.' });

    const payment = await Payment.findOne({ razorpayOrderId: orderId, user: userId });
    if (!payment) return res.status(404).json({ error: 'Order not found.' });

    // Don't overwrite a paid order
    if (payment.status === 'paid') {
      return res.json({ ok: true, status: 'paid' });
    }

    payment.status        = 'failed';
    payment.failureReason = 'dismissed_by_user';
    await payment.save();

    return res.json({ ok: true, status: 'failed' });
  } catch (err) {
    console.error('[payment] cancelOrder error:', err);
    return res.status(500).json({ error: 'Could not cancel order.' });
  }
};

/**
 * POST /payment/refund
 * Body: { paymentId, amount? }      (amount in paise; omit for full refund)
 * Admin-only route — protect with an admin check in the router.
 *
 * Initiates a Razorpay refund, then sets the user back to free if it's a
 * full refund.
 */
const processRefund = async (req, res) => {
  try {
    const { paymentId, amount } = req.body || {};

    if (!paymentId) return res.status(400).json({ error: 'paymentId required.' });

    const payment = await Payment.findOne({ razorpayPaymentId: paymentId });
    if (!payment) return res.status(404).json({ error: 'Payment record not found.' });
    if (payment.status !== 'paid') return res.status(400).json({ error: 'Payment is not in paid state.' });

    const refundAmount = amount || payment.amount;

    // Trigger Razorpay refund
    const refund = await getRazorpay().payments.refund(paymentId, {
      amount: refundAmount,
      speed:  'normal',       // 'optimum' for instant refunds (costs extra)
      notes:  { reason: 'admin_refund', orderId: payment.razorpayOrderId },
    });

    // If it's a full refund, downgrade user to free
    const isFullRefund = refundAmount >= payment.amount;
    if (isFullRefund) {
      await User.findByIdAndUpdate(payment.user, {
        plan:       'free',
        planExpiry: null,
      });
    }

    payment.status        = 'refunded';
    payment.failureReason = `refund:${refund.id}`;
    await payment.save();

    console.log(JSON.stringify({
      event:       'refund_processed',
      userId:      String(payment.user),
      paymentId,
      refundId:    refund.id,
      refundAmount,
      fullRefund:  isFullRefund,
    }));

    return res.json({
      ok:          true,
      refundId:    refund.id,
      amount:      refund.amount,
      fullRefund:  isFullRefund,
    });
  } catch (err) {
    console.error('[payment] processRefund error:', err);
    return res.status(500).json({ error: 'Refund failed. Check Razorpay dashboard.' });
  }
};

/**
 * POST /payment/webhook
 * Handles: payment.captured, payment.failed
 * No auth — protected by HMAC only.
 */
const handleWebhook = async (req, res) => {
  try {
    const receivedSig = req.headers['x-razorpay-signature'];
    const secret       = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error('[webhook] RAZORPAY_WEBHOOK_SECRET not configured.');
      return res.status(500).json({ error: 'Webhook not configured.' });
    }
    if (!receivedSig) return res.status(400).json({ error: 'Missing signature.' });

    const expectedSig = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    const validSig    =
      receivedSig.length === expectedSig.length &&
      crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig));

    if (!validSig) {
      console.warn('[webhook] signature mismatch — rejected');
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }

    const event = JSON.parse(req.body.toString('utf8'));

    // ── payment.captured ────────────────────────────────────────────────
    if (event.event === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      const userId  = paymentEntity?.notes?.userId;
      const planKey = paymentEntity?.notes?.planKey;
      const orderId = paymentEntity?.order_id;

      if (!userId || !planKey || !PLAN_PRICING[planKey] || !orderId) {
        console.warn('[webhook] payment.captured — missing notes, acking without action');
        return res.status(200).json({ ok: true });
      }

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (!payment || payment.status === 'paid') return res.status(200).json({ ok: true });

      const result = await applyPlanUpgrade(userId, planKey);
      if (!result) return res.status(200).json({ ok: true });

      payment.razorpayPaymentId = paymentEntity.id;
      payment.status            = 'paid';
      payment.confirmedVia      = 'webhook';
      await payment.save();
    }

    // ── payment.failed ──────────────────────────────────────────────────
    if (event.event === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId       = paymentEntity?.order_id;
      const errorDesc     = paymentEntity?.error_description || 'unknown';

      if (orderId) {
        await Payment.findOneAndUpdate(
          { razorpayOrderId: orderId, status: 'created' },
          { status: 'failed', failureReason: errorDesc }
        );
        console.log(JSON.stringify({
          event: 'payment_failed_webhook',
          orderId,
          reason: errorDesc,
        }));
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err?.code === 11000) return res.status(200).json({ ok: true });
    console.error('[webhook] error:', err);
    return res.status(200).json({ ok: true }); // always 200 to stop Razorpay retries
  }
};

/**
 * GET /payment/status
 */
const getPaymentStatus = async (req, res) => {
  try {
    const userId = getUserId(req);
    const user   = await User.findById(userId).select('plan planExpiry').lean();

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const now       = new Date();
    const isExpired = (user.plan === 'pro' || user.plan === 'college')
      && user.planExpiry
      && new Date(user.planExpiry) < now;

    const effectivePlan = isExpired ? 'free' : (user.plan || 'free');

    // Warn frontend if plan expires within 7 days (to show renewal nudge)
    const expiresInDays = user.planExpiry
      ? Math.ceil((new Date(user.planExpiry) - now) / (1000 * 60 * 60 * 24))
      : null;

    return res.json({
      plan:           effectivePlan,
      planExpiry:     user.planExpiry || null,
      isExpired:      Boolean(isExpired),
      isPro:          effectivePlan === 'pro' || effectivePlan === 'college',
      expiresInDays:  expiresInDays !== null && expiresInDays > 0 ? expiresInDays : null,
      renewalNudge:   expiresInDays !== null && expiresInDays <= 7 && expiresInDays > 0,
    });
  } catch (err) {
    console.error('[payment] getPaymentStatus error:', err);
    return res.status(500).json({ error: 'Failed to fetch payment status.' });
  }
};

/**
 * GET /payment/history
 */
const getPaymentHistory = async (req, res) => {
  try {
    const userId = getUserId(req);
    const payments = await Payment.find({ user: userId, status: { $in: ['paid', 'refunded'] } })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('planKey amount currency status confirmedVia createdAt failureReason')
      .lean();

    return res.json({ payments });
  } catch (err) {
    console.error('[payment] getPaymentHistory error:', err);
    return res.status(500).json({ error: 'Failed to load payment history.' });
  }
};

/**
 * POST /payment/expiry-downgrade
 * Hit this with a cron job (e.g. Render Cron, GitHub Actions, node-cron)
 * once per day. Writes plan='free' for every user whose planExpiry has passed.
 *
 * Protect this with CRON_SECRET so it can't be called by random users:
 *   router.post('/expiry-downgrade', requireCronSecret, expiredUsersDowngrade);
 */
const expiredUsersDowngrade = async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers['x-cron-secret'] !== secret) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const now = new Date();
    const result = await User.updateMany(
      {
        plan:       { $in: ['pro', 'college'] },
        planExpiry: { $lt: now },
      },
      {
        $set: { plan: 'free', planExpiry: null },
      }
    );

    console.log(JSON.stringify({
      event:    'expiry_downgrade_run',
      matched:  result.matchedCount,
      modified: result.modifiedCount,
      runAt:    now.toISOString(),
    }));

    return res.json({
      ok:       true,
      matched:  result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (err) {
    console.error('[payment] expiredUsersDowngrade error:', err);
    return res.status(500).json({ error: 'Downgrade job failed.' });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  cancelOrder,
  processRefund,
  handleWebhook,
  getPaymentStatus,
  getPaymentHistory,
  expiredUsersDowngrade,
  PLAN_PRICING,
};