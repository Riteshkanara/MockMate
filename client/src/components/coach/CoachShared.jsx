// — Coach Shared — tokens, constants, helpers, and UI primitives
import { useState,useEffect,Component,useRef } from "react";
import PropTypes from "prop-types";
import { C as CT, F } from "../../styles/token";

export const C = {
  ...CT,
  dark0: "#080F1E",
  dark1: "#0A1628",
  dark2: "#0D1F3C",
  dark3: "#001A4A",
};

export { F };

export const COMPANIES = [
  { id: "tcs",       label: "TCS",           icon: "🏢", tier: "Service",     required: { technical: 55, problemSolving: 50, communication: 65, behavioral: 60, design: 25, fundamentals: 55 } },
  { id: "infosys",   label: "Infosys",       icon: "🏢", tier: "Service",     required: { technical: 52, problemSolving: 48, communication: 62, behavioral: 58, design: 22, fundamentals: 52 } },
  { id: "wipro",     label: "Wipro",         icon: "🏢", tier: "Service",     required: { technical: 52, problemSolving: 48, communication: 60, behavioral: 58, design: 22, fundamentals: 50 } },
  { id: "flipkart",  label: "Flipkart",      icon: "🛒", tier: "Mid Product", required: { technical: 75, problemSolving: 72, communication: 60, behavioral: 55, design: 58, fundamentals: 68 } },
  { id: "swiggy",    label: "Swiggy",        icon: "🍔", tier: "Mid Product", required: { technical: 72, problemSolving: 70, communication: 58, behavioral: 52, design: 52, fundamentals: 65 } },
  { id: "phonepe",   label: "PhonePe",       icon: "📱", tier: "Mid Product", required: { technical: 73, problemSolving: 71, communication: 60, behavioral: 54, design: 55, fundamentals: 66 } },
  { id: "amazon",    label: "Amazon",        icon: "📦", tier: "FAANG-adj",   required: { technical: 82, problemSolving: 85, communication: 68, behavioral: 70, design: 72, fundamentals: 75 } },
  { id: "google",    label: "Google",        icon: "🏆", tier: "FAANG-adj",   required: { technical: 88, problemSolving: 90, communication: 65, behavioral: 62, design: 78, fundamentals: 80 } },
  { id: "microsoft", label: "Microsoft",     icon: "🪟", tier: "FAANG-adj",   required: { technical: 83, problemSolving: 83, communication: 65, behavioral: 65, design: 70, fundamentals: 76 } },
  { id: "startup",   label: "Early Startup", icon: "⚡", tier: "Startup",     required: { technical: 68, problemSolving: 65, communication: 72, behavioral: 65, design: 45, fundamentals: 58 } },
];

export const DIM_META = [
  { key: "technical",      label: "Technical Depth", icon: "⚙",  weight: 0.28 },
  { key: "problemSolving", label: "Problem Solving", icon: "🔍", weight: 0.22 },
  { key: "communication",  label: "Communication",   icon: "💬", weight: 0.18 },
  { key: "behavioral",     label: "Behavioral",      icon: "🤝", weight: 0.12 },
  { key: "design",         label: "System Design",   icon: "🏗",  weight: 0.10 },
  { key: "fundamentals",   label: "CS Fundamentals", icon: "📚", weight: 0.10 },
];

export const TIER_META = {
  "₹3–6 LPA":   { color: "#7A8BAF", glow: "rgba(122,139,175,0.2)" },
  "₹6–12 LPA":  { color: C.amber,   glow: "rgba(217,119,6,0.2)"   },
  "₹12–20 LPA": { color: C.blue500, glow: "rgba(26,110,255,0.2)"  },
  "₹20 LPA+":   { color: C.cyan500, glow: "rgba(0,173,224,0.2)"   },
};

export const CACHE_PREFIX = "mm_coach_";
export const CACHE_TTL    = 30 * 60 * 1000;

export const buildCacheKeys = (userId) => {
  const uid = userId ?? "anon";
  return {
    today:   `${CACHE_PREFIX}today_${uid}_v1`,
    weekly:  `${CACHE_PREFIX}weekly_${uid}_v1`,
    debrief: `${CACHE_PREFIX}debrief_${uid}_v1`,
    company: (id) => `${CACHE_PREFIX}company_${id}_${uid}_v1`,
  };
};

export const readCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Date.now() - parsed.ts > CACHE_TTL ? null : parsed;
  } catch { return null; }
};

export const writeCache = (key, data) => {
  try { sessionStorage.setItem(key, JSON.stringify({ ...data, ts: Date.now() })); }
  catch { /* non-fatal */ }
};

export const purgeOtherUsersCache = (userId) => {
  try {
    const keep = `_${userId ?? "anon"}_v1`;
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX) && !key.endsWith(keep)) toRemove.push(key);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* non-fatal */ }
};

export const cacheAgeMinutes = (ts) => Math.round((Date.now() - ts) / 60000);

export const trendSlope = (vals) => {
  const n = vals.length;
  if (n < 2) return 0;
  const xm  = (n - 1) / 2;
  const ym  = vals.reduce((a, v) => a + v, 0) / n;
  const num = vals.reduce((a, v, i) => a + (i - xm) * (v - ym), 0);
  const den = vals.reduce((a, _, i) => a + (i - xm) ** 2, 0);
  return den ? num / den : 0;
};

export const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

// — Error Boundary
export class SectionErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error("[Coach section error]", err); }
  render() {
    if (!this.state.hasError) return this.props.children;
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
}
SectionErrorBoundary.propTypes = { children: PropTypes.node.isRequired };

// — Shared UI primitives
export const Spin = ({ size = 14 }) => (
  <span style={{ display: "inline-block", width: size, height: size, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "coachSpin 0.7s linear infinite", flexShrink: 0 }} />
);
Spin.propTypes = { size: PropTypes.number };

export const Eyebrow = ({ children, color = C.cyan400 }) => (
  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: "1.8px", color, marginBottom: 6, textTransform: "uppercase" }}>{children}</div>
);
Eyebrow.propTypes = { children: PropTypes.node.isRequired, color: PropTypes.string };

export const CacheTag = ({ ts }) => {
  const age = cacheAgeMinutes(ts);
  return (
    <span style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.28)", letterSpacing: "0.5px" }}>
      {age === 0 ? "JUST NOW" : `${age}m AGO`} · REFRESHES IN {Math.max(0, 30 - age)}m
    </span>
  );
};
CacheTag.propTypes = { ts: PropTypes.number.isRequired };

export const CacheTagLight = ({ ts }) => {
  const age = cacheAgeMinutes(ts);
  return (
    <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, letterSpacing: "0.5px" }}>
      {age === 0 ? "JUST NOW" : `${age}m AGO`} · REFRESHES IN {Math.max(0, 30 - age)}m
    </span>
  );
};
CacheTagLight.propTypes = { ts: PropTypes.number.isRequired };

export const DarkCard = ({ children, style = {}, accent = null }) => (
  <div style={{ background: `linear-gradient(145deg, ${C.dark2} 0%, ${C.dark1} 60%, ${C.dark0} 100%)`, border: `1px solid ${accent ? `${accent}30` : "rgba(0,200,240,0.13)"}`, borderRadius: 20, padding: 24, boxShadow: `0 16px 56px rgba(0,20,80,0.36)${accent ? `, 0 0 0 1px ${accent}18` : ""}`, ...style }}>{children}</div>
);
DarkCard.propTypes = { children: PropTypes.node.isRequired, style: PropTypes.object, accent: PropTypes.string };

export const LightCard = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, boxShadow: C.shadow, ...style }}>{children}</div>
);
LightCard.propTypes = { children: PropTypes.node.isRequired, style: PropTypes.object };

export const GenButton = ({ onClick, loading, done, dark = true, label = "Generate", doneLabel = "↺ Refresh" }) => {
  const spinEl = dark
    ? <Spin />
    : <span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.borderMd}`, borderTopColor: C.blue500, borderRadius: "50%", animation: "coachSpin 0.7s linear infinite" }} />;
  return (
    <button onClick={onClick} disabled={loading}
      style={{ border: dark ? "none" : `1px solid ${C.borderMd}`, borderRadius: 10, background: loading ? (dark ? "rgba(255,255,255,0.06)" : C.cardAlt) : dark ? `linear-gradient(135deg, ${C.cyan600}, ${C.blue600})` : C.blue500, color: loading ? (dark ? "#fff" : C.muted) : "#fff", padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: F.body, display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
      {loading ? <>{spinEl} Generating…</> : done ? doneLabel : `⚡ ${label}`}
    </button>
  );
};
GenButton.propTypes = {
  onClick:   PropTypes.func.isRequired,
  loading:   PropTypes.bool.isRequired,
  done:      PropTypes.bool.isRequired,
  dark:      PropTypes.bool,
  label:     PropTypes.string,
  doneLabel: PropTypes.string,
};

// — Text parsers
export const parseSections = (text, accentMap = {}) => {
  if (!text) return [];
  return text
    .split(/\n(?=[A-Z][A-Z ]{2,}\n)/)
    .filter(Boolean)
    .map((sec) => {
      const lines   = sec.trim().split("\n");
      const heading = lines[0].trim();
      const body    = lines.slice(1).join("\n").trim();
      return { heading, body, accent: accentMap[heading] || C.cyan400 };
    })
    .filter((s) => s.heading && s.body);
};

const DEBRIEF_HEADINGS = ["WHAT HAPPENED", "THE BRIGHT SPOT", "THE LESSON", "DO THIS NEXT"];

export const parseDebriefSections = (text, accentMap = {}) => {
  if (!text) return [];
  const lines  = text.split("\n");
  const result = [];
  let current  = null;
  for (const raw of lines) {
    const line    = raw.trim();
    const heading = DEBRIEF_HEADINGS.find((h) =>
      line.toUpperCase() === h ||
      line.toUpperCase().startsWith(h + ":") ||
      line.toUpperCase().startsWith(h + " —") ||
      line.toUpperCase().startsWith(h + " -")
    );
    if (heading) {
      if (current?.body.trim()) result.push(current);
      current = { heading, body: "", accent: accentMap[heading] || C.cyan400 };
    } else if (current && line) {
      current.body += (current.body ? " " : "") + line;
    }
  }
  if (current?.body.trim()) result.push(current);
  return result;
};

const DAY_HEADINGS = ["DAY 1-2", "DAY 3-4", "DAY 5-6", "DAY 7"];

export const parseWeeklySections = (text, accentMap = {}) => {
  if (!text) return [];
  const lines  = text.split("\n");
  const result = [];
  let current  = null;
  for (const raw of lines) {
    const line    = raw.trim();
    const heading = DAY_HEADINGS.find((h) => line.toUpperCase() === h || line.toUpperCase().startsWith(h + ":"));
    if (heading) {
      if (current?.body.trim()) result.push(current);
      current = { heading, body: "", accent: accentMap[heading] || C.cyan400 };
    } else if (current && line) {
      current.body += (current.body ? " " : "") + line;
    }
  }
  if (current?.body.trim()) result.push(current);
  return result;
};

// — HighlightedText
const DIM_NAMES = ["Technical Depth", "Problem Solving", "Communication", "Behavioral", "System Design", "CS Fundamentals", "IRS", "tier"];
const HIGHLIGHT_PATTERN = new RegExp(`(${DIM_NAMES.join("|")}|\\d{1,3}/100)`, "gi");

export const HighlightedText = ({ text, dark = true }) => {
  if (!text) return null;
  const parts = text.split(HIGHLIGHT_PATTERN);
  return (
    <>
      {parts.map((part, i) => {
        const isScore = /\d{1,3}\/100/.test(part);
        const isDim   = DIM_NAMES.some((d) => d.toLowerCase() === part.toLowerCase());
        if (isScore) return (
          <span key={i} style={{ fontFamily: F.mono, fontWeight: 800, fontSize: "0.95em", color: dark ? C.cyan400 : C.blue500, background: dark ? "rgba(0,200,240,0.12)" : "rgba(26,110,255,0.09)", border: `1px solid ${dark ? "rgba(0,200,240,0.22)" : "rgba(26,110,255,0.18)"}`, borderRadius: 6, padding: "1px 6px", letterSpacing: "0.2px", display: "inline-block", lineHeight: 1.5 }}>{part}</span>
        );
        if (isDim) return <span key={i} style={{ fontWeight: 700, color: dark ? "rgba(255,255,255,0.97)" : C.text }}>{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};
HighlightedText.propTypes = { text: PropTypes.string, dark: PropTypes.bool };

// — SentenceBreaker
export const SentenceBreaker = ({ text, dark = true, beats = null }) => {
  if (!text) return null;
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) || [text];
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
SentenceBreaker.propTypes = {
  text:  PropTypes.string,
  dark:  PropTypes.bool,
  beats: PropTypes.arrayOf(PropTypes.shape({ icon: PropTypes.string, label: PropTypes.string })),
};

// — AnimatedSection
export const AnimatedSection = ({ children, delay = 0, style = {} }) => {
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
AnimatedSection.propTypes = { children: PropTypes.node.isRequired, delay: PropTypes.number, style: PropTypes.object };

// — SectionDivider
export const SectionDivider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 0", opacity: 0.5 }}>
    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${C.border})` }} />
    {label && (
      <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.muted, letterSpacing: "1.6px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
    )}
    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.border}, transparent)` }} />
  </div>
);
SectionDivider.propTypes = { label: PropTypes.string };