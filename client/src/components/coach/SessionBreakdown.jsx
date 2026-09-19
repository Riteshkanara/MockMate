import { useState, useRef, useCallback, useEffect, memo } from "react";
import PropTypes from "prop-types";
import { getAIFreeform } from '../../Services/interviewService';
import {
  C, F,
  readCache, writeCache,
  scoreColor,
  parseDebriefSections,
  Eyebrow, CacheTagLight,
  LightCard,
  HighlightedText,
} from "./coachShared";

const DEBRIEF_IDLE_SECTIONS = [
  { label: "WHAT HAPPENED",   color: C.blue400, lines: [100, 80, 65] },
  { label: "THE BRIGHT SPOT", color: C.green,   lines: [100, 70]     },
  { label: "THE LESSON",      color: C.amber,   lines: [100, 85, 55] },
  { label: "DO THIS NEXT",    color: C.cyan400, lines: [100, 60]     },
];

const DebriefIdlePlaceholder = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      {DEBRIEF_IDLE_SECTIONS.map((s, i) => (
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


const DEBRIEF_ACCENTS = {
  "WHAT HAPPENED":   C.blue400,
  "THE BRIGHT SPOT": C.green,
  "THE LESSON":      C.amber,
  "DO THIS NEXT":    C.cyan400,
};

const DEBRIEF_SECTION_CONFIG = {
  "WHAT HAPPENED":   { icon: "📊", desc: "Session overview" },
  "THE BRIGHT SPOT": { icon: "✨", desc: "Your win"         },
  "THE LESSON":      { icon: "🎯", desc: "Key takeaway"     },
  "DO THIS NEXT":    { icon: "⚡", desc: "Next action"      },
};

const DEBRIEF_LOADING_STEPS = ["Reading your per-question data…", "Identifying patterns…", "Writing your debrief…"];

const buildDebriefPrompt = (breakdownData, analyticsData) => {
  const { questions = [], sessionScore, avgTimeTaken, skipRate, sessionMode } = breakdownData;
  const answered  = questions.filter((q) => !q.skipped);
  const perfect   = answered.filter((q) => q.score >= 90).length;
  const struggled = answered.filter((q) => q.score < 50);
  const irs       = analyticsData?.irs ?? 0;
  const qSummary  = answered.slice(0, 8).map((q) => `Q${q.index}: ${q.topic || "unknown"} — ${q.score}/100 (${q.timeTaken}s)`).join("\n");
  return `You are coach, a placement coach reviewing a mock interview session for a final-year CS student. Analyze this like a coach watching game footage — specific, honest, no filler.

SESSION DATA:
- Score: ${sessionScore}/100 | Mode: ${sessionMode} | Student IRS: ${irs}/100
- Avg time per question: ${avgTimeTaken}s | Skip rate: ${skipRate}%
- Perfect answers (90+): ${perfect} out of ${answered.length} answered
- Questions below 50: ${struggled.length} — topics: ${struggled.map((q) => q.topic || "unknown").join(", ") || "none identified"}
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
};

// — SessionBreakdown
export const SessionBreakdown = memo(({ breakdownData, analyticsData, cacheKeys }) => {
  const [debrief, setDebrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [cacheTs, setCacheTs] = useState(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const cached = readCache(cacheKeys.debrief);
    if (cached?.debrief) { setDebrief(cached.debrief); setDone(true); setCacheTs(cached.ts); }
    else { setDebrief(null); setDone(false); setCacheTs(null); }
  }, [cacheKeys.debrief]);

  const generate = useCallback(async () => {
    if (!breakdownData?.questions?.length || inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setDone(false); setDebrief(null); setCacheTs(null);
    try {
      const text     = await getAIFreeform(buildDebriefPrompt(breakdownData, analyticsData), 600);
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
  }, [breakdownData, analyticsData, cacheKeys.debrief]);

  if (!breakdownData?.questions?.length) return null;

  const { sessionScore, sessionDate, totalQuestions, sessionMode } = breakdownData;
  const questions  = breakdownData.questions || [];
  const allScores  = questions.filter((q) => !q.skipped).map((q) => q.score);
  const bestScore  = allScores.length ? Math.max(...allScores) : null;
  const dateStr    = sessionDate ? new Date(sessionDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "Last session";

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
        <button onClick={generate} disabled={loading}
          style={{ border: "none", borderRadius: 10, background: loading ? C.cardAlt : `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, color: loading ? C.muted : "#fff", padding: "10px 20px", fontSize: 12.5, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: F.body, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(26,110,255,0.25)" }}>
          {loading
            ? <><span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.border}`, borderTopColor: C.blue500, borderRadius: "50%", animation: "coachSpin 0.7s linear infinite" }} /> Reviewing…</>
            : done ? "↺ Re-debrief" : "🎬 Get Debrief"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 5, marginBottom: 20, flexWrap: "wrap" }} role="list" aria-label="Per-question scores">
        {questions.map((q, i) => {
          const isBestQ  = !q.skipped && q.score === bestScore && bestScore !== null;
          const isZero   = !q.skipped && q.score === 0;
          const chipSize = isBestQ ? 40 : 34;
          return (
            <div key={i} role="listitem" title={`Q${q.index}: ${q.topic || ""} — ${q.skipped ? "Skipped" : `${q.score}/100`}`}
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
          {DEBRIEF_LOADING_STEPS.map((msg, i) => (
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
              const cfg = DEBRIEF_SECTION_CONFIG[s.heading] || { icon: "•", desc: "" };
              return (
                <div key={i} className="coach-lift-card" style={{ borderRadius: 16, background: C.cardAlt, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}>
                  <div style={{ height: 3, background: `linear-gradient(90deg, ${s.accent}, ${s.accent}44)`, flexShrink: 0 }} />
                  <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: `${s.accent}14`, border: `1.5px solid ${s.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{cfg.icon}</div>
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

SessionBreakdown.propTypes = {
  breakdownData: PropTypes.object,
  analyticsData: PropTypes.object,
  cacheKeys:     PropTypes.object.isRequired,
};