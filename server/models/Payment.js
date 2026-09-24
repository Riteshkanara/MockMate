const mongoose = require('mongoose');

/**
 * MockMate — Payment record (enhanced)
 *
 * New vs v1:
 *  - status enum includes 'refunded'
 *  - refundId field to trace back to Razorpay
 *  - paymentMethod field captured from webhook (upi / card / netbanking / wallet)
 *  - upiVpa field — the VPA used if payment method was UPI (useful for support)
 */
const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    planKey: {
      type: String,
      required: true,
      enum: ['pro_monthly', 'pro_3months', 'pro_yearly'],
    },

    amount:   { type: Number, required: true },   // paise
    currency: { type: String, required: true, default: 'INR' },

    razorpayOrderId:   { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true, index: true },
    razorpaySignature: { type: String },
    razorpayRefundId:  { type: String },          // NEW — set on refund

    status: {
      type: String,
      required: true,
      default: 'created',
      enum: ['created', 'paid', 'failed', 'refunded'],  // 'refunded' is new
    },

    confirmedVia:  { type: String, enum: ['verify', 'webhook'] },
    failureReason: { type: String },

    // NEW — payment method info captured from webhook payload
    paymentMethod: {
      type: String,
      enum: ['upi', 'card', 'netbanking', 'wallet', 'unknown'],
      default: 'unknown',
    },
    upiVpa: { type: String },   // e.g. "user@okhdfcbank" — only set for UPI
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);