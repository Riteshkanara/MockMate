import {
  useEffect, useState, useRef, useMemo, useCallback, memo, Component,
} from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import {
  getAIFreeform,
  getAnalytics,
  getLastSessionBreakdown,
  getBlindSpots,
} from "../Services/interviewService";
import PencilLoader from "../components/PencilLoader";
import { C as CT, F } from '../styles/token';

const C = {
  ...CT,
  dark0: "#080F1E",
  dark1: "#0A1628",
  dark2: "#0D1F3C",
  dark3: "#001A4A",
};

const COMPANIES = [
  { id: "tcs",       label: "TCS",          icon: "🏢", tier: "Service",     required: { technical: 55, problemSolving: 50, communication: 65, behavioral: 60, design: 25, fundamentals: 55 } },
  { id: "infosys",   label: "Infosys",      icon: "🏢", tier: "Service",     required: { technical: 52, problemSolving: 48, communication: 62, behavioral: 58, design: 22, fundamentals: 52 } },
  { id: "wipro",     label: "Wipro",        icon: "🏢", tier: "Service",     required: { technical: 52, problemSolving: 48, communication: 60, behavioral: 58, design: 22, fundamentals: 50 } },
  { id: "flipkart",  label: "Flipkart",     icon: "🛒", tier: "Mid Product", required: { technical: 75, problemSolving: 72, communication: 60, behavioral: 55, design: 58, fundamentals: 68 } },
  { id: "swiggy",    label: "Swiggy",       icon: "🍔", tier: "Mid Product", required: { technical: 72, problemSolving: 70, communication: 58, behavioral: 52, design: 52, fundamentals: 65 } },
  { id: "phonepe",   label: "PhonePe",      icon: "📱", tier: "Mid Product", required: { technical: 73, problemSolving: 71, communication: 60, behavioral: 54, design: 55, fundamentals: 66 } },
  { id: "amazon",    label: "Amazon",       icon: "📦", tier: "FAANG-adj",   required: { technical: 82, problemSolving: 85, communication: 68, behavioral: 70, design: 72, fundamentals: 75 } },
  { id: "google",    label: "Google",       icon: "🏆", tier: "FAANG-adj",   required: { technical: 88, problemSolving: 90, communication: 65, behavioral: 62, design: 78, fundamentals: 80 } },
  { id: "microsoft", label: "Microsoft",    icon: "🪟", tier: "FAANG-adj",   required: { technical: 83, problemSolving: 83, communication: 65, behavioral: 65, design: 70, fundamentals: 76 } },
  { id: "startup",   label: "Early Startup",icon: "⚡", tier: "Startup",     required: { technical: 68, problemSolving: 65, communication: 72, behavioral: 65, design: 45, fundamentals: 58 } },
];

const DIMENSION_META = [
  { key: "technical",      label: "Technical Depth", icon: "⚙",  weight: 0.28 },
  { key: "problemSolving", label: "Problem Solving", icon: "🔍", weight: 0.22 },
  { key: "communication",  label: "Communication",   icon: "💬", weight: 0.18 },
  { key: "behavioral",     label: "Behavioral",      icon: "🤝", weight: 0.12 },
  { key: "design",         label: "System Design",   icon: "🏗",  weight: 0.10 },
  { key: "fundamentals",   label: "CS Fundamentals", icon: "📚", weight: 0.10 },
];

const TIER_META = {
  "₹3–6 LPA":   { color: "#7A8BAF", glow: "rgba(122,139,175,0.2)" },
  "₹6–12 LPA":  { color: C.amber,   glow: "rgba(217,119,6,0.2)"   },
  "₹12–20 LPA": { color: C.blue500, glow: "rgba(26,110,255,0.2)"  },
  "₹20 LPA+":   { color: C.cyan500, glow: "rgba(0,173,224,0.2)"   },
};

const CACHE_PREFIX = "mm_coach_";
const CACHE_TTL = 30 * 60 * 1000;

const buildCacheKeys = (userId) => {
  const uid = userId ?? "anon";
  return {
    today:   `${CACHE_PREFIX}today_${uid}_v1`,
    weekly:  `${CACHE_PREFIX}weekly_${uid}_v1`,
    debrief: `${CACHE_PREFIX}debrief_${uid}_v1`,
    company: (companyId) => `${CACHE_PREFIX}company_${companyId}_${uid}_v1`,
  };
};

const readCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) return null;
    return parsed;
  } catch { return null; }
};

const writeCache = (key, data) => {
  try { sessionStorage.setItem(key, JSON.stringify({ ...data, ts: Date.now() })); }
  catch { /* non-fatal */ }
};

const purgeOtherUsersCoachCache = (userId) => {
  try {
    const uid = userId ?? "anon";
    const keep = `_${uid}_v1`;
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX) && !key.endsWith(keep)) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch { /* non-fatal */ }
};

const cacheAgeMinutes = (ts) => Math.round((Date.now() - ts) / 60000);

const trendSlope = (vals) => {
  const n = vals.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = vals.reduce((a, v) => a + v, 0) / n;
  const num = vals.reduce((a, v, i) => a + (i - xm) * (v - ym), 0);
  const den = vals.reduce((a, _, i) => a + (i - xm) ** 2, 0);
  return den ? num / den : 0;
};

const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

// ─── Error Boundary ───────────────────────────────────────────────────────────
class SectionErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error("[Coach section error]", err); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px 24px", borderRadius: 16, marginBottom: 18, background: C.redTint, border: `1px solid ${C.red}30`, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>This section ran into a problem</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
              The rest of the page is working fine.{" "}
              <button onClick={() => this.setState({ hasError: false })} style={{ color: C.blue500, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}>Try again</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────
const Spin = ({ size = 14 }) => (
  <span style={{ display: "inline-block", width: size, height: size, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "coachSpin 0.7s linear infinite", flexShrink: 0 }} />
);

const Eyebrow = ({ children, color = C.cyan400 }) => (
  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: "1.8px", color, marginBottom: 6, textTransform: "uppercase" }}>{children}</div>
);

const CacheTag = ({ ts }) => {
  const age = cacheAgeMinutes(ts);
  const remaining = Math.max(0, 30 - age);
  return (
    <span style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.28)", letterSpacing: "0.5px" }}>
      {age === 0 ? "JUST NOW" : `${age}m AGO`} · REFRESHES IN {remaining}m
    </span>
  );
};

const CacheTagLight = ({ ts }) => {
  const age = cacheAgeMinutes(ts);
  const remaining = Math.max(0, 30 - age);
  return (
    <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, letterSpacing: "0.5px" }}>
      {age === 0 ? "JUST NOW" : `${age}m AGO`} · REFRESHES IN {remaining}m
    </span>
  );
};

const DarkCard = ({ children, style = {}, accent = null }) => (
  <div style={{ background: `linear-gradient(145deg, ${C.dark2} 0%, ${C.dark1} 60%, ${C.dark0} 100%)`, border: `1px solid ${accent ? `${accent}30` : "rgba(0,200,240,0.13)"}`, borderRadius: 20, padding: 24, boxShadow: `0 16px 56px rgba(0,20,80,0.36)${accent ? `, 0 0 0 1px ${accent}18` : ""}`, ...style }}>{children}</div>
);

const LightCard = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, boxShadow: C.shadow, ...style }}>{children}</div>
);

const IdlePlaceholder = ({ icon, message, dark = false }) => (
  <div style={{
    padding: "32px 24px",
    textAlign: "center",
    border: `1.5px dashed ${dark ? "rgba(0,200,240,0.18)" : "rgba(0,0,0,0.10)"}`,
    borderRadius: 16,
    background: dark ? "transparent" : "rgba(26,110,255,0.02)",
  }}>
    <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.7 }}>{icon}</div>
    <p style={{ color: dark ? "rgba(255,255,255,0.38)" : C.sub, fontSize: 13.5, margin: 0, lineHeight: 1.65, fontFamily: F.body, fontWeight: 500, maxWidth: 320, marginInline: "auto" }}>{message}</p>
  </div>
);

const GenButton = ({ onClick, loading, done, dark = true, label = "Generate", doneLabel = "↺ Refresh" }) => {
  const spinEl = dark ? <Spin /> : (
    <span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.borderMd}`, borderTopColor: C.blue500, borderRadius: "50%", animation: "coachSpin 0.7s linear infinite" }} />
  );
  return (
    <button onClick={onClick} disabled={loading} aria-label={loading ? "Generating…" : done ? doneLabel : label}
      style={{ border: dark ? "none" : `1px solid ${C.borderMd}`, borderRadius: 10, background: loading ? (dark ? "rgba(255,255,255,0.06)" : C.cardAlt) : dark ? `linear-gradient(135deg, ${C.cyan600}, ${C.blue600})` : C.blue500, color: loading ? (dark ? "#fff" : C.muted) : "#fff", padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: F.body, display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
      {loading ? <>{spinEl} Generating…</> : done ? doneLabel : `⚡ ${label}`}
    </button>
  );
};

const parseSections = (text, accentMap = {}) => {
  if (!text) return [];
  return text
    .split(/\n(?=[A-Z][A-Z ]{2,}\n)/)
    .filter(Boolean)
    .map(sec => {
      const lines   = sec.trim().split("\n");
      const heading = lines[0].trim();
      const body    = lines.slice(1).join("\n").trim();
      return { heading, body, accent: accentMap[heading] || C.cyan400 };
    })
    .filter(s => s.heading && s.body);
};


// Dedicated debrief parser — handles the 4 fixed section headings robustly
const parseDebriefSections = (text, accentMap = {}) => {
  if (!text) return [];
  const HEADINGS = ["WHAT HAPPENED", "THE BRIGHT SPOT", "THE LESSON", "DO THIS NEXT"];
  const lines    = text.split("\n");
  const result   = [];
  let current    = null;

  for (const raw of lines) {
    const line    = raw.trim();
    const heading = HEADINGS.find(h =>
      line.toUpperCase() === h ||
      line.toUpperCase().startsWith(h + ":") ||
      line.toUpperCase().startsWith(h + " —") ||
      line.toUpperCase().startsWith(h + " -")
    );
    if (heading) {
      if (current && current.body.trim()) result.push(current);
      current = { heading, body: "", accent: accentMap[heading] || C.cyan400 };
    } else if (current && line) {
      current.body += (current.body ? " " : "") + line;
    }
  }
  if (current && current.body.trim()) result.push(current);
  return result;
};

// ─── HighlightedText — score chips get pill background ────────────────────────
const HighlightedText = ({ text, dark = true }) => {
  if (!text) return null;
  const dimNames = ["Technical Depth","Problem Solving","Communication","Behavioral","System Design","CS Fundamentals","IRS","tier"];
  const pattern = new RegExp(`(${dimNames.join("|")}|\\d{1,3}/100)`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        const isScore = /\d{1,3}\/100/.test(part);
        const isDim   = dimNames.some(d => d.toLowerCase() === part.toLowerCase());
        pattern.lastIndex = 0;
        if (isScore) {
          return (
            <span key={i} style={{ fontFamily: F.mono, fontWeight: 800, fontSize: "0.95em", color: dark ? C.cyan400 : C.blue500, background: dark ? "rgba(0,200,240,0.12)" : "rgba(26,110,255,0.09)", border: `1px solid ${dark ? "rgba(0,200,240,0.22)" : "rgba(26,110,255,0.18)"}`, borderRadius: 6, padding: "1px 6px", letterSpacing: "0.2px", display: "inline-block", lineHeight: 1.5 }}>
              {part}
            </span>
          );
        }
        if (isDim) {
          return <span key={i} style={{ fontWeight: 700, color: dark ? "rgba(255,255,255,0.97)" : C.text }}>{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

// ─── SentenceBreaker — beat labels 10px/800, body 15.5px/520 ─────────────────
const SentenceBreaker = ({ text, dark = true, beats = null, accent = null }) => {
  if (!text) return null;
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(Boolean) || [text];

  if (beats && beats.length >= sentences.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {sentences.map((sentence, i) => (
          <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: dark ? "rgba(0,200,240,0.13)" : "rgba(26,110,255,0.09)", border: `1.5px solid ${dark ? "rgba(0,200,240,0.30)" : "rgba(26,110,255,0.22)"}`, boxShadow: dark ? "0 0 10px rgba(0,200,240,0.12)" : "0 0 8px rgba(26,110,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginTop: 2 }}>
              {beats[i].icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: "1.4px", color: dark ? "rgba(0,200,240,0.85)" : C.blue500, marginBottom: 6, textTransform: "uppercase" }}>
                {beats[i].label}
              </div>
              <p style={{ margin: 0, fontSize: 15.5, fontWeight: 520, lineHeight: 1.78, color: dark ? "rgba(255,255,255,0.94)" : C.text, fontFamily: F.body, letterSpacing: "-0.15px" }}>
                <HighlightedText text={sentence} dark={dark} />
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sentences.map((sentence, i) => (
        <p key={i} style={{ margin: 0, fontSize: 15.5, fontWeight: 520, lineHeight: 1.78, color: dark ? "rgba(255,255,255,0.94)" : C.text, fontFamily: F.body, letterSpacing: "-0.15px" }}>
          <HighlightedText text={sentence} dark={dark} />
        </p>
      ))}
    </div>
  );
};

// ─── AnimatedSection ──────────────────────────────────────────────────────────
const AnimatedSection = ({ children, delay = 0, style = {} }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.08 }
    );
    const t = setTimeout(() => observer.observe(el), delay);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, [delay]);
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: `opacity 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms`, ...style }}>
      {children}
    </div>
  );
};

// ─── SectionDivider ───────────────────────────────────────────────────────────
const SectionDivider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 0", opacity: 0.5 }}>
    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${C.border})` }} />
    {label && (
      <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.muted, letterSpacing: "1.6px", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {label}
      </span>
    )}
    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.border}, transparent)` }} />
  </div>
);

// ─── Unique idle states ───────────────────────────────────────────────────────
const TodayIdlePlaceholder = () => (
  <div style={{ padding: "22px 22px", borderRadius: 16, border: "1.5px dashed rgba(0,200,240,0.18)", background: "rgba(0,200,240,0.03)" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {[
        { label: "TODAY'S PRIORITY", color: C.cyan400, w: [90, 70]      },
        { label: "WHY IT MATTERS",   color: C.blue400, w: [100, 80, 55] },
        { label: "HOW TO DO IT",     color: C.cyan500, w: [85, 65]      },
      ].map((beat, i) => (
        <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: `${beat.color}10`, border: `1.5px solid ${beat.color}25` }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 7, borderRadius: 4, background: `${beat.color}25`, width: "40%" }} />
            {beat.w.map((w, j) => (
              <div key={j} style={{ height: 9, borderRadius: 4, background: "rgba(255,255,255,0.07)", width: `${w}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
    <p style={{ textAlign: "center", margin: "20px 0 0", color: "rgba(255,255,255,0.35)", fontSize: 12.5, fontFamily: F.body, fontWeight: 500 }}>
      Hit <strong style={{ color: C.cyan400 }}>Get Today's Plan</strong> — coach reads your data and tells you exactly what to do.
    </p>
  </div>
);

const WeeklyIdlePlaceholder = () => (
  <div style={{ padding: "28px 20px", border: "1.5px dashed rgba(0,0,0,0.10)", borderRadius: 16, background: "rgba(26,110,255,0.02)" }}>
    <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: "1.2px", marginBottom: 14, textAlign: "center" }}>
      YOUR 7-DAY PLAN WILL APPEAR HERE
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {[
        { label: "DAY 1–2", color: C.red    },
        { label: "DAY 3–4", color: C.amber  },
        { label: "DAY 5–6", color: C.blue400},
        { label: "DAY 7",   color: C.green  },
      ].map((d, i) => (
        <div key={i} style={{ borderRadius: 12, border: `1.5px solid ${d.color}22`, borderTop: `3px solid ${d.color}44`, padding: "12px 10px", background: `${d.color}06`, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 800, color: `${d.color}99`, letterSpacing: "0.8px" }}>{d.label}</div>
          {[1, 2].map(j => (
            <div key={j} style={{ height: 8, borderRadius: 4, background: `${d.color}18`, width: j === 1 ? "100%" : "70%" }} />
          ))}
        </div>
      ))}
    </div>
    <p style={{ textAlign: "center", margin: "16px 0 0", color: C.sub, fontSize: 12.5, fontFamily: F.body, fontWeight: 500, lineHeight: 1.6 }}>
      Click <strong style={{ color: C.blue500 }}>Generate Plan</strong> — coach builds your personalized schedule from actual weak spots.
    </p>
  </div>
);

const DebriefIdlePlaceholder = () => {
  const sections = [
    { label: "WHAT HAPPENED",   color: C.blue400, lines: [100, 80, 65] },
    { label: "THE BRIGHT SPOT", color: C.green,   lines: [100, 70]     },
    { label: "THE LESSON",      color: C.amber,   lines: [100, 85, 55] },
    { label: "DO THIS NEXT",    color: C.cyan400, lines: [100, 60]     },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {sections.map((s, i) => (
          <div key={i} style={{ borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", opacity: 0.55 }}>
            <div style={{ height: 3, background: `${s.color}44` }} />
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${s.color}12`, border: `1px solid ${s.color}22` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 7, borderRadius: 4, background: `${s.color}30`, width: "70%", marginBottom: 4 }} />
                  <div style={{ height: 6, borderRadius: 4, background: C.border, width: "50%" }} />
                </div>
              </div>
              <div style={{ height: 1, background: C.border }} />
              {s.lines.map((w, j) => (
                <div key={j} style={{ height: 8, borderRadius: 4, background: C.border, width: `${w}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p style={{ textAlign: "center", margin: "4px 0 0", color: C.sub, fontSize: 12.5, fontFamily: F.body, fontWeight: 500 }}>
        Click <strong style={{ color: C.blue500 }}>Get Debrief</strong> — coach reviews your session question by question.
      </p>
    </div>
  );
};

const CompanyIdlePlaceholder = () => (
  <div style={{ padding: "32px 24px", border: "1.5px dashed rgba(0,200,240,0.18)", borderRadius: 16, background: "transparent", textAlign: "center" }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 16, opacity: 0.35 }}>
      {COMPANIES.map(c => (
        <div key={c.id} style={{ padding: "7px 13px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", fontSize: 12, fontWeight: 700, fontFamily: F.body, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 5 }}>
          {c.icon} {c.label}
        </div>
      ))}
    </div>
    <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, margin: 0, fontFamily: F.body, fontWeight: 500 }}>
      Select a company above to see how ready you are
    </p>
  </div>
);

// ─── CommandHeader ────────────────────────────────────────────────────────────
const CommandHeader = memo(({ irs, tier, totalSessions, lastScore, slope, navigate }) => {
  const tierMeta = TIER_META[tier] || TIER_META["₹3–6 LPA"];
  const slopePositive = slope >= 0;
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.dark0} 0%, ${C.blue900} 40%, #001A3A 70%, ${C.dark0} 100%)`, borderRadius: 24, padding: "28px 32px", border: "1px solid rgba(0,200,240,0.18)", boxShadow: "0 24px 72px rgba(0,20,80,0.55)", position: "relative", overflow: "hidden", marginBottom: 18 }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,240,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -40, left: 80, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,110,255,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.cyan400}>⚡ PLACEMENT COMMAND CENTER</Eyebrow>
          <h1 style={{ margin: "8px 0 6px", fontFamily: F.display, fontSize: "clamp(22px, 3.5vw, 34px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.5px" }}>
            Coach is watching your data.
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.52)", lineHeight: 1.65, maxWidth: 480, fontFamily: F.body }}>
            Your personal AI placement coach — not a dashboard, not a report. Everything here is live from your real session data.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          {[
            { label: "IRS SCORE",  val: `${irs}/100`,                                          color: scoreColor(irs)      },
            { label: "TIER",       val: tier,                                                   color: tierMeta.color       },
            { label: "SESSIONS",   val: totalSessions,                                          color: C.cyan400            },
            { label: "LAST SCORE", val: `${lastScore}/100`,                                     color: scoreColor(lastScore) },
            { label: "TREND",      val: `${slopePositive ? "+" : ""}${slope.toFixed(1)} /sess`, color: slopePositive ? C.green : C.orange },
          ].map((item, i) => (
            <div key={i} style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center", minWidth: 78 }}>
              <div style={{ fontFamily: F.mono, fontSize: 7.5, letterSpacing: "0.8px", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: item.color, whiteSpace: "nowrap" }}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "relative", marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => navigate("/interview")} aria-label="Start a new interview"
          style={{ border: "none", borderRadius: 12, background: `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})`, color: "#fff", padding: "11px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: F.body, boxShadow: "0 4px 18px rgba(0,173,224,0.35)", display: "flex", alignItems: "center", gap: 8 }}>
          🎯 Start Interview
        </button>
        <button onClick={() => navigate("/analytics")} aria-label="View full analytics"
          style={{ border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", padding: "11px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F.body }}>
          📊 Full Analytics
        </button>
      </div>
    </div>
  );
});

// ─── TodayCard ────────────────────────────────────────────────────────────────
const TODAY_BEATS = [
  { icon: "🎯", label: "TODAY'S PRIORITY" },
  { icon: "⚡", label: "WHY IT MATTERS"   },
  { icon: "📋", label: "HOW TO DO IT"     },
];

const TodayCard = memo(({ analyticsData, breakdownData, blindSpots, navigate, cacheKeys }) => {
  const [todayPlan, setTodayPlan] = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [cacheTs, setCacheTs]     = useState(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const cached = readCache(cacheKeys.today);
    if (cached) { setTodayPlan(cached.text); setDone(true); setCacheTs(cached.ts); }
    else { setTodayPlan(""); setDone(false); setCacheTs(null); }
  }, [cacheKeys.today]);

  const generate = useCallback(async () => {
    if (!analyticsData || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setDone(false); setTodayPlan(""); setCacheTs(null);
    const irs       = analyticsData.irs ?? 0;
    const tier      = analyticsData.currentTier ?? "₹3–6 LPA";
    const dims      = (analyticsData.dimensionProfile ?? [])
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 3).map(d => `${d.key}: ${d.score ?? 0}/100`).join(", ");
    const lastScore = breakdownData?.sessionScore ?? "unknown";
    const topBlind  = blindSpots?.[0]?.topic ?? "not identified yet";
    const skipRate  = breakdownData?.skipRate ?? 0;
    const avgTime   = breakdownData?.avgTimeTaken ?? 0;
    const prompt = `You are coach, MockMate's AI placement coach. A final-year CS student needs their single most important focus for TODAY based on real data.

Student data:
- IRS: ${irs}/100 | Tier: ${tier}
- Weakest dimensions: ${dims}
- Last session score: ${lastScore}/100
- Skip rate: ${skipRate}% | Avg time/q: ${avgTime}s
- Top blind spot: ${topBlind}

Write EXACTLY 3 sentences. Number them internally but output plain text only:

Sentence 1 — THE PRIORITY: Name the single most important action today. Must mention a specific dimension or topic by name. Start with "Your" or "Focus on" or the dimension name directly.

Sentence 2 — THE REASON: Why this specific thing matters RIGHT NOW. Must reference their actual IRS score or tier. No generic statements.

Sentence 3 — THE METHOD: Exactly how to do it. Name the mode (topic mode / full session / quick mode), a number (questions, minutes, or attempts), and one constraint (no skipping / timed / structured).

Rules: No headers, no labels, no markdown, no asterisks. Each sentence ends with a period. Total under 70 words. Sound like a WhatsApp message from a senior engineer who knows this student's data, not a chatbot.`;

    try {
      const text   = await getAIFreeform(prompt, 300);
      const result = text || "Focus on your weakest dimension with a dedicated topic session today.";
      const now    = Date.now();
      writeCache(cacheKeys.today, { text: result, ts: now });
      setTodayPlan(result); setCacheTs(now);
    } catch {
      setTodayPlan("Start with a topic-mode session on your weakest dimension. One focused hour beats three scattered ones. Do 15 questions, no skips.");
    } finally {
      setLoading(false); setDone(true); inFlight.current = false;
    }
  }, [analyticsData, breakdownData, blindSpots, cacheKeys.today]);

  const topWeakDim = useMemo(() => {
    const dims = analyticsData?.dimensionProfile ?? [];
    return [...dims].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  }, [analyticsData]);

  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <DarkCard accent={C.cyan400} style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Eyebrow color={C.cyan400}>📋 WHAT TO DO TODAY</Eyebrow>
            <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "2px 8px", letterSpacing: "0.4px" }}>
              {todayLabel}
            </span>
          </div>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: "#fff" }}>
            coach's orders for your next session
          </h2>
          {cacheTs && done && <div style={{ marginTop: 4 }}><CacheTag ts={cacheTs} /></div>}
        </div>
        <GenButton onClick={generate} loading={loading} done={done} label="Get Today's Plan" />
      </div>

      {!done && !loading && <TodayIdlePlaceholder />}

      {loading && (
        <div style={{ padding: "24px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <Spin size={16} />
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: F.mono }}>Analysing your session history…</span>
        </div>
      )}

      {done && todayPlan && (
        <div style={{ borderRadius: 16, background: "rgba(0,200,240,0.06)", border: "1px solid rgba(0,200,240,0.16)", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,200,240,0.06)" }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.cyan400}, ${C.blue500}44)` }} />
          <div style={{ padding: "22px 22px" }}>
            <SentenceBreaker text={todayPlan} dark={true} beats={TODAY_BEATS} accent={C.cyan400} />
          </div>
        </div>
      )}

      {topWeakDim && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: F.mono }}>TOP PRIORITY →</span>
          <div style={{ padding: "6px 14px", borderRadius: 8, background: `${scoreColor(topWeakDim.score ?? 0)}18`, border: `1px solid ${scoreColor(topWeakDim.score ?? 0)}35` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(topWeakDim.score ?? 0) }}>
              {topWeakDim.icon || "📚"} {topWeakDim.label || topWeakDim.key} — {topWeakDim.score ?? 0}/100
            </span>
          </div>
          <button onClick={() => navigate("/interview")} aria-label="Start a drill on your weakest dimension"
            style={{ border: "none", borderRadius: 8, background: `linear-gradient(135deg, ${C.blue500}, ${C.blue600})`, color: "#fff", padding: "7px 14px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body }}>
            Drill this now →
          </button>
        </div>
      )}
    </DarkCard>
  );
});

// ─── WeeklyPlan ───────────────────────────────────────────────────────────────
const parseWeeklySections = (text, accentMap = {}) => {
  if (!text) return [];
  const DAY_HEADINGS = ["DAY 1-2", "DAY 3-4", "DAY 5-6", "DAY 7"];
  const lines  = text.split("\n");
  const result = [];
  let current  = null;
  for (const raw of lines) {
    const line    = raw.trim();
    const heading = DAY_HEADINGS.find(h => line.toUpperCase() === h || line.toUpperCase().startsWith(h + ":"));
    if (heading) {
      if (current && current.body.trim()) result.push(current);
      current = { heading, body: "", accent: accentMap[heading] || C.cyan400 };
    } else if (current && line) {
      current.body += (current.body ? " " : "") + line;
    }
  }
  if (current && current.body.trim()) result.push(current);
  return result;
};

const DayCircle = ({ label, color }) => {
  const num = label.replace(/^DAY\s*/i, "").trim();
  return (
    <div style={{ width: 42, height: 42, borderRadius: "50%", background: `${color}18`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 12px ${color}22` }}>
      <span style={{ fontFamily: F.display, fontSize: num.length > 2 ? 10 : 13, fontWeight: 900, color, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {num}
      </span>
    </div>
  );
};

const WeeklyPlan = memo(({ analyticsData, navigate, cacheKeys }) => {
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [cacheTs, setCacheTs] = useState(null);
  const inFlight = useRef(false);

  const DAY_ACCENTS = useMemo(() => ({
    "DAY 1-2": C.red,
    "DAY 3-4": C.amber,
    "DAY 5-6": C.blue400,
    "DAY 7":   C.green,
  }), []);

  const DAY_CONFIG = {
    "DAY 1-2": { badge: "CRITICAL FOCUS",  badgeBg: `${C.red}18`,     badgeColor: C.red    },
    "DAY 3-4": { badge: "BUILD ON IT",     badgeBg: `${C.amber}18`,   badgeColor: C.amber  },
    "DAY 5-6": { badge: "CONSOLIDATE",     badgeBg: `${C.blue400}18`, badgeColor: C.blue400},
    "DAY 7":   { badge: "ASSESS & REVIEW", badgeBg: `${C.green}18`,   badgeColor: C.green  },
  };

  useEffect(() => {
    const cached = readCache(cacheKeys.weekly);
    if (cached?.plan) { setPlan(cached.plan); setDone(true); setCacheTs(cached.ts); }
    else { setPlan(null); setDone(false); setCacheTs(null); }
  }, [cacheKeys.weekly]);

  const generate = useCallback(async () => {
    if (!analyticsData || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setDone(false); setPlan(null); setCacheTs(null);
    const irs  = analyticsData.irs ?? 0;
    const tier = analyticsData.currentTier ?? "₹3–6 LPA";
    const dims = (analyticsData.dimensionProfile ?? [])
      .filter(d => d.hasData || d.score > 0)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .map(d => {
        const meta = DIMENSION_META.find(m => m.key === d.key);
        return `${meta?.label || d.key}: ${d.score ?? 0}/100 (weight ${Math.round((meta?.weight || 0.1) * 100)}%)`;
      }).join("\n");
    const totalSessions = analyticsData.totalSessions ?? 0;
    
const prompt = `You are coach, MockMate's AI placement coach for a final-year CS/IT student targeting campus placements in India.

STUDENT DATA:
- IRS: ${irs}/100 | Tier: ${tier} | Sessions completed: ${totalSessions}
- Dimension scores (weakest first, these are real scores not estimates):
${dims}

Create a 7-day preparation plan. Output MUST follow this exact format with each heading on its own line:

DAY 1-2
Two sentences. Name the specific dimension. Name the practice approach (topic mode, question count, difficulty level). Why this dimension first.

DAY 3-4
Two sentences. Name a different dimension. Specific technique or method. How it builds on DAY 1-2.

DAY 5-6
Two sentences. Third area OR deliberate mixed practice. What to focus on. How to measure if it worked.

DAY 7
One or two sentences. Full assessment session. What to look for in the results. What a good vs bad outcome means.

RULES (strictly enforced):
- Each day heading (DAY 1-2, DAY 3-4, DAY 5-6, DAY 7) must be alone on its own line with NO other text on that line
- No markdown, no asterisks, no bullet points, no numbering
- Mention real dimension names from the data above
- Every sentence must be actionable, not motivational
- Total word count: 130-170 words
- Write like a placement coach who has seen 200+ students, not like an AI`;
    try {
      const text = await getAIFreeform(prompt, 500);
      let sections = parseWeeklySections(text, DAY_ACCENTS);
      if (sections.length < 2) sections = parseSections(text, DAY_ACCENTS);
      const result = sections.length > 0 ? sections : [{ heading: "THIS WEEK", body: text, accent: C.cyan400 }];
      const now = Date.now();
      writeCache(cacheKeys.weekly, { plan: result, ts: now });
      setPlan(result); setCacheTs(now);
    } catch {
      setPlan([{ heading: "THIS WEEK", body: "Focus on your two weakest dimensions first — 2 sessions each. Save day 7 for a full mock.", accent: C.cyan400 }]);
    } finally {
      setLoading(false); setDone(true); inFlight.current = false;
    }
  }, [analyticsData, DAY_ACCENTS, cacheKeys.weekly]);

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.blue500}>📅 7-DAY FOCUS PLAN</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>
            coach's battle plan for this week
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: C.sub, lineHeight: 1.6 }}>Generated from your real dimension gaps — not a generic template.</p>
          {cacheTs && done && <div style={{ marginTop: 4 }}><CacheTagLight ts={cacheTs} /></div>}
        </div>
        <GenButton onClick={generate} loading={loading} done={done} dark={false} label="Generate Plan" />
      </div>

      {!done && !loading && <WeeklyIdlePlaceholder />}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["Scanning dimension gaps…", "Computing priority order…", "Drafting daily targets…", "Finalizing your schedule…"].map((msg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 9, background: C.blue50, border: `1px solid ${C.borderMd}` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.blue500, animation: `coachPulse 1.4s ease ${i * 0.2}s infinite`, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: C.sub, fontFamily: F.mono }}>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {done && plan && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {plan.map((section, i) => {
            const cfg = DAY_CONFIG[section.heading] || { badge: "FOCUS", badgeBg: `${C.blue500}18`, badgeColor: C.blue500 };
            return (
              <div key={i} className="coach-lift-card" style={{ borderRadius: 16, background: C.cardAlt, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}>
                <div style={{ height: 3, background: `linear-gradient(90deg, ${section.accent}, ${section.accent}33)`, flexShrink: 0 }} />
                <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <DayCircle label={section.heading} color={section.accent} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: section.accent, letterSpacing: "-0.3px", marginBottom: 4 }}>
                        {section.heading}
                      </div>
                      <span style={{ fontFamily: F.mono, fontSize: 7.5, fontWeight: 800, letterSpacing: "0.8px", padding: "2px 8px", borderRadius: 999, background: cfg.badgeBg, color: cfg.badgeColor, textTransform: "uppercase" }}>
                        {cfg.badge}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 1, background: `linear-gradient(90deg, ${section.accent}35, transparent)` }} />
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 520, lineHeight: 1.82, color: C.text, opacity: 0.82, fontFamily: F.body, letterSpacing: "-0.08px" }}>
                    <HighlightedText text={section.body} dark={false} />
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {done && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => navigate("/interview")} aria-label="Start Day 1 session"
            style={{ border: "none", borderRadius: 9, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "10px 20px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body }}>
            🎯 Start Day 1-2 session →
          </button>
        </div>
      )}
    </LightCard>
  );
});

// ─── ProgressTimeline ─────────────────────────────────────────────────────────
const ProgressTimeline = memo(({ scoreTrend }) => {
  const sessions = useMemo(() => (scoreTrend || []).slice(-10), [scoreTrend]);
  if (!sessions.length) return null;
  const scores   = sessions.map(s => s.score || 0);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const avgScore = Math.round(scores.reduce((a, v) => a + v, 0) / scores.length);

  const CIRCLE_W  = 80;
  const CX_OFFSET = 40;
  const CY        = 44;
  const SVG_H     = 88;
  const n         = sessions.length;
  const SVG_W     = n * CIRCLE_W;
  const cx        = (i) => CX_OFFSET + i * CIRCLE_W;

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <Eyebrow color={C.blue500}>📈 PROGRESS TIMELINE</Eyebrow>
      <h2 style={{ margin: "0 0 4px", fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>
        Your journey — last {sessions.length} sessions
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: C.sub }}>
        Each session is a data point. The story they tell together is your trajectory.
      </p>

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ position: "relative", minWidth: SVG_W, width: "100%" }}>
          <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }} aria-hidden="true">
            {sessions.map((s, i) => {
              if (i === 0) return null;
              const prev  = sessions[i - 1]?.score || 0;
              const curr  = s.score || 0;
              const up    = curr >= prev;
              return (
                <line key={i} x1={cx(i - 1)} y1={CY} x2={cx(i)} y2={CY} stroke={up ? C.green : C.orange} strokeWidth="2.5" strokeOpacity="0.55" strokeDasharray={up ? "none" : "5 3"} />
              );
            })}
          </svg>

          <div style={{ display: "flex", gap: 0 }} role="list" aria-label="Session score history">
            {sessions.map((s, i) => {
              const score    = s.score || 0;
              const col      = scoreColor(score);
              const isLast   = i === sessions.length - 1;
              const isBest   = score === maxScore && maxScore > 0;
              const date     = s.date ? new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : `S${i + 1}`;
              const delta    = i > 0 ? score - (sessions[i - 1]?.score || 0) : null;
              const deltaUp  = delta !== null && delta >= 0;
              return (
                <div key={i} role="listitem" aria-label={`Session ${i + 1}: score ${score}${isBest ? ", personal best" : ""}${isLast ? ", most recent" : ""}`}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", width: CIRCLE_W, position: "relative", zIndex: 1, paddingTop: 8 }}>
                  <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                    {isLast && <span style={{ padding: "2px 7px", borderRadius: 999, background: C.blue500, fontSize: 7.5, fontWeight: 800, fontFamily: F.mono, color: "#fff", letterSpacing: "0.5px" }}>LATEST</span>}
                    {isBest && !isLast && <span style={{ padding: "2px 7px", borderRadius: 999, background: `${C.amber}22`, border: `1px solid ${C.amber}`, fontSize: 7.5, fontWeight: 800, fontFamily: F.mono, color: C.amber, letterSpacing: "0.5px" }}>BEST</span>}
                  </div>
                  <div style={{ position: "relative", width: 44, height: 44 }}>
                    {isBest && (
                      <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${C.amber}`, boxShadow: `0 0 10px ${C.amber}55` }} />
                    )}
                    {isLast && !isBest && (
                      <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${C.blue500}`, boxShadow: `0 0 12px ${C.blue500}44`, animation: "coachPulseRing 2s ease infinite" }} />
                    )}
                    {isLast && isBest && (
                      <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${C.amber}`, boxShadow: `0 0 14px ${C.amber}66` }} />
                    )}
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${col}15`, border: `2.5px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isLast ? `0 0 16px ${col}40` : "none" }}>
                      <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 900, color: col, fontVariantNumeric: "tabular-nums" }}>{score}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontFamily: F.mono, fontSize: 9, color: C.muted, textAlign: "center" }}>{date}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 8, color: C.faint }}>#{i + 1 + Math.max(0, (scoreTrend || []).length - sessions.length)}</div>
                  {delta !== null && (
                    <div style={{ marginTop: 5, padding: "2px 7px", borderRadius: 999, background: deltaUp ? "rgba(5,150,105,0.12)" : "rgba(234,88,12,0.12)", border: `1px solid ${deltaUp ? C.green : C.orange}40`, fontSize: 9, fontWeight: 800, fontFamily: F.mono, color: deltaUp ? C.green : C.orange }}>
                      {deltaUp ? "+" : ""}{delta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 0, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.borderMd}` }}>
        {[
          { label: "Best",   val: maxScore,                   color: C.amber,   bg: `${C.amber}08`   },
          { label: "Lowest", val: minScore,                   color: C.orange,  bg: `${C.orange}08`  },
          { label: "Avg",    val: avgScore,                   color: C.blue500, bg: `${C.blue500}08` },
          { label: "Spread", val: `${maxScore - minScore} pts`, color: (maxScore - minScore) > 20 ? C.red : C.green, bg: (maxScore - minScore) > 20 ? `${C.red}08` : `${C.green}08` },
        ].map(({ label, val, color, bg }, idx, arr) => (
          <div key={label} style={{ flex: 1, padding: "14px 16px", background: bg, borderRight: idx < arr.length - 1 ? `1px solid ${C.borderMd}` : "none", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: "0.6px", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{val}</div>
          </div>
        ))}
      </div>
    </LightCard>
  );
});

// ─── DimensionHealth ──────────────────────────────────────────────────────────
const DimensionHealth = memo(({ analyticsData, navigate }) => {
  const dimProfile = useMemo(() => {
    const apiProfile = analyticsData?.dimensionProfile ?? [];
    return DIMENSION_META.map(meta => {
      const d = apiProfile.find(x => x.key === meta.key);
      return { ...meta, score: d?.score ?? 0, hasData: d?.hasData ?? false, answeredCount: d?.answeredCount ?? 0 };
    });
  }, [analyticsData]);

  const sorted = useMemo(() => [...dimProfile].sort((a, b) => {
    if (!a.hasData && b.hasData)  return 1;
    if (a.hasData  && !b.hasData) return -1;
    return a.score - b.score;
  }), [dimProfile]);

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.blue500}>🧪 DIMENSION HEALTH</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>All 6 dimensions at a glance</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: C.sub }}>Sorted weakest first — that's what matters.</p>
        </div>
        <button onClick={() => navigate("/interview")} aria-label="Start a drill on your weakest dimension"
          style={{ border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "9px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: F.body, boxShadow: "0 4px 14px rgba(26,110,255,0.25)" }}>
          Drill weakest →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {sorted.map((dim, i) => {
          const col       = dim.hasData ? scoreColor(dim.score) : C.faint;
          const isWeakest = i === 0 && dim.hasData;
          const noData    = !dim.hasData;
          const status    = noData ? null
            : dim.score >= 80 ? { label: "✓ Strong",      color: C.green,   bg: `${C.green}12`   }
            : dim.score >= 60 ? { label: "→ Developing",  color: C.blue500, bg: `${C.blue500}12` }
            :                   { label: "↑ Focus needed", color: C.orange,  bg: `${C.orange}12`  };

          if (noData) {
            return (
              <div key={dim.key} style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(0,0,0,0.02)", border: `1.5px dashed ${C.border}`, display: "flex", flexDirection: "column", gap: 10, opacity: 0.72 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18, opacity: 0.5 }} aria-hidden="true">{dim.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.sub }}>{dim.label}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>{Math.round(dim.weight * 100)}% IRS weight</div>
                    </div>
                  </div>
                  <span style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.faint, fontVariantNumeric: "tabular-nums" }}>—</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: C.border, border: `1px dashed ${C.borderMd}` }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>No practice data yet</span>
                  <button onClick={() => navigate("/interview")} style={{ border: `1px solid ${C.blue500}`, borderRadius: 7, background: `${C.blue500}10`, color: C.blue500, padding: "4px 10px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: F.body }}>
                    Start practicing →
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={dim.key} style={{ borderRadius: 16, background: isWeakest ? `${col}06` : C.cardAlt, border: `1.5px solid ${isWeakest ? col + "35" : C.border}`, overflow: "hidden", position: "relative" }}>
              {isWeakest && <div style={{ height: 3, background: `linear-gradient(90deg, ${col}, ${col}44)` }} />}
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }} aria-hidden="true">{dim.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{dim.label}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>{Math.round(dim.weight * 100)}% IRS weight</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color: col, fontVariantNumeric: "tabular-nums", lineHeight: 1 }} aria-label={`${dim.score} out of 100`}>
                      {dim.score}
                    </span>
                    <div style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, marginTop: 2 }}>/100</div>
                  </div>
                </div>
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <div style={{ height: 8, borderRadius: 999, background: C.border, overflow: "visible", position: "relative" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${dim.score}%`, borderRadius: 999, background: `linear-gradient(90deg, ${C.amber}cc, ${col})`, transition: "width 1.1s cubic-bezier(.16,1,.3,1)" }} />
                    <div style={{ position: "absolute", top: -4, left: "60%", width: 2, height: 16, background: C.blue500, borderRadius: 999, transform: "translateX(-50%)", opacity: 0.5 }} />
                  </div>
                  <div style={{ position: "absolute", top: 12, left: "60%", transform: "translateX(-50%)", fontFamily: F.mono, fontSize: 7.5, color: C.blue500, fontWeight: 700, whiteSpace: "nowrap", opacity: 0.7 }}>60</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  {status && (
                    <span style={{ padding: "3px 9px", borderRadius: 999, background: status.bg, color: status.color, fontSize: 10.5, fontWeight: 700, fontFamily: F.body }}>
                      {status.label}
                    </span>
                  )}
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginLeft: "auto" }}>{dim.answeredCount} Q answered</span>
                </div>
                {isWeakest && (
                  <div style={{ marginTop: 10, padding: "5px 10px", borderRadius: 8, background: `${col}12`, border: `1px solid ${col}30`, fontFamily: F.mono, fontSize: 8.5, fontWeight: 800, color: col, letterSpacing: "0.6px", textAlign: "center" }}>
                    ⚠ HIGHEST PRIORITY — drill this dimension first
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </LightCard>
  );
});

// ─── CompanyReadiness ─────────────────────────────────────────────────────────
const VERDICT_BEATS = [
  { icon: "🧭", label: "THE VERDICT"   },
  { icon: "🔧", label: "FIX THIS FIRST"},
];

const CompanyReadiness = memo(({ analyticsData, cacheKeys }) => {
  const [selected, setSelected] = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [cacheTs, setCacheTs]   = useState(null);
  const inFlight = useRef(false);
  const companyCacheKey = cacheKeys.company;

  const dimProfile = useMemo(() => {
    const apiProfile = analyticsData?.dimensionProfile ?? [];
    return DIMENSION_META.map(meta => {
      const d = apiProfile.find(x => x.key === meta.key);
      return { ...meta, score: d?.score ?? 0, hasData: d?.hasData ?? false };
    });
  }, [analyticsData]);

  const getReadiness = useCallback(async (company) => {
    if (inFlight.current) return;
    const cached = readCache(companyCacheKey(company.id));
    if (cached?.result) { setSelected(company); setResult(cached.result); setCacheTs(cached.ts); return; }
    inFlight.current = true;
    setSelected(company); setLoading(true); setResult(null); setCacheTs(null);
    const gaps = DIMENSION_META.map(meta => {
      const userScore = dimProfile.find(d => d.key === meta.key)?.score ?? 0;
      const required  = company.required[meta.key] ?? 0;
      return { label: meta.label, icon: meta.icon, userScore, required, gap: required - userScore };
    });
    const criticalGaps = gaps.filter(g => g.gap > 0).sort((a, b) => b.gap - a.gap);
    const overTarget   = gaps.filter(g => g.gap <= 0);
    const readinessPct = Math.round((gaps.reduce((acc, g) => acc + Math.min(1, g.userScore / Math.max(g.required, 1)), 0) / gaps.length) * 100);
    const prompt = `You are coach, MockMate's placement coach. Tell this student honestly whether they're ready for ${company.label} right now.

Student scores vs ${company.label} requirements:
${gaps.map(g => `${g.icon} ${g.label}: student ${g.userScore}/100, needed ${g.required}/100, gap ${g.gap > 0 ? "+" + g.gap + " short" : "✓ met"}`).join("\n")}

Overall readiness: ${readinessPct}%

Write 2 paragraphs:
Paragraph 1: Direct verdict — ready? Near-ready? Far? Reference the readiness % and 1-2 specific gaps.
Paragraph 2: The single most important thing to fix to become ready for ${company.label}, and how long it will realistically take.

No headers. No markdown. Direct mentor voice. Under 100 words.`;
    try {
      const text    = await getAIFreeform(prompt, 350);
      const payload = { gaps, criticalGaps, overTarget, readinessPct, verdict: text };
      const now     = Date.now();
      writeCache(companyCacheKey(company.id), { result: payload, ts: now });
      setResult(payload); setCacheTs(now);
    } catch {
      setResult({ gaps, criticalGaps, overTarget, readinessPct, verdict: null });
    } finally {
      setLoading(false); inFlight.current = false;
    }
  }, [dimProfile, companyCacheKey]);

  const verdictLevel = (pct) => {
    if (pct >= 85) return { label: "READY",      color: C.green,  bg: `${C.green}18`  };
    if (pct >= 65) return { label: "NEAR-READY", color: C.amber,  bg: `${C.amber}18`  };
    if (pct >= 45) return { label: "GAP EXISTS", color: C.orange, bg: `${C.orange}18` };
    return             { label: "NOT YET",    color: C.red,    bg: `${C.red}18`    };
  };

  return (
    <DarkCard style={{ marginBottom: 18 }}>
      <Eyebrow color={C.cyan400}>🎯 COMPANY READINESS CHECKER</Eyebrow>
      <h2 style={{ margin: "0 0 6px", fontFamily: F.display, fontSize: 18, fontWeight: 800, color: "#fff" }}>Am I ready for this company?</h2>
      <p style={{ margin: "0 0 18px", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
        Select a company — coach compares your real dimension scores against their benchmarks and gives you an honest verdict.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }} role="group" aria-label="Select a company">
        {COMPANIES.map(company => {
          const isSelected = selected?.id === company.id;
          const isCached   = !!readCache(companyCacheKey(company.id));
          return (
            <button key={company.id} onClick={() => getReadiness(company)} disabled={loading} aria-pressed={isSelected}
              className="coach-company-pill"
              style={{ border: `1.5px solid ${isSelected ? C.cyan400 : "rgba(255,255,255,0.14)"}`, borderRadius: 10, padding: "8px 14px", background: isSelected ? "rgba(0,200,240,0.15)" : "rgba(255,255,255,0.05)", color: isSelected ? C.cyan400 : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: F.body, transition: "all 0.18s cubic-bezier(.16,1,.3,1)", display: "flex", alignItems: "center", gap: 6, transform: isSelected ? "scale(1.05)" : "scale(1)", boxShadow: isSelected ? `0 0 0 1px ${C.cyan400}40, 0 4px 14px rgba(0,200,240,0.18)` : "none" }}>
              {company.icon} {company.label}
              {isCached && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, display: "inline-block" }} />}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0" }}>
          <Spin size={16} />
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: F.mono }}>Comparing your scores against {selected?.label} benchmarks…</span>
        </div>
      )}

      {result && !loading && (
        <>
          {cacheTs && <div style={{ marginBottom: 12 }}><CacheTag ts={cacheTs} /></div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="coach-two-col">
            <div>
              <div style={{ marginBottom: 14, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.8px", marginBottom: 4 }}>OVERALL READINESS</div>
                    <div style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, lineHeight: 1, color: result.readinessPct >= 80 ? C.green : result.readinessPct >= 60 ? C.amber : C.red, fontVariantNumeric: "tabular-nums" }}>
                      {result.readinessPct}%
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28 }}>{selected?.icon}</div>
                    <div style={{ marginTop: 6, padding: "3px 10px", borderRadius: 999, background: verdictLevel(result.readinessPct).bg, color: verdictLevel(result.readinessPct).color, fontFamily: F.mono, fontSize: 8, fontWeight: 800, letterSpacing: "0.8px" }}>
                      {verdictLevel(result.readinessPct).label}
                    </div>
                  </div>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                  <div style={{ height: "100%", width: `${result.readinessPct}%`, borderRadius: 999, transition: "width 1s ease", background: result.readinessPct >= 80 ? C.green : result.readinessPct >= 60 ? C.amber : C.red }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 10, fontFamily: F.mono, color: "rgba(255,255,255,0.3)" }}>for {selected?.label} ({selected?.tier})</div>
              </div>
              {result.gaps.map((g, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{g.icon} {g.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 999, fontFamily: F.mono, background: g.gap <= 0 ? "rgba(5,150,105,0.2)" : "rgba(220,38,38,0.2)", color: g.gap <= 0 ? C.green : C.red }}>
                      {g.gap <= 0 ? `✓ +${Math.abs(g.gap)}` : `-${g.gap}`}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", position: "relative" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${g.userScore}%`, background: scoreColor(g.userScore), borderRadius: 999, opacity: 0.85 }} />
                      <div style={{ position: "absolute", top: -2, left: `${g.required}%`, width: 2, height: 9, background: "rgba(255,255,255,0.5)", borderRadius: 999, transform: "translateX(-50%)" }} />
                    </div>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.3)", width: 48, textAlign: "right" }}>{g.userScore}/{g.required}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {result.verdict && (
                <div style={{ padding: "22px 22px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `4px solid ${C.cyan400}`, animation: "coachFadeUp 0.4s cubic-bezier(.16,1,.3,1) both" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cyan400, letterSpacing: "1.2px", marginBottom: 16, fontWeight: 800 }}>⚡ COACH'S VERDICT</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {(() => {
                      const paras    = result.verdict.split(/\n\n|\n(?=[A-Z])/).filter(Boolean);
                      const useBeats = VERDICT_BEATS.length >= paras.length;
                      return paras.map((para, pi) => {
                        const beat = useBeats ? VERDICT_BEATS[pi] : null;
                        return (
                          <div key={pi}>
                            {pi > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 16px" }} />}
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                              {beat && (
                                <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 9, background: "rgba(0,200,240,0.13)", border: "1.5px solid rgba(0,200,240,0.30)", boxShadow: "0 0 10px rgba(0,200,240,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, marginTop: 2 }}>
                                  {beat.icon}
                                </div>
                              )}
                              <div style={{ flex: 1 }}>
                                {beat && <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: "1.3px", color: "rgba(0,200,240,0.85)", marginBottom: 6, textTransform: "uppercase" }}>{beat.label}</div>}
                                <p style={{ margin: 0, fontSize: pi === 0 ? 15.5 : 14.5, fontWeight: pi === 0 ? 600 : 480, lineHeight: 1.8, color: pi === 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)", fontFamily: F.body, letterSpacing: "-0.15px" }}>
                                  <HighlightedText text={para} dark={true} />
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
              {result.criticalGaps.length > 0 && (
                <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.red, letterSpacing: "1px", marginBottom: 10 }}>🚨 GAPS TO CLOSE</div>
                  {result.criticalGaps.slice(0, 3).map((g, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: i < 2 ? 8 : 0, borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{g.icon} {g.label}</span>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>need +{g.gap} more points</div>
                      </div>
                      <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: C.red, flexShrink: 0 }}>{g.userScore} → {g.required}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.overTarget.length > 0 && (
                <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.18)" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.green, letterSpacing: "1px", marginBottom: 8 }}>✅ ALREADY MET</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.overTarget.map((g, i) => (
                      <span key={i} style={{ padding: "5px 11px", borderRadius: 999, background: "rgba(5,150,105,0.15)", color: C.green, fontSize: 11.5, fontWeight: 700 }}>{g.icon} {g.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selected && !loading && <CompanyIdlePlaceholder />}
    </DarkCard>
  );
});

// ─── CoachChat ────────────────────────────────────────────────────────────────
const CHAT_COOLDOWN_MS = 4000;

const CoachChat = memo(({ analyticsData, breakdownData, blindSpots, userId }) => {
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [cooldown,     setCooldown]     = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const chatEndRef    = useRef(null);
  const inputRef      = useRef(null);
  const lastSent      = useRef(0);
  const inFlight      = useRef(false);
  const greetingDone  = useRef(false);
  const shouldScroll  = useRef(false);
  const chatForUserId = useRef(userId);

  useEffect(() => {
    if (chatForUserId.current === userId) return;
    chatForUserId.current = userId;
    setMessages([]); setContextReady(false);
    greetingDone.current = false; shouldScroll.current = false; inFlight.current = false;
  }, [userId]);

  const coachContext = useMemo(() => {
    if (!analyticsData) return "";
    const irs   = analyticsData.irs ?? 0;
    const tier  = analyticsData.currentTier ?? "₹3–6 LPA";
    const total = analyticsData.totalSessions ?? 0;
    const dims  = (analyticsData.dimensionProfile ?? [])
      .filter(d => d.hasData || d.score > 0)
      .map(d => { const meta = DIMENSION_META.find(m => m.key === d.key); return `${meta?.label || d.key}: ${d.score ?? 0}/100`; }).join(", ");
    const lastScore = breakdownData?.sessionScore ?? "N/A";
    const topBlind  = blindSpots?.[0]?.topic ?? "none identified";
    return `Student context: IRS ${irs}/100, tier ${tier}, ${total} sessions done, last score ${lastScore}/100. Dimensions: ${dims}. Top blind spot: ${topBlind}.`;
  }, [analyticsData, breakdownData, blindSpots]);

  useEffect(() => {
    if (coachContext && !contextReady) {
      setMessages([{ role: "coach", text: `Hey — I've pulled your data. IRS ${analyticsData?.irs ?? 0}/100, ${analyticsData?.totalSessions ?? 0} sessions done, currently at ${analyticsData?.currentTier ?? "₹3–6 LPA"}. Ask me anything — where to focus, what companies are realistic, why your score is stuck, how to close a specific gap. I'll give you straight answers based on what I see in your numbers.`, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) }]);
      setContextReady(true); greetingDone.current = true;
    }
  }, [coachContext, contextReady, analyticsData]);

  useEffect(() => {
    if (!shouldScroll.current) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    shouldScroll.current = false;
  }, [messages]);

  const sendMessage = useCallback(async (textOverride) => {
    const text = (textOverride || input).trim();
    if (!text || loading || inFlight.current) return;
    const now = Date.now();
    if (now - lastSent.current < CHAT_COOLDOWN_MS) {
      setCooldown(true);
      setTimeout(() => setCooldown(false), CHAT_COOLDOWN_MS - (now - lastSent.current));
      return;
    }
    lastSent.current = now; inFlight.current = true;
    const userMsg = { role: "user", text, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) };
    shouldScroll.current = true;
    setMessages(prev => [...prev.slice(-19), userMsg]);
    setInput(""); setLoading(true);
    const history = messages.slice(-6).map(m => `${m.role === "coach" ? "coach" : "Student"}: ${m.text}`).join("\n");
    
const prompt = `You are coach — a placement coach at MockMate who has personally guided 200+ final-year CS/IT students through campus placements at Indian companies. You are direct, data-driven, and occasionally blunt. You do not hedge. You do not say "it depends" without immediately saying what it depends on and which direction it goes. You do not give generic advice.

STUDENT'S REAL DATA:
${coachContext}

CONVERSATION SO FAR:
${history}

STUDENT JUST ASKED: "${text}"

HOW TO RESPOND:
- Use their actual numbers (IRS, dimension scores, tier) in your answer
- If they ask about a company, reference their actual readiness gap for that company
- If they ask why something is happening, diagnose it from the data — name the specific dimension or pattern
- If they ask what to do, give one specific action with a mode, topic, and target number
- Maximum 3-4 sentences unless they explicitly ask for a detailed plan
- No "Great question!", no "I understand", no hedging phrases like "you might want to consider"
- Write like a WhatsApp message from a senior who has seen their exact situation before
- If the question is vague, give the most useful answer for their specific data profile and then ask one clarifying question at the end if needed
- Never start your response with "I" — start with the most important information`;
    try {
      const responseText = await getAIFreeform(prompt, 400);
      shouldScroll.current = true;
      setMessages(prev => [...prev, { role: "coach", text: responseText || "Let me check your data and get back to you on that.", time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) }]);
    } catch {
      shouldScroll.current = true;
      setMessages(prev => [...prev, { role: "coach", text: "Network issue — try again in a moment.", time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) }]);
    } finally {
      setLoading(false); inFlight.current = false;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, coachContext]);

  const quickPrompts = [
    { icon: "📊", text: "Why is my IRS stuck?"                  },
    { icon: "🎯", text: "Which company should I target first?"   },
    { icon: "🔍", text: "What's my biggest weakness right now?"  },
    { icon: "⏱",  text: "How long until I reach the next tier?" },
    { icon: "📋", text: "Full sessions or topic sessions?"       },
    { icon: "📈", text: "Am I improving fast enough?"            },
  ];

  const canSend       = !loading && !cooldown && input.trim();
  const charCount     = input.length;
  const charOverLimit = charCount > 280;

  return (
    <DarkCard style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.blue300}>💬 COACH — LIVE CHAT</Eyebrow>
          <h2 style={{ margin: "0 0 4px", fontFamily: F.display, fontSize: 18, fontWeight: 800, color: "#fff" }}>Ask anything about your placement journey</h2>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Coach knows your data. Direct answers — not generic advice.</p>
        </div>
        {cooldown && (
          <div style={{ padding: "6px 12px", borderRadius: 8, background: `${C.amber}18`, border: `1px solid ${C.amber}30`, fontFamily: F.mono, fontSize: 10, color: C.amber, fontWeight: 700 }}>⏳ Cooldown…</div>
        )}
      </div>

      <div role="log" aria-live="polite" aria-label="Coach conversation"
        style={{ height: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, padding: "16px 14px", marginBottom: 14, background: "rgba(0,0,0,0.22)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        {messages.map((msg, i) => {
          const isCoach = msg.role === "coach";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isCoach ? "flex-start" : "flex-end", gap: 0, animation: "coachFadeUp 0.3s ease both" }}>
              {isCoach && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.blue600}, ${C.cyan600})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,173,224,0.3)" }}>⚡</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}88` }} />
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.cyan400, fontWeight: 800, letterSpacing: "0.5px" }}>COACH</span>
                  </div>
                </div>
              )}
              <div style={{ maxWidth: "82%", padding: isCoach ? "14px 18px" : "11px 15px", borderRadius: isCoach ? "3px 14px 14px 14px" : "14px 3px 14px 14px", background: isCoach ? "rgba(255,255,255,0.07)" : `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, border: isCoach ? "1px solid rgba(255,255,255,0.09)" : "none", borderLeft: isCoach ? `3px solid ${C.cyan400}30` : undefined, boxShadow: isCoach ? "none" : "0 4px 14px rgba(26,110,255,0.3)" }}>
                <p style={{ margin: 0, fontSize: isCoach ? 15 : 14, fontWeight: isCoach ? 470 : 500, lineHeight: 1.82, color: isCoach ? "rgba(255,255,255,0.92)" : "#fff", fontFamily: F.body, letterSpacing: isCoach ? "-0.15px" : "0" }}>
                  {isCoach ? <HighlightedText text={msg.text} dark={true} /> : msg.text}
                </p>
                <div style={{ marginTop: 6, textAlign: isCoach ? "left" : "right", fontFamily: F.mono, fontSize: 8, color: isCoach ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.35)" }}>
                  {msg.time}
                </div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.blue600}, ${C.cyan600})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>⚡</div>
            <div style={{ padding: "12px 16px", borderRadius: "3px 14px 14px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `3px solid ${C.cyan400}30`, display: "flex", alignItems: "center", gap: 6 }}>
              {[0, 1, 2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: C.cyan400, opacity: 0.7, animation: `coachPulse 1.2s ease ${j * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
        {quickPrompts.map((p, i) => (
          <button key={i} onClick={() => sendMessage(p.text)} disabled={loading || cooldown} aria-label={`Quick prompt: ${p.text}`}
            className="coach-pill"
            style={{ border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)", padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: (loading || cooldown) ? "not-allowed" : "pointer", fontFamily: F.body, transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{p.icon}</span>
            <span style={{ lineHeight: 1.3 }}>{p.text}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask coach anything — IRS, companies, weak areas, study plan…"
            disabled={loading || cooldown} aria-label="Message to coach"
            style={{ width: "100%", padding: "13px 18px", paddingRight: charCount > 0 ? "52px" : "18px", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: `1px solid ${charOverLimit ? C.red + "60" : "rgba(255,255,255,0.14)"}`, color: "#fff", fontSize: 14, fontFamily: F.body, outline: "none", letterSpacing: "-0.1px", boxSizing: "border-box" }} />
          {charCount > 0 && (
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontFamily: F.mono, fontSize: 9, color: charOverLimit ? C.red : "rgba(255,255,255,0.25)", fontWeight: 700, pointerEvents: "none" }}>
              {charCount}
            </div>
          )}
        </div>
        <button onClick={() => sendMessage()} disabled={!canSend} aria-label="Send message"
          style={{ border: "none", borderRadius: 12, background: canSend ? `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})` : "rgba(255,255,255,0.07)", color: "#fff", padding: "13px 22px", fontSize: 13, fontWeight: 800, cursor: canSend ? "pointer" : "not-allowed", fontFamily: F.body, flexShrink: 0, display: "flex", alignItems: "center", gap: 7, boxShadow: canSend ? "0 4px 14px rgba(0,173,224,0.3)" : "none", transition: "all 0.2s" }}>
          {loading ? <Spin /> : "Send →"}
        </button>
      </div>
    </DarkCard>
  );
});

// ─── SessionDebrief ───────────────────────────────────────────────────────────
const SessionDebrief = memo(({ breakdownData, analyticsData, cacheKeys }) => {
  const [debrief, setDebrief]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [cacheTs, setCacheTs]   = useState(null);
  const inFlight = useRef(false);

  const DEBRIEF_ACCENTS = {
    "WHAT HAPPENED":   C.blue400,
    "THE BRIGHT SPOT": C.green,
    "THE LESSON":      C.amber,
    "DO THIS NEXT":    C.cyan400,
  };
  const SECTION_CONFIG = {
    "WHAT HAPPENED":   { icon: "📊", desc: "Session overview" },
    "THE BRIGHT SPOT": { icon: "✨", desc: "Your win"         },
    "THE LESSON":      { icon: "🎯", desc: "Key takeaway"     },
    "DO THIS NEXT":    { icon: "⚡", desc: "Next action"      },
  };

  useEffect(() => {
    const cached = readCache(cacheKeys.debrief);
    if (cached?.debrief) { setDebrief(cached.debrief); setDone(true); setCacheTs(cached.ts); }
    else { setDebrief(null); setDone(false); setCacheTs(null); }
  }, [cacheKeys.debrief]);

  const generate = useCallback(async () => {
    if (!breakdownData?.questions?.length || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setDone(false); setDebrief(null); setCacheTs(null);
    const { questions = [], sessionScore, avgTimeTaken, skipRate, sessionMode } = breakdownData;
    const answered  = questions.filter(q => !q.skipped);
    const perfect   = answered.filter(q => q.score >= 90).length;
    const struggled = answered.filter(q => q.score < 50);
    const irs       = analyticsData?.irs ?? 0;
    const qSummary  = answered.slice(0, 8).map(q => `Q${q.index}: ${q.topic || "unknown"} — ${q.score}/100 (${q.timeTaken}s)`).join("\n");
    const prompt = `You are coach, a placement coach reviewing a mock interview session for a final-year CS student. Analyze this like a coach watching game footage — specific, honest, no filler.

SESSION DATA:
- Score: ${sessionScore}/100 | Mode: ${sessionMode} | Student IRS: ${irs}/100
- Avg time per question: ${avgTimeTaken}s | Skip rate: ${skipRate}%
- Perfect answers (90+): ${perfect} out of ${answered.length} answered
- Questions below 50: ${struggled.length} — topics: ${struggled.map(q => q.topic || "unknown").join(", ") || "none identified"}
- Session score vs IRS: ${sessionScore > irs ? `+${sessionScore - irs} above IRS` : sessionScore < irs ? `${sessionScore - irs} below IRS` : "exactly at IRS"}

Per-question breakdown:
${qSummary}

Write a debrief using EXACTLY these four section headings, each on its own line:

WHAT HAPPENED
2-3 sentences. State the score. State whether it is above or below their IRS and by how much. Name the strongest and weakest topic from the data. No filler, no "great job".

THE BRIGHT SPOT
1-2 sentences. Name the specific question number or topic with the highest score. Reference the actual score number. What this tells you about the student's strength.

THE LESSON
2-3 sentences. The single most important pattern this session revealed. Name the specific topic or dimension. Be diagnostic — what caused the low score (speed, knowledge gap, skipping). What will happen if they ignore this.

DO THIS NEXT
1-2 sentences. Exact next action: name the mode (topic/full/quick), the specific topic or dimension, and a concrete target (number of questions, score to hit, or time constraint).

RULES:
- Each heading must be on its own line with nothing else on that line
- No markdown, no asterisks, no bullets
- Reference actual numbers from the data above
- Sound like a coach who watched every question, not like an AI summary
- Under 200 words total`;

    try {
      const text     = await getAIFreeform(prompt, 600);
      const sections = parseDebriefSections(text, DEBRIEF_ACCENTS);
      const result   = sections.length > 0 ? { sections } : { raw: text };
      const now      = Date.now();
      writeCache(cacheKeys.debrief, { debrief: result, ts: now });
      setDebrief(result); setCacheTs(now);
    } catch {
      setDebrief({ raw: "Could not generate debrief. Check your connection." });
    } finally {
      setLoading(false); setDone(true); inFlight.current = false;
    }
  }, [breakdownData, analyticsData, DEBRIEF_ACCENTS, cacheKeys.debrief]);

  if (!breakdownData?.questions?.length) return null;

  const { sessionScore, sessionDate, totalQuestions, sessionMode } = breakdownData;
  const dateStr    = sessionDate ? new Date(sessionDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "Last session";
  const questions  = breakdownData.questions || [];
  const allScores  = questions.filter(q => !q.skipped).map(q => q.score);
  const bestScore  = allScores.length ? Math.max(...allScores) : null;

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.blue500}>🎬 SESSION DEBRIEF</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>Coach's review of your last session</h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: C.sub }}>
            {dateStr} · {totalQuestions} questions · {sessionMode} mode · Score:{" "}
            <strong style={{ color: scoreColor(sessionScore), fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{sessionScore}/100</strong>
          </p>
          {cacheTs && done && <div style={{ marginTop: 4 }}><CacheTagLight ts={cacheTs} /></div>}
        </div>
        <button onClick={generate} disabled={loading} aria-label={done ? "Re-generate session debrief" : "Generate session debrief"}
          style={{ border: "none", borderRadius: 10, background: loading ? C.cardAlt : `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: loading ? C.muted : "#fff", padding: "10px 20px", fontSize: 12.5, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: F.body, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(26,110,255,0.25)" }}>
          {loading ? <><span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.border}`, borderTopColor: C.blue500, borderRadius: "50%", animation: "coachSpin 0.7s linear infinite" }} /> Reviewing…</> : done ? "↺ Re-debrief" : "🎬 Get Debrief"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 5, marginBottom: 20, flexWrap: "wrap" }} role="list" aria-label="Per-question scores">
        {questions.map((q, i) => {
          const isBestQ  = !q.skipped && q.score === bestScore && bestScore !== null;
          const isZero   = !q.skipped && q.score === 0;
          const chipSize = isBestQ ? 40 : 34;
          return (
            <div key={i} role="listitem" title={`Q${q.index}: ${q.topic || ""} — ${q.skipped ? "Skipped" : `${q.score}/100`}`} aria-label={`Question ${q.index}: ${q.skipped ? "skipped" : `${q.score} out of 100`}`}
              style={{ width: chipSize, height: chipSize, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: q.skipped ? C.cardAlt : `${scoreColor(q.score)}18`, border: isBestQ ? `2px solid ${C.amber}` : isZero ? `2px solid ${C.red}80` : `1.5px solid ${q.skipped ? C.border : scoreColor(q.score) + "40"}`, boxShadow: isBestQ ? `0 0 10px ${C.amber}44` : isZero ? `0 0 8px ${C.red}30` : "none", fontSize: isBestQ ? 12 : 11, fontWeight: 800, fontFamily: F.mono, color: q.skipped ? C.faint : scoreColor(q.score), cursor: "default", fontVariantNumeric: "tabular-nums", position: "relative" }}>
              {isBestQ && <div style={{ position: "absolute", top: -6, right: -4, fontSize: 9, lineHeight: 1 }}>⭐</div>}
              {q.skipped ? "—" : q.score}
            </div>
          );
        })}
      </div>

      {!done && !loading && <DebriefIdlePlaceholder />}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["Reading your per-question data…", "Identifying patterns…", "Writing your debrief…"].map((msg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 9, background: C.blue50, border: `1px solid ${C.borderMd}` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.blue500, animation: `coachPulse 1.4s ease ${i * 0.2}s infinite`, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: C.sub, fontFamily: F.mono }}>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {done && debrief && (
        debrief.sections ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            {debrief.sections.map((s, i) => {
              const cfg = SECTION_CONFIG[s.heading] || { icon: "•", desc: "" };
              return (
                <div key={i} className="coach-lift-card" style={{ borderRadius: 16, background: C.cardAlt, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}>
                  <div style={{ height: 3, background: `linear-gradient(90deg, ${s.accent}, ${s.accent}44)`, flexShrink: 0 }} />
                  <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: `${s.accent}14`, border: `1.5px solid ${s.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>
                        {cfg.icon}
                      </div>
                      <div style={{ flex: 1, paddingTop: 1 }}>
                        <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: "1.3px", color: s.accent, textTransform: "uppercase", marginBottom: 3 }}>{s.heading}</div>
                        <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 500, color: C.muted, letterSpacing: "0.1px" }}>{cfg.desc}</div>
                      </div>
                    </div>
                    <div style={{ height: 1, background: `linear-gradient(90deg, ${s.accent}30, transparent)` }} />
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 520, lineHeight: 1.82, color: C.text, opacity: 0.80, fontFamily: F.body, letterSpacing: "-0.08px" }}>
                      <HighlightedText text={s.body} dark={false} />
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 15, fontWeight: 520, color: C.sub, lineHeight: 1.82, fontFamily: F.body }}>{debrief.raw}</p>
        )
      )}
    </LightCard>
  );
});

// ─── Main Coach Page ──────────────────────────────────────────────────────────
const Coach = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?._id ?? user?.id ?? null;

  const [analyticsData,  setAnalyticsData]  = useState(null);
  const [breakdownData,  setBreakdownData]  = useState(null);
  const [blindSpotsData, setBlindSpotsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const fetchedForUserId = useRef(undefined);

  const cacheKeys = useMemo(() => buildCacheKeys(userId), [userId]);

  useEffect(() => { purgeOtherUsersCoachCache(userId); }, [userId]);

  useEffect(() => {
    if (fetchedForUserId.current === userId) return;
    fetchedForUserId.current = userId;
    setAnalyticsData(null); setBreakdownData(null); setBlindSpotsData(null);
    setError(""); setLoading(true);
    (async () => {
      try {
        const [analytics, breakdown, blindSpots] = await Promise.allSettled([getAnalytics(), getLastSessionBreakdown(), getBlindSpots()]);
        if (analytics.status === "fulfilled") setAnalyticsData(analytics.value);
        else throw new Error("Analytics failed to load");
        if (breakdown.status === "fulfilled") setBreakdownData(breakdown.value);
        if (blindSpots.status === "fulfilled") setBlindSpotsData(blindSpots.value?.blindSpots ?? []);
      } catch (err) {
        console.error("[Coach] Data load failed:", err);
        setError("Unable to load your coaching data. Check your connection and try again.");
      } finally { setLoading(false); }
    })();
  }, [userId]);

  const { irs, tier, totalSessions, scoreTrend, lastScore, slope } = useMemo(() => {
    const st = analyticsData?.scoreTrend ?? [];
    return {
      irs:           analyticsData?.irs ?? 0,
      tier:          analyticsData?.currentTier ?? "₹3–6 LPA",
      totalSessions: analyticsData?.totalSessions ?? 0,
      scoreTrend:    st,
      lastScore:     st.at(-1)?.score ?? 0,
      slope:         trendSlope(st.map(s => s.score || 0)),
    };
  }, [analyticsData]);

  if (loading) return (
    <div style={{ height: "calc(100vh - 100px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, gap: 20 }}>
      <PencilLoader />
      <p style={{ color: C.sub, fontSize: 13, fontFamily: "'Inter', sans-serif", margin: 0 }}>Loading your placement command center…</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: 32 }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>⚠️</div>
        <h2 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 10 }}>Something went wrong</h2>
        <p style={{ color: C.sub, marginBottom: 20 }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ border: "none", borderRadius: 12, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "12px 24px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body }}>Try Again</button>
      </div>
    </div>
  );

  if (!analyticsData || totalSessions === 0) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 540, padding: "56px 28px", background: C.card, borderRadius: 24, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>🧠</div>
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.blue500, letterSpacing: "1.6px", marginBottom: 10 }}>PLACEMENT COMMAND CENTER</div>
        <h1 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Complete your first interview to unlock Coach.</h1>
        <p style={{ color: C.sub, lineHeight: 1.7, fontSize: 13.5, marginBottom: 24 }}>Coach needs your session data to give personalized guidance. One interview gives him enough to start coaching you properly.</p>
        <button onClick={() => navigate("/interview")} style={{ border: "none", borderRadius: 13, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "14px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: F.body, boxShadow: "0 6px 22px rgba(26,110,255,0.30)" }}>🎯 Start First Interview →</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.08) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`, padding: "36px 28px 80px", fontFamily: F.body }}>
      <style>{`
        @keyframes coachSpin      { to { transform: rotate(360deg); } }
        @keyframes coachFadeUp    { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes coachPulse     { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes coachPulseRing { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.06); } }

        *, *::before, *::after { box-sizing: border-box; }

        .coach-page input::placeholder { color: rgba(255,255,255,0.3); }
        .coach-page input:focus {
          border-color: rgba(0,200,240,0.4) !important;
          outline: none;
          box-shadow: 0 0 0 2px rgba(0,200,240,0.1);
        }
        .coach-page button:focus-visible { outline: 2px solid ${C.cyan400}; outline-offset: 2px; }
        .coach-page button:hover:not(:disabled) { opacity: 0.92; }
        .coach-page button:active:not(:disabled) { transform: scale(0.98); }

        .coach-pill:hover:not(:disabled) {
          background: rgba(255,255,255,0.14) !important;
          border-color: rgba(0,200,240,0.45) !important;
          color: rgba(255,255,255,0.95) !important;
          opacity: 1 !important;
        }

        .coach-company-pill:hover:not(:disabled):not([aria-pressed="true"]) {
          transform: translateY(-1px) scale(1.02) !important;
          border-color: rgba(0,200,240,0.35) !important;
          color: rgba(255,255,255,0.88) !important;
          background: rgba(255,255,255,0.09) !important;
          opacity: 1 !important;
        }

        .coach-lift-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(0,20,80,0.18);
        }

        @media (max-width: 960px) { .coach-two-col { grid-template-columns: 1fr !important; } }
        @media (max-width: 680px) { .coach-page { padding: 18px 14px 60px !important; } }

        .coach-page ::-webkit-scrollbar { width: 4px; height: 4px; }
        .coach-page ::-webkit-scrollbar-track { background: transparent; }
        .coach-page ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        @media (prefers-reduced-motion: reduce) {
          .coach-page * { animation: none !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      <div className="coach-page" style={{ maxWidth: 1200, margin: "0 auto" }}>

        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <CommandHeader irs={irs} tier={tier} totalSessions={totalSessions} lastScore={lastScore} slope={slope} navigate={navigate} />
          </SectionErrorBoundary>
        </AnimatedSection>

        <AnimatedSection delay={80}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="coach-two-col">
            <SectionErrorBoundary><TodayCard analyticsData={analyticsData} breakdownData={breakdownData} blindSpots={blindSpotsData} navigate={navigate} cacheKeys={cacheKeys} /></SectionErrorBoundary>
            <SectionErrorBoundary><WeeklyPlan analyticsData={analyticsData} navigate={navigate} cacheKeys={cacheKeys} /></SectionErrorBoundary>
          </div>
        </AnimatedSection>

        <SectionDivider label="YOUR TRAJECTORY" />

        <AnimatedSection delay={0}>
          <SectionErrorBoundary><ProgressTimeline scoreTrend={scoreTrend} /></SectionErrorBoundary>
        </AnimatedSection>

        <SectionDivider label="DIMENSION BREAKDOWN" />

        <AnimatedSection delay={0}>
          <SectionErrorBoundary><DimensionHealth analyticsData={analyticsData} navigate={navigate} /></SectionErrorBoundary>
        </AnimatedSection>

        <SectionDivider label="COMPANY TARGETING" />

        <AnimatedSection delay={0}>
          <SectionErrorBoundary><CompanyReadiness analyticsData={analyticsData} cacheKeys={cacheKeys} /></SectionErrorBoundary>
        </AnimatedSection>

        <SectionDivider label="SESSION REVIEW" />

        <AnimatedSection delay={0}>
          <SectionErrorBoundary><SessionDebrief breakdownData={breakdownData} analyticsData={analyticsData} cacheKeys={cacheKeys} /></SectionErrorBoundary>
        </AnimatedSection>

        <SectionDivider label="ASK COACH" />

        <AnimatedSection delay={0}>
          <SectionErrorBoundary><CoachChat analyticsData={analyticsData} breakdownData={breakdownData} blindSpots={blindSpotsData} userId={userId} /></SectionErrorBoundary>
        </AnimatedSection>

        <AnimatedSection delay={0}>
          <div style={{ marginTop: 8, padding: "20px 24px", borderRadius: 18, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: "0.8px", marginBottom: 4 }}>QUICK NAVIGATION</div>
              <nav aria-label="Quick navigation" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "📊 Analytics",    path: "/analytics" },
                  { label: "🎤 New Interview", path: "/interview" },
                  { label: "📜 History",       path: "/history"   },
                  { label: "🏠 Dashboard",     path: "/dashboard" },
                ].map(({ label, path }) => (
                  <button key={path} onClick={() => navigate(path)}
                    style={{ border: `1px solid ${C.borderMd}`, borderRadius: 9, background: C.cardAlt, color: C.sub, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F.body, transition: "all 0.15s" }}>
                    {label}
                  </button>
                ))}
              </nav>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>IRS {irs}/100 · {tier} · {totalSessions} sessions</div>
              <div style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, marginTop: 2 }}>All analysis from your real session data</div>
            </div>
          </div>
        </AnimatedSection>

      </div>
    </div>
  );
};

export default Coach;