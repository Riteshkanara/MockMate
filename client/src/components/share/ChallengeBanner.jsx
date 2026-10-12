import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { getMyProfile, getPublicProfile } from '../../Services/profileServices';
import { getChallenge, clearChallenge } from '../../utils/challenge';
import { C, F } from '../../styles/token';

// Shown on Dashboard + Result for anyone who arrived through a friend's card.
// Before their first session: "beat X's score". After: win / lose + rematch.
const ScoreChip = ({ label, value, color, tint }) => (
  <div style={{ textAlign: 'center', minWidth: 54, padding: '7px 10px 6px', borderRadius: 14, background: tint, border: `1px solid ${color}33` }}>
    <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, lineHeight: 1, color, letterSpacing: '-0.6px' }}>{value}</div>
    <div style={{ marginTop: 4, fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.9px', color: C.textMuted }}>{label}</div>
  </div>
);
ScoreChip.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, color: PropTypes.string.isRequired, tint: PropTypes.string.isRequired };

const ChallengeBanner = ({ context = 'dashboard' }) => {
  const [slug] = useState(getChallenge);
  const [rival, setRival] = useState(null);
  const [mine, setMine] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;
    getPublicProfile(slug)
      .then((p) => { if (!cancelled && p?.hasData) setRival(p); else if (!cancelled) clearChallenge(); })
      .catch(() => { if (!cancelled) clearChallenge(); }); // dead link — don't nag forever
    getMyProfile()
      .then((d) => { if (!cancelled && d?.hasData) setMine(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  if (!slug || !rival || hidden) return null;

  const theirs = Math.round(rival.irs ?? 0);
  const first = (rival.name || 'A friend').split(' ')[0];
  const gap = mine ? Math.round(mine.irs ?? 0) - theirs : null;
  const dismiss = () => { clearChallenge(); setHidden(true); };

  let headline; let sub; let accent = C.brand600; let accent2 = C.accent400; let tint = C.brand50; let emoji = '⚔️';
  if (gap == null) {
    headline = `${first} challenged you — beat ${theirs}`;
    sub = context === 'result' ? 'Finish this interview to see where you stand.' : 'Complete an interview to find out if you can beat them.';
  } else if (gap > 0) {
    headline = `You beat ${first}! ${Math.round(mine.irs)} vs ${theirs}`;
    sub = 'Share your card back — make them chase you.'; accent = C.success; accent2 = '#34D399'; tint = C.successTint; emoji = '🏆';
  } else if (gap === 0) {
    headline = `Dead heat with ${first} at ${theirs}`;
    sub = 'One more strong session breaks the tie.'; accent = C.violet; accent2 = C.brand400; tint = C.violetTint; emoji = '🤝';
  } else {
    headline = `${Math.abs(gap)} point${Math.abs(gap) === 1 ? '' : 's'} behind ${first}`;
    sub = 'Practise your weakest dimension and take the rematch.'; accent = C.caution; accent2 = '#FB923C'; tint = C.cautionTint; emoji = '🔥';
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 44px 14px 16px', borderRadius: 20, background: `linear-gradient(100deg, #fff 0%, ${tint} 100%)`, border: `1px solid ${accent}33`, boxShadow: `0 10px 30px ${accent}1F`, marginBottom: 16, fontFamily: F.body }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: `linear-gradient(180deg, ${accent}, ${accent2})` }} />
      <div style={{ position: 'absolute', right: -40, top: -50, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle, ${accent}22, ${accent}00 68%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: `linear-gradient(135deg, ${accent}, ${accent2})`, boxShadow: `0 8px 18px ${accent}44`, flexShrink: 0, marginLeft: 4 }}>{emoji}</div>
      <div style={{ position: 'relative', flex: 1, minWidth: 190 }}>
        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '-0.2px' }}>{headline}</div>
        <div style={{ marginTop: 3, fontSize: 12.5, color: C.textSub }}>{sub}</div>
      </div>
      {gap != null && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScoreChip label="YOU" value={Math.round(mine.irs)} color={gap > 0 ? C.success : C.text} tint="#fff" />
          <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.textMuted }}>VS</span>
          <ScoreChip label={first.toUpperCase().slice(0, 8)} value={theirs} color={C.brand600} tint="#fff" />
        </div>
      )}
      <Link to={`/p/${slug}`} style={{ position: 'relative', padding: '9px 15px', borderRadius: 999, fontSize: 12, fontWeight: 800, color: '#fff', textDecoration: 'none', background: `linear-gradient(90deg, ${accent}, ${accent2})`, boxShadow: `0 8px 18px ${accent}40`, whiteSpace: 'nowrap' }}>View {first}&apos;s card →</Link>
      <button type="button" onClick={dismiss} aria-label="Dismiss challenge" style={{ position: 'absolute', top: 8, right: 10, width: 26, height: 26, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 17, lineHeight: 1, color: C.textMuted }}>×</button>
    </div>
  );
};
ChallengeBanner.propTypes = { context: PropTypes.oneOf(['dashboard', 'result']) };

export default ChallengeBanner;
