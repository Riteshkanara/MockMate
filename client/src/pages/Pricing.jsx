/**
 * MockMate — Pricing (v4)
 * Matches Dashboard shell: mono status strip, C.card surfaces, 18px radii,
 * blue/cyan palette, light-tint emoji labels. Uses Button + tokens only.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import usePlan from '../hooks/usePlan';
import Button from '../components/Button';
import { openRazorpayCheckout } from '../services/paymentService';
import { getDashboardAnalytics } from '../Services/interviewService';
import { C, F } from '../styles/token';

// ── Tier ladder — SAME thresholds as Dashboard ALL_TIERS ────────────────
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
    currentIdx,
    currentTier: cur,
    nextTier: next,
    pointsToNext: next ? Math.max(0, Math.ceil(next.min - score)) : 0,
    pct: next ? Math.min(100, Math.max(0, Math.round(((score - cur.min) / (next.min - cur.min)) * 100))) : 100,
  };
};

// ── Static data ─────────────────────────────────────────────────────────
const BILLING_OPTIONS = [
  { key: 'pro_monthly', label: '1 month',  price: '₹199',   per: '₹199 / month', badge: null },
  { key: 'pro_3months', label: '3 months', price: '₹499',   per: '₹166 / month', badge: 'Save ₹98' },
  { key: 'pro_yearly',  label: '1 year',   price: '₹1,499', per: '₹125 / month', badge: 'Save ₹889' },
];

const PRO_FEATURES = [
  { e: '♾️', t: 'No limit on daily interviews' },
  { e: '🎯', t: 'All 5 modes: Quick, Mixed, MCQ, Aptitude, Behavioral' },
  { e: '📝', t: 'Detailed feedback with ideal answers' },
  { e: '🧠', t: 'AI Coach: guidance built from your sessions' },
  { e: '📊', t: 'Full analytics, IRS score and tier chart' },
  { e: '🔍', t: 'Blind spot detection across your last 10 sessions' },
  { e: '🔥', t: 'Session warmup pattern analysis' },
  { e: '🔁', t: 'Re-evaluate any answer with a fresh AI pass' },
  { e: '🖼️', t: 'Download your scorecard as a PNG' },
  { e: '🏅', t: 'Full badge and streak system' },
];

const FREE_FEATURES = [
  { t: '3 interviews per day',      y: true  },
  { t: 'Quick mode · 5 questions',  y: true  },
  { t: 'Basic AI feedback',         y: true  },
  { t: 'Leaderboard + public link', y: true  },
  { t: 'Unlimited interviews',      y: false },
  { t: 'All 5 interview modes',     y: false },
  { t: 'AI Coach',                  y: false },
  { t: 'Full analytics + IRS score', y: false },
];

const COMPARISON = [
  { e: '🎤', label: 'Daily interviews',        free: '3 per day',  pro: 'No limit' },
  { e: '🧩', label: 'Interview modes',         free: 'Quick only', pro: 'All 5 modes' },
  { e: '❓', label: 'Questions per session',   free: '5',          pro: '10' },
  { e: '📝', label: 'AI feedback',             free: 'Basic',      pro: 'Detailed + ideal answer' },
  { e: '🧠', label: 'AI Coach',                free: false,        pro: true },
  { e: '📈', label: 'Analytics history',       free: '7 days',     pro: 'All time' },
  { e: '🎯', label: 'IRS score + tier chart',  free: false,        pro: true },
  { e: '🔍', label: 'Blind spot detection',    free: false,        pro: true },
  { e: '🔥', label: 'Session warmup analysis', free: false,        pro: true },
  { e: '🔁', label: 'Answer re-evaluation',    free: false,        pro: true },
  { e: '🖼️', label: 'Scorecard download',      free: false,        pro: true },
  { e: '🏅', label: 'Badge and streak system', free: false,        pro: true },
  { e: '🏆', label: 'Leaderboard + public link', free: true,       pro: true },
];

// Real product flow — replaces fake testimonials
const HOW_IT_WORKS = [
  { e: '🎤', title: 'Practice',  desc: 'Run interviews in any of 5 modes. Pro removes the daily cap so you can drill as much as you need.' },
  { e: '🎯', title: 'Get scored', desc: 'Every answer feeds your IRS: a weighted readiness score mapped to real salary tiers.' },
  { e: '🔍', title: 'Find gaps',  desc: 'Blind spot detection and warmup analysis show which topics keep costing you points.' },
  { e: '🚀', title: 'Climb',      desc: 'The AI Coach turns your data into a plan. Re-evaluate answers until the tier moves.' },
];

const FAQ = [
  ['Does Pro renew automatically?',     'No. Your Pro access runs to the end of the paid period and stops. No action needed.'],
  ['What happens to my data if I stop?', 'Nothing is deleted. Every session, score and analytics record stays. You move back to free-tier limits, not a clean slate.'],
  ['How is payment handled?',           'Through Razorpay (PCI-DSS Level 1). We never see or store your card details.'],
  ['Does UPI work?',                    'Yes. UPI (GPay, PhonePe, BHIM, Paytm), cards, netbanking and wallets are all supported. UPI is shown first.'],
  ['Can I renew before expiry?',        'Yes. Renew early and the remaining time carries over. It adds on top instead of resetting.'],
  ['Is there a college plan?',          'Yes. If your placement cell wants a bulk plan, reach out and we\'ll set one up separately.'],
];

// ── CSS ─────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes pgHeroIn   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pgLive     { 0%,100% { opacity:1; } 50% { opacity:.28; } }
  @keyframes pgDrift    { 0%,100% { transform:translate(0,0) rotate(0deg); } 50% { transform:translate(-2%,3%) rotate(5deg); } }
  @keyframes pgEmoji    { 0%,100% { translate:0 0; opacity:.10; } 50% { translate:0 -7px; opacity:.18; } }
  @keyframes pgSheen    { from { transform:translateX(-130%) skewX(-14deg); } to { transform:translateX(270%) skewX(-14deg); } }

  .pg { min-height:100vh; background:${C.bg};
        background-image:
          radial-gradient(ellipse at 6% -4%, rgba(26,110,255,.06) 0%, transparent 46%),
          radial-gradient(ellipse at 96% 4%, rgba(0,200,240,.05) 0%, transparent 40%);
        font-family:${F.body}; color:${C.text}; padding:88px 24px 96px; }
  .pg *, .pg *::before, .pg *::after { box-sizing:border-box; }
  .pg-inner { max-width:1040px; margin:0 auto; }

  /* status strip */
  .pg-strip { display:flex; align-items:center; justify-content:space-between; gap:12px;
              padding:10px 18px; margin-bottom:18px; border-radius:11px;
              background:${C.card}; border:1px solid ${C.border}; box-shadow:${C.shadow}; }
  .pg-strip-l { display:flex; align-items:center; gap:9px; }
  .pg-live { width:6px; height:6px; border-radius:50%; background:${C.green}; animation:pgLive 2.4s ease-in-out infinite; }
  .pg-mono { font-family:${F.mono}; font-size:10.5px; letter-spacing:.3px; color:${C.muted}; }

  /* hero */
  .pg-hero { position:relative; overflow:hidden; border-radius:24px; padding:44px 40px;
             background:linear-gradient(148deg, ${C.brand900} 0%, #0042BB 52%, ${C.brand400} 100%);
             box-shadow:0 18px 52px rgba(0,31,107,.28); margin-bottom:24px;
             animation:pgHeroIn .5s cubic-bezier(.22,1,.36,1) both; }
  .pg-hero-mesh { position:absolute; inset:-50%; pointer-events:none;
                  background:
                    radial-gradient(circle at 14% 18%, rgba(255,255,255,.07), transparent 38%),
                    radial-gradient(circle at 86% 10%, rgba(0,200,240,.18), transparent 40%),
                    radial-gradient(circle at 55% 92%, rgba(109,91,238,.12), transparent 44%);
                  animation:pgDrift 20s ease-in-out infinite; }
  .pg-hero-emoji { position:absolute; font-size:44px; pointer-events:none; user-select:none; animation:pgEmoji 6s ease-in-out infinite; }
  .pg-hero-body { position:relative; z-index:1; }

  .pg-eyebrow { font-family:${F.mono}; font-size:10.5px; font-weight:700; letter-spacing:.8px;
                text-transform:lowercase; color:rgba(255,255,255,.6); margin-bottom:10px; }
  .pg-h1 { font-family:${F.display}; font-size:clamp(26px,4vw,38px); font-weight:900; color:#fff;
           letter-spacing:-.03em; line-height:1.15; margin:0 0 12px; }
  .pg-lead { font-size:15px; color:rgba(255,255,255,.75); line-height:1.65; margin:0; max-width:520px; }

  .pg-hero-generic { text-align:center; max-width:620px; margin:0 auto; }
  .pg-hero-generic .pg-lead { margin:0 auto; }
  .pg-pills { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:22px; }
  .pg-pill { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px;
             background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18);
             font-size:12px; font-weight:600; color:rgba(255,255,255,.88); }

  /* personalised hero */
  .pg-hero-irs { display:flex; align-items:center; gap:36px; flex-wrap:wrap; }
  .pg-ring-col { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:14px; }
  .pg-ring { position:relative; width:132px; height:132px; }
  .pg-ring svg { position:absolute; inset:0; transform:rotate(-90deg); }
  .pg-ring-c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .pg-ring-score { font-family:${F.display}; font-size:38px; font-weight:900; color:#fff; line-height:1; letter-spacing:-1px; }
  .pg-ring-sub { font-family:${F.mono}; font-size:9.5px; color:rgba(255,255,255,.6); letter-spacing:.8px; margin-top:4px; }
  .pg-tier-chip { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:999px;
                  background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2);
                  font-size:12px; font-weight:700; color:#fff; }
  .pg-copy { flex:1; min-width:260px; }

  .pg-ladder { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:22px; }
  .pg-step { padding:10px 10px 9px; border-radius:12px; background:rgba(255,255,255,.07);
             border:1px solid rgba(255,255,255,.12); text-align:center; }
  .pg-step.done { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.28); }
  .pg-step.cur  { background:rgba(255,255,255,.2);  border-color:#7BFFC2; box-shadow:0 0 0 1px #7BFFC2 inset; }
  .pg-step-e { font-size:16px; }
  .pg-step-l { font-family:${F.mono}; font-size:10.5px; font-weight:700; color:#fff; margin-top:3px; }
  .pg-step-s { font-size:9.5px; color:rgba(255,255,255,.55); margin-top:1px; }
  .pg-track { margin-top:12px; height:5px; border-radius:999px; background:rgba(255,255,255,.18); overflow:hidden; }
  .pg-track-fill { height:100%; border-radius:999px; background:#7BFFC2; transition:width 1.1s cubic-bezier(.16,1,.3,1); }
  .pg-track-meta { display:flex; justify-content:space-between; margin-top:6px; font-family:${F.mono}; font-size:10px; color:rgba(255,255,255,.6); }

  /* trust row */
  .pg-trust { display:grid; grid-template-columns:repeat(4,1fr); border-radius:18px; overflow:hidden;
              background:${C.card}; border:1px solid ${C.border}; box-shadow:${C.shadow}; margin-bottom:44px; }
  .pg-trust-cell { padding:16px 18px; border-right:1px solid ${C.border}; display:flex; align-items:center; gap:11px; }
  .pg-trust-cell:last-child { border-right:none; }
  .pg-emo-tile { width:34px; height:34px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
                 font-size:16px; background:${C.blue50}; border:1px solid ${C.borderMd}; }
  .pg-trust-t { font-size:12.5px; font-weight:700; color:${C.text}; }
  .pg-trust-s { font-size:11px; color:${C.muted}; margin-top:1px; }

  /* plan cards */
  .pg-plans { display:grid; grid-template-columns:1fr 1.15fr; gap:20px; margin-bottom:64px; align-items:stretch; }
  .pg-free { background:${C.card}; border:1px solid ${C.border}; border-radius:20px; padding:30px; box-shadow:${C.shadow}; display:flex; flex-direction:column; }
  .pg-plan-name { display:flex; align-items:center; gap:8px; font-family:${F.mono}; font-size:11px; font-weight:700;
                  letter-spacing:.8px; text-transform:lowercase; color:${C.blue500}; margin-bottom:16px; }
  .pg-plan-name.light { color:rgba(255,255,255,.65); }
  .pg-price { font-family:${F.display}; font-size:40px; font-weight:900; letter-spacing:-1.2px; color:${C.text}; line-height:1; }
  .pg-price-sub { font-size:13px; color:${C.muted}; margin:8px 0 0; }
  .pg-div { height:1px; background:${C.border}; margin:22px 0 14px; }
  .pg-row { display:flex; align-items:center; gap:10px; padding:6px 0; }
  .pg-chk { width:18px; height:18px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; }
  .pg-chk.y { background:${C.successTint}; color:${C.success}; }
  .pg-chk.n { background:${C.surfaceAlt}; color:${C.textFaint}; }
  .pg-row-t { font-size:13px; }
  .pg-row-t.y { color:${C.textSub}; } .pg-row-t.n { color:${C.textFaint}; }
  .pg-passive { margin-top:auto; padding:13px; text-align:center; border-radius:12px; background:${C.surfaceAlt};
                border:1px solid ${C.border}; font-size:13px; font-weight:600; color:${C.muted}; }
  .pg-free-fill { flex:1; min-height:20px; }

  .pg-pro { position:relative; overflow:hidden; border-radius:20px; padding:30px;
            background:linear-gradient(148deg, ${C.brand900} 0%, #0042BB 52%, ${C.brand400} 100%);
            box-shadow:0 16px 46px rgba(0,31,107,.3); }
  .pg-pro-mesh { position:absolute; inset:-50%; pointer-events:none;
                 background:radial-gradient(circle at 12% 18%, rgba(255,255,255,.07), transparent 38%),
                            radial-gradient(circle at 90% 8%, rgba(0,200,240,.16), transparent 40%);
                 animation:pgDrift 18s ease-in-out infinite; }
  .pg-pro-body { position:relative; z-index:1; }
  .pg-pro-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .pg-rec { font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px;
            background:rgba(123,255,194,.16); border:1px solid rgba(123,255,194,.4); color:#7BFFC2; }

  .pg-bill { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:6px 0 22px; }
  .pg-bill-btn { position:relative; padding:12px 8px 10px; border-radius:14px; cursor:pointer; text-align:center;
                 background:rgba(255,255,255,.06); border:1.5px solid rgba(255,255,255,.2); color:rgba(255,255,255,.8);
                 transition:background .15s, border-color .15s, transform .15s; font-family:${F.body}; }
  .pg-bill-btn:hover { transform:translateY(-1px); background:rgba(255,255,255,.1); }
  .pg-bill-btn.sel { background:rgba(255,255,255,.16); border-color:#fff; color:#fff; }
  .pg-bill-btn:focus-visible { outline:2px solid #7BFFC2; outline-offset:2px; }
  .pg-bill-l { font-size:12px; font-weight:700; }
  .pg-bill-p { font-family:${F.mono}; font-size:11px; margin-top:3px; opacity:.75; }
  .pg-bill-save { position:absolute; top:-9px; left:50%; transform:translateX(-50%); white-space:nowrap;
                  font-size:9.5px; font-weight:800; padding:2px 8px; border-radius:999px; background:#7BFFC2; color:#053B26; }

  .pg-pro-price { font-family:${F.display}; font-size:46px; font-weight:900; color:#fff; letter-spacing:-1.5px; line-height:1; }
  .pg-pro-per { font-size:13px; color:rgba(255,255,255,.65); margin:8px 0 0; }
  .pg-pro-div { height:1px; background:rgba(255,255,255,.15); margin:22px 0 14px; }
  .pg-pro-row { display:flex; align-items:center; gap:11px; padding:5px 0; }
  .pg-pro-emo { width:26px; height:26px; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
                font-size:13px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.14); }
  .pg-pro-row-t { font-size:13px; color:rgba(255,255,255,.9); line-height:1.4; }
  .pg-cta-wrap { position:relative; overflow:hidden; border-radius:12px; margin-top:24px; }
  .pg-cta-wrap:hover .pg-sheen { opacity:1; animation:pgSheen .8s ease-out; }
  .pg-sheen { position:absolute; top:-20%; bottom:-20%; left:-40%; width:26%; z-index:2;
              background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);
              transform:skewX(-14deg); opacity:0; pointer-events:none; }
  .pg-note { text-align:center; font-size:11.5px; color:rgba(255,255,255,.55); margin:11px 0 0; }

  /* sections */
  .pg-sec { margin-bottom:64px; }
  .pg-sec-head { text-align:center; margin-bottom:24px; }
  .pg-sec-eyebrow { font-family:${F.mono}; font-size:10.5px; font-weight:700; letter-spacing:.8px; text-transform:lowercase; color:${C.blue500}; margin-bottom:7px; }
  .pg-sec-title { font-family:${F.display}; font-size:22px; font-weight:800; letter-spacing:-.4px; color:${C.text}; margin:0; }
  .pg-sec-sub { font-size:13px; color:${C.sub}; margin:7px 0 0; }

  /* how it works */
  .pg-how { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
  .pg-how-card { background:${C.card}; border:1px solid ${C.border}; border-radius:16px; padding:20px; box-shadow:${C.shadow};
                 transition:transform .2s ease, box-shadow .2s ease; }
  .pg-how-card:hover { transform:translateY(-2px); box-shadow:${C.shadowMd}; }
  .pg-how-n { font-family:${F.mono}; font-size:10px; color:${C.faint}; float:right; }
  .pg-how-t { font-family:${F.display}; font-size:14.5px; font-weight:800; color:${C.text}; margin:12px 0 6px; }
  .pg-how-d { font-size:12.5px; line-height:1.6; color:${C.sub}; margin:0; }

  /* table */
  .pg-table-wrap { background:${C.card}; border:1px solid ${C.border}; border-radius:18px; overflow:hidden; overflow-x:auto; box-shadow:${C.shadow}; }
  .pg-table { width:100%; border-collapse:collapse; min-width:480px; }
  .pg-table thead th { padding:14px 18px; font-family:${F.mono}; font-size:10.5px; font-weight:700; letter-spacing:.6px;
                       text-transform:lowercase; color:${C.muted}; text-align:center; background:${C.surfaceAlt}; border-bottom:1px solid ${C.border}; }
  .pg-table thead th:first-child { text-align:left; }
  .pg-table thead th.pro { color:${C.blue600}; background:${C.blue50}; }
  .pg-table tbody td { padding:11px 18px; font-size:13px; color:${C.sub}; text-align:center; border-bottom:1px solid ${C.border}; }
  .pg-table tbody tr:last-child td { border-bottom:none; }
  .pg-table tbody td:first-child { text-align:left; color:${C.text}; font-weight:600; }
  .pg-table tbody td.pro { background:rgba(26,110,255,.04); color:${C.text}; font-weight:600; }
  .pg-table tbody tr:hover td { background:${C.surfaceAlt}; }
  .pg-table tbody tr:hover td.pro { background:rgba(26,110,255,.07); }
  .pg-lab { display:inline-flex; align-items:center; gap:10px; }
  .pg-lab-e { width:26px; height:26px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center;
              font-size:12px; background:${C.blue50}; border:1px solid ${C.border}; flex-shrink:0; }
  .pg-y { color:${C.success}; font-size:15px; font-weight:800; } .pg-n { color:${C.textFaint}; }

  /* faq */
  .pg-faq { max-width:680px; margin:0 auto; background:${C.card}; border:1px solid ${C.border}; border-radius:18px; padding:4px 24px; box-shadow:${C.shadow}; }
  .pg-faq-item { border-bottom:1px solid ${C.border}; } .pg-faq-item:last-child { border-bottom:none; }
  .pg-faq-btn { width:100%; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:17px 0;
                background:none; border:none; cursor:pointer; text-align:left; font-family:${F.body}; font-size:13.5px; font-weight:700; color:${C.text}; }
  .pg-faq-btn:hover { color:${C.blue600}; }
  .pg-faq-btn:focus-visible { outline:2px solid ${C.blue500}; outline-offset:3px; border-radius:6px; }
  .pg-chev { width:14px; height:14px; flex-shrink:0; color:${C.muted}; transition:transform .22s cubic-bezier(.22,1,.36,1); }
  .pg-faq-item.open .pg-chev { transform:rotate(180deg); color:${C.blue600}; }
  .pg-faq-body { display:grid; grid-template-rows:0fr; transition:grid-template-rows .28s cubic-bezier(.22,1,.36,1); }
  .pg-faq-item.open .pg-faq-body { grid-template-rows:1fr; }
  .pg-faq-in { overflow:hidden; }
  .pg-faq-t { font-size:13px; color:${C.sub}; line-height:1.7; padding:0 0 17px; margin:0; }

  .pg-foot { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; padding:8px 4px 0; opacity:.45; }

  @media (max-width:900px) {
    .pg-plans { grid-template-columns:1fr; }
    .pg-how { grid-template-columns:repeat(2,1fr); }
    .pg-trust { grid-template-columns:repeat(2,1fr); }
    .pg-trust-cell:nth-child(2) { border-right:none; }
    .pg-trust-cell:nth-child(-n+2) { border-bottom:1px solid ${C.border}; }
  }
  @media (max-width:600px) {
    .pg { padding:80px 14px 72px; }
    .pg-hero { padding:28px 20px; border-radius:20px; }
    .pg-hero-irs { gap:22px; }
    .pg-ladder { grid-template-columns:repeat(2,1fr); }
    .pg-free, .pg-pro { padding:22px; }
    .pg-how { grid-template-columns:1fr; }
    .pg-strip .pg-mono.r { display:none; }
    .pg-faq { padding:2px 18px; }
  }
  @media (prefers-reduced-motion:reduce) {
    .pg *, .pg *::before, .pg *::after { animation:none !important; transition-duration:.01ms !important; }
  }
`;

// ── Sub-components ──────────────────────────────────────────────────────
const Chev = () => (
  <svg className="pg-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const IrsRing = ({ score, size = 132, stroke = 10 }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  const [drawn, setDrawn] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setDrawn(pct)); return () => cancelAnimationFrame(id); }, [pct]);
  return (
    <div className="pg-ring" style={{ width: size, height: size }} role="img" aria-label={`IRS score ${Math.round(pct)} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (drawn / 100) * circ}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }} />
      </svg>
      <div className="pg-ring-c">
        <span className="pg-ring-score">{Math.round(pct)}</span>
        <span className="pg-ring-sub">IRS / 100</span>
      </div>
    </div>
  );
};

const Cell = ({ v, pro }) => {
  const cls = pro ? 'pro' : undefined;
  if (typeof v === 'boolean') return <td className={cls}>{v ? <span className="pg-y" aria-label="Included">✓</span> : <span className="pg-n" aria-label="Not included">—</span>}</td>;
  return <td className={cls} style={pro ? { color: C.blue600 } : undefined}>{v}</td>;
};

const FaqItem = ({ id, q, a, open, onToggle }) => (
  <div className={`pg-faq-item${open ? ' open' : ''}`}>
    <button className="pg-faq-btn" onClick={onToggle} aria-expanded={open} aria-controls={`faq-${id}`} id={`faq-btn-${id}`}>
      {q}<Chev />
    </button>
    <div className="pg-faq-body" id={`faq-${id}`} role="region" aria-labelledby={`faq-btn-${id}`}>
      <div className="pg-faq-in"><p className="pg-faq-t">{a}</p></div>
    </div>
  </div>
);

// ── Page ────────────────────────────────────────────────────────────────
export default function Pricing() {
  const { user, refreshUser } = useAuth();
  const { isPro, isExpired } = usePlan();
  const navigate = useNavigate();

  const [billing, setBilling] = useState('pro_yearly');
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(-1);
  const [analytics, setAnalytics] = useState(null);
  const busyRef = useRef(false); // hard guard against double checkout

  // Fetch real IRS (same source as Dashboard). Never blocks the page.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDashboardAnalytics()
      .then(d => { if (!cancelled) setAnalytics(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const plan = BILLING_OPTIONS.find(b => b.key === billing) || BILLING_OPTIONS[0];
  const alreadyPro = isPro && !isExpired;

  const irs = Number(analytics?.irs ?? user?.irs ?? user?.readinessScore ?? 0);
  const sessions = Number(analytics?.totalInterviews ?? analytics?.totalSessions ?? user?.totalInterviews ?? 0);
  const showPersonalized = Boolean(user && sessions > 0);

  const { currentIdx, currentTier, nextTier, pointsToNext, pct } = useMemo(() => getTierProgress(irs), [irs]);

  const handleUpgrade = useCallback(async () => {
    if (!user) { toast.error('Sign in first.'); navigate('/'); return; }
    if (alreadyPro || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    const done = () => { busyRef.current = false; setLoading(false); };
    try {
      await openRazorpayCheckout({
        planKey: billing,
        user,
        onSuccess: async () => {
          toast.success('Welcome to MockMate Pro.');
          try { await refreshUser(); } catch { /* non-fatal */ }
          done();
          navigate('/dashboard');
        },
        onFailure: (msg) => { done(); toast.error(msg || 'Payment failed.'); },
        onDismiss: done,
      });
    } catch {
      done();
      toast.error('Could not start checkout. Try again.');
    }
  }, [user, alreadyPro, billing, navigate, refreshUser]);

  const ctaLabel = alreadyPro ? 'Pro is active' : isExpired ? 'Renew Pro' : `Upgrade to Pro · ${plan.price}`;

  return (
    <div className="pg">
      <style>{CSS}</style>
      <div className="pg-inner">

        {/* status strip */}
        <div className="pg-strip">
          <div className="pg-strip-l"><span className="pg-live" /><span className="pg-mono">mockmate plans</span></div>
          <span className="pg-mono r">upi · cards · netbanking · wallets</span>
        </div>

        {/* hero */}
        <div className="pg-hero">
          <div className="pg-hero-mesh" aria-hidden="true" />
          <span className="pg-hero-emoji" style={{ top: 22, right: 46 }} aria-hidden="true">🎯</span>
          <span className="pg-hero-emoji" style={{ bottom: 20, right: 130, animationDelay: '1.4s' }} aria-hidden="true">🚀</span>
          <span className="pg-hero-emoji" style={{ top: 70, right: 200, fontSize: 30, animationDelay: '2.6s' }} aria-hidden="true">📈</span>

          <div className="pg-hero-body">
            {showPersonalized ? (
              <div className="pg-hero-irs">
                <div className="pg-ring-col">
                  <IrsRing score={irs} />
                  <span className="pg-tier-chip">{currentTier.emoji} {currentTier.label}</span>
                </div>
                <div className="pg-copy">
                  <div className="pg-eyebrow">your placement readiness</div>
                  <h1 className="pg-h1">
                    {nextTier
                      ? <>{pointsToNext} point{pointsToNext !== 1 ? 's' : ''} from <span style={{ color: '#7BFFC2' }}>{nextTier.label}</span></>
                      : <>You're at the top tier. Keep it sharp.</>}
                  </h1>
                  <p className="pg-lead">
                    {nextTier
                      ? `Across ${sessions} session${sessions !== 1 ? 's' : ''} you're reading as ${currentTier.label}. Unlimited sessions, blind spot detection and the AI Coach are built to close that gap faster.`
                      : `Pro keeps your IRS honest with blind spots, warmup analysis and your full history.`}
                  </p>

                  <div className="pg-ladder" aria-label="Salary tier ladder">
                    {TIERS.map((t, i) => (
                      <div key={t.short} className={`pg-step${i < currentIdx ? ' done' : ''}${i === currentIdx ? ' cur' : ''}`}>
                        <div className="pg-step-e">{t.emoji}</div>
                        <div className="pg-step-l">{t.short}</div>
                        <div className="pg-step-s">{i === 0 ? 'start' : `IRS ${t.min}+`}</div>
                      </div>
                    ))}
                  </div>
                  {nextTier && (
                    <>
                      <div className="pg-track"><div className="pg-track-fill" style={{ width: `${pct}%` }} /></div>
                      <div className="pg-track-meta"><span>{currentTier.short}</span><span>{pct}%</span><span>{nextTier.short}</span></div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="pg-hero-generic">
                <div className="pg-eyebrow">plans & pricing</div>
                <h1 className="pg-h1">Start free. Go Pro before placement season.</h1>
                <p className="pg-lead">
                  Free is enough to try MockMate. Pro removes the limits and adds the analytics that show exactly what to fix.
                </p>
                <div className="pg-pills">
                  <span className="pg-pill">♾️ Unlimited interviews</span>
                  <span className="pg-pill">🎯 IRS score</span>
                  <span className="pg-pill">🧠 AI Coach</span>
                  <span className="pg-pill">🔍 Blind spots</span>
                </div>
              </div>
            )}
          </div>
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

        {/* plan cards */}
        <div className="pg-plans">
          <div className="pg-free">
            <div className="pg-plan-name">🌱 free</div>
            <div className="pg-price">₹0</div>
            <p className="pg-price-sub">Always free. No card needed.</p>
            <div className="pg-div" />
            {FREE_FEATURES.map(r => (
              <div className="pg-row" key={r.t}>
                <span className={`pg-chk ${r.y ? 'y' : 'n'}`} aria-hidden="true">{r.y ? '✓' : '✕'}</span>
                <span className={`pg-row-t ${r.y ? 'y' : 'n'}`}>{r.t}</span>
              </div>
            ))}
            <div className="pg-free-fill" />
            <div className="pg-passive">{alreadyPro ? 'Your base plan' : 'Your current plan'}</div>
          </div>

          <div className="pg-pro">
            <div className="pg-pro-mesh" aria-hidden="true" />
            <div className="pg-pro-body">
              <div className="pg-pro-head">
                <div className="pg-plan-name light">⚡ pro</div>
                <span className="pg-rec">Recommended</span>
              </div>

              <div className="pg-bill" role="radiogroup" aria-label="Billing period">
                {BILLING_OPTIONS.map(o => (
                  <button key={o.key} role="radio" aria-checked={billing === o.key}
                    className={`pg-bill-btn${billing === o.key ? ' sel' : ''}`}
                    onClick={() => setBilling(o.key)}>
                    {o.badge && <span className="pg-bill-save">{o.badge}</span>}
                    <div className="pg-bill-l">{o.label}</div>
                    <div className="pg-bill-p">{o.price}</div>
                  </button>
                ))}
              </div>

              <div className="pg-pro-price">{plan.price}</div>
              <p className="pg-pro-per">{plan.per}. One-time payment, no auto-renewal.</p>

              <div className="pg-pro-div" />

              {PRO_FEATURES.map(f => (
                <div className="pg-pro-row" key={f.t}>
                  <span className="pg-pro-emo" aria-hidden="true">{f.e}</span>
                  <span className="pg-pro-row-t">{f.t}</span>
                </div>
              ))}

              <div className="pg-cta-wrap">
                <span className="pg-sheen" aria-hidden="true" />
                <Button
                  surface="dark" variant="primary" size="lg"
                  className="w-full"
                  loading={loading}
                  disabled={alreadyPro}
                  onClick={handleUpgrade}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Opening checkout…' : ctaLabel}
                </Button>
              </div>
              {!alreadyPro && <p className="pg-note">🔒 Secure checkout · UPI, cards, netbanking</p>}
            </div>
          </div>
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
                <span className="pg-how-n">0{i + 1}</span>
                <div className="pg-emo-tile" aria-hidden="true">{h.e}</div>
                <div className="pg-how-t">{h.title}</div>
                <p className="pg-how-d">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* comparison */}
        <div className="pg-sec">
          <div className="pg-sec-head">
            <div className="pg-sec-eyebrow">full comparison</div>
            <h2 className="pg-sec-title">Everything, side by side</h2>
            <p className="pg-sec-sub">The complete list, not just the headline features.</p>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <colgroup><col style={{ width: '46%' }} /><col style={{ width: '24%' }} /><col style={{ width: '30%' }} /></colgroup>
              <thead><tr><th scope="col">feature</th><th scope="col">free</th><th scope="col" className="pro">⚡ pro</th></tr></thead>
              <tbody>
                {COMPARISON.map(r => (
                  <tr key={r.label}>
                    <td><span className="pg-lab"><span className="pg-lab-e" aria-hidden="true">{r.e}</span>{r.label}</span></td>
                    <Cell v={r.free} />
                    <Cell v={r.pro} pro />
                  </tr>
                ))}
              </tbody>
            </table>
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
              <FaqItem key={q} id={i} q={q} a={a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </div>
        </div>

        <div className="pg-foot">
          <span className="pg-mono">mockmate plans</span>
          <span className="pg-mono">payments by razorpay · access ends at period end</span>
        </div>
      </div>
    </div>
  );
}