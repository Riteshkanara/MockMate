import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import usePlan from '../../hooks/usePlan';
import { C, F } from '../../styles/token';
import { PRO_WELCOME_KEY, fmtDate } from '../../utils/planHelpers';
import ProBadge from './ProBadge';
import ProIcon from './ProIcon';

/**
 * ProWelcome — the moment after a successful payment.
 * Pricing sets a short-lived flag once the payment is VERIFIED; this shows once when the
 * app actually sees the Pro plan, then clears the flag. It answers the only question a new
 * subscriber has: "what can I do now?", with one tap to each of the biggest unlocks.
 */
const readFlag = () => {
  try {
    const raw = sessionStorage.getItem(PRO_WELCOME_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < 10 * 60 * 1000; // fresh for 10 minutes
  } catch { return false; }
};
const clearFlag = () => { try { sessionStorage.removeItem(PRO_WELCOME_KEY); } catch { /* nothing to clear */ } };

const ACTIONS = [
  { icon: 'bolt',         title: 'Start a Full Mock',    desc: 'A 10-question placement-style round',  to: '/interview' },
  { icon: 'spark',     title: 'Open the AI Coach',    desc: 'Your plan, built from your sessions',  to: '/coach' },
  { icon: 'radar',  title: 'See full analytics',   desc: 'Readiness score, tiers and blind spots', to: '/analytics' },
];

export default function ProWelcome() {
  const { user } = useAuth() || {};
  const { isPro } = usePlan();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  useEffect(() => {
    if (isPro && readFlag()) { clearFlag(); setOpen(true); }
  }, [isPro]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => btnRef.current?.focus(), 30);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  const go = (to) => { setOpen(false); navigate(to); };
  const until = user?.planExpiry ? fmtDate(user.planExpiry) : null;

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="pw-title"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(6,14,32,.55)', backdropFilter: 'blur(4px)' }}
    >
      <div style={{ width: 'min(460px, 100%)', maxHeight: '92vh', overflowY: 'auto', borderRadius: 24, background: C.surface, boxShadow: '0 30px 80px rgba(6,14,32,.4)', fontFamily: F.body }}>
        <div style={{ padding: '26px 26px 20px', textAlign: 'center', color: '#fff', background: `linear-gradient(135deg, ${C.brand700}, ${C.brand500} 70%, ${C.accent600})`, borderRadius: '24px 24px 0 0' }}>
          <div aria-hidden="true" style={{ width: 52, height: 52, margin: '0 auto 12px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
          </div>
          <h2 id="pw-title" style={{ margin: 0, fontFamily: F.display, fontSize: 24, fontWeight: 900, letterSpacing: '-.5px' }}>You&apos;re on Pro</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,.9)' }}>
            Everything is unlocked, including your past sessions.{until ? ` Active until ${until}.` : ''}
          </p>
        </div>

        <div style={{ padding: '18px 22px 22px' }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: C.textMuted, marginBottom: 8 }}>START WITH ONE OF THESE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ACTIONS.map((a, i) => (
              <button key={a.to} ref={i === 0 ? btnRef : undefined} type="button" onClick={() => go(a.to)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', border: `1px solid ${i === 0 ? C.brand100 : C.border}`, background: i === 0 ? C.brand50 : C.surface }}>
                <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: i === 0 ? C.brand500 : C.brand50, color: i === 0 ? '#fff' : C.brand600 }}>
                  <ProIcon name={a.icon} size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.text }}>{a.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: C.textSub, marginTop: 1 }}>{a.desc}</span>
                </span>
                <span aria-hidden="true" style={{ color: C.textMuted }}>→</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: C.textMuted }}><ProBadge variant="pro" /> One-time payment, no auto-renewal</span>
            <button type="button" onClick={() => setOpen(false)} style={{ height: 34, padding: '0 14px', borderRadius: 10, border: 'none', background: 'transparent', color: C.textSub, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
