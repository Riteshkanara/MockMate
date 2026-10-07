import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import usePlan from '../hooks/usePlan';
import Button from '../components/Button';
import { openRazorpayCheckout } from '../Services/paymentService';
import { getDashboardAnalytics } from '../Services/interviewService';
import { C, F } from '../styles/token';
import { FEATURE_LABELS, PRO_WELCOME_KEY } from '../utils/planHelpers';

// ── Tier ladder ──────────────────────────────────────────────────────────
const TIERS = [
  { min: 0,  label: '₹3–6 LPA',   short: '₹3–6L',   emoji: '🌱' },
  { min: 35, label: '₹6–12 LPA',  short: '₹6–12L',  emoji: '🚀' },
  { min: 60, label: '₹12–20 LPA', short: '₹12–20L', emoji: '💎' },
  { min: 80, label: '₹20 LPA+',   short: '₹20L+',   emoji: '👑' },
];

const getTierProgress = (irs) => {
  const score = Number(irs) || 0;
  let currentIdx = 0;
  TIERS.forEach((t, i) => { if (score >= t.min) currentIdx = i; });
  const next = TIERS[currentIdx + 1] || null;
  const cur = TIERS[currentIdx];
  return {
    currentIdx, currentTier: cur, nextTier: next,
    pointsToNext: next ? Math.max(0, Math.ceil(next.min - score)) : 0,
    pct: next ? Math.min(100, Math.max(0, Math.round(((score - cur.min) / (next.min - cur.min)) * 100))) : 100,
  };
};

// ── Billing options ──────────────────────────────────────────────────────
const BILLING_OPTIONS = [
  { key: 'pro_monthly', label: '1 month',  price: '₹149',   per: '₹149 / month', badge: 'Intro price', futurePrice: '₹199' },
  { key: 'pro_3months', label: '3 months', price: '₹499',   per: '₹166 / month', badge: 'Save ₹98',   futurePrice: null },
  { key: 'pro_yearly',  label: '1 year',   price: '₹1,499', per: '₹125 / month', badge: 'Save ₹889',  futurePrice: null },
];

const PRO_FEATURES = [
  { e: '♾️', t: 'No limit on daily interviews' },
  { e: '🎯', t: 'All 7 modes: Quick, Full, Company, Topic, MCQ, Aptitude, Mixed' },
  { e: '📝', t: 'Detailed feedback with ideal answers' },
  { e: '🧠', t: 'AI Coach: guidance built from your sessions' },
  { e: '📊', t: 'Full analytics, IRS score and tier chart' },
  { e: '🔍', t: 'Blind spot detection across your last 10 sessions' },
  { e: '🔥', t: 'Session warmup pattern analysis' },
  { e: '🔁', t: 'Re-evaluate any answer with a fresh AI pass' },
  { e: '🖼️', t: 'Download your scorecard as a PNG' },
  { e: '📚', t: 'Your full interview history, not just 7 days' },
];

// ── Gauge comparison rows ────────────────────────────────────────────────
// freePct: how full the bar looks on free (0 = unavailable, fraction of max)
// freeLabel / proLabel: the text at the ends of the gauge
const GAUGE_GROUPS = [
  {
    label: 'Practice volume',
    rows: [
      { e: '🎤', name: 'Daily interviews',       freePct: 30, freeLabel: '3/day',       proLabel: 'Unlimited' },
      { e: '🧩', name: 'Interview modes',        freePct: 20, freeLabel: '1 mode + 1 trial each', proLabel: 'All 7 modes' },
      { e: '❓', name: 'Questions per session',  freePct: 50, freeLabel: '5 questions',  proLabel: '10 questions' },
    ],
  },
  {
    label: 'Feedback depth',
    rows: [
      { e: '📝', name: 'AI feedback detail',     freePct: 30, freeLabel: 'Score + what was missing', proLabel: 'Ideal answer, coaching, deep analysis' },
      { e: '🔁', name: 'Answer re-evaluation',   freePct: 0,  freeLabel: 'Not available', proLabel: 'Unlimited re-runs' },
      { e: '📈', name: 'Analytics history',      freePct: 18, freeLabel: '7 days',       proLabel: 'Full history' },
    ],
  },
  {
    label: 'Find what to fix',
    rows: [
      { e: '🎯', name: 'IRS score + tier chart', freePct: 0,  freeLabel: 'Not available', proLabel: 'Live · salary-mapped' },
      { e: '🔍', name: 'Blind spot detection',   freePct: 0,  freeLabel: 'Not available', proLabel: 'Last 10 sessions' },
      { e: '🔥', name: 'Warmup analysis',        freePct: 0,  freeLabel: 'Not available', proLabel: 'Per-session report' },
      { e: '🧠', name: 'AI Coach',               freePct: 0,  freeLabel: 'Not available', proLabel: 'Built from your data' },
    ],
  },
];

const HOW_IT_WORKS = [
  { e: '🎤', title: 'Practice',   desc: 'Run interviews in any of 7 modes. Pro removes the daily cap so you can drill as much as you need.' },
  { e: '🎯', title: 'Get scored', desc: 'Every answer feeds your IRS: a weighted readiness score mapped to real salary tiers.' },
  { e: '🔍', title: 'Find gaps',  desc: 'Blind spot detection and warmup analysis show which topics keep costing you points.' },
  { e: '🚀', title: 'Climb',      desc: 'The AI Coach turns your data into a plan. Re-evaluate answers until the tier moves.' },
];

const TESTIMONIALS = [
  { initial: 'A', name: 'Ananya S.', tag: 'Mixed mode · 22 sessions',
    quote: 'Blind spot detection kept flagging the same DBMS gap. Fixed it, and my IRS moved up a full tier in about two weeks.' },
  { initial: 'R', name: 'Rohit K.', tag: 'Full Mock',
    quote: 'The re-evaluate button is what sold me. I could see the exact difference between my answer and the ideal one, not just a score.' },
  { initial: 'P', name: 'Priya M.', tag: 'Aptitude + MCQ',
    quote: 'Free mode was fine for warmup, but the daily cap kept cutting me off mid-streak. Pro just removed the friction.' },
];

const FAQ = [
  ['Does Pro renew automatically?',      'No. Your Pro access runs to the end of the paid period and stops. No action needed.'],
  ['What happens to my data if I stop?', 'Nothing is deleted. Every session, score and analytics record stays. You move back to free-tier limits, not a clean slate.'],
  ['How is payment handled?',            'Through Razorpay (PCI-DSS Level 1). We never see or store your card details.'],
  ['Does UPI work?',                     'Yes. UPI (GPay, PhonePe, BHIM, Paytm), cards, netbanking and wallets are all supported. UPI is shown first.'],
  ['Can I renew before expiry?',         'Yes. Renew early and the remaining time carries over. It adds on top instead of resetting.'],
  ['Is there a college plan?',           'Yes. If your placement cell wants a bulk plan, reach out and we\'ll set one up separately.'],
];

// ── Mocked session data for the right-panel live demo ───────────────────
const MOCK_SESSIONS = [
  { mode: 'Mixed', score: 78, delta: '+6', tier: '🚀', label: '₹6–12L',  ago: '2h ago' },
  { mode: 'Full Mock', score: 71, delta: '+3', tier: '🚀', label: '₹6–12L', ago: '1d ago' },
  { mode: 'Quick', score: 64, delta: '+2', tier: '🌱', label: '₹3–6L',   ago: '2d ago' },
];
const MOCK_IRS = 78;
const MOCK_BLINDSPOT = 'DBMS — flagged in 4 of last 6 sessions';

// ── CSS ──────────────────────────────────────────────────────────────────
const CSS = `
  /* keyframes */
  @keyframes pgLive    { 0%,100%{opacity:1}50%{opacity:.25} }
  @keyframes pgDrift   { 0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(-2%,3%) rotate(5deg)} }
  @keyframes pgSheen   { from{transform:translateX(-130%) skewX(-14deg)}to{transform:translateX(270%) skewX(-14deg)} }
  @keyframes pgStepIn  { from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:none} }
  @keyframes pgRowIn   { from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none} }
  @keyframes pgLockPop { 0%{opacity:0;transform:scale(.9) rotate(-1deg)}100%{opacity:1;transform:scale(1) rotate(-1deg)} }
  @keyframes pgGaugeIn { from{width:0}to{} }
  @keyframes pgPulse   { 0%,100%{box-shadow:0 0 0 0 rgba(123,255,194,.45)}55%{box-shadow:0 0 0 6px rgba(123,255,194,0)} }
  @keyframes pgFadePop { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} }
  @keyframes pgCountUp { from{opacity:0}to{opacity:1} }

  /* root */
  .pg { min-height:100vh; background:${C.bg};
        background-image:radial-gradient(ellipse at 6% -4%,rgba(26,110,255,.06) 0%,transparent 46%),
                         radial-gradient(ellipse at 96% 4%,rgba(0,200,240,.05) 0%,transparent 40%);
        font-family:${F.body}; color:${C.text}; padding:88px 24px 96px; }
  .pg *,.pg *::before,.pg *::after{box-sizing:border-box}
  .pg-inner{max-width:1100px;margin:0 auto}

  /* ── status strip ── */
  .pg-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;
            padding:10px 18px;margin-bottom:14px;border-radius:11px;
            background:${C.card};border:1px solid ${C.border};box-shadow:${C.shadow}}
  .pg-strip-l{display:flex;align-items:center;gap:9px}
  .pg-live{width:6px;height:6px;border-radius:50%;background:${C.green};animation:pgLive 2.4s ease-in-out infinite}
  .pg-mono{font-family:${F.mono};font-size:10.5px;letter-spacing:.3px;color:${C.muted}}

  /* ── PRICE-LOCK OBJECT ── */
  /* looks like a physical ticket — perforated left edge, stamped badge, real numbers as hero */
  .pg-lock-wrap{display:flex;justify-content:center;margin-bottom:20px}
  .pg-lock{position:relative;display:inline-flex;align-items:stretch;border-radius:14px;
           overflow:hidden;box-shadow:0 4px 24px rgba(26,110,255,.14);
           animation:pgLockPop .55s cubic-bezier(.16,1,.3,1) .1s both}

  /* left stub — the "ticket counterfoil" */
  .pg-lock-stub{background:${C.brand900};color:rgba(255,255,255,.65);padding:0 18px;
                display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
                border-right:2px dashed rgba(255,255,255,.18);min-width:72px}
  .pg-lock-stub-icon{font-size:20px;line-height:1}
  .pg-lock-stub-l{font-family:${F.mono};font-size:9px;font-weight:700;letter-spacing:.6px;
                  color:rgba(255,255,255,.4);text-align:center;margin-top:2px}

  /* right body */
  .pg-lock-body{background:${C.blue50};border:1px solid ${C.borderMd};border-left:none;
                border-radius:0 14px 14px 0;padding:14px 20px 14px 18px;
                display:flex;align-items:center;gap:18px}
  .pg-lock-prices{display:flex;align-items:baseline;gap:10px}
  .pg-lock-now{font-family:${F.display};font-size:28px;font-weight:900;color:${C.blue700};letter-spacing:-1px;line-height:1}
  .pg-lock-arrow{font-size:14px;color:${C.textFaint}}
  .pg-lock-future{font-family:${F.display};font-size:20px;font-weight:700;color:${C.textFaint};
                  text-decoration:line-through;text-decoration-color:${C.borderMd}}
  .pg-lock-copy{border-left:1px solid ${C.borderMd};padding-left:16px}
  .pg-lock-copy-t{font-size:12.5px;font-weight:700;color:${C.blue700};line-height:1.4}
  .pg-lock-copy-s{font-size:11px;color:${C.muted};margin-top:2px}

  /* rotated stamp */
  .pg-lock-stamp{position:absolute;top:10px;right:12px;
                 background:transparent;border:1.5px solid ${C.brand500};border-radius:4px;
                 padding:2px 6px;font-family:${F.mono};font-size:8.5px;font-weight:800;
                 letter-spacing:.8px;color:${C.brand600};transform:rotate(6deg);
                 pointer-events:none}

  /* ── SPLIT-SCREEN HERO ── */
  .pg-hero{position:relative;overflow:hidden;border-radius:24px;
           background:linear-gradient(148deg,${C.brand900} 0%,#0042BB 52%,${C.brand400} 100%);
           box-shadow:0 18px 52px rgba(0,31,107,.28);margin-bottom:24px;
           display:grid;grid-template-columns:1fr 1fr;min-height:400px}
  .pg-hero-mesh{position:absolute;inset:-50%;pointer-events:none;
                background:radial-gradient(circle at 14% 18%,rgba(255,255,255,.07),transparent 38%),
                           radial-gradient(circle at 86% 10%,rgba(0,200,240,.18),transparent 40%),
                           radial-gradient(circle at 55% 92%,rgba(109,91,238,.12),transparent 44%);
                animation:pgDrift 20s ease-in-out infinite}

  /* left: pitch */
  .pg-hero-left{position:relative;z-index:1;padding:44px 36px 44px 44px;display:flex;flex-direction:column;justify-content:center}
  .pg-eyebrow{font-family:${F.mono};font-size:10.5px;font-weight:700;letter-spacing:.3px;
              color:rgba(255,255,255,.55);margin-bottom:12px}
  .pg-h1{font-family:${F.display};font-size:clamp(22px,2.8vw,32px);font-weight:800;color:#fff;
         letter-spacing:-.02em;line-height:1.2;margin:0 0 14px}
  .pg-lead{font-size:14px;color:rgba(255,255,255,.72);line-height:1.65;margin:0 0 28px;max-width:400px}

  /* tier ladder in left col */
  .pg-hlad{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:4px}
  .pg-hlad-step{padding:9px 7px 8px;border-radius:10px;text-align:center;
                background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);
                opacity:0;animation:pgStepIn .45s cubic-bezier(.16,1,.3,1) forwards}
  .pg-hlad-step.done{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25)}
  .pg-hlad-step.cur{background:rgba(255,255,255,.2);border-color:#7BFFC2;
                    box-shadow:0 0 0 1px #7BFFC2 inset;animation:pgPulse 2.6s ease-in-out 1.2s infinite,pgStepIn .45s cubic-bezier(.16,1,.3,1) forwards}
  .pg-hlad-e{font-size:15px}
  .pg-hlad-l{font-family:${F.mono};font-size:9.5px;font-weight:700;color:#fff;margin-top:3px}
  .pg-hlad-s{font-size:9px;color:rgba(255,255,255,.5);margin-top:1px}
  .pg-htrack-wrap{margin-top:10px}
  .pg-htrack{height:4px;border-radius:999px;background:rgba(255,255,255,.18);overflow:hidden}
  .pg-htrack-fill{height:100%;border-radius:999px;background:#7BFFC2;width:0;
                  transition:width 1.3s cubic-bezier(.16,1,.3,1) .5s}
  .pg-htrack-meta{display:flex;justify-content:space-between;margin-top:5px;
                  font-family:${F.mono};font-size:9.5px;color:rgba(255,255,255,.55)}

  /* right: live instrument panel */
  .pg-hero-right{position:relative;z-index:1;
                 border-left:1px solid rgba(255,255,255,.1);
                 background:rgba(0,0,0,.22);
                 backdrop-filter:blur(2px);
                 padding:28px 28px 28px 32px;
                 display:flex;flex-direction:column;gap:16px}
  .pg-panel-label{font-family:${F.mono};font-size:9.5px;font-weight:700;letter-spacing:.5px;
                  color:rgba(255,255,255,.35);margin-bottom:-6px}

  /* IRS ring row */
  .pg-panel-ring-row{display:flex;align-items:center;gap:18px}
  .pg-panel-ring{position:relative;width:84px;height:84px;flex-shrink:0}
  .pg-panel-ring svg{position:absolute;inset:0;transform:rotate(-90deg)}
  .pg-panel-ring-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .pg-panel-ring-score{font-family:${F.display};font-size:26px;font-weight:900;color:#fff;line-height:1;
                       letter-spacing:-1px;font-variant-numeric:tabular-nums}
  .pg-panel-ring-sub{font-family:${F.mono};font-size:8px;color:rgba(255,255,255,.55);letter-spacing:.5px;margin-top:2px}
  .pg-panel-ring-info{flex:1}
  .pg-panel-tier{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;
                 background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);
                 font-size:11px;font-weight:700;color:#fff;margin-bottom:7px}
  .pg-panel-next{font-size:12px;color:rgba(255,255,255,.65);line-height:1.5}
  .pg-panel-next b{color:#7BFFC2}

  /* session rows */
  .pg-panel-sessions{display:flex;flex-direction:column;gap:6px}
  .pg-sess-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;
               background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);
               opacity:0;animation:pgRowIn .4s cubic-bezier(.16,1,.3,1) forwards}
  .pg-sess-mode{font-family:${F.mono};font-size:10px;color:rgba(255,255,255,.55);min-width:72px}
  .pg-sess-score{font-family:${F.display};font-size:15px;font-weight:800;color:#fff;min-width:28px}
  .pg-sess-delta{font-family:${F.mono};font-size:10px;color:#7BFFC2;min-width:30px}
  .pg-sess-tier{font-size:12px;flex:1}
  .pg-sess-ago{font-family:${F.mono};font-size:9.5px;color:rgba(255,255,255,.35)}

  /* blindspot chip */
  .pg-panel-blind{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:10px;
                  background:rgba(234,88,12,.12);border:1px solid rgba(234,88,12,.3);
                  opacity:0;animation:pgFadePop .4s cubic-bezier(.16,1,.3,1) .7s forwards}
  .pg-panel-blind-icon{font-size:13px;flex-shrink:0;margin-top:1px}
  .pg-panel-blind-t{font-size:11px;color:rgba(255,255,255,.8);line-height:1.45}
  .pg-panel-blind-t b{color:#FDA57A;font-weight:700}

  /* trust row */
  .pg-trust{display:grid;grid-template-columns:repeat(4,1fr);border-radius:18px;overflow:hidden;
            background:${C.card};border:1px solid ${C.border};box-shadow:${C.shadow};margin-bottom:44px}
  .pg-trust-cell{padding:16px 18px;border-right:1px solid ${C.border};display:flex;align-items:center;gap:11px}
  .pg-trust-cell:last-child{border-right:none}
  .pg-emo-tile{width:34px;height:34px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
               font-size:16px;background:${C.blue50};border:1px solid ${C.borderMd}}
  .pg-trust-t{font-size:12.5px;font-weight:700;color:${C.text}}
  .pg-trust-s{font-size:11px;color:${C.muted};margin-top:1px}

  /* ── PLAN CARDS — redesigned v7.1 ──────────────────────────────────────
     Layout: one unified panel, free as a slim left column, pro commanding
     the right. Free card is compact (no crosses, just what's included + a
     soft wall). Pro card's feature list becomes a 2-col chip grid so the
     price + billing + CTA stay at eye level rather than being pushed down
     by a long vertical spec sheet.                                         */
  .pg-plans{display:grid;grid-template-columns:300px 1fr;gap:0;margin-bottom:64px;
            border-radius:22px;overflow:hidden;box-shadow:0 16px 46px rgba(0,31,107,.2);
            border:1px solid ${C.border}}

  /* free — flat, compact, slightly recessed */
  .pg-free{background:${C.card};padding:28px 24px;display:flex;flex-direction:column;gap:0;
           border-right:1px solid ${C.border}}
  .pg-plan-name{font-family:${F.mono};font-size:10px;font-weight:700;letter-spacing:.6px;
                color:${C.muted};margin-bottom:14px}
  .pg-plan-name.light{color:rgba(255,255,255,.55);letter-spacing:.6px}
  .pg-price{font-family:${F.display};font-size:34px;font-weight:900;letter-spacing:-1px;color:${C.text};line-height:1}
  .pg-price-sub{font-size:11.5px;color:${C.muted};margin:6px 0 20px}

  /* compact free feature rows — only what's included, no crosses */
  .pg-free-feat{display:flex;align-items:center;gap:8px;padding:5px 0}
  .pg-free-feat-dot{width:5px;height:5px;border-radius:50%;background:${C.success};flex-shrink:0}
  .pg-free-feat-t{font-size:12px;color:${C.textSub}}

  /* soft wall — the visual signal that more exists but is locked */
  .pg-free-wall{margin-top:16px;padding:12px 14px;border-radius:12px;
                background:${C.surfaceAlt};border:1px dashed ${C.borderMd};
                display:flex;align-items:center;gap:10px}
  .pg-free-wall-lock{font-size:16px;flex-shrink:0}
  .pg-free-wall-t{font-size:11.5px;color:${C.muted};line-height:1.5}
  .pg-free-wall-t b{color:${C.textSub};font-weight:600}

  .pg-passive{margin-top:auto;padding-top:20px;font-size:12px;font-weight:600;
              color:${C.faint};text-align:center}

  /* pro — gradient, commands the right two thirds */
  .pg-pro{position:relative;overflow:hidden;padding:28px 28px 24px;
          background:linear-gradient(148deg,${C.brand900} 0%,#0042BB 52%,${C.brand400} 100%)}
  .pg-pro-mesh{position:absolute;inset:-50%;pointer-events:none;
               background:radial-gradient(circle at 12% 18%,rgba(255,255,255,.07),transparent 38%),
                          radial-gradient(circle at 90% 8%,rgba(0,200,240,.16),transparent 40%);
               animation:pgDrift 18s ease-in-out infinite}
  .pg-pro-body{position:relative;z-index:1}
  .pg-pro-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px}
  .pg-rec{font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:999px;
          background:rgba(123,255,194,.16);border:1px solid rgba(123,255,194,.4);color:#7BFFC2}

  /* billing toggle — pill-style, not separate cards */
  .pg-bill{display:inline-flex;align-items:center;gap:3px;padding:3px;border-radius:12px;
           background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.1);margin-bottom:18px}
  .pg-bill-btn{position:relative;padding:6px 14px;border-radius:9px;cursor:pointer;
               background:transparent;border:none;color:rgba(255,255,255,.55);
               font-family:${F.body};font-size:11.5px;font-weight:600;
               transition:background .15s,color .15s;white-space:nowrap}
  .pg-bill-btn:hover{color:rgba(255,255,255,.8)}
  .pg-bill-btn.sel{background:rgba(255,255,255,.14);color:#fff}
  .pg-bill-btn:focus-visible{outline:2px solid #7BFFC2;outline-offset:2px}
  .pg-bill-save{position:absolute;top:-8px;right:4px;white-space:nowrap;
                font-size:8.5px;font-weight:800;padding:1px 6px;border-radius:999px;
                background:#7BFFC2;color:#053B26;pointer-events:none}

  /* price block — large, reads first */
  .pg-pro-price-row{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
  .pg-pro-price{font-family:${F.display};font-size:52px;font-weight:900;color:#fff;
                letter-spacing:-2px;line-height:1}
  .pg-pro-price-future{font-family:${F.mono};font-size:15px;font-weight:500;
                       color:rgba(255,255,255,.35);text-decoration:line-through}
  .pg-pro-per{font-size:12px;color:rgba(255,255,255,.55);margin-bottom:18px}

  /* feature chips — 2 columns, compact, scannable in one glance */
  .pg-chips{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:20px}
  .pg-chip{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:9px;
           background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1)}
  .pg-chip-e{font-size:13px;flex-shrink:0;line-height:1}
  .pg-chip-t{font-size:11.5px;color:rgba(255,255,255,.85);line-height:1.35}

  /* a subtle divider before CTA */
  .pg-pro-div{height:1px;background:rgba(255,255,255,.1);margin:0 0 18px}

  .pg-cta-wrap{position:relative;overflow:hidden;border-radius:12px}
  .pg-cta-wrap:hover .pg-sheen{opacity:1;animation:pgSheen .8s ease-out}
  .pg-sheen{position:absolute;top:-20%;bottom:-20%;left:-40%;width:26%;z-index:2;
            background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);
            transform:skewX(-14deg);opacity:0;pointer-events:none}
  .pg-cta-foot{display:flex;align-items:center;justify-content:space-between;margin-top:10px}
  .pg-note{font-size:11px;color:rgba(255,255,255,.45)}
  .pg-why-now{font-size:11px;color:rgba(123,255,194,.8);font-weight:600}

  /* sections */
  .pg-sec{margin-bottom:64px}
  .pg-sec-head{text-align:center;margin-bottom:24px}
  .pg-sec-eyebrow{font-family:${F.mono};font-size:10.5px;font-weight:700;letter-spacing:.5px;color:${C.blue500};margin-bottom:7px}
  .pg-sec-title{font-family:${F.display};font-size:22px;font-weight:800;letter-spacing:-.4px;color:${C.text};margin:0}
  .pg-sec-sub{font-size:13px;color:${C.sub};margin:7px 0 0}

  /* ── HOW IT WORKS — connected timeline ── */
  .pg-how{display:grid;grid-template-columns:repeat(4,1fr);gap:0;position:relative}
  /* connecting thread between cards */
  .pg-how::before{content:'';position:absolute;top:28px;left:calc(12.5% + 14px);right:calc(12.5% + 14px);
                  height:1px;background:linear-gradient(90deg,${C.brand200},${C.accent300},${C.brand200});
                  pointer-events:none;z-index:0}
  .pg-how-card{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:22px 18px 18px;
               box-shadow:${C.shadow};position:relative;z-index:1;
               transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
  .pg-how-card:hover{transform:translateY(-3px);box-shadow:${C.shadowMd};border-color:${C.borderMd}}
  /* step number — large, mono, the visual anchor */
  .pg-how-n{display:inline-flex;align-items:center;justify-content:center;
            width:28px;height:28px;border-radius:50%;margin-bottom:14px;
            font-family:${F.mono};font-size:11px;font-weight:800;letter-spacing:0;
            background:${C.blue50};border:1px solid ${C.borderMd};color:${C.blue600}}
  .pg-how-e{font-size:18px;display:block;margin-bottom:10px}
  .pg-how-t{font-family:${F.display};font-size:14px;font-weight:800;color:${C.text};margin:0 0 6px}
  .pg-how-d{font-size:12px;line-height:1.65;color:${C.sub};margin:0}

  /* ── TESTIMONIALS — quote-first ── */
  .pg-tsx{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .pg-tcard{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:22px;
            box-shadow:${C.shadow};display:flex;flex-direction:column;gap:14px}
  /* large opening quote mark — the visual subject */
  .pg-tmark{font-family:${F.display};font-size:56px;font-weight:900;line-height:.7;
            color:${C.brand200};margin-bottom:-4px;user-select:none;aria-hidden:true}
  .pg-tquote{font-size:13.5px;line-height:1.7;color:${C.text};margin:0;font-weight:500;flex:1}
  /* attribution muted, secondary */
  .pg-tperson{display:flex;align-items:center;gap:9px;padding-top:4px;
              border-top:1px solid ${C.border};margin-top:auto}
  .pg-tavatar{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
              font-family:${F.display};font-size:11px;font-weight:800;color:#fff;
              background:linear-gradient(148deg,${C.brand600} 0%,${C.accent500} 100%)}
  .pg-tname{font-size:11.5px;font-weight:700;color:${C.textSub}}
  .pg-ttag{font-family:${F.mono};font-size:9.5px;color:${C.muted};margin-top:1px}
  .pg-tnote{text-align:center;font-size:11px;color:${C.faint};margin:12px 0 0}

  /* ── GAUGE COMPARISON ── */
  .pg-gauge-shell{background:${C.card};border:1px solid ${C.border};border-radius:20px;
                  box-shadow:${C.shadow};overflow:hidden}
  .pg-gauge-head{display:grid;grid-template-columns:200px 1fr;gap:0;
                 padding:13px 24px;background:${C.surfaceAlt};border-bottom:1px solid ${C.border};
                 align-items:center}
  .pg-gauge-head-cols{display:grid;grid-template-columns:1fr 1fr;gap:0}
  .pg-gauge-col-label{font-family:${F.mono};font-size:10px;font-weight:700;letter-spacing:.4px;color:${C.textFaint};
                      padding:0 6px}
  .pg-gauge-col-label.pro{color:${C.blue600}}

  .pg-gauge-group+.pg-gauge-group{border-top:1px solid ${C.border}}
  .pg-gauge-glabel{padding:12px 24px 5px;font-family:${F.mono};font-size:10.5px;font-weight:700;
                   letter-spacing:.4px;color:${C.textFaint}}

  .pg-gauge-row{display:grid;grid-template-columns:200px 1fr;gap:0;
                padding:10px 24px;border-top:1px solid ${C.border};align-items:center}
  .pg-gauge-group .pg-gauge-row:first-of-type{border-top:none}
  .pg-gauge-row:hover{background:${C.surfaceAlt}}

  .pg-gauge-feat{display:flex;align-items:center;gap:9px;padding-right:16px}
  .pg-gauge-e{width:26px;height:26px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
              font-size:13px;background:${C.blue50};border:1px solid ${C.border}}
  .pg-gauge-name{font-size:12.5px;font-weight:700;color:${C.text};line-height:1.3}

  /* the two gauges sit side by side in the right col */
  .pg-gauge-cols{display:grid;grid-template-columns:1fr 1fr;gap:0}
  .pg-gauge-cell{padding:0 6px;display:flex;flex-direction:column;gap:4px}
  .pg-gauge-cell:first-child{border-right:1px solid ${C.border}}

  .pg-gauge-bar-wrap{height:7px;border-radius:999px;background:${C.surfaceAlt};border:1px solid ${C.border};overflow:hidden}
  .pg-gauge-bar-fill{height:100%;border-radius:999px;animation:pgGaugeIn .9s cubic-bezier(.16,1,.3,1) .2s both}
  .pg-gauge-bar-fill.free{background:${C.borderMd}}
  .pg-gauge-bar-fill.pro{background:linear-gradient(90deg,${C.brand500},${C.accent400})}
  .pg-gauge-bar-fill.zero{background:transparent}
  .pg-gauge-limit{font-size:10.5px;font-weight:600;color:${C.textFaint};line-height:1.3}
  .pg-gauge-limit.pro{color:${C.blue700};font-weight:700}
  .pg-gauge-limit.unavail{color:${C.borderStrong}}

  .pg-gauge-foot{display:grid;grid-template-columns:200px 1fr;padding:14px 24px;
                 background:${C.blue50};border-top:1px solid ${C.border};align-items:center}
  .pg-gauge-foot-l{font-size:12.5px;color:${C.textSub}}
  .pg-gauge-foot-r{font-family:${F.display};font-size:15px;font-weight:800;color:${C.blue700};
                   text-align:right}

  /* faq */
  .pg-faq{max-width:680px;margin:0 auto;background:${C.card};border:1px solid ${C.border};
          border-radius:18px;padding:4px 24px;box-shadow:${C.shadow}}
  .pg-faq-item{border-bottom:1px solid ${C.border}}.pg-faq-item:last-child{border-bottom:none}
  .pg-faq-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 0;
              background:none;border:none;cursor:pointer;text-align:left;font-family:${F.body};font-size:13.5px;font-weight:700;color:${C.text}}
  .pg-faq-btn:hover{color:${C.blue600}}
  .pg-faq-btn:focus-visible{outline:2px solid ${C.blue500};outline-offset:3px;border-radius:6px}
  .pg-chev{width:14px;height:14px;flex-shrink:0;color:${C.muted};transition:transform .22s cubic-bezier(.22,1,.36,1)}
  .pg-faq-item.open .pg-chev{transform:rotate(180deg);color:${C.blue600}}
  .pg-faq-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .28s cubic-bezier(.22,1,.36,1)}
  .pg-faq-item.open .pg-faq-body{grid-template-rows:1fr}
  .pg-faq-in{overflow:hidden}
  .pg-faq-t{font-size:13px;color:${C.sub};line-height:1.7;padding:0 0 17px;margin:0}

  /* ── MICRO-FOOTER ── */
  .pg-foot-wrap{border-top:1px solid ${C.border};margin-top:16px;padding-top:32px}
  /* "still deciding?" echo CTA */
  .pg-foot-cta{text-align:center;margin-bottom:28px}
  .pg-foot-cta-t{font-family:${F.display};font-size:17px;font-weight:800;color:${C.text};margin:0 0 6px}
  .pg-foot-cta-s{font-size:12.5px;color:${C.muted};margin:0 0 14px}
  .pg-foot-cta-btn{display:inline-flex;align-items:center;gap:8px;padding:9px 22px;border-radius:12px;
                   background:${C.blue50};border:1px solid ${C.borderMd};color:${C.blue700};
                   font-size:13px;font-weight:700;cursor:pointer;transition:background .15s,transform .15s;
                   font-family:${F.body}}
  .pg-foot-cta-btn:hover{background:${C.brand100};transform:translateY(-1px)}
  .pg-foot{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;
           gap:6px;padding-bottom:8px;opacity:.4}
  .pg-foot-badge{display:flex;align-items:center;gap:6px;font-family:${F.mono};font-size:10px;color:${C.muted}}
  .pg-foot-dot{width:3px;height:3px;border-radius:50%;background:${C.borderMd}}

  /* ── STICKY MOBILE CTA BAR ── */
  /* appears after user scrolls past hero — only on narrow screens */
  .pg-sticky{position:fixed;bottom:0;left:0;right:0;z-index:100;
             background:rgba(255,255,255,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
             border-top:1px solid ${C.border};padding:10px 16px 10px;
             display:none;align-items:center;justify-content:space-between;gap:12px;
             box-shadow:0 -4px 24px rgba(0,31,107,.1);
             transform:translateY(100%);transition:transform .3s cubic-bezier(.16,1,.3,1)}
  .pg-sticky.show{transform:translateY(0)}
  .pg-sticky-l{display:flex;flex-direction:column;gap:1px}
  .pg-sticky-price{font-family:${F.display};font-size:18px;font-weight:900;color:${C.text};letter-spacing:-.5px;line-height:1}
  .pg-sticky-sub{font-size:10.5px;color:${C.muted}}
  .pg-sticky-btn{flex-shrink:0;padding:9px 20px;border-radius:10px;font-size:13px;font-weight:700;
                 background:linear-gradient(135deg,${C.brand600},${C.brand500});
                 color:#fff;border:none;cursor:pointer;font-family:${F.body};
                 box-shadow:0 4px 14px rgba(26,110,255,.35);
                 transition:transform .15s,box-shadow .15s}
  .pg-sticky-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(26,110,255,.45)}
  .pg-sticky-btn:active{transform:translateY(0)}
  @media(max-width:720px){.pg-sticky{display:flex}}
  /* extra bottom padding on mobile so sticky bar doesn't cover content */
  @media(max-width:720px){.pg{padding-bottom:96px}}

  /* responsive */
  @media(max-width:960px){
    .pg-hero{grid-template-columns:1fr}
    .pg-hero-right{border-left:none;border-top:1px solid rgba(255,255,255,.1)}
    .pg-plans{grid-template-columns:1fr;border-radius:16px}
    .pg-free{border-right:none;border-bottom:1px solid ${C.border}}
    .pg-how{grid-template-columns:repeat(2,1fr)}
    .pg-how::before{display:none}
    .pg-tsx{grid-template-columns:1fr}
    .pg-trust{grid-template-columns:repeat(2,1fr)}
    .pg-trust-cell:nth-child(2){border-right:none}
    .pg-trust-cell:nth-child(-n+2){border-bottom:1px solid ${C.border}}
    .pg-gauge-head,.pg-gauge-row,.pg-gauge-foot{grid-template-columns:150px 1fr}
  }
  @media(max-width:600px){
    .pg{padding:80px 14px 72px}
    .pg-hero-left{padding:28px 20px}
    .pg-hero-right{padding:20px}
    .pg-lock-body{gap:12px}
    .pg-lock-now{font-size:22px}
    .pg-lock-future{font-size:16px}
    .pg-free,.pg-pro{padding:20px}
    .pg-how{grid-template-columns:1fr}
    .pg-tsx{grid-template-columns:1fr}
    .pg-strip .pg-mono.r{display:none}
    .pg-faq{padding:2px 18px}
    .pg-gauge-head,.pg-gauge-row,.pg-gauge-foot{grid-template-columns:1fr;gap:8px;padding:10px 16px}
    .pg-gauge-head-cols,.pg-gauge-cols{grid-template-columns:1fr}
    .pg-gauge-cell:first-child{border-right:none;border-bottom:1px solid ${C.border};padding-bottom:8px}
    .pg-gauge-col-label{display:none}
    .pg-gauge-glabel{padding:10px 16px 4px}
    .pg-hlad{grid-template-columns:repeat(2,1fr)}
    .pg-lock-copy{display:none}
    /* chip grid: 1 col on very small screens */
    .pg-chips{grid-template-columns:1fr}
  }
  @media(prefers-reduced-motion:reduce){
    .pg *,.pg *::before,.pg *::after{animation:none !important;transition-duration:.01ms !important}
    .pg-hlad-step,.pg-sess-row,.pg-panel-blind{opacity:1 !important}
    .pg-gauge-bar-fill{animation:none !important}
    .pg-htrack-fill{transition:none !important}
    .pg-lock{animation:none !important;transform:rotate(-1deg)}
    .pg-sticky{transition:none !important}
  }
`;

// ── Sub-components ────────────────────────────────────────────────────────

const Chev = () => (
  <svg className="pg-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

// IRS ring — used in both the right panel (always mocked 78) and the personalised hero
const IrsRing = ({ score, size = 84, stroke = 8, labelSize = 26 }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  const [drawn, setDrawn] = useState(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const rid = requestAnimationFrame(() => setDrawn(pct));
    const rm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (rm) { setDisplay(Math.round(pct)); return () => cancelAnimationFrame(rid); }
    const dur = 1100; const t0 = performance.now(); let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(e * pct));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rid); cancelAnimationFrame(raf); };
  }, [pct]);

  return (
    <div className="pg-panel-ring" style={{ width: size, height: size }}
         role="img" aria-label={`IRS score ${Math.round(pct)} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (drawn / 100) * circ}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }}/>
      </svg>
      <div className="pg-panel-ring-c">
        <span className="pg-panel-ring-score" style={{ fontSize: labelSize }}>{display}</span>
        <span className="pg-panel-ring-sub">IRS / 100</span>
      </div>
    </div>
  );
};

// Right panel — always the mocked "Pro demo" regardless of auth state.
// Shows what Pro actually surfaces: ring, tier, recent sessions, blind spot chip.
const HeroPanel = () => {
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setTrackW(62), 300); // 62% toward next tier
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="pg-hero-right" aria-label="Pro dashboard preview">
      <div className="pg-panel-label">LIVE IRS · PRO VIEW</div>

      {/* ring + tier */}
      <div className="pg-panel-ring-row">
        <IrsRing score={MOCK_IRS} size={84} stroke={8} labelSize={26}/>
        <div className="pg-panel-ring-info">
          <div className="pg-panel-tier">🚀 ₹6–12 LPA</div>
          <div className="pg-panel-next"><b>7 pts</b> to ₹12–20 LPA tier</div>
        </div>
      </div>

      {/* mini progress bar */}
      <div>
        <div className="pg-htrack" style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,.16)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: '#7BFFC2',
                        width: `${trackW}%`, transition: 'width 1.3s cubic-bezier(.16,1,.3,1) .5s' }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4,
                      fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,.4)' }}>
          <span>₹6–12L</span><span>62%</span><span>₹12–20L</span>
        </div>
      </div>

      {/* recent sessions */}
      <div>
        <div className="pg-panel-label" style={{ marginBottom: 6 }}>RECENT SESSIONS</div>
        <div className="pg-panel-sessions">
          {MOCK_SESSIONS.map((s, i) => (
            <div className="pg-sess-row" key={s.mode + i}
                 style={{ animationDelay: `${200 + i * 110}ms` }}>
              <span className="pg-sess-mode">{s.mode}</span>
              <span className="pg-sess-score">{s.score}</span>
              <span className="pg-sess-delta">{s.delta}</span>
              <span className="pg-sess-tier">{s.tier}</span>
              <span className="pg-sess-ago">{s.ago}</span>
            </div>
          ))}
        </div>
      </div>

      {/* blind spot chip */}
      <div className="pg-panel-blind">
        <span className="pg-panel-blind-icon">🔍</span>
        <div className="pg-panel-blind-t">
          <b>Blind spot detected —</b> {MOCK_BLINDSPOT}
        </div>
      </div>
    </div>
  );
};

// Gauge row — the bar IS the information
const GaugeRow = ({ r }) => {
  const [animate, setAnimate] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setAnimate(true); ob.disconnect(); } }, { threshold: 0.2 });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const freeFill = animate ? `${r.freePct}%` : '0%';
  const proFill  = animate ? '100%' : '0%';

  return (
    <div className="pg-gauge-row" ref={ref}>
      <div className="pg-gauge-feat">
        <span className="pg-gauge-e" aria-hidden="true">{r.e}</span>
        <span className="pg-gauge-name">{r.name}</span>
      </div>
      <div className="pg-gauge-cols">
        {/* free cell */}
        <div className="pg-gauge-cell">
          <div className="pg-gauge-bar-wrap">
            <div className={`pg-gauge-bar-fill free${r.freePct === 0 ? ' zero' : ''}`}
                 style={{ width: freeFill, transition: animate ? 'width .9s cubic-bezier(.16,1,.3,1) .1s' : 'none' }}/>
          </div>
          <span className={`pg-gauge-limit${r.freePct === 0 ? ' unavail' : ''}`}>{r.freeLabel}</span>
        </div>
        {/* pro cell */}
        <div className="pg-gauge-cell">
          <div className="pg-gauge-bar-wrap">
            <div className="pg-gauge-bar-fill pro"
                 style={{ width: proFill, transition: animate ? 'width .9s cubic-bezier(.16,1,.3,1) .25s' : 'none' }}/>
          </div>
          <span className="pg-gauge-limit pro">{r.proLabel}</span>
        </div>
      </div>
    </div>
  );
};

const FaqItem = ({ id, q, a, open, onToggle }) => (
  <div className={`pg-faq-item${open ? ' open' : ''}`}>
    <button className="pg-faq-btn" onClick={onToggle} aria-expanded={open} aria-controls={`faq-${id}`} id={`faq-btn-${id}`}>
      {q}<Chev/>
    </button>
    <div className="pg-faq-body" id={`faq-${id}`} role="region" aria-labelledby={`faq-btn-${id}`}>
      <div className="pg-faq-in"><p className="pg-faq-t">{a}</p></div>
    </div>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────
export default function Pricing() {
  const { user, refreshUser } = useAuth();
  const { isPro, isExpired } = usePlan();
  const navigate = useNavigate();
  const location = useLocation();

  const [billing, setBilling] = useState(BILLING_OPTIONS.some(b => b.key === location.state?.plan) ? location.state.plan : 'pro_yearly');
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(-1);
  const [analytics, setAnalytics] = useState(null);
  const [trackFilled, setTrackFilled] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const busyRef = useRef(false);

  // derived constants — declared before any effect that references them
  const alreadyPro = isPro && !isExpired;
  const plan = BILLING_OPTIONS.find(b => b.key === billing) || BILLING_OPTIONS[0];

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDashboardAnalytics()
      .then(d => { if (!cancelled) setAnalytics(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // trigger hero track fill after mount
  useEffect(() => { const id = setTimeout(() => setTrackFilled(true), 500); return () => clearTimeout(id); }, []);

  // sticky bar: show after scrolling past hero, hide near page bottom
  useEffect(() => {
    if (alreadyPro) return;
    const onScroll = () => {
      const nearBottom = window.scrollY + window.innerHeight > document.body.scrollHeight - 120;
      setStickyVisible(window.scrollY > 420 && !nearBottom);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [alreadyPro]);

  const irs = Number(analytics?.irs ?? user?.irs ?? user?.readinessScore ?? 0);
  const sessions = Number(analytics?.totalInterviews ?? analytics?.totalSessions ?? user?.totalInterviews ?? 0);
  const showPersonalized = Boolean(user && sessions > 0);
  const { currentIdx, currentTier, nextTier, pointsToNext, pct } = useMemo(() => getTierProgress(irs), [irs]);

  const totalLocked = useMemo(
    () => GAUGE_GROUPS.reduce((n, g) => n + g.rows.filter(r => r.freePct === 0).length, 0),
    []
  );

  const handleUpgrade = useCallback(async () => {
    if (!user) { toast.error('Sign in first.'); navigate('/'); return; }
    if (alreadyPro || busyRef.current) return;
    busyRef.current = true; setLoading(true);
    const done = () => { busyRef.current = false; setLoading(false); };
    try {
      await openRazorpayCheckout({
        planKey: billing, user,
        onSuccess: async () => {
          toast.success('Welcome to MockMate Pro.');
          // Payment is verified at this point: arm the one-time "You're on Pro" moment.
          try { sessionStorage.setItem(PRO_WELCOME_KEY, String(Date.now())); } catch { /* optional nicety */ }
          try { await refreshUser(); } catch (e) {
            console.warn('refreshUser failed silently:', e);
          }
          done(); navigate('/dashboard');
        },
        onFailure: (msg) => { done(); toast.error(msg || 'Payment failed.'); },
        onDismiss: done,
      });
    } catch { done(); toast.error('Could not start checkout. Try again.'); }
  }, [user, alreadyPro, billing, navigate, refreshUser]);

  const ctaLabel = alreadyPro ? 'Pro is active' : isExpired ? 'Renew Pro' : `Upgrade to Pro · ${plan.price}`;

  return (
    <div className="pg">
      <style>{CSS}</style>
      <div className="pg-inner">

        {/* ── PRICE-LOCK OBJECT ── */}
        {!alreadyPro && (
          <div className="pg-lock-wrap" aria-label="Intro pricing notice">
            <div className="pg-lock">
              {/* left stub */}
              <div className="pg-lock-stub">
                <span className="pg-lock-stub-icon">🔒</span>
                <span className="pg-lock-stub-l">INTRO<br/>RATE</span>
              </div>
              {/* right body */}
              <div className="pg-lock-body">
                <div className="pg-lock-prices">
                  <span className="pg-lock-now">₹149</span>
                  <span className="pg-lock-arrow">→</span>
                  <span className="pg-lock-future">₹199</span>
                </div>
                <div className="pg-lock-copy">
                  <div className="pg-lock-copy-t">Monthly price rises to ₹199 soon</div>
                  <div className="pg-lock-copy-s">Pay now and lock ₹149 for the period you choose</div>
                </div>
              </div>
              {/* rotated stamp */}
              <span className="pg-lock-stamp" aria-hidden="true">LOCKED IN</span>
            </div>
          </div>
        )}

        {/* Arrived from a lock? Say what they came to unlock, so the page feels like the answer. */}
        {!alreadyPro && FEATURE_LABELS[location.state?.from] && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 14px', padding: '11px 16px', borderRadius: 14, background: C.brand50, border: `1px solid ${C.brand100}`, fontSize: 13.5, color: C.textSub }}>
            <span aria-hidden="true">🔓</span>
            <span>
              {location.state.from === 'expired' ? 'Renewing Pro' : <>You&apos;re unlocking <b style={{ color: C.text }}>{FEATURE_LABELS[location.state.from]}</b></>}
              {location.state.from === 'expired' ? ' brings back everything below. Your data was never deleted.' : '. It is included in every plan below.'}
            </span>
          </div>
        )}

        {/* ── PLAN CARDS v7.1 ── */}
        <div className="pg-plans">
          

          {/* FREE — compact sidebar, only what's included */}
          <div className="pg-free">
            <div className="pg-plan-name">FREE</div>
            <div className="pg-price">₹0</div>
            <p className="pg-price-sub">No card needed, ever.</p>

            {[
              '3 interviews / day',
              'Quick mode · 5 Qs',
              'Basic AI feedback',
              'Leaderboard + link',
            ].map(t => (
              <div className="pg-free-feat" key={t}>
                <span className="pg-free-feat-dot" aria-hidden="true"/>
                <span className="pg-free-feat-t">{t}</span>
              </div>
            ))}

            {/* soft wall — signals the ceiling without listing crosses */}
            <div className="pg-free-wall">
              <span className="pg-free-wall-lock" aria-hidden="true">🔒</span>
              <div className="pg-free-wall-t">
                <b>6 more features</b> — IRS score, AI Coach, blind spots, full analytics and more
              </div>
            </div>

            <div className="pg-passive">{alreadyPro ? 'Your base plan' : 'Current plan'}</div>
          </div>

          {/* PRO — gradient, price is the hero, features as scannable chips */}
          <div className="pg-pro">
            <div className="pg-pro-mesh" aria-hidden="true"/>
            <div className="pg-pro-body">

              <div className="pg-pro-head">
                <div className="pg-plan-name light">PRO</div>
                <span className="pg-rec">Recommended</span>
              </div>

              {/* pill billing toggle */}
              <div className="pg-bill" role="radiogroup" aria-label="Billing period">
                {BILLING_OPTIONS.map(o => (
                  <button key={o.key} role="radio" aria-checked={billing === o.key}
                    className={`pg-bill-btn${billing === o.key ? ' sel' : ''}`}
                    onClick={() => setBilling(o.key)}>
                    {o.badge && billing !== o.key && <span className="pg-bill-save">{o.badge}</span>}
                    {o.label}
                  </button>
                ))}
              </div>

              {/* price — large, reads first */}
              <div className="pg-pro-price-row">
                <span className="pg-pro-price">{plan.price}</span>
                {plan.futurePrice && <span className="pg-pro-price-future">{plan.futurePrice}</span>}
              </div>
              <p className="pg-pro-per">{plan.per} · one-time, no auto-renewal</p>

              {/* feature chips — 2 columns, all 10 features in compact grid */}
              <div className="pg-chips">
                {PRO_FEATURES.map(f => (
                  <div className="pg-chip" key={f.t}>
                    <span className="pg-chip-e" aria-hidden="true">{f.e}</span>
                    <span className="pg-chip-t">{f.t}</span>
                  </div>
                ))}
              </div>

              <div className="pg-pro-div"/>

              <div className="pg-cta-wrap">
                <span className="pg-sheen" aria-hidden="true"/>
                <Button surface="dark" variant="primary" size="lg"
                  loading={loading} disabled={alreadyPro} onClick={handleUpgrade}
                  style={{ width: '100%' }}>
                  {loading ? 'Opening checkout…' : ctaLabel}
                </Button>
              </div>

              {!alreadyPro && (
                <div className="pg-cta-foot">
                  <span className="pg-note">🔒 UPI · cards · netbanking</span>
                  {plan.futurePrice && <span className="pg-why-now">Locking ₹149 before it's ₹199</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SPLIT-SCREEN HERO ── */}
        <div className="pg-hero">
          <div className="pg-hero-mesh" aria-hidden="true"/>

          {/* LEFT: pitch */}
          <div className="pg-hero-left">
            {showPersonalized ? (
              <>
                <div className="pg-eyebrow">your placement readiness</div>
                <h1 className="pg-h1">
                  {nextTier
                    ? <>{pointsToNext} point{pointsToNext !== 1 ? 's' : ''} from {nextTier.label}</>
                    : <>Top tier. Keep it sharp.</>}
                </h1>
                <p className="pg-lead">
                  {nextTier
                    ? `${sessions} session${sessions !== 1 ? 's' : ''} in and you're reading as ${currentTier.label}. Unlimited sessions, blind spot detection and the AI Coach close that gap faster.`
                    : `Pro keeps your IRS honest — blind spots, warmup analysis, and your full history in one place.`}
                </p>
                <div className="pg-hlad" aria-label="Salary tier ladder">
                  {TIERS.map((t, i) => (
                    <div key={t.short}
                         className={`pg-hlad-step${i < currentIdx ? ' done' : ''}${i === currentIdx ? ' cur' : ''}`}
                         style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="pg-hlad-e">{t.emoji}</div>
                      <div className="pg-hlad-l">{t.short}</div>
                      <div className="pg-hlad-s">{i === 0 ? 'start' : `IRS ${t.min}+`}</div>
                    </div>
                  ))}
                </div>
                {nextTier && (
                  <div className="pg-htrack-wrap">
                    <div className="pg-htrack">
                      <div className="pg-htrack-fill" style={{ width: trackFilled ? `${pct}%` : '0%' }}/>
                    </div>
                    <div className="pg-htrack-meta"><span>{currentTier.short}</span><span>{pct}%</span><span>{nextTier.short}</span></div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="pg-eyebrow">plans & pricing</div>
                <h1 className="pg-h1">Every interview moves you up a salary tier — or it doesn't, and Pro tells you why.</h1>
                <p className="pg-lead">
                  Free gives you 3 interviews a day and a pass/fail. Pro scores every answer against real ₹LPA tiers and shows exactly what's costing you points.
                </p>
                <div className="pg-hlad" aria-label="Salary tier ladder">
                  {TIERS.map((t, i) => (
                    <div key={t.short} className="pg-hlad-step" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="pg-hlad-e">{t.emoji}</div>
                      <div className="pg-hlad-l">{t.short}</div>
                      <div className="pg-hlad-s">{i === 0 ? 'start here' : `IRS ${t.min}+`}</div>
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 16, fontSize: 12.5, color: 'rgba(255,255,255,.55)' }}>
                  Your first interview places you on this ladder — <span style={{ color: '#fff', fontWeight: 700 }}>no card required.</span>
                </p>
              </>
            )}
          </div>

          {/* RIGHT: live instrument panel — always mocked Pro demo */}
          <HeroPanel/>
        </div>

        {/* trust row */}
        <div className="pg-trust">
          {[
            { e: '💳', t: 'Razorpay secured', s: 'PCI-DSS Level 1' },
            { e: '📲', t: 'UPI shown first',  s: 'GPay · PhonePe · BHIM' },
            { e: '🔓', t: 'No auto-renewal',  s: 'Stops at period end' },
            { e: '🗂️', t: 'Data always kept', s: 'Nothing deleted' },
          ].map(x => (
            <div className="pg-trust-cell" key={x.t}>
              <div className="pg-emo-tile" aria-hidden="true">{x.e}</div>
              <div><div className="pg-trust-t">{x.t}</div><div className="pg-trust-s">{x.s}</div></div>
            </div>
          ))}
        </div>

        
        {/* how it works */}
        <div className="pg-sec">
          <div className="pg-sec-head">
            <div className="pg-sec-eyebrow">how pro works</div>
            <h2 className="pg-sec-title">From practice to a higher tier</h2>
            <p className="pg-sec-sub">Four steps, all driven by your own session data.</p>
          </div>
          <div className="pg-how">
            {HOW_IT_WORKS.map((h, i) => (
              <div className="pg-how-card" key={h.title}>
                <span className="pg-how-n" aria-hidden="true">0{i + 1}</span>
                <span className="pg-how-e" aria-hidden="true">{h.e}</span>
                <div className="pg-how-t">{h.title}</div>
                <p className="pg-how-d">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* testimonials */}
        <div className="pg-sec">
          <div className="pg-sec-head">
            <div className="pg-sec-eyebrow">illustrative examples</div>
            <h2 className="pg-sec-title">What actually changes after upgrading</h2>
          </div>
          <div className="pg-tsx">
            {TESTIMONIALS.map(t => (
              <div className="pg-tcard" key={t.name}>
                <div className="pg-tmark" aria-hidden="true">"</div>
                <p className="pg-tquote">{t.quote}</p>
                <div className="pg-tperson">
                  <span className="pg-tavatar" aria-hidden="true">{t.initial}</span>
                  <div><div className="pg-tname">{t.name}</div><div className="pg-ttag">{t.tag}</div></div>
                </div>
              </div>
            ))}
          </div>
          <p className="pg-tnote">Illustrative examples based on typical usage patterns.</p>
        </div>

        {/* ── GAUGE COMPARISON ── */}
        <div className="pg-sec">
          <div className="pg-sec-head">
            <div className="pg-sec-eyebrow">free vs pro</div>
            <h2 className="pg-sec-title">Every ceiling, shown as a fill</h2>
            <p className="pg-sec-sub">{totalLocked} features locked on free. The bars show how far each one goes — and where Pro takes it.</p>
          </div>
          <div className="pg-gauge-shell">
            <div className="pg-gauge-head">
              <span/>
              <div className="pg-gauge-head-cols">
                <span className="pg-gauge-col-label">free tier today</span>
                <span className="pg-gauge-col-label pro">⚡ with pro</span>
              </div>
            </div>
            {GAUGE_GROUPS.map(g => (
              <div className="pg-gauge-group" key={g.label}>
                <div className="pg-gauge-glabel">{g.label}</div>
                {g.rows.map(r => <GaugeRow r={r} key={r.name}/>)}
              </div>
            ))}
            <div className="pg-gauge-foot">
              <span className="pg-gauge-foot-l">{totalLocked} features with no free access at all</span>
              <span className="pg-gauge-foot-r">All unlocked with Pro</span>
            </div>
          </div>
        </div>

        {/* faq */}
        <div className="pg-sec">
          <div className="pg-sec-head">
            <div className="pg-sec-eyebrow">faq</div>
            <h2 className="pg-sec-title">Common questions</h2>
          </div>
          <div className="pg-faq">
            {FAQ.map(([q, a], i) => (
              <FaqItem key={q} id={i} q={q} a={a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}/>
            ))}
          </div>
        </div>

        {/* micro-footer */}
        <div className="pg-foot-wrap">
          {!alreadyPro && (
            <div className="pg-foot-cta">
              <p className="pg-foot-cta-t">Still deciding?</p>
              <p className="pg-foot-cta-s">Start free — no card needed. Upgrade whenever the cap gets in the way.</p>
              <button className="pg-foot-cta-btn" onClick={handleUpgrade} disabled={loading}>
                <span>🚀</span>
                Upgrade to Pro · {plan.price}
              </button>
            </div>
          )}
          <div className="pg-foot">
            <div className="pg-foot-badge">
              <span>mockmate</span>
              <span className="pg-foot-dot"/>
              <span>plans & pricing</span>
            </div>
            <div className="pg-foot-badge">
              <span>🔒 secured by razorpay</span>
              <span className="pg-foot-dot"/>
              <span>access ends at period end</span>
              <span className="pg-foot-dot"/>
              <span>no auto-renewal</span>
            </div>
          </div>
        </div>
      </div>

      {/* sticky mobile CTA bar — appears after scrolling past hero */}
      {!alreadyPro && (
        <div className={`pg-sticky${stickyVisible ? ' show' : ''}`} aria-hidden={!stickyVisible}>
          <div className="pg-sticky-l">
            <span className="pg-sticky-price">{plan.price}</span>
            <span className="pg-sticky-sub">
              {plan.per} · no auto-renewal
              {plan.futurePrice && ` · rises to ${plan.futurePrice}`}
            </span>
          </div>
          <button className="pg-sticky-btn" onClick={handleUpgrade} disabled={loading}>
            {loading ? 'Opening…' : 'Upgrade to Pro'}
          </button>
        </div>
      )}
    </div>
  );
}