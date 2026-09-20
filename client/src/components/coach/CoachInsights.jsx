import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react";
import PropTypes from "prop-types";
import { getAIFreeform } from '../../Services/interviewService';
import {
  C, F,
  DIM_META,
  readCache, writeCache,
  scoreColor,
  parseSections, parseWeeklySections,
  Eyebrow, CacheTag, CacheTagLight,
  DarkCard, LightCard,
  GenButton, Spin,
  SentenceBreaker, HighlightedText,
} from "./CoachShared";


const TODAY_IDLE_BEATS = [
  { label: "TODAY'S PRIORITY", color: C.cyan400, w: [90, 70]      },
  { label: "WHY IT MATTERS",   color: C.blue400, w: [100, 80, 55] },
  { label: "HOW TO DO IT",     color: C.cyan500, w: [85, 65]      },
];

const TodayIdlePlaceholder = () => (
  <div style={{ padding: "22px 22px", borderRadius: 16, border: "1.5px dashed rgba(0,200,240,0.18)", background: "rgba(0,200,240,0.03)" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {TODAY_IDLE_BEATS.map((beat, i) => (
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

const WEEKLY_IDLE_DAYS = [
  { label: "DAY 1–2", color: C.red     },
  { label: "DAY 3–4", color: C.amber   },
  { label: "DAY 5–6", color: C.blue400 },
  { label: "DAY 7",   color: C.green   },
];

const WeeklyIdlePlaceholder = () => (
  <div style={{ padding: "28px 20px", border: "1.5px dashed rgba(0,0,0,0.10)", borderRadius: 16, background: "rgba(26,110,255,0.02)" }}>
    <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: "1.2px", marginBottom: 14, textAlign: "center" }}>YOUR 7-DAY PLAN WILL APPEAR HERE</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {WEEKLY_IDLE_DAYS.map((d, i) => (
        <div key={i} style={{ borderRadius: 12, border: `1.5px solid ${d.color}22`, borderTop: `3px solid ${d.color}44`, padding: "12px 10px", background: `${d.color}06`, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 800, color: `${d.color}99`, letterSpacing: "0.8px" }}>{d.label}</div>
          {[1, 2].map((j) => (
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

const TODAY_BEATS = [
  { icon: "🎯", label: "TODAY'S PRIORITY" },
  { icon: "⚡", label: "WHY IT MATTERS"   },
  { icon: "📋", label: "HOW TO DO IT"     },
];

const buildTodayPrompt = ({ irs, tier, dims, lastScore, skipRate, avgTime, topBlind }) =>
  `You are coach, MockMate's AI placement coach. A final-year CS student needs their single most important focus for TODAY based on real data.

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

// — TodayCard
export const TodayCard = memo(({ analyticsData, breakdownData, blindSpots, navigate, cacheKeys }) => {
  const [todayPlan, setTodayPlan] = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [cacheTs, setCacheTs]     = useState(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const cached = readCache(cacheKeys.today);
    Promise.resolve().then(() => {
      if (cached) { setTodayPlan(cached.text); setDone(true); setCacheTs(cached.ts); }
      else { setTodayPlan(""); setDone(false); setCacheTs(null); }
    });
  }, [cacheKeys.today]);

  const generate = useCallback(async () => {
    if (!analyticsData || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setDone(false); setTodayPlan(""); setCacheTs(null);
    const prompt = buildTodayPrompt({
      irs:      analyticsData.irs ?? 0,
      tier:     analyticsData.currentTier ?? "₹3–6 LPA",
      dims:     (analyticsData.dimensionProfile ?? []).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3).map((d) => `${d.key}: ${d.score ?? 0}/100`).join(", "),
      lastScore: breakdownData?.sessionScore ?? "unknown",
      skipRate:  breakdownData?.skipRate ?? 0,
      avgTime:   breakdownData?.avgTimeTaken ?? 0,
      topBlind:  blindSpots?.[0]?.topic ?? "not identified yet",
    });
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

  const topWeakDim = useMemo(() =>
    [...(analyticsData?.dimensionProfile ?? [])].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0],
    [analyticsData]
  );

  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <DarkCard accent={C.cyan400} style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Eyebrow color={C.cyan400}>📋 WHAT TO DO TODAY</Eyebrow>
            <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "2px 8px", letterSpacing: "0.4px" }}>{todayLabel}</span>
          </div>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: "#fff" }}>coach's orders for your next session</h2>
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
            <SentenceBreaker text={todayPlan} dark beats={TODAY_BEATS} />
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
          <button onClick={() => navigate("/interview")} style={{ border: "none", borderRadius: 8, background: `linear-gradient(135deg, ${C.blue500}, ${C.blue600})`, color: "#fff", padding: "7px 14px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body }}>
            Drill this now →
          </button>
        </div>
      )}
    </DarkCard>
  );
});

TodayCard.propTypes = {
  analyticsData: PropTypes.object,
  breakdownData: PropTypes.object,
  blindSpots:    PropTypes.array,
  navigate:      PropTypes.func.isRequired,
  cacheKeys:     PropTypes.object.isRequired,
};

// — WeeklyPlan constants
const DAY_ACCENTS = {
  "DAY 1-2": C.red,
  "DAY 3-4": C.amber,
  "DAY 5-6": C.blue400,
  "DAY 7":   C.green,
};

const DAY_CONFIG = {
  "DAY 1-2": { badge: "CRITICAL FOCUS",  badgeBg: `${C.red}18`,     badgeColor: C.red     },
  "DAY 3-4": { badge: "BUILD ON IT",     badgeBg: `${C.amber}18`,   badgeColor: C.amber   },
  "DAY 5-6": { badge: "CONSOLIDATE",     badgeBg: `${C.blue400}18`, badgeColor: C.blue400 },
  "DAY 7":   { badge: "ASSESS & REVIEW", badgeBg: `${C.green}18`,   badgeColor: C.green   },
};

const DayCircle = ({ label, color }) => {
  const num = label.replace(/^DAY\s*/i, "").trim();
  return (
    <div style={{ width: 42, height: 42, borderRadius: "50%", background: `${color}18`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 12px ${color}22` }}>
      <span style={{ fontFamily: F.display, fontSize: num.length > 2 ? 10 : 13, fontWeight: 900, color, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{num}</span>
    </div>
  );
};
DayCircle.propTypes = { label: PropTypes.string.isRequired, color: PropTypes.string.isRequired };

const buildWeeklyPrompt = (analyticsData) => {
  const dims = (analyticsData.dimensionProfile ?? [])
    .filter((d) => d.hasData || d.score > 0)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .map((d) => {
      const meta = DIM_META.find((m) => m.key === d.key);
      return `${meta?.label || d.key}: ${d.score ?? 0}/100 (weight ${Math.round((meta?.weight || 0.1) * 100)}%)`;
    }).join("\n");
  return `You are coach, MockMate's AI placement coach for a final-year CS/IT student targeting campus placements in India.

STUDENT DATA:
- IRS: ${analyticsData.irs ?? 0}/100 | Tier: ${analyticsData.currentTier ?? "₹3–6 LPA"} | Sessions completed: ${analyticsData.totalSessions ?? 0}
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
};

// — WeeklyPlan
export const WeeklyPlan = memo(({ analyticsData, navigate, cacheKeys }) => {
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [cacheTs, setCacheTs] = useState(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const cached = readCache(cacheKeys.weekly);
    Promise.resolve().then(() => {
      if (cached?.plan) { setPlan(cached.plan); setDone(true); setCacheTs(cached.ts); }
      else { setPlan(null); setDone(false); setCacheTs(null); }
    });
  }, [cacheKeys.weekly]);

  const generate = useCallback(async () => {
    if (!analyticsData || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setDone(false); setPlan(null); setCacheTs(null);
    try {
      const text   = await getAIFreeform(buildWeeklyPrompt(analyticsData), 500);
      let sections = parseWeeklySections(text, DAY_ACCENTS);
      if (sections.length < 2) sections = parseSections(text, DAY_ACCENTS);
      const result = sections.length > 0 ? sections : [{ heading: "THIS WEEK", body: text, accent: C.cyan400 }];
      const now    = Date.now();
      writeCache(cacheKeys.weekly, { plan: result, ts: now });
      setPlan(result); setCacheTs(now);
    } catch {
      setPlan([{ heading: "THIS WEEK", body: "Focus on your two weakest dimensions first — 2 sessions each. Save day 7 for a full mock.", accent: C.cyan400 }]);
    } finally {
      setLoading(false); setDone(true); inFlight.current = false;
    }
  }, [analyticsData, cacheKeys.weekly]);

  const LOADING_STEPS = ["Scanning dimension gaps…", "Computing priority order…", "Drafting daily targets…", "Finalizing your schedule…"];

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={C.blue500}>📅 7-DAY FOCUS PLAN</Eyebrow>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>coach's battle plan for this week</h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: C.sub, lineHeight: 1.6 }}>Generated from your real dimension gaps — not a generic template.</p>
          {cacheTs && done && <div style={{ marginTop: 4 }}><CacheTagLight ts={cacheTs} /></div>}
        </div>
        <GenButton onClick={generate} loading={loading} done={done} dark={false} label="Generate Plan" />
      </div>

      {!done && !loading && <WeeklyIdlePlaceholder />}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LOADING_STEPS.map((msg, i) => (
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
                      <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: section.accent, letterSpacing: "-0.3px", marginBottom: 4 }}>{section.heading}</div>
                      <span style={{ fontFamily: F.mono, fontSize: 7.5, fontWeight: 800, letterSpacing: "0.8px", padding: "2px 8px", borderRadius: 999, background: cfg.badgeBg, color: cfg.badgeColor, textTransform: "uppercase" }}>{cfg.badge}</span>
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
          <button onClick={() => navigate("/interview")} style={{ border: "none", borderRadius: 9, background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: "#fff", padding: "10px 20px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: F.body }}>
            🎯 Start Day 1-2 session →
          </button>
        </div>
      )}
    </LightCard>
  );
});

WeeklyPlan.propTypes = {
  analyticsData: PropTypes.object,
  navigate:      PropTypes.func.isRequired,
  cacheKeys:     PropTypes.object.isRequired,
};