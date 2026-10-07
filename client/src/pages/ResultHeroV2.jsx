import { useState, useEffect } from "react";
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
  const R = 96, CIRC = 2 * Math.PI * R; // circumference ≈ 603
  const [dash, setDash] = useState(CIRC); // start empty, then sweep to the score
  useEffect(() => { const t = setTimeout(() => setDash(CIRC * (1 - score / 100)), 280); return () => clearTimeout(t); }, [score, CIRC]);
  const display = useCount(score);

  return (
    <div style={{ position: "relative", width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {/* glow halo */}
      <div style={{ position: "absolute", inset: -16, borderRadius: "50%", background: "radial-gradient(circle closest-side,rgba(255,255,255,.22),transparent)", animation: "rrGlow 3.4s ease-in-out infinite" }} />
      <svg width={220} height={220} viewBox="0 0 220 220" style={{ position: "absolute", transform: "rotate(-90deg)", overflow: "visible" }}>
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
        <span style={{ fontFamily: F.mono, fontSize: 14, color: "rgba(255,255,255,.62)", marginTop: 2 }}>/100</span>
        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px", borderRadius: 999, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.24)" }}>
          <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 900, color: "#fff" }}>{g.g}</span>
          <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "rgba(255,255,255,.88)" }}>{g.desc}</span>
        </div>
      </div>
    </div>
  );
};
ScoreRing.propTypes = { score: PropTypes.number.isRequired, g: PropTypes.object.isRequired };

// ─── tiny inline icons (no emoji, matches the rest of the app) ───────────────
const ICONS = {
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  star:  <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8L12 3.5Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  trend: <><path d="M4 17 10 11l4 4 6-7" /><path d="M15 8h5v5" /></>,
  bolt:  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  grid:  <><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></>,
  copy:  <><rect x="8" y="8" width="12" height="12" rx="2.4" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  down:  <><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
  spin:  <path d="M12 3a9 9 0 1 0 9 9" />,
};
const Ico = ({ name, size = 15, spin = false }) => (
  <svg className={spin ? "rh-spin" : undefined} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>{ICONS[name]}</svg>
);
Ico.propTypes = { name: PropTypes.string.isRequired, size: PropTypes.number, spin: PropTypes.bool };

// ─── metric card ─────────────────────────────────────────────────────────────
const MetricCard = ({ label, icon, value, small, foot, valueColor = "#fff" }) => (
  <div className="rh-metric">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: ".8px", color: "rgba(255,255,255,.62)" }}>
      <span>{label}</span><Ico name={icon} size={13} />
    </div>
    <div style={{ marginTop: 8, fontFamily: F.display, fontSize: 24, fontWeight: 900, color: valueColor, lineHeight: 1, letterSpacing: "-.5px" }}>
      {value}{small && <span style={{ fontFamily: F.mono, fontSize: 12, color: "rgba(255,255,255,.5)", fontWeight: 500 }}>{small}</span>}
    </div>
    <div style={{ marginTop: 6, color: "rgba(255,255,255,.72)", fontFamily: F.body, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{foot}</div>
  </div>
);
MetricCard.propTypes = { label: PropTypes.string.isRequired, icon: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, small: PropTypes.string, foot: PropTypes.string, valueColor: PropTypes.string };

// ═══ EXPORT ══════════════════════════════════════════════════════════════════
export const ResultHeroV2 = ({ result, navigate, onCopy, copied, onDownloadImage, downloading, downloadLocked = false, sessionLabel = null, dateLabel = "", modeLabel = null }) => {
  const { score = 0, totalQuestions = 0, answeredQuestions = 0, skippedQuestions = 0,
          strongAnswers = 0, weakAnswers = 0, averageTime = 0, trendDelta = null } = result;

  const s  = clamp(score);
  const g  = grade(s);
  const vt = verdict(s);
  const NEUTRAL = "rgba(255,255,255,.92)";

  const paceColor = averageTime <= 0 ? NEUTRAL : averageTime <= 180 ? "#79F2B2" : averageTime <= 240 ? "#FCD34D" : "#FCA5A5";
  const paceLabel = averageTime <= 0 ? "no timing yet" : averageTime < 60 ? "fast" : averageTime <= 180 ? "good pace" : averageTime <= 240 ? "steady" : "slow";
  const trendColor = trendDelta == null ? NEUTRAL : trendDelta >= 0 ? "#79F2B2" : "#FCA5A5";
  const modeText = modeLabel ? String(modeLabel).replace(/[_-]/g, " ") : "";

  const metrics = [
    { label: "ANSWERED", icon: "check", value: `${answeredQuestions}`, small: `/${totalQuestions}`, foot: skippedQuestions > 0 ? `${skippedQuestions} skipped` : "all answered" },
    { label: "STRONG",   icon: "star",  value: strongAnswers, foot: "scored 80+", valueColor: strongAnswers > 0 ? "#79F2B2" : NEUTRAL },
    { label: "AVG TIME", icon: "clock", value: averageTime > 0 ? fmt(averageTime) : "—", foot: paceLabel, valueColor: paceColor },
    { label: "TREND",    icon: "trend", value: trendDelta != null ? `${trendDelta >= 0 ? "+" : ""}${trendDelta}` : "—", foot: trendDelta != null ? "vs last session" : "first tracked session", valueColor: trendColor },
  ];

  return (
    <section className="rh-hero" aria-label="Session result">
      <div aria-hidden="true" className="rh-dots" />
      <div aria-hidden="true" className="rh-orb rh-orb-a" />
      <div aria-hidden="true" className="rh-orb rh-orb-b" />

      <div className="rh-top">
        <div className="rh-chips">
          <span className="rh-chip rh-chip-live"><span className="rh-live" />Session complete</span>
          {modeText && <span className="rh-chip" style={{ textTransform: "capitalize" }}>{modeText}</span>}
          {(sessionLabel || dateLabel) && <span className="rh-chip rh-chip-mono">{[sessionLabel && `#${sessionLabel}`, dateLabel].filter(Boolean).join(" · ")}</span>}
        </div>
      </div>

      <div className="rh-grid">
        <ScoreRing score={s} g={g} />

        <div style={{ minWidth: 0 }}>
          <h1 className="rh-title">{vt}</h1>
          <p className="rh-sub">
            {answeredQuestions}/{totalQuestions} questions answered
            {strongAnswers > 0 && ` · ${strongAnswers} strong`}
            {weakAnswers > 0 && ` · ${weakAnswers} need work`}
          </p>

          <div className="rh-metrics">
            {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          <div className="rh-actions">
            <button type="button" className="rh-btn rh-btn-primary" onClick={() => navigate("/interview")}><Ico name="bolt" />Start another interview</button>
            <div className="rh-secondary">
              <button type="button" className="rh-btn rh-btn-ghost" onClick={() => navigate("/dashboard")}><Ico name="grid" />Dashboard</button>
              <button type="button" className="rh-btn rh-btn-ghost" onClick={onCopy}><Ico name={copied ? "check" : "copy"} />{copied ? "Copied" : <><span className="rh-long">Copy summary</span><span className="rh-short">Copy</span></>}</button>
              <button type="button" className="rh-btn rh-btn-ghost" onClick={onDownloadImage} disabled={downloading}>
                <Ico name={downloading ? "spin" : "down"} spin={downloading} />{downloading ? "Preparing…" : "Image"}{downloadLocked && !downloading && <span className="rh-flag"><ProBadge variant="pro" /></span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rhFadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rhFloat   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-14px,18px)} }
        @keyframes rhLive    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.7)} }
        @keyframes rhSpin    { to{transform:rotate(360deg)} }
        @keyframes rrGlow    { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes rrCountIn { from{opacity:0;transform:scale(.86)} to{opacity:1;transform:scale(1)} }

        .rh-hero { position:relative; overflow:hidden; padding:26px 32px 28px; margin-bottom:12px; border-radius:24px;
          background:linear-gradient(135deg,#1A6EFF 0%,#0057E8 48%,#0093C4 100%);
          box-shadow:0 18px 56px rgba(0,31,107,.26),0 0 0 1px rgba(255,255,255,.08); animation:rhFadeUp .5s cubic-bezier(.16,1,.3,1) both; }
        .rh-dots { position:absolute; inset:0; opacity:.4; pointer-events:none; background-image:radial-gradient(circle,rgba(255,255,255,.14) 1px,transparent 1px); background-size:22px 22px;
          -webkit-mask-image:linear-gradient(to bottom,#000,transparent 85%); mask-image:linear-gradient(to bottom,#000,transparent 85%); }
        .rh-orb { position:absolute; border-radius:50%; pointer-events:none; }
        .rh-orb-a { top:-130px; right:-90px; width:360px; height:360px; background:radial-gradient(circle,rgba(0,220,255,.28),transparent 70%); animation:rhFloat 9s ease-in-out infinite; }
        .rh-orb-b { bottom:-150px; left:28%; width:320px; height:320px; background:radial-gradient(circle,rgba(255,255,255,.10),transparent 70%); animation:rhFloat 11s ease-in-out infinite reverse; }

        .rh-top { position:relative; z-index:2; margin-bottom:22px; }
        .rh-chips { display:flex; flex-wrap:wrap; gap:8px; }
        .rh-chip { display:inline-flex; align-items:center; gap:7px; height:28px; padding:0 12px; border-radius:999px; font-family:${F.body}; font-size:12px; font-weight:700; color:rgba(255,255,255,.92);
          background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.22); }
        .rh-chip-mono { font-family:${F.mono}; font-size:11px; font-weight:600; color:rgba(255,255,255,.8); }
        .rh-live { width:7px; height:7px; border-radius:50%; background:#79F2B2; box-shadow:0 0 0 3px rgba(121,242,178,.2); animation:rhLive 2.2s ease-in-out infinite; }

        .rh-grid { position:relative; z-index:2; display:grid; grid-template-columns:240px 1fr; gap:36px; align-items:center; }
        .rh-title { margin:0; font-family:${F.display}; font-size:28px; font-weight:900; color:#fff; line-height:1.2; letter-spacing:-.7px; max-width:540px; animation:rhFadeUp .6s .2s cubic-bezier(.16,1,.3,1) both; }
        .rh-sub { margin:10px 0 0; font-size:14px; line-height:1.6; color:rgba(255,255,255,.88); animation:rhFadeUp .6s .3s cubic-bezier(.16,1,.3,1) both; }

        .rh-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:20px; animation:rhFadeUp .5s .4s cubic-bezier(.16,1,.3,1) both; }
        .rh-metric { padding:12px 13px; border-radius:14px; background:rgba(3,22,70,.26); border:1px solid rgba(255,255,255,.18); transition:transform .18s ease, background .18s ease; }
        .rh-metric:hover { transform:translateY(-2px); background:rgba(3,22,70,.34); }

        .rh-actions { display:flex; flex-direction:column; gap:10px; margin-top:20px; animation:rhFadeUp .5s .5s cubic-bezier(.16,1,.3,1) both; }
        .rh-secondary { display:flex; flex-wrap:wrap; gap:8px; }
        .rh-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; padding:0 18px; border-radius:12px; border:none; cursor:pointer;
          font-family:${F.body}; font-size:13.5px; font-weight:800; white-space:nowrap; transition:transform .15s ease, box-shadow .15s ease, background .15s ease; }
        .rh-btn:disabled { opacity:.7; cursor:wait; }
        .rh-btn:focus-visible { outline:2.5px solid #fff; outline-offset:3px; }
        .rh-btn-primary { background:#fff; color:#0044C4; box-shadow:0 6px 20px rgba(0,20,80,.22); width:fit-content; }
        .rh-btn-primary:hover { transform:translateY(-2px); box-shadow:0 10px 26px rgba(0,20,80,.3); }
        .rh-long { display:inline; } .rh-short { display:none; }
        .rh-flag { position:absolute; top:-9px; right:8px; line-height:0; filter:drop-shadow(0 2px 4px rgba(0,20,80,.3)); }
        .rh-btn-ghost { position:relative; background:rgba(255,255,255,.12); color:#fff; border:1px solid rgba(255,255,255,.26); font-weight:700; }
        .rh-btn-ghost:hover:not(:disabled) { background:rgba(255,255,255,.2); transform:translateY(-1px); }
        .rh-spin { animation:rhSpin .9s linear infinite; }

        @media(max-width:900px){
          .rh-hero { padding:22px 20px 22px; }
          .rh-grid { grid-template-columns:1fr; gap:22px; justify-items:center; text-align:center; }
          .rh-title, .rh-sub { max-width:100%; }
          .rh-title { font-size:24px; }
          .rh-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); text-align:left; }
          .rh-actions { align-items:stretch; width:100%; }
          .rh-btn-primary { width:100%; }
          .rh-secondary { justify-content:center; }
        }
        @media(max-width:640px){
          .rh-hero { padding:18px 14px 16px; border-radius:20px; }
          .rh-top { margin-bottom:14px; }
          .rh-chips { justify-content:center; }
          .rh-chip { height:26px; padding:0 10px; font-size:11.5px; }
          .rh-title { font-size:21px; }
          .rh-sub { font-size:13px; }
          .rh-metrics { gap:8px; margin-top:16px; }
          .rh-metric { padding:11px 12px; }
          .rh-secondary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
          .rh-secondary .rh-btn { padding:0 6px; font-size:12.5px; gap:6px; }
          .rh-long { display:none; } .rh-short { display:inline; }
        }
        @media(prefers-reduced-motion:reduce){ .rh-hero,.rh-orb,.rh-live,.rh-title,.rh-sub,.rh-metrics,.rh-actions{ animation:none!important } }
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
  sessionLabel:    PropTypes.string,
  dateLabel:       PropTypes.string,
  modeLabel:       PropTypes.string,
};
