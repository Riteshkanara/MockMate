import PropTypes from 'prop-types';
import { useState, useEffect } from "react";
import { useIsPreview } from './pro/PreviewContext';
import ProResponseLock from './pro/ProResponseLock';
import { C, F } from '../styles/token';

// ─── Analytics War Room ──────────────────────────────────────────────────────
// Light card on the same tokens as every other page. Brand blue carries the
// identity, status colours (success / warning / danger) carry meaning, and every
// icon is an SVG so it looks identical on every device.

const BRAND_GRADIENT = `linear-gradient(135deg, ${C.brand500} 0%, ${C.brand700} 100%)`;
const TITLE_GRADIENT = `linear-gradient(90deg, ${C.brand500}, ${C.accent500})`;

// Convert hex to rgba — used for per-card accent tints
const hexA = (hex, a) => {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return `rgba(26,110,255,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const GLYPHS = {
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  alert:  <><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" /><path d="M12 10v4.5" /><path d="M12 17.2v.1" /></>,
  spark:  <><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8L19 15Z" /></>,
  cal:    <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4M8.5 20h7" /></>,
  brain:  <><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 3 4 3 3 0 0 0 5 1V5a2 2 0 0 0-3-1Z" /><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-3 4 3 3 0 0 1-5 1" /></>,
  chat:   <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h-1A2.5 2.5 0 0 1 4 13.5v-8Z" />,
  flame:  <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.4 1 2 2 2-.6-3 .2-5.5 1-8Z" />,
  book:   <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></>,
  case:   <><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></>,
  dna:    <><path d="M7 3c0 6 10 6 10 12s-10 6-10 6" /><path d="M17 3c0 6-10 6-10 12s10 6 10 6" /><path d="M8.5 7h7M8.5 17h7" /></>,
  swords: <><path d="m14.5 5.5 5-2 -2 5-9 9-3-3 9-9Z" /><path d="m5 19-2 2M9.5 5.5l-5-2 2 5 9 9" /></>,
  bolt:   <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  refresh:<><path d="M4 12a8 8 0 0 1 14.5-4.7M20 12a8 8 0 0 1-14.5 4.7" /><path d="M18.5 4v4h-4M5.5 20v-4h4" /></>,
  check:  <path d="m5 12.5 4.5 4.5L19 7.5" />,
  lock:   <><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};
const Glyph = ({ name, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    {GLYPHS[name] || GLYPHS.spark}
  </svg>
);
Glyph.propTypes = { name: PropTypes.string, size: PropTypes.number };

// section heading → colour + icon (colours come from the app's own status tokens)
const BOARD_META = {
  "HONEST VERDICT":                   { color: C.brand500, icon: 'target' },
  "THE REAL PROBLEM":                 { color: C.danger,   icon: 'alert'  },
  "WHAT'S ACTUALLY WORKING":          { color: C.success,  icon: 'spark'  },
  "YOUR NEXT 30 DAYS":                { color: C.accent600,icon: 'cal'    },
  "INTERVIEW TALKING POINTS":         { color: C.violet,   icon: 'trophy' },
  "ONE THING MOST COACHES WON'T SAY": { color: C.warning,  icon: 'brain'  },
};
const DNA_META = {
  "RESPONSE STYLE":    { color: C.brand500, icon: 'chat'  },
  "PRESSURE RESPONSE": { color: C.caution,  icon: 'flame' },
  "KNOWLEDGE PATTERN": { color: C.teal,     icon: 'book'  },
  "GROWTH EDGE":       { color: C.warning,  icon: 'target'},
  "PROOF POINTS":      { color: C.success,  icon: 'case'  },
};

// ─── WarRoom Section ──────────────────────────────────────────────────────────
const WarRoomSection = ({
  dimensionProfile = [],
  scoreTrend = [],
  archetype = { label: "Consistent Climber", desc: "Steady improvement", fix: "Keep the streak" },
  totalSessions = 12,
  irs = 67,
  topTier = { label: "₹12–20 LPA", color: "#2563EB" },
  weakest = { label: "System Design", score: 38 },
  strongest = { label: "Communication", score: 84 },
  getAIFreeform,
}) => {
  const isPreview = useIsPreview();
  const [boardSections, setBoardSections] = useState([]);
  const [boardRaw,      setBoardRaw]      = useState("");
  const [, setBoardDone] = useState(false);
  const [dnaSections,   setDnaSections]   = useState([]);
  const [dnaDone,       setDnaDone]       = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [done,          setDone]          = useState(false);
  const [step,          setStep]          = useState(0);

  // Walk through the loading steps so the wait feels like progress, not a freeze.
  useEffect(() => {
    if (!loading) { setStep(0); return undefined; }
    const id = setInterval(() => setStep((s) => Math.min(s + 1, 4)), 420);
    return () => clearInterval(id);
  }, [loading]);

  // ── stat helpers ──────────────────────────────────────────────────────────
  const stdDev = (vals) => {
    if (vals.length < 2) return 0;
    const m = vals.reduce((a, v) => a + v, 0) / vals.length;
    return Math.sqrt(vals.reduce((a, v) => a + Math.pow(v - m, 2), 0) / (vals.length - 1));
  };
  const trendSlope = (vals) => {
    const n = vals.length;
    if (n < 2) return 0;
    const xm = (n - 1) / 2;
    const ym = vals.reduce((a, v) => a + v, 0) / n;
    const num = vals.reduce((a, v, i) => a + (i - xm) * (v - ym), 0);
    const den = vals.reduce((a, _, i) => a + Math.pow(i - xm, 2), 0);
    return den ? num / den : 0;
  };
  const sd    = stdDev((scoreTrend || []).map(s => s.score || 0));
  const slope = trendSlope((scoreTrend || []).slice(-6).map(s => s.score || 0));

  const boardAccents = Object.fromEntries(Object.entries(BOARD_META).map(([k, v]) => [k, v.color]));
  const dnaColors    = Object.fromEntries(Object.entries(DNA_META).map(([k, v]) => [k, v.color]));

  const parseSections = (text, accentMap) =>
    (text || '')
      .split(/\n(?=[A-Z][A-Z ']{3,}\n)/)
      .filter(Boolean)
      .map(section => {
        const lines   = section.trim().split('\n');
        const heading = lines[0].trim();
        const body    = lines.slice(1).join('\n').trim();
        return { heading, body, accent: accentMap[heading] || C.brand500 };
      })
      .filter(s => s.heading && s.body);

  // ── generate ──────────────────────────────────────────────────────────────
  const generateBoth = async () => {
    setLoading(true);
    setBoardDone(false); setDnaDone(false);
    setBoardSections([]); setDnaSections([]);
    setBoardRaw(''); setDone(false);

    const topicLines = (dimensionProfile || [])
      .filter(d => d.hasData)
      .sort((a, b) => a.score - b.score)
      .map(d => `  ${d.label}: ${d.score}/100 — ${Math.round((d.weight ?? 0.1) * 100)}% weight`)
      .join('\n');
    const recentTrend     = scoreTrend.slice(-5).map((s, i) => `S${scoreTrend.length - 4 + i}: ${s.score}`).join(' → ');
    const trendVerdict    = slope > 3 ? 'accelerating upward' : slope > 0.5 ? 'slowly improving' : slope > -0.5 ? 'flatlined' : 'declining';
    const varianceVerdict = sd > 18 ? 'dangerously inconsistent' : sd > 10 ? 'moderately inconsistent' : 'consistent';

    const boardPrompt = `You are coach, MockMate's senior placement coach. You have placed 200+ Indian CS students at companies from TCS to Google. Speak directly and honestly.

STUDENT DATA:
- Sessions: ${totalSessions} | IRS: ${irs}/100 | Package tier: ${topTier?.label}
- Best: ${strongest?.score}/100 in ${strongest?.label} | Weakest: ${weakest?.label} at ${weakest?.score}/100
- Trend: ${recentTrend} (${trendVerdict}) | Consistency: ${varianceVerdict} (std-dev: ${sd.toFixed(1)})
- Archetype: ${archetype?.label} — ${archetype?.desc}

DIMENSIONS:
${topicLines || '  No data yet'}

Write using EXACTLY these headings:

HONEST VERDICT
[2-3 sentences. Where they truly stand.]

THE REAL PROBLEM
[3-4 sentences. Root cause blocking IRS.]

WHAT'S ACTUALLY WORKING
[2-3 sentences. Genuine strength + how to show it in interviews.]

YOUR NEXT 30 DAYS
Week 1: [topic + mode + target]
Week 2: [topic + mode + target]
Week 3: [topic + mode + target]
Week 4: [full mock target before applying]

INTERVIEW TALKING POINTS
1. [ready-to-say line based on their strongest score]
2. [ready-to-say line about their trend/improvement]
3. [ready-to-say differentiator]

ONE THING MOST COACHES WON'T SAY
[2-3 sentences. The uncomfortable truth.]

No markdown. No asterisks. 420-480 words total.`;

    const dnaPrompt = `You are MockMate's behavioral analysis engine. ${totalSessions} real sessions analyzed.

DATA:
- Std-dev: ${sd.toFixed(1)} | Slope: ${slope.toFixed(2)} pts/session
- Archetype: ${archetype?.label} | IRS: ${irs}/100
- Strongest: ${strongest?.label} (${strongest?.score}/100) | Gap: ${weakest?.label} (${weakest?.score}/100)

Write EXACTLY these headings:

RESPONSE STYLE
[One precise sentence about communication pattern.]

PRESSURE RESPONSE
[One precise sentence about variance data and pressure performance.]

KNOWLEDGE PATTERN
[One precise sentence about specialist vs generalist positioning.]

PROOF POINTS
1. [data-backed "why hire me" statement using strongest score + sessions]
2. [trend-based growth mindset statement]

GROWTH EDGE
[One precise sentence: the single behavioral change for fastest IRS gain.]

Under 200 words. Reference real numbers in every observation.`;

    try {
      // Example answers built from the data on screen. Used as the offline fallback, and as the
      // ONLY source inside the Pro demo, where no server call is ever made.
      const demoFn = async (p) => {
        return p.includes('HONEST VERDICT')
          ? `HONEST VERDICT
At IRS ${irs}/100 you're in the ${topTier?.label} band but sitting right at the floor, not the ceiling. That means you'll get shortlisted, but you'll lose to candidates with one more strong dimension.

THE REAL PROBLEM
${weakest?.label} at ${weakest?.score}/100 is dragging your composite down by roughly 8 IRS points. Every company above service-tier now asks at least one ${weakest?.label} question — skipping it in practice means failing it in the room.

WHAT'S ACTUALLY WORKING
${strongest?.label} at ${strongest?.score}/100 is legitimately strong — top quartile for your tier. In interviews, open with structure: "Let me walk you through my approach before diving in." That single habit signals ${strongest?.label} competence in the first 30 seconds.

YOUR NEXT 30 DAYS
Week 1: ${weakest?.label} basics — concept recall, no code pressure, target 50+
Week 2: ${weakest?.label} + problem solving combined sessions — target 60+
Week 3: Full mock with ${weakest?.label} questions weighted — target 70+
Week 4: Clean full mock — do not apply until you hit 72+ consistently

INTERVIEW TALKING POINTS
1. "I've completed ${totalSessions} structured mock sessions with immediate AI scoring — I know exactly where my gaps are and I've been closing them systematically."
2. "My ${strongest?.label} score is ${strongest?.score}/100 across my sessions — I actively practice thinking aloud before answering."
3. "I track my performance trend, not just my last session — I'm trending ${slope >= 0 ? 'upward' : 'toward stability'} over my last 6 sessions."

ONE THING MOST COACHES WON'T SAY
At IRS ${irs} with ${totalSessions} sessions, your biggest risk isn't knowledge — it's overconfidence in your strong dimension and avoidance of your weak one. If nothing changes in ${weakest?.label}, the pattern predicts you'll clear screening rounds and stall in technical depth rounds every single time.`
          : `RESPONSE STYLE
Your answers show high structural clarity in ${strongest?.label} but the communication pattern shifts to reactive mode when the topic enters ${weakest?.label} territory — interviewers will notice the gear change.

PRESSURE RESPONSE
A std-dev of ${sd.toFixed(1)} signals ${sd > 15 ? 'meaningful performance variance under pressure — your bad sessions pull the average down more than your good ones lift it' : 'stable performance across conditions — a genuine competitive advantage in live interviews'}.

KNOWLEDGE PATTERN
You're a ${strongest?.score > 75 ? 'specialist building toward generalist' : 'developing generalist'} — your ${strongest?.label} depth is deployable now, but the ${weakest?.label} gap makes you look unprepared to interviewers who probe breadth.

PROOF POINTS
1. "I have ${totalSessions} scored mock sessions logged with a ${strongest?.label} score of ${strongest?.score}/100 — that's not preparation, that's demonstrated performance."
2. "My IRS has ${slope >= 0 ? `improved ${slope.toFixed(1)} points per session` : 'remained consistent'} over my last 6 sessions — I course-correct fast."

GROWTH EDGE
Closing the ${weakest?.label} gap from ${weakest?.score} to 60+ would move your IRS by an estimated 6-9 points — more than any other single action available to you right now.`;
      };
      if (isPreview) await new Promise((resolve) => setTimeout(resolve, 1700));
      const fn = isPreview ? demoFn : (getAIFreeform || demoFn);

      const [boardResult, dnaResult] = await Promise.allSettled([
        fn(boardPrompt, 1000),
        totalSessions >= 10 ? fn(dnaPrompt, 600) : Promise.resolve(''),
      ]);

      const boardText = boardResult.status === 'fulfilled' ? boardResult.value : 'Unable to generate analysis.';
      const dnaText   = dnaResult.status === 'fulfilled' ? dnaResult.value : '';

      setBoardRaw(boardText);
      setBoardSections(parseSections(boardText, boardAccents));
      setBoardDone(true);
      setDnaSections(parseSections(dnaText, dnaColors));
      setDnaDone(true);
    } catch {
      setBoardRaw('Could not reach AI. Check your connection and try again.');
      setBoardDone(true);
    } finally {
      setLoading(false);
      setDone(true);
    }
  };

  // ── UI data ───────────────────────────────────────────────────────────────
  const irsColor = irs >= 75 ? C.success : irs >= 55 ? C.brand500 : C.warning;
  const varLabel = sd > 18 ? 'High' : sd > 10 ? 'Medium' : 'Low';
  const varColor = sd > 18 ? C.danger : sd > 10 ? C.warning : C.success;
  const dnaReady = totalSessions >= 10;

  const statsStrip = [
    { label: 'IRS',       val: `${irs}`, unit: '/100', color: irsColor },
    { label: 'Variance',  val: varLabel, unit: '',     color: varColor },
    { label: 'Archetype', val: archetype?.label || '—', unit: '', color: C.violet, wide: true },
  ];

  const previewCards = [
    { icon: 'target', label: 'Honest verdict', desc: 'Where you truly stand',  color: C.brand500 },
    { icon: 'alert',  label: 'Real problem',   desc: 'Root cause identified',  color: C.danger },
    { icon: 'cal',    label: '30-day plan',    desc: 'Week-by-week targets',   color: C.accent600 },
    { icon: 'dna',    label: 'Interview DNA',  desc: dnaReady ? 'Behavioral fingerprint' : `Unlocks at 10 sessions`, color: C.success, progress: dnaReady ? null : Math.min(100, (totalSessions / 10) * 100) },
  ];

  const loadingSteps = [
    `Scanning IRS ${irs}/100 across 6 dimensions`,
    `Computing score variance (std-dev ${sd.toFixed(1)})`,
    `Mapping ${strongest?.label || '—'} strength vs ${weakest?.label || '—'} gap`,
    'Drafting your 30-day plan',
    'Writing behavioral fingerprint',
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes wr-spin    { to { transform: rotate(360deg); } }
        @keyframes wr-pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.7)} }
        @keyframes wr-fade-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes wr-drift   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-3%,3%)} }
        @keyframes wr-pop     { from{transform:scale(.6);opacity:0} to{transform:scale(1);opacity:1} }

        .wr-section { position:relative; margin-bottom:18px; border-radius:24px; overflow:hidden; background:${C.surface};
          border:1px solid ${C.border}; box-shadow:0 14px 44px rgba(15,35,95,.09); font-family:${F.body}; }

        .wr-head { position:relative; overflow:hidden; padding:26px 28px 22px; background:linear-gradient(180deg, ${C.brand50} 0%, #fff 100%); border-bottom:1px solid ${C.border}; }
        .wr-head::before { content:''; position:absolute; inset:-40%; pointer-events:none; animation:wr-drift 16s ease-in-out infinite;
          background:radial-gradient(circle at 15% 25%, rgba(26,110,255,.14), transparent 42%), radial-gradient(circle at 88% 10%, rgba(0,200,240,.13), transparent 40%); }
        .wr-head-grid { position:relative; z-index:1; display:grid; grid-template-columns:1fr auto; gap:22px; align-items:start; }
        .wr-eyebrow { display:inline-flex; align-items:center; gap:8px; margin-bottom:10px; font-family:${F.mono}; font-size:10.5px; font-weight:800; letter-spacing:.14em; color:${C.brand600}; }
        .wr-dot { width:7px; height:7px; border-radius:50%; background:${C.brand500}; box-shadow:0 0 0 4px rgba(26,110,255,.14); animation:wr-pulse 2s ease-in-out infinite; }
        .wr-title { margin:0 0 8px; font-family:${F.display}; font-size:clamp(20px,3.2vw,27px); font-weight:800; letter-spacing:-.03em; line-height:1.18; color:${C.text}; }
        .wr-title span { background:${TITLE_GRADIENT}; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
        .wr-sub { margin:0; font-size:13.5px; line-height:1.65; color:${C.textSub}; max-width:560px; }
        .wr-note { display:inline-flex; align-items:center; gap:7px; margin-top:12px; padding:6px 11px; border-radius:10px; font-size:12px; font-weight:600; color:${C.warning}; background:${C.warningTint}; border:1px solid rgba(217,119,6,.22); }

        .wr-side { display:flex; flex-direction:column; gap:10px; min-width:300px; }
        .wr-stats { display:grid; grid-template-columns:auto auto 1fr; gap:8px; }
        .wr-stat { padding:9px 14px; border-radius:13px; background:#fff; border:1px solid ${C.border}; min-width:0; transition:border-color .16s, box-shadow .16s, transform .16s; }
        .wr-stat:hover { border-color:${C.brand200}; box-shadow:0 6px 18px rgba(26,110,255,.12); transform:translateY(-1px); }
        .wr-stat-l { font-family:${F.mono}; font-size:9.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:${C.textMuted}; margin-bottom:4px; }
        .wr-stat-v { font-family:${F.display}; font-size:17px; font-weight:900; letter-spacing:-.02em; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .wr-stat-v small { font-size:11px; font-weight:700; color:${C.textMuted}; }

        .wr-btn { display:inline-flex; align-items:center; justify-content:center; gap:9px; min-height:48px; padding:0 22px; border:none; border-radius:14px; cursor:pointer;
          background:${BRAND_GRADIENT}; color:#fff; font-family:${F.display}; font-size:14px; font-weight:800; white-space:nowrap;
          box-shadow:0 8px 22px rgba(26,110,255,.32); transition:transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s, filter .18s; }
        .wr-btn:hover:not(:disabled) { transform:translateY(-2px); filter:brightness(1.05); box-shadow:0 12px 28px rgba(26,110,255,.4); }
        .wr-btn:active:not(:disabled) { transform:scale(.985); }
        .wr-btn:disabled { background:${C.brand200}; box-shadow:none; cursor:wait; }
        .wr-btn:focus-visible, .wr-regen:focus-visible { outline:2.5px solid ${C.brand500}; outline-offset:3px; }
        .wr-spinner { width:15px; height:15px; border-radius:50%; border:2.5px solid rgba(255,255,255,.35); border-top-color:#fff; animation:wr-spin .7s linear infinite; }

        .wr-body { padding:22px 28px 24px; }

        .wr-intro { margin:0 auto 20px; max-width:520px; text-align:center; font-size:13.5px; line-height:1.7; color:${C.textSub}; }
        .wr-intro b { color:${C.text}; }
        .wr-preview { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .wr-tile { padding:16px 14px; border-radius:18px; background:#fff; border:1px solid ${C.border}; text-align:left; transition:transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s, border-color .22s; }
        .wr-tile:hover { transform:translateY(-4px); box-shadow:0 14px 32px rgba(15,35,95,.12); }
        .wr-tile-ic { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
        .wr-tile-l { font-family:${F.display}; font-size:13.5px; font-weight:800; color:${C.text}; letter-spacing:-.01em; margin-bottom:3px; }
        .wr-tile-d { font-size:12px; line-height:1.45; color:${C.textMuted}; }
        .wr-bar { height:5px; border-radius:99px; background:${C.border}; overflow:hidden; margin-top:9px; }
        .wr-bar > i { display:block; height:100%; border-radius:99px; background:linear-gradient(90deg, ${C.success}, ${C.teal}); transition:width .8s cubic-bezier(.22,1,.36,1); }
        .wr-foot-note { margin-top:16px; text-align:center; font-size:11.5px; color:${C.textFaint}; }

        .wr-steps { display:flex; flex-direction:column; gap:8px; max-width:560px; margin:0 auto; }
        .wr-step { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:13px; background:${C.surfaceAlt}; border:1px solid ${C.border}; font-size:13px; color:${C.textMuted}; transition:all .25s ease; }
        .wr-step[data-s="active"] { background:${C.brand50}; border-color:${C.brand100}; color:${C.text}; font-weight:600; }
        .wr-step[data-s="done"] { color:${C.textSub}; }
        .wr-step-ic { width:22px; height:22px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:${C.border}; color:#fff; }
        .wr-step[data-s="done"] .wr-step-ic { background:${C.success}; animation:wr-pop .25s ease; }
        .wr-step[data-s="active"] .wr-step-ic { background:transparent; }
        .wr-step-spin { width:16px; height:16px; border-radius:50%; border:2.5px solid ${C.brand100}; border-top-color:${C.brand500}; animation:wr-spin .7s linear infinite; }

        .wr-two-col { display:grid; gap:18px; }
        .wr-col-head { display:flex; align-items:center; gap:12px; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid ${C.border}; }
        .wr-col-ic { width:40px; height:40px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#fff; }
        .wr-col-k { font-family:${F.mono}; font-size:10px; font-weight:800; letter-spacing:.12em; color:${C.textMuted}; margin-bottom:2px; }
        .wr-col-t { font-family:${F.display}; font-size:15px; font-weight:800; color:${C.text}; letter-spacing:-.02em; line-height:1.25; }
        .wr-list { display:flex; flex-direction:column; gap:10px; }
        .wr-card { padding:14px 16px; border-radius:16px; background:#fff; border:1px solid ${C.border}; animation:wr-fade-up .38s cubic-bezier(.22,1,.36,1) both; transition:transform .18s, box-shadow .18s; }
        .wr-card:hover { transform:translateY(-2px); box-shadow:0 10px 26px rgba(15,35,95,.10); }
        .wr-card-h { display:flex; align-items:center; gap:10px; margin-bottom:9px; }
        .wr-card-ic { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .wr-card-k { font-family:${F.mono}; font-size:10.5px; font-weight:800; letter-spacing:.08em; }
        .wr-card-p { margin:0; font-size:13.5px; line-height:1.75; color:${C.textSub}; white-space:pre-line; }
        .wr-dna { padding:14px; border-radius:20px; background:${C.successTint}; border:1px solid rgba(5,150,105,.16); }
        .wr-dna .wr-col-head { border-bottom-color:rgba(5,150,105,.2); }

        .wr-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-top:18px; padding-top:14px; border-top:1px solid ${C.border}; }
        .wr-footer p { margin:0; font-size:12px; color:${C.textMuted}; }
        .wr-regen { display:inline-flex; align-items:center; gap:7px; min-height:38px; padding:0 14px; border-radius:11px; cursor:pointer; background:${C.brand50}; border:1px solid ${C.brand100};
          color:${C.brand600}; font-family:${F.body}; font-size:12.5px; font-weight:700; transition:background .16s; }
        .wr-regen:hover:not(:disabled) { background:${C.brand100}; }
        .wr-regen:disabled { opacity:.6; cursor:wait; }

        @media (max-width:900px) {
          .wr-head-grid { grid-template-columns:1fr; gap:16px; }
          .wr-side { min-width:0; }
          .wr-preview { grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width:768px) { .wr-two-col { grid-template-columns:1fr !important; } }
        @media (max-width:560px) {
          .wr-section { border-radius:20px; }
          .wr-head { padding:18px 16px 16px; }
          .wr-body { padding:16px 14px 18px; }
          .wr-stats { grid-template-columns:1fr 1fr; }
          .wr-stat { padding:9px 12px; }
          .wr-stat-wide { grid-column:1 / -1; }
          .wr-btn { width:100%; min-height:50px; }
          .wr-sub { font-size:13px; }
          .wr-tile { padding:13px 12px; }
          .wr-tile-ic { width:36px; height:36px; margin-bottom:10px; }
          .wr-card { padding:13px 13px; }
          .wr-regen { width:100%; justify-content:center; }
        }
        @media (max-width:340px) { .wr-preview { grid-template-columns:1fr; } }
        @media (prefers-reduced-motion:reduce) { .wr-section *, .wr-section *::before { animation:none !important; transition:none !important; } }
      `}</style>

      <section className="wr-section" aria-label="Analytics War Room">
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="wr-head">
          <div className="wr-head-grid">
            <div style={{ minWidth: 0 }}>
              <div className="wr-eyebrow"><span className="wr-dot" />ANALYTICS WAR ROOM</div>
              <h2 className="wr-title">Placement Coach <span>+ Behavioral DNA</span></h2>
              <p className="wr-sub">Two AI analyses computed in parallel from your {totalSessions} real sessions.</p>
              {!dnaReady && (
                <div className="wr-note"><Glyph name="dna" size={14} />Interview DNA unlocks at 10 sessions. You have {totalSessions}.</div>
              )}
            </div>

            <div className="wr-side">
              <div className="wr-stats">
                {statsStrip.map((s) => (
                  <div key={s.label} className={`wr-stat${s.wide ? ' wr-stat-wide' : ''}`}>
                    <div className="wr-stat-l">{s.label}</div>
                    <div className="wr-stat-v" style={{ color: s.color }} title={s.val}>{s.val}{s.unit && <small>{s.unit}</small>}</div>
                  </div>
                ))}
              </div>
              <button type="button" className="wr-btn" onClick={generateBoth} disabled={loading}>
                {loading ? (<><span className="wr-spinner" />Analyzing…</>) : done ? (<><Glyph name="refresh" size={16} />Regenerate profile</>) : (<><Glyph name="bolt" size={16} />Generate War Room profile</>)}
              </button>
            </div>
          </div>
        </div>

        <div className="wr-body">
          {/* ── PRE-GENERATE ─────────────────────────────────────────────── */}
          {!done && !loading && (
            <>
              <p className="wr-intro">Press <b>Generate War Room profile</b> to get your placement coach's action plan and behavioral fingerprint, both computed from your real session data.</p>
              <div className="wr-preview">
                {previewCards.map((item) => (
                  <div key={item.label} className="wr-tile" style={{ borderColor: hexA(item.color, 0.22) }}>
                    <div className="wr-tile-ic" style={{ background: hexA(item.color, 0.12), color: item.color }}><Glyph name={item.icon} size={20} /></div>
                    <div className="wr-tile-l">{item.label}</div>
                    <div className="wr-tile-d">{item.desc}</div>
                    {item.progress != null && (
                      <div className="wr-bar" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={totalSessions} aria-label="Sessions toward Interview DNA"><i style={{ width: `${item.progress}%` }} /></div>
                    )}
                  </div>
                ))}
              </div>
              <div className="wr-foot-note">About 10 seconds · uses your real session data · nothing leaves MockMate</div>
            </>
          )}

          {/* ── LOADING ──────────────────────────────────────────────────── */}
          {loading && (
            <div className="wr-steps" role="status" aria-live="polite">
              {loadingSteps.map((msg, i) => {
                const st = i < step ? 'done' : i === step ? 'active' : 'todo';
                return (
                  <div key={i} className="wr-step" data-s={st}>
                    <span className="wr-step-ic">{st === 'done' ? <Glyph name="check" size={13} /> : st === 'active' ? <span className="wr-step-spin" /> : null}</span>
                    <span>{msg}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── RESULTS ──────────────────────────────────────────────────── */}
          {done && (
            <ProResponseLock feature="fullAnalytics" cta="Unlock my War Room" clearHeight={214}>
              <div className="wr-two-col" style={{ gridTemplateColumns: dnaReady ? '1fr 1fr' : '1fr' }}>
                <div>
                  <div className="wr-col-head">
                    <div className="wr-col-ic" style={{ background: BRAND_GRADIENT, boxShadow: '0 6px 16px rgba(26,110,255,.28)' }}><Glyph name="swords" size={19} /></div>
                    <div>
                      <div className="wr-col-k">PLACEMENT COACH</div>
                      <div className="wr-col-t">Action plan + interview talking points</div>
                    </div>
                  </div>
                  {boardSections.length > 0 ? (
                    <div className="wr-list">
                      {boardSections.map((s, i) => {
                        const meta = BOARD_META[s.heading] || { color: C.brand500, icon: 'spark' };
                        return (
                          <div key={i} className="wr-card" style={{ animationDelay: `${i * 60}ms`, borderLeft: `4px solid ${meta.color}` }}>
                            <div className="wr-card-h">
                              <span className="wr-card-ic" style={{ background: hexA(meta.color, 0.12), color: meta.color }}><Glyph name={meta.icon} size={16} /></span>
                              <span className="wr-card-k" style={{ color: meta.color }}>{s.heading}</span>
                            </div>
                            <p className="wr-card-p">{s.body}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="wr-card-p">{boardRaw}</p>
                  )}
                </div>

                {dnaReady && (
                  <div className="wr-dna">
                    <div className="wr-col-head">
                      <div className="wr-col-ic" style={{ background: `linear-gradient(135deg, ${C.success}, ${C.teal})`, boxShadow: '0 6px 16px rgba(5,150,105,.28)' }}><Glyph name="dna" size={19} /></div>
                      <div>
                        <div className="wr-col-k">INTERVIEW DNA</div>
                        <div className="wr-col-t">Behavioral fingerprint · {totalSessions} sessions</div>
                      </div>
                    </div>
                    {dnaSections.length > 0 ? (
                      <div className="wr-list">
                        {dnaSections.map((s, i) => {
                          const meta = DNA_META[s.heading] || { color: C.success, icon: 'dna' };
                          return (
                            <div key={i} className="wr-card" style={{ animationDelay: `${i * 60}ms`, borderLeft: `4px solid ${meta.color}` }}>
                              <div className="wr-card-h">
                                <span className="wr-card-ic" style={{ background: hexA(meta.color, 0.12), color: meta.color }}><Glyph name={meta.icon} size={16} /></span>
                                <span className="wr-card-k" style={{ color: meta.color }}>{s.heading}</span>
                              </div>
                              <p className="wr-card-p">{s.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : dnaDone ? (
                      <p className="wr-card-p">Unable to generate Interview DNA.</p>
                    ) : (
                      <div className="wr-steps">
                        {['Reading session variance', 'Mapping response style', 'Analyzing pressure signals', 'Writing fingerprint'].map((m, i) => (
                          <div key={i} className="wr-step" data-s="active"><span className="wr-step-ic"><span className="wr-step-spin" /></span><span>{m}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ProResponseLock>
          )}

          {/* ── FOOTER ───────────────────────────────────────────────────── */}
          {done && (
            <div className="wr-footer">
              <p>Both analyses regenerate fresh each time · DNA unlocks at 10 sessions</p>
              <button type="button" className="wr-regen" onClick={generateBoth} disabled={loading}><Glyph name="refresh" size={14} />Regenerate both</button>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

WarRoomSection.propTypes = {
  dimensionProfile: PropTypes.array,
  scoreTrend:       PropTypes.array,
  archetype:        PropTypes.shape({ label: PropTypes.string, desc: PropTypes.string, icon: PropTypes.string, fix: PropTypes.string }),
  totalSessions:    PropTypes.number,
  irs:              PropTypes.number,
  topTier:          PropTypes.shape({ label: PropTypes.string, color: PropTypes.string }),
  weakest:          PropTypes.shape({ label: PropTypes.string, score: PropTypes.number }),
  strongest:        PropTypes.shape({ label: PropTypes.string, score: PropTypes.number }),
  getAIFreeform:    PropTypes.func,
};

export default WarRoomSection;
