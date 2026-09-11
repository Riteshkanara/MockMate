import { useState, useEffect, useMemo, useCallback, useRef, Component } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";
import ScoreCard from "../components/ScoreCard";
import { retryQuestion } from "../Services/interviewService";
import { C, F } from "../styles/token";

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — RESULT PAGE v12
//
// Merges the full v11 feature set (ScoreArc dial, rotating caption block,
// drift/peak/floor progression header, pace-vs-score quadrants, answer-type
// breakdown, repeated-mistake detector, streak/badges, downloadable share
// card, question review with search/filter/retry, mission-report mount)
// onto the app's real token system (styles/token.js) and reuses the exact
// hero treatment from the landing page (Home.jsx) — same 135° navy → blue →
// cyan gradient, same starfield dot layer, same scan-line sweep — so the
// result page's hero reads as the same product as the marketing hero
// instead of a bespoke gradient invented just for this page.
// ═══════════════════════════════════════════════════════════════════════════

const cardAlt = C.cardAlt;

// ─── Pure helpers ───────────────────────────────────────────────────────────
const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const scoreColor = (s) => {
  const n = clamp(s);
  if (n >= 80) return C.green;
  if (n >= 60) return C.blue500;
  if (n >= 40) return C.amber;
  return C.red;
};
const scoreTint = (s) => {
  const n = clamp(s);
  if (n >= 80) return C.greenTint;
  if (n >= 60) return C.blue50;
  if (n >= 40) return C.amberTint;
  return C.redTint;
};

// Grade system — drives the ScoreArc color/glow and the hero verdict tone.
// Colors pulled from real token aliases (no invented hex values): violet
// for the top tier, green for strong, blue for solid, amber for developing,
// red for needs-practice — same semantic ladder Dashboard/ScoreCard use.
const GRADE_MAP = [
  { min: 90, grade: "S", glyph: "◆", desc: "Elite",          accent: C.violet, tint: C.violetTint, glow: C.violet },
  { min: 80, grade: "A", glyph: "▲", desc: "Strong",         accent: C.green,  tint: C.greenTint,  glow: C.green  },
  { min: 70, grade: "B", glyph: "●", desc: "Solid",          accent: C.blue500,tint: C.blue50,     glow: C.blue500},
  { min: 60, grade: "C", glyph: "■", desc: "Developing",     accent: C.amber,  tint: C.amberTint,  glow: C.amber  },
  { min:  0, grade: "D", glyph: "▼", desc: "Needs Practice", accent: C.red,    tint: C.redTint,    glow: C.red    },
];
const getGrade = (s) => GRADE_MAP.find(g => s >= g.min) || GRADE_MAP[GRADE_MAP.length - 1];
const getLabel = (s) => getGrade(s).desc;

const getVerdict = (s) => {
  if (s >= 80) return { headline: "You are building reliable interview form.", body: "Fundamentals are landing well. The fastest gains now come from tightening weak spots, not adding new topics." };
  if (s >= 60) return { headline: "The foundation is there — sharpen the edges.", body: "Enough signal here to improve fast. Focus on the questions where depth or clarity dropped." };
  return { headline: "This session exposed useful gaps.", body: "Treat this as a diagnostic. Your weakest answers are the roadmap for the next rep." };
};

const formatTime = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};

const toOneLine = (text, maxLen = 100) => {
  if (!text) return "";
  const s = (text.split(/(?<=[.!?])\s+/)[0] || text).trim();
  return s.length <= maxLen ? s : `${s.slice(0, maxLen - 1).trim()}…`;
};

const getTakeaway = (question) => {
  if (question.skipped) return { text: "Skipped — no answer submitted.", tone: "neutral" };
  const objective = ["mcq", "aptitude"].includes(question.questionType);
  const fb = question.aiFeedback;
  if (objective) {
    if (fb?.correct === true) return { text: "Correct answer.", tone: "good" };
    if (fb?.correct === false) return { text: "Incorrect — see the explanation below.", tone: "bad" };
    return { text: "Answer recorded.", tone: "neutral" };
  }
  if (!fb || fb.aiAvailable === false) return { text: "AI evaluation unavailable for this answer.", tone: "neutral" };
  const score = clamp(fb.score);
  if (score >= 80 && fb.good) return { text: toOneLine(fb.good), tone: "good" };
  if (score < 60 && fb.missing) return { text: toOneLine(fb.missing), tone: "bad" };
  if (fb.tip) return { text: toOneLine(fb.tip), tone: "neutral" };
  if (fb.good) return { text: toOneLine(fb.good), tone: "neutral" };
  return { text: "Reviewed — open for the full breakdown.", tone: "neutral" };
};

const toneColor = (tone) => (tone === "good" ? C.green : tone === "bad" ? C.red : C.sub);

// ─── Feedback normalization ────────────────────────────────────────────────
const normalizeFeedback = (question) => {
  if (!question) return null;
  const raw = question.feedback;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      score: typeof question.score === "number" ? question.score : Number(question.score || 0),
      correct: question.correct ?? parsed.correct ?? null,
      good: parsed.good || "",
      missing: parsed.missing || "",
      idealHint: parsed.idealHint || "",
      tip: parsed.tip || "",
      sampleAnswer: parsed.sampleAnswer || "",
      aiAvailable: parsed.aiAvailable !== false,
      fallback: parsed.fallback === true,
    };
  } catch {
    return null;
  }
};

const normalizeQuestion = (question, index) => {
  const aiFeedback = normalizeFeedback(question);
  const scoreValue = typeof question?.score === "number" ? question.score : Number(question?.score || 0);
  const hasTopicField = typeof question?.topic === "string" && question.topic.trim().length > 0;
  return {
    ...question,
    index,
    text: question?.text || question?.question || `Question ${index + 1}`,
    topic: hasTopicField ? question.topic.trim() : "General",
    hasTopicField,
    questionType: question?.questionType || "open",
    userAnswer: question?.userAnswer || "",
    skipped: Boolean(question?.skipped),
    score: clamp(scoreValue),
    aiFeedback,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════
class SectionErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error("[Result section error]", err); }
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

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED SECTION — IntersectionObserver reveal
// ═══════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════
// SCORE ARC — SVG dial, animated count-up, grade-colored fill + glow.
// ═══════════════════════════════════════════════════════════════════════════
const ScoreArc = ({ score }) => {
  const [displayed, setDisplayed] = useState(0);
  const [arcProgress, setArcProgress] = useState(0);
  const grade = getGrade(score);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 1100;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(eased * score));
      setArcProgress(eased * score);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const delay = setTimeout(() => { frame = requestAnimationFrame(tick); }, 180);
    return () => { clearTimeout(delay); cancelAnimationFrame(frame); };
  }, [score]);

  const R = 88, CX = 110, CY = 114;
  const startAngle = 150;
  const sweep = 240;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const arcPath = (pct) => {
    const minPct = Math.max(pct, 4);
    const angle = startAngle + (sweep * minPct) / 100;
    const sx = CX + R * Math.cos(toRad(startAngle));
    const sy = CY + R * Math.sin(toRad(startAngle));
    const ex = CX + R * Math.cos(toRad(angle));
    const ey = CY + R * Math.sin(toRad(angle));
    const large = (sweep * minPct) / 100 > 180 ? 1 : 0;
    if (pct >= 99.9) {
      const mx = CX + R * Math.cos(toRad(startAngle + sweep / 2));
      const my = CY + R * Math.sin(toRad(startAngle + sweep / 2));
      return `M ${sx} ${sy} A ${R} ${R} 0 0 1 ${mx} ${my} A ${R} ${R} 0 0 1 ${ex} ${ey}`;
    }
    return `M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`;
  };

  const trackPath = arcPath(100);
  const fillPath = arcPath(arcProgress);

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={220} height={210} viewBox="0 0 220 210" style={{ overflow: "visible" }}>
        <circle cx={CX} cy={CY} r={R + 16} fill="none" stroke={grade.accent} strokeWidth="1.5" opacity="0.14" />
        <circle cx={CX} cy={CY} r={R + 28} fill="none" stroke={grade.accent} strokeWidth="1" opacity="0.06" />
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke={grade.accent} strokeWidth="11" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 10px ${grade.glow}88)` }} />
        )}
        {[0, 25, 50, 75, 100].map(pct => {
          const angle = toRad(startAngle + (sweep * pct) / 100);
          const inner = R - 7, outer = R + 7;
          return (
            <line key={pct}
              x1={CX + inner * Math.cos(angle)} y1={CY + inner * Math.sin(angle)}
              x2={CX + outer * Math.cos(angle)} y2={CY + outer * Math.sin(angle)}
              stroke="rgba(255,255,255,0.2)" strokeWidth={pct === 0 || pct === 100 ? "2.5" : "1.5"} />
          );
        })}
        <text x={CX} y={CY - 10} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: F.display, fontSize: 52, fontWeight: 900, fill: "#fff", letterSpacing: "-2px" }}>
          {displayed}
        </text>
        <text x={CX} y={CY + 24} textAnchor="middle"
          style={{ fontFamily: F.mono, fontSize: 10.5, fill: "rgba(255,255,255,0.38)", letterSpacing: "0.5px" }}>
          / 100
        </text>
        <g transform={`translate(${CX - 26}, ${CY + 50})`}>
          <rect width="52" height="24" rx="7" fill={grade.accent} fillOpacity="0.18" stroke={grade.accent} strokeOpacity="0.45" strokeWidth="1" />
          <text x="26" y="12" textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, fill: grade.accent, letterSpacing: "0.3px" }}>
            {grade.grade} · {grade.desc}
          </text>
        </g>
      </svg>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CAPTION BLOCK — rotating frosted insight panel inside the hero, mirrors the
// transitioning caption pattern used elsewhere in the marketing hero.
// ═══════════════════════════════════════════════════════════════════════════
const CaptionBlock = ({ captions, accentColor }) => {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % captions.length); setVisible(true); }, 300);
    }, 3400);
    return () => clearInterval(interval);
  }, [captions.length]);

  const item = captions[idx];
  return (
    <div style={{
      background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16,
      padding: "18px 20px", minHeight: 108,
      transition: "opacity 0.3s ease, transform 0.3s ease",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(6px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${accentColor}22`, border: `1px solid ${accentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
          {item.icon}
        </div>
        <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: "0.8px", textTransform: "uppercase" }}>{item.tag}</span>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {captions.map((_, i) => (
            <div key={i} style={{ width: i === idx ? 16 : 5, height: 5, borderRadius: 999, background: i === idx ? accentColor : "rgba(255,255,255,0.25)", transition: "all 0.3s ease" }} />
          ))}
        </div>
      </div>
      <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.4, marginBottom: 5 }}>{item.headline}</div>
      <div style={{ fontFamily: F.body, fontSize: 11.5, color: "rgba(255,255,255,0.58)", lineHeight: 1.55 }}>{item.body}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// RESULT HERO — reuses the exact landing-page gradient/starfield/scan-sweep
// from Home.jsx, with the ScoreArc as visual anchor left and the verdict
// headline + frosted mini-stats + rotating caption right.
// ═══════════════════════════════════════════════════════════════════════════
const ResultHero = ({ result, navigate, onCopy, copied, onDownloadImage, downloading }) => {
  const score = result.score;
  const v = getVerdict(score);
  const trendDelta = result.trendDelta;
  const hasTrend = trendDelta != null && result.scoreHistory?.length >= 2;
  const grade = getGrade(score);

  const captions = [
    { icon: "📊", tag: "Session insight", headline: score >= 80 ? "Strong fundamentals across the board." : score >= 60 ? "Foundation is there — edges need work." : "Clear gaps identified. Use them as a roadmap.", body: score >= 80 ? "Your answers show consistency and depth. Now isolate weak spots." : score >= 60 ? "You're in range. A few targeted reps will push you to the next tier." : "Every weak answer is a specific, fixable thing. Start there." },
    { icon: "🎯", tag: "Next move", headline: result.weakAnswers > 0 ? `${result.weakAnswers} answer${result.weakAnswers > 1 ? "s" : ""} below 60 — drill those topics.` : "All answers cleared 60. Raise difficulty next.", body: result.weakAnswers > 0 ? "Open the question review below. The feedback on those answers is your training plan." : "You're past the basics. Add harder questions to keep the signal useful." },
    { icon: "⚡", tag: "Pace check", headline: `${formatTime(result.averageTime)} per question on average.`, body: result.averageTime < 90 ? "Quick responses — verify you're giving depth, not just speed." : result.averageTime > 180 ? "Taking your time. Check if slower answers scored proportionally higher." : "Pace is in a healthy range. Focus on quality over speed." },
    { icon: "📈", tag: "Trend", headline: hasTrend ? `${trendDelta >= 0 ? "+" : ""}${Number(trendDelta).toFixed(1)} pts vs last session.` : `${result.answeredQuestions}/${result.totalQuestions} questions answered.`, body: hasTrend && trendDelta >= 0 ? "You're moving in the right direction. Keep the streak." : hasTrend ? "Score dipped — check if it was topic mix or answer depth." : result.strongAnswers > 0 ? `${result.strongAnswers} strong answer${result.strongAnswers > 1 ? "s" : ""} scored 80+.` : "First rep is always a diagnostic. Use it well." },
  ];

  return (
    <section style={S.hero} className="res-hero">
      {/* Exact landing-page scan sweep + starfield dot layer */}
      <div style={S.heroScan} />
      <div style={{ ...S.heroScan, width: "10%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.045), transparent)", animation: "mmHeroScan 13s linear infinite", animationDelay: "3.2s" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

      {/* Grade-tinted radial bloom */}
      <div style={{ position: "absolute", right: -60, bottom: -80, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${grade.glow}20 0%, transparent 68%)`, pointerEvents: "none" }} />

      <div style={S.heroGrid} className="res-hero-grid">
        {/* LEFT: Arc + trend */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <ScoreArc score={score} />
          {hasTrend && (
            <div style={S.trendChip}>
              <span style={{ color: trendDelta >= 0 ? C.green : C.amber, fontWeight: 800 }}>{trendDelta >= 0 ? "▲" : "▼"}</span>
              <span style={{ color: "rgba(255,255,255,0.62)", fontSize: 10.5 }}>{Math.abs(Number(trendDelta)).toFixed(1)} pts vs last session</span>
            </div>
          )}
        </div>

        {/* RIGHT: Verdict + mini-stats + caption + actions */}
        <div>
          <div style={S.heroKicker}>Post-interview debrief</div>
          <h1 style={S.heroH1} className="res-hero-h1">{v.headline}</h1>
          <p style={S.heroSub} className="res-hero-sub">{v.body}</p>

          <div style={S.miniStats}>
            <div style={S.miniStat}><span style={{ ...S.miniVal, color: C.green }}>{result.strongAnswers}</span><span style={S.miniLabel}>strong</span></div>
            <div style={S.miniDivider} />
            <div style={S.miniStat}><span style={{ ...S.miniVal, color: result.weakAnswers > 0 ? C.amber : "rgba(255,255,255,0.45)" }}>{result.weakAnswers}</span><span style={S.miniLabel}>to fix</span></div>
            <div style={S.miniDivider} />
            <div style={S.miniStat}><span style={{ ...S.miniVal, color: C.cyan400 }}>{formatTime(result.averageTime)}</span><span style={S.miniLabel}>avg / q</span></div>
            <div style={S.miniDivider} />
            <div style={S.miniStat}><span style={{ ...S.miniVal, color: "rgba(255,255,255,0.7)" }}>{result.answeredQuestions}/{result.totalQuestions}</span><span style={S.miniLabel}>answered</span></div>
          </div>

          <div style={{ marginTop: 16, maxWidth: 380 }}>
            <CaptionBlock captions={captions} accentColor={grade.accent} />
          </div>

          <div style={S.heroActions} className="res-hero-actions">
            <button style={S.btnPrimary} className="res-btn-primary" onClick={() => navigate("/interview")}>Start another interview</button>
            <button style={S.btnGhost} className="res-btn-ghost" onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button style={S.btnGhost} className="res-btn-ghost" onClick={onCopy}>{copied ? "Copied ✓" : "Copy summary"}</button>
            <button style={S.btnGhost} className="res-btn-ghost" onClick={onDownloadImage} disabled={downloading}>{downloading ? "Preparing…" : "Download image"}</button>
          </div>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARE CARD — off-screen, captured to PNG for download.
// ═══════════════════════════════════════════════════════════════════════════
const ShareCard = ({ result, cardRef }) => {
  const { score, totalQuestions, answeredQuestions, strongAnswers, weakAnswers, topTopic, weakestTopicName } = result;
  const v = getVerdict(score);
  const grade = getGrade(score);

  return (
    <div ref={cardRef} style={{
      position: "fixed", top: -9999, left: -9999, width: 520,
      fontFamily: F.body, borderRadius: 24, overflow: "hidden",
      background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 44%, ${C.blue600} 72%, ${C.cyan600} 100%)`,
    }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${grade.accent}, ${grade.glow})` }} />
      <div style={{ padding: "32px 36px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", color: "rgba(255,255,255,0.38)", textTransform: "uppercase" }}>MockMate · Session Result</div>
          <div style={{ fontFamily: F.mono, fontSize: 9, padding: "4px 10px", borderRadius: 6, background: `${grade.accent}20`, color: grade.accent, border: `1px solid ${grade.accent}40`, fontWeight: 700 }}>{grade.grade} · {grade.desc}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
          <span style={{ fontFamily: F.display, fontSize: 88, fontWeight: 900, color: "#fff", letterSpacing: "-4px", lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.32)" }}>/100</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.5, marginBottom: 8, maxWidth: 400 }}>{v.headline}</div>
        {weakestTopicName && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 4 }}>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>working on</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.amber }}>{weakestTopicName}</span>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(0,0,0,0.18)" }}>
        {[
          { label: "answered", value: `${answeredQuestions}/${totalQuestions}` },
          { label: "strong", value: strongAnswers },
          { label: "to fix", value: weakAnswers },
          { label: "top topic", value: topTopic || "—" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "14px 12px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none", textAlign: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 8, color: "rgba(255,255,255,0.38)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px 36px", background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: grade.accent, letterSpacing: "0.5px" }}>mockmate.app</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>AI interview coaching</div>
      </div>
    </div>
  );
};

// ─── Stat rail ─────────────────────────────────────────────────────────────
const RailStat = ({ label, value, unit, sub, color }) => (
  <div style={S.railCell} className="res-rail-cell">
    <div style={S.railLabel}>{label}</div>
    <div style={S.railValRow}>
      <span style={{ ...S.railVal, color }} className="res-rail-val">{value}</span>
      {unit && <span style={S.railUnit}>{unit}</span>}
    </div>
    <div style={S.railSub}>{sub}</div>
  </div>
);

const StatRail = ({ result }) => (
  <section style={S.statRail} className="res-stat-rail">
    <RailStat label="Answered" value={`${result.answeredQuestions}/${result.totalQuestions}`} sub={result.skippedQuestions > 0 ? `${result.skippedQuestions} skipped` : "No skips"} color={C.text} />
    <RailStat label="Strong answers" value={result.strongAnswers} sub="Scored 80 or above" color={C.green} />
    <RailStat label="Needs work" value={result.weakAnswers} sub="Scored below 60" color={result.weakAnswers > 0 ? C.orange : C.muted} />
    <RailStat label="Avg time / question" value={formatTime(result.averageTime)} sub="Across answered questions" color={C.blue500} />
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════
// NEXT STEP BANNER — grade-aware gradient tint + CTA glow
// ═══════════════════════════════════════════════════════════════════════════
const NextStepBanner = ({ nextStepText, weakestTopic, navigate, score = 0 }) => {
  const grade = getGrade(score);
  return (
    <section style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 24, padding: "26px 30px", marginBottom: 18, borderRadius: 20,
      background: `linear-gradient(135deg, ${grade.tint} 0%, ${C.blue50} 100%)`,
      border: `1px solid ${grade.accent}30`, boxShadow: C.shadow,
    }} className="res-banner">
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: "1.4px", color: grade.accent, marginBottom: 7 }}>what to do next</div>
        <h2 style={{ margin: "0 0 8px", fontFamily: F.display, fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: "-0.4px" }}>
          {weakestTopic ? <>Drill <span style={{ color: grade.accent }}>{weakestTopic.topic}</span> next</> : "Queue another rep"}
        </h2>
        <p style={{ margin: 0, fontSize: 12.5, color: C.sub, maxWidth: 520, lineHeight: 1.6 }}>{nextStepText}</p>
      </div>
      <button onClick={() => navigate("/interview")} style={{
        border: "none", borderRadius: 11, flexShrink: 0,
        background: `linear-gradient(135deg, ${grade.glow}, ${grade.accent})`,
        color: "#fff", padding: "12px 22px", fontSize: 13, fontWeight: 800,
        fontFamily: F.body, cursor: "pointer",
        boxShadow: `0 4px 18px ${grade.accent}55`,
        textShadow: "0 1px 2px rgba(0,0,0,0.18)",
      }} className="res-btn-gradient">
        Start another interview →
      </button>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SCORE PROGRESSION HEADER — drift chip + avg/peak/floor + most-improved jump
// ═══════════════════════════════════════════════════════════════════════════
const ScoreProgressionHeader = ({ questions }) => {
  const pts = questions
    .filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number")
    .map(q => ({ score: q.aiFeedback.score, index: q.index, topic: q.topic }));

  if (pts.length < 2) return null;

  const drift = pts[pts.length - 1].score - pts[0].score;
  const avg = Math.round(pts.reduce((s, p) => s + p.score, 0) / pts.length);
  const peak = Math.max(...pts.map(p => p.score));
  const floor = Math.min(...pts.map(p => p.score));

  let biggestJump = 0, jumpFrom = null, jumpTo = null;
  for (let i = 1; i < pts.length; i++) {
    const delta = pts[i].score - pts[i - 1].score;
    if (delta > biggestJump) { biggestJump = delta; jumpFrom = pts[i - 1]; jumpTo = pts[i]; }
  }

  const driftPositive = drift >= 0;

  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 999, background: driftPositive ? C.greenTint : C.redTint, border: `1px solid ${driftPositive ? C.green : C.red}30` }}>
        <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: driftPositive ? C.green : C.red, lineHeight: 1 }}>{driftPositive ? "+" : ""}{drift} pts</span>
        <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.sub }}>session drift</span>
      </div>
      {[{ label: "avg", value: avg, color: C.blue500 }, { label: "peak", value: peak, color: C.green }, { label: "floor", value: floor, color: C.red }].map(c => (
        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 999, background: cardAlt, border: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: c.color }}>{c.value}</span>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{c.label}</span>
        </div>
      ))}
      {biggestJump >= 10 && jumpFrom && jumpTo && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 999, background: C.violetTint, border: `1px solid ${C.violet}40` }}>
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.violet, fontWeight: 700 }}>biggest jump Q{jumpFrom.index + 1}→Q{jumpTo.index + 1}: +{biggestJump} pts</span>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SCORE PROGRESSION CHART
// ═══════════════════════════════════════════════════════════════════════════
const ScoreProgression = ({ questions }) => {
  const points = questions
    .filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number")
    .map(q => q.aiFeedback.score);

  if (points.length < 2) {
    const single = points[0];
    return (
      <div style={{ padding: "22px 20px", borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` }}>
        {single != null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: F.display, fontSize: 34, fontWeight: 900, color: scoreColor(single), flexShrink: 0 }}>{single}</div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.55 }}>Only one question was scored this session, so there's no curve to plot yet.</div>
          </div>
        ) : (
          <div style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>No evaluated questions yet.</div>
        )}
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const avg = points.reduce((s, v) => s + v, 0) / points.length;
  const variance = points.reduce((s, v) => s + (v - avg) ** 2, 0) / points.length;
  const stdDev = Math.round(Math.sqrt(variance));
  const spread = max - min;
  const consistencyRead = spread <= 15
    ? { label: "Steady", detail: "Score barely moved — even, predictable form.", color: C.green }
    : spread <= 35
    ? { label: "Some swing", detail: "A moderate spread between your best and weakest answers.", color: C.blue500 }
    : { label: "High swing", detail: "A big gap between best and weakest — form varied a lot within this session.", color: C.amber };

  const W = 640, H = 180, padX = 26, padY = 20;
  const x = i => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = v => H - padY - (clamp(v) / 100) * (H - padY * 2);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L ${x(points.length - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`;
  const bandTop = y(max), bandBottom = y(min);

  return (
    <div>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 380, display: "block" }}>
          <defs>
            <linearGradient id="resAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue500} stopOpacity="0.18" />
              <stop offset="100%" stopColor={C.blue500} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 60, 80].map(l => (
            <g key={l}>
              <line x1={padX} x2={W - padX} y1={y(l)} y2={y(l)} stroke={C.border} strokeDasharray="4 5" />
              <text x={2} y={y(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text>
            </g>
          ))}
          {spread > 0 && <rect x={padX} y={bandTop} width={W - padX * 2} height={bandBottom - bandTop} fill={consistencyRead.color} opacity={0.07} />}
          <line x1={padX} x2={W - padX} y1={y(avg)} y2={y(avg)} stroke={C.muted} strokeWidth="1" strokeDasharray="2 4" opacity={0.55} />
          <path d={area} fill="url(#resAreaGrad)" />
          <path d={path} fill="none" stroke={C.blue500} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((v, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r="5" fill={scoreColor(v)} stroke="#fff" strokeWidth="2" />
              <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="8" fontFamily={F.mono} fill={C.muted}>Q{i + 1}</text>
            </g>
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        <span style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "5px 11px", whiteSpace: "nowrap", color: consistencyRead.color, background: `${consistencyRead.color}14`, border: `1px solid ${consistencyRead.color}30` }}>
          {consistencyRead.label} · ±{stdDev} pts
        </span>
        <span style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>{consistencyRead.detail}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TOPIC BREAKDOWN — two-layer bar race, rank glyph, dotted reference line
// ═══════════════════════════════════════════════════════════════════════════
const RANK_GLYPHS = ["◆", "▲", "●", "■", "▼"];

const TopicBreakdown = ({ topicAverages, status, onTopicClick }) => {
  const sorted = [...topicAverages].sort((a, b) => b.avg - a.avg);
  const bestAvg = sorted[0]?.avg || 1;

  if (!sorted.length) {
    if (status === "no-eval") return <p style={S.cardSub}>No questions scored yet — topic breakdown appears once questions are evaluated.</p>;
    if (status === "no-topic-field") return <p style={S.cardSub}>Questions scored but none had a topic label — this needs the topic field from interview data.</p>;
    return <p style={S.cardSub}>Topic-level scoring not available for this session.</p>;
  }

  return (
    <div style={S.dimList}>
      {sorted.map((t, rank) => {
        const col = scoreColor(t.avg);
        const glyph = RANK_GLYPHS[Math.min(rank, RANK_GLYPHS.length - 1)];
        const relPct = (t.avg / bestAvg) * 100;
        const absPct = t.avg;
        return (
          <button key={t.topic} style={S.dimRow} className="res-dim-row" onClick={() => onTopicClick?.(t.topic)}>
            <div style={S.dimMeta}>
              <div style={S.dimLeft}>
                <span style={{ fontSize: 11, fontWeight: 700, color: col, flexShrink: 0, width: 14, textAlign: "center" }}>{glyph}</span>
                <span style={S.dimName}>{t.topic}</span>
              </div>
              <span style={{ ...S.dimScore, color: col }}>{t.avg}</span>
            </div>
            <div style={{ ...S.dimTrack, position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${relPct}%`, background: `${col}22`, borderRadius: 999, transition: "width 1s cubic-bezier(.16,1,.3,1)" }} />
              <div style={{ position: "relative", height: "100%", width: `${absPct}%`, background: col, borderRadius: 999, transition: "width 1.2s cubic-bezier(.16,1,.3,1)" }} />
              {rank === 0 && <div style={{ position: "absolute", right: 0, top: -3, bottom: -3, width: 2, background: `${col}60`, borderRadius: 1 }} />}
            </div>
            {rank === 0 && <div style={{ marginTop: 4, fontSize: 9.5, color: C.muted, fontFamily: F.mono }}>session best · reference</div>}
          </button>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PACE VS SCORE — labeled quadrant chart, split at fixed 60 threshold
// ═══════════════════════════════════════════════════════════════════════════
const PaceVsScoreLabeled = ({ questions }) => {
  const points = questions
    .filter(q => !q.skipped && typeof q.aiFeedback?.score === "number" && Number(q.timeTaken) > 0)
    .map(q => ({ time: Number(q.timeTaken), score: clamp(q.aiFeedback.score), index: q.index, topic: q.topic }));

  if (points.length < 3) {
    return (
      <div style={{ padding: "20px", borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` }}>
        {points.length > 0 ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {points.map(p => (
                <div key={p.index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text }}>Q{p.index + 1} · {p.topic}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>{formatTime(p.time)}</span>
                    <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: scoreColor(p.score) }}>{p.score}</span>
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: C.sub }}>Need at least 3 timed, evaluated questions for the pace chart — {points.length} so far.</div>
          </>
        ) : (
          <div style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>No timed, evaluated questions yet.</div>
        )}
      </div>
    );
  }

  const times = points.map(p => p.time);
  const sortedTimes = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sortedTimes.length / 2);
  const medianTime = sortedTimes.length % 2 ? sortedTimes[mid] : (sortedTimes[mid - 1] + sortedTimes[mid]) / 2;
  const scoreThreshold = 60;

  const fast = points.filter(p => p.time <= medianTime);
  const slow = points.filter(p => p.time > medianTime);
  const avgOf = list => (list.length ? Math.round(list.reduce((s, p) => s + p.score, 0) / list.length) : null);
  const fastAvg = avgOf(fast);
  const slowAvg = avgOf(slow);

  let read = null;
  if (fastAvg != null && slowAvg != null) {
    const gap = fastAvg - slowAvg;
    if (gap >= 12) read = { text: `Quicker answers scored ${gap} pts higher — extra time isn't converting here.`, color: C.blue500 };
    else if (gap <= -12) read = { text: `Slower, considered answers scored ${Math.abs(gap)} pts higher — depth pays off.`, color: C.green };
    else read = { text: "Score held steady regardless of pace — timing isn't the lever this session.", color: C.muted };
  }

  const W = 640, H = 220, padX = 34, padY = 24;
  const maxTime = Math.max(...times) * 1.08;
  const xp = t => padX + (Math.min(t, maxTime) / maxTime) * (W - padX * 2);
  const yp = s => H - padY - (clamp(s) / 100) * (H - padY * 2);
  const midX = xp(medianTime);
  const midY = yp(scoreThreshold);

  const inQ = (lx, ly, hx, hy) => points.some(p => xp(p.time) >= lx && xp(p.time) < hx && yp(p.score) >= ly && yp(p.score) < hy);
  const qLabels = [
    { label: "fast + strong", desc: "ideal", lx: padX, ly: padY, hx: midX, hy: midY, col: C.green, tx: padX + 6, ty: padY + 14 },
    { label: "slow + strong", desc: "depth works", lx: midX, ly: padY, hx: W, hy: midY, col: C.blue500, tx: midX + 8, ty: padY + 14 },
    { label: "fast + weak", desc: "rushing", lx: padX, ly: midY, hx: midX, hy: H, col: C.amber, tx: padX + 6, ty: midY + 14 },
    { label: "slow + weak", desc: "rethink prep", lx: midX, ly: midY, hx: W, hy: H, col: C.red, tx: midX + 8, ty: midY + 14 },
  ].filter(q => inQ(q.lx, q.ly, q.hx, q.hy));

  return (
    <div>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 380, display: "block" }}>
          {[40, 60, 80].map(l => (
            <g key={l}>
              <line x1={padX} x2={W - padX} y1={yp(l)} y2={yp(l)} stroke={C.border} strokeDasharray="4 5" />
              <text x={2} y={yp(l) + 3} fontSize="8" fontFamily={F.mono} fill={C.faint}>{l}</text>
            </g>
          ))}
          <line x1={midX} x2={midX} y1={padY} y2={H - padY} stroke={C.borderMd} strokeDasharray="3 4" />
          <line x1={padX} x2={W - padX} y1={midY} y2={midY} stroke={C.borderMd} strokeDasharray="3 4" />
          {qLabels.map((q, i) => (
            <g key={i}>
              <text x={q.tx} y={q.ty} fontSize="8.5" fontFamily={F.mono} fontWeight="700" fill={q.col} opacity="0.72">{q.label}</text>
              <text x={q.tx} y={q.ty + 11} fontSize="7.5" fontFamily={F.mono} fill={q.col} opacity="0.42">{q.desc}</text>
            </g>
          ))}
          <text x={midX} y={H - 5} textAnchor="middle" fontSize="8" fontFamily={F.mono} fill={C.muted}>median pace · {formatTime(medianTime)}</text>
          {points.map((p, i) => (
            <circle key={i} cx={xp(p.time)} cy={yp(p.score)} r="6.5" fill={scoreColor(p.score)} fillOpacity="0.88" stroke="#fff" strokeWidth="1.5">
              <title>{`Q${p.index + 1} · ${p.topic} · ${formatTime(p.time)} · ${p.score}/100`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        {[
          { label: `faster half · ${fast.length}q`, value: fastAvg, bg: C.blue50, border: C.blue500 },
          { label: `slower half · ${slow.length}q`, value: slowAvg, bg: C.greenTint, border: C.green },
        ].map((cell, i) => (
          <div key={i} style={{ padding: "12px 14px", borderRadius: 12, background: cell.bg, border: `1px solid ${cell.border}30` }}>
            <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{cell.label}</div>
            <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.text }}>{cell.value != null ? `${cell.value}/100` : "—"}</div>
          </div>
        ))}
      </div>
      {read && <div style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{read.text}</div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ANSWER TYPE BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════
const AnswerTypeBreakdown = ({ questions }) => {
  const objective = questions.filter(q => !q.skipped && ["mcq", "aptitude"].includes(q.questionType) && q.aiFeedback?.correct != null);
  const openEnded = questions.filter(q => !q.skipped && !["mcq", "aptitude"].includes(q.questionType) && typeof q.aiFeedback?.score === "number");

  if (!objective.length && !openEnded.length) {
    return <p style={S.cardSub}>No evaluated questions yet — breakdown appears once questions are scored.</p>;
  }

  const objectiveAccuracy = objective.length ? Math.round((objective.filter(q => q.aiFeedback.correct === true).length / objective.length) * 100) : null;
  const openEndedAvg = openEnded.length ? Math.round(openEnded.reduce((s, q) => s + q.aiFeedback.score, 0) / openEnded.length) : null;

  const rows = [
    objective.length ? { label: "Objective (MCQ / aptitude)", sub: `${objective.length} question${objective.length === 1 ? "" : "s"}`, value: objectiveAccuracy, unit: "% correct" } : null,
    openEnded.length ? { label: "Open-ended", sub: `${openEnded.length} question${openEnded.length === 1 ? "" : "s"}`, value: openEndedAvg, unit: "/100 avg" } : null,
  ].filter(Boolean);

  let read = null;
  if (objectiveAccuracy != null && openEndedAvg != null) {
    const gap = objectiveAccuracy - openEndedAvg;
    if (gap >= 15) read = "Knowledge checks out, but open-ended answers are giving up points — that's a structuring and clarity gap, not a knowledge gap.";
    else if (gap <= -15) read = "Open-ended answers are outscoring objective accuracy — worth revisiting the underlying facts, not just how you explain them.";
    else read = "Both formats are landing at a similar level — no single format is dragging this session down.";
  } else if (objectiveAccuracy != null) {
    read = "Objective-only session — add open-ended questions next time to see how knowledge and communication compare.";
  } else if (openEndedAvg != null) {
    read = "Open-ended only session — add MCQ or aptitude questions to isolate raw knowledge gaps from communication ones.";
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map(r => {
          const col = scoreColor(r.value);
          return (
            <div key={r.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{r.label}</div>
                  <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{r.sub}</div>
                </div>
                <span style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: col }}>{r.value}{r.unit}</span>
              </div>
              <div style={S.dimTrack}>
                <div style={{ ...S.dimFill, width: `${r.value}%`, background: col }} />
              </div>
            </div>
          );
        })}
      </div>
      {read && <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, fontSize: 11.5, lineHeight: 1.55, color: C.sub }}>{read}</div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// REPEATED MISTAKE — keyword-repeat detector with topic-repeat fallback
// ═══════════════════════════════════════════════════════════════════════════
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "is", "are",
  "was", "were", "be", "been", "being", "this", "that", "these", "those", "it", "its",
  "as", "at", "by", "from", "not", "no", "did", "does", "do", "your", "you", "answer",
  "question", "missing", "lacked", "lacking", "lack", "more", "also", "could", "should",
  "would", "have", "has", "had", "about", "into", "than", "then", "which", "what",
  "how", "why", "when", "some", "any", "need", "needs", "needed",
  "depth", "detail", "specific", "specifics", "example", "examples", "explain",
  "explanation", "provide", "structure", "context", "clear", "clarity", "show",
  "demonstrate", "include", "consider", "important", "relevant", "response",
  "point", "points", "better", "strong", "weak", "good", "great", "well", "just",
  "make", "sure", "help", "improve", "work", "focus", "mention", "discuss",
]);

const extractKeywords = (text) => {
  if (!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOPWORDS.has(w));
};

const RepeatedMistake = ({ questions }) => {
  const weak = questions.filter(q => !q.skipped && typeof q.aiFeedback?.score === "number" && q.aiFeedback.score < 60 && q.aiFeedback.missing);
  if (weak.length < 2) return null;

  const counts = {};
  weak.forEach(q => {
    const seen = new Set(extractKeywords(q.aiFeedback.missing));
    seen.forEach(word => {
      if (!counts[word]) counts[word] = { count: 0, questions: [] };
      counts[word].count += 1;
      counts[word].questions.push(q);
    });
  });

  const [topWord, topData] = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)[0] || [];

  if (!topWord || topData.count < 2) {
    const topicCounts = {};
    weak.forEach(q => { if (!topicCounts[q.topic]) topicCounts[q.topic] = []; topicCounts[q.topic].push(q); });
    const [topTopic, topTopicQs] = Object.entries(topicCounts).sort((a, b) => b[1].length - a[1].length)[0] || [];
    if (!topTopic || topTopicQs.length < 2) return null;
    return (
      <div style={{ ...S.card, borderColor: `${C.amber}35`, background: `linear-gradient(135deg, ${C.amberTint} 0%, ${C.card} 60%)` }}>
        <div style={{ ...S.eyebrow, color: C.amber }}>Repeated mistake pattern</div>
        <h2 style={S.cardH2}><span style={{ color: C.amber }}>{topTopic}</span> — {topTopicQs.length} weak answers in one topic</h2>
        <p style={S.cardSub}>Your weakest answers concentrated in a single topic — that's a stronger signal than scattered individual feedback.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {topTopicQs.map(q => (
            <span key={q.index} style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, color: C.amber, background: C.card, border: `1px solid ${C.amber}40`, borderRadius: 999, padding: "5px 11px" }}>Q{q.index + 1} · {q.topic}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, borderColor: `${C.amber}35`, background: `linear-gradient(135deg, ${C.amberTint} 0%, ${C.card} 60%)` }}>
      <div style={{ ...S.eyebrow, color: C.amber }}>Repeated mistake pattern</div>
      <h2 style={S.cardH2}>"{topWord}" came up in {topData.count} weak answers</h2>
      <p style={S.cardSub}>The same concern showed up across {topData.count} of your {weak.length} weak answer{weak.length === 1 ? "" : "s"}. That's a stronger signal than any single question's feedback alone.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {topData.questions.map(q => (
          <span key={q.index} style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, color: C.amber, background: C.card, border: `1px solid ${C.amber}40`, borderRadius: 999, padding: "5px 11px" }}>Q{q.index + 1} · {q.topic}</span>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHT
// ═══════════════════════════════════════════════════════════════════════════
const Insight = ({ label, value, text, color, background }) => (
  <div style={{ padding: 14, borderRadius: 12, background, border: `1px solid ${color}30` }}>
    <div style={S.insightLabel}>{label}</div>
    <div style={{ ...S.insightVal, color: C.text }}>{value}</div>
    <div style={S.insightText}>{text}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// QUESTION REVIEW
// ═══════════════════════════════════════════════════════════════════════════
const FeedbackBlock = ({ label, value, color, background }) => (
  <div style={{ padding: 13, borderRadius: 12, background, border: `1px solid ${color}25` }}>
    <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color, letterSpacing: "0.5px", marginBottom: 6, textTransform: "lowercase" }}>{label}</div>
    <div style={{ fontSize: 11.5, lineHeight: 1.65, color: C.text }}>{value || "No additional readout."}</div>
  </div>
);

const Pill = ({ children, color = C.blue500, background = C.blue50 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "3px 9px", background, color, fontFamily: F.mono, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.4px", border: `1px solid ${color}30` }}>
    {children}
  </span>
);

const QuestionCard = ({ question, open, onToggle, onRetry, retrying }) => {
  const idx = question._index;
  const feedback = question.aiFeedback;
  const objective = ["mcq", "aptitude"].includes(question.questionType);
  const isEval = Boolean(feedback && feedback.aiAvailable !== false && (typeof feedback.score === "number" || objective));
  const score = isEval && !objective ? feedback.score : null;
  const takeaway = useMemo(() => getTakeaway(question), [question]);
  const hasTime = Number(question.timeTaken) > 0;
  const canRetry = !objective && !question.skipped && question.userAnswer?.trim() && question.id;

  const badgeColor = question.skipped ? C.muted
    : objective ? (feedback?.correct === true ? C.green : feedback?.correct === false ? C.red : C.muted)
    : (isEval ? scoreColor(score) : C.muted);
  const badgeBg = question.skipped ? cardAlt
    : objective ? (feedback?.correct === true ? C.greenTint : feedback?.correct === false ? C.redTint : cardAlt)
    : (isEval ? scoreTint(score) : cardAlt);

  return (
    <div style={{ border: `1px solid ${open ? C.borderMd : C.border}`, borderRadius: 14, background: open ? cardAlt : C.card, overflow: "hidden", transition: "border-color 0.2s ease, background 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <button type="button" onClick={() => onToggle(idx)} aria-expanded={open}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 14, padding: "14px 8px 14px 16px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" }}>
          <div style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}25` }}>
            {question.skipped
              ? <span style={{ fontSize: 15, fontWeight: 700 }}>—</span>
              : objective
                ? <span style={{ fontSize: 19, fontWeight: 900 }}>{feedback?.correct === true ? "✓" : feedback?.correct === false ? "✕" : "?"}</span>
                : isEval
                  ? <><span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{score}</span><span style={{ fontFamily: F.mono, fontSize: 7, opacity: 0.7, marginTop: 1 }}>/100</span></>
                  : <span style={{ fontSize: 13, fontWeight: 700 }}>—</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.faint }}>Q{idx + 1}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: C.sub }}>{question.topic}</span>
              {!question.hasTopicField && <span title="No topic field in interview data" style={{ fontSize: 9, color: C.faint }}>(untagged)</span>}
              {hasTime && <><span style={{ color: C.border }}>·</span><span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>{formatTime(question.timeTaken)}</span></>}
              {question.skipped && <Pill color={C.amber} background={C.amberTint}>skipped</Pill>}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{question.text}</div>
            {takeaway.text && (
              <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, color: toneColor(takeaway.tone), overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{takeaway.text}</div>
            )}
          </div>
        </button>
        <button type="button" onClick={() => onToggle(idx)} aria-expanded={open} aria-label={open ? `Collapse Q${idx + 1}` : `Expand Q${idx + 1}`}
          style={{ flexShrink: 0, width: 44, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.faint }}>
          <span style={{ display: "inline-block", fontSize: 11, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>▾</span>
        </button>
      </div>

      {!question.skipped && (
        <div style={{ height: 2.5, background: C.border }}>
          <div style={{ width: objective ? (feedback?.correct !== null ? "100%" : "0%") : `${score || 0}%`, height: "100%", background: badgeColor, opacity: 0.4, transition: "width 0.7s ease" }} />
        </div>
      )}

      <div style={{ maxHeight: open ? 1400 : 0, opacity: open ? 1 : 0, overflow: "hidden", transition: "max-height 0.35s cubic-bezier(.16,1,.3,1), opacity 0.25s ease" }}>
        <div style={{ padding: "8px 18px 20px" }}>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: C.text, fontWeight: 700, marginBottom: 14 }}>{question.text}</div>

          {question.userAnswer && !question.skipped && question.userAnswer !== "Skipped" && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: C.surfaceAlt || cardAlt, border: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, letterSpacing: "0.5px", marginBottom: 6 }}>your answer</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: C.sub, whiteSpace: "pre-wrap" }}>{question.userAnswer}</div>
            </div>
          )}

          {question.skipped && (
            <div style={{ padding: "11px 14px", borderRadius: 12, background: C.amberTint, border: `1px solid ${C.amber}40`, color: C.amber, fontSize: 11.5, lineHeight: 1.55, marginBottom: 12 }}>
              You skipped this question. Use this as a pacing signal rather than a failure.
            </div>
          )}

          {objective && isEval && (
            <div style={{ padding: "11px 14px", border: `1px solid ${C.border}`, borderRadius: 12, background: cardAlt, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>result</span>
              <strong style={{ color: badgeColor, fontSize: 13 }}>{feedback?.correct ? "Correct" : "Incorrect"}</strong>
            </div>
          )}

          {!objective && isEval && feedback && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FeedbackBlock label="what worked" value={feedback.good} color={C.green} background={C.greenTint} />
              <FeedbackBlock label="what was missing" value={feedback.missing} color={C.red} background={C.redTint} />
              <FeedbackBlock label="key idea" value={feedback.idealHint} color={C.blue500} background={C.blue50} />
              <FeedbackBlock label="next move" value={feedback.tip} color={C.amber} background={C.amberTint} />
              {feedback.sampleAnswer && (
                <div style={{ gridColumn: "1 / -1", padding: 13, borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, color: C.muted, letterSpacing: "0.5px", marginBottom: 6 }}>better answer pattern</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: C.text }}>{feedback.sampleAnswer}</div>
                </div>
              )}
            </div>
          )}

          {canRetry && onRetry && (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => onRetry(question.id)} disabled={retrying}
                style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.borderMd}`, background: retrying ? cardAlt : C.card, color: retrying ? C.muted : C.blue500, fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.3px", cursor: retrying ? "not-allowed" : "pointer" }}>
                {retrying ? "Re-evaluating…" : "Retry AI evaluation"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const QuestionReview = ({ questions, sessionId }) => {
  const [expanded, setExpanded] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [retryingId, setRetryingId] = useState(null);
  const [overrides, setOverrides] = useState([]);

  const normalizedQuestions = useMemo(() => {
    return questions.map(q => {
      const override = overrides.find(o => o.id === q.id);
      return override ? { ...q, score: override.score, aiFeedback: override.aiFeedback } : q;
    });
  }, [questions, overrides]);

  const strongCount = normalizedQuestions.filter(q => !q.skipped && q.score >= 80).length;
  const weakCount = normalizedQuestions.filter(q => !q.skipped && q.score < 60).length;
  const skippedCount = normalizedQuestions.filter(q => q.skipped).length;

  const filters = [
    { key: "all", label: `All · ${normalizedQuestions.length}` },
    { key: "strong", label: `Strong · ${strongCount}` },
    { key: "weak", label: `Needs work · ${weakCount}` },
    { key: "skipped", label: `Skipped · ${skippedCount}` },
  ];

  const filteredQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return normalizedQuestions
      .map((q, i) => ({ ...q, _index: i }))
      .filter(q => {
        if (activeFilter === "strong" && (q.skipped || q.score < 80)) return false;
        if (activeFilter === "weak" && (q.skipped || q.score >= 60)) return false;
        if (activeFilter === "skipped" && !q.skipped) return false;
        if (needle) {
          const hay = `${q.text} ${q.topic} ${q.userAnswer}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
  }, [normalizedQuestions, activeFilter, search]);

  const toggleExpand = useCallback(index => setExpanded(prev => ({ ...prev, [index]: !prev[index] })), []);

  const handleRetry = useCallback(async questionId => {
    if (!sessionId || !questionId || retryingId) return;
    setRetryingId(questionId);
    try {
      const data = await retryQuestion(sessionId, questionId);
      const parsedFeedback = normalizeFeedback({ feedback: data?.feedback, score: data?.score });
      setOverrides(prev => [...prev.filter(q => q.id !== questionId), { id: questionId, score: clamp(Number(data?.score) || 0), aiFeedback: parsedFeedback }]);
    } catch (err) { console.error("Retry failed:", err); }
    finally { setRetryingId(null); }
  }, [sessionId, retryingId]);

  return (
    <div style={S.card}>
      <div style={S.eyebrow}>Question-by-question review</div>
      <h2 style={S.cardH2}>Full breakdown</h2>
      <p style={S.cardSub}>Score, time, and a quick takeaway for every question — open any card for feedback, sample answer, and retry.</p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "18px 0 14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} style={{
              border: `1px solid ${activeFilter === f.key ? C.blue500 : C.border}`,
              background: activeFilter === f.key ? C.blue500 : C.card,
              color: activeFilter === f.key ? "#fff" : C.sub,
              borderRadius: 999, padding: "7px 13px", fontFamily: F.body, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
            }}>{f.label}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions or answers…"
          style={{ width: 240, maxWidth: "100%", border: `1px solid ${C.border}`, background: cardAlt, borderRadius: 10, padding: "9px 13px", fontFamily: F.body, fontSize: 12, color: C.text, outline: "none" }} />
      </div>

      {!filteredQuestions.length && (
        <div style={{ border: `1px dashed ${C.borderMd}`, borderRadius: 12, padding: 32, textAlign: "center", color: C.muted, fontSize: 12 }}>
          No questions match the current filter.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {filteredQuestions.map(q => (
          <QuestionCard key={q._index} question={q} open={Boolean(expanded[q._index])} onToggle={toggleExpand} onRetry={handleRetry} retrying={retryingId === q.id} />
        ))}
      </div>
    </div>
  );
};

// ─── Streak / Badges ───────────────────────────────────────────────────────
const StreakBadgesCard = ({ streak, newBadges }) => {
  if (!streak && (!newBadges || !newBadges.length)) return null;
  return (
    <div style={{ ...S.card, padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        {streak && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: C.violetTint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: C.violet }}>◆</div>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text }}>{streak.current || 0} day streak</div>
              <div style={{ marginTop: 2, fontFamily: F.mono, fontSize: 9, color: C.muted }}>consistency compounds</div>
            </div>
          </div>
        )}
        {newBadges && newBadges.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {newBadges.map((badge, i) => {
              const label = typeof badge === "string" ? badge : badge?.label || "New badge";
              return <Pill key={`${label}-${i}`} color={C.violet} background={C.violetTint}>★ {label}</Pill>;
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RESULT PAGE
// ═══════════════════════════════════════════════════════════════════════════
const Result = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.result;

  const [copied, setCopied] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const topicRef = useRef(null);
  const shareCardRef = useRef(null);

  useEffect(() => { if (!result) navigate("/"); }, [result, navigate]);

  const { score = 0, questions = [], streak, newBadges = [], sessionId } = result || {};
  const totalScore = clamp(score);

  const normalizedQuestions = useMemo(() => questions.map((q, i) => normalizeQuestion(q, i)), [questions]);

  const evaluatedQuestions = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.aiFeedback?.aiAvailable !== false && typeof q.aiFeedback?.score === "number"), [normalizedQuestions]);
  const answeredQuestions = useMemo(() => normalizedQuestions.filter(q => !q.skipped && q.userAnswer?.trim() && q.userAnswer !== "Skipped"), [normalizedQuestions]);
  const skippedQuestions = useMemo(() => normalizedQuestions.filter(q => q.skipped), [normalizedQuestions]);
  const strongAnswers = evaluatedQuestions.filter(q => q.aiFeedback.score >= 80).length;
  const weakAnswers = evaluatedQuestions.filter(q => q.aiFeedback.score < 60).length;

  const averageTime = answeredQuestions.length
    ? Math.round(answeredQuestions.reduce((sum, q) => sum + Number(q.timeTaken || 0), 0) / answeredQuestions.length)
    : 0;

  const { topicAverages, topicStatus } = useMemo(() => {
    const map = {};
    let anyTaggedEvaluated = false;
    normalizedQuestions.forEach(q => {
      if (q.skipped || typeof q.aiFeedback?.score !== "number") return;
      if (q.hasTopicField) anyTaggedEvaluated = true;
      const topic = q.topic || "General";
      if (!map[topic]) map[topic] = { total: 0, count: 0 };
      map[topic].total += q.aiFeedback.score;
      map[topic].count += 1;
    });
    const averages = Object.entries(map).map(([topic, d]) => ({ topic, avg: Math.round(d.total / d.count) }));
    let status = "ok";
    if (evaluatedQuestions.length === 0) status = "no-eval";
    else if (!anyTaggedEvaluated) status = "no-topic-field";
    return { topicAverages: averages, topicStatus: status };
  }, [normalizedQuestions, evaluatedQuestions.length]);

  const strongestTopic = [...topicAverages].sort((a, b) => b.avg - a.avg)[0];
  const weakestTopic = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];

  const nextStepText = useMemo(() => {
    if (skippedQuestions.length > 0 && weakAnswers === 0)
      return `You skipped ${skippedQuestions.length} question${skippedQuestions.length > 1 ? "s" : ""} — a full pass at your current pace would likely raise this score.`;
    if (weakestTopic && weakAnswers > 0)
      return `${weakAnswers} answer${weakAnswers > 1 ? "s" : ""} scored below 60, concentrated in ${weakestTopic.topic}. Start your next rep there.`;
    if (strongAnswers === evaluatedQuestions.length && evaluatedQuestions.length > 0)
      return "Every evaluated answer scored 80+. Raise the difficulty next time to keep the signal useful.";
    return "Review the answers below, then queue another session to build on this one.";
  }, [skippedQuestions.length, weakAnswers, weakestTopic, strongAnswers, evaluatedQuestions.length]);

  const handleCopy = useCallback(async () => {
    const lines = [
      `MockMate result: ${totalScore}/100 — ${getLabel(totalScore)}`,
      `${answeredQuestions.length}/${normalizedQuestions.length} answered`,
      `${strongAnswers} strong · ${weakAnswers} need work · ${skippedQuestions.length} skipped`,
      strongestTopic ? `Strongest: ${strongestTopic.topic} (${strongestTopic.avg}/100)` : "",
      weakestTopic ? `Focus area: ${weakestTopic.topic} (${weakestTopic.avg}/100)` : "",
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  }, [totalScore, answeredQuestions.length, normalizedQuestions.length, strongAnswers, weakAnswers, skippedQuestions.length, strongestTopic, weakestTopic]);

  const handleTopicClick = useCallback(() => {
    topicRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleDownloadImage = useCallback(async () => {
    if (!shareCardRef.current || downloadingImage) return;
    setDownloadingImage(true);
    const toastId = toast.loading("Preparing your image…");
    try {
      const url = await toPng(shareCardRef.current, {
        cacheBust: true, pixelRatio: 2.5,
        width: shareCardRef.current.offsetWidth,
        height: shareCardRef.current.offsetHeight,
      });
      const link = document.createElement("a");
      link.download = `mockmate-result-${Date.now()}.png`;
      link.href = url;
      link.click();
      toast.dismiss(toastId);
      toast.success("Image saved!");
    } catch (err) {
      toast.dismiss(toastId);
      console.error("Result image export failed:", err);
      toast.error("Could not create the image — try again.");
    } finally { setDownloadingImage(false); }
  }, [downloadingImage]);

  const heroResult = {
    score: totalScore,
    sessionId,
    totalQuestions: normalizedQuestions.length,
    answeredQuestions: answeredQuestions.length,
    skippedQuestions: skippedQuestions.length,
    strongAnswers,
    weakAnswers,
    averageTime,
    topTopic: strongestTopic?.topic ?? null,
    weakestTopicName: weakestTopic?.topic ?? null,
    trendDelta: result?.trendDelta ?? null,
    scoreHistory: result?.scoreHistory ?? [],
  };

  if (!result) return null;

  return (
    <div style={S.page} className="res-page">
      <GlobalStyles />
      <div style={S.container}>

        {/* Status strip */}
        <AnimatedSection delay={0}>
          <div style={S.strip}>
            <div style={S.stripL}>
              <span style={S.liveDot} />
              <span style={S.mono}>mockmate · post-interview debrief</span>
            </div>
            <div style={S.stripR} className="res-strip-r">
              {sessionId && <span style={S.mono}>session {sessionId}</span>}
              <span style={{ color: C.borderMd }}>·</span>
              <span style={S.mono}>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase()}</span>
            </div>
          </div>
        </AnimatedSection>

        {/* Hero */}
        <AnimatedSection delay={60}>
          <SectionErrorBoundary>
            <ResultHero result={heroResult} navigate={navigate} onCopy={handleCopy} copied={copied} onDownloadImage={handleDownloadImage} downloading={downloadingImage} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Off-screen share card */}
        <ShareCard result={heroResult} cardRef={shareCardRef} />

        {/* Stat rail */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <StatRail result={heroResult} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Next step banner */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <NextStepBanner nextStepText={nextStepText} weakestTopic={weakestTopic} navigate={navigate} score={totalScore} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Readout + Topic breakdown */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <section style={S.twoCol} className="res-two-col">
              <div style={S.card}>
                <div style={S.eyebrow}>Session at a glance</div>
                <h2 style={S.cardH2}>Your readout</h2>
                <p style={S.cardSub}>The fastest summary of what this session says about your current form.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
                  <Insight
                    label="strongest topic"
                    value={strongestTopic?.topic || (topicStatus === "no-eval" ? "Pending" : "No data")}
                    text={strongestTopic ? `${strongestTopic.avg}/100 avg` : topicStatus === "no-eval" ? "Awaiting evaluation" : "No topic field returned"}
                    color={C.green}
                    background={C.greenTint}
                  />
                  <Insight
                    label="next focus"
                    value={weakestTopic?.topic || (topicStatus === "no-eval" ? "Pending" : "No data")}
                    text={weakestTopic ? `${weakestTopic.avg}/100 avg` : topicStatus === "no-eval" ? "Awaiting evaluation" : "No topic field returned"}
                    color={C.amber}
                    background={C.amberTint}
                  />
                  <Insight
                    label="pace"
                    value={formatTime(averageTime)}
                    text={answeredQuestions.length ? "Avg time per question" : "No answered questions yet"}
                    color={C.blue500}
                    background={C.blue50}
                  />
                </div>
              </div>

              <div style={S.card} ref={topicRef}>
                <div style={S.eyebrow}>Topic performance</div>
                <h2 style={S.cardH2}>Where to drill next</h2>
                <p style={S.cardSub}>Sorted strongest first — the bottom of this list is your highest-ROI move.</p>
                <div style={{ marginTop: 16 }}>
                  <TopicBreakdown topicAverages={topicAverages} status={topicStatus} onTopicClick={handleTopicClick} />
                </div>
              </div>
            </section>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Score progression */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <div style={S.card}>
              <div style={S.eyebrow}>Score progression</div>
              <h2 style={S.cardH2}>Answer-by-answer curve</h2>
              <p style={S.cardSub}>How your score moved from question to question, and how much it varied.</p>
              <div style={{ marginTop: 16 }}>
                <ScoreProgressionHeader questions={normalizedQuestions} />
                <ScoreProgression questions={normalizedQuestions} />
              </div>
            </div>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Pace vs score + Answer type breakdown */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <section style={S.twoCol} className="res-two-col">
              <div style={S.card}>
                <div style={S.eyebrow}>Pace vs. score</div>
                <h2 style={S.cardH2}>Is speed helping or hurting?</h2>
                <p style={S.cardSub}>Each dot is one question — time taken against the score it earned.</p>
                <div style={{ marginTop: 16 }}>
                  <PaceVsScoreLabeled questions={normalizedQuestions} />
                </div>
              </div>

              <div style={S.card}>
                <div style={S.eyebrow}>Answer type</div>
                <h2 style={S.cardH2}>Knowledge vs. communication</h2>
                <p style={S.cardSub}>Objective accuracy and open-ended scoring point to different fixes.</p>
                <div style={{ marginTop: 16 }}>
                  <AnswerTypeBreakdown questions={normalizedQuestions} />
                </div>
              </div>
            </section>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Repeated mistake pattern */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <RepeatedMistake questions={normalizedQuestions} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Streak / badges */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <StreakBadgesCard streak={streak} newBadges={newBadges} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Question-by-question review */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <QuestionReview questions={normalizedQuestions} sessionId={sessionId} />
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* ScoreCard (Mission Report component) — kept exactly as-is */}
        <AnimatedSection delay={0}>
          <SectionErrorBoundary>
            <div style={S.card}>
              <div style={S.eyebrow}>Mission report</div>
              <ScoreCard totalScore={totalScore} questions={normalizedQuestions} />
            </div>
          </SectionErrorBoundary>
        </AnimatedSection>

        {/* Footer */}
        <AnimatedSection delay={0}>
          <footer style={S.footerRow}>
            <span style={S.mono}>mockmate result page · v12</span>
            <span style={S.mono}>scores normalized 0–100 · computed post-session</span>
          </footer>
        </AnimatedSection>

      </div>
    </div>
  );
};

// ─── Global styles ─────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @keyframes livePulse   { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
    @keyframes mmHeroScan  { 0% { transform:translateX(-100%); } 100% { transform:translateX(650%); } }
    @keyframes scaleIn     { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }

    *, *::before, *::after { box-sizing: border-box; }

    .res-page button:focus-visible { outline: 2px solid ${C.blue500}; outline-offset: 3px; border-radius: 6px; }

    .res-rail-cell { transition: background 0.18s ease !important; }
    .res-rail-cell:hover { background: ${cardAlt} !important; }

    .res-dim-row { width: 100%; text-align: left; border: none; cursor: pointer; transition: background 0.16s ease, border-color 0.16s ease !important; }
    .res-dim-row:hover { background: ${C.blue50} !important; }

    .res-btn-primary { transition: transform 0.15s cubic-bezier(.16,1,.3,1), box-shadow 0.15s ease !important; }
    .res-btn-primary:hover { transform: translateY(-2px) !important; box-shadow: 0 10px 26px rgba(0,0,0,0.28) !important; }

    .res-btn-ghost { transition: background 0.15s ease, transform 0.15s ease !important; }
    .res-btn-ghost:hover { background: rgba(255,255,255,0.14) !important; transform: translateY(-1px) !important; }

    .res-btn-gradient { transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(.16,1,.3,1) !important; }
    .res-btn-gradient:hover { transform: translateY(-2px) !important; }

    @media (prefers-reduced-motion: reduce) {
      .res-page * { animation: none !important; transition-duration: 0.01ms !important; }
    }

    @media (max-width: 1020px) {
      .res-two-col { grid-template-columns: 1fr !important; }
      .res-hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
      .res-stat-rail { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 760px) {
      .res-banner { flex-direction: column !important; align-items: flex-start !important; }
      .res-strip-r { display: none !important; }
      .res-hero { padding: 28px 22px !important; }
      .res-hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
      .res-hero-grid > div:first-child { align-items: center !important; }
    }
    @media (max-width: 480px) {
      .res-stat-rail { grid-template-columns: 1fr !important; }
      .res-page { padding: 14px 12px 60px !important; }
      .res-hero { padding: 22px 16px !important; border-radius: 16px !important; }
      .res-hero-actions button { flex: 1 1 auto !important; min-width: 0 !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — reuses the exact hero gradient/scan from Home.jsx's landing hero
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 6% -4%, rgba(26,110,255,0.05) 0%, transparent 46%), radial-gradient(ellipse at 96% 4%, rgba(0,200,240,0.04) 0%, transparent 40%)`,
    padding: "24px 28px 80px",
    fontFamily: F.body,
  },
  container: { maxWidth: 1200, margin: "0 auto" },

  strip: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", marginBottom: 20, borderRadius: 11, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  stripL: { display: "flex", alignItems: "center", gap: 9 },
  stripR: { display: "flex", alignItems: "center", gap: 10 },
  liveDot: { width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "livePulse 2.4s ease-in-out infinite" },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: "0.3px", color: C.muted },

  // Exact landing-page hero: same 135deg blue900→blue700→blue600→cyan600
  // gradient and scan-sweep width/opacity as Home.jsx's S.hero/S.heroScan.
  hero: {
    position: "relative", overflow: "hidden",
    padding: "40px 36px", marginBottom: 20, borderRadius: 22,
    background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 44%, ${C.blue600} 72%, ${C.cyan600} 100%)`,
    boxShadow: "0 28px 70px rgba(10,30,100,0.38)",
  },
  heroScan: { position: "absolute", top: 0, left: 0, width: "18%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)", animation: "mmHeroScan 10s linear infinite", pointerEvents: "none" },
  heroGrid: { position: "relative", display: "grid", gridTemplateColumns: "240px 1fr", gap: 44, alignItems: "center" },

  trendChip: { display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: F.mono, fontSize: 10.5, marginTop: 8 },
  heroKicker: { fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: "1.8px", color: C.cyan400, textTransform: "uppercase", opacity: 0.9 },
  heroH1: { margin: "14px 0 0", fontFamily: F.display, fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.18, letterSpacing: "-1px", maxWidth: 540 },
  heroSub: { margin: "14px 0 0", fontSize: 13.5, lineHeight: 1.75, color: "rgba(255,255,255,0.62)", maxWidth: 500, fontWeight: 400 },

  miniStats: { display: "flex", alignItems: "center", gap: 0, marginTop: 22, padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(8px)", width: "fit-content" },
  miniStat: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "0 18px" },
  miniVal: { fontFamily: F.display, fontSize: 22, fontWeight: 900, lineHeight: 1 },
  miniLabel: { fontFamily: F.mono, fontSize: 8.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3px" },
  miniDivider: { width: 1, height: 32, background: "rgba(255,255,255,0.12)", flexShrink: 0 },

  heroActions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 },
  btnPrimary: { border: "none", borderRadius: 11, background: "#fff", color: C.blue900, padding: "11px 20px", fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.22)" },
  btnGhost: { border: "1px solid rgba(255,255,255,0.18)", borderRadius: 11, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.82)", padding: "11px 20px", fontSize: 13, fontWeight: 700, fontFamily: F.body, cursor: "pointer" },

  statRail: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20, borderRadius: 18, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" },
  railCell: { padding: "20px 24px", borderRight: `1px solid ${C.border}` },
  railLabel: { fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.1px" },
  railValRow: { display: "flex", alignItems: "baseline", gap: 4, marginTop: 10 },
  railVal: { fontFamily: F.display, fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.8px" },
  railUnit: { fontFamily: F.mono, fontSize: 12, color: C.muted },
  railSub: { marginTop: 8, fontSize: 11, color: C.muted, lineHeight: 1.5 },

  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 26, boxShadow: C.shadow, marginBottom: 18 },
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", color: C.blue500, marginBottom: 7, textTransform: "lowercase" },
  cardH2: { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.3px" },
  cardSub: { margin: "7px 0 0", fontSize: 12.5, lineHeight: 1.65, color: C.sub, maxWidth: 480 },

  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 },

  insightLabel: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 600, letterSpacing: "0.5px", marginBottom: 8, color: C.sub, textTransform: "lowercase" },
  insightVal: { fontFamily: F.display, fontSize: 17, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  insightText: { marginTop: 4, fontSize: 11, color: C.sub, lineHeight: 1.4 },

  dimList: { display: "flex", flexDirection: "column", gap: 10 },
  dimRow: { padding: "13px 15px", borderRadius: 12, background: cardAlt, border: `1px solid ${C.border}` },
  dimMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  dimLeft: { display: "flex", alignItems: "center", gap: 10 },
  dimName: { fontSize: 12.5, fontWeight: 700, color: C.text },
  dimScore: { fontFamily: F.display, fontSize: 17, fontWeight: 800 },
  dimTrack: { height: 6, borderRadius: 999, background: C.border, overflow: "hidden", position: "relative" },
  dimFill: { height: "100%", borderRadius: 999, transition: "width 1s cubic-bezier(.16,1,.3,1)" },

  footerRow: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, padding: "20px 4px 0", opacity: 0.42 },
};

export default Result;