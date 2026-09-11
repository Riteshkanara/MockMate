// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — RESULT HERO V2 · MISSION DEBRIEF FORMAT
//
// A completely different visual grammar from the current arc-left/text-right hero.
//
// CONCEPT: "Cockpit debrief" — the result feels like a readout from a
// system that assessed your performance, not a dashboard metric. The score
// is a single massive typographic event at the top center. Below it, a
// horizontal instrument strip with 4 live gauges. The bottom third is a
// stark verdict + actions. The whole card feels like a terminal printout
// or a pilot's post-flight brief.
//
// LAYOUT (portrait-center gravity, not left/right):
//
//   ┌─────────────────────────────────────────────────────┐
//   │  [grade glyph]  SESSION COMPLETE  [date · session]  │  ← monospace header bar
//   ├─────────────────────────────────────────────────────┤
//   │                                                     │
//   │                     78                              │  ← score: 120px, dominant
//   │                   / 100                             │
//   │         ████████████████░░░░  SOLID                 │  ← grade fill bar
//   │                                                     │
//   ├──────────┬──────────┬──────────┬────────────────────┤
//   │ ANSWERED │  STRONG  │  TO FIX  │      PACE          │  ← instrument strip
//   │  10/12   │    7     │    2     │     1:42           │
//   │ [mini bar│ [mini dot│ [mini dot│  [pace cursor]     │
//   ├──────────┴──────────┴──────────┴────────────────────┤
//   │  "The foundation is there — sharpen the edges."     │  ← verdict, large, centered
//   │                                                     │
//   │  [Start another]  [Dashboard]  [Copy]  [Download]   │  ← actions
//   └─────────────────────────────────────────────────────┘
//
// DROP IN: export as ResultHeroV2. Use in Result.jsx instead of ResultHero.
// Same props interface as ResultHero — drop-in swap.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo } from "react";
import { C, F } from "../styles/token";

// ─── helpers (already in scope in Result.jsx — remove if pasting inline) ──
const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const formatTime = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};

const GRADE_MAP = [
  { min: 90, grade: "S", desc: "Elite",          accent: C.violet, glow: C.violet },
  { min: 80, grade: "A", desc: "Strong",         accent: C.green,  glow: C.green  },
 { min: 70, grade: "B", desc: "Solid", accent: "#1a6fff", glow: "#1a6fff" },
  { min: 60, grade: "C", desc: "Developing",     accent: C.amber,  glow: C.amber  },
  { min:  0, grade: "D", desc: "Needs Practice", accent: C.red,    glow: C.red    },
];
const getGrade = (s) => GRADE_MAP.find(g => s >= g.min) || GRADE_MAP[GRADE_MAP.length - 1];

const getVerdict = (s) => {
  if (s >= 80) return "You are building reliable interview form.";
  if (s >= 60) return "The foundation is there — sharpen the edges.";
  return "This session exposed useful gaps.";
};

// ─── Animated count-up ───────────────────────────────────────────────────────
const useCountUp = (target, duration = 1000, delay = 200) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      setVal(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const timeout = setTimeout(() => { frame = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [target, duration, delay]);
  return val;
};

// ─── Animated score fill bar ─────────────────────────────────────────────────
// The horizontal grade fill bar — animates from 0 to score width on mount.
const ScoreFillBar = ({ score, grade }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(clamp(score)), 320);
    return () => clearTimeout(t);
  }, [score]);

  // Segmented bar: 10 segments, each representing 10 pts
  const segments = Array.from({ length: 10 }, (_, i) => {
    const segStart = i * 10;
    const segEnd   = segStart + 10;
    const fill = width >= segEnd ? 1 : width > segStart ? (width - segStart) / 10 : 0;
    return { fill, key: i };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* Segmented bar */}
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        {segments.map(seg => (
          <div key={seg.key} style={{ position: "relative", width: 28, height: 7, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
            <div style={{
              position: "absolute", inset: 0,
              borderRadius: 3,
              background: grade.accent,
              opacity: seg.fill > 0 ? (0.4 + seg.fill * 0.55) : 0,
              transform: `scaleX(${seg.fill})`,
              transformOrigin: "left",
              transition: "transform 0.6s cubic-bezier(.16,1,.3,1), opacity 0.3s ease",
              boxShadow: seg.fill === 1 ? `0 0 6px ${grade.glow}60` : "none",
            }} />
          </div>
        ))}
        {/* Grade label at end */}
        <div style={{
          marginLeft: 8,
          padding: "3px 10px",
          borderRadius: 6,
          background: `${grade.accent}18`,
          border: `1px solid ${grade.accent}40`,
        }}>
          <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: grade.accent, letterSpacing: "0.5px" }}>
            {grade.grade} · {grade.desc}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Instrument gauge ────────────────────────────────────────────────────────
// Each of the 4 bottom instruments. Different micro-viz per type.
const Instrument = ({ label, value, sub, color, type, extra, index, visible }) => {
  const style = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.4s ease ${index * 80}ms, transform 0.4s cubic-bezier(.16,1,.3,1) ${index * 80}ms`,
    flex: 1,
    minWidth: 0,
    padding: "12px 18px",
    borderLeft: index > 0 ? "1px solid rgba(255,255,255,0.07)" : "none",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  return (
    <div style={style}>
      {/* Label */}
      <div style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.35)", letterSpacing: "0.4px" }}>
        {label}
      </div>

      {/* Value */}
      <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.5px" }}>
        {value}
        {sub && <span style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 400, marginLeft: 4 }}>{sub}</span>}
      </div>

      {/* Micro-viz */}
      {type === "completion" && (
        <CompletionMicro value={extra.answered} max={extra.total} color={color} />
      )}
      {type === "strong" && (
        <DotsMicro count={extra.count} total={extra.total} color={color} goodColor={C.green} />
      )}
      {type === "tofix" && (
        <DotsMicro count={extra.count} total={extra.total} color={color} goodColor={C.red} invert />
      )}
      {type === "pace" && (
        <PaceMicro seconds={extra.seconds} color={color} />
      )}
    </div>
  );
};

// Completion — thin horizontal bar, fraction fill
const CompletionMicro = ({ value, max, color }) => {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(max > 0 ? (value / max) * 100 : 0), 500); return () => clearTimeout(t); }, [value, max]);
  return (
    <div style={{ height: 3, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 999, transition: "width 0.9s cubic-bezier(.16,1,.3,1)" }} />
    </div>
  );
};

// Dots — small circles, filled = count, empty = remainder
const DotsMicro = ({ count, total, color, invert }) => {
  const dots = Array.from({ length: Math.min(total, 8) }, (_, i) => {
    const filled = invert ? i >= (total - count) : i < count;
    return filled;
  });
  return (
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {dots.map((filled, i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: filled ? color : "rgba(255,255,255,0.1)",
          transition: `background 0.2s ease ${i * 40}ms`,
        }} />
      ))}
      {total > 8 && <span style={{ fontFamily: F.mono, fontSize: 8, color: "rgba(255,255,255,0.3)", alignSelf: "center" }}>+{total - 8}</span>}
    </div>
  );
};

// Pace — cursor on a spectrum bar (fast ← → slow)
const PaceMicro = ({ seconds, color }) => {
  const MIN = 30, MAX = 300;
  const pct = clamp(((seconds - MIN) / (MAX - MIN)) * 100);
  const [pos, setPos] = useState(0);
  useEffect(() => { const t = setTimeout(() => setPos(pct), 500); return () => clearTimeout(t); }, [pct]);

  const paceLabel = seconds < 60 ? "fast" : seconds <= 180 ? "good" : seconds <= 240 ? "steady" : "slow";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ position: "relative", height: 3, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
        {/* Good zone */}
        <div style={{ position: "absolute", left: "11%", width: "50%", top: 0, bottom: 0, background: `${C.green}25`, borderRadius: 999 }} />
        {/* Cursor */}
        <div style={{
          position: "absolute",
          left: `${pos}%`,
          top: -3, bottom: -3,
          width: 3,
          background: color,
          borderRadius: 999,
          transform: "translateX(-50%)",
          boxShadow: `0 0 5px ${color}80`,
          transition: "left 0.9s cubic-bezier(.16,1,.3,1)",
        }} />
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 8, color, fontWeight: 700 }}>{paceLabel}</span>
    </div>
  );
};

// ─── Trend badge ─────────────────────────────────────────────────────────────
const TrendBadge = ({ delta }) => {
  const positive = delta >= 0;
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "4px 10px",
      borderRadius: 999,
      background: positive ? `${C.green}15` : `${C.red}15`,
      border: `1px solid ${positive ? C.green : C.red}30`,
    }}>
      <span style={{ fontSize: 9, color: positive ? C.green : C.red }}>{positive ? "▲" : "▼"}</span>
      <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: positive ? C.green : C.red }}>
        {positive ? "+" : ""}{Number(delta).toFixed(1)} vs last
      </span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export const ResultHeroV2 = ({ result, navigate, onCopy, copied, onDownloadImage, downloading }) => {
  const { score, totalQuestions, answeredQuestions, skippedQuestions,
          strongAnswers, weakAnswers, averageTime, trendDelta, scoreHistory } = result;

  const grade     = getGrade(clamp(score));
  const verdict   = getVerdict(clamp(score));
  const hasTrend  = trendDelta != null && Array.isArray(scoreHistory) && scoreHistory.length >= 2;
  const displayScore = useCountUp(clamp(score), 1000, 150);

  // Staggered instrument reveal
  const [instrumentsVisible, setInstrumentsVisible] = useState(false);
  const [verdictVisible,      setVerdictVisible]     = useState(false);
  const [actionsVisible,      setActionsVisible]     = useState(false);
  const [scoreVisible,        setScoreVisible]       = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setScoreVisible(true),        80),
      setTimeout(() => setInstrumentsVisible(true),  820),
      setTimeout(() => setVerdictVisible(true),     1080),
      setTimeout(() => setActionsVisible(true),     1260),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Today's date — terminal style
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toLowerCase();

  return (
    <section style={{
      position: "relative",
      overflow: "hidden",
      marginBottom: 20,
      borderRadius: 22,
      background: `linear-gradient(160deg, #0d1f4a 0%, #091535 55%, #060d1e 100%)`,
      boxShadow: "0 32px 80px rgba(4,12,40,0.55)",
      fontFamily: F.body,
    }} className="res-hero res-hero-v2">

      {/* Grade color flash overlay */}
      <GradeFlashOverlayV2 grade={grade} />

      {/* Scan lines — two at different speeds */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "22%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.025), transparent)", animation: "mmHeroScan 11s linear infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: "8%",  height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)", animation: "mmHeroScan 17s linear infinite", animationDelay: "5s", pointerEvents: "none" }} />

      {/* Dot grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      {/* Grade glow — bottom right */}
      <div style={{ position: "absolute", right: -80, bottom: -100, width: 440, height: 440, borderRadius: "50%", background: `radial-gradient(circle, ${grade.glow}18 0%, transparent 65%)`, pointerEvents: "none" }} />
      {/* Secondary glow — top left */}
      <div style={{ position: "absolute", left: -60, top: -80, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, #1a6fff18 0%, transparent 65%)`, pointerEvents: "none" }} />

      {/* ── Header bar ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 28px",        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "relative",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Live pulse */}
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "livePulse 2.4s ease-in-out infinite" }} />
          <span style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.3px" }}>
            post-interview debrief
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {hasTrend && <TrendBadge delta={trendDelta} />}
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: "rgba(255,255,255,0.25)" }}>
            {dateStr}
          </span>
        </div>
      </div>

      {/* ── Score block — centered, typographically dominant ── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "28px 28px 22px",
        position: "relative",
        opacity: scoreVisible ? 1 : 0,
        transform: scoreVisible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.6s cubic-bezier(.16,1,.3,1), transform 0.6s cubic-bezier(.16,1,.3,1)",
      }}>
        {/* The score — enormous, the only thing that matters at first glance */}
        <div style={{ position: "relative", display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          <span style={{
            fontFamily: F.display,
            fontSize: 96,
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1,
            letterSpacing: "-6px",
            // Gradient text — grade color bleeding into white
            background: `linear-gradient(180deg, #fff 30%, ${grade.accent}70 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: `drop-shadow(0 0 40px ${grade.glow}30)`,
          }}>
            {displayScore}
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 20, color: "rgba(255,255,255,0.25)", fontWeight: 400, letterSpacing: 0, marginBottom: 8 }}>
            /100
          </span>
        </div>

        {/* Grade fill bar — 12px below the score */}
        <div style={{ marginTop: 16 }}>
          <ScoreFillBar score={clamp(score)} grade={grade} />
        </div>
      </div>

      {/* ── Instrument strip ── */}
      <div style={{
        display: "flex",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.15)",
      }} className="res-v2-instruments">
        <Instrument
          label="answered"
          value={`${answeredQuestions}/${totalQuestions}`}
          color={skippedQuestions > 0 ? C.amber : "rgba(255,255,255,0.85)"}
          type="completion"
          extra={{ answered: answeredQuestions, total: totalQuestions }}
          index={0}
          visible={instrumentsVisible}
          sub={skippedQuestions > 0 ? `(${skippedQuestions} skipped)` : null}
        />
        <Instrument
          label="strong"
          value={strongAnswers}
          sub="scored 80+"
          color={C.green}
          type="strong"
          extra={{ count: strongAnswers, total: answeredQuestions }}
          index={1}
          visible={instrumentsVisible}
        />
        <Instrument
          label="needs work"
          value={weakAnswers}
          sub="below 60"
          color={weakAnswers > 0 ? C.red : "rgba(255,255,255,0.3)"}
          type="tofix"
          extra={{ count: weakAnswers, total: answeredQuestions }}
          index={2}
          visible={instrumentsVisible}
        />
        <Instrument
          label="avg pace"
          value={averageTime > 0 ? formatTime(averageTime) : "—"}
          color={averageTime > 0 && averageTime <= 180 ? C.green : averageTime > 240 ? C.red : C.amber}
          type="pace"
          extra={{ seconds: averageTime }}
          index={3}
          visible={instrumentsVisible}
        />
      </div>

      {/* ── Verdict + Actions ── */}
      <div style={{ padding: "20px 28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Verdict — large, centered, the one sentence that matters */}
        <div style={{
          textAlign: "center",
          opacity: verdictVisible ? 1 : 0,
          transform: verdictVisible ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(.16,1,.3,1)",
        }}>
          <p style={{
            margin: 0,
            fontFamily: F.display,
            fontSize: 20,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.4,
            letterSpacing: "-0.3px",
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}>
            {verdict}
          </p>
        </div>

        {/* Actions */}
        <div style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexWrap: "wrap",
          opacity: actionsVisible ? 1 : 0,
          transform: actionsVisible ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 0.45s ease, transform 0.45s cubic-bezier(.16,1,.3,1)",
        }} className="res-hero-actions">
          {/* Primary — grade accent */}
          <button
            onClick={() => navigate("/interview")}
            style={{
              border: "none",
              borderRadius: 11,
              background: `linear-gradient(135deg, ${grade.accent}, ${grade.glow}cc)`,
              color: "#fff",
              padding: "11px 22px",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: F.body,
              cursor: "pointer",
              boxShadow: `0 4px 20px ${grade.accent}45`,
              letterSpacing: "-0.1px",
            }}
            className="res-btn-primary"
          >
            Start another interview
          </button>
          <button onClick={() => navigate("/dashboard")} style={ghostBtn} className="res-btn-ghost">Dashboard</button>
          <button onClick={onCopy}                       style={ghostBtn} className="res-btn-ghost">{copied ? "Copied ✓" : "Copy summary"}</button>
          <button onClick={onDownloadImage} disabled={downloading} style={ghostBtn} className="res-btn-ghost">{downloading ? "Preparing…" : "Download image"}</button>
        </div>
      </div>
    </section>
  );
};

// ─── Grade flash overlay (V2 version — same concept, slightly wider bloom) ───
const GradeFlashOverlayV2 = ({ grade }) => {
  const [active, setActive] = useState(true);
  useEffect(() => { const t = setTimeout(() => setActive(false), 1600); return () => clearTimeout(t); }, []);
  return (
    <div aria-hidden="true" style={{
      position: "absolute", inset: 0, borderRadius: "inherit",
      background: `radial-gradient(ellipse at 50% 30%, ${grade.glow}40 0%, transparent 60%)`,
      opacity: active ? 1 : 0,
      transition: "opacity 1.3s cubic-bezier(.4,0,.2,1)",
      pointerEvents: "none", zIndex: 1,
    }} />
  );
};

// ─── Ghost button style ───────────────────────────────────────────────────────
const ghostBtn = {
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 11,
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.72)",
  padding: "11px 18px",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  letterSpacing: "-0.1px",
};

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSIVE CSS — add to GlobalStyles in Result.jsx
// ═══════════════════════════════════════════════════════════════════════════
//
// @media (max-width: 640px) {
//   .res-hero-v2 .res-v2-instruments {
//     display: grid !important;
//     grid-template-columns: 1fr 1fr !important;
//   }
// }
// @media (max-width: 400px) {
//   .res-hero-v2 .res-v2-instruments {
//     grid-template-columns: 1fr !important;
//   }
// }
//
// ═══════════════════════════════════════════════════════════════════════════
// HOW TO SWAP IN Result.jsx
// ═══════════════════════════════════════════════════════════════════════════
//
// Option A — replace entirely:
//   Find the <ResultHero ... /> call in the render tree and change to:
//   <ResultHeroV2 ... />
//   (same props, drop-in)
//
// Option B — A/B test with a toggle:
//   const [heroV2, setHeroV2] = useState(true);
//   {heroV2
//     ? <ResultHeroV2 result={heroResult} navigate={navigate} ... />
//     : <ResultHero   result={heroResult} navigate={navigate} ... />
//   }
//
// ═══════════════════════════════════════════════════════════════════════════