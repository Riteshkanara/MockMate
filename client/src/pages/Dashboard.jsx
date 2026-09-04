import API_BASE from '../config/api.js';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getAICoach, getAIFreeform, getPerformanceAnalytics, startInterview, fixBadges } from '../Services/interviewService';
import { getShareLink } from '../Services/profileServices';
import PageLoader from '../components/PageLoader';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — READINESS TERMINAL v6
// A placement-readiness console, not a SaaS dashboard template. Every number
// here is computed from real session data; the design's job is to make that
// data feel like it belongs to a product people trust with a real decision.
//
// v6 rebuild: light paper base with two dark "instrument panel" moments
// (hero, activity log), a serif numeral for the one number that matters
// (IRS), Inter for everything else, mono reserved for true data labels only.
// Sections consolidated — Weekly Digest merged into the stat rail and
// Growth Velocity, cutting a redundant card. Badge grid tightened. Motion
// limited to one entrance sequence plus state-driven reveals.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Design tokens ────────────────────────────────────────────────────────
const C = {
  paper:        '#F6F8FD',
  paperDeep:    '#EEF2FC',

  surface:      '#FFFFFF',
  surfaceSunk:  '#F3F6FD',

  ink:          '#0A1628',
  ink2:         '#111F38',
  sub:          '#41547B',
  muted:        '#7C8CAD',
  faint:        '#AFBCDA',

  line:         '#DEE6F7',
  lineMd:       '#C4D2F0',
  lineStr:      '#8FAAE8',

  signal:       '#0057E8',
  signalDeep:   '#0041B8',
  signalTint:   '#EAF1FF',
  signalSoft:   '#4D8FFF',

  pulse:        '#00C2E8',
  pulseDeep:    '#0093C4',
  pulseTint:    '#E6FAFF',

  green:        '#0E8F63',
  greenTint:    '#E9F9F1',
  amber:        '#B4790A',
  amberTint:    '#FFF6E5',
  orange:       '#C2530C',
  orangeTint:   '#FFF1E6',
  red:          '#C22626',
  redTint:      '#FDECEC',

  bronze:       '#9C6A3E',
  bronzeTint:   '#F7EEE3',
  silver:       '#6E7B99',
  silverTint:   '#EFF2F8',
  gold:         '#AD7F10',
  goldTint:     '#FBF3DE',
  platinum:     '#4C57C7',
  platinumTint: '#EDEEFC',

  shadow:   '0 1px 2px rgba(10,22,40,0.04), 0 8px 24px rgba(15,45,120,0.06)',
  shadowMd: '0 4px 14px rgba(15,45,120,0.08), 0 1px 3px rgba(10,22,40,0.05)',
  shadowLg: '0 24px 64px rgba(6,16,50,0.28)',
};

const F = {
  serif: "'Fraunces', 'Georgia', serif",
  body:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:  "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

const TIER_STYLE = {
  bronze:   { color: C.bronze,   tint: C.bronzeTint,   ring: 'rgba(156,106,62,0.28)' },
  silver:   { color: C.silver,   tint: C.silverTint,   ring: 'rgba(110,123,153,0.28)' },
  gold:     { color: C.gold,     tint: C.goldTint,     ring: 'rgba(173,127,16,0.28)' },
  platinum: { color: C.platinum, tint: C.platinumTint, ring: 'rgba(76,87,199,0.28)' },
};

const TIER_META = {
  '₹3–6 LPA':   { color: C.muted,   bg: C.surfaceSunk },
  '₹6–12 LPA':  { color: C.amber,   bg: C.amberTint },
  '₹12–20 LPA': { color: C.signal,  bg: C.signalTint },
  '₹20 LPA+':   { color: C.pulseDeep, bg: C.pulseTint },
};

const DIMENSION_META = [
  { key: 'technical',      label: 'Technical Depth', icon: '⚙',  weight: 0.28, tip: 'Core CS fundamentals — the first thing technical screeners test.' },
  { key: 'problemSolving', label: 'Problem Solving', icon: '◈', weight: 0.22, tip: 'How you break down unknowns — decisive in live coding rounds.' },
  { key: 'communication',  label: 'Communication',   icon: '◐', weight: 0.18, tip: 'Clarity of thought, not just English — interviewers notice it fast.' },
  { key: 'behavioral',     label: 'Behavioral',      icon: '◇', weight: 0.12, tip: 'Situational judgment and self-awareness under HR scrutiny.' },
  { key: 'design',         label: 'System Design',   icon: '▣', weight: 0.10, tip: 'Matters at ₹12 LPA+ — often the differentiator between tiers.' },
  { key: 'fundamentals',   label: 'CS Fundamentals', icon: '▤', weight: 0.10, tip: 'Breadth of core knowledge — separates prepared from lucky.' },
];

const ARCHETYPES = [
  { id: 'inconsistentGenius', label: 'Inconsistent Genius', icon: '◈', desc: 'High variance in scores — brilliant when in flow but needs to build floor quality.', fix: 'Consistency drills: aim to hold 65+ on every session before chasing 90+.' },
  { id: 'consistentClimber',  label: 'Consistent Climber',  icon: '↗', desc: 'Steady, reliable improvement — the archetype that wins campus placements.', fix: 'Keep the streak; add harder topic rotations to keep growing.' },
  { id: 'speedRunner',        label: 'Speed Runner',        icon: '⚡', desc: 'Fast answers but sometimes sacrifices depth for pace.', fix: 'Practise "think aloud" — say your reasoning before your answer.' },
  { id: 'deepThinker',        label: 'Deep Thinker',        icon: '◐', desc: 'Thorough and accurate — needs to improve time management under live pressure.', fix: 'Run timed drills; 2-minute cap per answer in quick-fire mode.' },
  { id: 'pressureCooker',     label: 'Pressure Cooker',     icon: '◆', desc: 'Scores improve in timed sessions — performs well under competition conditions.', fix: 'Channel this by signing up for live contest platforms weekly.' },
];

const BADGE_CATALOGUE = [
  { id: 'first_rep',       label: 'First Rep',       icon: '●', tier: 'bronze',   desc: 'Completed your first mock interview.' },
  { id: 'comeback_kid',    label: 'Comeback Kid',    icon: '↻', tier: 'gold',     desc: 'Bounced back 15+ points the session right after a bad one.' },
  { id: 'topic_slayer',    label: 'Topic Slayer',    icon: '◆', tier: 'gold',     desc: 'Scored 85+ on the same topic across 3 sessions in a row.' },
  { id: 'silent_grinder',  label: 'Silent Grinder',  icon: '◐', tier: 'silver',   desc: '7-day streak without a single 90+ "hero" session — pure consistency.' },
  { id: 'full_marks',      label: 'Full Marks',      icon: '◉', tier: 'silver',   desc: 'Nailed a question with a perfect 100 score.' },
  { id: 'no_skip_zone',    label: 'No Skip Zone',    icon: '▣', tier: 'bronze',   desc: 'Completed a full session without skipping anything.' },
  { id: 'speed_demon',     label: 'Speed Demon',     icon: '⚡', tier: 'silver',   desc: 'Averaged under 20s per question while still scoring 70+.' },
  { id: 'deep_diver',      label: 'Deep Diver',      icon: '◈', tier: 'silver',   desc: 'Took your time (70s+/question) and still scored 80+.' },
  { id: 'range_rider',     label: 'Range Rider',     icon: '◇', tier: 'bronze',   desc: 'Practiced across 6+ distinct topics.' },
  { id: 'iron_streak',     label: 'Iron Streak',     icon: '◆', tier: 'gold',     desc: 'Kept a 14-day practice streak alive.' },
  { id: 'the_grinder',     label: 'The Grinder',     icon: '⚙', tier: 'gold',     desc: 'Completed 25 mock interviews.' },
  { id: 'elite_pass',      label: 'Elite Pass',      icon: '★', tier: 'platinum', desc: 'Hit a 90+ session score.' },
  { id: 'weakness_slayer', label: 'Weakness Slayer', icon: '◎', tier: 'gold',     desc: 'Took a topic from under 50 to 75+ in a later session.' },
  { id: 'tier_jumper',     label: 'Tier Jumper',     icon: '↑', tier: 'platinum', desc: 'Crossed a package-tier threshold between sessions.' },
];

// ─── Pure maths helpers (unchanged logic) ─────────────────────────────────
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));

const ewma = (values, alpha = 0.35) => {
  if (!values.length) return 0;
  return values.reduce((acc, v, i) => (i === 0 ? v : alpha * v + (1 - alpha) * acc), values[0]);
};

const stdDev = (values) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const trendSlope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, v) => a + v, 0) / n;
  const num = values.reduce((a, v, i) => a + (i - xMean) * (v - yMean), 0);
  const den = values.reduce((a, _, i) => a + Math.pow(i - xMean, 2), 0);
  return den ? num / den : 0;
};

const deriveArchetype = (scoreTrend, avgTimePerQ, avgScore) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return ARCHETYPES[1];
  const sd = stdDev(scores);
  const slope = trendSlope(scores);
  if (sd > 18) return ARCHETYPES[0];
  if (slope > 2) return ARCHETYPES[1];
  if (avgTimePerQ != null && avgTimePerQ < 22) return ARCHETYPES[2];
  if (avgTimePerQ != null && avgTimePerQ > 52) return ARCHETYPES[3];
  return ARCHETYPES[4];
};

const predictNextScore = (scoreTrend) => {
  const scores = scoreTrend.map(s => s.score || 0);
  if (scores.length < 2) return null;
  const recent = scores.slice(-8);
  const ewmaVal = ewma(recent);
  const slope = trendSlope(recent);
  const predicted = ewmaVal + slope * 0.6;
  return clamp(predicted);
};

const buildHeatmap = (scoreTrend) => {
  const byDate = {};
  (scoreTrend ?? []).forEach(s => {
    if (s.date) {
      const key = s.date.slice(0, 10);
      byDate[key] = byDate[key] ? Math.round((byDate[key] + (s.score ?? 0)) / 2) : (s.score ?? 0);
    }
  });

  const WEEKS = 14;
  const now = new Date();
  const grid = [];

  for (let w = WEEKS - 1; w >= 0; w--) {
    const col = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - (w * 7 + d));
      const key = dt.toISOString().slice(0, 10);
      col.push({
        date: key,
        score: byDate[key] ?? 0,
        future: dt > now,
        hasData: Boolean(byDate[key]),
      });
    }
    grid.push(col);
  }
  return grid;
};

const heatmapStats = (grid) => {
  const cells = grid.flat().filter(c => !c.future && c.hasData);
  if (!cells.length) return { activeDays: 0, bestDay: null, avgScore: 0, longestStreak: 0 };

  const activeDays = cells.length;
  const bestDay = cells.reduce((b, c) => (c.score > b.score ? c : b), cells[0]);
  const avgScore = Math.round(cells.reduce((a, c) => a + c.score, 0) / cells.length);

  const sortedDates = [...new Set(cells.map(c => c.date))].sort();
  let longest = 1, current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diff = (curr - prev) / 86400000;
    if (diff === 1) { current++; if (current > longest) longest = current; }
    else current = 1;
  }

  return { activeDays, bestDay, avgScore, longestStreak: longest };
};

const bestFixTarget = (topicPerformance, dimensionProfile) => {
  if (!topicPerformance.length) return null;
  return topicPerformance
    .map(t => {
      const dim = DIMENSION_META.find(d => d.key === (dimensionProfile.find(dp => dp.contributingTopics?.includes(t.topic))?.key)) ?? {};
      const dimWeight = dim.weight ?? 0.1;
      const roi = dimWeight * (100 - (t.averageScore || 0));
      return { ...t, roi };
    })
    .sort((a, b) => b.roi - a.roi)[0];
};

const useLiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};

const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.signal : s >= 40 ? C.amber : C.orange;

const heatColor = (score, hasData) => {
  if (!hasData) return 'rgba(255,255,255,0.06)';
  if (score >= 88) return C.pulse;
  if (score >= 75) return '#3FA8E0';
  if (score >= 60) return '#5F82C4';
  if (score >= 45) return '#4A5C8A';
  if (score >= 25) return '#374766';
  return '#243352';
};

// ═══════════════════════════════════════════════════════════════════════════
// AI COACH MODAL
// ═══════════════════════════════════════════════════════════════════════════
const sectionAccents = {
  'VERDICT':               C.pulse,
  'CRITICAL GAPS':         '#FF6B6B',
  'STRENGTHS TO LEVERAGE': '#4ADE9C',
  '30-DAY BATTLE PLAN':    C.signalSoft,
  'MINDSET ALERT':         '#F0B94D',
};
const sectionIcons = {
  'VERDICT':               '◎',
  'CRITICAL GAPS':         '▲',
  'STRENGTHS TO LEVERAGE': '✦',
  '30-DAY BATTLE PLAN':    '▤',
  'MINDSET ALERT':         '◐',
};

const AICoachModal = ({ open, onClose, profile, irs, archetype, topTier, weakest, strongest, scoreTrend, totalSessions }) => {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const overlayRef = useRef(null);

  const scores = (scoreTrend || []).map(s => s.score || 0);
  const slope = scores.length >= 2 ? trendSlope(scores.slice(-6)) : 0;
  const sd = scores.length >= 2 ? stdDev(scores) : 0;

  const generateAnalysis = useCallback(async () => {
    setLoading(true); setAnalysis(''); setDone(false);
    try {
      const dimLines = (profile || []).map(d => {
        const gap = 100 - d.score;
        const trendMark = d.score >= 75 ? '↑ strong' : d.score >= 55 ? '→ developing' : '↓ weak';
        return `  • ${d.label}: ${d.score}/100 (${gap} pts to max) — ${trendMark}`;
      }).join('\n');

      const trendVerdict = slope > 1.5
        ? `improving fast (+${slope.toFixed(1)} pts/session)`
        : slope > 0
        ? `slowly improving (+${slope.toFixed(1)} pts/session)`
        : slope < -1
        ? `declining (${slope.toFixed(1)} pts/session) — RED FLAG`
        : 'plateaued (near-zero slope)';

      const consistencyVerdict = sd > 18
        ? `HIGH variance (StdDev ${sd.toFixed(1)}) — wildly inconsistent; good days mask deep gaps`
        : sd > 10
        ? `moderate variance (StdDev ${sd.toFixed(1)}) — some inconsistency to iron out`
        : `consistent (StdDev ${sd.toFixed(1)}) — reliable performer`;

      const prompt = `You are a senior placement preparation coach at a top Indian engineering coaching firm. You have seen hundreds of students get placed and fail to get placed at FAANG, product startups, and service companies. You give honest, specific, data-driven coaching — not generic encouragement.

You are writing a placement readiness report for a student. Use ONLY the data below. Do not invent numbers.

═══ STUDENT DATA ═══
IRS (Interview Readiness Score): ${irs}/100
Package tier unlocked: ${topTier?.label || 'Not determined yet'}
Performance archetype: ${archetype?.label || 'Unknown'} — ${archetype?.desc || ''}
Total sessions completed: ${totalSessions}
Score trend (last 6 sessions): ${trendVerdict}
Consistency: ${consistencyVerdict}

Strongest dimension: ${strongest?.label || '—'} at ${strongest?.score || 0}/100
Weakest dimension:   ${weakest?.label || '—'} at ${weakest?.score || 0}/100

All 6 dimensions breakdown:
${dimLines}
═══════════════════

Write exactly this structure. Plain text only. No markdown. No bullet symbols. No emojis. No preamble.

VERDICT
One ruthlessly honest sentence about where this student actually stands right now — name the IRS, name the tier, name the trajectory. Do not soften it.

CRITICAL GAPS
Exactly 3 gaps. Each on its own line. Start each with the dimension name and score, then say precisely what kind of questions they are failing at and why it costs them offers. Be brutally specific.

STRENGTHS TO LEVERAGE
Exactly 2 strengths. Each on its own line. Name the dimension and score. Explain how interviewers reward this and how to weaponize it in an actual interview room — not generic advice.

30-DAY BATTLE PLAN
Exactly 4 weekly targets, numbered Week 1 through Week 4. Each week: one specific skill to drill, a measurable target (e.g. "score 75+ on 3 consecutive DSA sessions"), and one topic area to focus on. Make it a real plan someone can follow tomorrow morning.

MINDSET ALERT
One honest paragraph (3-4 sentences) about the psychological pattern this archetype creates and how it silently sabotages placement. Name the specific trap. Tell them what top-placed students do differently. Do not be kind if the data shows a problem.

Hard limit: 350 words total. Every word must earn its place.`;

      const coach = await getAICoach();

      if (coach?.analysis) {
        const a = coach.analysis;
        setAnalysis(
          [
            'VERDICT', a.verdict, '',
            'CRITICAL GAPS', a.criticalGaps, '',
            'STRENGTHS TO LEVERAGE', a.strengths, '',
            '30-DAY BATTLE PLAN', a.battlePlan, '',
            'MINDSET ALERT', a.mindset,
          ].join('\n')
        );
      } else {
        setAnalysis('Unable to generate analysis. Try again.');
      }
    } catch (err) {
      if (err?.isQuota) {
        setAnalysis('QUOTA EXHAUSTED\n\nYour Gemini free-tier limit (20 req/day) is used up. Fix: open server/.env, set GEMINI_MODEL=gemini-2.5-flash, restart the server. The quota resets at midnight Pacific time.');
      } else {
        setAnalysis('Could not reach AI coach. Please check your connection and try again.');
      }
    } finally {
      setLoading(false); setDone(true);
    }
  }, [irs, archetype, strongest, weakest, totalSessions, slope, sd, profile, topTier]);

  useEffect(() => { if (open && !done && !loading && !analysis) generateAnalysis(); }, [open]);
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const parsedSections = done
    ? analysis.split(/\n(?=[A-Z][A-Z ]{3,}\n)/).filter(Boolean).map(s => {
        const lines = s.trim().split('\n');
        const heading = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        return { heading, body, accent: sectionAccents[heading] || C.signalSoft, icon: sectionIcons[heading] || '•' };
      }).filter(s => s.heading && s.body)
    : [];

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(6,14,32,0.7)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        animation: 'coachFadeIn 0.22s ease',
      }}
    >
      <style>{`
        @keyframes coachFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes coachSlideUp { from { opacity: 0; transform: translateY(28px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes coachSection { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{
        width: '100%', maxWidth: 760, maxHeight: '90vh',
        background: 'linear-gradient(160deg, #060E20 0%, #0A1832 42%, #0C2340 100%)',
        border: '1px solid rgba(0,194,232,0.18)', borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 40px 90px rgba(2,8,24,0.65)', display: 'flex', flexDirection: 'column',
        animation: 'coachSlideUp 0.32s cubic-bezier(.16,1,.3,1)',
      }}>
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, letterSpacing: '1.4px', color: C.pulse, marginBottom: 8 }}>AI Readiness Coach</div>
            <h2 style={{ margin: 0, fontFamily: F.serif, fontSize: 22, fontWeight: 600, color: '#fff', lineHeight: 1.22, fontStyle: 'italic' }}>Your personalised action plan</h2>
            <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.46)', fontSize: 12, lineHeight: 1.65, maxWidth: 440 }}>Built from your IRS components, score variance, and dimension gaps — not generic advice.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {done && (
              <button onClick={generateAnalysis} disabled={loading} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', padding: '8px 13px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
                Re-analyse
              </button>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {[
            { label: 'IRS', val: `${irs}/100`, color: scoreColor(irs) },
            { label: 'Tier', val: topTier?.label || '—', color: C.pulse },
            { label: 'Archetype', val: archetype?.label || '—', color: C.signalSoft },
            { label: 'Trend', val: slope >= 0 ? `+${slope.toFixed(1)}/s` : `${slope.toFixed(1)}/s`, color: slope >= 0 ? '#4ADE9C' : '#FF8B6B' },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1, padding: '12px 14px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign: 'center' }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '1px', color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'lowercase' }}>{item.label}</div>
              <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 700, color: item.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.val}</div>
            </div>
          ))}
        </div>

        <div style={{ overflowY: 'auto', padding: '22px 28px', flex: 1 }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                `Scanning IRS = ${irs}/100 across 6 dimensions…`,
                `Computing score variance (StdDev: ${sd.toFixed(1)})…`,
                `Mapping ${strongest?.label || '—'} strength vs ${weakest?.label || '—'} gap…`,
                'Drafting your 30-day battle plan…',
              ].map((msg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,194,232,0.12)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.pulse, flexShrink: 0, animation: `livePulse 1.4s ease ${i * 0.28}s infinite` }} />
                  <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: 12, fontFamily: F.mono }}>{msg}</div>
                </div>
              ))}
            </div>
          )}
          {done && parsedSections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {parsedSections.map((s, i) => (
                <div key={i} style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `2px solid ${s.accent}`, animation: `coachSection 0.38s ease ${i * 0.07}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                    <span style={{ fontSize: 12, color: s.accent }}>{s.icon}</span>
                    <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 600, letterSpacing: '1.1px', color: s.accent, textTransform: 'lowercase' }}>{s.heading}</div>
                  </div>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-line' }}>{s.body}</p>
                </div>
              ))}
              <div style={{ marginTop: 4, padding: '14px 18px', borderRadius: 12, background: 'rgba(0,87,232,0.1)', border: '1px solid rgba(0,87,232,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.52)', lineHeight: 1.5 }}>Deep-dive into skill velocity, confidence gaps, and blind spots on your Analytics page.</div>
                <a href="/analytics" onClick={onClose} style={{ border: 'none', borderRadius: 9, background: `linear-gradient(135deg, ${C.signal}, ${C.pulse})`, color: '#fff', padding: '9px 16px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,194,232,0.25)' }}>
                  Open full analytics →
                </a>
              </div>
            </div>
          )}
          {done && parsedSections.length === 0 && analysis && (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{analysis}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FOCUS THIS WEEK CARD
// ═══════════════════════════════════════════════════════════════════════════
const FocusThisWeekCard = ({ topicPerformance, dimensionProfile, weakestDim, scoreTrend, onDrill, starting }) => {
  const [focus, setFocus] = useState(null);
  const [loading, setLoading] = useState(false);

  const topWeakTopic = useMemo(() => {
    if (!topicPerformance.length) return null;
    return [...topicPerformance]
      .map(t => {
        const dim = DIMENSION_META.find(d => d.key === (dimensionProfile.find(dp => dp.contributingTopics?.includes(t.topic))?.key)) ?? {};
        const roi = (dim.weight ?? 0.1) * (100 - (t.averageScore || 0));
        return { ...t, roi };
      })
      .sort((a, b) => b.roi - a.roi)[0];
  }, [topicPerformance, dimensionProfile]);

  const slope = trendSlope((scoreTrend || []).slice(-6).map(s => s.score || 0));

  useEffect(() => {
    if (!topWeakTopic && !weakestDim) return;
    let cancelled = false;

    const cacheKey = `mm_focus_week_${topWeakTopic?.topic || 'none'}_${weakestDim?.key || 'none'}`;
    const CACHE_TTL = 30 * 60 * 1000;

    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts < CACHE_TTL) {
          setFocus(parsed.text);
          return;
        }
      }
    } catch { /* non-fatal */ }

    (async () => {
      setLoading(true);
      try {
        const prompt = `You are a placement coach. In ONE sharp sentence (max 25 words), tell this Indian CS/IT student exactly what to focus on this week and why it will move their IRS the most.

Context:
- Weakest topic: ${topWeakTopic?.topic || '—'} (score: ${topWeakTopic?.averageScore || 0}/100)
- Weakest dimension: ${weakestDim?.label || '—'} (score: ${weakestDim?.score || 0}/100)
- Recent trend slope: ${slope.toFixed(1)} pts/session

Reply with ONLY the one sentence. No preamble, no label.`;

        const text = await getAIFreeform(prompt, 80);
        const cleaned = text.trim().replace(/^[\"']|[\"']$/g, '') || null;

        if (!cancelled) {
          setFocus(cleaned);
          if (cleaned) {
            try { sessionStorage.setItem(cacheKey, JSON.stringify({ text: cleaned, ts: Date.now() })); } catch { /* non-fatal */ }
          }
        }
      } catch (err) {
        if (!cancelled && err?.isQuota) {
          setFocus('Gemini quota exhausted — set GEMINI_MODEL=gemini-2.5-flash in server/.env and restart.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [topWeakTopic?.topic, weakestDim?.key]);

  if (!topWeakTopic && !weakestDim) return null;

  const topic = topWeakTopic?.topic || weakestDim?.label || '—';
  const score = topWeakTopic?.averageScore ?? weakestDim?.score ?? 0;
  const col = scoreColor(score);

  return (
    <section style={{ ...S.card, background: `linear-gradient(160deg, #fff 0%, ${C.signalTint} 130%)`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${C.signalTint} 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={S.eyebrow}>Focus this week</div>
            <h2 style={S.cardH2}>Your highest-ROI move right now</h2>
          </div>
          <div style={{ padding: '5px 11px', borderRadius: 8, background: `${col}14`, border: `1px solid ${col}38`, fontFamily: F.mono, fontSize: 9.5, fontWeight: 600, color: col, flexShrink: 0 }}>
            top priority
          </div>
        </div>
        <div style={{ padding: '16px 18px', borderRadius: 14, background: '#fff', border: `1px solid ${C.line}`, boxShadow: C.shadow, marginBottom: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: F.body, fontSize: 16, fontWeight: 700, color: C.ink }}>{topic}</div>
            <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 600, color: col }}>{score}</div>
          </div>
          <div style={{ height: 5, borderRadius: 999, background: C.line, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${score}%`, background: col, borderRadius: 999, transition: 'width 1s ease' }} />
          </div>
          <div style={{ minHeight: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.signalSoft, animation: 'livePulse 1.2s ease infinite' }} />
                <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>AI is picking your focus…</span>
              </div>
            ) : focus ? (
              <p style={{ margin: 0, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{focus}</p>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                Highest ROI score — fixing this moves your IRS more than anything else right now.
              </p>
            )}
          </div>
        </div>
        {topicPerformance.length > 1 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 15 }}>
            {[...topicPerformance].sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0)).slice(1, 4).map(t => {
              const c = scoreColor(t.averageScore || 0);
              return (
                <div key={t.topic} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, background: C.surfaceSunk, border: `1px solid ${C.line}`, cursor: 'pointer' }} onClick={() => onDrill(t.topic)}>
                  <span style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, color: c }}>{t.averageScore || 0}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: C.sub }}>{t.topic}</span>
                </div>
              );
            })}
          </div>
        )}
        <button style={{ ...S.btnBlue, width: '100%', justifyContent: 'center', display: 'flex' }} className="mm-btn-blue" onClick={() => onDrill(topic)} disabled={starting}>
          Drill {topic} now →
        </button>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clock = useLiveClock();

  const [dashStats, setDashStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const statsPromise = fetch(`${API_BASE}/dashboard/stats`, {
          credentials: 'include',
        }).then(r => r.json());

        const analyticsData = await getPerformanceAnalytics();

        statsPromise.then(s => setDashStats(s)).catch(() => {});
        setAnalytics(analyticsData);
      } catch (e) {
        console.error('Dashboard load:', e);
      } finally {
        setLoading(false);
        requestAnimationFrame(() => setTimeout(() => setMounted(true), 40));
      }
    })();
  }, []);

  const startQuick = useCallback(async (topic = '') => {
    try {
      setStarting(true);
      const r = await startInterview({ mode: 'quick', company: '', topic });
      navigate('/interview', { state: { sessionId: r.sessionId, questions: r.questions, mode: 'quick' } });
    } catch (e) {
      console.error('Start interview:', e);
    } finally {
      setStarting(false);
    }
  }, [navigate]);

  const [fixingBadges, setFixingBadges] = useState(false);
  const handleFixBadges = useCallback(async () => {
    setFixingBadges(true);
    try {
      const data = await fixBadges();
      const fresh = await getPerformanceAnalytics();
      setAnalytics(fresh);
      const gained = data.newBadges?.length ?? 0;
      setToast({
        msg: gained > 0
          ? `${gained} badge${gained > 1 ? 's' : ''} unlocked`
          : 'Badges are up to date',
        type: 'success',
      });
    } catch (e) {
      console.error('Fix badges failed:', e);
      setToast({ msg: 'Could not recheck badges — try again', type: 'error' });
    } finally {
      setFixingBadges(false);
      setTimeout(() => setToast(null), 3000);
    }
  }, []);

  // ── Derived raw fields ────────────────────────────────────────────────
  const totalInterviews = analytics?.totalInterviews ?? analytics?.totalSessions ?? 0;
  const averageScore = analytics?.averageScore ?? 0;
  const bestScore = analytics?.bestScore ?? analytics?.highestScore ?? dashStats?.stats?.bestScore ?? 0;
  const scoreTrend = analytics?.scoreTrend ?? [];
  const topicPerformance = useMemo(() => analytics?.topicPerformance ?? [], [analytics]);
  const badgesRaw = useMemo(() => analytics?.badges ?? [], [analytics]);

  const streakDays = user?.streak?.current ?? dashStats?.stats?.currentStreak ?? 0;
  const avgTimePerQ = analytics?.timePerformance?.averageTimePerQuestion ?? null;
  const hasData = totalInterviews > 0;

  const latestScore = scoreTrend.at(-1)?.score ?? 0;
  const prevScore = scoreTrend.at(-2)?.score ?? latestScore;
  const delta = latestScore - prevScore;

  const irs = analytics?.irs ?? 0;

  const currentTierLabel = analytics?.currentTier ?? '₹3–6 LPA';
  const currentTierMeta = TIER_META[currentTierLabel] ?? TIER_META['₹3–6 LPA'];
  const currentTier = { label: currentTierLabel, ...currentTierMeta };

  const apiTiers = analytics?.tiers ?? [];
  const nextTierApi = apiTiers.find(t => !t.isUnlocked && t.label !== currentTierLabel) ?? null;
  const nextTier = nextTierApi
    ? { label: nextTierApi.label, minScore: nextTierApi.minIRS, color: TIER_META[nextTierApi.label]?.color ?? C.signal, advice: nextTierApi.advice }
    : null;
  const irsGap = nextTier ? Math.max(0, nextTier.minScore - irs) : 0;

  const dimensionProfile = useMemo(() => {
    const apiProfile = analytics?.dimensionProfile ?? [];
    return DIMENSION_META.map(meta => {
      const apiDim = apiProfile.find(d => d.key === meta.key);
      return {
        ...meta,
        score: apiDim?.score ?? 0,
        hasData: apiDim?.hasData ?? false,
        isProvisional: apiDim?.isProvisional ?? false,
        answeredCount: apiDim?.answeredCount ?? 0,
        contributingTopics: apiDim?.contributingTopics ?? [],
      };
    });
  }, [analytics]);

  const archetype = useMemo(
    () => deriveArchetype(scoreTrend, avgTimePerQ, averageScore),
    [scoreTrend, avgTimePerQ, averageScore]
  );

  const dimWithData = dimensionProfile.filter(d => d.hasData);
  const strongestDim = [...dimWithData].sort((a, b) => b.score - a.score)[0];
  const weakestDim = [...dimWithData].sort((a, b) => a.score - b.score)[0];

  const fixTarget = useMemo(
    () => bestFixTarget(topicPerformance, dimensionProfile),
    [topicPerformance, dimensionProfile]
  );

  const heatmap = useMemo(() => buildHeatmap(scoreTrend), [scoreTrend]);
  const hmStats = useMemo(() => heatmapStats(heatmap), [heatmap]);

  const nextPrediction = useMemo(() => predictNextScore(scoreTrend), [scoreTrend]);

  const badges = useMemo(() => {
    const byId = {};
    badgesRaw.forEach(b => { byId[b.id] = b; });
    return BADGE_CATALOGUE.map(def => {
      const live = byId[def.id];
      return {
        ...def,
        unlocked: live?.unlocked ?? false,
        progress: live?.progress ?? null,
        meta: live?.meta ?? null,
      };
    });
  }, [badgesRaw]);
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const nextBadge = useMemo(() => {
    const locked = badges.filter(b => !b.unlocked && typeof b.progress === 'number');
    return locked.sort((a, b) => (b.progress || 0) - (a.progress || 0))[0] || null;
  }, [badges]);

  const sessionId = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), []);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div style={S.page} className="mm-page">
      <GlobalStyles />
      <Toast toast={toast} />
      <AICoachModal
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        profile={dimensionProfile}
        irs={irs}
        archetype={archetype}
        topTier={currentTier}
        weakest={weakestDim}
        strongest={strongestDim}
        scoreTrend={scoreTrend}
        totalSessions={totalInterviews}
      />
      <div style={{ ...S.container, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(8px)', transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(.16,1,.3,1)' }}>

        {/* ── STATUS STRIP ──────────────────────────────────────────── */}
        <div style={S.strip} className="mm-strip">
          <div style={S.stripL}>
            <span style={S.liveDot} />
            <span style={S.mono}>mockmate readiness terminal</span>
          </div>
          <div style={S.stripR} className="mm-strip-r">
            <span style={S.mono}>session {sessionId}</span>
            <span style={{ color: C.lineMd }}>·</span>
            <span style={S.mono}>
              {clock.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toLowerCase()}{' '}
              {clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section style={S.hero} className="mm-hero">
          <div style={S.heroNoise} />
          <div style={S.heroGrid} className="mm-hero-grid">

            <div style={S.irsBlock}>
              <div style={S.irsLabel}>interview readiness score</div>
              <div style={S.irsNum} className="mm-irs-num">
                {hasData ? irs : '—'}
                {hasData && <span style={S.irsMax}>/100</span>}
              </div>
              {hasData && (
                <>
                  <div style={{ ...S.tierPill, background: `rgba(255,255,255,0.08)`, color: '#fff', border: `1px solid rgba(255,255,255,0.18)` }}>
                    {currentTier.label} eligible
                  </div>
                  {analytics?.currentTierIsGated && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 8, lineHeight: 1.55, maxWidth: 240 }}>
                      Math already tracks toward {analytics.currentTierRaw} — {analytics.sessionsNeededForRawTier} more session{analytics.sessionsNeededForRawTier === 1 ? '' : 's'} to confirm it.
                    </div>
                  )}
                  <div style={S.irsBar}>
                    <div style={{ ...S.irsBarFill, width: mounted ? `${irs}%` : '0%' }} />
                    {nextTier && (
                      <div style={{ ...S.irsNextMark, left: `${nextTier.minScore}%` }} title={`${nextTier.label} threshold`} />
                    )}
                  </div>
                  {nextTier && (
                    <div style={S.irsGapText}>
                      {irsGap} points to <span style={{ color: C.pulse, fontWeight: 600 }}>{nextTier.label}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={S.verdictBlock}>
              <div style={S.heroKicker}>Placement verdict</div>
              <h1 style={S.heroH1}>
                {user?.name?.split(' ')[0] ? `${user.name.split(' ')[0]}, ` : ''}
                {!hasData
                  ? "let's build your readiness profile."
                  : `you're trending toward ${currentTier.label}.`}
              </h1>
              {!hasData ? (
                <p style={S.heroSub}>
                  Run one interview and MockMate computes your IRS — a weighted score
                  across six dimensions that maps to real package tiers.
                </p>
              ) : (
                <p style={S.heroSub}>
                  {totalInterviews} session{totalInterviews !== 1 ? 's' : ''} logged ·{' '}
                  strongest in <strong style={{ color: '#fff', fontWeight: 600 }}>{strongestDim?.label ?? '—'}</strong>,
                  sharpest gap in <strong style={{ color: C.pulse, fontWeight: 600 }}>{weakestDim?.label ?? '—'}</strong>.
                </p>
              )}
              <div style={S.heroActions}>
                <button style={S.btnPrimary} className="mm-btn-primary" onClick={() => startQuick()} disabled={starting}>
                  {starting ? 'Launching…' : hasData ? 'New mock interview' : 'Run first interview'}
                </button>
                {hasData && (
                  <button style={S.btnGhost} className="mm-btn-ghost" onClick={() => navigate('/analytics')}>
                    Full analytics
                  </button>
                )}
                {hasData && (
                  <button
                    style={{ ...S.btnGhost, background: 'rgba(0,194,232,0.1)', borderColor: 'rgba(0,194,232,0.3)', color: '#8FE9FF' }}
                    className="mm-btn-ghost"
                    onClick={() => setCoachOpen(true)}
                  >
                    AI Coach
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {hasData && (<>

          {/* ── STAT RAIL ─────────────────────────────────────────────── */}
          <section style={S.statRail} className="mm-stat-rail">
            <RailStat label="Average score" value={averageScore} unit="/100" sub="Mean across all sessions" color={scoreColor(averageScore)} onClick={() => navigate('/analytics')} />
            <RailStat label="Best session" value={bestScore} unit="/100" sub="Your personal ceiling" color={C.signal} onClick={() => navigate('/history')} />
            <RailStat label="Sessions logged" value={totalInterviews} unit="" sub={streakDays ? `${streakDays}-day streak` : 'No active streak'} color={C.green} onClick={() => navigate('/history')} />
            <RailStat label="Last session" value={`${delta >= 0 ? '+' : ''}${delta}`} unit=" pts" sub={delta > 0 ? 'Moving up' : delta < 0 ? 'Slipping — drill now' : 'Flat'} color={delta >= 0 ? C.green : C.orange} onClick={() => startQuick()} />
          </section>

          {/* ── PREDICTOR + FOCUS THIS WEEK ─────────────────────────────── */}
          <section style={S.twoCol} className="mm-two-col">
            <PredictorCard prediction={nextPrediction} lastScore={latestScore} averageScore={averageScore} onStart={() => startQuick()} starting={starting} />
            <FocusThisWeekCard
              topicPerformance={topicPerformance}
              dimensionProfile={dimensionProfile}
              weakestDim={weakestDim}
              scoreTrend={scoreTrend}
              onDrill={startQuick}
              starting={starting}
            />
          </section>

          {/* ── IRS BREAKDOWN + FIX THIS NEXT ───────────────────────────── */}
          <section style={S.twoCol} className="mm-two-col">
            <div style={S.card}>
              <div style={S.cardHeader}>
                <div>
                  <div style={S.eyebrow}>Six-dimension breakdown</div>
                  <h2 style={S.cardH2}>Your IRS components</h2>
                  <p style={S.cardSub}>
                    Each bar is weighted — heavier dimensions influence your IRS more.
                    Gaps here are where readiness points are actually lost.
                  </p>
                </div>
                <button style={S.linkBtn} className="mm-link-btn" onClick={() => navigate('/analytics')}>Full radar →</button>
              </div>
              <div style={S.dimList}>
                {dimensionProfile.map(d => {
                  const col = d.hasData ? scoreColor(d.score) : C.faint;
                  return (
                    <div key={d.key} style={S.dimRow} className="mm-dim-row" title={d.tip}>
                      <div style={S.dimMeta}>
                        <div style={S.dimLeft}>
                          <span style={S.dimIcon}>{d.icon}</span>
                          <div>
                            <span style={S.dimName}>{d.label}</span>
                            <span style={S.dimWeight}>{Math.round((d.weight ?? 0) * 100)}% weight</span>
                          </div>
                        </div>
                        <span style={{ ...S.dimScore, color: d.hasData ? col : C.faint }}>
                          {d.hasData ? d.score : '—'}
                          {d.isProvisional && d.hasData && <span title="Provisional — more sessions needed" style={{ fontSize: 9, marginLeft: 3, color: C.amber, fontWeight: 700 }}>~</span>}
                        </span>
                      </div>
                      <div style={S.dimTrack}>
                        <div style={{ ...S.dimFill, width: mounted && d.hasData ? `${d.score}%` : '0%', background: col, opacity: d.hasData ? 1 : 0.3 }} />
                      </div>
                      {!d.hasData && <div style={S.dimNoData}>No sessions for these topics yet</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...S.card, display: 'flex', flexDirection: 'column' }}>
              <div style={S.eyebrow}>Highest-ROI fix</div>
              <h2 style={S.cardH2}>Where to drill next</h2>

              {fixTarget ? (
                <>
                  <div style={S.fixBox}>
                    <div style={S.fixTop}>
                      <span style={S.fixTopic}>{fixTarget.topic}</span>
                      <span style={{ ...S.fixScore, color: scoreColor(fixTarget.averageScore || 0) }}>{fixTarget.averageScore || 0}</span>
                    </div>
                    <div style={S.fixTrack}>
                      <div style={{ ...S.fixFill, width: `${fixTarget.averageScore || 0}%`, background: scoreColor(fixTarget.averageScore || 0) }} />
                    </div>
                    <div style={S.fixStats}>
                      <span style={S.fixStat}><strong>{100 - (fixTarget.averageScore || 0)}</strong> pts headroom</span>
                      <span style={S.fixStat}><strong>{Math.round(fixTarget.roi * 10) / 10}</strong> ROI score</span>
                      <span style={S.fixStat}><strong>{fixTarget.attempts ?? '—'}</strong> questions attempted</span>
                    </div>
                    <p style={S.fixHint}>
                      ROI score = dimension weight × score gap. Closing this topic gap
                      moves your IRS more than any other single change right now.
                    </p>
                  </div>

                  <div style={S.archetypeBox}>
                    <div style={S.archetypeHead}>
                      <span style={S.archetypeIcon}>{archetype.icon}</span>
                      <div>
                        <div style={S.archetypeName}>{archetype.label}</div>
                        <div style={S.archetypeDesc}>{archetype.desc}</div>
                      </div>
                    </div>
                    <div style={S.archetypeFix}>{archetype.fix}</div>
                  </div>

                  <button style={{ ...S.btnBlue, marginTop: 'auto' }} className="mm-btn-blue" onClick={() => startQuick(fixTarget.topic)} disabled={starting}>
                    Drill {fixTarget.topic} now
                  </button>
                </>
              ) : (
                <p style={S.cardSub}>Complete a few more sessions to unlock targeted recommendations.</p>
              )}
            </div>
          </section>

          {/* ── BADGE SHOWCASE ───────────────────────────────────────────── */}
          <BadgeShowcase badges={badges} unlockedCount={unlockedCount} nextBadge={nextBadge} mounted={mounted} onFixBadges={handleFixBadges} />

          {/* ── AI COACH TEASER + WEEKLY CHALLENGES ──────────────────────── */}
          <section style={S.twoCol} className="mm-two-col">
            <AICoachTeaserCard onOpen={() => setCoachOpen(true)} weakestDim={weakestDim} irs={irs} tier={currentTier} />
            <WeeklyChallenges scoreTrend={scoreTrend} topicPerformance={topicPerformance} streakDays={streakDays} />
          </section>

          {/* ── GROWTH VELOCITY ──────────────────────────────────────────── */}
          <GrowthVelocityCard scoreTrend={scoreTrend} longestStreak={dashStats?.stats?.longestStreak} hmStats={hmStats} totalInterviews={totalInterviews} />

          {/* ── SHARE CARD ────────────────────────────────────────────────── */}
          <ShareCard
            name={user?.name?.split(' ')[0] || 'Candidate'}
            irs={irs}
            tier={currentTier}
            strongest={strongestDim}
            archetype={archetype}
            sessions={totalInterviews}
          />

          {/* ── ACTIVITY LOG (dark panel) ─────────────────────────────────── */}
          <ActivityHeatmap
            heatmap={heatmap}
            stats={{ ...hmStats, longestStreak: dashStats?.stats?.longestStreak ?? hmStats.longestStreak }}
            total={totalInterviews}
            mounted={mounted}
          />

          {/* ── NEXT TIER BANNER ─────────────────────────────────────────── */}
          {nextTier && (
            <section style={S.tierBanner} className="mm-banner">
              <div style={{ flex: 1 }}>
                <div style={S.eyebrow}>Next milestone</div>
                <h2 style={S.bannerH2}>
                  {irsGap} IRS points from <span style={{ color: nextTier.color }}>{nextTier.label}</span>
                </h2>
                <p style={S.bannerSub}>
                  {nextTier.advice} {weakestDim && `Focus on ${weakestDim.label} — it's your largest open gap.`}
                </p>
                <div style={S.bannerTrack}>
                  <div style={{ ...S.bannerFill, width: mounted ? `${Math.min(100, nextTier.minScore > 0 ? (irs / nextTier.minScore) * 100 : 100)}%` : '0%' }} />
                  <div style={{ ...S.bannerMark, left: '100%' }} title={`${nextTier.label} threshold`} />
                </div>
                <div style={S.bannerCaption}>{irs}/{nextTier.minScore} IRS needed</div>
              </div>
              <button style={S.btnBannerCta} className="mm-banner-cta" onClick={() => startQuick()} disabled={starting}>Keep climbing →</button>
            </section>
          )}

        </>)}

        <footer style={S.footerRow}>
          <span style={S.mono}>mockmate readiness engine v6.0</span>
          <span style={S.mono}>irs = weighted dimension avg · ewma trend · breadth · consistency</span>
        </footer>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Stat rail — divided strip, not repeated cards ───────────────────────
const RailStat = ({ label, value, unit, sub, color, onClick }) => (
  <div style={{ ...S.railCell, cursor: onClick ? 'pointer' : 'default' }} className="mm-rail-cell" onClick={onClick}>
    <div style={S.railLabel}>{label}</div>
    <div style={S.railValRow}>
      <span style={{ ...S.railVal, color }}>{value}</span>
      {unit && <span style={S.railUnit}>{unit}</span>}
    </div>
    <div style={S.railSub}>{sub}</div>
  </div>
);

// ─── Next Session Predictor ───────────────────────────────────────────────
const PredictorCard = ({ prediction, lastScore, averageScore, onStart, starting }) => {
  if (prediction == null) {
    return (
      <div style={S.card}>
        <div style={S.eyebrow}>Next session forecast</div>
        <h2 style={S.cardH2}>Not enough data yet</h2>
        <p style={S.cardSub}>Complete 2+ sessions and MockMate will project your next likely score from your trend.</p>
      </div>
    );
  }
  const delta = prediction - lastScore;
  const band = 6;
  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrow}>Next session forecast</div>
          <h2 style={S.cardH2}>If you play true to form…</h2>
          <p style={S.cardSub}>Projected from your EWMA trend, not a promise — a data-backed expectation.</p>
        </div>
      </div>
      <div style={S.predictRow}>
        <div style={S.predictBlock}>
          <div style={S.predictNum}>{prediction}</div>
          <div style={S.predictBand}>±{band} pts</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={S.predictBarTrack}>
            <div style={{ ...S.predictBarLow, left: `${Math.max(0, prediction - band)}%`, width: `${Math.min(100, band * 2)}%` }} />
            <div style={{ ...S.predictMarker, left: `${clamp(prediction)}%` }} />
            <div style={{ ...S.predictMarkerAvg, left: `${clamp(averageScore)}%` }} title={`Your average: ${averageScore}`} />
          </div>
          <div style={S.predictLegend}>
            <span><span style={{ ...S.legendDot, background: C.signal }} /> Forecast</span>
            <span><span style={{ ...S.legendDot, background: C.faint }} /> Your average</span>
          </div>
          <p style={S.predictNote}>
            {delta > 3 ? `Trending up — ${Math.round(delta)} pts above your last session.` :
             delta < -3 ? `Trending down — drill your weakest topic before your next run.` :
             `Holding steady near your recent form.`}
          </p>
        </div>
      </div>
      <button style={{ ...S.btnBlue, marginTop: 16 }} className="mm-btn-blue" onClick={onStart} disabled={starting}>Beat the forecast →</button>
    </div>
  );
};

// ─── Badge Showcase ─────────────────────────────────────────────────────────
const BadgeShowcase = ({ badges, unlockedCount, nextBadge, mounted, onFixBadges }) => {
  const [selected, setSelected] = useState(null);
  const [fixing, setFixing] = useState(false);

  const handleFix = async () => {
    setFixing(true);
    try { await onFixBadges?.(); } finally { setFixing(false); }
  };

  return (
    <section style={{ ...S.card, marginBottom: 18 }}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrow}>Achievements</div>
          <h2 style={S.cardH2}>{unlockedCount}/{badges.length} badges earned</h2>
          <p style={S.cardSub}>Every badge here is computed from real session patterns — comebacks, streaks, speed-vs-accuracy — not just session counts.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {nextBadge && (
            <div style={S.nextBadgeChip}>
              <span style={{ fontSize: 14, color: C.signal }}>{nextBadge.icon}</span>
              <div>
                <div style={S.nextBadgeLabel}>next up</div>
                <div style={S.nextBadgeName}>{nextBadge.label}</div>
              </div>
              <div style={S.nextBadgeProgress}>
                <div style={S.nextBadgeTrack}>
                  <div style={{ ...S.nextBadgeFill, width: `${Math.round((nextBadge.progress || 0) * 100)}%` }} />
                </div>
                <span style={S.nextBadgePct}>{Math.round((nextBadge.progress || 0) * 100)}%</span>
              </div>
            </div>
          )}
          <button
            onClick={handleFix}
            disabled={fixing}
            className="mm-recheck-btn"
            title="Recompute badges against all your completed sessions — use this if a badge looks wrong"
            style={{
              border: `1px solid ${C.line}`, borderRadius: 9, background: C.surface,
              padding: '7px 13px', color: C.sub, cursor: fixing ? 'default' : 'pointer',
              fontSize: 11, fontWeight: 600, opacity: fixing ? 0.6 : 1,
            }}
          >
            {fixing ? 'Rechecking…' : 'Recheck badges'}
          </button>
        </div>
      </div>

      <div style={S.badgeGrid} className="mm-badge-grid">
        {badges.map((b, i) => {
          const tierStyle = TIER_STYLE[b.tier] || TIER_STYLE.bronze;
          const isSelected = selected === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setSelected(isSelected ? null : b.id)}
              style={{
                ...S.badgeCell,
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'scale(1)' : 'scale(0.94)',
                transitionDelay: `${i * 20}ms`,
                background: b.unlocked ? tierStyle.tint : C.surfaceSunk,
                border: `1px solid ${b.unlocked ? tierStyle.ring : C.line}`,
                boxShadow: isSelected ? `0 0 0 2px ${tierStyle.ring}` : 'none',
              }}
              title={b.desc}
            >
              <div style={{ ...S.badgeIcon, color: b.unlocked ? tierStyle.color : C.faint, opacity: b.unlocked ? 1 : 0.5 }}>{b.icon}</div>
              <div style={{ ...S.badgeName, color: b.unlocked ? C.ink : C.faint }}>{b.label}</div>
              {b.unlocked ? (
                <div style={{ ...S.badgeTierTag, color: tierStyle.color, background: `${tierStyle.color}16` }}>{b.tier}</div>
              ) : typeof b.progress === 'number' && b.progress > 0 ? (
                <div style={S.badgeMiniTrack}><div style={{ ...S.badgeMiniFill, width: `${Math.round(b.progress * 100)}%` }} /></div>
              ) : (
                <div style={S.badgeLockedTag}>locked</div>
              )}
            </button>
          );
        })}
      </div>

      {selected && (() => {
        const b = badges.find(x => x.id === selected);
        if (!b) return null;
        const tierStyle = TIER_STYLE[b.tier] || TIER_STYLE.bronze;
        return (
          <div style={{ ...S.badgeDetail, borderColor: tierStyle.ring }}>
            <div style={{ fontSize: 22, color: tierStyle.color }}>{b.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={S.badgeDetailName}>{b.label}</span>
                <span style={{ ...S.badgeTierTag, color: tierStyle.color, background: `${tierStyle.color}16` }}>{b.tier}</span>
                {b.unlocked && <span style={{ ...S.badgeTierTag, color: C.green, background: C.greenTint }}>earned</span>}
              </div>
              <p style={S.badgeDetailDesc}>{b.desc}</p>
              {b.meta && (
                <p style={S.badgeDetailMeta}>
                  {b.meta.topic && `Topic: ${b.meta.topic}. `}
                  {b.meta.streak && `Streak: ${b.meta.streak} days. `}
                  {b.meta.dip != null && `Recovered ${b.meta.recovery} pts after a ${b.meta.dip}-pt dip. `}
                  {b.meta.threshold && `Crossed the ₹${b.meta.threshold >= 80 ? '20L+' : b.meta.threshold >= 60 ? '12–20L' : '6–12L'} tier. `}
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </section>
  );
};

// ─── AI Coach Teaser ─────────────────────────────────────────────────────────
const AICoachTeaserCard = ({ onOpen, weakestDim }) => (
  <div style={S.coachTeaserCard}>
    <div style={S.coachTeaserGlow} />
    <div style={{ position: 'relative' }}>
      <div style={S.heroKicker}>AI Readiness Coach</div>
      <h2 style={{ fontFamily: F.serif, fontSize: 19, fontWeight: 600, color: '#fff', margin: '10px 0 10px', lineHeight: 1.3, fontStyle: 'italic' }}>
        Get your personalised 30-day battle plan.
      </h2>
      <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.6)', fontSize: 12.5, lineHeight: 1.7 }}>
        Your coach studies your IRS components, score variance, strongest and weakest dimensions — then writes you a verdict, critical gaps, and a concrete 4-week plan. Specific to your numbers, not generic advice.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {['Verdict', 'Critical gaps', '30-day plan', 'Mindset alert'].map(label => (
          <div key={label} style={{
            padding: '5px 11px', borderRadius: 7,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 10.5, fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
          }}>
            {label}
          </div>
        ))}
      </div>
      {weakestDim && (
        <div style={{ marginBottom: 18, padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'rgba(255,255,255,0.62)', lineHeight: 1.55 }}>
          Biggest unlock: <strong style={{ color: '#fff', fontWeight: 600 }}>{weakestDim.label}</strong> at {weakestDim.score}/100 — your coach will tell you exactly how to fix this.
        </div>
      )}
      <button style={S.coachTeaserBtn} className="mm-coach-btn" onClick={onOpen}>
        Open AI Coach →
      </button>
    </div>
  </div>
);

// ─── Weekly Challenges ────────────────────────────────────────────────────────
const WeeklyChallenges = ({ scoreTrend, topicPerformance, streakDays }) => {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  const thisWeek = scoreTrend.filter(s => s.date && new Date(s.date) >= weekAgo);
  const strongSessions = thisWeek.filter(s => (s.score || 0) >= 75).length;
  const topicsTouched = new Set(topicPerformance.filter(t => (t.attempts ?? 0) > 0).map(t => t.topic)).size;

  const challenges = [
    { icon: '◎', title: 'Score 75+ in 3 sessions', current: Math.min(strongSessions, 3), target: 3, helper: 'Build a reliable performance floor.' },
    { icon: '◇', title: 'Cover 5 topics', current: Math.min(topicsTouched, 5), target: 5, helper: 'Keep your preparation broad.' },
    { icon: '◆', title: 'Hold a 7-day streak', current: Math.min(streakDays, 7), target: 7, helper: 'Consistency compounds.' },
  ];

  const completed = challenges.filter(c => c.current >= c.target).length;

  return (
    <section style={S.card}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrow}>Weekly challenges</div>
          <h2 style={S.cardH2}>Turn this week into progress</h2>
          <p style={S.cardSub}>Small targets designed to build consistency, breadth, and confidence.</p>
        </div>
        <div style={S.challengeSummary}>
          <div>{completed}/{challenges.length}</div>
          <span style={S.challengeSummarySpan}>done</span>
        </div>
      </div>

      <div style={S.challengeList}>
        {challenges.map(challenge => {
          const progress = Math.min(100, Math.round((challenge.current / challenge.target) * 100));
          const done = challenge.current >= challenge.target;

          return (
            <div key={challenge.title} style={S.challengeRow} className="mm-challenge-row">
              <div style={S.challengeIcon}>{challenge.icon}</div>
              <div style={S.challengeBody}>
                <div style={S.challengeTop}>
                  <div>
                    <div style={S.challengeTitle}>{challenge.title}</div>
                    <div style={S.challengeHelper}>{challenge.helper}</div>
                  </div>
                  <div style={{ ...S.challengeCount, color: done ? C.green : C.signalDeep }}>
                    {challenge.current}/{challenge.target}
                  </div>
                </div>
                <div style={S.challengeTrack}>
                  <div style={{ ...S.challengeFill, width: `${progress}%`, background: done ? C.green : `linear-gradient(90deg, ${C.signal}, ${C.pulse})` }} />
                </div>
              </div>
              <div style={{ ...S.challengeStatus, color: done ? C.green : C.muted }}>
                {done ? '✓' : `${progress}%`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const Toast = ({ toast }) => {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: isError ? C.red : C.ink,
      color: '#fff', padding: '11px 20px', borderRadius: 12,
      fontWeight: 600, fontSize: 13, zIndex: 9999, pointerEvents: 'none',
      fontFamily: F.body, letterSpacing: '-0.1px',
      boxShadow: `0 8px 28px ${isError ? 'rgba(194,38,38,0.3)' : 'rgba(10,22,40,0.3)'}`,
      animation: 'fadeUp 0.22s ease',
    }}>
      {toast.msg}
    </div>
  );
};

// ─── Growth Velocity — merged with weekly digest ─────────────────────────────
const GrowthVelocityCard = ({ scoreTrend, longestStreak, hmStats, totalInterviews }) => {
  const weekly = useMemo(() => {
    const buckets = {};
    scoreTrend.forEach(session => {
      if (!session.date) return;
      const date = new Date(session.date);
      const weekStart = new Date(date);
      const day = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - day);
      weekStart.setHours(0, 0, 0, 0);
      const key = weekStart.toISOString().slice(0, 10);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(session.score || 0);
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([date, scores]) => ({
        date,
        score: Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length),
        count: scores.length,
      }));
  }, [scoreTrend]);

  const displayLongestStreak = longestStreak ?? hmStats.longestStreak;

  if (weekly.length < 2) {
    return (
      <section style={{ ...S.card, marginBottom: 18 }}>
        <div style={S.eyebrow}>Growth velocity</div>
        <h2 style={S.cardH2}>Not enough weekly data yet</h2>
        <p style={S.cardSub}>
          Keep practising. Once MockMate has multiple weeks of sessions, this chart will
          show whether your performance is compounding or plateauing.
        </p>
      </section>
    );
  }

  const latest = weekly.at(-1)?.score ?? 0;
  const previous = weekly.at(-2)?.score ?? latest;
  const delta = latest - previous;
  const max = Math.max(...weekly.map(w => w.score), 100);
  const thisWeekSessions = weekly.at(-1)?.count ?? 0;

  return (
    <section style={{ ...S.card, marginBottom: 18 }}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.eyebrow}>Growth velocity</div>
          <h2 style={S.cardH2}>Are you compounding?</h2>
          <p style={S.cardSub}>Rolling weekly averages make your long-term direction easier to read than individual session scores.</p>
        </div>
        <div style={{ ...S.growthDelta, color: delta >= 0 ? C.green : C.orange }}>
          <div>{delta >= 0 ? '+' : ''}{delta}</div>
          <span style={S.growthDeltaSpan}>vs last week</span>
        </div>
      </div>

      <div style={S.velocityChart}>
        {weekly.map((week, index) => {
          const height = Math.max(12, Math.round((week.score / max) * 100));
          return (
            <div key={week.date} style={S.velocityColumn}>
              <div style={S.velocityScore}>{week.score}</div>
              <div style={S.velocityTrack}>
                <div style={{ ...S.velocityBar, height: `${height}%` }} />
              </div>
              <div style={S.velocityWeek}>w{index + 1}</div>
            </div>
          );
        })}
      </div>

      <div style={S.digestGrid}>
        <div style={S.digestCell}>
          <div style={S.digestVal}>{thisWeekSessions}</div>
          <div style={S.digestLabel}>sessions this week</div>
        </div>
        <div style={S.digestCell}>
          <div style={{ ...S.digestVal, color: C.signal }}>{displayLongestStreak}d</div>
          <div style={S.digestLabel}>longest streak</div>
        </div>
        <div style={S.digestCell}>
          <div style={S.digestVal}>{totalInterviews}</div>
          <div style={S.digestLabel}>lifetime sessions</div>
        </div>
      </div>

      <div style={S.velocityFooter}>
        <span>
          {delta > 3 ? 'Momentum is building.' : delta < -3 ? 'You may be plateauing — change the drill.' : 'Your performance is holding steady.'}
        </span>
        <span>{weekly.length} week{weekly.length !== 1 ? 's' : ''} tracked</span>
      </div>
    </section>
  );
};

// ─── Activity heatmap — dark instrument panel, echoes the hero ──────────────
const MONTH_LABELS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const ActivityHeatmap = ({ heatmap, stats, mounted }) => {
  const [hovered, setHovered] = useState(null);

  const monthCols = useMemo(() => {
    const seen = {};
    return heatmap.map((week, wi) => {
      const m = new Date(week[0].date).getMonth();
      if (seen[m]) return null;
      seen[m] = true;
      return { wi, label: MONTH_LABELS[m] };
    }).filter(Boolean);
  }, [heatmap]);

  return (
    <section style={S.hmPanel} className="mm-hm-panel">
      <div style={S.hmPanelHeader}>
        <div>
          <div style={S.heroKicker}>Practice activity</div>
          <h2 style={{ fontFamily: F.body, fontSize: 17, fontWeight: 700, color: '#fff', margin: '8px 0 0' }}>Session log — last 14 weeks</h2>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.44)', lineHeight: 1.6, maxWidth: 420 }}>
            Each cell is one day. Brighter cyan means a higher score that day.
          </p>
        </div>
        <div style={S.hmLegend}>
          <span style={S.hmLegendLabel}>low</span>
          {[10, 35, 52, 68, 82, 92].map(v => (
            <div key={v} style={{ width: 10, height: 10, borderRadius: 2, background: heatColor(v, true), flexShrink: 0 }} />
          ))}
          <span style={S.hmLegendLabel}>high</span>
        </div>
      </div>

      <div style={S.hmMonthRow}>
        <div style={{ width: 24 }} />
        <div style={{ position: 'relative', flex: 1, height: 16 }}>
          {monthCols.map(({ wi, label }) => (
            <span key={wi} style={{ ...S.hmMonthLabel, left: `${(wi / heatmap.length) * 100}%` }}>{label}</span>
          ))}
        </div>
      </div>

      <div style={S.hmWrap}>
        <div style={S.hmDayCols}>
          {['S','M','T','W','T','F','S'].map((d, i) => (<div key={i} style={S.hmDayLbl}>{d}</div>))}
        </div>
        <div style={S.hmGrid}>
          {heatmap.map((week, wi) => (
            <div key={wi} style={S.hmWeekCol}>
              {week.map((day, di) => (
                <div
                  key={di}
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...S.hmCell,
                    background: day.future ? 'transparent' : heatColor(day.score, day.hasData),
                    border: day.future ? `1px dashed rgba(255,255,255,0.12)` : 'none',
                    cursor: day.hasData ? 'pointer' : 'default',
                    transform: hovered?.date === day.date ? 'scale(1.7)' : 'scale(1)',
                    boxShadow: hovered?.date === day.date ? `0 0 0 2px ${C.pulse}, 0 2px 10px rgba(0,194,232,0.4)` : 'none',
                    zIndex: hovered?.date === day.date ? 2 : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {hovered && hovered.hasData && (
        <div style={S.hmTooltip}>
          <strong>{new Date(hovered.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
          {' '}· Score: <strong style={{ color: C.pulse }}>{hovered.score}/100</strong>
          {' '}· {hovered.score >= 80 ? 'Strong session' : hovered.score >= 60 ? 'Solid session' : hovered.score >= 40 ? 'Room to grow' : 'Tough one — happens to everyone'}
        </div>
      )}

      <div style={S.hmFooterGrid} className="mm-hm-footer">
        <HmStat label="Active days" value={stats.activeDays} sub="Days with at least one session" />
        <HmStat label="Longest streak" value={`${stats.longestStreak}d`} sub="Consecutive practice days" />
        <HmStat label="Avg score" value={stats.avgScore || '—'} sub="Mean across active days" />
        <HmStat label="Best day" value={stats.bestDay?.score ?? '—'} sub={stats.bestDay ? new Date(stats.bestDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No sessions yet'} />
      </div>
    </section>
  );
};

const HmStat = ({ label, value, sub }) => (
  <div style={S.hmStatBox}>
    <div style={S.hmStatVal}>{value}</div>
    <div style={S.hmStatLabel}>{label}</div>
    <div style={S.hmStatSub}>{sub}</div>
  </div>
);

// ─── Share card ────────────────────────────────────────────────────────────────
const ShareCard = ({ name, irs, tier, strongest, percentile, archetype, sessions }) => {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState(false);

  const handleShare = async () => {
    const text = `${name}'s MockMate readiness: IRS ${irs}/100 — ${tier.label} eligible. Strongest in ${strongest?.label ?? '—'}${percentile ? `, top ${100 - percentile + 1}%` : ''}. Style: ${archetype.label}. ${sessions} sessions logged.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My MockMate Readiness Score', text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch { /* user cancelled */ }
  };

  const handleCopyProfileLink = async () => {
    setLinkLoading(true);
    setLinkError(false);
    try {
      const { slug } = await getShareLink();
      const url = `${window.location.origin}/p/${slug}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2200);
    } catch (err) {
      console.error('Copy profile link failed:', err);
      setLinkError(true);
      setTimeout(() => setLinkError(false), 2200);
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div style={S.shareCard}>
      <div style={S.shareGlow} />
      <div style={S.heroKicker}>Shareable score card</div>
      <div style={S.shareRow} className="mm-share-row">
        <div style={S.shareLeft}>
          <div style={S.shareIRS}>{irs}</div>
          <div style={S.shareIRSLabel}>irs</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={S.shareTitle}>{name} is {tier.label} eligible</h2>
          <p style={S.shareDesc}>
            Strongest: <strong style={{ color: '#fff', fontWeight: 600 }}>{strongest?.label ?? '—'}</strong>
            {percentile ? <> · Top <strong style={{ color: C.pulse, fontWeight: 600 }}>{100 - percentile + 1}%</strong></> : null}
            {' '}· {archetype.label}
          </p>
          <div>
            <button style={S.btnShare} className="mm-share-btn" onClick={handleShare}>{copied ? 'Copied to clipboard' : 'Share your score'}</button>
            <button style={S.btnShareLink} className="mm-share-link-btn" onClick={handleCopyProfileLink} disabled={linkLoading}>
              {linkLoading ? 'Generating link…' : linkError ? 'Couldn\u2019t copy — try again' : linkCopied ? 'Link copied' : 'Copy public profile link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Global styles ─────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @keyframes spin        { to { transform: rotate(360deg); } }
    @keyframes livePulse   { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
    @keyframes fadeUp      { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes scaleIn     { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
    @keyframes barFill     { from { width:0; } }
    @keyframes heroSweep   { 0% { transform:translateX(-30%); } 100% { transform:translateX(130%); } }

    *, *::before, *::after { box-sizing: border-box; }
    ::selection { background: rgba(0,87,232,0.16); color: ${C.ink}; }

    .mm-page button:focus-visible, .mm-page a:focus-visible {
      outline: 2px solid ${C.signal}; outline-offset: 3px; border-radius: 6px;
    }

    .mm-page ::-webkit-scrollbar { width: 5px; height: 5px; }
    .mm-page ::-webkit-scrollbar-track { background: transparent; }
    .mm-page ::-webkit-scrollbar-thumb { background: ${C.lineMd}; border-radius: 4px; }
    .mm-page ::-webkit-scrollbar-thumb:hover { background: ${C.lineStr}; }

    .mm-rail-cell {
      transition: background 0.18s ease !important;
    }
    .mm-rail-cell:hover { background: ${C.surfaceSunk} !important; }

    .mm-card-hover, .mm-page section {
      transition: box-shadow 0.2s ease, border-color 0.2s ease !important;
    }

    .mm-badge-grid button {
      transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.18s ease, border-color 0.18s ease !important;
    }
    .mm-badge-grid button:hover { transform: translateY(-3px) !important; box-shadow: 0 6px 18px rgba(0,87,232,0.14) !important; }
    .mm-badge-grid button:active { transform: translateY(-1px) !important; }

    .mm-btn-primary {
      transition: transform 0.15s cubic-bezier(.16,1,.3,1), box-shadow 0.15s ease !important;
    }
    .mm-btn-primary:hover { transform: translateY(-2px) !important; box-shadow: 0 10px 26px rgba(0,0,0,0.28) !important; }
    .mm-btn-primary:active { transform: translateY(0) !important; }

    .mm-btn-ghost {
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease !important;
    }
    .mm-btn-ghost:hover { background: rgba(255,255,255,0.14) !important; transform: translateY(-1px) !important; }

    .mm-btn-blue {
      transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important;
    }
    .mm-btn-blue:hover { box-shadow: 0 8px 22px rgba(0,87,232,0.35) !important; transform: translateY(-2px) !important; }
    .mm-btn-blue:active { transform: translateY(0) !important; }
    .mm-btn-blue:disabled { opacity: 0.55; transform: none !important; box-shadow: none !important; cursor: not-allowed; }

    .mm-link-btn {
      transition: color 0.15s ease, transform 0.15s ease !important; display: inline-flex; align-items: center; gap: 4px;
      border: none; background: transparent; cursor: pointer; font-family: ${F.body};
    }
    .mm-link-btn:hover { color: ${C.signalDeep} !important; transform: translateX(2px) !important; }

    .mm-coach-btn {
      transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important;
    }
    .mm-coach-btn:hover { box-shadow: 0 10px 26px rgba(0,194,232,0.4) !important; transform: translateY(-2px) !important; }

    .mm-dim-row {
      transition: background 0.16s ease, border-color 0.16s ease !important;
    }
    .mm-dim-row:hover { background: ${C.signalTint} !important; border-color: ${C.lineMd} !important; }

    .mm-challenge-row {
      transition: background 0.16s ease, border-color 0.16s ease !important;
    }
    .mm-challenge-row:hover { background: ${C.signalTint} !important; border-color: ${C.lineMd} !important; }

    .mm-strip { transition: box-shadow 0.2s ease !important; }
    .mm-strip:hover { box-shadow: ${C.shadowMd} !important; }

    .mm-share-btn { transition: box-shadow 0.18s ease, transform 0.18s ease !important; }
    .mm-share-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 20px rgba(0,194,232,0.35) !important; }
    .mm-share-link-btn { transition: background 0.18s ease, transform 0.18s ease !important; }
    .mm-share-link-btn:hover { background: rgba(255,255,255,0.12) !important; transform: translateY(-1px) !important; }

    .mm-banner-cta { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
    .mm-banner-cta:hover { box-shadow: 0 10px 24px rgba(0,87,232,0.32) !important; transform: translateY(-2px) !important; }

    .mm-recheck-btn { transition: background 0.15s ease, border-color 0.15s ease !important; }
    .mm-recheck-btn:hover:not(:disabled) { background: ${C.signalTint} !important; border-color: ${C.lineMd} !important; }

    .mm-container { animation: fadeUp 0.5s cubic-bezier(.16,1,.3,1) both; }
    .mm-irs-num { animation: scaleIn 0.7s cubic-bezier(.16,1,.3,1) both 0.1s; }
    .mm-irs-fill { animation: barFill 1.4s cubic-bezier(.16,1,.3,1) both 0.3s; }

    @media (prefers-reduced-motion: reduce) {
      .mm-page * { animation: none !important; transition-duration: 0.01ms !important; }
    }

    @media (max-width: 1020px) {
      .mm-two-col { grid-template-columns: 1fr !important; }
      .mm-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
      .mm-badge-grid { grid-template-columns: repeat(4, 1fr) !important; }
      .mm-stat-rail { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 760px) {
      .mm-banner { flex-direction: column !important; }
      .mm-strip-r { display: none !important; }
      .mm-share-row { flex-direction: column !important; }
      .mm-hm-footer { grid-template-columns: repeat(2, 1fr) !important; }
      .mm-badge-grid { grid-template-columns: repeat(3, 1fr) !important; }
    }
    @media (max-width: 480px) {
      .mm-stat-rail { grid-template-columns: 1fr !important; }
      .mm-page { padding: 14px 12px 60px !important; }
      .mm-hm-footer { grid-template-columns: 1fr !important; }
      .mm-badge-grid { grid-template-columns: repeat(2, 1fr) !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
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
  liveDot: { width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'livePulse 2.4s ease-in-out infinite' },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.3px', color: C.muted },

  hero: {
    position: 'relative', overflow: 'hidden',
    padding: '44px 36px', marginBottom: 20, borderRadius: 22,
    background: `linear-gradient(150deg, #060E20 0%, #0A1A38 38%, #0C2242 66%, #0E3358 100%)`,
    boxShadow: '0 28px 70px rgba(4,12,34,0.34)',
  },
  heroNoise: { position: 'absolute', top: 0, left: 0, width: '30%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.025), transparent)', animation: 'heroSweep 11s linear infinite' },
  heroGrid: { position: 'relative', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 44, alignItems: 'center' },

  irsBlock: {},
  irsLabel: { fontFamily: F.mono, fontSize: 10, fontWeight: 500, letterSpacing: '1px', color: 'rgba(255,255,255,0.42)', marginBottom: 12 },
  irsNum: { fontFamily: F.serif, fontSize: 86, fontWeight: 500, lineHeight: 0.95, color: '#fff', letterSpacing: '-3px' },
  irsMax: { fontSize: 24, fontWeight: 400, color: 'rgba(255,255,255,0.36)', letterSpacing: 0, fontFamily: F.body },
  tierPill: { display: 'inline-flex', alignItems: 'center', marginTop: 16, padding: '6px 13px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.1px' },
  irsBar: { position: 'relative', height: 4, marginTop: 18, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'visible' },
  irsBarFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.signalSoft}, ${C.pulse})`, transition: 'width 1.3s cubic-bezier(.16,1,.3,1)' },
  irsNextMark: { position: 'absolute', top: -4, width: 2, height: 12, borderRadius: 1, background: 'rgba(255,255,255,0.5)', transform: 'translateX(-50%)' },
  irsGapText: { marginTop: 10, fontFamily: F.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2px' },

  verdictBlock: {},
  heroKicker: { fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '1.8px', color: C.cyanBright, textTransform: 'uppercase' },
  heroH1: { margin: '14px 0 0', fontFamily: F.serif, fontSize: 32, fontWeight: 500, color: '#fff', lineHeight: 1.28, letterSpacing: '-0.4px', maxWidth: 620 },
  heroSub: { margin: '15px 0 0', fontSize: 13.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.62)', maxWidth: 560, fontWeight: 400 },
  heroActions: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 26 },

  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 11, background: '#fff', color: C.ink, padding: '13px 22px', fontSize: 13.5, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', letterSpacing: '-0.1px' },
  btnGhost: { border: '1px solid rgba(255,255,255,0.16)', borderRadius: 11, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', color: '#fff', padding: '13px 20px', fontSize: 13, fontWeight: 500, fontFamily: F.body, cursor: 'pointer' },
  btnBlue: { border: 'none', borderRadius: 11, background: `linear-gradient(135deg, ${C.signalDeep}, ${C.signal})`, color: '#fff', padding: '12px 20px', fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: `0 4px 14px rgba(0,87,232,0.28)`, textAlign: 'center', letterSpacing: '-0.1px' },
  btnShare: { marginTop: 16, border: 'none', borderRadius: 10, background: `linear-gradient(135deg, ${C.signal}, ${C.pulse})`, color: '#fff', padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,194,232,0.28)' },
  btnShareLink: { marginTop: 16, marginLeft: 10, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.82)', padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnBannerCta: { flexShrink: 0, border: 'none', borderRadius: 12, background: `linear-gradient(135deg, ${C.signalDeep}, ${C.signal})`, color: '#fff', padding: '14px 24px', fontSize: 13.5, fontWeight: 700, fontFamily: F.body, cursor: 'pointer', boxShadow: `0 6px 20px rgba(0,87,232,0.26)`, alignSelf: 'flex-start' },

  // Stat rail — one divided strip instead of four identical cards
  statRail: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20, borderRadius: 18, background: C.surface, border: `1px solid ${C.line}`, boxShadow: C.shadow, overflow: 'hidden' },
  railCell: { padding: '20px 24px', borderRight: `1px solid ${C.line}` },
  railLabel: { fontSize: 11, fontWeight: 500, color: C.muted, letterSpacing: '0.1px' },
  railValRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 },
  railVal: { fontFamily: F.serif, fontSize: 32, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.5px' },
  railUnit: { fontFamily: F.mono, fontSize: 12, color: C.muted },
  railSub: { marginTop: 8, fontSize: 11, color: C.muted, lineHeight: 1.5 },

  card: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: 26, boxShadow: C.shadow, marginBottom: 18 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 },
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.8px', color: C.signal, marginBottom: 7, textTransform: 'lowercase' },
  cardH2: { margin: 0, fontFamily: F.body, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: '-0.2px' },
  cardSub: { margin: '7px 0 0', fontSize: 12.5, lineHeight: 1.65, color: C.sub, maxWidth: 440 },

  twoCol: { display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, marginBottom: 18 },

  dimList: { display: 'flex', flexDirection: 'column', gap: 10 },
  dimRow: { padding: '14px 16px', borderRadius: 12, background: C.surfaceSunk, border: `1px solid ${C.line}` },
  dimMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  dimLeft: { display: 'flex', alignItems: 'center', gap: 11 },
  dimIcon: { fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0, color: C.signal },
  dimName: { fontSize: 12.5, fontWeight: 600, color: C.ink, display: 'block' },
  dimWeight: { fontSize: 10, color: C.muted, fontFamily: F.mono, display: 'block', marginTop: 2 },
  dimScore: { fontFamily: F.serif, fontSize: 19, fontWeight: 500 },
  dimTrack: { height: 5, borderRadius: 999, background: C.line, overflow: 'hidden' },
  dimFill: { height: '100%', borderRadius: 999, transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' },
  dimNoData: { marginTop: 5, fontSize: 10.5, color: C.faint, fontFamily: F.mono },

  fixBox: { marginTop: 16, padding: 17, borderRadius: 13, background: C.signalTint, border: `1px solid ${C.lineMd}` },
  fixTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  fixTopic: { fontFamily: F.body, fontSize: 15.5, fontWeight: 700, color: C.ink },
  fixScore: { fontFamily: F.serif, fontSize: 19, fontWeight: 500 },
  fixTrack: { height: 6, borderRadius: 999, background: C.line, overflow: 'hidden', marginBottom: 13 },
  fixFill: { height: '100%', borderRadius: 999 },
  fixStats: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 11 },
  fixStat: { fontSize: 11.5, color: C.sub, fontFamily: F.mono },
  fixHint: { margin: 0, fontSize: 11.5, color: C.sub, lineHeight: 1.65 },

  archetypeBox: { marginTop: 16, padding: 15, borderRadius: 13, background: C.surfaceSunk, border: `1px solid ${C.line}` },
  archetypeHead: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 11 },
  archetypeIcon: { width: 40, height: 40, borderRadius: 10, fontSize: 17, background: C.signalTint, border: `1px solid ${C.lineMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.signal },
  archetypeName: { fontFamily: F.body, fontSize: 14, fontWeight: 700, color: C.ink },
  archetypeDesc: { fontSize: 12, color: C.sub, marginTop: 3, lineHeight: 1.55 },
  archetypeFix: { fontSize: 11.5, color: C.signalDeep, lineHeight: 1.6, paddingTop: 9, borderTop: `1px solid ${C.line}` },

  predictRow: { display: 'flex', alignItems: 'center', gap: 24, marginTop: 6 },
  predictBlock: { textAlign: 'center', flexShrink: 0, width: 96 },
  predictNum: { fontFamily: F.serif, fontSize: 46, fontWeight: 500, color: C.signalDeep, lineHeight: 1 },
  predictBand: { fontFamily: F.mono, fontSize: 10, color: C.muted, marginTop: 5 },
  predictBarTrack: { position: 'relative', height: 7, borderRadius: 999, background: C.line, marginTop: 6 },
  predictBarLow: { position: 'absolute', top: 0, height: '100%', borderRadius: 999, background: C.signalTint },
  predictMarker: { position: 'absolute', top: -3, width: 3, height: 13, borderRadius: 2, background: C.signalDeep, transform: 'translateX(-50%)' },
  predictMarkerAvg: { position: 'absolute', top: -2, width: 2, height: 11, borderRadius: 1, background: C.faint, transform: 'translateX(-50%)' },
  predictLegend: { display: 'flex', gap: 16, marginTop: 9, fontSize: 10.5, color: C.sub, fontFamily: F.mono },
  legendDot: { display: 'inline-block', width: 7, height: 7, borderRadius: '50%', marginRight: 5 },
  predictNote: { margin: '11px 0 0', fontSize: 11.5, color: C.sub, lineHeight: 1.6 },

  digestGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18 },
  digestCell: { textAlign: 'center', padding: '14px 8px', background: C.surfaceSunk, borderRadius: 11, border: `1px solid ${C.line}` },
  digestVal: { fontFamily: F.serif, fontSize: 22, fontWeight: 500, color: C.ink },
  digestLabel: { fontFamily: F.mono, fontSize: 9, fontWeight: 500, letterSpacing: '0.3px', color: C.muted, marginTop: 6 },

  nextBadgeChip: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: C.signalTint, border: `1px solid ${C.lineMd}`, flexShrink: 0, minWidth: 180 },
  nextBadgeLabel: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 500, letterSpacing: '0.4px', color: C.muted },
  nextBadgeName: { fontSize: 11.5, fontWeight: 700, color: C.ink, marginTop: 1 },
  nextBadgeProgress: { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  nextBadgeTrack: { width: 44, height: 5, borderRadius: 999, background: C.line, overflow: 'hidden' },
  nextBadgeFill: { height: '100%', borderRadius: 999, background: C.signal },
  nextBadgePct: { fontFamily: F.mono, fontSize: 9.5, color: C.signalDeep, fontWeight: 600 },

  badgeGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 },
  badgeCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '17px 10px', borderRadius: 14, cursor: 'pointer', fontFamily: F.body, textAlign: 'center', position: 'relative', overflow: 'hidden' },
  badgeIcon: { fontSize: 19 },
  badgeName: { fontSize: 10, fontWeight: 600, lineHeight: 1.25 },
  badgeTierTag: { fontSize: 8.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6, textTransform: 'lowercase', letterSpacing: '0.2px', fontFamily: F.mono },
  badgeLockedTag: { fontSize: 8.5, fontWeight: 500, color: C.faint, fontFamily: F.mono, letterSpacing: '0.2px' },
  badgeMiniTrack: { width: '80%', height: 4, borderRadius: 999, background: C.line, overflow: 'hidden', marginTop: 2 },
  badgeMiniFill: { height: '100%', borderRadius: 999, background: C.signalSoft },
  badgeDetail: { display: 'flex', gap: 15, alignItems: 'flex-start', marginTop: 18, padding: '17px 19px', borderRadius: 13, background: C.surfaceSunk, border: '1.5px solid' },
  badgeDetailName: { fontFamily: F.body, fontSize: 15, fontWeight: 700, color: C.ink },
  badgeDetailDesc: { margin: '7px 0 0', fontSize: 12, color: C.sub, lineHeight: 1.6 },
  badgeDetailMeta: { margin: '9px 0 0', fontSize: 11, color: C.signalDeep, lineHeight: 1.6, fontFamily: F.mono },

  coachTeaserCard: { position: 'relative', overflow: 'hidden', padding: '24px 26px', borderRadius: 18, background: `linear-gradient(160deg, #060E20 0%, #0A1832 50%, #0C2340 100%)`, boxShadow: C.shadowLg, display: 'flex', flexDirection: 'column' },
  coachTeaserGlow: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, rgba(0,194,232,0.18), transparent 68%)`, pointerEvents: 'none' },
  coachTeaserBtn: { position: 'relative', marginTop: 4, alignSelf: 'flex-start', border: 'none', borderRadius: 10, background: `linear-gradient(135deg, ${C.signal}, ${C.pulse})`, color: '#fff', padding: '10px 18px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,194,232,0.3)', fontFamily: F.body },

  challengeSummary: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 54, height: 54, borderRadius: 12, background: C.signalTint, border: `1px solid ${C.lineMd}`, color: C.signalDeep, fontFamily: F.serif, fontSize: 19, fontWeight: 500, lineHeight: 1 },
  challengeSummarySpan: { marginTop: 4, fontFamily: F.mono, fontSize: 8, color: C.muted, letterSpacing: '0.3px' },
  challengeList: { display: 'flex', flexDirection: 'column', gap: 10 },
  challengeRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 12, background: C.surfaceSunk, border: `1px solid ${C.line}` },
  challengeIcon: { width: 34, height: 34, borderRadius: 9, background: C.signalTint, border: `1px solid ${C.lineMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.signal, flexShrink: 0 },
  challengeBody: { flex: 1, minWidth: 0 },
  challengeTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  challengeTitle: { fontSize: 11.5, fontWeight: 700, color: C.ink },
  challengeHelper: { marginTop: 2, fontSize: 10, color: C.muted },
  challengeCount: { fontFamily: F.mono, fontSize: 10, fontWeight: 600, flexShrink: 0 },
  challengeTrack: { height: 5, borderRadius: 999, background: C.line, overflow: 'hidden' },
  challengeFill: { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(.16,1,.3,1)' },
  challengeStatus: { width: 28, textAlign: 'right', fontFamily: F.mono, fontSize: 9, fontWeight: 600, flexShrink: 0 },

  growthDelta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: F.serif, fontSize: 22, fontWeight: 500, flexShrink: 0 },
  growthDeltaSpan: { marginTop: 3, fontFamily: F.mono, fontSize: 8, color: C.muted, fontWeight: 400 },

  velocityChart: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 155, marginTop: 8, padding: '10px 4px 0' },
  velocityColumn: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%', flex: 1, minWidth: 0 },
  velocityScore: { fontFamily: F.mono, fontSize: 8.5, color: C.sub, fontWeight: 600 },
  velocityTrack: { position: 'relative', width: '100%', maxWidth: 28, height: 105, display: 'flex', alignItems: 'flex-end', borderRadius: 6, background: C.surfaceSunk, border: `1px solid ${C.line}`, overflow: 'hidden' },
  velocityBar: { width: '100%', minHeight: 6, borderRadius: '6px 6px 0 0', background: `linear-gradient(180deg, ${C.pulse}, ${C.signal})`, transition: 'height 0.8s cubic-bezier(.16,1,.3,1)' },
  velocityWeek: { fontFamily: F.mono, fontSize: 8, color: C.muted },
  velocityFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontFamily: F.mono, fontSize: 9.5, color: C.sub },

  shareCard: { position: 'relative', overflow: 'hidden', padding: '28px 30px', borderRadius: 18, background: `linear-gradient(150deg, #060E20 0%, #0A1F42 50%, #0C2848 100%)`, boxShadow: C.shadowLg, marginBottom: 18 },
  shareGlow: { position: 'absolute', top: -90, right: -90, width: 260, height: 260, borderRadius: '50%', background: `radial-gradient(circle, rgba(0,194,232,0.16), transparent 68%)`, pointerEvents: 'none' },
  shareRow: { position: 'relative', display: 'flex', alignItems: 'center', gap: 24 },
  shareLeft: { textAlign: 'center', flexShrink: 0, width: 92 },
  shareIRS: { fontFamily: F.serif, fontSize: 60, fontWeight: 500, color: '#fff', lineHeight: 1 },
  shareIRSLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.42)', marginTop: 6 },
  shareTitle: { margin: 0, fontFamily: F.body, fontSize: 18, fontWeight: 700, color: '#fff' },
  shareDesc: { margin: '8px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.66)', lineHeight: 1.6 },

  // Dark activity panel (echoes hero)
  hmPanel: {
    position: 'relative', overflow: 'hidden',
    padding: '28px 30px', marginBottom: 18, borderRadius: 20,
    background: `linear-gradient(155deg, #060E20 0%, #0A1A38 40%, #0C2242 100%)`,
    boxShadow: C.shadowLg,
  },
  hmPanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' },
  hmLegend: { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 },
  hmLegendLabel: { fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3px' },

  hmMonthRow: { display: 'flex', alignItems: 'center', marginBottom: 4, overflow: 'hidden' },
  hmMonthLabel: { position: 'absolute', fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.36)', whiteSpace: 'nowrap' },

  hmWrap: { display: 'flex', alignItems: 'flex-start', gap: 5, overflowX: 'auto', overflowY: 'hidden', padding: '4px 2px 8px', scrollbarWidth: 'thin' },
  hmDayCols: { display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4, flexShrink: 0, paddingTop: 1 },
  hmDayLbl: { width: 11, height: 11, fontFamily: F.mono, fontSize: 8, color: 'rgba(255,255,255,0.34)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hmGrid: { display: 'flex', gap: 3, flexShrink: 0, width: 'max-content' },
  hmWeekCol: { display: 'flex', flexDirection: 'column', gap: 3, width: 11, flex: '0 0 11px' },
  hmCell: { width: 11, height: 11, minWidth: 11, minHeight: 11, borderRadius: 2, transition: 'transform 0.1s ease, box-shadow 0.1s ease', flexShrink: 0 },

  hmTooltip: { marginTop: 8, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 11.5, display: 'inline-block' },

  hmFooterGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginTop: 22, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' },
  hmStatBox: { padding: '15px 16px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' },
  hmStatVal: { fontFamily: F.serif, fontSize: 22, fontWeight: 500, color: C.pulse },
  hmStatLabel: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.5)', marginTop: 5 },
  hmStatSub: { fontSize: 10.5, color: 'rgba(255,255,255,0.34)', marginTop: 3, lineHeight: 1.4 },

  tierBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '32px 34px', marginBottom: 18, borderRadius: 20, background: `linear-gradient(135deg, ${C.signalTint} 0%, ${C.pulseTint} 100%)`, border: `1px solid ${C.lineMd}`, boxShadow: C.shadow },
  bannerH2: { margin: '9px 0', fontFamily: F.serif, fontSize: 24, fontWeight: 500, color: C.ink },
  bannerSub: { margin: 0, fontSize: 12.5, color: C.sub, maxWidth: 540, lineHeight: 1.6 },
  bannerTrack: { marginTop: 15, width: 'min(440px, 100%)', height: 5, borderRadius: 999, background: C.lineMd, overflow: 'visible', position: 'relative' },
  bannerFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.signal}, ${C.pulse})`, transition: 'width 1.2s cubic-bezier(.16,1,.3,1)', position: 'relative' },
  bannerMark: { position: 'absolute', top: -3, width: 2, height: 11, background: C.signalDeep, borderRadius: 1, transform: 'translateX(-50%)' },
  bannerCaption: { marginTop: 7, fontFamily: F.mono, fontSize: 10, color: C.muted },

  footerRow: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: '20px 4px 0', opacity: 0.42 },

  loadingWrap: { minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 44, height: 44, borderRadius: '50%', border: `4px solid ${C.signalTint}`, borderTopColor: C.signal, animation: 'spin 0.75s linear infinite' },
  loadTitle: { marginTop: 18, fontFamily: F.body, fontSize: 15, fontWeight: 700, color: C.ink },
  loadSub: { marginTop: 6, fontSize: 12, color: C.muted },

  emptyMsg: { padding: '28px 16px', textAlign: 'center', border: `1.5px dashed ${C.line}`, borderRadius: 12, color: C.muted, fontSize: 12 },
};

export default Dashboard;