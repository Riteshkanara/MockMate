import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { C, F } from '../../styles/token';
import { getPlanStatus } from '../../utils/planHelpers';
import ProBadge from './ProBadge';

/**
 * PlanStatusBanner — one calm card when a paid plan is about to end, or already has.
 * Pro here is a one-time payment with NO auto-renewal, so a heads-up is genuinely useful
 * (nobody is surprised by a charge; they are reminded before access drops).
 *
 * Never shown: on Pricing (they're already there), during an interview, or on public/auth
 * pages. Dismissal is remembered for this browser session and is per expiry date.
 */
const HIDDEN_PREFIXES = ['/pricing', '/interview', '/onboarding', '/auth', '/p/'];

const storageKey = (kind, key) => `mm_plan_banner:${kind}:${key}`;
const readDismissed = (k) => { try { return sessionStorage.getItem(k) === '1'; } catch { return false; } };
const writeDismissed = (k) => { try { sessionStorage.setItem(k, '1'); } catch { /* storage unavailable: banner just returns next visit */ } };

export default function PlanStatusBanner() {
  const { user } = useAuth() || {};
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const status = getPlanStatus(user);
  const key = status.kind ? storageKey(status.kind, status.expiryKey) : null;
  const [dismissed, setDismissed] = useState(() => (key ? readDismissed(key) : false));

  useEffect(() => { setDismissed(key ? readDismissed(key) : false); }, [key]);

  const hidden = pathname === '/' || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  if (!user || !status.kind || dismissed || hidden) return null;

  const expired = status.kind === 'expired';
  const title = expired
    ? 'Your Pro plan has ended'
    : `Pro ends in ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'}`;
  const body = expired
    ? `It ended on ${status.dateLabel}. You are on Free limits now, and everything you have done is saved.`
    : `Your plan runs until ${status.dateLabel} and does not renew by itself.`;

  const close = () => { writeDismissed(key); setDismissed(true); };

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 16, zIndex: 8000,
        width: 'min(560px, calc(100vw - 24px))', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 16, background: C.surface, fontFamily: F.body,
        border: `1px solid ${expired ? '#F5C58A' : C.brand100}`, boxShadow: '0 16px 44px rgba(15,23,42,.20)',
      }}
    >
      <ProBadge variant={expired ? 'lock' : 'pro'} label={expired ? 'ENDED' : undefined} size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F.display, fontSize: 13.5, fontWeight: 800, color: C.text }}>{title}</div>
        <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.45, marginTop: 1 }}>{body}</div>
      </div>
      <button
        type="button"
        onClick={() => { navigate('/pricing', { state: { from: 'expired' } }); }}
        style={{ height: 36, padding: '0 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: C.brand500, color: '#fff', fontFamily: F.display, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}
      >
        Renew Pro
      </button>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
