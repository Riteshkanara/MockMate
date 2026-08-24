import {
  useEffect, useState, useRef, useMemo, useCallback, memo, Component,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  getAIFreeform,
  getAnalytics,
  getLastSessionBreakdown,
  getBlindSpots,
} from "../Services/interviewService";
import PencilLoader from "../components/PencilLoader";

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE AI COACH — Placement Command Center
// Production patterns:
//   • All AI calls are user-triggered (no auto-fire on mount)
//   • sessionStorage cache on every AI section (30-min TTL)
//   • Request deduplication (in-flight ref guards)
//   • Rate limiting on CoachChat (1 message / 4 s)
//   • Error boundaries per section (one crash ≠ whole page down)
//   • Accessibility: aria-labels, role="log", keyboard nav
//   • React.memo on every section component
// ═══════════════════════════════════════════════════════════════════════════

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg:        "#F0F4FF",
  bgDeep:    "#E8EEFF",
  card:      "#FFFFFF",
  cardAlt:   "#F8FAFF",
  text:      "#0A1628",
  sub:       "#3D5280",
  muted:     "#7A8BAF",
  faint:     "#A8B8D4",
  border:    "#DDE5F7",
  borderMd:  "#B8CAF0",
  borderStr: "#7FA3E8",
  blue50:    "#EBF2FF",
  blue100:   "#C7DAFF",
  blue200:   "#9DBFFF",
  blue300:   "#6FA5FF",
  blue400:   "#4D8FFF",
  blue500:   "#1A6EFF",
  blue600:   "#0057E8",
  blue700:   "#0044C4",
  blue900:   "#001F6B",
  cyan400:   "#00C8F0",
  cyan500:   "#00ADE0",
  cyan600:   "#0093C4",
  cyanTint:  "#E6F9FF",
  green:     "#059669",
  greenTint: "#ECFDF5",
  amber:     "#D97706",
  amberTint: "#FFFBEB",
  orange:    "#EA580C",
  orangeTint:"#FFF7ED",
  red:       "#DC2626",
  redTint:   "#FEF2F2",
  shadow:    "0 1px 12px rgba(26,110,255,0.07)",
  shadowMd:  "0 6px 28px rgba(26,110,255,0.12)",
  shadowLg:  "0 16px 56px rgba(0,31,107,0.18)",
  dark0:     "#080F1E",
  dark1:     "#0A1628",
  dark2:     "#0D1F3C",
  dark3:     "#001A4A",
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

// ─── Company profiles ────────────────────────────────────────────────────────
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

// ─── Cache TTL ────────────────────────────────────────────────────────────────
const CACHE_TTL = 30 * 60 * 1000;
const CACHE_KEYS = {
  today:   "mm_coach_today_v1",
  weekly:  "mm_coach_weekly_v1",
  debrief: "mm_coach_debrief_v1",
};

// ─── Cache helpers ────────────────────────────────────────────────────────────
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

const cacheAgeMinutes = (ts) => Math.round((Date.now() - ts) / 60000);

// ─── Math helpers ─────────────────────────────────────────────────────────────
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
  <div style={{ padding: "28px", textAlign: "center", border: `1.5px dashed ${dark ? "rgba(0,200,240,0.18)" : C.border}`, borderRadius: 14 }}>
    <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
    <p style={{ color: dark ? "rgba(255,255,255,0.35)" : C.muted, fontSize: 13, margin: 0 }}>{message}</p>
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
      const lines = sec.trim().split("\n");
      const heading = lines[0].trim();
      const body = lines.slice(1).join("\n").trim();
      return { heading, body, accent: accentMap[heading] || C.cyan400 };
    })
    .filter(s => s.heading && s.body);
};

const DimBar = ({ dim, score, dark = false }) => {
  const col = scoreColor(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ width: 120, fontSize: 11, fontWeight: 600, color: dark ? "rgba(255,255,255,0.7)" : C.sub, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dim}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: dark ? "rgba(255,255,255,0.08)" : C.border }}>
        <div style={{ height: "100%", width: `${score}%`, background: col, borderRadius: 999, transition: "width 1s ease" }} />
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: col, width: 26, textAlign: "right", flexShrink: 0 }}>{score}</span>
    </div>
  );
};

// ─── IMPROVED: Highlight key terms in coach text ──────────────────────────────
// Wraps dimension names and score patterns in a bold span so they pop visually
const HighlightedText = ({ text, dark = true }) => {
  if (!text) return null;
  const dimNames = ["Technical Depth","Problem Solving","Communication","Behavioral","System Design","CS Fundamentals","IRS","tier"];
  const pattern = new RegExp(`(${dimNames.join("|")}|\\d{1,3}/100)`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        const isKeyword = pattern.test(part);
        pattern.lastIndex = 0; // reset stateful regex
        if (/\d{1,3}\/100/.test(part)) {
          return (
            <span key={i} style={{ fontFamily: F.mono, fontWeight: 800, fontSize: "1.05em", color: dark ? C.cyan400 : C.blue500, letterSpacing: "0.3px" }}>
              {part}
            </span>
          );
        }
        if (dimNames.some(d => d.toLowerCase() === part.toLowerCase())) {
          return (
            <span key={i} style={{ fontWeight: 700, color: dark ? "rgba(255,255,255,0.95)" : C.text }}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

// ─── IMPROVED: Split coach text into readable sentences ───────────────────────
const SentenceBreaker = ({ text, dark = true, beats = null }) => {
  if (!text) return null;
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(Boolean) || [text];

  if (beats && beats.length >= sentences.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sentences.map((sentence, i) => (
          <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8,
              background: dark ? "rgba(0,200,240,0.12)" : C.blue50,
              border: `1px solid ${dark ? "rgba(0,200,240,0.25)" : C.borderMd}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, marginTop: 1,
            }}>
              {beats[i].icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: "1.2px",
                color: dark ? "rgba(0,200,240,0.7)" : C.blue500,
                marginBottom: 5, textTransform: "uppercase",
              }}>
                {beats[i].label}
              </div>
              <p style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.75,
                color: dark ? "rgba(255,255,255,0.92)" : C.text,
                fontFamily: F.body,
                letterSpacing: "-0.1px",
              }}>
                <HighlightedText text={sentence} dark={dark} />
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: just rendered sentences without beats
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sentences.map((sentence, i) => (
        <p key={i} style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.75, color: dark ? "rgba(255,255,255,0.92)" : C.text, fontFamily: F.body }}>
          <HighlightedText text={sentence} dark={dark} />
        </p>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — COMMAND CENTER HEADER
// ═══════════════════════════════════════════════════════════════════════════
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
            { label: "IRS SCORE",  val: `${irs}/100`,                                         color: scoreColor(irs) },
            { label: "TIER",       val: tier,                                                  color: tierMeta.color },
            { label: "SESSIONS",   val: totalSessions,                                         color: C.cyan400 },
            { label: "LAST SCORE", val: `${lastScore}/100`,                                    color: scoreColor(lastScore) },
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

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — WHAT TO DO TODAY  [IMPROVED TEXT DISPLAY]
// ═══════════════════════════════════════════════════════════════════════════
const TODAY_BEATS = [
  { icon: "🎯", label: "TODAY'S PRIORITY" },
  { icon: "⚡", label: "WHY IT MATTERS"   },
  { icon: "📋", label: "HOW TO DO IT"     },
];

const TodayCard = memo(({ analyticsData, breakdownData, blindSpots, navigate }) => {
  const [todayPlan, setTodayPlan] = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [cacheTs, setCacheTs]     = useState(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const cached = readCache(CACHE_KEYS.today);
    if (cached) { setTodayPlan(cached.text); setDone(true); setCacheTs(cached.ts); }
  }, []);

  const generate = useCallback(async () => {
    if (!analyticsData || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setDone(false); setTodayPlan(""); setCacheTs(null);

    const irs       = analyticsData.irs ?? 0;
    const tier      = analyticsData.currentTier ?? "₹3–6 LPA";
    const dims      = (analyticsData.dimensionProfile ?? [])
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 3)
      .map(d => `${d.key}: ${d.score ?? 0}/100`)
      .join(", ");
    const lastScore = breakdownData?.sessionScore ?? "unknown";
    const topBlind  = blindSpots?.[0]?.topic ?? "not identified yet";
    const skipRate  = breakdownData?.skipRate ?? 0;
    const avgTime   = breakdownData?.avgTimeTaken ?? 0;

    const prompt = `You are coach, MockMate's placement coach. Give this student their single most important focus for TODAY.

Student data:
- IRS: ${irs}/100 | Tier: ${tier}
- Weakest dimensions: ${dims}
- Last session score: ${lastScore}/100
- Skip rate: ${skipRate}% | Avg time/q: ${avgTime}s
- Top blind spot: ${topBlind}

Write exactly 3 things:
1. ONE sentence — the single highest-priority action for today (name the specific topic/dimension)
2. ONE sentence — WHY this matters right now (connect to IRS or tier)
3. ONE sentence — exactly HOW to do it (specific mode, approach, target)

Plain text. No headers. No markdown. Speak directly to the student. Under 80 words. Coach texting a student, not a report.`;

    try {
      const text   = await getAIFreeform(prompt, 300);
      const result = text || "Focus on your weakest dimension with a dedicated topic session today.";
      const now    = Date.now();
      writeCache(CACHE_KEYS.today, { text: result, ts: now });
      setTodayPlan(result);
      setCacheTs(now);
    } catch {
      setTodayPlan("Start with a topic-mode session on your weakest dimension. One focused hour beats three scattered ones. Do 15 questions, no skips.");
    } finally {
      setLoading(false); setDone(true); inFlight.current = false;
    }
  }, [analyticsData, breakdownData, blindSpots]);

  const topWeakDim = useMemo(() => {
    const dims = analyticsData?.dimensionProfile ?? [];
    return [...dims].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  }, [analyticsData]);

  return (
    <DarkCard accent={C.cyan400} style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.cyan400}>📋 WHAT TO DO TODAY</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: "#fff" }}>
            coach's orders for your next session
          </h2>
          {cacheTs && done && <div style={{ marginTop: 4 }}><CacheTag ts={cacheTs} /></div>}
        </div>
        <GenButton onClick={generate} loading={loading} done={done} label="Get Today's Plan" />
      </div>

      {!done && !loading && (
        <IdlePlaceholder dark icon="📋" message="Hit Generate — coach will read your data and tell you exactly what to do today." />
      )}

      {loading && (
        <div style={{ padding: "20px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <Spin size={16} />
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: F.mono }}>Analysing your session history…</span>
        </div>
      )}

      {done && todayPlan && (
        /* ── IMPROVED: 3-beat layout instead of a flat paragraph ── */
        <div style={{
          padding: "22px 22px",
          borderRadius: 16,
          background: "rgba(0,200,240,0.05)",
          border: "1px solid rgba(0,200,240,0.14)",
          borderLeft: `3px solid ${C.cyan400}`,
        }}>
          <SentenceBreaker text={todayPlan} dark={true} beats={TODAY_BEATS} />
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

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — WEEKLY FOCUS PLAN  [IMPROVED DAY CARDS]
// ═══════════════════════════════════════════════════════════════════════════
const WeeklyPlan = memo(({ analyticsData, navigate }) => {
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
    "DAY 1-2": { icon: "🔴", badge: "CRITICAL FOCUS",  badgeBg: `${C.red}18`,    badgeColor: C.red    },
    "DAY 3-4": { icon: "🟠", badge: "BUILD ON IT",      badgeBg: `${C.amber}18`,  badgeColor: C.amber  },
    "DAY 5-6": { icon: "🔵", badge: "CONSOLIDATE",      badgeBg: `${C.blue400}18`,badgeColor: C.blue400},
    "DAY 7":   { icon: "🟢", badge: "ASSESS & REVIEW",  badgeBg: `${C.green}18`,  badgeColor: C.green  },
  };

  useEffect(() => {
    const cached = readCache(CACHE_KEYS.weekly);
    if (cached?.plan) { setPlan(cached.plan); setDone(true); setCacheTs(cached.ts); }
  }, []);

  const generate = useCallback(async () => {
    if (!analyticsData || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setDone(false); setPlan(null); setCacheTs(null);

    const irs    = analyticsData.irs ?? 0;
    const tier   = analyticsData.currentTier ?? "₹3–6 LPA";
    const dims   = (analyticsData.dimensionProfile ?? [])
      .filter(d => d.hasData || d.score > 0)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .map(d => {
        const meta = DIMENSION_META.find(m => m.key === d.key);
        return `${meta?.label || d.key}: ${d.score ?? 0}/100 (weight ${Math.round((meta?.weight || 0.1) * 100)}%)`;
      }).join("\n");
    const totalSessions = analyticsData.totalSessions ?? 0;

    const prompt = `You are coach, MockMate's placement coach. Create a precise 7-day weekly focus plan based on actual dimension scores.

STUDENT DATA:
- IRS: ${irs}/100 | Tier: ${tier} | Sessions done: ${totalSessions}
- Dimension scores (weakest first):
${dims}

Write a 7-day plan. Format EXACTLY like this:

DAY 1-2
[Specific topic/dimension to focus on, why this first, exact approach. Name the dimension. 2 sentences max.]

DAY 3-4
[Different focus area with specific technique. 2 sentences max.]

DAY 5-6
[Third area or mixed practice. 2 sentences max.]

DAY 7
[Review and assessment day. What to check. 1-2 sentences.]

Rules: No markdown, no asterisks. Mention specific dimension names. Sound like a coach writing a training plan. 120-160 words total.`;

    try {
      const text     = await getAIFreeform(prompt, 500);
      const sections = parseSections(text, DAY_ACCENTS);
      const result   = sections.length > 0
        ? sections
        : [{ heading: "THIS WEEK", body: text, accent: C.cyan400 }];
      const now = Date.now();
      writeCache(CACHE_KEYS.weekly, { plan: result, ts: now });
      setPlan(result); setCacheTs(now);
    } catch {
      setPlan([{ heading: "THIS WEEK", body: "Focus on your two weakest dimensions first — 2 sessions each. Save day 7 for a full mock.", accent: C.cyan400 }]);
    } finally {
      setLoading(false); setDone(true); inFlight.current = false;
    }
  }, [analyticsData, DAY_ACCENTS]);

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.blue500}>📅 7-DAY FOCUS PLAN</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>
            coach's battle plan for this week
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
            Generated from your real dimension gaps — not a generic template.
          </p>
          {cacheTs && done && <div style={{ marginTop: 4 }}><CacheTagLight ts={cacheTs} /></div>}
        </div>
        <GenButton onClick={generate} loading={loading} done={done} dark={false} label="Generate Plan" />
      </div>

      {!done && !loading && (
        <IdlePlaceholder icon="📅" message="Click Generate Plan — coach will build your personalized 7-day schedule from your actual weak spots." />
      )}

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
        /* ── IMPROVED: Bigger, more structured day cards ── */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {plan.map((section, i) => {
            const cfg = DAY_CONFIG[section.heading] || { icon: "📌", badge: "FOCUS", badgeBg: `${C.blue500}18`, badgeColor: C.blue500 };
            return (
              <div key={i} style={{
                padding: "18px 20px",
                borderRadius: 16,
                background: C.cardAlt,
                border: `1px solid ${C.border}`,
                borderLeft: `4px solid ${section.accent}`,
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                {/* Day header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{cfg.icon}</span>
                    <span style={{
                      fontFamily: F.display, fontSize: 16, fontWeight: 900,
                      color: section.accent, letterSpacing: "-0.3px",
                    }}>
                      {section.heading}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: F.mono, fontSize: 7.5, fontWeight: 800,
                    letterSpacing: "0.8px", padding: "3px 8px", borderRadius: 999,
                    background: cfg.badgeBg, color: cfg.badgeColor,
                    textTransform: "uppercase",
                  }}>
                    {cfg.badge}
                  </span>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: `linear-gradient(90deg, ${section.accent}40, transparent)` }} />

                {/* Body text — bigger, bolder */}
                <p style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: 1.8,
                  color: C.sub,
                  fontFamily: F.body,
                  letterSpacing: "-0.05px",
                }}>
                  <HighlightedText text={section.body} dark={false} />
                </p>
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

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — PROGRESS TIMELINE  (no AI — pure data render, unchanged)
// ═══════════════════════════════════════════════════════════════════════════
const ProgressTimeline = memo(({ scoreTrend }) => {
  const sessions = useMemo(() => (scoreTrend || []).slice(-10), [scoreTrend]);
  if (!sessions.length) return null;

  const scores   = sessions.map(s => s.score || 0);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const avgScore = Math.round(scores.reduce((a, v) => a + v, 0) / scores.length);

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <Eyebrow color={C.blue500}>📈 PROGRESS TIMELINE</Eyebrow>
      <h2 style={{ margin: "0 0 4px", fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>
        Your journey — last {sessions.length} sessions
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 12, color: C.sub }}>
        Each session is a data point. The story they tell together is your trajectory.
      </p>

      <div style={{ position: "relative", paddingBottom: 8 }}>
        <div style={{ position: "absolute", top: 24, left: 24, right: 24, height: 2, background: `linear-gradient(90deg, ${C.blue200}, ${C.cyan400})`, borderRadius: 999, zIndex: 0 }} />
        <div style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: 8 }} role="list" aria-label="Session score history">
          {sessions.map((s, i) => {
            const score  = s.score || 0;
            const col    = scoreColor(score);
            const isLast = i === sessions.length - 1;
            const isBest = score === maxScore;
            const date   = s.date ? new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : `S${i + 1}`;
            const delta  = i > 0 ? score - (sessions[i - 1]?.score || 0) : null;

            return (
              <div key={i} role="listitem"
                aria-label={`Session ${i + 1}: score ${score}${isBest ? ", personal best" : ""}${isLast ? ", most recent" : ""}`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", minWidth: 80, position: "relative", zIndex: 1 }}>
                {(isBest || isLast) ? (
                  <div style={{ marginBottom: 4, padding: "2px 7px", borderRadius: 999, background: isLast ? C.blue500 : `${C.amber}22`, border: `1px solid ${isLast ? C.blue500 : C.amber}`, fontSize: 8, fontWeight: 800, fontFamily: F.mono, color: isLast ? "#fff" : C.amber, whiteSpace: "nowrap" }}>
                    {isLast ? "LATEST" : "BEST"}
                  </div>
                ) : <div style={{ height: 22 }} />}
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: `${col}18`, border: `2.5px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isLast ? `0 0 16px ${col}50` : "none" }}>
                  <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 900, color: col }}>{score}</span>
                </div>
                <div style={{ marginTop: 8, fontFamily: F.mono, fontSize: 9, color: C.muted, textAlign: "center" }}>{date}</div>
                <div style={{ fontFamily: F.mono, fontSize: 8, color: C.faint }}>
                  #{i + 1 + Math.max(0, (scoreTrend || []).length - sessions.length)}
                </div>
                {delta !== null && (
                  <div style={{ marginTop: 4, fontSize: 9, fontWeight: 700, color: delta >= 0 ? C.green : C.orange }}>
                    {delta >= 0 ? "+" : ""}{delta}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 12, background: C.blue50, border: `1px solid ${C.borderMd}` }}>
        {[
          { label: "Best",   val: maxScore,              color: C.amber },
          { label: "Lowest", val: minScore,              color: C.orange },
          { label: "Avg",    val: avgScore,              color: C.blue500 },
          { label: "Spread", val: `${maxScore - minScore} pts`, color: (maxScore - minScore) > 20 ? C.red : C.green },
        ].map(({ label, val, color }) => (
          <div key={label}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{label}</div>
            <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>
    </LightCard>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — COMPANY READINESS  [IMPROVED VERDICT TEXT]
// ═══════════════════════════════════════════════════════════════════════════
const CompanyReadiness = memo(({ analyticsData }) => {
  const [selected, setSelected] = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [cacheTs, setCacheTs]   = useState(null);
  const inFlight = useRef(false);

  const companyCacheKey = (id) => `mm_coach_company_${id}_v1`;

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
    if (cached?.result) {
      setSelected(company); setResult(cached.result); setCacheTs(cached.ts);
      return;
    }

    inFlight.current = true;
    setSelected(company); setLoading(true); setResult(null); setCacheTs(null);

    const gaps = DIMENSION_META.map(meta => {
      const userScore = dimProfile.find(d => d.key === meta.key)?.score ?? 0;
      const required  = company.required[meta.key] ?? 0;
      return { label: meta.label, icon: meta.icon, userScore, required, gap: required - userScore };
    });
    const criticalGaps = gaps.filter(g => g.gap > 0).sort((a, b) => b.gap - a.gap);
    const overTarget   = gaps.filter(g => g.gap <= 0);
    const readinessPct = Math.round(
      (gaps.reduce((acc, g) => acc + Math.min(1, g.userScore / Math.max(g.required, 1)), 0) / gaps.length) * 100
    );

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
  }, [dimProfile]);

  // Derive a verdict "level" from readinessPct for the badge
  const verdictLevel = (pct) => {
    if (pct >= 85) return { label: "READY",      color: C.green,   bg: `${C.green}18`   };
    if (pct >= 65) return { label: "NEAR-READY", color: C.amber,   bg: `${C.amber}18`   };
    if (pct >= 45) return { label: "GAP EXISTS", color: C.orange,  bg: `${C.orange}18`  };
    return             { label: "NOT YET",    color: C.red,     bg: `${C.red}18`     };
  };

  return (
    <DarkCard style={{ marginBottom: 18 }}>
      <Eyebrow color={C.cyan400}>🎯 COMPANY READINESS CHECKER</Eyebrow>
      <h2 style={{ margin: "0 0 6px", fontFamily: F.display, fontSize: 18, fontWeight: 800, color: "#fff" }}>
        Am I ready for this company?
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
        Select a company — coach compares your real dimension scores against their benchmarks and gives you an honest verdict.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }} role="group" aria-label="Select a company">
        {COMPANIES.map(company => {
          const isSelected = selected?.id === company.id;
          const isCached   = !!readCache(companyCacheKey(company.id));
          return (
            <button key={company.id} onClick={() => getReadiness(company)} disabled={loading}
              aria-pressed={isSelected}
              style={{ border: `1.5px solid ${isSelected ? C.cyan400 : "rgba(255,255,255,0.14)"}`, borderRadius: 10, padding: "8px 14px", background: isSelected ? "rgba(0,200,240,0.12)" : "rgba(255,255,255,0.05)", color: isSelected ? C.cyan400 : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: F.body, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}>
              {company.icon} {company.label}
              {isCached && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, display: "inline-block" }} />}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0" }}>
          <Spin size={16} />
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: F.mono }}>
            Comparing your scores against {selected?.label} benchmarks…
          </span>
        </div>
      )}

      {result && !loading && (
        <>
          {cacheTs && <div style={{ marginBottom: 12 }}><CacheTag ts={cacheTs} /></div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="coach-two-col">
            {/* Left — dimension gap bars */}
            <div>
              <div style={{ marginBottom: 14, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.8px", marginBottom: 4 }}>OVERALL READINESS</div>
                    <div style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, lineHeight: 1, color: result.readinessPct >= 80 ? C.green : result.readinessPct >= 60 ? C.amber : C.red }}>
                      {result.readinessPct}%
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28 }}>{selected?.icon}</div>
                    <div style={{
                      marginTop: 6, padding: "3px 10px", borderRadius: 999,
                      background: verdictLevel(result.readinessPct).bg,
                      color: verdictLevel(result.readinessPct).color,
                      fontFamily: F.mono, fontSize: 8, fontWeight: 800, letterSpacing: "0.8px",
                    }}>
                      {verdictLevel(result.readinessPct).label}
                    </div>
                  </div>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                  <div style={{ height: "100%", width: `${result.readinessPct}%`, borderRadius: 999, transition: "width 1s ease", background: result.readinessPct >= 80 ? C.green : result.readinessPct >= 60 ? C.amber : C.red }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 10, fontFamily: F.mono, color: "rgba(255,255,255,0.3)" }}>
                  for {selected?.label} ({selected?.tier})
                </div>
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

            {/* Right — IMPROVED verdict + gaps + strengths */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {result.verdict && (
                <div style={{
                  padding: "20px 20px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderLeft: `3px solid ${C.cyan400}`,
                }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.cyan400, letterSpacing: "1px", marginBottom: 12 }}>
                    ⚡ COACH'S VERDICT
                  </div>
                  {/* Split verdict into 2 paragraphs with visual separation */}
                  {result.verdict.split(/\n\n|\n(?=[A-Z])/).filter(Boolean).map((para, pi) => (
                    <div key={pi}>
                      {pi > 0 && (
                        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />
                      )}
                      <p style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: pi === 0 ? 600 : 400,
                        lineHeight: 1.8,
                        color: pi === 0 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.70)",
                        fontFamily: F.body,
                        letterSpacing: "-0.1px",
                      }}>
                        <HighlightedText text={para} dark={true} />
                      </p>
                    </div>
                  ))}
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
                      <span key={i} style={{ padding: "5px 11px", borderRadius: 999, background: "rgba(5,150,105,0.15)", color: C.green, fontSize: 11.5, fontWeight: 700 }}>
                        {g.icon} {g.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selected && !loading && (
        <IdlePlaceholder dark icon="🎯" message="Select a company above — your dimension scores will be compared against their actual placement benchmarks." />
      )}
    </DarkCard>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — COACH CHAT  [IMPROVED BUBBLES]
// ═══════════════════════════════════════════════════════════════════════════
const CHAT_COOLDOWN_MS = 4000;

const CoachChat = memo(({ analyticsData, breakdownData, blindSpots }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const chatEndRef  = useRef(null);
  const inputRef    = useRef(null);
  const lastSent    = useRef(0);
  const inFlight    = useRef(false);

  const coachContext = useMemo(() => {
    if (!analyticsData) return "";
    const irs    = analyticsData.irs ?? 0;
    const tier   = analyticsData.currentTier ?? "₹3–6 LPA";
    const total  = analyticsData.totalSessions ?? 0;
    const dims   = (analyticsData.dimensionProfile ?? [])
      .filter(d => d.hasData || d.score > 0)
      .map(d => {
        const meta = DIMENSION_META.find(m => m.key === d.key);
        return `${meta?.label || d.key}: ${d.score ?? 0}/100`;
      }).join(", ");
    const lastScore = breakdownData?.sessionScore ?? "N/A";
    const topBlind  = blindSpots?.[0]?.topic ?? "none identified";
    return `Student context: IRS ${irs}/100, tier ${tier}, ${total} sessions done, last score ${lastScore}/100. Dimensions: ${dims}. Top blind spot: ${topBlind}.`;
  }, [analyticsData, breakdownData, blindSpots]);

  useEffect(() => {
    if (coachContext && !contextReady) {
      setMessages([{
        role: "coach",
        text: `Hey — I've pulled your data. IRS ${analyticsData?.irs ?? 0}/100, ${analyticsData?.totalSessions ?? 0} sessions done, currently at ${analyticsData?.currentTier ?? "₹3–6 LPA"}. Ask me anything — where to focus, what companies are realistic, why your score is stuck, how to close a specific gap. I'll give you straight answers based on what I see in your numbers.`,
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      }]);
      setContextReady(true);
    }
  }, [coachContext, contextReady, analyticsData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    lastSent.current = now;
    inFlight.current = true;

    const userMsg = {
      role: "user", text,
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages(prev => [...prev.slice(-19), userMsg]);
    setInput("");
    setLoading(true);

    const history = messages.slice(-6).map(m =>
      `${m.role === "coach" ? "coach" : "Student"}: ${m.text}`
    ).join("\n");

    const prompt = `You are coach, a senior placement coach at MockMate. You coach Indian CS/IT students for campus placements. You speak directly, personally, honestly — like a mentor who has seen 200+ students through placements, not a bot.

${coachContext}

Recent conversation:
${history}

Student just asked: "${text}"

Respond as coach directly to this student. Use their actual data if relevant. Be specific, direct, and personal. No filler, no "Great question!", no markdown. 2-4 sentences max unless a detailed plan is explicitly asked for. Sound like a WhatsApp message from a senior who knows their numbers.`;

    try {
      const responseText = await getAIFreeform(prompt, 400);
      setMessages(prev => [...prev, {
        role: "coach",
        text: responseText || "Let me check your data and get back to you on that.",
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "coach",
        text: "Network issue — try again in a moment.",
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      setLoading(false);
      inFlight.current = false;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, coachContext]);

  const quickPrompts = [
    "Why is my IRS stuck?",
    "Which company should I target first?",
    "What's my biggest weakness right now?",
    "How long until I reach the next tier?",
    "Should I do full sessions or topic sessions?",
    "Am I improving fast enough?",
  ];

  const canSend = !loading && !cooldown && input.trim();

  return (
    <DarkCard style={{ marginBottom: 18 }}>
      <Eyebrow color={C.blue300}>💬 COACH — LIVE CHAT</Eyebrow>
      <h2 style={{ margin: "0 0 4px", fontFamily: F.display, fontSize: 18, fontWeight: 800, color: "#fff" }}>
        Ask anything about your placement journey
      </h2>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
        Coach knows your data. He'll give you honest, specific answers — not generic advice.
        {cooldown && <span style={{ color: C.amber, marginLeft: 8 }}>⏳ Wait a moment before sending another message.</span>}
      </p>

      {/* Message window */}
      <div role="log" aria-live="polite" aria-label="Coach conversation"
        style={{ height: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, padding: "18px 16px", marginBottom: 12, background: "rgba(0,0,0,0.25)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        {messages.map((msg, i) => {
          const isCoach = msg.role === "coach";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isCoach ? "flex-start" : "flex-end", gap: 5, animation: "coachFadeUp 0.3s ease both" }}>
              {isCoach && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* ── IMPROVED: coach avatar ── */}
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg, ${C.blue600}, ${C.cyan600})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, boxShadow: `0 2px 8px rgba(0,173,224,0.3)` }}>⚡</div>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.cyan400, fontWeight: 800, letterSpacing: "0.5px" }}>COACH</span>
                  <span style={{ fontFamily: F.mono, fontSize: 8, color: "rgba(255,255,255,0.2)" }}>{msg.time}</span>
                </div>
              )}

              <div style={{
                maxWidth: "84%",
                padding: isCoach ? "14px 18px" : "12px 16px",
                borderRadius: isCoach ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                background: isCoach
                  ? "rgba(255,255,255,0.07)"
                  : `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
                border: isCoach ? "1px solid rgba(255,255,255,0.09)" : "none",
                boxShadow: isCoach ? "none" : "0 4px 14px rgba(26,110,255,0.3)",
              }}>
                {/* ── IMPROVED: bigger, more readable bubble text ── */}
                <p style={{
                  margin: 0,
                  fontSize: isCoach ? 14.5 : 14,
                  fontWeight: isCoach ? 450 : 500,
                  lineHeight: 1.8,
                  color: isCoach ? "rgba(255,255,255,0.88)" : "#fff",
                  fontFamily: F.body,
                  letterSpacing: isCoach ? "-0.1px" : "0",
                }}>
                  {isCoach
                    ? <HighlightedText text={msg.text} dark={true} />
                    : msg.text
                  }
                </p>
              </div>

              {!isCoach && (
                <span style={{ fontFamily: F.mono, fontSize: 8, color: "rgba(255,255,255,0.2)", marginRight: 4 }}>{msg.time}</span>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg, ${C.blue600}, ${C.cyan600})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>⚡</div>
            <div style={{ padding: "12px 16px", borderRadius: "4px 16px 16px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 6 }}>
              {[0,1,2].map(j => (
                <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: C.cyan400, opacity: 0.7, animation: `coachPulse 1.2s ease ${j * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick prompts */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {quickPrompts.map((prompt, i) => (
          <button key={i} onClick={() => sendMessage(prompt)} disabled={loading || cooldown}
            aria-label={`Quick prompt: ${prompt}`}
            style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)", padding: "6px 13px", fontSize: 11.5, fontWeight: 600, cursor: (loading || cooldown) ? "not-allowed" : "pointer", fontFamily: F.body, transition: "all 0.15s" }}>
            {prompt}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 8 }}>
        <input ref={inputRef} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask coach anything — IRS, companies, weak areas, study plan…"
          disabled={loading || cooldown}
          aria-label="Message to coach"
          style={{ flex: 1, padding: "13px 18px", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", fontSize: 14, fontFamily: F.body, outline: "none", letterSpacing: "-0.1px" }} />
        <button onClick={() => sendMessage()} disabled={!canSend} aria-label="Send message"
          style={{ border: "none", borderRadius: 12, background: canSend ? `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})` : "rgba(255,255,255,0.07)", color: "#fff", padding: "13px 22px", fontSize: 13, fontWeight: 800, cursor: canSend ? "pointer" : "not-allowed", fontFamily: F.body, flexShrink: 0, display: "flex", alignItems: "center", gap: 7, boxShadow: canSend ? "0 4px 14px rgba(0,173,224,0.3)" : "none", transition: "all 0.2s" }}>
          {loading ? <Spin /> : "Send →"}
        </button>
      </div>
    </DarkCard>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — SESSION DEBRIEF  [IMPROVED SECTION CARDS]
// ═══════════════════════════════════════════════════════════════════════════
const SessionDebrief = memo(({ breakdownData, analyticsData }) => {
  const [debrief, setDebrief]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [cacheTs, setCacheTs]   = useState(null);
  const inFlight = useRef(false);

  const DEBRIEF_ACCENTS = {
    "WHAT HAPPENED":    C.blue400,
    "THE BRIGHT SPOT":  C.green,
    "THE LESSON":       C.amber,
    "DO THIS NEXT":     C.cyan400,
  };
  const SECTION_CONFIG = {
    "WHAT HAPPENED":    { icon: "📊", desc: "Session overview" },
    "THE BRIGHT SPOT":  { icon: "✨", desc: "Your win"         },
    "THE LESSON":       { icon: "🎯", desc: "Key takeaway"     },
    "DO THIS NEXT":     { icon: "⚡", desc: "Next action"      },
  };

  useEffect(() => {
    const cached = readCache(CACHE_KEYS.debrief);
    if (cached?.debrief) { setDebrief(cached.debrief); setDone(true); setCacheTs(cached.ts); }
  }, []);

  const generate = useCallback(async () => {
    if (!breakdownData?.questions?.length || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setDone(false); setDebrief(null); setCacheTs(null);

    const { questions = [], sessionScore, avgTimeTaken, skipRate, sessionMode } = breakdownData;
    const answered  = questions.filter(q => !q.skipped);
    const perfect   = answered.filter(q => q.score >= 90).length;
    const struggled = answered.filter(q => q.score < 50);
    const irs       = analyticsData?.irs ?? 0;

    const qSummary = answered.slice(0, 8).map(q =>
      `Q${q.index}: ${q.topic || "unknown"} — ${q.score}/100 (${q.timeTaken}s)`
    ).join("\n");

    const prompt = `You are coach, MockMate's placement coach. Debrief this student on their completed session like a coach reviewing game footage.

SESSION DATA:
- Score: ${sessionScore}/100 | Mode: ${sessionMode}
- Avg time/question: ${avgTimeTaken}s | Skip rate: ${skipRate}%
- Perfect answers (90+): ${perfect}/${answered.length}
- Struggled (<50): ${struggled.length} — topics: ${struggled.map(q => q.topic || "unknown").join(", ") || "none"}
- Student IRS: ${irs}/100

Per-question:
${qSummary}

Write a debrief with EXACTLY these sections:

WHAT HAPPENED
[2-3 sentences. Describe what you see. Name the session score, whether it's above or below their IRS. No filler.]

THE BRIGHT SPOT
[1-2 sentences. Name a specific question or topic where they performed well. Reference the actual score.]

THE LESSON
[2-3 sentences. The single most important thing this session revealed about a gap or pattern. Name the topic. Be specific.]

DO THIS NEXT
[1-2 sentences. The exact next step — topic, mode, and why.]

No markdown. No asterisks. Coach talking after a session. Under 200 words.`;

    try {
      const text     = await getAIFreeform(prompt, 600);
      const sections = parseSections(text, DEBRIEF_ACCENTS);
      const result   = sections.length > 0 ? { sections } : { raw: text };
      const now      = Date.now();
      writeCache(CACHE_KEYS.debrief, { debrief: result, ts: now });
      setDebrief(result); setCacheTs(now);
    } catch {
      setDebrief({ raw: "Could not generate debrief. Check your connection." });
    } finally {
      setLoading(false); setDone(true); inFlight.current = false;
    }
  }, [breakdownData, analyticsData, DEBRIEF_ACCENTS]);

  if (!breakdownData?.questions?.length) return null;

  const { sessionScore, sessionDate, totalQuestions, sessionMode } = breakdownData;
  const dateStr = sessionDate
    ? new Date(sessionDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
    : "Last session";

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.blue500}>🎬 SESSION DEBRIEF</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>
            Coach's review of your last session
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: C.sub }}>
            {dateStr} · {totalQuestions} questions · {sessionMode} mode · Score:{" "}
            <strong style={{ color: scoreColor(sessionScore), fontSize: 13 }}>{sessionScore}/100</strong>
          </p>
          {cacheTs && done && <div style={{ marginTop: 4 }}><CacheTagLight ts={cacheTs} /></div>}
        </div>
        <button onClick={generate} disabled={loading}
          aria-label={done ? "Re-generate session debrief" : "Generate session debrief"}
          style={{ border: "none", borderRadius: 10, background: loading ? C.cardAlt : `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: loading ? C.muted : "#fff", padding: "10px 20px", fontSize: 12.5, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: F.body, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(26,110,255,0.25)" }}>
          {loading
            ? <><span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.border}`, borderTopColor: C.blue500, borderRadius: "50%", animation: "coachSpin 0.7s linear infinite" }} /> Reviewing…</>
            : done ? "↺ Re-debrief" : "🎬 Get Debrief"}
        </button>
      </div>

      {/* Per-question score grid — unchanged */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, flexWrap: "wrap" }} role="list" aria-label="Per-question scores">
        {(breakdownData.questions || []).map((q, i) => (
          <div key={i} role="listitem"
            title={`Q${q.index}: ${q.topic || ""} — ${q.skipped ? "Skipped" : `${q.score}/100`}`}
            aria-label={`Question ${q.index}: ${q.skipped ? "skipped" : `${q.score} out of 100`}`}
            style={{ width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: q.skipped ? C.cardAlt : `${scoreColor(q.score)}18`, border: `1.5px solid ${q.skipped ? C.border : scoreColor(q.score) + "40"}`, fontSize: 11, fontWeight: 800, fontFamily: F.mono, color: q.skipped ? C.faint : scoreColor(q.score), cursor: "default" }}>
            {q.skipped ? "—" : q.score}
          </div>
        ))}
      </div>

      {!done && !loading && (
        <IdlePlaceholder icon="🎬" message="Get coach's personal review — what worked, what didn't, and exactly what to do next." />
      )}

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
          /* ── IMPROVED: section cards with big heading, icon, and readable body ── */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            {debrief.sections.map((s, i) => {
              const cfg = SECTION_CONFIG[s.heading] || { icon: "•", desc: "" };
              return (
                <div key={i} style={{
                  padding: "20px 20px",
                  borderRadius: 16,
                  background: C.cardAlt,
                  border: `1px solid ${C.border}`,
                  borderLeft: `4px solid ${s.accent}`,
                  display: "flex", flexDirection: "column", gap: 12,
                }}>
                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                        <span style={{ fontSize: 17 }}>{cfg.icon}</span>
                        <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 800, letterSpacing: "1.2px", color: s.accent, textTransform: "uppercase" }}>
                          {s.heading}
                        </span>
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 10.5, color: C.muted, marginLeft: 25 }}>
                        {cfg.desc}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: `linear-gradient(90deg, ${s.accent}35, transparent)` }} />

                  {/* Body text — bigger, bolder */}
                  <p style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 500,
                    lineHeight: 1.8,
                    color: C.sub,
                    fontFamily: F.body,
                    letterSpacing: "-0.05px",
                  }}>
                    <HighlightedText text={s.body} dark={false} />
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: C.sub, lineHeight: 1.8, fontFamily: F.body }}>{debrief.raw}</p>
        )
      )}
    </LightCard>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — DIMENSION HEALTH  (no AI — pure data render, unchanged)
// ═══════════════════════════════════════════════════════════════════════════
const DimensionHealth = memo(({ analyticsData, navigate }) => {
  const dimProfile = useMemo(() => {
    const apiProfile = analyticsData?.dimensionProfile ?? [];
    return DIMENSION_META.map(meta => {
      const d = apiProfile.find(x => x.key === meta.key);
      return { ...meta, score: d?.score ?? 0, hasData: d?.hasData ?? false, answeredCount: d?.answeredCount ?? 0 };
    });
  }, [analyticsData]);

  const sorted = useMemo(() => [...dimProfile].sort((a, b) => a.score - b.score), [dimProfile]);

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.blue500}>🧪 DIMENSION HEALTH</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>
            All 6 dimensions at a glance
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: C.sub }}>Sorted weakest first — that's what matters.</p>
        </div>
        <button onClick={() => navigate("/interview")} aria-label="Start a drill on your weakest dimension"
          style={{ border: "none", borderRadius: 10, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "9px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: F.body, boxShadow: "0 4px 14px rgba(26,110,255,0.25)" }}>
          Drill weakest →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
        {sorted.map((dim, i) => {
          const col       = dim.hasData ? scoreColor(dim.score) : C.faint;
          const isWeakest = i === 0 && dim.hasData;
          const status    = !dim.hasData ? "No data" : dim.score >= 80 ? "✓ Strong" : dim.score >= 60 ? "→ Developing" : "↑ Focus needed";
          return (
            <div key={dim.key} style={{ padding: "16px 18px", borderRadius: 16, background: isWeakest ? `${col}08` : C.cardAlt, border: `1.5px solid ${isWeakest ? col + "35" : C.border}`, position: "relative" }}>
              {isWeakest && (
                <div style={{ position: "absolute", top: 10, right: 10, padding: "2px 8px", borderRadius: 999, background: col, color: "#fff", fontSize: 8, fontWeight: 800, fontFamily: F.mono }}>
                  PRIORITY
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }} aria-hidden="true">{dim.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{dim.label}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>{Math.round(dim.weight * 100)}% IRS weight</div>
                  </div>
                </div>
                <span style={{ fontFamily: F.display, fontSize: 24, fontWeight: 900, color: dim.hasData ? col : C.faint }}
                  aria-label={dim.hasData ? `${dim.score} out of 100` : "No data"}>
                  {dim.hasData ? dim.score : "—"}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: C.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${dim.hasData ? dim.score : 0}%`, background: col, borderRadius: 999, transition: "width 1s ease" }} />
              </div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: dim.hasData ? col : C.faint }}>{status}</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{dim.answeredCount} Q answered</span>
              </div>
            </div>
          );
        })}
      </div>
    </LightCard>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COACH PAGE
// ═══════════════════════════════════════════════════════════════════════════
const Coach = () => {
  const navigate = useNavigate();
  const [analyticsData,  setAnalyticsData]  = useState(null);
  const [breakdownData,  setBreakdownData]  = useState(null);
  const [blindSpotsData, setBlindSpotsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [mounted, setMounted] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    (async () => {
      try {
        const [analytics, breakdown, blindSpots] = await Promise.allSettled([
          getAnalytics(),
          getLastSessionBreakdown(),
          getBlindSpots(),
        ]);
        if (analytics.status === "fulfilled") setAnalyticsData(analytics.value);
        else throw new Error("Analytics failed to load");
        if (breakdown.status === "fulfilled") setBreakdownData(breakdown.value);
        if (blindSpots.status === "fulfilled") setBlindSpotsData(blindSpots.value?.blindSpots ?? []);
      } catch (err) {
        console.error("[Coach] Data load failed:", err);
        setError("Unable to load your coaching data. Check your connection and try again.");
      } finally {
        setLoading(false);
        requestAnimationFrame(() => setTimeout(() => setMounted(true), 50));
      }
    })();
  }, []);

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
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F.body }}>
      <PencilLoader />
      <p style={{ color: C.sub, marginTop: 16, fontSize: 13 }}>Loading your placement command center…</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: 32 }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>⚠️</div>
        <h2 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 10 }}>Something went wrong</h2>
        <p style={{ color: C.sub, marginBottom: 20 }}>{error}</p>
        <button onClick={() => window.location.reload()} aria-label="Retry loading the page"
          style={{ border: "none", borderRadius: 12, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "12px 24px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body }}>
          Try Again
        </button>
      </div>
    </div>
  );

  if (!analyticsData || totalSessions === 0) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 540, padding: "56px 28px", background: C.card, borderRadius: 24, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>🧠</div>
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.blue500, letterSpacing: "1.6px", marginBottom: 10 }}>PLACEMENT COMMAND CENTER</div>
        <h1 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>
          Complete your first interview to unlock Coach.
        </h1>
        <p style={{ color: C.sub, lineHeight: 1.7, fontSize: 13.5, marginBottom: 24 }}>
          Coach needs your session data to give personalized guidance. One interview gives him enough to start coaching you properly.
        </p>
        <button onClick={() => navigate("/interview")} aria-label="Start your first interview"
          style={{ border: "none", borderRadius: 13, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "14px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: F.body, boxShadow: "0 6px 22px rgba(26,110,255,0.30)" }}>
          🎯 Start First Interview →
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.08) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`, padding: "36px 28px 80px", fontFamily: F.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');

        @keyframes coachSpin   { to { transform: rotate(360deg); } }
        @keyframes coachFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes coachPulse  { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }

        *, *::before, *::after { box-sizing: border-box; }

        .coach-page input::placeholder { color: rgba(255,255,255,0.3); }
        .coach-page input:focus {
          border-color: rgba(0,200,240,0.4) !important;
          outline: none;
          box-shadow: 0 0 0 2px rgba(0,200,240,0.1);
        }
        .coach-page button:focus-visible {
          outline: 2px solid ${C.cyan400};
          outline-offset: 2px;
        }
        .coach-page button:hover:not(:disabled) { opacity: 0.92; }

        @media (max-width: 960px) { .coach-two-col { grid-template-columns: 1fr !important; } }
        @media (max-width: 680px) { .coach-page { padding: 18px 14px 60px !important; } }

        .coach-page ::-webkit-scrollbar { width: 4px; height: 4px; }
        .coach-page ::-webkit-scrollbar-track { background: transparent; }
        .coach-page ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        @media (prefers-reduced-motion: reduce) {
          .coach-page * { animation: none !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      <div className="coach-page" style={{ maxWidth: 1200, margin: "0 auto", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(12px)", transition: "opacity 0.55s ease, transform 0.55s cubic-bezier(.16,1,.3,1)" }}>

        <SectionErrorBoundary>
          <CommandHeader irs={irs} tier={tier} totalSessions={totalSessions} lastScore={lastScore} slope={slope} navigate={navigate} />
        </SectionErrorBoundary>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="coach-two-col">
          <SectionErrorBoundary>
            <TodayCard analyticsData={analyticsData} breakdownData={breakdownData} blindSpots={blindSpotsData} navigate={navigate} />
          </SectionErrorBoundary>
          <SectionErrorBoundary>
            <WeeklyPlan analyticsData={analyticsData} navigate={navigate} />
          </SectionErrorBoundary>
        </div>

        <SectionErrorBoundary>
          <ProgressTimeline scoreTrend={scoreTrend} />
        </SectionErrorBoundary>

        <SectionErrorBoundary>
          <DimensionHealth analyticsData={analyticsData} navigate={navigate} />
        </SectionErrorBoundary>

        <SectionErrorBoundary>
          <CompanyReadiness analyticsData={analyticsData} />
        </SectionErrorBoundary>

        <SectionErrorBoundary>
          <SessionDebrief breakdownData={breakdownData} analyticsData={analyticsData} />
        </SectionErrorBoundary>

        <SectionErrorBoundary>
          <CoachChat analyticsData={analyticsData} breakdownData={breakdownData} blindSpots={blindSpotsData} />
        </SectionErrorBoundary>

        {/* Footer nav */}
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
                <button key={path} onClick={() => navigate(path)} aria-label={`Go to ${label}`}
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
      </div>
    </div>
  );
};

export default Coach;