/**
 * MockMate — UpgradeModal
 *
 * Visual language matches Navbar.jsx exactly: frosted glass, mesh-gradient
 * header strip, pill accents, brand600→cyan400 CTA gradient. Not a generic
 * modal — it's built from the same tokens and motion curves as the rest
 * of the app chrome.
 *
 * Props:
 *   open     {boolean}
 *   onClose  {function}
 *   feature  {string}   — which gated feature triggered this (drives title)
 *   title    {string?}  — optional override
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, F } from '../styles/tokens';

const FEATURE_LABELS = {
  aiCoach:             'AI Coach',
  fullAnalytics:       'Full Analytics & IRS Score',
  blindSpots:          'Blind Spot Detection',
  sessionWarmup:       'Session Warmup Analysis',
  scorecardDownload:   'Scorecard Download',
  retryQuestion:       'Answer Re-evaluation',
  badges:              'Badge System',
  dailyInterviewLimit: 'Unlimited Daily Interviews',
  mode_mixed:          'Mixed Mode',
  mode_mcq:            'MCQ Mode',
  mode_aptitude:       'Aptitude Mode',
  mode_behavioral:     'Behavioral Mode',
};

const PRO_PERKS = [
  { icon: 'infinity', label: 'Unlimited interviews every day' },
  { icon: 'layers',   label: 'All 5 interview modes unlocked' },
  { icon: 'chat',     label: 'AI Coach with personalised guidance' },
  { icon: 'chart',    label: 'Full analytics, IRS score & tier chart' },
  { icon: 'target',   label: 'Blind spot detection & warmup analysis' },
  { icon: 'refresh',  label: 'Answer re-evaluation' },
  { icon: 'download', label: 'Scorecard PNG download' },
  { icon: 'badge',    label: 'Full badge & streak system' },
];

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
    max-height: min(680px, calc(100vh - 32px));
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

  .um-body { padding: 18px 26px 22px; overflow-y: auto; }

  .um-perks { list-style: none; padding: 0; margin: 0 0 20px; display: flex; flex-direction: column; gap: 2px; }
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
    border-radius: 14px; padding: 12px 16px; margin-bottom: 18px;
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

  .um-footnote {
    text-align: center; font-size: 11px; color: ${C.textFaint};
    margin: 10px 0 0;
  }

  @media (max-width: 480px) {
    .um-mesh { padding: 20px 20px 16px; }
    .um-body { padding: 16px 20px 20px; }
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
    badge:    <><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z"/><path d="M12 12.5V17"/><path d="M9 20h6"/></>,
  };
  return <svg {...common} aria-hidden="true">{paths[name] || paths.chat}</svg>;
};

export default function UpgradeModal({ open, onClose, feature, title }) {
  const navigate = useNavigate();
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const featureLabel = FEATURE_LABELS[feature] || 'this feature';

  const handleUpgrade = () => {
    onClose?.();
    navigate('/pricing');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <>
      <style>{MODAL_CSS}</style>
      <div
        className="um-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade to MockMate Pro"
        onClick={handleBackdropClick}
      >
        <div className="um-sheet" ref={sheetRef}>
          <div className="um-mesh">
            <button className="um-close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>

            <div className="um-mesh-inner">
              <div className="um-badge-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>
                </svg>
              </div>
              <h2 className="um-title">{title || `Unlock ${featureLabel}`}</h2>
              <p className="um-subtitle">
                Upgrade to <b>MockMate Pro</b> for everything you need to walk into placement season ready.
              </p>
            </div>
          </div>

          <div className="um-body">
            <ul className="um-perks">
              {PRO_PERKS.map((perk, i) => (
                <li className="um-perk" key={perk.icon} style={{ animationDelay: `${i * 28}ms` }}>
                  <span className="um-perk-icon"><PerkIcon name={perk.icon} /></span>
                  <span className="um-perk-label">{perk.label}</span>
                </li>
              ))}
            </ul>

            <div className="um-price-row">
              <span className="um-price-amount">₹199</span>
              <span className="um-price-period">/ month</span>
              <span className="um-price-tag">Most popular</span>
            </div>

            <button className="um-cta" onClick={handleUpgrade}>
              <span className="um-cta-sheen" />
              See plans &amp; upgrade
            </button>

            <p className="um-footnote">Cancel anytime · Secure payment via Razorpay</p>
          </div>
        </div>
      </div>
    </>
  );
}