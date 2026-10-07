import { useNavigate } from 'react-router-dom';
import usePlan from '../../hooks/usePlan';
import useUsage from '../../hooks/useUsage';
import { C, F } from '../../styles/token';
import UsageMeter from './UsageMeter';

/**
 * PlanStrip — a slim status card at the top of the Dashboard for FREE users:
 * how many free interviews are left today, and one clear way to see Pro. Pro users see nothing.
 * Renders nothing until the server answers, so it never flashes a wrong number.
 * On phones the button goes full-width under the meter so neither is ever squeezed.
 */
export default function PlanStrip() {
  const { isPro } = usePlan();
  const { usage } = useUsage();
  const navigate = useNavigate();
  if (isPro || !usage?.daily) return null;

  return (
    <div className="ps-strip" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px 12px 16px', borderRadius: 16, marginBottom: 12, background: `linear-gradient(135deg, ${C.surface}, ${C.brand50} 140%)`, border: `1px solid ${C.border}`, fontFamily: F.body }}>
      <style>{`
        .ps-cta { transition: transform .15s ease, filter .15s ease; }
        .ps-cta:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .ps-cta:active { transform: scale(.985); }
        .ps-cta:focus-visible { outline: 2.5px solid ${C.brand500}; outline-offset: 2px; }
        @media (max-width: 560px) { .ps-strip { padding: 12px !important; } .ps-cta { width: 100%; } }
        @media (prefers-reduced-motion: reduce) { .ps-cta { transition: none !important; } }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: C.brand600, background: C.brand50, border: `1px solid ${C.brand100}`, borderRadius: 99, padding: '4px 9px' }}>FREE PLAN</span>
        <UsageMeter daily={usage.daily} />
      </div>
      <button type="button" className="ps-cta" onClick={() => navigate('/pricing', { state: { from: 'dashboard' } })}
        style={{ minHeight: 40, padding: '0 18px', borderRadius: 11, border: 'none', background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', cursor: 'pointer', fontFamily: F.display, fontSize: 13, fontWeight: 800, boxShadow: '0 6px 16px rgba(26,110,255,.26)', whiteSpace: 'nowrap' }}>
        See what Pro adds
      </button>
    </div>
  );
}
