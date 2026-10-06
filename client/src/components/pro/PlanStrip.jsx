import { useNavigate } from 'react-router-dom';
import usePlan from '../../hooks/usePlan';
import useUsage from '../../hooks/useUsage';
import { C, F } from '../../styles/token';
import UsageMeter from './UsageMeter';

/**
 * PlanStrip — a slim status line at the top of the Dashboard for FREE users:
 * how many free interviews are left today, and a way to see Pro. Pro users see nothing.
 * Renders nothing until the server answers, so it never flashes a wrong number.
 */
export default function PlanStrip() {
  const { isPro } = usePlan();
  const { usage } = useUsage();
  const navigate = useNavigate();
  if (isPro || !usage?.daily) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 14, marginBottom: 12, background: C.surface, border: `1px solid ${C.border}`, fontFamily: F.body }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: C.textMuted }}>FREE PLAN</span>
        <UsageMeter daily={usage.daily} />
      </div>
      <button type="button" onClick={() => navigate('/pricing', { state: { from: 'dashboard' } })}
        style={{ height: 32, padding: '0 14px', borderRadius: 9, border: `1px solid ${C.brand100}`, background: C.brand50, color: C.brand600, cursor: 'pointer', fontFamily: F.display, fontSize: 12.5, fontWeight: 700 }}>
        See what Pro adds
      </button>
    </div>
  );
}
