/**
 * MockMate — UpgradeModal
 *
 * ONE modal, opened from anywhere via useUpgrade().openUpgrade(feature, opts).
 * Every lock in the app funnels here, so the message is always specific to what
 * the user just tried to do ("Full Mock is a Pro mode"), never a generic
 * "Upgrade now". The 5 perks shown are re-ordered so the ones relevant to the
 * trigger come first.
 *
 * Copy rules: say what the feature does, be honest about the price and about
 * renewal (Pro does NOT auto-renew — see Pricing FAQ), no fake urgency.
 */

import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { C, F } from '../styles/token';
import { timeUntil } from '../utils/planHelpers';

// id → perk row. Labels mirror Pricing.jsx PRO_FEATURES; keep them in sync.
const PERKS = {
  volume:    { icon: 'infinity', label: 'Unlimited interviews every day' },
  modes:     { icon: 'layers',   label: 'All 7 interview modes, up to 10 questions' },
  feedback:  { icon: 'chat',     label: 'Line-by-line feedback with ideal answers' },
  voice:     { icon: 'mic',      label: 'Voice delivery report: pace, fillers, pauses' },
  coach:     { icon: 'spark',    label: 'AI Coach built from your own sessions' },
  analytics: { icon: 'chart',    label: 'Full analytics, IRS score and tier chart' },
  blind:     { icon: 'target',   label: 'Blind spot detection and warmup analysis' },
  retry:     { icon: 'refresh',  label: 'Re-evaluate any answer with a fresh AI pass' },
  download:  { icon: 'download', label: 'Download your scorecard as a PNG' },
  history:   { icon: 'clock',    label: 'Your full history, not just the last 7 days' },
};
// Keep in sync with BILLING_OPTIONS in Pricing.jsx (the Pricing page owns the real plans).
const PLANS = [
  { key: 'pro_monthly', label: '1 month',  price: '₹149',   per: 'then ₹199 / month', badge: 'Intro price' },
  { key: 'pro_3months', label: '3 months', price: '₹499',   per: '₹166 / month',      badge: 'Save ₹98' },
  { key: 'pro_yearly',  label: '1 year',   price: '₹1,499', per: '₹125 / month',      badge: 'Best value' },
];
const DEFAULT_PLAN = 'pro_yearly';

// What each perk means in one honest line, shown when the perk is selected.
const PERK_DETAIL = {
  volume:    'Free includes 3 interviews a day. Pro has no daily cap, so you can repeat a weak topic until it clicks.',
  modes:     'Full Mock, Company rounds, Topic Focus, MCQ, Aptitude and Mixed, with up to 10 questions per session.',
  feedback:  'See what you got right, what was missing, and an ideal answer to compare against, line by line.',
  voice:     'Pace, filler words and pauses from your spoken answers, with the first thing to fix.',
  coach:     'The AI Coach reads your own sessions and tells you what to practise next, and why.',
  analytics: 'Your IRS score, the salary-tier chart and your full trend, not just the last 7 days.',
  blind:     'Looks across your last 10 sessions for topics that keep costing you points.',
  retry:     'Run a fresh AI pass on any answer and compare it with your last attempt.',
  download:  'Save your scorecard as a PNG for LinkedIn, your resume or your placement cell.',
  history:   'Every interview you have done, with all past results, not only the last 7 days.',
};
const PERK_SHORT = {
  volume: 'Unlimited practice', modes: 'All 7 modes', feedback: 'Full feedback', voice: 'Voice report', coach: 'AI Coach',
  analytics: 'Full analytics', blind: 'Blind spots', retry: 'Re-evaluate', download: 'Scorecard PNG', history: 'Full history',
};
// perk id → which tiny illustration to draw
const PERK_VISUAL = {
  volume: 'bars', modes: 'bars', feedback: 'lines', voice: 'wave', coach: 'chat',
  analytics: 'chart', blind: 'target', retry: 'lines', download: 'card', history: 'chart',
};
const DEFAULT_PERK_ORDER = ['volume', 'modes', 'feedback', 'analytics', 'coach'];

const modeCopy = (title, body) => ({ eyebrow: 'PRO MODE', title, body, perks: ['modes', 'feedback', 'volume', 'analytics', 'coach'] });

const FEATURE_COPY = {
  dailyInterviewLimit: {
    eyebrow: 'DAILY LIMIT', title: 'Keep practising without waiting',
    body: 'Free includes 3 interviews a day. Pro removes the cap so you can drill a weak topic back-to-back.',
    perks: ['volume', 'modes', 'feedback', 'analytics', 'blind'],
  },
  mode_full:     modeCopy('Full Mock is a Pro mode', 'A complete 10-question placement-style round: the closest thing to the real interview.'),
  mode_company:  modeCopy('Company-specific rounds are Pro', 'Questions shaped around how companies like TCS, Zoho or Razorpay actually interview.'),
  mode_topic:    modeCopy('Topic Focus is a Pro mode', 'Pick one or more topics, like DBMS or React, and go deep until the gap closes.'),
  mode_mcq:      modeCopy('Technical MCQ is a Pro mode', 'Placement-style multiple choice, timed, with an explanation for every answer.'),
  mode_aptitude: modeCopy('Aptitude is a Pro mode', 'Quantitative and logical reasoning under the same time pressure as a real test.'),
  mode_mixed:    modeCopy('Mixed Assessment is a Pro mode', 'Technical, aptitude and open questions in one session, like a real placement drive.'),
  voiceEvaluation: {
    eyebrow: 'PRO FEATURE', title: 'See how you actually sound',
    body: 'Pro analyses your spoken answers for pace, filler words and pauses, and tells you what to fix.',
    perks: ['voice', 'feedback', 'retry', 'analytics', 'coach'],
  },
  detailedFeedback: {
    eyebrow: 'PRO FEATURE', title: 'See exactly what cost you marks',
    body: 'Pro shows line-by-line feedback, what was missing, and an ideal answer to compare against.',
    perks: ['feedback', 'retry', 'voice', 'blind', 'coach'],
  },
  retryQuestion: {
    eyebrow: 'PRO FEATURE', title: 'Re-evaluate any answer',
    body: 'Get a fresh AI pass on an answer and see the difference between yours and the ideal one.',
    perks: ['retry', 'feedback', 'voice', 'blind', 'coach'],
  },
  aiCoach: {
    eyebrow: 'PRO FEATURE', title: 'A coach that knows your sessions',
    body: 'The AI Coach reads your history and tells you what to practise next, and why.',
    perks: ['coach', 'blind', 'analytics', 'feedback', 'volume'],
  },
  fullAnalytics: {
    eyebrow: 'PRO FEATURE', title: 'Your full readiness picture',
    body: 'Unlock your IRS score, salary-tier chart and complete history, not just the last 7 days.',
    perks: ['analytics', 'blind', 'coach', 'feedback', 'volume'],
  },
  blindSpots: {
    eyebrow: 'PRO FEATURE', title: 'Find the gaps you keep repeating',
    body: 'Blind spot detection looks across your last 10 sessions for topics that keep costing you points.',
    perks: ['blind', 'analytics', 'coach', 'feedback', 'volume'],
  },
  sessionWarmup: {
    eyebrow: 'PRO FEATURE', title: 'See how your sessions warm up',
    body: 'Warmup analysis shows whether you start slow, and which question positions cost you the most.',
    perks: ['blind', 'analytics', 'coach', 'feedback', 'volume'],
  },
  scorecardDownload: {
    eyebrow: 'PRO FEATURE', title: 'Download your scorecard',
    body: 'Save your result as a shareable PNG for LinkedIn, your resume or your placement cell.',
    perks: ['download', 'analytics', 'history', 'feedback', 'volume'],
  },
  fullHistory: {
    eyebrow: 'PRO FEATURE', title: 'Get your full history back',
    body: 'Free shows your last 7 days. Pro lists every interview you have done, with all of your past results.',
    perks: ['history', 'analytics', 'feedback', 'coach', 'volume'],
  },
};
const GENERIC_COPY = {
  eyebrow: 'MOCKMATE PRO', title: 'Unlock the full MockMate',
  body: 'Everything you need to walk into placement season ready.',
  perks: DEFAULT_PERK_ORDER,
};

const MODAL_CSS = `
  @keyframes umBackdropIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes umSheetIn    { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes umSheetUp    { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes umMeshDrift  { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-3%,3%) rotate(6deg); } }
  @keyframes umSheen      { 0% { transform: translateX(-120%) skewX(-14deg); } 100% { transform: translateX(520%) skewX(-14deg); } }
  @keyframes umPanelIn    { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes umDraw       { from { stroke-dashoffset: 120; } to { stroke-dashoffset: 0; } }
  @keyframes umGrow       { from { transform: scaleY(.15); } to { transform: scaleY(1); } }

  .um-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    background: rgba(10,22,40,.5);
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
    padding: 16px;
    animation: umBackdropIn .18s ease;
  }
  .um-sheet {
    position: relative; width: 100%; max-width: 500px;
    border-radius: 24px; border: 1px solid rgba(210,222,248,.9);
    background: #fff;
    box-shadow: 0 30px 70px rgba(0,31,107,.24), 0 6px 18px rgba(0,31,107,.1);
    overflow: hidden; font-family: ${F.body};
    max-height: min(780px, calc(100vh - 32px)); max-height: min(780px, calc(100dvh - 32px));
    display: flex; flex-direction: column;
    animation: umSheetIn .28s cubic-bezier(.22,1,.36,1);
    will-change: transform;
  }
  .um-sheet:focus { outline: none; }

  /* drag handle: mobile only */
  .um-grab { display: none; }

  .um-scroll { overflow-y: auto; flex: 1 1 auto; min-height: 0; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }

  .um-mesh { position: relative; overflow: hidden; padding: 24px 60px 18px 24px; background: linear-gradient(180deg, ${C.brand50} 0%, #fff 100%); }
  .um-mesh::before {
    content: ''; position: absolute; inset: -40%;
    background:
      radial-gradient(circle at 16% 24%, rgba(26,110,255,.20), transparent 44%),
      radial-gradient(circle at 84% 12%, rgba(0,200,240,.16), transparent 42%),
      radial-gradient(circle at 62% 88%, rgba(109,91,238,.10), transparent 48%);
    animation: umMeshDrift 14s ease-in-out infinite; pointer-events: none;
  }
  .um-mesh-inner { position: relative; z-index: 1; display: flex; gap: 14px; align-items: flex-start; }
  .um-badge-icon {
    width: 48px; height: 48px; border-radius: 15px; flex-shrink: 0;
    background: linear-gradient(135deg, ${C.brand500}, ${C.brand700});
    display: flex; align-items: center; justify-content: center; color: #fff;
    box-shadow: 0 8px 20px rgba(26,110,255,.34), inset 0 1px 0 rgba(255,255,255,.3);
  }
  .um-eyebrow { font-family: ${F.mono}; font-size: 10px; font-weight: 800; letter-spacing: .14em; color: ${C.brand600}; margin-bottom: 6px; }
  .um-title { font-family: ${F.display}; font-size: 21px; font-weight: 800; letter-spacing: -.02em; color: ${C.text}; margin: 0 0 6px; line-height: 1.22; }
  .um-subtitle { font-size: 13.5px; color: ${C.textSub}; margin: 0; line-height: 1.55; }

  .um-close {
    position: absolute; top: 14px; right: 14px; width: 38px; height: 38px; border-radius: 12px; z-index: 4;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid ${C.border}; background: rgba(255,255,255,.92); color: ${C.textMuted}; cursor: pointer;
    transition: background .14s, color .14s, border-color .14s;
  }
  .um-close:hover { background: ${C.dangerTint}; color: ${C.danger}; border-color: rgba(220,38,38,.2); }

  .um-pad { padding: 4px 24px 16px; }
  .um-label { font-family: ${F.mono}; font-size: 10px; font-weight: 800; letter-spacing: .14em; color: ${C.textMuted}; margin: 14px 0 10px; }

  /* perk chips */
  .um-chips { display: flex; gap: 8px; overflow-x: auto; padding: 2px 24px 6px; margin: 0 -24px; scroll-snap-type: x proximity; scroll-padding-inline: 24px; scrollbar-width: none; }
  .um-chips::-webkit-scrollbar { display: none; }
  .um-chip {
    flex: 0 0 auto; scroll-snap-align: start; display: inline-flex; align-items: center; gap: 7px;
    height: 38px; padding: 0 13px 0 9px; border-radius: 12px; cursor: pointer;
    border: 1px solid ${C.border}; background: #fff; color: ${C.textSub};
    font-family: ${F.body}; font-size: 12.5px; font-weight: 600; white-space: nowrap;
    transition: all .16s ease;
  }
  .um-chip:hover { border-color: ${C.brand200}; background: ${C.brand50}; }
  .um-chip-ic { width: 22px; height: 22px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: ${C.brand50}; color: ${C.brand600}; transition: all .16s; }
  .um-chip[aria-selected="true"] { background: ${C.brand500}; border-color: ${C.brand500}; color: #fff; box-shadow: 0 6px 16px rgba(26,110,255,.3); }
  .um-chip[aria-selected="true"] .um-chip-ic { background: rgba(255,255,255,.2); color: #fff; }

  /* detail panel */
  .um-panel {
    margin-top: 8px; border-radius: 18px; border: 1px solid ${C.brand100}; background: linear-gradient(180deg, ${C.brand50}, #fff);
    padding: 14px; display: flex; gap: 14px; align-items: center; animation: umPanelIn .24s ease;
  }
  .um-panel-copy { flex: 1 1 0; min-width: 0; }
  .um-panel-title { font-family: ${F.display}; font-size: 14.5px; font-weight: 800; color: ${C.text}; margin: 0 0 4px; }
  .um-panel-body { font-size: 13px; line-height: 1.55; color: ${C.textSub}; margin: 0; }
  .um-viz { flex: 0 0 124px; height: 84px; border-radius: 14px; background: #fff; border: 1px solid ${C.border}; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  .um-viz-tag { position: absolute; top: 5px; right: 6px; font-family: ${F.mono}; font-size: 8px; font-weight: 800; letter-spacing: .1em; color: ${C.textFaint}; }
  .um-viz svg { overflow: visible; }
  .um-line { stroke-dasharray: 120; animation: umDraw .9s ease forwards; }
  .um-bar { transform-origin: bottom; transform-box: fill-box; animation: umGrow .6s cubic-bezier(.22,1,.36,1) backwards; }

  .um-also { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin: 12px 0 0; padding: 0; list-style: none; }
  .um-also li { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: ${C.textSub}; line-height: 1.35; }
  .um-also svg { color: ${C.success}; flex-shrink: 0; }

  /* plan picker */
  .um-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .um-plan {
    position: relative; text-align: left; padding: 12px 10px 10px; border-radius: 14px; cursor: pointer;
    border: 1.5px solid ${C.border}; background: #fff; font-family: ${F.body};
    transition: border-color .15s, box-shadow .15s, transform .15s, background .15s;
  }
  .um-plan:hover { border-color: ${C.brand200}; transform: translateY(-1px); }
  .um-plan[aria-checked="true"] { border-color: ${C.brand500}; background: ${C.brand50}; box-shadow: 0 0 0 3px rgba(26,110,255,.14); }
  .um-plan-l { font-size: 11.5px; font-weight: 700; color: ${C.textMuted}; }
  .um-plan-p { font-family: ${F.display}; font-size: 19px; font-weight: 900; letter-spacing: -.02em; color: ${C.text}; margin: 2px 0; }
  .um-plan-s { font-size: 10.5px; color: ${C.textMuted}; line-height: 1.3; }
  .um-plan-b { position: absolute; top: -9px; left: 10px; font-size: 9.5px; font-weight: 800; letter-spacing: .02em; padding: 2px 8px; border-radius: 99px; background: ${C.successTint}; color: ${C.success}; border: 1px solid rgba(5,150,105,.2); white-space: nowrap; }
  .um-plan[aria-checked="true"] .um-plan-b { background: ${C.brand500}; color: #fff; border-color: transparent; }

  .um-foot { flex: 0 0 auto; padding: 12px 24px calc(14px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid ${C.border}; background: #fff; box-shadow: 0 -12px 20px -14px rgba(0,31,107,.18); }
  .um-cta {
    position: relative; overflow: hidden; width: 100%; min-height: 50px; border: none; border-radius: 14px; cursor: pointer;
    background: linear-gradient(135deg, ${C.brand500}, ${C.brand700}); color: #fff;
    font-family: ${F.display}; font-size: 15px; font-weight: 800;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    box-shadow: 0 8px 22px rgba(26,110,255,.34);
    transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s, filter .18s;
  }
  .um-cta:hover { transform: translateY(-1.5px); filter: brightness(1.04); box-shadow: 0 12px 28px rgba(26,110,255,.42); }
  .um-cta:hover .um-cta-sheen { animation: umSheen .9s ease-out; }
  .um-cta:active { transform: scale(.985); }
  .um-cta-sheen { position: absolute; top: -20%; bottom: -20%; left: -30%; width: 14%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent); transform: skewX(-14deg) translateX(-120%); pointer-events: none; }
  .um-ghost { width: 100%; margin-top: 6px; padding: 10px 0; border: none; background: transparent; color: ${C.textMuted}; font-family: ${F.body}; font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 10px; }
  .um-ghost:hover { color: ${C.textSub}; background: ${C.surfaceAlt}; }
  .um-foot-note { text-align: center; font-size: 11px; color: ${C.textFaint}; margin: 4px 0 0; line-height: 1.4; }
  .um-cta:focus-visible, .um-ghost:focus-visible, .um-close:focus-visible, .um-chip:focus-visible, .um-plan:focus-visible { outline: 2px solid ${C.brand500}; outline-offset: 2px; }

  @media (max-width: 560px) {
    .um-backdrop { align-items: flex-end; padding: 0; }
    .um-sheet { max-width: none; border-radius: 26px 26px 0 0; border-bottom: none; max-height: 92vh; max-height: 92dvh; animation: umSheetUp .32s cubic-bezier(.22,1,.36,1); }
    .um-grab { display: block; padding: 10px 0 2px; touch-action: none; cursor: grab; background: ${C.brand50}; }
    .um-grab::after { content: ''; display: block; width: 40px; height: 5px; border-radius: 99px; background: ${C.borderMd}; margin: 0 auto; }
    .um-mesh { padding: 14px 58px 14px 18px; }
    .um-mesh-inner { gap: 12px; }
    .um-badge-icon { width: 42px; height: 42px; border-radius: 13px; }
    .um-title { font-size: 18.5px; }
    .um-close { top: 18px; right: 12px; }
    .um-pad { padding: 2px 18px 14px; }
    .um-chips { padding: 2px 18px 6px; margin: 0 -18px; scroll-padding-inline: 18px; }
    .um-panel { flex-direction: column; align-items: stretch; }
    .um-viz { flex-basis: auto; width: 100%; height: 76px; order: -1; }
    .um-also { grid-template-columns: 1fr; }
    .um-plan { padding: 12px 8px 10px; }
    .um-plan-p { font-size: 17px; }
    .um-foot { padding: 10px 18px calc(12px + env(safe-area-inset-bottom, 0px)); }
    .um-ghost { display: none; }
  }
  @media (max-width: 360px) { .um-plans { grid-template-columns: 1fr; } .um-plan { display: flex; align-items: center; gap: 10px; } .um-plan-b { position: static; } }
  @media (prefers-reduced-motion: reduce) {
    .um-backdrop, .um-sheet, .um-mesh::before, .um-panel, .um-line, .um-bar { animation: none !important; }
    .um-line { stroke-dashoffset: 0; }
  }
`;

const PerkIcon = ({ name, size = 14 }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    infinity: <path d="M18.2 8.5a3.5 3.5 0 1 1 0 7c-2 0-3.5-1.6-6.2-5C9.3 14 7.8 15.5 5.8 15.5a3.5 3.5 0 1 1 0-7c2 0 3.5 1.6 6.2 5 2.7-3.4 4.2-5 6.2-5Z"/>,
    layers:   <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></>,
    chat:     <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"/>,
    chart:    <><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/></>,
    target:   <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></>,
    refresh:  <><path d="M4 12a8 8 0 0 1 14.5-4.7M20 12a8 8 0 0 1-14.5 4.7"/><path d="M18.5 4v4h-4M5.5 20v-4h4"/></>,
    download: <><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></>,
    mic:      <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></>,
    spark:    <><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8L19 15Z"/></>,
    clock:    <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
    check:    <path d="m5 12.5 4.5 4.5L19 7.5"/>,
  };
  return <svg {...common} aria-hidden="true">{paths[name] || paths.chat}</svg>;
};

// Tiny illustrations. Generic shapes only, never a copy of anyone's real data.
const Viz = ({ kind }) => {
  const b = C.brand500; const a = C.accent400; const soft = C.brand100;
  const svg = (children) => <svg width="104" height="62" viewBox="0 0 104 62" aria-hidden="true">{children}</svg>;
  if (kind === 'chart') return svg(<>
    <path d="M4 56h96" stroke={soft} strokeWidth="1.5"/>
    <path className="um-line" d="M6 46 24 38 40 42 58 24 76 28 98 8" fill="none" stroke={b} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="98" cy="8" r="4" fill={a}/>
  </>);
  if (kind === 'bars') return svg(<>
    {[18, 30, 24, 40, 52].map((h, i) => <rect key={i} className="um-bar" style={{ animationDelay: `${i * 60}ms` }} x={8 + i * 20} y={58 - h} width="13" height={h} rx="4" fill={i === 4 ? b : soft}/>)}
  </>);
  if (kind === 'lines') return svg(<>
    <rect x="4" y="6" width="96" height="9" rx="4.5" fill={soft}/>
    <rect x="4" y="22" width="72" height="9" rx="4.5" fill={soft}/>
    <rect x="4" y="38" width="86" height="9" rx="4.5" fill={b} opacity=".85"/>
    <circle cx="96" cy="42" r="5" fill={C.success}/>
  </>);
  if (kind === 'wave') return svg(<>
    {[10, 22, 34, 18, 44, 30, 14, 38, 24, 12].map((h, i) => <rect key={i} className="um-bar" style={{ animationDelay: `${i * 40}ms` }} x={5 + i * 10} y={31 - h / 2} width="5" height={h} rx="2.5" fill={i % 3 === 0 ? b : a}/>)}
  </>);
  if (kind === 'chat') return svg(<>
    <rect x="4" y="6" width="64" height="18" rx="9" fill={soft}/>
    <rect x="34" y="32" width="66" height="20" rx="10" fill={b}/>
    <circle cx="48" cy="42" r="2.2" fill="#fff"/><circle cx="58" cy="42" r="2.2" fill="#fff"/><circle cx="68" cy="42" r="2.2" fill="#fff"/>
  </>);
  if (kind === 'target') return svg(<>
    <circle cx="52" cy="31" r="26" fill="none" stroke={soft} strokeWidth="3"/>
    <circle cx="52" cy="31" r="16" fill="none" stroke={a} strokeWidth="3"/>
    <circle cx="52" cy="31" r="6" fill={b}/>
  </>);
  return svg(<>
    <rect x="12" y="4" width="80" height="54" rx="9" fill="#fff" stroke={soft} strokeWidth="2"/>
    <circle cx="34" cy="26" r="10" fill="none" stroke={b} strokeWidth="4"/>
    <rect x="52" y="20" width="32" height="6" rx="3" fill={soft}/>
    <rect x="52" y="32" width="22" height="6" rx="3" fill={soft}/>
  </>);
};

export default function UpgradeModal({ open, onClose, feature, trialUsed, resetsAt }) {
  const navigate = useNavigate();
  const sheetRef = useRef(null);
  const returnFocusRef = useRef(null);
  const dragRef = useRef({ y: 0, active: false });
  const copy = FEATURE_COPY[feature] || GENERIC_COPY;
  const [activePerk, setActivePerk] = useState(copy.perks[0]);
  const [planKey, setPlanKey] = useState(DEFAULT_PLAN);

  // Each time the modal opens (or the trigger changes) start on the perk the user came for.
  useEffect(() => {
    if (open) { setActivePerk((FEATURE_COPY[feature] || GENERIC_COPY).perks[0]); setPlanKey(DEFAULT_PLAN); }
  }, [open, feature]);

  // Escape to close, Tab stays inside, lock background scroll, restore focus on close.
  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const f = sheetRef.current.querySelectorAll('button:not([disabled])');
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => sheetRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const isLimit = feature === 'dailyInterviewLimit';
  const isMode = typeof feature === 'string' && feature.startsWith('mode_');
  const eyebrow = isMode && trialUsed ? 'FREE TRIAL USED' : copy.eyebrow;
  const body = isMode && trialUsed ? `You've tried this mode once. ${copy.body}` : copy.body;
  const plan = PLANS.find((p) => p.key === planKey) || PLANS[2];
  const active = PERKS[activePerk] ? activePerk : copy.perks[0];
  const others = copy.perks.filter((id) => id !== active && PERKS[id]);

  const handleUpgrade = () => {
    onClose?.();
    navigate('/pricing', { state: { from: feature || 'generic', plan: planKey } });
  };
  const handleBackdropClick = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  // Swipe the handle down to dismiss (mobile bottom sheet).
  const onDragStart = (e) => { dragRef.current = { y: e.touches[0].clientY, active: true }; if (sheetRef.current) sheetRef.current.style.transition = 'none'; };
  const onDragMove = (e) => {
    if (!dragRef.current.active || !sheetRef.current) return;
    const dy = Math.max(0, e.touches[0].clientY - dragRef.current.y);
    sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onDragEnd = (e) => {
    if (!dragRef.current.active || !sheetRef.current) return;
    dragRef.current.active = false;
    const dy = Math.max(0, (e.changedTouches?.[0]?.clientY ?? 0) - dragRef.current.y);
    sheetRef.current.style.transition = 'transform .2s ease';
    if (dy > 90) onClose?.(); else sheetRef.current.style.transform = '';
  };

  return (
    <>
      <style>{MODAL_CSS}</style>
      <div className="um-backdrop" role="dialog" aria-modal="true" aria-labelledby="um-title" onClick={handleBackdropClick}>
        <div className="um-sheet" ref={sheetRef} tabIndex={-1}>
          <div className="um-grab" onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd} aria-hidden="true" />
          <button className="um-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>

          <div className="um-scroll">
            <div className="um-mesh">
              <div className="um-mesh-inner">
                <div className="um-badge-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="um-eyebrow">{eyebrow}</div>
                  <h2 className="um-title" id="um-title">{copy.title}</h2>
                  <p className="um-subtitle">{body}</p>
                </div>
              </div>
            </div>

            <div className="um-pad">
              <p className="um-label">TAP TO SEE WHAT YOU GET</p>
              <div className="um-chips" role="tablist" aria-label="Pro features">
                {copy.perks.map((id) => PERKS[id] && (
                  <button key={id} type="button" role="tab" id={`um-tab-${id}`} aria-selected={id === active} aria-controls="um-panel" className="um-chip" onClick={() => setActivePerk(id)}>
                    <span className="um-chip-ic"><PerkIcon name={PERKS[id].icon} size={13} /></span>
                    {PERK_SHORT[id]}
                  </button>
                ))}
              </div>

              <div className="um-panel" id="um-panel" role="tabpanel" aria-labelledby={`um-tab-${active}`} key={active}>
                <div className="um-panel-copy">
                  <h3 className="um-panel-title">{PERKS[active].label}</h3>
                  <p className="um-panel-body">{PERK_DETAIL[active]}</p>
                </div>
                <div className="um-viz"><span className="um-viz-tag">EXAMPLE</span><Viz kind={PERK_VISUAL[active]} /></div>
              </div>

              {others.length > 0 && (
                <ul className="um-also" aria-label="Also included">
                  {others.slice(0, 4).map((id) => (
                    <li key={id}><PerkIcon name="check" size={13} />{PERKS[id].label}</li>
                  ))}
                </ul>
              )}

              <p className="um-label">CHOOSE YOUR PLAN</p>
              <div className="um-plans" role="radiogroup" aria-label="Plan length">
                {PLANS.map((p) => (
                  <button key={p.key} type="button" role="radio" aria-checked={p.key === planKey} className="um-plan" onClick={() => setPlanKey(p.key)}>
                    <span className="um-plan-b">{p.badge}</span>
                    <div className="um-plan-l">{p.label}</div>
                    <div className="um-plan-p">{p.price}</div>
                    <div className="um-plan-s">{p.per}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="um-foot">
            <button className="um-cta" onClick={handleUpgrade}>
              <span className="um-cta-sheen" />
              {isLimit ? `Go unlimited · ${plan.price}` : `Continue with Pro · ${plan.price}`}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
            </button>
            <button className="um-ghost" onClick={onClose}>
              {isLimit && resetsAt ? `Not now · free interviews reset in ${timeUntil(resetsAt)}` : 'Maybe later'}
            </button>
            <p className="um-foot-note">One-time payment, no auto-renewal · UPI, cards and netbanking via Razorpay</p>
          </div>
        </div>
      </div>
    </>
  );
}

UpgradeModal.propTypes = {
  open:      PropTypes.bool,
  onClose:   PropTypes.func,
  feature:   PropTypes.string,
  trialUsed: PropTypes.bool,
  resetsAt:  PropTypes.string,
};
