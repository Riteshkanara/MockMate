import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { C, F } from "../styles/token";
import ProBadge from "../components/pro/ProBadge";

const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const fmt = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};

const GRADE = [
  { min: 90, g: "S", desc: "Elite form",       accent: C.violet,  glow: C.violet  },
  { min: 80, g: "A", desc: "Strong",           accent: C.green,   glow: C.green   },
  { min: 70, g: "B", desc: "Solid form",       accent: C.blue500, glow: C.blue500 },
  { min: 60, g: "C", desc: "Developing",       accent: C.amber,   glow: C.amber   },
  { min:  0, g: "D", desc: "Needs practice",   accent: C.red,     glow: C.red     },
];
const grade = (s) => GRADE.find(g => s >= g.min) || GRADE[GRADE.length - 1];

const VERDICT = [
  { min: 80, text: "You are building reliable interview form." },
  { min: 60, text: "Strong foundation — keep sharpening the edges." },
  { min:  0, text: "This session exposed useful gaps. That's the work." },
];
const verdict = (s) => VERDICT.find(v => s >= v.min)?.text || VERDICT[VERDICT.length - 1].text;

const DECOR = [
  { emoji: "⚡", top: "8%",    left: "4%",   size: 24, rot: -12, dur: 6.0 },
  { emoji: "🎯", top: "14%",   right: "7%",  size: 28, rot:  10, dur: 6.45 },
  { emoji: "💻", top: "48%",   right: "18%", size: 23, rot:  -8, dur: 6.9  },
  { emoji: "🚀", bottom: "10%",right: "5%",  size: 29, rot:   8, dur: 7.35 },
  { emoji: "🔥", bottom: "9%", left: "34%",  size: 22, rot:  -8, dur: 7.8  },
];

// ─── score count-up ──────────────────────────────────────────────────────────
const useCount = (target, dur = 900, delay = 100) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const id = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min((now - t0) / dur, 1);
        setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [target, dur, delay]);
  return v;
};

// ─── animated ring ───────────────────────────────────────────────────────────
const ScoreRing = ({ score, g }) => {
  const [dash, setDash] = useState(0);
  const R = 96, CIRC = 2 * Math.PI * R; // circumference ≈ 603
  useEffect(() => { const t = setTimeout(() => setDash(CIRC * (1 - score / 100)), 280); return () => clearTimeout(t); }, [score, CIRC]);
  const display = useCount(score);

  return (
    <div style={{ position: "relative", width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {/* glow halo */}
      <div style={{ position: "absolute", inset: -16, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.20),transparent 68%)", filter: "blur(6px)", animation: "rrGlow 3.4s ease-in-out infinite" }} />
      <svg width={220} height={220} viewBox="0 0 220 220" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx={110} cy={110} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={9} />
        <circle cx={110} cy={110} r={R} fill="none" stroke="#fff" strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={dash}
          style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,.55))", transition: "stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)" }}
        />
      </svg>
      {/* center */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, position: "relative" }}>
        <span style={{
          fontFamily: F.display, fontSize: 72, fontWeight: 900, lineHeight: 1, letterSpacing: "-4px",
          background: "linear-gradient(175deg,#fff 20%,rgba(180,220,255,.82) 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          filter: "drop-shadow(0 0 24px rgba(255,255,255,.38))",
          animation: "rrCountIn .65s .1s cubic-bezier(.16,1,.3,1) both",
        }}>{display}</span>
        <span style={{ fontFamily: F.mono, fontSize: 14, color: "rgba(255,255,255,.28)", marginTop: 2 }}>/100</span>
        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px", borderRadius: 999, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.24)" }}>
          <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 900, color: "#fff" }}>{g.g}</span>
          <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "rgba(255,255,255,.88)" }}>{g.desc}</span>
        </div>
      </div>
    </div>
  );
};
ScoreRing.propTypes = { score: PropTypes.number.isRequired, g: PropTypes.object.isRequired };

// ─── metric card (dark glass, exact dashboard style) ─────────────────────────
const MetricCard = ({ label, icon, value, small, foot, valueColor = "#fff" }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ padding: "11px 12px", borderRadius: 12, background: hov ? "rgba(2,20,55,.28)" : "rgba(2,20,55,.19)", border: "1px solid rgba(255,255,255,.15)", backdropFilter: "blur(5px)", transition: "background .18s, transform .18s", transform: hov ? "translateY(-2px)" : "none" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: F.mono, fontSize: 11, letterSpacing: ".7px", color: "rgba(255,255,255,.5)" }}>
        <span>{label}</span><span>{icon}</span>
      </div>
      <div style={{ marginTop: 6, fontFamily: F.display, fontSize: 21, fontWeight: 900, color: valueColor, lineHeight: 1 }}>
        {value}{small && <span style={{ fontFamily: F.mono, fontSize: 11, color: "rgba(255,255,255,.35)", fontWeight: 400 }}>{small}</span>}
      </div>
      <div style={{ marginTop: 5, color: "rgba(255,255,255,.58)", fontFamily: F.mono, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{foot}</div>
    </div>
  );
};
MetricCard.propTypes = { label: PropTypes.string.isRequired, icon: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, small: PropTypes.string, foot: PropTypes.string, valueColor: PropTypes.string };

// ─── action buttons ───────────────────────────────────────────────────────────
const BtnWhite  = ({ children, onClick }) => { const [h, setH] = useState(false); return (<button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ padding: "11px 20px", borderRadius: 11, border: "none", cursor: "pointer", background: "#fff", color: "#0044C4", fontWeight: 800, fontSize: 13, fontFamily: F.body, boxShadow: h ? "0 8px 24px rgba(0,0,0,.24)" : "0 4px 18px rgba(0,0,0,.18)", transform: h ? "translateY(-2px)" : "none", transition: "all .15s ease" }}>{children}</button>); };
BtnWhite.propTypes = { children: PropTypes.node.isRequired, onClick: PropTypes.func };
const BtnGhost  = ({ children, onClick }) => { const [h, setH] = useState(false); return (<button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ padding: "11px 18px", borderRadius: 11, border: "1px solid rgba(255,255,255,.22)", cursor: "pointer", background: h ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.08)", color: "rgba(255,255,255,.8)", fontWeight: 700, fontSize: 13, fontFamily: F.body, transform: h ? "translateY(-2px)" : "none", transition: "all .15s ease" }}>{children}</button>); };
BtnGhost.propTypes = { children: PropTypes.node.isRequired, onClick: PropTypes.func };

// ═══ EXPORT ══════════════════════════════════════════════════════════════════
export const ResultHeroV2 = ({ result, navigate, onCopy, copied, onDownloadImage, downloading, downloadLocked = false }) => {
  const { score = 0, totalQuestions = 0, answeredQuestions = 0, skippedQuestions = 0,
          strongAnswers = 0, weakAnswers = 0, averageTime = 0, trendDelta = null } = result;

  const s  = clamp(score);
  const g  = grade(s);
  const vt = verdict(s);

  const paceColor = averageTime <= 0 ? "rgba(255,255,255,.9)" : averageTime <= 180 ? "#79F2B2" : averageTime <= 240 ? C.amber : "#ff6b6b";
  const paceLabel = averageTime <= 0 ? "—" : averageTime < 60 ? "fast" : averageTime <= 180 ? "good pace" : averageTime <= 240 ? "steady" : "slow";

  const metrics = [
    { label: "ANSWERED", icon: "✓", value: `${answeredQuestions}`, small: `/${totalQuestions}`, foot: skippedQuestions > 0 ? `${skippedQuestions} skipped` : "all answered" },
    { label: "STRONG",   icon: "★", value: strongAnswers, foot: "scored 80+", valueColor: strongAnswers > 0 ? "#79F2B2" : "#fff" },
    { label: "AVG TIME", icon: "◷", value: averageTime > 0 ? fmt(averageTime) : "—", foot: paceLabel, valueColor: paceColor },
    { label: "TREND",    icon: "↗", value: trendDelta != null ? `${trendDelta >= 0 ? "+" : ""}${trendDelta}` : "—", foot: "vs last session", valueColor: trendDelta != null && trendDelta >= 0 ? "#79F2B2" : "#ff6b6b" },
  ];

  return (
    <section style={{ position: "relative", overflow: "hidden", padding: "32px 36px 28px", marginBottom: 12, borderRadius: 22, background: "linear-gradient(135deg,#1A6EFF 0%,#0057E8 45%,#00ADE0 100%)", boxShadow: "0 16px 56px rgba(0,31,107,.28),0 0 0 1px rgba(255,255,255,.08)", animation: "rhFadeUp .5s .04s cubic-bezier(.16,1,.3,1) both" }} className="rh-hero">

      {/* dot grid */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: .38, pointerEvents: "none", backgroundImage: "radial-gradient(circle,rgba(255,255,255,.13) 1px,transparent 1px)", backgroundSize: "22px 22px", maskImage: "linear-gradient(to bottom,black,transparent 88%)", WebkitMaskImage: "linear-gradient(to bottom,black,transparent 88%)" }} />
      {/* scan line */}
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: "14%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,.028),transparent)", animation: "rhScan 10s linear infinite", pointerEvents: "none" }} />
      {/* glow orbs */}
      <div aria-hidden="true" style={{ position: "absolute", top: -130, right: -90, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,220,255,.26),transparent 70%)", pointerEvents: "none", animation: "rhFloat 9s ease-in-out infinite" }} />
      <div aria-hidden="true" style={{ position: "absolute", bottom: -150, left: "28%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.10),transparent 70%)", pointerEvents: "none", animation: "rhFloat 11s ease-in-out infinite reverse" }} />
      {/* emoji decor */}
      {DECOR.map((d, i) => (
        <span key={i} aria-hidden="true" style={{ position: "absolute", top: d.top, right: d.right, bottom: d.bottom, left: d.left, fontSize: d.size, lineHeight: 1, opacity: .13, pointerEvents: "none", animation: `rhEmoji ${d.dur}s ease-in-out ${i * 0.25}s infinite`, transform: `rotate(${d.rot}deg)` }}>{d.emoji}</span>
      ))}

      {/* header row */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, letterSpacing: "1.8px", color: "rgba(255,255,255,.85)", textTransform: "uppercase" }}>session complete · full stack track</span>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 999, background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.20)", fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "rgba(255,255,255,.74)", textTransform: "uppercase" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#79F2B2", boxShadow: "0 0 0 3px rgba(121,242,178,.14)", display: "inline-block", animation: "rhLive 2.2s ease-in-out infinite" }} />
          scored just now
        </div>
      </div>

      {/* score + right grid */}
      <div style={{ position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: "260px 1fr", gap: 40, alignItems: "center" }} className="rh-grid">
        <ScoreRing score={s} g={g} />

        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.25, letterSpacing: "-.6px", maxWidth: 520, animation: "rhFadeUp .6s .3s cubic-bezier(.16,1,.3,1) both" }}>{vt}</h1>
          <p style={{ margin: "13px 0 0", fontSize: 13.5, lineHeight: 1.75, color: "rgba(255,255,255,.85)", maxWidth: 520, animation: "rhFadeUp .6s .42s cubic-bezier(.16,1,.3,1) both" }}>
            {answeredQuestions}/{totalQuestions} questions answered
            {strongAnswers > 0 && ` · ${strongAnswers} strong`}
            {weakAnswers > 0 && ` · ${weakAnswers} need work`}
          </p>

          {/* metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginTop: 18, animation: "rhFadeUp .5s .55s cubic-bezier(.16,1,.3,1) both" }} className="rh-metrics">
            {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          {/* actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18, animation: "rhFadeUp .5s .68s cubic-bezier(.16,1,.3,1) both" }} className="rh-actions">
            <BtnWhite onClick={() => navigate("/interview")}>⚡ Start another interview</BtnWhite>
            <BtnGhost onClick={() => navigate("/dashboard")}>📊 Dashboard</BtnGhost>
            <BtnGhost onClick={onCopy}>{copied ? "✓ Copied!" : "📋 Copy summary"}</BtnGhost>
            <BtnGhost onClick={onDownloadImage} disabled={downloading}>
              {downloading ? "⏳ Preparing…" : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  ⬇ Download image{downloadLocked && <ProBadge variant="pro" />}
                </span>
              )}
            </BtnGhost>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rhFadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rhScan    { 0%{transform:translateX(-100%)} 100%{transform:translateX(900%)} }
        @keyframes rhFloat   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-14px,18px)} }
        @keyframes rhEmoji   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes rhLive    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.32;transform:scale(.7)} }
        @keyframes rrGlow    { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes rrCountIn { from{opacity:0;transform:scale(.86)} to{opacity:1;transform:scale(1)} }
        .rh-grid  { position:relative; z-index:2 }
        @media(max-width:900px){
          .rh-hero  { padding:24px 22px 22px!important }
          .rh-grid  { grid-template-columns:1fr!important; gap:24px!important; justify-items:center; text-align:center }
          .rh-grid h1,.rh-grid p { max-width:100%!important }
          .rh-metrics { grid-template-columns:repeat(2,1fr)!important }
          .rh-actions { justify-content:center }
        }
        @media(max-width:640px){
          .rh-hero  { padding:20px 16px 18px!important; border-radius:16px!important }
          .rh-metrics { grid-template-columns:repeat(2,1fr)!important; gap:6px!important }
          .rh-actions button { flex:1 1 auto }
        }
      `}</style>
    </section>
  );
};

ResultHeroV2.propTypes = {
  result:          PropTypes.object.isRequired,
  navigate:        PropTypes.func.isRequired,
  onCopy:          PropTypes.func.isRequired,
  copied:          PropTypes.bool.isRequired,
  onDownloadImage: PropTypes.func.isRequired,
  downloading:     PropTypes.bool.isRequired,
  downloadLocked:  PropTypes.bool,
};