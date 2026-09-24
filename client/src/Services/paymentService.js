/**
 * MockMate — Payment Service (enhanced)
 *
 * Improvements over v1:
 *  • Explicit payment method config: UPI, cards, netbanking, wallets — all enabled
 *  • UPI-first ordering so Indian users see GPay/PhonePe/BHIM at the top
 *  • Retry logic: if the Razorpay script fails to load, retries once after 2s
 *  • cancelPayment() helper to mark a local order as failed
 *  • getPaymentHistory() exposed as a named export
 *  • Timeout on createOrder (10s) so a hung server doesn't block checkout indefinitely
 */

import API_BASE from '../config/api.js';
import { authFetch } from '../context/AuthContext';

const PAYMENT_BASE = `${API_BASE}/payment`;

// ── Fetch wrapper ────────────────────────────────────────────────────────
const parseJsonSafely = async (res) => {
  try { return await res.json(); } catch { return null; }
};

const paymentFetch = async (path, options = {}, timeoutMs = 10_000) => {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await authFetch(`${PAYMENT_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(tid);

    const data = await parseJsonSafely(res);
    if (!res.ok) {
      const error = new Error(data?.error || `Request failed (${res.status})`);
      error.response = { status: res.status, data };
      throw error;
    }
    return data;
  } catch (err) {
    clearTimeout(tid);
    if (err.name === 'AbortError') {
      const e = new Error('Request timed out. Check your connection and try again.');
      e.response = { status: 408, data: null };
      throw e;
    }
    throw err;
  }
};

// ── Load Razorpay checkout.js — with one auto-retry ──────────────────────
let _razorpayScriptPromise = null;

export const loadRazorpayScript = (retried = false) => {
  if (window.Razorpay) return Promise.resolve(true);
  if (_razorpayScriptPromise) return _razorpayScriptPromise;

  _razorpayScriptPromise = new Promise((resolve) => {
    const script   = document.createElement('script');
    script.src     = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve(true);
    script.onerror = () => {
      _razorpayScriptPromise = null;
      if (!retried) {
        // Wait 2 s then try once more (handles transient CDN blips)
        setTimeout(() => loadRazorpayScript(true).then(resolve), 2000);
      } else {
        resolve(false);
      }
    };
    document.body.appendChild(script);
  });

  return _razorpayScriptPromise;
};

// ── API calls ────────────────────────────────────────────────────────────
export const createOrder       = (planKey) =>
  paymentFetch('/create-order', { method: 'POST', body: JSON.stringify({ planKey }) });

export const verifyPayment     = ({ orderId, paymentId, signature, planKey }) =>
  paymentFetch('/verify', {
    method: 'POST',
    body: JSON.stringify({ orderId, paymentId, signature, planKey }),
  });

export const getPaymentStatus  = () => paymentFetch('/status');
export const getPaymentHistory = () => paymentFetch('/history');

export const cancelPayment     = (orderId) =>
  paymentFetch('/cancel', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });

// ── Main checkout trigger ────────────────────────────────────────────────
/**
 * openRazorpayCheckout({ planKey, user, onSuccess, onFailure, onDismiss })
 *
 * What's new vs v1:
 *  - config.display.blocks + sequence puts UPI first in the payment sheet
 *    (GPay, PhonePe, BHIM surface immediately — no scrolling for Indian users)
 *  - config.display.hide removes "Add new UPI" if you only want one-tap flows
 *  - modal.confirm_close = true prevents accidental closes (user must confirm)
 *  - notify.email = true triggers Razorpay's own payment receipt email
 *  - retry.enabled = true lets Razorpay retry failed instruments automatically
 *    before surfacing an error to the user
 */
export const openRazorpayCheckout = async ({
  planKey,
  user,
  onSuccess,
  onFailure,
  onDismiss,
}) => {
  if (!planKey) { onFailure?.('No plan selected.'); return; }

  const loaded = await loadRazorpayScript();
  if (!loaded) {
    onFailure?.('Could not load the payment SDK. Check your connection and try again.');
    return;
  }

  let orderData;
  try {
    orderData = await createOrder(planKey);
  } catch (err) {
    onFailure?.(err?.response?.data?.error || 'Could not start checkout. Please try again.');
    return;
  }

  const options = {
    key:         orderData.keyId,
    amount:      orderData.amount,
    currency:    orderData.currency,
    name:        'MockMate',
    description: orderData.planLabel,
    order_id:    orderData.orderId,
    image:       '/favicon.svg',   // your logo in the modal header

    // ── Prefill — name + email from the logged-in user ──────────────────
    prefill: {
      name:  user?.name  || '',
      email: user?.email || '',
      // contact intentionally omitted — MockMate doesn't collect phone numbers
    },

    // ── Payment method configuration ─────────────────────────────────────
    // All methods are enabled by default in Razorpay; this block explicitly
    // controls ORDER so UPI appears first for Indian users (highest conversion).
    config: {
      display: {
        blocks: {
          utib: {                           // "pay via UPI" block
            name: 'Pay with UPI',
            instruments: [
              { method: 'upi', flows: ['qr'] },           // QR code (scan)
              { method: 'upi', flows: ['collect'] },       // VPA / UPI ID entry
              { method: 'upi', flows: ['intent'],          // app intent (GPay, PhonePe, BHIM…)
                apps: ['google_pay', 'phonepe', 'paytm', 'bhim', 'amazon'] },
            ],
          },
          hdfc: {                           // Cards block (any issuer)
            name: 'Pay with Card',
            instruments: [
              { method: 'card' },
            ],
          },
          nb: {                             // Netbanking
            name: 'Netbanking',
            instruments: [{ method: 'netbanking' }],
          },
          wl: {                             // Wallets (Paytm wallet, Mobikwik…)
            name: 'Wallets',
            instruments: [{ method: 'wallet' }],
          },
        },
        // Sequence controls tab order — UPI first
        sequence: ['block.utib', 'block.hdfc', 'block.nb', 'block.wl'],
        preferences: {
          show_default_blocks: false,       // use only our defined blocks above
        },
      },
    },

    // ── Modal behaviour ──────────────────────────────────────────────────
    modal: {
      confirm_close: true,   // "Are you sure you want to close?" prompt
      ondismiss:     () => onDismiss?.(),
      escape:        false,  // don't close on Esc key (reduces accidental dismissal)
      animation:     true,
    },

    // ── Notify — Razorpay sends its own payment receipt to the user ───────
    notify: {
      sms:   false,          // no phone number collected → disable
      email: true,           // sends Razorpay's standard receipt to prefill.email
    },

    // ── Auto-retry on payment failure ─────────────────────────────────────
    // Razorpay will suggest an alternative instrument if one fails,
    // before surfacing an error to the user.
    retry: {
      enabled: true,
      max_count: 3,
    },

    theme: {
      color:      '#1A6EFF',
      hide_topbar: false,
    },

    // ── Success handler ──────────────────────────────────────────────────
    handler: async (response) => {
      try {
        const result = await verifyPayment({
          orderId:   response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
          planKey,
        });
        onSuccess?.(result);
      } catch (err) {
        onFailure?.(
          err?.response?.data?.error ||
          'Payment went through but verification failed. Contact support with your payment ID: ' +
          response.razorpay_payment_id
        );
      }
    },
  };

  const rzp = new window.Razorpay(options);

  rzp.on('payment.failed', (response) => {
    const msg = response?.error?.description || 'Payment failed. Please try again.';
    const code = response?.error?.code;
    // Surface the error code in dev; users see the friendly message
    if (import.meta.env.DEV) console.warn('[payment.failed]', code, response?.error);
    onFailure?.(msg);
  });

  rzp.open();
};