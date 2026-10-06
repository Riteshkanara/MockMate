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

import { useEffect, useRef } from 'react';
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
  @keyframes umSheetIn    { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes umMeshDrift  { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-3%,3%) rotate(6deg); } }
  @keyframes umSheen      { 0% { transform: translateX(-120%) skewX(-14deg); } 100% { transform: translateX(260%) skewX(-14deg); } }
  @keyframes umPerkRise   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }

  .um-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    background: rgba(10,22,40,0.55);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    padding: 16px;
    animation: umBackdropIn .18s ease;
  }

  .um-sheet {
    position: relative;
    width: 100%; max-width: 440px;
    border-radius: 22px;
    border: 1px solid rgba(210,222,248,.9);
    background: rgba(255,255,255,.98);
    box-shadow: 0 28px 64px rgba(0,31,107,.22), 0 6px 18px rgba(0,31,107,.1), inset 0 1px 0 rgba(255,255,255,.95);
    overflow: hidden;
    animation: umSheetIn .26s cubic-bezier(.22,1,.36,1);
    font-family: ${F.body};
    max-height: min(780px, calc(100vh - 32px));
    max-height: min(780px, calc(100dvh - 32px));
    display: flex;
    flex-direction: column;
  }

  .um-mesh {
    position: relative; overflow: hidden;
    padding: 22px 26px 18px;
    border-bottom: 1px solid ${C.border};
    flex-shrink: 0;
  }
  .um-mesh::before {
    content: '';
    position: absolute; inset: -40%;
    background:
      radial-gradient(circle at 18% 22%, rgba(26,110,255,.16), transparent 45%),
      radial-gradient(circle at 82% 15%, rgba(0,200,240,.14), transparent 42%),
      radial-gradient(circle at 60% 85%, rgba(108,92,232,.10), transparent 48%);
    animation: umMeshDrift 14s ease-in-out infinite;
    pointer-events: none;
  }
  .um-mesh-inner { position: relative; z-index: 1; }

  .um-close {
    position: absolute; top: 14px; right: 14px;
    width: 30px; height: 30px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid ${C.border}; background: rgba(255,255,255,.9);
    color: ${C.textMuted}; cursor: pointer; z-index: 2;
    transition: background .14s ease, color .14s ease, border-color .14s ease;
  }
  .um-close:hover { background: ${C.dangerTint}; color: ${C.danger}; border-color: rgba(220,38,38,.2); }

  .um-badge-icon {
    width: 46px; height: 46px; border-radius: 14px;
    background: linear-gradient(135deg, ${C.brand500} 0%, ${C.brand700} 100%);
    display: flex; align-items: center; justify-content: center;
    color: #fff; margin-bottom: 14px;
    box-shadow: 0 6px 18px rgba(26,110,255,.32), inset 0 1px 0 rgba(255,255,255,.3);
  }

  .um-title {
    font-family: ${F.display};
    font-size: 20px; font-weight: 800; letter-spacing: -.01em;
    color: ${C.text}; margin: 0 0 6px; line-height: 1.25;
  }
  .um-subtitle { font-size: 13.5px; color: ${C.textSub}; margin: 0; line-height: 1.55; }
  .um-subtitle b { color: ${C.text}; }

  .um-body { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; padding: 0; }
  .um-scroll { padding: 16px 26px 6px; overflow-y: auto; min-height: 0; flex: 1 1 auto; overscroll-behavior: contain; }
  .um-foot { flex: 0 0 auto; padding: 12px 26px 16px; border-top: 1px solid ${C.border}; background: rgba(255,255,255,.98); }

  .um-perks { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 2px; }
  .um-perk {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 4px; border-radius: 10px;
    animation: umPerkRise .3s cubic-bezier(.22,1,.36,1) backwards;
  }
  .um-perk-icon {
    width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: ${C.brand50}; color: ${C.brand600};
    border: 1px solid rgba(26,110,255,.16);
  }
  .um-perk-label { font-size: 13px; color: ${C.textSub}; font-weight: 500; }

  .um-price-row {
    display: flex; align-items: baseline; gap: 6px;
    background: ${C.brand50}; border: 1px solid rgba(26,110,255,.16);
    border-radius: 14px; padding: 12px 16px; margin-bottom: 14px;
  }
  .um-price-amount { font-family: ${F.display}; font-size: 26px; font-weight: 900; color: ${C.brand700}; }
  .um-price-period  { font-size: 12.5px; color: ${C.textMuted}; }
  .um-price-tag {
    margin-left: auto; font-size: 10.5px; font-weight: 700;
    background: ${C.successTint}; color: ${C.success};
    border-radius: 20px; padding: 3px 10px; letter-spacing: .2px;
    white-space: nowrap;
  }

  .um-cta {
    position: relative; overflow: hidden;
    width: 100%; padding: 14px 0;
    border: none; border-radius: 13px;
    background: linear-gradient(135deg, ${C.brand500} 0%, ${C.brand700} 100%);
    color: #fff; font-family: ${F.display};
    font-size: 14.5px; font-weight: 700; letter-spacing: .1px;
    cursor: pointer;
    box-shadow: 0 6px 22px rgba(26,110,255,.32);
    transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s ease, filter .18s ease;
  }
  .um-cta:hover { transform: translateY(-1.5px); filter: saturate(1.05) brightness(1.02); box-shadow: 0 10px 28px rgba(26,110,255,.4); }
  .um-cta:hover .um-cta-sheen { opacity: 1; animation: umSheen .8s ease-out; }
  .um-cta:active { transform: translateY(0) scale(.98); }
  .um-cta-sheen {
    position: absolute; top: -20%; bottom: -20%; left: -40%; width: 26%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
    transform: skewX(-14deg); opacity: 0; pointer-events: none;
  }

  .um-eyebrow {
    display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px;
    font-family: ${F.mono}; font-size: 10px; font-weight: 800; letter-spacing: .12em;
    color: ${C.brand600};
  }
  .um-section-label {
    font-family: ${F.mono}; font-size: 10px; font-weight: 800; letter-spacing: .12em;
    color: ${C.textMuted}; margin: 0 0 8px;
  }
  .um-perk.um-perk-hot .um-perk-icon { background: ${C.brand500}; color: #fff; border-color: transparent; }
  .um-perk.um-perk-hot .um-perk-label { color: ${C.text}; font-weight: 700; }
  .um-plans { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: -6px 0 10px; padding: 0 4px; font-size: 11.5px; color: ${C.textMuted}; }
  .um-plans b { color: ${C.textSub}; font-weight: 700; }
  .um-ghost {
    width: 100%; margin-top: 8px; padding: 10px 0; border: none; background: transparent;
    color: ${C.textMuted}; font-family: ${F.body}; font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 10px;
  }
  .um-ghost:hover { color: ${C.textSub}; background: ${C.surfaceAlt}; }
  .um-sheet:focus { outline: none; }
  .um-cta:focus-visible, .um-ghost:focus-visible, .um-close:focus-visible { outline: 2px solid ${C.brand500}; outline-offset: 2px; }

  .um-footnote {
    text-align: center; font-size: 11px; color: ${C.textFaint};
    margin: 10px 0 0;
  }

  @media (max-width: 480px) {
    .um-mesh { padding: 20px 20px 16px; }
    .um-scroll { padding: 14px 20px 4px; }
    .um-foot { padding: 10px 20px 14px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .um-backdrop, .um-sheet, .um-mesh::before, .um-perk, .um-cta-sheen { animation: none !important; }
  }
`;

const PerkIcon = ({ name, size = 14 }) => {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
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
  };
  return <svg {...common} aria-hidden="true">{paths[name] || paths.chat}</svg>;
};

export default function UpgradeModal({ open, onClose, feature, trialUsed, resetsAt }) {
  const navigate = useNavigate();
  const sheetRef = useRef(null);
  const returnFocusRef = useRef(null);

  // Escape to close, lock background scroll, move focus in and restore it on close.
  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
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

  const copy = FEATURE_COPY[feature] || GENERIC_COPY;
  const isLimit = feature === 'dailyInterviewLimit';
  const isMode = typeof feature === 'string' && feature.startsWith('mode_');
  const hotCount = 1; // the first perk is the one the user came for
  const eyebrow = isMode && trialUsed ? 'FREE TRIAL USED' : copy.eyebrow;
  const body = isMode && trialUsed
    ? `You've tried this mode once. ${copy.body}`
    : copy.body;

  const handleUpgrade = () => {
    onClose?.();
    navigate('/pricing', { state: { from: feature || 'generic' } });
  };
  const handleBackdropClick = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  return (
    <>
      <style>{MODAL_CSS}</style>
      <div className="um-backdrop" role="dialog" aria-modal="true" aria-labelledby="um-title" onClick={handleBackdropClick}>
        <div className="um-sheet" ref={sheetRef} tabIndex={-1}>
          <div className="um-mesh">
            <button className="um-close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
            <div className="um-mesh-inner">
              <div className="um-badge-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                </svg>
              </div>
              <div className="um-eyebrow">{eyebrow}</div>
              <h2 className="um-title" id="um-title">{copy.title}</h2>
              <p className="um-subtitle">{body}</p>
            </div>
          </div>

          <div className="um-body">
            <div className="um-scroll">
            <p className="um-section-label">INCLUDED WITH PRO</p>
            <ul className="um-perks">
              {copy.perks.map((id, i) => {
                const perk = PERKS[id];
                if (!perk) return null;
                return (
                  <li className={`um-perk${i < hotCount ? ' um-perk-hot' : ''}`} key={id} style={{ animationDelay: `${i * 28}ms` }}>
                    <span className="um-perk-icon"><PerkIcon name={perk.icon} /></span>
                    <span className="um-perk-label">{perk.label}</span>
                  </li>
                );
              })}
            </ul>

            <div className="um-price-row">
              <span className="um-price-amount">₹149</span>
              <span className="um-price-period">first month, then ₹199</span>
              <span className="um-price-tag">Intro price</span>
            </div>
            <div className="um-plans">
              <span><b>₹499</b> for 3 months</span>
              <span><b>₹1,499</b> for a year</span>
            </div>
            </div>

            <div className="um-foot">
            <button className="um-cta" onClick={handleUpgrade}>
              <span className="um-cta-sheen" />
              {isLimit ? 'Go unlimited with Pro' : 'See Pro plans'}
            </button>
            <button className="um-ghost" onClick={onClose}>
              {isLimit && resetsAt ? `Not now · free interviews reset in ${timeUntil(resetsAt)}` : 'Maybe later'}
            </button>

            <p className="um-footnote">One-time payment, no auto-renewal · UPI, cards and netbanking via Razorpay</p>
            </div>
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
