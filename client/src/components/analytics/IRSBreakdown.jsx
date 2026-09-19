import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';


const C = {
  ...CT,
  violet:     CT.blue500,
  violetTint: CT.blue50,
  violetMid:  CT.blue600,
};

const IRSComponentBar = ({ label, value, weight, color }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{label}</span>
        <span style={{ marginLeft: 8, fontFamily: F.mono, fontSize: 9, color: C.muted }}>
          weight {Math.round(weight * 100)}%
        </span>
      </div>
      <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color }}>{value}</span>
    </div>
    <div style={{ height: 6, borderRadius: 999, background: C.border, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 999, transition: 'width 1s ease' }} />
    </div>
  </div>
);

IRSComponentBar.propTypes = {
  label:  PropTypes.string.isRequired,
  value:  PropTypes.number,
  weight: PropTypes.number.isRequired,
  color:  PropTypes.string.isRequired,
};

// — PropTypes
IRSBreakdown.propTypes = {
  irs:                    PropTypes.number.isRequired,
  irsComponents:          PropTypes.shape({
    dimScore:    PropTypes.number,
    ewmaScore:   PropTypes.number,
    breadth:     PropTypes.number,
    consistency: PropTypes.number,
    rigor:       PropTypes.number,
  }).isRequired,
  irsMaturity:            PropTypes.number,
  irsRawComposite:        PropTypes.number,
  totalAnsweredQuestions: PropTypes.number.isRequired,
  tierIsGated:            PropTypes.bool.isRequired,
  tierRawLabel:           PropTypes.string.isRequired,
  sessionsNeededForRaw:   PropTypes.number.isRequired,
  irsStatItems:           PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
    val:   PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    color: PropTypes.string,
  })).isRequired,
};

// — Local style fragments (mirrors parent S object for the pieces used here)
const card    = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: 24, boxShadow: '0 2px 16px rgba(26,110,255,0.05)', marginBottom: 18 };
const eyebrow = { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.6px', color: C.violet, marginBottom: 6 };
const cardH2  = { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.2px' };
const cardSub = { margin: '6px 0 0', color: C.sub, fontSize: 12, lineHeight: 1.65 };

function IRSBreakdown({
  irs,
  irsComponents,
  irsMaturity,
  irsRawComposite,
  totalAnsweredQuestions,
  tierIsGated,
  tierRawLabel,
  sessionsNeededForRaw,
  irsStatItems,
}) {
  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={eyebrow}>IRS BREAKDOWN</div>
          <h2 style={cardH2}>How your {irs}/100 is computed</h2>
          <p style={cardSub}>
            Five statistical components, Bayesian-shrunk toward a neutral baseline until you've logged enough evidence.
          </p>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, lineHeight: 1.7, maxWidth: 340 }}>
          Weighted dim avg × 40%<br />
          EWMA trend (shrunk) × 22%<br />
          Topic breadth &amp; depth × 13%<br />
          Consistency (1 − CV) × 15%<br />
          Difficulty-adjusted rigor × 10%
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 32px' }}>
        <IRSComponentBar label="Dimension-weighted avg"    value={irsComponents.dimScore}    weight={0.40} color={C.violet} />
        <IRSComponentBar label="EWMA recent trend"         value={irsComponents.ewmaScore}   weight={0.22} color={C.blue500} />
        <IRSComponentBar label="Topic breadth & depth"     value={irsComponents.breadth}     weight={0.13} color={C.amber} />
        <IRSComponentBar label="Consistency (1−CV)"        value={irsComponents.consistency} weight={0.15} color={C.green} />
        <IRSComponentBar label="Difficulty-adjusted rigor" value={irsComponents.rigor}       weight={0.10} color={C.sub} />
      </div>

      {irsMaturity != null && irsMaturity < 0.97 && (
        <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 12,
          background: '#FFF7E8', border: '1px solid #F0D8A8', fontSize: 12, color: '#8A6414', lineHeight: 1.6 }}>
          <strong>Evidence gate active:</strong> raw composite is {irsRawComposite}/100, but with {totalAnsweredQuestions} answered questions,
          trusted IRS is scaled to <strong>{Math.round(irsMaturity * 100)}%</strong> confidence — <strong>{irs}/100</strong>.
        </div>
      )}

      {tierIsGated && (
        <div style={{ marginTop: 10, padding: '12px 16px', borderRadius: 12,
          background: C.violetTint, border: `1px solid ${C.violet}20`, fontSize: 12, color: C.violetMid, lineHeight: 1.6 }}>
          <strong>On track for {tierRawLabel}:</strong> your IRS math already crosses that band,
          but we need {sessionsNeededForRaw} more sessions to confirm — small samples can be misleading.
        </div>
      )}

      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12,
        background: C.violetTint, border: `1px solid ${C.violet}20`, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {irsStatItems.map(item => (
          <div key={item.label}>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{item.label}</span><br />
            <strong style={{ color: item.color, fontSize: 14, fontFamily: F.display }}>{item.val}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default IRSBreakdown;