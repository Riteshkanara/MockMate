// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — RESULT HERO V2  ·  PRODUCTION FINAL
//
// Drop-in swap for ResultHero. Same props interface.
// Visual language: matches MockMate dashboard hero exactly —
//   electric blue gradient, ghosted bg glyphs, frosted instrument strip,
//   white score typography, monospace labels, scanline shimmer.
//
// USAGE in Result.jsx:
//   import { ResultHeroV2 } from "./ResultHeroV2";
//   <ResultHeroV2
//     result={heroResult}
//     navigate={navigate}
//     onCopy={handleCopy}
//     copied={copied}
//     onDownloadImage={handleDownload}
//     downloading={downloading}
//   />
//
// ───────────────────────────────────────────────────────────────────────────
// FIXES APPLIED IN THIS FILE
// ───────────────────────────────────────────────────────────────────────────
// 1. BORDER SHORTHAND WARNING (installHook.js:1)
//    React warns when `border` shorthand and `borderLeft` / `borderTop` are
//    set on the same element across re-renders. Fixed by replacing every
//    `border: "..."` with explicit longhand properties:
//      borderWidth / borderStyle / borderColor
//    Affected: ghostBtn object, primary button, Instrument left-border.
//
// 2. DUPLICATE `transition` KEY IN Instrument
//    The style object had two `transition` entries — the second silently
//    overwrote the first. Fixed: single combined transition string.
//
// 3. GOOGLE FONTS CORS cssRules ERROR (Result.jsx ~line 1736)
//    Your download-image helper reads cssRules from every stylesheet to
//    inline them. Cross-origin sheets (Google Fonts) throw a SecurityError.
//    Patch your inliner in Result.jsx like this:
//
//      // BEFORE (throws on cross-origin sheets):
//      const rules = sheet.cssRules;
//
//      // AFTER — guard with try/catch, skip sheets that can't be read:
//      let rules;
//      try { rules = sheet.cssRules; } catch { continue; }
//      if (!rules) continue;
//
//    Find the loop that iterates document.styleSheets and wrap cssRules
//    access in the try/catch above. The font still loads from Google's CDN
//    at runtime; the inliner just skips it for the downloaded image, which
//    is fine — the download snapshot uses whatever fonts were already loaded.
//
// ───────────────────────────────────────────────────────────────────────────
// ADD to your GlobalStyles / Result.css:
//   @keyframes mmHeroScan   { 0%{transform:translateX(-120%)} 100%{transform:translateX(800%)} }
//   @keyframes mmLivePulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.65)} }
//   @keyframes mmFloatA     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
//   @keyframes mmFloatB     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
//   @keyframes mmFlashOut   { 0%{opacity:1} 100%{opacity:0} }
//   @keyframes mmScoreIn    { from{opacity:0;transform:scale(.82)} to{opacity:1;transform:scale(1)} }
//   @keyframes mmFadeUp     { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { C, F } from "../styles/token";

// ─── helpers ─────────────────────────────────────────────────────────────────
const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const formatTime = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};

// ─── grade map — drives accent colour everywhere ──────────────────────────────
const GRADE_MAP = [
  { min: 90, grade: "S", desc: "Elite",          accent: C.violet,    glow: C.violet  },
  { min: 80, grade: "A", desc: "Strong",         accent: "#22d370",   glow: "#22d370" },
  { min: 70, grade: "B", desc: "Solid",          accent: "#1a6fff",   glow: "#0ea0e8" },
  { min: 60, grade: "C", desc: "Developing",     accent: C.amber,     glow: C.amber   },
  { min:  0, grade: "D", desc: "Needs Practice", accent: "#ff6b6b",   glow: C.red     },
];
const getGrade   = (s) => GRADE_MAP.find((g) => s >= g.min) ?? GRADE_MAP[GRADE_MAP.length - 1];

const getVerdict = (s) => {
  if (s >= 90) return "Elite form. You're ready for the big leagues.";
  if (s >= 80) return "You are building reliable interview form.";
  if (s >= 60) return "The foundation is there — sharpen the edges.";
  return "This session exposed useful gaps. That's the work.";
};

// grade → decorative glyph shown large in the bg
const GRADE_GLYPH = {
  S: "🏆", A: "⚡", B: "🎯", C: "🔧", D: "📖",
};

// ─── animated count-up ────────────────────────────────────────────────────────
const useCountUp = (target, duration = 1100, delay = 120) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf;
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const t     = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        setVal(Math.round(eased * target));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return val;
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Animated segmented fill bar ─────────────────────────────────────────────
const ScoreFillBar = ({ score, grade }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 340); return () => clearTimeout(t); }, []);

  const segments = Array.from({ length: 10 }, (_, i) => {
    const segStart = i * 10;
    const fill = score >= segStart + 10 ? 1 : score > segStart ? (score - segStart) / 10 : 0;
    return { fill, key: i };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 18 }}>
      {segments.map(({ fill, key }) => (
        <div
          key={key}
          style={{
            position: "relative",
            width: 31,
            height: 7,
            borderRadius: 3,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 3,
              // white gradient fill — readable on any accent bg
              background: "linear-gradient(90deg, rgba(255,255,255,.55), rgba(255,255,255,.92))",
              opacity: fill > 0 ? 0.38 + fill * 0.58 : 0,
              transform: ready ? `scaleX(${fill})` : "scaleX(0)",
              transformOrigin: "left",
              transition: `transform ${0.55 + key * 0.06}s cubic-bezier(.16,1,.3,1)`,
              boxShadow: fill === 1 ? "0 0 7px rgba(255,255,255,.35)" : "none",
            }}
          />
        </div>
      ))}
      {/* Grade pill */}
      <div
        style={{
          marginLeft: 10,
          padding: "3px 12px",
          borderRadius: 7,
          background: "rgba(255,255,255,0.12)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "rgba(255,255,255,0.22)",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 10,
            fontWeight: 800,
            color: "rgba(255,255,255,0.88)",
            letterSpacing: "0.5px",
          }}
        >
          {grade.grade} · {grade.desc}
        </span>
      </div>
    </div>
  );
};

// ─── Trend badge ──────────────────────────────────────────────────────────────
const TrendBadge = ({ delta }) => {
  const up = delta >= 0;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 11px",
        borderRadius: 999,
        background: up ? "rgba(34,211,112,0.13)" : "rgba(255,107,107,0.13)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: up ? "rgba(34,211,112,0.28)" : "rgba(255,107,107,0.28)",
        fontFamily: F.mono,
        fontSize: 9.5,
        fontWeight: 700,
        color: up ? "#34e891" : "#ff6b6b",
      }}
    >
      {up ? "▲" : "▼"} {up ? "+" : ""}{Number(delta).toFixed(1)} vs last
    </div>
  );
};

// ─── Live-readiness badge ─────────────────────────────────────────────────────
const LiveBadge = () => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 10px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.09)",
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "rgba(255,255,255,0.16)",
      fontFamily: F.mono,
      fontSize: 9,
      color: "rgba(255,255,255,0.55)",
      letterSpacing: "0.3px",
    }}
  >
    <span
      style={{
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: "#34e891",
        display: "inline-block",
        animation: "mmLivePulse 2.4s ease-in-out infinite",
      }}
    />
    LIVE RESULT
  </div>
);

// ─── Individual instrument ────────────────────────────────────────────────────
const Instrument = ({ icon, label, value, sub, color, type, extra, index, visible }) => {
  const baseDelay = `${index * 80}ms`;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: "14px 18px",
        // use borderLeft only — never mix shorthand `border` with borderLeft
        borderLeftWidth: index > 0 ? 1 : 0,
        borderLeftStyle: "solid",
        borderLeftColor: "rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        // single transition declaration — no duplicate keys
        transition: `opacity 0.45s ease ${baseDelay}, transform 0.45s cubic-bezier(.16,1,.3,1) ${baseDelay}, background 0.2s ease`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
      }}
      className="rh-instrument"
    >
      {/* icon */}
      <div style={{ fontSize: 15, lineHeight: 1 }}>{icon}</div>
      {/* label */}
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 8.5,
          color: "rgba(255,255,255,0.32)",
          letterSpacing: "0.4px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {/* value */}
      <div
        style={{
          fontFamily: F.display,
          fontSize: 28,
          fontWeight: 900,
          color,
          lineHeight: 1,
          letterSpacing: "-0.5px",
        }}
      >
        {value}
        {sub && (
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              color: "rgba(255,255,255,0.28)",
              fontWeight: 400,
              marginLeft: 4,
            }}
          >
            {sub}
          </span>
        )}
      </div>

      {/* micro-viz */}
      {type === "completion" && (
        <CompletionMicro value={extra.answered} max={extra.total} />
      )}
      {type === "strong" && (
        <DotsMicro count={extra.count} total={extra.total} color="#34e891" />
      )}
      {type === "tofix" && (
        <DotsMicro count={extra.count} total={extra.total} color="#ff6b6b" invert />
      )}
      {type === "pace" && (
        <PaceMicro seconds={extra.seconds} />
      )}
    </div>
  );
};

// Completion bar
const CompletionMicro = ({ value, max }) => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(max > 0 ? (value / max) * 100 : 0), 900);
    return () => clearTimeout(t);
  }, [value, max]);
  return (
    <div style={{ height: 3, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${w}%`,
          background: "rgba(255,255,255,0.7)",
          borderRadius: 999,
          transition: "width 0.9s cubic-bezier(.16,1,.3,1)",
        }}
      />
    </div>
  );
};

// Dots micro-viz
const DotsMicro = ({ count, total, color, invert = false }) => {
  const [lit, setLit] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLit(true), 950); return () => clearTimeout(t); }, []);
  const dots = Array.from({ length: Math.min(total, 10) }, (_, i) => {
    const filled = invert ? i >= total - count : i < count;
    return { filled, i };
  });
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
      {dots.map(({ filled, i }) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: lit && filled ? color : "rgba(255,255,255,0.1)",
            transition: `background 0.25s ease ${lit ? i * 45 : 0}ms`,
          }}
        />
      ))}
      {total > 10 && (
        <span style={{ fontFamily: F.mono, fontSize: 8, color: "rgba(255,255,255,0.3)", alignSelf: "center" }}>
          +{total - 10}
        </span>
      )}
    </div>
  );
};

// Pace micro-viz
const PaceMicro = ({ seconds }) => {
  const MIN = 30, MAX = 300;
  const pct = clamp(((seconds - MIN) / (MAX - MIN)) * 100);
  const [pos, setPos] = useState(0);
  useEffect(() => { const t = setTimeout(() => setPos(pct), 960); return () => clearTimeout(t); }, [pct]);

  const label =
    seconds < 60 ? "fast" :
    seconds <= 180 ? "good pace ✓" :
    seconds <= 240 ? "steady" : "slow";
  const labelColor = seconds <= 180 ? "#34e891" : seconds <= 240 ? C.amber : "#ff6b6b";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ position: "relative", height: 3, borderRadius: 999, background: "rgba(255,255,255,0.1)" }}>
        {/* good zone */}
        <div style={{ position: "absolute", left: "11%", width: "50%", top: 0, bottom: 0, borderRadius: 999, background: "rgba(34,232,145,0.22)" }} />
        {/* cursor */}
        <div
          style={{
            position: "absolute",
            left: `${pos}%`,
            top: -3.5,
            bottom: -3.5,
            width: 3,
            borderRadius: 999,
            background: labelColor,
            boxShadow: `0 0 6px ${labelColor}90`,
            transform: "translateX(-50%)",
            transition: "left 0.9s cubic-bezier(.16,1,.3,1)",
          }}
        />
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 700, color: labelColor }}>{label}</span>
    </div>
  );
};

// ─── Ghost background glyphs ──────────────────────────────────────────────────
const BgGlyphs = ({ grade }) => {
  const mainGlyph = GRADE_GLYPH[grade.grade] ?? "⚡";
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, overflow: "hidden" }}
    >
      {/* primary grade glyph — dominant top right */}
      <div
        style={{
          position: "absolute",
          right: 30,
          top: 10,
          fontSize: 230,
          lineHeight: 1,
          color: "rgba(255,255,255,0.038)",
          fontWeight: 900,
          animation: "mmFloatA 9s ease-in-out infinite",
          userSelect: "none",
        }}
      >
        {mainGlyph}
      </div>
      {/* star / sparkle bottom left */}
      <div
        style={{
          position: "absolute",
          left: -20,
          bottom: -35,
          fontSize: 270,
          lineHeight: 1,
          color: "rgba(255,255,255,0.028)",
          animation: "mmFloatB 13s ease-in-out infinite",
          userSelect: "none",
        }}
      >
        ✦
      </div>
      {/* small chart mid-left */}
      <div
        style={{
          position: "absolute",
          left: 110,
          top: -8,
          fontSize: 88,
          lineHeight: 1,
          color: "rgba(255,255,255,0.022)",
          animation: "mmFloatB 11s ease-in-out infinite",
          animationDelay: "2s",
          userSelect: "none",
        }}
      >
        📈
      </div>
      {/* target bottom right area */}
      <div
        style={{
          position: "absolute",
          right: 170,
          bottom: -18,
          fontSize: 130,
          lineHeight: 1,
          color: "rgba(255,255,255,0.025)",
          animation: "mmFloatA 15s ease-in-out infinite",
          animationDelay: "3.5s",
          userSelect: "none",
        }}
      >
        🎯
      </div>
      {/* shield — very small, low right */}
      <div
        style={{
          position: "absolute",
          right: 65,
          bottom: 52,
          fontSize: 76,
          lineHeight: 1,
          color: "rgba(255,255,255,0.028)",
          userSelect: "none",
        }}
      >
        🛡
      </div>
    </div>
  );
};

// ─── Grade colour flash overlay ───────────────────────────────────────────────
const GradeFlash = ({ grade }) => {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), 1700); return () => clearTimeout(t); }, []);
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        background: `radial-gradient(ellipse at 50% 20%, ${grade.glow}44 0%, transparent 62%)`,
        opacity: on ? 1 : 0,
        transition: "opacity 1.4s cubic-bezier(.4,0,.2,1)",
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
};

// ─── Ghost button style ───────────────────────────────────────────────────────
// NOTE: use explicit longhand border properties, never shorthand `border`.
// Mixing `border` shorthand with `borderTop` / `borderLeft` on re-render
// triggers a React style-property conflict warning (installHook.js:1).
const ghostBtn = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.18)",
  borderRadius: 11,
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.75)",
  padding: "12px 18px",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  letterSpacing: "-0.1px",
  transition: "background 0.15s ease, transform 0.12s ease",
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export const ResultHeroV2 = ({
  result,
  navigate,
  onCopy,
  copied,
  onDownloadImage,
  downloading,
}) => {
  const {
    score,
    totalQuestions,
    answeredQuestions,
    skippedQuestions,
    strongAnswers,
    weakAnswers,
    averageTime,
    trendDelta,
    scoreHistory,
  } = result;

  const safeScore    = clamp(score);
  const grade        = getGrade(safeScore);
  const verdict      = getVerdict(safeScore);
  const hasTrend     = trendDelta != null && Array.isArray(scoreHistory) && scoreHistory.length >= 2;
  const displayScore = useCountUp(safeScore);

  // staggered reveal
  const [instrVisible,   setInstrVisible]   = useState(false);
  const [verdictVisible, setVerdictVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setInstrVisible(true),   830),
      setTimeout(() => setVerdictVisible(true), 1090),
      setTimeout(() => setActionsVisible(true), 1270),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const dateStr = new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toLowerCase();

  return (
    <section
      className="res-hero res-hero-v2"
      style={{
        position: "relative",
        overflow: "hidden",
        marginBottom: 20,
        borderRadius: 22,
        // exact dashboard gradient: deep navy → electric blue → cyan
        background: "linear-gradient(150deg, #0b1e55 0%, #0d2468 22%, #0a3daa 55%, #0ea0e8 100%)",
        boxShadow: "0 28px 72px rgba(4,14,50,0.65), 0 0 0 1px rgba(255,255,255,0.09)",
        fontFamily: F.body,
      }}
    >
      {/* dot grid */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.048) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ghost bg glyphs */}
      <BgGlyphs grade={grade} />

      {/* glow orbs */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", right: -80, bottom: -100,
          width: 480, height: 480, borderRadius: "50%",
          background: `radial-gradient(circle, ${grade.glow}22 0%, transparent 65%)`,
          pointerEvents: "none", zIndex: 0,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: -60, top: -80,
          width: 340, height: 340, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 65%)",
          pointerEvents: "none", zIndex: 0,
        }}
      />

      {/* grade flash */}
      <GradeFlash grade={grade} />

      {/* scan lines */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: 0, left: 0, width: "16%", height: "100%",
          background: "linear-gradient(90deg,transparent,rgba(255,255,255,.024),transparent)",
          animation: "mmHeroScan 11s linear infinite",
          pointerEvents: "none", zIndex: 2,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: 0, left: 0, width: "6%", height: "100%",
          background: "linear-gradient(90deg,transparent,rgba(255,255,255,.036),transparent)",
          animation: "mmHeroScan 18s linear infinite",
          animationDelay: "5.5s",
          pointerEvents: "none", zIndex: 2,
        }}
      />

      {/* ── HEADER BAR ── */}
      <div
        style={{
          position: "relative", zIndex: 3,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 26px",
          borderBottom: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* bolt icon box — mirrors dashboard top-left icon */}
          <div
            aria-hidden="true"
            style={{
              width: 26, height: 26,
              background: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "rgba(255,255,255,0.18)",
              borderRadius: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13,
            }}
          >
            ⚡
          </div>
          {/* live pulse dot */}
          <div
            aria-hidden="true"
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#34e891",
              animation: "mmLivePulse 2.4s ease-in-out infinite",
            }}
          />
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: "rgba(255,255,255,0.38)", letterSpacing: "0.45px" }}>
            post-interview debrief
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {hasTrend && <TrendBadge delta={trendDelta} />}
          <LiveBadge />
          <span style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.24)" }}>
            {dateStr}
          </span>
        </div>
      </div>

      {/* ── SCORE BLOCK ── */}
      <div
        style={{
          position: "relative", zIndex: 3,
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "32px 28px 20px",
          animation: "mmFadeUp 0.65s 0.06s cubic-bezier(.16,1,.3,1) both",
        }}
      >
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: "rgba(255,255,255,0.38)", letterSpacing: "0.5px", marginBottom: 10, textTransform: "uppercase" }}>
          session complete · interview readiness score
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              fontFamily: F.display,
              fontSize: 108,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-6px",
              // white gradient — legible on any bg colour
              background: "linear-gradient(175deg, #ffffff 20%, rgba(180,220,255,0.82) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: `drop-shadow(0 0 40px ${grade.glow}44)`,
              animation: "mmScoreIn 0.55s 0.1s cubic-bezier(.16,1,.3,1) both",
            }}
          >
            {displayScore}
          </span>
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 22,
              color: "rgba(255,255,255,0.24)",
              fontWeight: 400,
              marginBottom: 12,
            }}
          >
            /100
          </span>
        </div>

        <ScoreFillBar score={safeScore} grade={grade} />
      </div>

      {/* ── INSTRUMENT STRIP ── */}
      <div
        className="res-v2-instruments"
        style={{
          position: "relative", zIndex: 3,
          display: "flex",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.18)",
          animation: "mmFadeUp 0.5s 0.82s cubic-bezier(.16,1,.3,1) both",
        }}
      >
        <Instrument
          icon="📋"
          label="answered"
          value={`${answeredQuestions}/${totalQuestions}`}
          sub={skippedQuestions > 0 ? `(${skippedQuestions} skipped)` : null}
          color="rgba(255,255,255,0.9)"
          type="completion"
          extra={{ answered: answeredQuestions, total: totalQuestions }}
          index={0}
          visible={instrVisible}
        />
        <Instrument
          icon="💪"
          label="strong"
          value={strongAnswers}
          sub="scored 80+"
          color="#34e891"
          type="strong"
          extra={{ count: strongAnswers, total: answeredQuestions }}
          index={1}
          visible={instrVisible}
        />
        <Instrument
          icon="🔧"
          label="needs work"
          value={weakAnswers}
          sub="below 60"
          color={weakAnswers > 0 ? "#ff6b6b" : "rgba(255,255,255,0.3)"}
          type="tofix"
          extra={{ count: weakAnswers, total: answeredQuestions }}
          index={2}
          visible={instrVisible}
        />
        <Instrument
          icon="⏱"
          label="avg pace"
          value={averageTime > 0 ? formatTime(averageTime) : "—"}
          color={
            averageTime > 0 && averageTime <= 180 ? "#34e891" :
            averageTime > 240 ? "#ff6b6b" : C.amber
          }
          type="pace"
          extra={{ seconds: averageTime }}
          index={3}
          visible={instrVisible}
        />
      </div>

      {/* ── VERDICT + ACTIONS ── */}
      <div
        style={{
          position: "relative", zIndex: 3,
          padding: "22px 28px 26px",
          display: "flex", flexDirection: "column", gap: 20,
        }}
      >
        {/* grade emoji centred above verdict — large but light */}
        <div
          aria-hidden="true"
          style={{
            textAlign: "center",
            fontSize: 26,
            opacity: verdictVisible ? 1 : 0,
            transition: "opacity 0.4s ease 0.05s",
          }}
        >
          {GRADE_GLYPH[grade.grade]}
        </div>

        {/* verdict */}
        <p
          style={{
            margin: 0,
            fontFamily: F.display,
            fontSize: 21,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.4,
            letterSpacing: "-0.3px",
            textAlign: "center",
            maxWidth: 540,
            marginLeft: "auto",
            marginRight: "auto",
            opacity: verdictVisible ? 1 : 0,
            transform: verdictVisible ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(.16,1,.3,1)",
          }}
        >
          {verdict}
        </p>

        {/* actions */}
        <div
          className="res-hero-actions"
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
            opacity: actionsVisible ? 1 : 0,
            transform: actionsVisible ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.45s ease, transform 0.45s cubic-bezier(.16,1,.3,1)",
          }}
        >
          {/* primary — white pill, matches dashboard "New mock interview" */}
          <button
            onClick={() => navigate("/interview")}
            style={{
              borderWidth: 0,
              borderStyle: "solid",
              borderColor: "transparent",
              borderRadius: 11,
              cursor: "pointer",
              padding: "12px 22px",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: F.body,
              letterSpacing: "-0.1px",
              background: "#ffffff",
              color: "#0a2a80",
              boxShadow: "0 4px 22px rgba(255,255,255,0.22)",
              transition: "filter 0.15s ease, transform 0.12s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.06)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = ""; e.currentTarget.style.transform = ""; }}
            className="res-btn-primary"
          >
            ⚡ Start another interview
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            style={ghostBtn}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = ""; }}
            className="res-btn-ghost"
          >
            📊 Dashboard
          </button>

          <button
            onClick={onCopy}
            style={ghostBtn}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = ""; }}
            className="res-btn-ghost"
          >
            {copied ? "✓ Copied!" : "📋 Copy summary"}
          </button>

          <button
            onClick={onDownloadImage}
            disabled={downloading}
            style={{ ...ghostBtn, opacity: downloading ? 0.6 : 1 }}
            onMouseEnter={(e) => { if (!downloading) { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = ""; }}
            className="res-btn-ghost"
          >
            {downloading ? "⏳ Preparing…" : "⬇ Download image"}
          </button>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL CSS — paste into GlobalStyles or Result.css
// ═══════════════════════════════════════════════════════════════════════════
//
// @keyframes mmHeroScan  { 0%{transform:translateX(-120%)} 100%{transform:translateX(800%)} }
// @keyframes mmLivePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.65)} }
// @keyframes mmFloatA    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
// @keyframes mmFloatB    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
// @keyframes mmFlashOut  { 0%{opacity:1} 100%{opacity:0} }
// @keyframes mmScoreIn   { from{opacity:0;transform:scale(.82)} to{opacity:1;transform:scale(1)} }
// @keyframes mmFadeUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
//
// /* instrument strip — responsive grid on small screens */
// @media (max-width: 640px) {
//   .res-hero-v2 .res-v2-instruments {
//     display: grid !important;
//     grid-template-columns: 1fr 1fr !important;
//   }
//   .res-hero-v2 .rh-instrument {
//     border-left: none !important;
//     border-top: 1px solid rgba(255,255,255,0.07) !important;
//   }
//   .res-hero-v2 .rh-instrument:nth-child(even) {
//     border-left: 1px solid rgba(255,255,255,0.07) !important;
//   }
// }
// @media (max-width: 400px) {
//   .res-hero-v2 .res-v2-instruments {
//     grid-template-columns: 1fr !important;
//   }
//   .res-hero-v2 .rh-instrument:nth-child(even) {
//     border-left: none !important;
//   }
// }
//
// /* instrument hover */
// .rh-instrument:hover { background: rgba(255,255,255,0.04); }
//
// ═══════════════════════════════════════════════════════════════════════════
// GRADE GLYPH REFERENCE
// ═══════════════════════════════════════════════════════════════════════════
//   S (90+)  → 🏆  accent: violet
//   A (80+)  → ⚡  accent: green  (#22d370)
//   B (70+)  → 🎯  accent: blue   (#1a6fff)
//   C (60+)  → 🔧  accent: amber
//   D (0+)   → 📖  accent: red    (#ff6b6b)
// ═══════════════════════════════════════════════════════════════════════════