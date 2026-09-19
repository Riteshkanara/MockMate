import PropTypes from 'prop-types';
import { useState } from "react";

// ─── Design tokens matching MockMate's exact blue palette from the screenshot ───
// Deep cobalt: #0F2D6B, Royal blue: #1A4FBF, Vivid blue: #2563EB, Electric: #0EA5E9, Cyan pop: #00C6FF
const W = {
  deepNavy:    '#0A1F4E',
  cobalt:      '#0F2D6B',
  royalBlue:   '#1A4FBF',
  vivid:       '#2563EB',
  electric:    '#0EA5E9',
  cyan:        '#00C6FF',
  cyanLight:   '#7ADCFF',
  glassBg:     'rgba(15, 45, 107, 0.55)',
  glassEdge:   'rgba(0, 198, 255, 0.28)',
  glassEdgeMd: 'rgba(0, 198, 255, 0.48)',
  shimmer:     'rgba(255,255,255,0.06)',
  shimmerMd:   'rgba(255,255,255,0.10)',
  shimmerHi:   'rgba(255,255,255,0.16)',
  textPrimary: '#FFFFFF',
  textSub:     'rgba(199,225,255,0.85)',
  textMuted:   'rgba(160,200,255,0.62)',
  textFaint:   'rgba(130,175,230,0.45)',
  accent:      '#00C6FF',
  accentGlow:  'rgba(0,198,255,0.35)',
  green:       '#10B981',
  amber:       '#F59E0B',
  red:         '#EF4444',
  redGlow:     'rgba(239,68,68,0.28)',
  greenGlow:   'rgba(16,185,129,0.28)',
};

// Exact gradient matching the MockMate hero in the screenshot
const heroGradient = `linear-gradient(135deg, #0A1F4E 0%, #0F2D6B 22%, #1A4FBF 52%, #2563EB 76%, #0EA5E9 100%)`;
const cardGradient = `linear-gradient(145deg, rgba(15,45,107,0.72) 0%, rgba(26,79,191,0.48) 100%)`;
const accentGradient = `linear-gradient(135deg, #00C6FF 0%, #0EA5E9 50%, #2563EB 100%)`;

const F = {
  display: "'Inter', 'SF Pro Display', system-ui, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
  body:    "'Inter', system-ui, sans-serif",
};

// ─── WarRoom Section (standalone, drop-in replacement) ───
const WarRoomSection = ({
  dimensionProfile = [],
  scoreTrend = [],
  archetype = { label: "Consistent Climber", desc: "Steady improvement", icon: "📈", fix: "Keep the streak" },
  totalSessions = 12,
  irs = 67,
  topTier = { label: "₹12–20 LPA", color: "#2563EB" },
  weakest = { label: "System Design", score: 38 },
  strongest = { label: "Communication", score: 84 },
  getAIFreeform,
}) => {
  const [boardSections, setBoardSections] = useState([]);
  const [boardRaw, setBoardRaw] = useState("");
  const [boardDone, setBoardDone] = useState(false);
  const [dnaSections, setDnaSections] = useState([]);
  const [dnaDone, setDnaDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // stat helpers
  const stdDev = (vals) => {
    if (vals.length < 2) return 0;
    const m = vals.reduce((a, v) => a + v, 0) / vals.length;
    return Math.sqrt(vals.reduce((a, v) => a + Math.pow(v - m, 2), 0) / (vals.length - 1));
  };
  const trendSlope = (vals) => {
    const n = vals.length;
    if (n < 2) return 0;
    const xm = (n - 1) / 2, ym = vals.reduce((a, v) => a + v, 0) / n;
    const num = vals.reduce((a, v, i) => a + (i - xm) * (v - ym), 0);
    const den = vals.reduce((a, _, i) => a + Math.pow(i - xm, 2), 0);
    return den ? num / den : 0;
  };
  const sd = stdDev((scoreTrend || []).map(s => s.score || 0));
  const slope = trendSlope((scoreTrend || []).slice(-6).map(s => s.score || 0));

  const boardAccents = {
    "HONEST VERDICT": W.cyanLight, "THE REAL PROBLEM": W.red,
    "WHAT'S ACTUALLY WORKING": W.green, "YOUR NEXT 30 DAYS": W.cyan,
    "INTERVIEW TALKING POINTS": W.green, "ONE THING MOST COACHES WON'T SAY": W.amber,
  };
  const boardIcons = {
    "HONEST VERDICT": "🎯", "THE REAL PROBLEM": "🚨",
    "WHAT'S ACTUALLY WORKING": "✨", "YOUR NEXT 30 DAYS": "📅",
    "INTERVIEW TALKING POINTS": "🏆", "ONE THING MOST COACHES WON'T SAY": "🧠",
  };
  const dnaColors = {
    "RESPONSE STYLE": W.cyan, "PRESSURE RESPONSE": W.electric,
    "KNOWLEDGE PATTERN": W.green, "GROWTH EDGE": W.amber, "PROOF POINTS": W.green,
  };
  const dnaIcons = {
    "RESPONSE STYLE": "💬", "PRESSURE RESPONSE": "🔥",
    "KNOWLEDGE PATTERN": "📚", "GROWTH EDGE": "🎯", "PROOF POINTS": "💼",
  };

  const parseSections = (text, accentMap) =>
    (text || '').split(/\n(?=[A-Z][A-Z ']{3,}\n)/).filter(Boolean)
      .map(section => {
        const lines = section.trim().split("\n");
        const heading = lines[0].trim();
        const body = lines.slice(1).join("\n").trim();
        return { heading, body, accent: accentMap[heading] || W.cyan };
      }).filter(s => s.heading && s.body);

  const generateBoth = async () => {
    setLoading(true); setBoardDone(false); setDnaDone(false);
    setBoardSections([]); setDnaSections([]); setBoardRaw(""); setDone(false);

    const topicLines = (dimensionProfile || []).filter(d => d.hasData).sort((a, b) => a.score - b.score)
      .map(d => `  ${d.label}: ${d.score}/100 — ${Math.round((d.weight ?? 0.1) * 100)}% weight`).join("\n");
    const recentTrend = scoreTrend.slice(-5).map((s, i) => `S${scoreTrend.length - 4 + i}: ${s.score}`).join(" → ");
    const trendVerdict = slope > 3 ? "accelerating upward" : slope > 0.5 ? "slowly improving" : slope > -0.5 ? "flatlined" : "declining";
    const varianceVerdict = sd > 18 ? "dangerously inconsistent" : sd > 10 ? "moderately inconsistent" : "consistent";

    const boardPrompt = `You are coach, MockMate's senior placement coach. You have placed 200+ Indian CS students at companies from TCS to Google. Speak directly and honestly.

STUDENT DATA:
- Sessions: ${totalSessions} | IRS: ${irs}/100 | Package tier: ${topTier?.label}
- Best: ${strongest?.score}/100 in ${strongest?.label} | Weakest: ${weakest?.label} at ${weakest?.score}/100
- Trend: ${recentTrend} (${trendVerdict}) | Consistency: ${varianceVerdict} (std-dev: ${sd.toFixed(1)})
- Archetype: ${archetype?.label} — ${archetype?.desc}

DIMENSIONS:
${topicLines || "  No data yet"}

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
      const fn = getAIFreeform || (async (p) => {
        // demo fallback
        return p.includes("HONEST VERDICT") ?
`HONEST VERDICT
At IRS ${irs}/100 you're in the ₹${topTier?.label} band but sitting right at the floor, not the ceiling. That means you'll get shortlisted, but you'll lose to candidates with one more strong dimension.

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
At IRS ${irs} with ${totalSessions} sessions, your biggest risk isn't knowledge — it's overconfidence in your strong dimension and avoidance of your weak one. If nothing changes in ${weakest?.label}, the pattern predicts you'll clear screening rounds and stall in technical depth rounds every single time.` :
`RESPONSE STYLE
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
      });

      const [boardResult, dnaResult] = await Promise.allSettled([
        fn(boardPrompt, 1000),
        totalSessions >= 10 ? fn(dnaPrompt, 600) : Promise.resolve(""),
      ]);

      const boardText = boardResult.status === "fulfilled" ? boardResult.value : "Unable to generate analysis.";
      const dnaText = dnaResult.status === "fulfilled" ? dnaResult.value : "";

      setBoardRaw(boardText);
      setBoardSections(parseSections(boardText, boardAccents));
      setBoardDone(true);
      setDnaSections(parseSections(dnaText, dnaColors));
      setDnaDone(true);
    } catch {
      setBoardRaw("Could not reach AI. Check your connection and try again.");
      setBoardDone(true);
    } finally {
      setLoading(false);
      setDone(true);
    }
  };

  const statsStrip = [
    { label: "IRS", val: `${irs}`, unit: "/100", color: irs >= 75 ? W.green : irs >= 55 ? W.cyan : W.amber },
    { label: "VARIANCE", val: sd > 18 ? "HIGH" : sd > 10 ? "MED" : "LOW", color: sd > 18 ? W.red : sd > 10 ? W.amber : W.green },
    { label: "ARCHETYPE", val: archetype?.icon || "📈", color: W.cyanLight },
  ];

  const previewCards = [
    { icon: "🎯", label: "HONEST VERDICT", desc: "Where you truly stand", color: W.cyanLight, bg: 'rgba(0,198,255,0.08)' },
    { icon: "🚨", label: "REAL PROBLEM", desc: "Root cause identified", color: W.red, bg: 'rgba(239,68,68,0.08)' },
    { icon: "📅", label: "30-DAY BATTLE PLAN", desc: "Week-by-week targets", color: W.cyan, bg: 'rgba(14,165,233,0.08)' },
    { icon: "🧬", label: "INTERVIEW DNA", desc: `Unlocks at 10 sessions`, color: W.green, bg: 'rgba(16,185,129,0.08)' },
  ];

  const loadingSteps = [
    `Scanning IRS = ${irs}/100 across 6 dimensions…`,
    `Computing score variance — std-dev ${sd.toFixed(1)}…`,
    `Mapping ${strongest?.label || "—"} strength vs ${weakest?.label || "—"} gap…`,
    "Drafting your 30-day battle plan…",
    "Writing behavioral fingerprint…",
  ];

  return (
    <>
      <style>{`
        @keyframes wr-spin { to { transform: rotate(360deg); } }
        @keyframes wr-pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.7)} }
        @keyframes wr-shimmer {
          0%{background-position:-400px 0}
          100%{background-position:400px 0}
        }
        @keyframes wr-fade-up {
          from{opacity:0;transform:translateY(16px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes wr-scan {
          0%{transform:translateY(-100%);opacity:0}
          10%{opacity:1}
          90%{opacity:1}
          100%{transform:translateY(400%);opacity:0}
        }
        @keyframes wr-glow-pulse {
          0%,100%{opacity:0.5}
          50%{opacity:1}
        }

        .wr-section { font-family: ${F.body}; }

        .wr-card-glass {
          background: ${cardGradient};
          border: 1px solid ${W.glassEdge};
          border-radius: 16px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transition: border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s cubic-bezier(.22,1,.36,1);
        }
        .wr-card-glass:hover {
          border-color: ${W.glassEdgeMd};
          box-shadow: 0 12px 36px rgba(0,198,255,0.15);
        }

        .wr-result-card {
          padding: 16px 18px;
          border-radius: 14px;
          background: rgba(10,31,78,0.55);
          border: 1px solid ${W.glassEdge};
          backdrop-filter: blur(16px);
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          animation: wr-fade-up 0.35s cubic-bezier(.22,1,.36,1) both;
        }
        .wr-result-card:hover {
          transform: translateY(-2px);
          border-color: ${W.glassEdgeMd};
          box-shadow: 0 10px 28px rgba(0,198,255,0.12);
        }

        .wr-generate-btn {
          border: none;
          border-radius: 14px;
          background: ${accentGradient};
          color: #fff;
          font-weight: 800;
          font-family: ${F.body};
          cursor: pointer;
          letter-spacing: -0.02em;
          box-shadow: 0 8px 28px rgba(0,198,255,0.32), inset 0 1px 0 rgba(255,255,255,0.22);
          transition: transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease, filter 0.22s ease;
        }
        .wr-generate-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          filter: brightness(1.06) saturate(1.08);
          box-shadow: 0 14px 36px rgba(0,198,255,0.42), inset 0 1px 0 rgba(255,255,255,0.26);
        }
        .wr-generate-btn:active:not(:disabled) {
          transform: translateY(-1px) scale(0.98);
        }
        .wr-generate-btn:disabled {
          background: rgba(26,79,191,0.5);
          box-shadow: none;
          cursor: not-allowed;
          color: rgba(255,255,255,0.5);
        }

        .wr-preview-card {
          border-radius: 14px;
          padding: 16px 14px;
          text-align: center;
          border: 1px solid ${W.glassEdge};
          backdrop-filter: blur(16px);
          transition: transform 0.26s cubic-bezier(.22,1,.36,1), border-color 0.26s ease, box-shadow 0.26s ease;
        }
        .wr-preview-card:hover {
          transform: translateY(-5px);
          border-color: ${W.glassEdgeMd};
          box-shadow: 0 16px 40px rgba(0,198,255,0.18);
        }

        .wr-stat-chip {
          border-radius: 10px;
          padding: 8px 14px;
          border: 1px solid ${W.glassEdge};
          background: rgba(15,45,107,0.6);
          backdrop-filter: blur(20px);
          text-align: center;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .wr-stat-chip:hover {
          border-color: ${W.glassEdgeMd};
          box-shadow: 0 6px 20px rgba(0,198,255,0.15);
        }

        .wr-loading-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 16px;
          border-radius: 10px;
          background: rgba(15,45,107,0.5);
          border: 1px solid ${W.glassEdge};
        }

        .wr-section-divider {
          border: none;
          height: 1px;
          background: linear-gradient(90deg, transparent, ${W.glassEdge}, transparent);
          margin: 0;
        }

        .wr-col-label {
          font-family: ${F.mono};
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.4px;
          color: ${W.textMuted};
          margin-bottom: 4px;
        }
        .wr-col-title {
          font-family: ${F.display};
          font-size: 15px;
          font-weight: 800;
          color: ${W.textPrimary};
          letter-spacing: -0.025em;
          line-height: 1.25;
        }

        @media (prefers-reduced-motion: reduce) {
          .wr-section * { animation: none !important; transition: none !important; }
        }
        @media (max-width: 640px) {
          .wr-two-col { grid-template-columns: 1fr !important; }
          .wr-preview-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* ── OUTER SHELL — matches MockMate's exact blue gradient ── */}
      <section
        className="wr-section"
        style={{
          position: 'relative',
          borderRadius: 24,
          overflow: 'hidden',
          marginBottom: 18,
          background: heroGradient,
          boxShadow: '0 24px 80px rgba(10,31,78,0.55), 0 8px 28px rgba(0,198,255,0.12)',
          border: '1px solid rgba(0,198,255,0.22)',
        }}
      >
        {/* ── decorative ambient orbs ── */}
        <div style={{ position:'absolute', top:-120, right:-80, width:420, height:420, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(0,198,255,0.14) 0%, rgba(37,99,235,0.08) 40%, transparent 70%)',
          pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-100, left:-60, width:340, height:340, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(14,165,233,0.12) 0%, rgba(26,79,191,0.06) 40%, transparent 70%)',
          pointerEvents:'none' }} />
        {/* subtle scan line */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
          <div style={{ position:'absolute', left:0, right:0, height:2,
            background:'linear-gradient(90deg, transparent, rgba(0,198,255,0.25), transparent)',
            animation:'wr-scan 6s ease-in-out infinite' }} />
        </div>

        {/* ── INNER CONTENT WRAPPER ── */}
        <div style={{ position:'relative', zIndex:1, padding:'32px 28px 28px' }}>

          {/* ── HEADER ROW ── */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:20, marginBottom:24, flexWrap:'wrap' }}>

            <div style={{ flex:1, minWidth:0 }}>
              {/* eyebrow */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:W.cyan,
                  boxShadow:`0 0 10px ${W.cyan}`, animation:'wr-glow-pulse 2s ease infinite' }} />
                <span style={{ fontFamily:F.mono, fontSize:9.5, fontWeight:700, letterSpacing:'1.8px', color:W.textMuted }}>
                  ANALYTICS WAR ROOM
                </span>
              </div>

              <h2 style={{ margin:'0 0 10px', fontFamily:F.display, fontSize:'clamp(20px,3vw,26px)', fontWeight:800,
                color:W.textPrimary, letterSpacing:'-0.04em', lineHeight:1.18 }}>
                Placement Coach&nbsp;
                <span style={{ background:accentGradient, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  backgroundClip:'text' }}>
                  + Behavioral DNA
                </span>
              </h2>

              <p style={{ margin:0, fontFamily:F.body, fontSize:13, lineHeight:1.72, color:W.textSub,
                fontWeight:450, maxWidth:600, letterSpacing:'-0.005em' }}>
                Two AI analyses computed in parallel from your {totalSessions} real sessions.
                Left: your 30-day action plan. Right: your behavioral fingerprint.
                {totalSessions < 10 && (
                  <span style={{ display:'block', marginTop:7, color:W.amber, fontSize:11.5,
                    fontFamily:F.mono, letterSpacing:'0.3px' }}>
                    ⚠ Interview DNA unlocks at 10 sessions — you have {totalSessions}.
                  </span>
                )}
              </p>
            </div>

            {/* right: stat chips + button */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end', flexShrink:0 }}>
              <div style={{ display:'flex', gap:7 }}>
                {statsStrip.map((s, i) => (
                  <div key={i} className="wr-stat-chip">
                    <div style={{ fontFamily:F.mono, fontSize:8, fontWeight:700, letterSpacing:'0.8px', color:W.textFaint, marginBottom:3 }}>
                      {s.label}
                    </div>
                    <div style={{ fontFamily:F.display, fontSize:s.label === 'ARCHETYPE' ? 18 : 16,
                      fontWeight:900, color:s.color, letterSpacing:'-0.02em', lineHeight:1 }}>
                      {s.val}{s.unit && <span style={{ fontSize:9, color:W.textMuted }}>{s.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="wr-generate-btn"
                onClick={generateBoth}
                disabled={loading}
                style={{ padding:'12px 20px', fontSize:13, display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}
              >
                {loading ? (
                  <>
                    <span style={{ width:14, height:14, borderRadius:'50%', flexShrink:0,
                      border:'2px solid rgba(255,255,255,0.25)', borderTopColor:'#fff',
                      animation:'wr-spin 0.65s linear infinite', display:'inline-block' }} />
                    Analyzing…
                  </>
                ) : done ? (
                  <>↺ Regenerate Profile</>
                ) : (
                  <>⚔ Generate War Room Profile</>
                )}
              </button>
            </div>
          </div>

          {/* ── PRE-GENERATE STATE ── */}
          {!done && !loading && (
            <div style={{ border:`1.5px dashed rgba(0,198,255,0.30)`, borderRadius:18,
              padding:'40px 24px', textAlign:'center', background:'rgba(10,31,78,0.35)' }}>

              <div style={{ width:52, height:52, borderRadius:16, margin:'0 auto 14px',
                background:accentGradient, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:24, boxShadow:`0 10px 30px rgba(0,198,255,0.30)` }}>⚔</div>

              <p style={{ color:W.textSub, fontSize:13.5, margin:'0 auto 24px', maxWidth:500,
                lineHeight:1.78, fontWeight:450, letterSpacing:'-0.005em' }}>
                Click <strong style={{ color:W.textPrimary }}>Generate War Room Profile</strong> to get your
                placement coach's action plan and behavioral fingerprint — both computed from your real session data.
              </p>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, maxWidth:640, margin:'0 auto' }}
                className="wr-preview-grid">
                {previewCards.map(item => (
                  <div key={item.label} className="wr-preview-card"
                    style={{ background: item.bg, borderColor: item.color + '30' }}>
                    <div style={{ fontSize:22, marginBottom:8 }}>{item.icon}</div>
                    <div style={{ fontFamily:F.mono, fontSize:8.5, fontWeight:800, letterSpacing:'0.9px',
                      color:item.color, marginBottom:5 }}>{item.label}</div>
                    <div style={{ fontSize:11, color:W.textSub, lineHeight:1.45 }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop:16, fontFamily:F.mono, fontSize:10, color:W.textFaint }}>
                ~10 sec · uses your real session data · no data leaves MockMate
              </div>
            </div>
          )}

          {/* ── LOADING STATE ── */}
          {loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {loadingSteps.map((msg, i) => (
                <div key={i} className="wr-loading-row">
                  <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0,
                    background:W.cyan, boxShadow:`0 0 8px ${W.cyan}`,
                    animation:`wr-pulse-dot 1.4s ease ${i * 0.2}s infinite` }} />
                  <span style={{ color:W.textSub, fontSize:12, fontFamily:F.mono, letterSpacing:'0.2px' }}>{msg}</span>
                  {i === 0 && (
                    <div style={{ marginLeft:'auto', flexShrink:0,
                      background:'linear-gradient(90deg, transparent, rgba(0,198,255,0.15), transparent)',
                      backgroundSize:'400px 100%', animation:'wr-shimmer 1.6s ease infinite',
                      borderRadius:4, height:8, width:80 }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── RESULTS ── */}
          {done && (
            <div style={{ display:'grid', gridTemplateColumns: totalSessions >= 10 ? '1fr 1fr' : '1fr', gap:20 }}
              className="wr-two-col">

              {/* LEFT: PLACEMENT COACH */}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14,
                  paddingBottom:12, borderBottom:`1px solid ${W.glassEdge}` }}>
                  <div style={{ width:32, height:32, borderRadius:10, flexShrink:0,
                    background:accentGradient, display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, boxShadow:`0 6px 18px rgba(0,198,255,0.30)` }}>⚡</div>
                  <div>
                    <div className="wr-col-label">PLACEMENT COACH</div>
                    <div className="wr-col-title">Action plan + interview talking points</div>
                  </div>
                </div>

                {boardSections.length > 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                    {boardSections.map((s, i) => (
                      <div key={i} className="wr-result-card"
                        style={{ borderLeftWidth:3, borderLeftStyle:'solid', borderLeftColor:s.accent,
                          animationDelay:`${i * 55}ms` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}>
                          <span style={{ fontSize:12 }}>{boardIcons[s.heading] || '•'}</span>
                          <span style={{ fontFamily:F.mono, fontSize:8.5, fontWeight:800,
                            letterSpacing:'1.1px', color:s.accent }}>{s.heading}</span>
                        </div>
                        <p style={{ margin:0, color:W.textSub, fontSize:12.5, lineHeight:1.82,
                          fontWeight:450, letterSpacing:'-0.006em', whiteSpace:'pre-line' }}>{s.body}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color:W.textSub, fontSize:13, lineHeight:1.82, margin:0, whiteSpace:'pre-line' }}>{boardRaw}</p>
                )}
              </div>

              {/* RIGHT: INTERVIEW DNA */}
              {totalSessions >= 10 && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14,
                    paddingBottom:12, borderBottom:`1px solid ${W.glassEdge}` }}>
                    <div style={{ width:32, height:32, borderRadius:10, flexShrink:0,
                      background:`linear-gradient(135deg, ${W.green}, #059669)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:16, boxShadow:`0 6px 18px ${W.greenGlow}` }}>🧬</div>
                    <div>
                      <div className="wr-col-label">INTERVIEW DNA</div>
                      <div className="wr-col-title">Behavioral fingerprint · {totalSessions} sessions</div>
                    </div>
                  </div>

                  {dnaSections.length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                      {dnaSections.map((s, i) => (
                        <div key={i} className="wr-result-card"
                          style={{ borderLeftWidth:3, borderLeftStyle:'solid', borderLeftColor:s.accent,
                            animationDelay:`${i * 55}ms` }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}>
                            <span style={{ fontSize:12 }}>{dnaIcons[s.heading] || '🧬'}</span>
                            <span style={{ fontFamily:F.mono, fontSize:8.5, fontWeight:800,
                              letterSpacing:'1.1px', color:s.accent }}>{s.heading}</span>
                          </div>
                          <p style={{ margin:0, color:W.textSub, fontSize:12.5, lineHeight:1.82,
                            fontWeight:450, letterSpacing:'-0.006em', whiteSpace:'pre-line' }}>{s.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : dnaDone ? (
                    <p style={{ color:W.textSub, fontSize:13, lineHeight:1.82, margin:0, whiteSpace:'pre-line' }}>
                      {dnaRaw || "Unable to generate Interview DNA."}
                    </p>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {["Reading session variance…","Mapping response style…","Analyzing pressure signals…","Writing fingerprint…"].map((m, i) => (
                        <div key={i} className="wr-loading-row">
                          <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                            background:W.green, animation:`wr-pulse-dot 1.5s ease ${i*0.25}s infinite` }} />
                          <span style={{ color:W.textMuted, fontSize:11.5, fontFamily:F.mono }}>{m}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── FOOTER ── */}
          {done && (
            <>
              <hr className="wr-section-divider" style={{ margin:'20px 0 16px' }} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                <p style={{ margin:0, fontSize:11, color:W.textFaint, fontFamily:F.mono, letterSpacing:'0.2px' }}>
                  Both analyses regenerate fresh each click · DNA unlocks at 10 sessions
                </p>
                <button
                  onClick={generateBoth}
                  disabled={loading}
                  style={{ background:'rgba(0,198,255,0.10)', border:`1px solid ${W.glassEdge}`,
                    borderRadius:10, padding:'8px 16px', fontSize:11.5, fontWeight:700,
                    color:W.cyanLight, cursor:'pointer', fontFamily:F.body,
                    transition:'all 0.18s ease', letterSpacing:'-0.01em' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(0,198,255,0.18)'; e.currentTarget.style.borderColor=W.glassEdgeMd; }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(0,198,255,0.10)'; e.currentTarget.style.borderColor=W.glassEdge; }}
                >
                  ↺ Regenerate both
                </button>
              </div>
            </>
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