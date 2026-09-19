import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';

// ─── Styles ─────────────────────────────────────────────────
const S_WC = {
  card:                 { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 26, boxShadow: C.shadow, marginBottom: 18 },
  cardHeader:           { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 },
  eyebrow:              { fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px', color: C.blue500, marginBottom: 7, textTransform: 'lowercase' },
  cardH2:               { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' },
  cardSub:              { margin: '7px 0 0', fontSize: 12.5, lineHeight: 1.65, color: C.sub, maxWidth: 440 },
  challengeSummary:     { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 54, height: 54, borderRadius: 12, background: C.blue50, border: `1px solid ${C.borderMd}`, color: C.blue600, fontFamily: F.display, fontSize: 19, fontWeight: 900, lineHeight: 1 },
  challengeSummarySpan: { marginTop: 4, fontFamily: F.mono, fontSize: 8, color: C.muted, letterSpacing: '0.3px' },
  challengeList:        { display: 'flex', flexDirection: 'column', gap: 10 },
  challengeRow:         { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` },
  challengeIcon:        { width: 34, height: 34, borderRadius: 9, background: C.blue50, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.blue500, flexShrink: 0 },
  challengeBody:        { flex: 1, minWidth: 0 },
  challengeTop:         { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  challengeTitle:       { fontSize: 11.5, fontWeight: 800, color: C.text },
  challengeHelper:      { marginTop: 2, fontSize: 10, color: C.muted },
  challengeCount:       { fontFamily: F.mono, fontSize: 10, fontWeight: 700, flexShrink: 0 },
  challengeTrack:       { height: 5, borderRadius: 999, background: C.border, overflow: 'hidden' },
  challengeFill:        { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(.16,1,.3,1)' },
  challengeStatus:      { width: 28, textAlign: 'right', fontFamily: F.mono, fontSize: 9, fontWeight: 700, flexShrink: 0 },
};

// ─── PropTypes ──────────────────────────────────────────────
WeeklyChallenges.propTypes = {
  scoreTrend:       PropTypes.array.isRequired,
  topicPerformance: PropTypes.array.isRequired,
  streakDays:       PropTypes.number.isRequired,
};

// ─── Component ──────────────────────────────────────────────
function WeeklyChallenges({ scoreTrend, topicPerformance, streakDays }) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const thisWeek       = scoreTrend.filter(s => s.date && new Date(s.date) >= weekAgo);
  const strongSessions = thisWeek.filter(s => (s.score || 0) >= 75).length;
  const topicsTouched  = new Set(topicPerformance.filter(t => (t.attempts ?? 0) > 0).map(t => t.topic)).size;

  const challenges = [
    { icon: '◎', title: 'Score 75+ in 3 sessions', current: Math.min(strongSessions, 3), target: 3, helper: 'Build a reliable performance floor.' },
    { icon: '◇', title: 'Cover 5 topics',           current: Math.min(topicsTouched, 5),  target: 5, helper: 'Keep your preparation broad.' },
    { icon: '◆', title: 'Hold a 7-day streak',      current: Math.min(streakDays, 7),     target: 7, helper: 'Consistency compounds.' },
  ];
  const completed = challenges.filter(c => c.current >= c.target).length;

  return (
    <section style={S_WC.card}>
      <div style={S_WC.cardHeader}>
        <div>
          <div style={S_WC.eyebrow}>weekly challenges</div>
          <h2 style={S_WC.cardH2}>This week's targets</h2>
          <p style={S_WC.cardSub}>Small targets that build consistency, breadth, and confidence.</p>
        </div>
        <div style={S_WC.challengeSummary}>
          <div>{completed}/{challenges.length}</div>
          <span style={S_WC.challengeSummarySpan}>done</span>
        </div>
      </div>
      <div style={S_WC.challengeList}>
        {challenges.map(ch => {
          const pct  = Math.min(100, Math.round((ch.current / ch.target) * 100));
          const done = ch.current >= ch.target;
          return (
            <div key={ch.title} style={S_WC.challengeRow} className="mm-challenge-row">
              <div style={S_WC.challengeIcon}>{ch.icon}</div>
              <div style={S_WC.challengeBody}>
                <div style={S_WC.challengeTop}>
                  <div>
                    <div style={S_WC.challengeTitle}>{ch.title}</div>
                    <div style={S_WC.challengeHelper}>{ch.helper}</div>
                  </div>
                  <div style={{ ...S_WC.challengeCount, color: done ? C.green : C.blue600 }}>{ch.current}/{ch.target}</div>
                </div>
                <div style={S_WC.challengeTrack}>
                  <div style={{ ...S_WC.challengeFill, width: `${pct}%`, background: done ? C.green : `linear-gradient(90deg, ${C.blue500}, ${C.cyan500})` }} />
                </div>
              </div>
              <div style={{ ...S_WC.challengeStatus, color: done ? C.green : C.muted }}>{done ? '✓' : `${pct}%`}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default WeeklyChallenges;