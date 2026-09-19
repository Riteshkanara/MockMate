import PropTypes from 'prop-types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import { getMyProfile } from '../Services/profileServices';
import { C as TOKENS, F as TOKENS_F } from '../styles/token';

// WHY: Same three families Result.jsx already loads — injected here so
// ScoreCard also renders correctly when used outside that page context.
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap';
if (typeof document !== 'undefined' && !document.getElementById('mm9-fonts')) {
  const link = document.createElement('link');
  link.id = 'mm9-fonts';
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

// WHY: Local "instrument-panel" aliases read better in this file's dense
// inline styles, but every value is pulled from styles/token.js so this
// card can't silently drift from the rest of the app.
const C = {
  paper:        TOKENS.surfaceAlt,
  surface:      TOKENS.surface,
  surfaceSunk:  TOKENS.surfaceAlt,
  ink:          TOKENS.text,
  ink2:         TOKENS.text,
  sub:          TOKENS.textSub,
  muted:        TOKENS.textMuted,
  faint:        TOKENS.textFaint,
  line:         TOKENS.border,
  lineMd:       TOKENS.borderMd,
  signal:       TOKENS.brand600,
  signalDeep:   TOKENS.brand700,
  signalTint:   TOKENS.brand50,
  pulse:        TOKENS.accent400,
  green:        TOKENS.success,
  amber:        TOKENS.warning,
  amberTint:    TOKENS.warningTint,
  red:          TOKENS.danger,
  redTint:      TOKENS.dangerTint,
  navy1: '#060E20', navy2: '#0A1A38', navy3: '#0C2242', navy4: '#0E3358',
  shadow:   TOKENS.shadow,
  shadowLg: TOKENS.shadowLg,
};

const F = {
  serif: "'Fraunces', 'Georgia', serif",
  body:  TOKENS_F.body,
  mono:  TOKENS_F.mono,
};

const CARD_W = 420;

// WHY: Same thresholds and colors as Result.jsx's scoreColor/scoreTint —
// reimplemented locally to avoid import-order dependency on Result.jsx.
const scoreColor = (s) => {
  const n = clamp(s);
  if (n >= 80) return C.green;
  if (n >= 60) return C.signal;
  if (n >= 40) return C.amber;
  return C.red;
};

const DEFAULT_DIMENSIONS = [
  { key: 'technical',      label: 'Technical Depth', score: 0, hasData: false },
  { key: 'problemSolving', label: 'Problem Solving', score: 0, hasData: false },
  { key: 'communication',  label: 'Communication',   score: 0, hasData: false },
  { key: 'behavioral',     label: 'Behavioral',      score: 0, hasData: false },
  { key: 'design',         label: 'System Design',   score: 0, hasData: false },
  { key: 'fundamentals',   label: 'CS Fundamentals', score: 0, hasData: false },
];

const ARCHETYPE_COPY = {
  inconsistentGenius: { icon: '✦', line: 'Brilliant on your best day. The next unlock is repeating it.' },
  consistentClimber:  { icon: '↗', line: 'Steady, upward, compounding — the trend that gets noticed.' },
  speedRunner:        { icon: '⚡', line: 'Fast and sharp under pressure. Depth is the next frontier.' },
  deepThinker:        { icon: '◈', line: 'Thorough and deliberate. Speed will follow with reps.' },
  pressureCooker:     { icon: '◆', line: 'Holds up in the tough rounds. Consistency is next.' },
};

const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const round = (v) => Math.round(Number(v) || 0);
const shortLabel = (label) =>
  label === 'Problem Solving' ? 'Problem'
  : label === 'Communication' ? 'Comm.'
  : label === 'CS Fundamentals' ? 'CS Fund.'
  : label === 'System Design' ? 'Sys. Design'
  : label;

const GlobalStyles = () => (
  <style>{`
    @keyframes mm9-riseIn  { from { opacity:0; transform:translateY(6px);} to {opacity:1; transform:translateY(0);} }
    @keyframes mm9-drawBarX{ from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes mm9-drawBarY{ from { transform: scaleY(0); } to { transform: scaleY(1); } }
    .mm9-rise       { animation: mm9-riseIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
    .mm9-bar-fill   { transform-origin: left;   animation: mm9-drawBarX 1s cubic-bezier(0.16,1,0.3,1) both; }
    .mm9-bar-fill-v { transform-origin: bottom; animation: mm9-drawBarY 0.7s cubic-bezier(0.16,1,0.3,1) both; }
    @media (prefers-reduced-motion: reduce) {
      .mm9-rise, .mm9-bar-fill, .mm9-bar-fill-v { animation: none !important; }
    }
  `}</style>
);

const CountUp = ({ value, duration = 1.1, style }) => {
  const reduced = useReducedMotion();
  const [disp, setDisp] = useState(round(value));
  useEffect(() => {
    if (reduced) return;
    let raf;
    const start = performance.now();
    const from = 0, to = round(value);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisp(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return <span style={style}>{disp}</span>;
};

CountUp.propTypes = {
  value: PropTypes.number.isRequired,
  duration: PropTypes.number,
  style: PropTypes.object,
};

const SectionLabel = ({ children }) => (
  <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.8px', color: C.signal, marginBottom: 8 }}>
    {children}
  </div>
);

SectionLabel.propTypes = {
  children: PropTypes.node.isRequired,
};

const Pill = ({ children, color = C.signal, background = C.signalTint }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', borderRadius: 999,
    padding: '4px 10px', background, color,
    fontFamily: F.mono, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.5px',
    border: `1px solid ${color}30`,
  }}>
    {children}
  </span>
);

Pill.propTypes = {
  children: PropTypes.node.isRequired,
  color: PropTypes.string,
  background: PropTypes.string,
};

const SkillFingerprint = ({ dims }) => {
  const hasAny = dims.some((d) => d.hasData);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        {dims.map((d, i) => {
          const col = d.hasData ? scoreColor(d.score) : C.faint;
          return (
            <div key={d.key} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, textAlign: 'center', marginBottom: 3, color: d.hasData ? C.ink2 : C.faint }}>
                {d.hasData ? d.score : '–'}
              </div>
              <div style={{ height: 44, borderRadius: 4, background: C.surfaceSunk, border: `1px solid ${C.line}`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                <div
                  className="mm9-bar-fill-v"
                  style={{
                    width: '100%',
                    height: `${d.hasData ? Math.max(6, d.score) : 4}%`,
                    background: col,
                    animationDelay: `${0.15 + i * 0.05}s`,
                  }}
                />
              </div>
              <div style={{ marginTop: 4, fontFamily: F.body, fontSize: 7.5, fontWeight: 600, color: C.muted, textAlign: 'center', lineHeight: 1.2 }}>
                {shortLabel(d.label)}
              </div>
            </div>
          );
        })}
      </div>
      {!hasAny && (
        <div style={{ marginTop: 6, fontFamily: F.body, fontSize: 9.5, color: C.muted, textAlign: 'center' }}>
          Fills in as you complete more sessions
        </div>
      )}
    </div>
  );
};

SkillFingerprint.propTypes = {
  dims: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    score: PropTypes.number.isRequired,
    hasData: PropTypes.bool.isRequired,
  })).isRequired,
};

const Sparkline = ({ trend }) => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !trend || trend.length < 2) return;
    const W = 100, H = 28;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const scores = trend.slice(-10).map((s) => clamp(s.score));
    const min = Math.min(...scores), max = Math.max(...scores, min + 1);
    const x = (i) => (i / (scores.length - 1)) * (W - 4) + 2;
    const y = (v) => H - 4 - ((v - min) / (max - min)) * (H - 8);
    ctx.beginPath();
    scores.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.strokeStyle = C.signal;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    const lastI = scores.length - 1;
    ctx.beginPath();
    ctx.arc(x(lastI), y(scores[lastI]), 2.4, 0, Math.PI * 2);
    ctx.fillStyle = C.signal;
    ctx.fill();
  }, [trend]);
  if (!trend || trend.length < 2) return null;
  return <canvas ref={ref} style={{ display: 'block' }} />;
};

Sparkline.propTypes = {
  trend: PropTypes.arrayOf(PropTypes.shape({ score: PropTypes.number })),
};

const LoadingCard = () => (
  <div style={{
    width: '100%', maxWidth: CARD_W, minHeight: 240, borderRadius: 16,
    background: C.surfaceSunk, border: `1px dashed ${C.lineMd}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: '0.4px',
  }}>
    preparing your report…
  </div>
);

const EmptyCard = ({ totalScore }) => (
  <div style={{
    width: '100%', maxWidth: CARD_W, borderRadius: 16, background: C.surfaceSunk,
    border: `1px solid ${C.line}`, padding: '22px 20px',
  }}>
    <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 500, color: C.ink, marginBottom: 6 }}>
      First session logged.
    </div>
    <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, fontFamily: F.body }}>
      You scored <strong style={{ color: C.ink }}>{round(totalScore)}/100</strong>. Your mission report —
      rank, archetype, and skill profile — unlocks once a couple more sessions give it enough to work with.
    </div>
  </div>
);

EmptyCard.propTypes = {
  totalScore: PropTypes.number.isRequired,
};

const ReportPanel = ({ profile, user }) => {
  const {
    name, college, totalInterviews, tier, tierGated, nextTier,
    archetype, heroBadge, dimensionProfile, scoreTrend,
    rank, totalCandidates, percentile,
  } = profile;

  const dims = (dimensionProfile && dimensionProfile.length) ? dimensionProfile : DEFAULT_DIMENSIONS;
  const archCopy = archetype ? (ARCHETYPE_COPY[archetype.id] || { icon: '◆', line: '' }) : null;
  const displayName = name || user?.name || 'Candidate';

  return (
    <div
      className="mm9-rise"
      style={{
        width: '100%', maxWidth: CARD_W, borderRadius: 18, overflow: 'hidden',
        background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow,
        fontFamily: F.body, color: C.ink,
      }}
    >
      {/* WHY: Deep-navy header uses same gradient language as the page's
          hero + CTA banner so this card reads as part of the same product. */}
      <div style={{
        position: 'relative', overflow: 'hidden', padding: '18px 22px 16px',
        background: `linear-gradient(150deg, ${C.navy1} 0%, ${C.navy2} 38%, ${C.navy3} 66%, ${C.navy4} 100%)`,
      }}>
        <div style={{ position: 'absolute', top: -70, right: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, rgba(0,194,232,0.14), transparent 68%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 500, letterSpacing: '1.1px', color: C.pulse, marginBottom: 4 }}>
              mission report
            </div>
            <div style={{ fontFamily: F.body, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {displayName}{college ? ` · ${college}` : ''}
            </div>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: 'rgba(255,255,255,0.32)', whiteSpace: 'nowrap' }}>
            {totalInterviews} session{totalInterviews === 1 ? '' : 's'}
          </div>
        </div>

        <div style={{ position: 'relative', marginTop: 14 }}>
          {percentile != null && rank != null ? (
            <>
              <div style={{ fontFamily: F.serif, fontSize: 52, fontWeight: 500, lineHeight: 0.95, color: '#fff', letterSpacing: '-1.5px' }}>
                Top <CountUp value={Math.max(1, 100 - percentile)} />%
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.62)' }}>
                Ranked <strong style={{ color: '#fff' }}>#{rank}</strong> of <strong style={{ color: '#fff' }}>{totalCandidates}</strong> candidates on MockMate
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: F.serif, fontSize: 38, fontWeight: 500, color: '#fff', letterSpacing: '-1px' }}>
                {round(profile.irs ?? profile.averageScore ?? 0)}<span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>/100</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>
                Interview Readiness Score — rank unlocks with more sessions logged platform-wide.
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '18px 22px 20px' }}>
        {archetype && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            padding: '11px 14px', borderRadius: 13, background: C.signalTint, border: `1px solid ${C.signal}22`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.surface, fontSize: 16,
            }}>
              {archCopy.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: F.serif, fontSize: 14.5, fontWeight: 600, color: C.signalDeep }}>
                {archetype.label}
              </div>
              <div style={{ marginTop: 2, fontSize: 10.5, color: C.sub, lineHeight: 1.4 }}>
                {archCopy.line}
              </div>
            </div>
          </div>
        )}

        {tier && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>package track</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 600, color: C.ink }}>
                {tier.label}
              </div>
              {tierGated && <Pill color={C.amber} background={C.amberTint}>on track</Pill>}
            </div>
            <div style={{ height: 6, borderRadius: 999, background: C.surfaceSunk, border: `1px solid ${C.line}`, overflow: 'hidden', marginBottom: 8 }}>
              <div
                className="mm9-bar-fill"
                style={{
                  width: `${nextTier ? clamp(nextTier.readinessPct) : 100}%`,
                  height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.signal}, ${C.pulse})`,
                  animationDelay: '0.3s',
                }}
              />
            </div>
            {nextTier ? (
              <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5 }}>
                <strong style={{ color: C.ink }}>{clamp(nextTier.readinessPct)}%</strong> of the way to{' '}
                <strong style={{ color: C.ink }}>{nextTier.label}</strong>
                {nextTier.blockingDimension ? (
                  <> — mainly held back by <strong style={{ color: C.ink }}>{nextTier.blockingDimension.label}</strong>.</>
                ) : !nextTier.confidenceGate ? (
                  <> — held back by session count, not skill: log a few more to unlock it.</>
                ) : (
                  <>.</>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: C.sub }}>Top package tier reached.</div>
            )}
          </div>
        )}

        {/* WHY: Amber tile idiom matches the streak tile on the page — icon square + serif value. */}
        {heroBadge && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            padding: '11px 14px', borderRadius: 13, background: C.amberTint, border: `1px solid ${C.amber}22`,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {heroBadge.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: F.serif, fontSize: 13.5, fontWeight: 600, color: C.amber }}>
                {heroBadge.label}
              </div>
              <div style={{ marginTop: 2, fontSize: 10.5, color: C.ink2, lineHeight: 1.4 }}>
                {heroBadge.desc}
              </div>
            </div>
          </div>
        )}

        <SectionLabel>skill profile</SectionLabel>
        <SkillFingerprint dims={dims} />

        {scoreTrend && scoreTrend.length >= 2 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: '0.4px' }}>
              score trend · last {Math.min(10, scoreTrend.length)} sessions
            </div>
            <Sparkline trend={scoreTrend} />
          </div>
        )}
      </div>

      <div style={{
        padding: '9px 22px', borderTop: `1px solid ${C.line}`, background: C.surfaceSunk,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: F.serif, fontSize: 11, fontWeight: 600, color: C.sub }}>mockmate.app</span>
        <span style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, letterSpacing: '0.4px' }}>verified session data</span>
      </div>
    </div>
  );
};

ReportPanel.propTypes = {
  profile: PropTypes.shape({
    name: PropTypes.string,
    college: PropTypes.string,
    totalInterviews: PropTypes.number,
    tier: PropTypes.shape({ label: PropTypes.string }),
    tierGated: PropTypes.bool,
    nextTier: PropTypes.shape({
      label: PropTypes.string,
      readinessPct: PropTypes.number,
      blockingDimension: PropTypes.shape({ label: PropTypes.string }),
      confidenceGate: PropTypes.bool,
    }),
    archetype: PropTypes.shape({ id: PropTypes.string, label: PropTypes.string }),
    heroBadge: PropTypes.shape({ icon: PropTypes.string, label: PropTypes.string, desc: PropTypes.string }),
    dimensionProfile: PropTypes.array,
    scoreTrend: PropTypes.array,
    rank: PropTypes.number,
    totalCandidates: PropTypes.number,
    percentile: PropTypes.number,
    irs: PropTypes.number,
    averageScore: PropTypes.number,
  }).isRequired,
  user: PropTypes.shape({ name: PropTypes.string }),
};

const buildShareText = (profile) => {
  const pct = profile.percentile != null ? `Top ${Math.max(1, 100 - profile.percentile)}%` : null;
  return [
    '📋 My MockMate Mission Report',
    pct ? `${pct} — ranked #${profile.rank} of ${profile.totalCandidates} candidates` : null,
    profile.archetype ? `Archetype: ${profile.archetype.label}` : null,
    profile.tier ? `Tracking for ${profile.tier.label}${profile.tierGated ? ' (on track)' : ''}` : null,
    profile.heroBadge ? `🏅 ${profile.heroBadge.label} — ${profile.heroBadge.desc}` : null,
    '',
    'mockmate.app',
  ].filter(Boolean).join('\n');
};

const captureCard = async (node) => {
  if (!node) throw new Error('ScoreCard: card ref not mounted');
  await new Promise((r) => setTimeout(r, 900));
  await toPng(node, { skipFonts: true }).catch(() => {});
  return toPng(node, {
    skipFonts: true, 
    cacheBust: false,
    pixelRatio: 2.5,
    backgroundColor: C.surface,
    width: node.offsetWidth,
    height: node.offsetHeight,
  });
};

// WHY: Result.jsx passes `questions` for backward compatibility with the old
// card's API, but this version renders from the live cross-session profile
// fetch — accepted via props but deliberately not read here.
const ScoreCard = (props) => {
  const { totalScore = 0 } = props;
  const { user } = useAuth();
  const cardRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | empty | error
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getMyProfile();
        if (cancelled) return;
        if (data?.hasData) { setProfile(data); setLoadState('ready'); }
        else { setLoadState('empty'); }
      } catch (err) {
        console.error('ScoreCard: profile fetch failed', err);
        if (!cancelled) setLoadState('error');
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const shareText = useMemo(() => profile ? buildShareText(profile) : '', [profile]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    const id = toast.loading('Preparing your report…');
    try {
      const url = await captureCard(cardRef.current);
      const link = document.createElement('a');
      link.download = `mockmate-report-${Date.now()}.png`;
      link.href = url;
      link.click();
      toast.dismiss(id);
      toast.success('Report saved!');
    } catch (err) {
      toast.dismiss(id);
      console.error('ScoreCard export failed:', err);
      toast.error('Could not create the report image.');
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const url = await captureCard(cardRef.current);
      if (navigator.share && window.File) {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'mockmate-report.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'My MockMate Mission Report', text: shareText, files: [file] });
          return;
        }
      }
      await navigator.clipboard?.writeText(shareText);
      const link = document.createElement('a');
      link.download = `mockmate-report-${Date.now()}.png`;
      link.href = url;
      link.click();
      toast.success('Downloaded + share text copied!');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Share failed:', err);
      toast.error('Share failed — try Download instead.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={{ maxWidth: CARD_W, margin: '0 auto', fontFamily: F.body }}>
      <GlobalStyles />

      {loadState === 'loading' && <LoadingCard />}
      {loadState === 'empty' && <EmptyCard totalScore={totalScore} />}
      {loadState === 'error' && (
        <div style={{ padding: 18, borderRadius: 14, background: C.redTint, border: `1px solid ${C.red}30`, fontSize: 12, color: C.red, textAlign: 'center', fontFamily: F.body }}>
          Couldn't load your report right now — try again in a moment.
        </div>
      )}

      {loadState === 'ready' && profile && (
        <>
          <div ref={cardRef}>
            <ReportPanel profile={profile} user={user} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={handleDownload}
              style={{
                flex: 1, border: 'none', borderRadius: 11, padding: '12px 20px', cursor: 'pointer',
                fontFamily: F.body, fontSize: 13, fontWeight: 700, color: '#fff',
                background: C.signal, boxShadow: `0 8px 20px ${C.signal}40`,
              }}
            >
              Download report
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              style={{
                flex: '0 0 auto', padding: '12px 20px', borderRadius: 11, cursor: sharing ? 'wait' : 'pointer',
                fontFamily: F.body, fontSize: 13, fontWeight: 700,
                background: C.signalTint, border: `1px solid ${C.signal}30`, color: C.signalDeep,
              }}
            >
              {sharing ? 'Sharing…' : 'Share'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ScoreCard;