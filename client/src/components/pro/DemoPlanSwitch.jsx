import { useEffect, useRef, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import useUsage from '../../hooks/useUsage';
import { C, F } from '../../styles/token';
import API_BASE from '../../config/api';

/**
 * DemoPlanSwitch — a small floating control for viva / demos.
 * Renders NOTHING unless the server reports demoSwitch: true (i.e. it was started with
 * DEMO_PLAN_SWITCH=true), so it can never appear on a normal deployment.
 * Flips only the signed-in user's own account, then reloads so every page re-reads the plan.
 */
const OPTIONS = [
  { state: 'free',         label: 'Free',           hint: '3/day, 1 mode, basic feedback' },
  { state: 'pro',          label: 'Pro (30 days)',  hint: 'Everything unlocked' },
  { state: 'expired',      label: 'Expired Pro',    hint: 'Shows the downgrade behaviour' },
  { state: 'reset-trials', label: 'Reset mode trials', hint: 'Get the "try once" badges back' },
];

export default function DemoPlanSwitch() {
  const { user } = useAuth() || {};
  const { usage } = useUsage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  if (!user || !usage?.demoSwitch) return null;

  const current = usage.expired ? 'Expired Pro' : usage.isPro ? 'Pro' : 'Free';

  const apply = async (state) => {
    setBusy(state); setError('');
    try {
      const res = await fetch(`${API_BASE}/payment/demo-plan`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      if (!res.ok) throw new Error(String(res.status));
      window.location.reload();
    } catch {
      setError('Could not switch. Is DEMO_PLAN_SWITCH=true on the server?');
      setBusy('');
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'fixed', left: 14, bottom: 14, zIndex: 9000, fontFamily: F.body }}>
      {open && (
        <div role="menu" aria-label="Demo plan switch" style={{ width: 250, marginBottom: 8, padding: 8, borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 16px 40px rgba(15,23,42,.18)' }}>
          <div style={{ padding: '6px 8px 8px', fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em', color: C.textMuted }}>DEMO MODE · YOUR ACCOUNT ONLY</div>
          {OPTIONS.map((o) => (
            <button key={o.state} type="button" role="menuitem" disabled={Boolean(busy)} onClick={() => apply(o.state)}
              style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, border: 'none', background: 'transparent', cursor: busy ? 'wait' : 'pointer', opacity: busy && busy !== o.state ? 0.5 : 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{busy === o.state ? 'Switching…' : o.label}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>{o.hint}</div>
            </button>
          ))}
          {error && <div role="alert" style={{ padding: '6px 10px 4px', fontSize: 11.5, color: C.danger }}>{error}</div>}
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 13px', borderRadius: 99, border: `1px solid ${C.borderMd}`, background: C.surface, color: C.textSub, cursor: 'pointer', fontSize: 12, fontWeight: 700, boxShadow: '0 4px 14px rgba(15,23,42,.12)' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: usage.isPro ? C.success : C.warning }} />
        Demo: {current}
      </button>
    </div>
  );
}
