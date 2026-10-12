import PropTypes from 'prop-types';
import ScoreCard from '../ScoreCard';
import { C, F } from '../../styles/token';

// WHY: the dashboard used to draw its own, different share image. It now hosts the
// same player card used on the result page and public profile, so every share
// surface looks (and ranks) identically. Props are kept so Dashboard.jsx is unchanged.
function ShareCard({ irs }) {
  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: '22px 20px 24px', boxShadow: '0 6px 28px rgba(26,110,255,0.10)', marginBottom: 16 }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '1.3px', color: C.brand600, textTransform: 'uppercase', marginBottom: 6 }}>share your progress</div>
      <h2 style={{ margin: '0 0 6px', fontFamily: F.display, fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px', color: C.text }}>Your player card</h2>
      <p style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.6, color: C.textSub }}>Post it on WhatsApp, LinkedIn or your story and dare your friends to beat your score.</p>
      <ScoreCard totalScore={Number(irs) || 0} />
    </section>
  );
}

ShareCard.propTypes = {
  name: PropTypes.string, irs: PropTypes.number, tier: PropTypes.object, strongest: PropTypes.object,
  weakest: PropTypes.object, percentile: PropTypes.number, archetype: PropTypes.object,
  sessions: PropTypes.number, streakDays: PropTypes.number, bestScore: PropTypes.number, averageScore: PropTypes.number,
};

export default ShareCard;
