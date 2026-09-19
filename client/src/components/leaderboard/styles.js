// client/src/components/leaderboard/styles.js
// All style objects for the leaderboard feature, consumed by Leaderboard.jsx
// and its sub-components. Keep logic out of here — pure style tokens only.

import { C, F } from './tokens';

const S = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    background: C.paper,
    backgroundImage: `radial-gradient(ellipse at 6% -4%, rgba(0,87,232,0.05) 0%, transparent 46%), radial-gradient(ellipse at 96% 4%, rgba(0,194,232,0.04) 0%, transparent 40%)`,
    padding: '24px 28px 80px',
    fontFamily: F.body,
  },
  container: { maxWidth: 1260, margin: '0 auto' },

  strip: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', marginBottom: 20, borderRadius: 11, background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow },
  stripL: { display: 'flex', alignItems: 'center', gap: 9 },
  stripR: { display: 'flex', alignItems: 'center', gap: 10 },
  liveDot: { width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'livePulse 2.4s ease-in-out infinite', flexShrink: 0 },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.3px', color: C.muted },

  stickyBar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 24px', background: 'linear-gradient(135deg, #060E20 0%, #0C2242 100%)',
    boxShadow: '0 6px 20px rgba(4,12,34,0.28)', animation: 'lbFadeUp 0.22s ease',
  },

  hero: {
    position: 'relative', overflow: 'hidden',
    padding: '32px 36px', marginBottom: 16, borderRadius: 24,
    background: `linear-gradient(115deg, #0041B8 0%, #0057E8 55%, #2F8CFF 100%)`,
    boxShadow: '0 20px 48px rgba(0,60,180,0.22)',
  },
  heroPodiumWatermark: { position: 'absolute', bottom: 78, right: 40, opacity: 0.1, pointerEvents: 'none' },

  heroStatusRow:     { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  heroPillRow:        { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroPillLive:       { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' },
  heroPillLiveDot:    { width: 5, height: 5, borderRadius: '50%', background: '#3ED598', boxShadow: '0 0 5px #3ED598', flexShrink: 0 },
  heroPillText:       { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: '#fff' },
  heroPillLeader:     { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' },
  heroPillLeaderText: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: '#fff' },

  heroTopRow:     { position: 'relative', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' },

  heroRankCard: {
    position: 'relative', flexShrink: 0,
    background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.26)',
    borderRadius: 18, padding: '18px 22px', minWidth: 250,
    backdropFilter: 'blur(6px)',
  },
  heroRankCardLabel: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.2px', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', marginBottom: 12 },
  heroRankCardBody: { display: 'flex', alignItems: 'center', gap: 18 },
  heroRankCardScore: { fontFamily: F.display, fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.6px' },
  heroRankCardScoreUnit: { fontFamily: F.display, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' },
  heroRankCardScoreLabel: { fontFamily: F.mono, fontSize: 9.5, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  heroRankCardUnranked: { fontFamily: F.display, fontSize: 34, fontWeight: 900, color: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  heroRankCardPill: { display: 'inline-block', marginTop: 14, fontFamily: F.body, fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.26)', padding: '5px 12px', borderRadius: 99 },

  heroTextGroup:  { flex: '1 1 260px', minWidth: 0 },
  heroEyebrowLabel: { fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '1.4px', color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase' },
  heroH1:         { margin: '0 0 10px', fontFamily: F.display, fontSize: 'clamp(23px, 2.8vw, 29px)', fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.5px', maxWidth: 420 },
  heroSub:        { margin: '0 0 9px', fontFamily: F.body, fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.82)', maxWidth: 400 },
  heroPercentileLine: { fontFamily: F.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.65)' },
  heroPercentileHighlight: { color: '#fff', fontWeight: 800 },
  heroActions:    { position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 30 },

  heroStatRow:     { display: 'flex', alignItems: 'center', gap: 26, flexShrink: 0, marginLeft: 'auto' },
  heroStatDivider: { width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.25)' },

  heroIconBtnPrimary: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 12, background: '#fff', color: C.signalDeep, width: 44, height: 44, fontSize: 17, cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,10,40,0.18)', flexShrink: 0 },
  heroIconBtnGhost:   { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12, background: 'rgba(255,255,255,0.12)', color: '#fff', width: 44, height: 44, fontSize: 17, cursor: 'pointer', flexShrink: 0 },
  heroStreakChip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 15px', height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', fontFamily: F.body, fontSize: 12, fontWeight: 700, color: '#fff' },

  heroNoise:  { position: 'absolute', top: 0, left: 0, width: '30%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.025), transparent)', animation: 'heroSweep 11s linear infinite' },
  heroKicker: { fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: '1.8px', color: C.cyanBright, textTransform: 'uppercase' },

  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 12, background: '#fff', color: C.signalDeep, padding: '13px 22px', fontSize: 13.5, fontWeight: 800, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,10,40,0.18)' },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12, background: 'rgba(255,255,255,0.14)', color: '#fff', padding: '13px 22px', fontSize: 13.5, fontWeight: 700, fontFamily: F.body, cursor: 'pointer' },
  btnGhostLight: { border: `1px solid ${C.lineMd}`, borderRadius: 11, background: C.surface, color: C.signalDeep, padding: '11px 20px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', marginTop: 6 },
  btnBlue: { border: 'none', borderRadius: 11, background: `linear-gradient(135deg, ${C.signalDeep}, ${C.signal})`, color: '#fff', padding: '12px 24px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: `0 4px 14px rgba(0,87,232,0.28)`, textAlign: 'center', letterSpacing: '-0.1px', marginTop: 8 },
  btnBannerCta: { flexShrink: 0, border: 'none', borderRadius: 12, background: '#fff', color: C.signalDeep, padding: '14px 24px', fontSize: 13.5, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', position: 'relative' },

  toggleCard: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '14px 20px', boxShadow: C.shadow, marginBottom: 18 },
  toggleBar: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 14 },
  toggleBadgeGroup: { display: 'flex', alignItems: 'center', gap: 10 },
  toggleBadgeIcon:  { width: 36, height: 36, borderRadius: 10, background: C.signalTint, border: `1px solid ${C.lineMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 },
  toggleBadgeTitle: { fontFamily: F.display, fontSize: 12.5, fontWeight: 800, color: C.ink },
  toggleBadgeSub:   { fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 1 },
  toggleCenterGroup: { display: 'flex', alignItems: 'center', gap: 16, justifySelf: 'center' },
  toggleDivider: { width: 1, height: 32, background: C.line },
  toggleMeta: { textAlign: 'right' },
  toggleGroupWrap: {},
  toggleGroupLabel: { display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '1.1px', marginBottom: 8, textTransform: 'uppercase' },
  toggleGroupTrack: {
    position: 'relative', display: 'flex', gap: 4, padding: 4, borderRadius: 12,
    background: C.surfaceSunk,
    border: `1px solid ${C.line}`,
  },
  toggleGroupThumb: {
    position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 9,
    transition: 'transform 0.32s cubic-bezier(.16,1,.3,1)',
    background: C.signalTint,
    boxShadow: `inset 0 0 0 1px ${C.lineStr}`,
  },
  toggleGroupBtn: { position: 'relative', zIndex: 1, border: 'none', background: 'transparent', padding: '8px 14px', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, fontFamily: F.body },
  toggleOptLabel: { fontSize: 12.5, fontWeight: 700 },
  toggleOptHelper: { fontSize: 9, fontFamily: F.mono },

  podiumCard: { position: 'relative', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 24, padding: '28px 26px 0', boxShadow: '0 8px 32px rgba(15,45,120,0.10), 0 2px 8px rgba(10,22,40,0.05)', marginBottom: 16, overflow: 'hidden' },
  podiumGlowTop: { position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 420, height: 200, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(173,127,16,0.10), transparent 70%)', pointerEvents: 'none' },
  podiumFloorGlow: { position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 40, background: 'radial-gradient(ellipse, rgba(173,127,16,0.14), transparent 75%)', pointerEvents: 'none' },
  podiumHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, position: 'relative' },
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.8px', color: C.signal, marginBottom: 7, textTransform: 'lowercase' },
  cardH2: { margin: 0, fontFamily: F.body, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: '-0.2px' },
  tierBadgeSm: { fontFamily: F.mono, fontSize: 10, fontWeight: 700, padding: '5px 11px', borderRadius: 8, border: '1px solid', flexShrink: 0 },

  searchRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 11, background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow, flex: '1 1 260px', maxWidth: 340 },
  searchInput: { border: 'none', outline: 'none', background: 'transparent', fontFamily: F.body, fontSize: 13, color: C.ink, flex: 1, minWidth: 0 },
  searchClear: { border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 11, padding: 2 },

  emptyCard: { background: C.surface, border: `1.5px dashed ${C.lineMd}`, borderRadius: 20, padding: '64px 24px', textAlign: 'center' },
  errorCard: { background: C.surface, border: `1.5px dashed ${C.red}55`, borderRadius: 20, padding: '64px 24px', textAlign: 'center', marginTop: 20 },
  emptyTitle: { fontFamily: F.body, fontSize: 18, fontWeight: 800, color: C.ink, marginBottom: 8 },
  emptyDesc: { fontFamily: F.body, fontSize: 14, color: C.sub, marginBottom: 6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' },

  tableCard: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, overflow: 'hidden', boxShadow: C.shadow, marginBottom: 16 },
  tableHeadRow: { display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: `1px solid ${C.line}`, background: C.surfaceSunk },
  colLabel: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.5px' },

  statRail: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 18, borderRadius: 18, background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow, overflow: 'hidden' },
  railCell: { padding: '18px 20px', borderRight: `1px solid ${C.line}` },
  railLabel: { fontSize: 10.5, fontWeight: 500, color: C.muted, letterSpacing: '0.1px', textTransform: 'uppercase' },
  railValRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 },
  railVal: { fontFamily: F.display, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.4px' },
  railSub: { marginTop: 6, fontSize: 10.5, color: C.muted },

  rivalCard: {
    position: 'relative', marginBottom: 18, borderRadius: 18,
    background: `linear-gradient(135deg, #F7FAFF 0%, #EEF5FF 52%, #E9F8FF 100%)`,
    border: `1px solid ${C.lineMd}`,
    boxShadow: `0 10px 28px rgba(15,45,120,0.08), 0 2px 6px rgba(10,22,40,0.04)`,
    overflow: 'hidden',
    transition: 'transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s ease',
  },
  rivalAccentBar: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%', borderRadius: '18px 0 0 18px' },
  rivalInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '22px 24px 20px 28px', flexWrap: 'wrap' },
  rivalLeft: { flex: '1 1 340px', minWidth: 0 },
  rivalRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0 },
  rivalEyebrowRow: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 },
  rivalEyebrowDot: { width: 6, height: 6, borderRadius: '50%', boxShadow: '0 0 0 3px rgba(0,87,232,0.08)', flexShrink: 0 },
  rivalEyebrow: { fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: '1.25px', textTransform: 'uppercase' },
  rivalEyebrowDivider: { color: C.lineStr, fontFamily: F.mono, fontSize: 10 },
  rivalEyebrowContext: { fontFamily: F.mono, fontSize: 9, color: C.muted },
  rivalName: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 9 },
  rivalAvatar: { width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.serif, fontSize: 17, fontWeight: 600, flexShrink: 0, boxShadow: '0 4px 14px rgba(0,87,232,0.10)' },
  rivalNameText: { fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.ink, letterSpacing: '-0.25px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rivalNameSub: { fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rivalMsg: { margin: 0, maxWidth: 520, fontFamily: F.body, fontSize: 12.5, color: C.sub, lineHeight: 1.65 },
  rivalMetrics: { display: 'flex', alignItems: 'center', gap: 18, padding: '10px 14px', borderRadius: 13, background: 'rgba(255,255,255,0.72)', border: `1px solid ${C.line}` },
  rivalMetric: { minWidth: 70, textAlign: 'right' },
  rivalMetricDivider: { width: 1, height: 32, background: C.lineMd },
  rivalScoreLabel: { fontFamily: F.mono, fontSize: 7.5, fontWeight: 700, letterSpacing: '0.85px', color: C.muted, marginBottom: 4 },
  rivalScoreVal: { fontFamily: F.display, fontSize: 22, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.5px', color: C.ink },
  rivalScoreUnit: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, marginLeft: 2 },
  rivalCta: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid', borderRadius: 11, padding: '10px 14px', fontSize: 12, fontWeight: 800, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,40,140,0.08)', transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease' },
  rivalCtaArrow: { fontSize: 14, lineHeight: 1, marginLeft: 2 },
  rivalBottomLine: { display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px 14px 28px' },
  rivalBottomTrack: { flex: 1, height: 4, borderRadius: 99, background: C.line, overflow: 'hidden' },
  rivalBottomFill: { height: '100%', borderRadius: 99, transition: 'width 0.8s cubic-bezier(.16,1,.3,1)' },
  rivalBottomText: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, whiteSpace: 'nowrap' },

  ctaBanner: {
    position: 'relative', overflow: 'hidden',
    marginTop: 4, padding: '26px 30px', borderRadius: 20,
    background: `linear-gradient(150deg, #060E20 0%, #0A1832 42%, #0C2340 100%)`,
    boxShadow: C.shadowLg,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
  },
  ctaTitle: { fontFamily: F.serif, fontSize: 19, fontWeight: 500, color: '#fff', margin: '10px 0 6px', lineHeight: 1.3 },
  ctaSub: { fontFamily: F.body, fontSize: 12.5, color: 'rgba(255,255,255,0.62)', maxWidth: 440, lineHeight: 1.6 },

  footerRow: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: '20px 4px 0', opacity: 0.42 },
};

export default S;