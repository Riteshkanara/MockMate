import { useNavigate } from 'react-router-dom';
import usePlan from '../../hooks/usePlan';
import useUsage from '../../hooks/useUsage';
import { C, F } from '../../styles/token';
import UsageMeter from './UsageMeter';

/**
 * PlanStrip — a slim status card at the top of the Dashboard for FREE users:
 * how many free interviews are left today, and one clear way to see Pro. Pro users see nothing.
 * Renders nothing until the server answers, so it never flashes a wrong number.
 * Light blue card, lifts on hover; on phones the button goes full-width under the meter.
 */
export default function PlanStrip() {
  const { isPro } = usePlan();
  const { usage } = useUsage();
  const navigate = useNavigate();
  if (isPro || !usage?.daily) return null;

  return (
    <div className="ps-strip" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px 12px 20px', borderRadius: 16, marginBottom: 12, background: `linear-gradient(120deg, #fff 0%, ${C.brand50} 100%)`, border: `1px solid ${C.brand100}`, fontFamily: F.body }}>
      <style>{`
        .ps-strip { transition: transform .2s ease, box-shadow .2s ease; box-shadow: 0 4px 14px rgba(26,110,255,.07); }
        .ps-strip:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(26,110,255,.14); }
        .ps-strip::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: linear-gradient(180deg, ${C.brand400}, ${C.accent400}); }
        .ps-cta { display: inline-flex; align-items: center; gap: 8px; transition: transform .18s ease, box-shadow .18s ease; }
        .ps-cta .ar { display: inline-block; transition: transform .2s ease; }
        .ps-cta:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(26,110,255,.34) !important; }
        .ps-cta:hover .ar { transform: translateX(4px); }
        .ps-cta:active { transform: scale(.98); }
        .ps-cta:focus-visible { outline: 2.5px solid ${C.brand500}; outline-offset: 2px; }
        @media (max-width: 560px) { .ps-strip { padding: 12px 12px 12px 16px !important; } .ps-cta { width: 100%; justify-content: center; } }
        @media (prefers-reduced-motion: reduce) { .ps-strip, .ps-cta, .ps-cta .ar { transition: none !important; } }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: C.brand600, background: '#fff', border: `1px solid ${C.brand100}`, borderRadius: 99, padding: '4px 10px' }}>FREE PLAN</span>
        <UsageMeter daily={usage.daily} />
      </div>
      <button type="button" className="ps-cta" onClick={() => navigate('/pricing', { state: { from: 'dashboard' } })}
        style={{ minHeight: 40, padding: '0 18px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C.brand400}, ${C.accent400})`, color: '#fff', cursor: 'pointer', fontFamily: F.display, fontSize: 13, fontWeight: 800, boxShadow: '0 8px 20px rgba(26,110,255,.26)', whiteSpace: 'nowrap' }}>
        <span aria-hidden="true">⚡</span> See what Pro adds <span className="ar" aria-hidden="true">→</span>
      </button>
    </div>
  );
}
