import { useEffect, useState, useRef, useMemo, useCallback, memo, Component} from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import {
  getAIFreeform,
  getDashboardAnalytics,
  getLastSessionBreakdown,
  getBlindSpots,
} from '../Services/interviewService';
import PencilLoader from "../components/PencilLoader";
import {
  C, F,
  COMPANIES, DIM_META, TIER_META,
  buildCacheKeys, purgeOtherUsersCache,
  readCache, writeCache,
  cacheAgeMinutes, trendSlope, scoreColor,
  SectionErrorBoundary,
  Spin, Eyebrow, CacheTag,
  DarkCard, LightCard,
  HighlightedText,
  AnimatedSection, SectionDivider,
} from "../components/coach/CoachShared.jsx";
import { TodayCard, WeeklyPlan }  from "../components/coach/CoachInsights";
import { WeaknessRadar }          from "../components/coach/WeaknessRadar";
import { SessionBreakdown }       from "../components/coach/SessionBreakdown";

// — CommandHeader
const HEADER_STATS = (irs, tier, totalSessions, lastScore, slope) => {
  const tierMeta      = TIER_META[tier] || TIER_META["₹3–6 LPA"];
  const slopePositive = slope >= 0;
  return [
    { label: "IRS SCORE",  val: `${irs}/100`,                                          color: scoreColor(irs)        },
    { label: "TIER",       val: tier,                                                   color: tierMeta.color         },
    { label: "SESSIONS",   val: totalSessions,                                          color: C.cyan400              },
    { label: "LAST SCORE", val: `${lastScore}/100`,                                     color: scoreColor(lastScore)  },
    { label: "TREND",      val: `${slopePositive ? "+" : ""}${slope.toFixed(1)} /sess`, color: slopePositive ? C.green : C.orange },
  ];
};

const CommandHeader = memo(({ irs, tier, totalSessions, lastScore, slope, navigate }) => (
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
        {HEADER_STATS(irs, tier, totalSessions, lastScore, slope).map((item, i) => (
          <div key={i} style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center", minWidth: 78 }}>
            <div style={{ fontFamily: F.mono, fontSize: 7.5, letterSpacing: "0.8px", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: item.color, whiteSpace: "nowrap" }}>{item.val}</div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ position: "relative", marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button onClick={() => navigate("/interview")} style={{ border: "none", borderRadius: 12, background: `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})`, color: "#fff", padding: "11px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: F.body, boxShadow: "0 4px 18px rgba(0,173,224,0.35)", display: "flex", alignItems: "center", gap: 8 }}>
        🎯 Start Interview
      </button>
      <button onClick={() => navigate("/analytics")} style={{ border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", padding: "11px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F.body }}>
        📊 Full Analytics
      </button>
    </div>
  </div>
));
CommandHeader.propTypes = {
  irs:           PropTypes.number.isRequired,
  tier:          PropTypes.string.isRequired,
  totalSessions: PropTypes.number.isRequired,
  lastScore:     PropTypes.number.isRequired,
  slope:         PropTypes.number.isRequired,
  navigate:      PropTypes.func.isRequired,
};

// — ProgressTimeline
const ProgressTimeline = memo(({ scoreTrend }) => {
  const sessions = useMemo(() => (scoreTrend || []).slice(-10), [scoreTrend]);
  if (!sessions.length) return null;

  const scores   = sessions.map((s) => s.score || 0);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const avgScore = Math.round(scores.reduce((a, v) => a + v, 0) / scores.length);
  const spread   = maxScore - minScore;

  const CIRCLE_W  = 80;
  const CX_OFFSET = 40;
  const CY        = 44;
  const SVG_H     = 88;
  const n         = sessions.length;
  const SVG_W     = n * CIRCLE_W;
  const cx        = (i) => CX_OFFSET + i * CIRCLE_W;

  const summaryStats = [
    { label: "Best",   val: maxScore, color: C.amber,   bg: `${C.amber}08`   },
    { label: "Lowest", val: minScore, color: C.orange,  bg: `${C.orange}08`  },
    { label: "Avg",    val: avgScore, color: C.blue500, bg: `${C.blue500}08` },
    { label: "Spread", val: `${spread} pts`, color: spread > 20 ? C.red : C.green, bg: spread > 20 ? `${C.red}08` : `${C.green}08` },
  ];

  return (
    <LightCard style={{ marginBottom: 18 }}>
      <Eyebrow color={C.blue500}>📈 PROGRESS TIMELINE</Eyebrow>
      <h2 style={{ margin: "0 0 4px", fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text }}>Your journey — last {sessions.length} sessions</h2>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: C.sub }}>Each session is a data point. The story they tell together is your trajectory.</p>

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ position: "relative", minWidth: SVG_W, width: "100%" }}>
          <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }} aria-hidden="true">
            {sessions.map((s, i) => {
              if (i === 0) return null;
              const up = (s.score || 0) >= (sessions[i - 1]?.score || 0);
              return <line key={i} x1={cx(i - 1)} y1={CY} x2={cx(i)} y2={CY} stroke={up ? C.green : C.orange} strokeWidth="2.5" strokeOpacity="0.55" strokeDasharray={up ? "none" : "5 3"} />;
            })}
          </svg>

          <div style={{ display: "flex", gap: 0 }} role="list" aria-label="Session score history">
            {sessions.map((s, i) => {
              const score   = s.score || 0;
              const col     = scoreColor(score);
              const isLast  = i === sessions.length - 1;
              const isBest  = score === maxScore && maxScore > 0;
              const date    = s.date ? new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : `S${i + 1}`;
              const delta   = i > 0 ? score - (sessions[i - 1]?.score || 0) : null;
              const deltaUp = delta !== null && delta >= 0;
              return (
                <div key={i} role="listitem" style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", width: CIRCLE_W, position: "relative", zIndex: 1, paddingTop: 8 }}>
                  <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                    {isLast && <span style={{ padding: "2px 7px", borderRadius: 999, background: C.blue500, fontSize: 7.5, fontWeight: 800, fontFamily: F.mono, color: "#fff", letterSpacing: "0.5px" }}>LATEST</span>}
                    {isBest && !isLast && <span style={{ padding: "2px 7px", borderRadius: 999, background: `${C.amber}22`, border: `1px solid ${C.amber}`, fontSize: 7.5, fontWeight: 800, fontFamily: F.mono, color: C.amber, letterSpacing: "0.5px" }}>BEST</span>}
                  </div>
                  <div style={{ position: "relative", width: 44, height: 44 }}>
                    {(isBest || (isLast && !isBest)) && (
                      <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${isBest ? C.amber : C.blue500}`, boxShadow: `0 0 ${isBest ? "14px" : "12px"} ${isBest ? `${C.amber}66` : `${C.blue500}44`}`, animation: isLast && !isBest ? "coachPulseRing 2s ease infinite" : undefined }} />
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
        {summaryStats.map(({ label, val, color, bg }, idx, arr) => (
          <div key={label} style={{ flex: 1, padding: "14px 16px", background: bg, borderRight: idx < arr.length - 1 ? `1px solid ${C.borderMd}` : "none", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: "0.6px", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{val}</div>
          </div>
        ))}
      </div>
    </LightCard>
  );
});
ProgressTimeline.propTypes = {
  scoreTrend: PropTypes.arrayOf(PropTypes.shape({ score: PropTypes.number, date: PropTypes.string })),
};

// — CompanyReadiness
const VERDICT_BEATS = [
  { icon: "🧭", label: "THE VERDICT"    },
  { icon: "🔧", label: "FIX THIS FIRST" },
];

const CompanyIdlePlaceholder = () => (
  <div style={{ padding: "32px 24px", border: "1.5px dashed rgba(0,200,240,0.18)", borderRadius: 16, background: "transparent", textAlign: "center" }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 16, opacity: 0.35 }}>
      {COMPANIES.map((c) => (
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

const buildCompanyPrompt = (company, gaps, readinessPct) =>
  `You are coach, MockMate's placement coach. Tell this student honestly whether they're ready for ${company.label} right now.

Student scores vs ${company.label} requirements:
${gaps.map((g) => `${g.icon} ${g.label}: student ${g.userScore}/100, needed ${g.required}/100, gap ${g.gap > 0 ? "+" + g.gap + " short" : "✓ met"}`).join("\n")}

Overall readiness: ${readinessPct}%

Write 2 paragraphs:
Paragraph 1: Direct verdict — ready? Near-ready? Far? Reference the readiness % and 1-2 specific gaps.
Paragraph 2: The single most important thing to fix to become ready for ${company.label}, and how long it will realistically take.

No headers. No markdown. Direct mentor voice. Under 100 words.`;

const CompanyReadiness = memo(({ analyticsData, cacheKeys }) => {
  const [selected, setSelected] = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [cacheTs, setCacheTs]   = useState(null);
  const inFlight = useRef(false);

  const dimProfile = useMemo(() => {
    const apiProfile = analyticsData?.dimensionProfile ?? [];
    return DIM_META.map((meta) => {
      const d = apiProfile.find((x) => x.key === meta.key);
      return { ...meta, score: d?.score ?? 0, hasData: d?.hasData ?? false };
    });
  }, [analyticsData]);

  const buildGaps = useCallback((company) =>
    DIM_META.map((meta) => {
      const userScore = dimProfile.find((d) => d.key === meta.key)?.score ?? 0;
      const required  = company.required[meta.key] ?? 0;
      return { label: meta.label, icon: meta.icon, userScore, required, gap: required - userScore };
    }),
    [dimProfile]
  );

  const getReadiness = useCallback(async (company) => {
    if (inFlight.current) return;
    const cached = readCache(cacheKeys.company(company.id));
    if (cached?.result) { setSelected(company); setResult(cached.result); setCacheTs(cached.ts); return; }
    inFlight.current = true;
    setSelected(company); setLoading(true); setResult(null); setCacheTs(null);
    const gaps         = buildGaps(company);
    const criticalGaps = gaps.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap);
    const overTarget   = gaps.filter((g) => g.gap <= 0);
    const readinessPct = Math.round((gaps.reduce((acc, g) => acc + Math.min(1, g.userScore / Math.max(g.required, 1)), 0) / gaps.length) * 100);
    try {
      const text    = await getAIFreeform(buildCompanyPrompt(company, gaps, readinessPct), 350);
      const payload = { gaps, criticalGaps, overTarget, readinessPct, verdict: text };
      const now     = Date.now();
      writeCache(cacheKeys.company(company.id), { result: payload, ts: now });
      setResult(payload); setCacheTs(now);
    } catch {
      setResult({ gaps, criticalGaps, overTarget, readinessPct, verdict: null });
    } finally {
      setLoading(false); inFlight.current = false;
    }
  }, [buildGaps, cacheKeys]);

  const verdictLevel = (pct) =>
    pct >= 85 ? { label: "READY",      color: C.green,  bg: `${C.green}18`  } :
    pct >= 65 ? { label: "NEAR-READY", color: C.amber,  bg: `${C.amber}18`  } :
    pct >= 45 ? { label: "GAP EXISTS", color: C.orange, bg: `${C.orange}18` } :
                { label: "NOT YET",    color: C.red,    bg: `${C.red}18`    };

  return (
    <DarkCard style={{ marginBottom: 18 }}>
      <Eyebrow color={C.cyan400}>🎯 COMPANY READINESS CHECKER</Eyebrow>
      <h2 style={{ margin: "0 0 6px", fontFamily: F.display, fontSize: 18, fontWeight: 800, color: "#fff" }}>Am I ready for this company?</h2>
      <p style={{ margin: "0 0 18px", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
        Select a company — coach compares your real dimension scores against their benchmarks and gives you an honest verdict.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }} role="group" aria-label="Select a company">
        {COMPANIES.map((company) => {
          const isSelected = selected?.id === company.id;
          const isCached   = !!readCache(cacheKeys.company(company.id));
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

      {result && !loading && (() => {
        const vl = verdictLevel(result.readinessPct);
        return (
          <>
            {cacheTs && <div style={{ marginBottom: 12 }}><CacheTag ts={cacheTs} /></div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="coach-two-col">
              <div>
                <div style={{ marginBottom: 14, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.8px", marginBottom: 4 }}>OVERALL READINESS</div>
                      <div style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, lineHeight: 1, color: result.readinessPct >= 80 ? C.green : result.readinessPct >= 60 ? C.amber : C.red, fontVariantNumeric: "tabular-nums" }}>{result.readinessPct}%</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 28 }}>{selected?.icon}</div>
                      <div style={{ marginTop: 6, padding: "3px 10px", borderRadius: 999, background: vl.bg, color: vl.color, fontFamily: F.mono, fontSize: 8, fontWeight: 800, letterSpacing: "0.8px" }}>{vl.label}</div>
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
                      {result.verdict.split(/\n\n|\n(?=[A-Z])/).filter(Boolean).map((para, pi) => {
                        const beat = VERDICT_BEATS[pi];
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
                                  <HighlightedText text={para} dark />
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
        );
      })()}

      {!selected && !loading && <CompanyIdlePlaceholder />}
    </DarkCard>
  );
});
CompanyReadiness.propTypes = {
  analyticsData: PropTypes.object,
  cacheKeys:     PropTypes.object.isRequired,
};

// — CoachChat
const CHAT_COOLDOWN_MS = 4000;
const QUICK_PROMPTS = [
  { icon: "📊", text: "Why is my IRS stuck?"                  },
  { icon: "🎯", text: "Which company should I target first?"   },
  { icon: "🔍", text: "What's my biggest weakness right now?"  },
  { icon: "⏱",  text: "How long until I reach the next tier?" },
  { icon: "📋", text: "Full sessions or topic sessions?"       },
  { icon: "📈", text: "Am I improving fast enough?"            },
];

const buildCoachContext = (analyticsData, breakdownData, blindSpots) => {
  if (!analyticsData) return "";
  const dims = (analyticsData.dimensionProfile ?? [])
    .filter((d) => d.hasData || d.score > 0)
    .map((d) => { const meta = DIM_META.find((m) => m.key === d.key); return `${meta?.label || d.key}: ${d.score ?? 0}/100`; })
    .join(", ");
  return `Student context: IRS ${analyticsData.irs ?? 0}/100, tier ${analyticsData.currentTier ?? "₹3–6 LPA"}, ${analyticsData.totalSessions ?? 0} sessions done, last score ${breakdownData?.sessionScore ?? "N/A"}/100. Dimensions: ${dims}. Top blind spot: ${blindSpots?.[0]?.topic ?? "none identified"}.`;
};

const buildChatPrompt = (coachContext, history, text) =>
  `You are coach — a placement coach at MockMate who has personally guided 200+ final-year CS/IT students through campus placements at Indian companies. You are direct, data-driven, and occasionally blunt. You do not hedge. You do not say "it depends" without immediately saying what it depends on and which direction it goes. You do not give generic advice.

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

const CoachChat = memo(({ analyticsData, breakdownData, blindSpots, userId }) => {
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [cooldown, setCooldown]         = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const chatEndRef   = useRef(null);
  const inputRef     = useRef(null);
  const lastSent     = useRef(0);
  const inFlight     = useRef(false);
  const shouldScroll = useRef(false);
  const chatUserId   = useRef(userId);

  useEffect(() => {
    if (chatUserId.current === userId) return;
    chatUserId.current = userId;
    setMessages([]); setContextReady(false);
    inFlight.current = false; shouldScroll.current = false;
  }, [userId]);

  const coachContext = useMemo(() => buildCoachContext(analyticsData, breakdownData, blindSpots), [analyticsData, breakdownData, blindSpots]);

  useEffect(() => {
    if (!coachContext || contextReady) return;
    setMessages([{
      role: "coach",
      text: `Hey — I've pulled your data. IRS ${analyticsData?.irs ?? 0}/100, ${analyticsData?.totalSessions ?? 0} sessions done, currently at ${analyticsData?.currentTier ?? "₹3–6 LPA"}. Ask me anything — where to focus, what companies are realistic, why your score is stuck, how to close a specific gap. I'll give you straight answers based on what I see in your numbers.`,
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    }]);
    setContextReady(true);
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
    setMessages((prev) => [...prev.slice(-19), userMsg]);
    setInput(""); setLoading(true);
    const history = messages.slice(-6).map((m) => `${m.role === "coach" ? "coach" : "Student"}: ${m.text}`).join("\n");
    try {
      const responseText = await getAIFreeform(buildChatPrompt(coachContext, history, text), 400);
      shouldScroll.current = true;
      setMessages((prev) => [...prev, { role: "coach", text: responseText || "Let me check your data and get back to you on that.", time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) }]);
    } catch {
      shouldScroll.current = true;
      setMessages((prev) => [...prev, { role: "coach", text: "Network issue — try again in a moment.", time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) }]);
    } finally {
      setLoading(false); inFlight.current = false;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, coachContext]);

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
                  {isCoach ? <HighlightedText text={msg.text} dark /> : msg.text}
                </p>
                <div style={{ marginTop: 6, textAlign: isCoach ? "left" : "right", fontFamily: F.mono, fontSize: 8, color: isCoach ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.35)" }}>{msg.time}</div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.blue600}, ${C.cyan600})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>⚡</div>
            <div style={{ padding: "12px 16px", borderRadius: "3px 14px 14px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `3px solid ${C.cyan400}30`, display: "flex", alignItems: "center", gap: 6 }}>
              {[0, 1, 2].map((j) => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: C.cyan400, opacity: 0.7, animation: `coachPulse 1.2s ease ${j * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
        {QUICK_PROMPTS.map((p, i) => (
          <button key={i} onClick={() => sendMessage(p.text)} disabled={loading || cooldown}
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask coach anything — IRS, companies, weak areas, study plan…"
            disabled={loading || cooldown}
            style={{ width: "100%", padding: "13px 18px", paddingRight: charCount > 0 ? "52px" : "18px", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: `1px solid ${charOverLimit ? C.red + "60" : "rgba(255,255,255,0.14)"}`, color: "#fff", fontSize: 14, fontFamily: F.body, outline: "none", letterSpacing: "-0.1px", boxSizing: "border-box" }} />
          {charCount > 0 && (
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontFamily: F.mono, fontSize: 9, color: charOverLimit ? C.red : "rgba(255,255,255,0.25)", fontWeight: 700, pointerEvents: "none" }}>{charCount}</div>
          )}
        </div>
        <button onClick={() => sendMessage()} disabled={!canSend}
          style={{ border: "none", borderRadius: 12, background: canSend ? `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})` : "rgba(255,255,255,0.07)", color: "#fff", padding: "13px 22px", fontSize: 13, fontWeight: 800, cursor: canSend ? "pointer" : "not-allowed", fontFamily: F.body, flexShrink: 0, display: "flex", alignItems: "center", gap: 7, boxShadow: canSend ? "0 4px 14px rgba(0,173,224,0.3)" : "none", transition: "all 0.2s" }}>
          {loading ? <Spin /> : "Send →"}
        </button>
      </div>
    </DarkCard>
  );
});
CoachChat.propTypes = {
  analyticsData: PropTypes.object,
  breakdownData: PropTypes.object,
  blindSpots:    PropTypes.array,
  userId:        PropTypes.string,
};

// — Data loader
const NAV_LINKS = [
  { label: "📊 Analytics",    path: "/analytics" },
  { label: "🎤 New Interview", path: "/interview" },
  { label: "📜 History",       path: "/history"   },
  { label: "🏠 Dashboard",     path: "/dashboard" },
];

const loadCoachData = async () => {
  const [analytics, breakdown, blindSpots] = await Promise.allSettled([
    getDashboardAnalytics(),
    getLastSessionBreakdown(),
    getBlindSpots(),
  ]);
  return { analytics, breakdown, blindSpots };
};

// — Coach page
const Coach = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId   = user?._id ?? user?.id ?? null;

  const [analyticsData,  setAnalyticsData]  = useState(null);
  const [breakdownData,  setBreakdownData]  = useState(null);
  const [blindSpotsData, setBlindSpotsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const fetchedForUser = useRef(undefined);

  const cacheKeys = useMemo(() => buildCacheKeys(userId), [userId]);

  useEffect(() => { purgeOtherUsersCache(userId); }, [userId]);

  useEffect(() => {
    if (fetchedForUser.current === userId) return;
    fetchedForUser.current = userId;
    setAnalyticsData(null); setBreakdownData(null); setBlindSpotsData(null);
    setError(""); setLoading(true);
    (async () => {
      try {
        const { analytics, breakdown, blindSpots } = await loadCoachData();
        if (analytics.status === "fulfilled") setAnalyticsData(analytics.value);
        else throw new Error("Analytics failed to load");
        if (breakdown.status === "fulfilled") setBreakdownData(breakdown.value);
        if (blindSpots.status === "fulfilled") setBlindSpotsData(blindSpots.value?.blindSpots ?? []);
      } catch (err) {
        console.error("[Coach] Data load failed:", err);
        setError("Unable to load your coaching data. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
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
      slope:         trendSlope(st.map((s) => s.score || 0)),
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
        .coach-page input:focus { border-color: rgba(0,200,240,0.4) !important; outline: none; box-shadow: 0 0 0 2px rgba(0,200,240,0.1); }
        .coach-page button:focus-visible { outline: 2px solid ${C.cyan400}; outline-offset: 2px; }
        .coach-page button:hover:not(:disabled) { opacity: 0.92; }
        .coach-page button:active:not(:disabled) { transform: scale(0.98); }
        .coach-pill:hover:not(:disabled) { background: rgba(255,255,255,0.14) !important; border-color: rgba(0,200,240,0.45) !important; color: rgba(255,255,255,0.95) !important; opacity: 1 !important; }
        .coach-company-pill:hover:not(:disabled):not([aria-pressed="true"]) { transform: translateY(-1px) scale(1.02) !important; border-color: rgba(0,200,240,0.35) !important; color: rgba(255,255,255,0.88) !important; background: rgba(255,255,255,0.09) !important; opacity: 1 !important; }
        .coach-lift-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,20,80,0.18); }
        @media (max-width: 960px) { .coach-two-col { grid-template-columns: 1fr !important; } }
        @media (max-width: 680px) { .coach-page { padding: 18px 14px 60px !important; } }
        .coach-page ::-webkit-scrollbar { width: 4px; height: 4px; }
        .coach-page ::-webkit-scrollbar-track { background: transparent; }
        .coach-page ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) { .coach-page * { animation: none !important; transition-duration: 0.01ms !important; } }
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
          <SectionErrorBoundary><WeaknessRadar analyticsData={analyticsData} navigate={navigate} /></SectionErrorBoundary>
        </AnimatedSection>

        <SectionDivider label="COMPANY TARGETING" />
        <AnimatedSection delay={0}>
          <SectionErrorBoundary><CompanyReadiness analyticsData={analyticsData} cacheKeys={cacheKeys} /></SectionErrorBoundary>
        </AnimatedSection>

        <SectionDivider label="SESSION REVIEW" />
        <AnimatedSection delay={0}>
          <SectionErrorBoundary><SessionBreakdown breakdownData={breakdownData} analyticsData={analyticsData} cacheKeys={cacheKeys} /></SectionErrorBoundary>
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
                {NAV_LINKS.map(({ label, path }) => (
                  <button key={path} onClick={() => navigate(path)} style={{ border: `1px solid ${C.borderMd}`, borderRadius: 9, background: C.cardAlt, color: C.sub, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F.body, transition: "all 0.15s" }}>
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