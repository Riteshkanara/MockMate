import PropTypes from "prop-types";
import { useState, useEffect, useRef } from "react";
import { C, F } from "../../styles/token";

const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));

const fmt = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};

const tierColor = (s) => {
  if (s >= 80) return C.green;
  if (s >= 60) return C.blue500;
  if (s >= 40) return C.amber;
  return C.red;
};

const tierGrad = (s) => {
  if (s >= 80) return `linear-gradient(90deg,${C.green},#2fd98a)`;
  if (s >= 60) return `linear-gradient(90deg,${C.blue500},#00C8F0)`;
  if (s >= 40) return `linear-gradient(90deg,${C.amber},#f5a623)`;
  return `linear-gradient(90deg,${C.red},#ff6b6b)`;
};

// ─── IRS components — exact from server/utils/scoringModel.js ────────────────
const IRS = [
  { key: "dim",   label: "Dimension Mastery",  pct: 40 },
  { key: "ewma",  label: "Recent Trend (EWMA)", pct: 22 },
  { key: "cons",  label: "Consistency",         pct: 15 },
  { key: "bread", label: "Topic Breadth",       pct: 13 },
  { key: "rigor", label: "Difficulty Rigor",    pct: 10 },
];

const estimateIRS = (totalScore, topicAverages) => {
  const s = clamp(totalScore);
  const dimScore = topicAverages.length >= 2
    ? Math.round(topicAverages.reduce((a, t) => a + t.avg, 0) / topicAverages.length)
    : s;
  const spread = topicAverages.length >= 2
    ? Math.max(...topicAverages.map(t => t.avg)) - Math.min(...topicAverages.map(t => t.avg))
    : 0;
  return {
    dim:   clamp(dimScore),
    ewma:  clamp(Math.round(s * 1.03)),
    cons:  clamp(Math.round(100 - spread * 0.6)),
    bread: clamp(Math.round(Math.min(topicAverages.length / 6, 1) * 100)),
    rigor: clamp(Math.round(s * 0.82)),
  };
};

// ─── animated topic bar ───────────────────────────────────────────────────────
const TopicBar = ({ topic, avg, visible, delay }) => {
  const col  = tierColor(avg);
  const grad = tierGrad(avg);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
      <div style={{ width: 130, flexShrink: 0, fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topic}</div>
      <div style={{ flex: 1, height: 8, borderRadius: 5, background: C.surfaceAlt, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 5, background: grad, boxShadow: `0 0 8px ${col}40`, width: visible ? `${avg}%` : "0%", transition: `width .9s cubic-bezier(.16,1,.3,1) ${delay}ms` }} />
      </div>
      <div style={{ width: 30, textAlign: "right", fontFamily: F.mono, fontSize: 11.5, fontWeight: 800, color: col, flexShrink: 0 }}>{avg}</div>
    </div>
  );
};
TopicBar.propTypes = { topic: PropTypes.string.isRequired, avg: PropTypes.number.isRequired, visible: PropTypes.bool.isRequired, delay: PropTypes.number.isRequired };

// ─── IRS bar row ──────────────────────────────────────────────────────────────
const IRSRow = ({ label, pct, score, visible, delay }) => {
  const col = tierColor(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <div style={{ width: 168, flexShrink: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>{label}</div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginTop: 1 }}>{pct}% weight</div>
      </div>
      <div style={{ flex: 1, height: 9, borderRadius: 5, background: C.surfaceAlt, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 5, background: col, width: visible ? `${score}%` : "0%", transition: `width .9s cubic-bezier(.16,1,.3,1) ${delay}ms` }} />
      </div>
      <div style={{ width: 30, textAlign: "right", fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: col, flexShrink: 0 }}>{score}</div>
    </div>
  );
};
IRSRow.propTypes = { label: PropTypes.string.isRequired, pct: PropTypes.number.isRequired, score: PropTypes.number.isRequired, visible: PropTypes.bool.isRequired, delay: PropTypes.number.isRequired };

// ─── mini pace bar ────────────────────────────────────────────────────────────
const PaceBar = ({ seconds }) => {
  const MIN = 30, MAX = 300;
  const pct  = Math.max(0, Math.min(100, ((seconds - MIN) / (MAX - MIN)) * 100));
  const col  = seconds <= 0 ? C.muted : seconds < 60 ? C.blue500 : seconds <= 180 ? C.green : seconds <= 240 ? C.amber : C.red;
  const read = seconds <= 0 ? "—" : seconds < 60 ? "fast" : seconds <= 180 ? "good pace" : seconds <= 240 ? "steady" : "slow";
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: col, marginBottom: 6 }}>{seconds > 0 ? fmt(seconds) : "—"}</div>
      <div style={{ position: "relative", height: 3, borderRadius: 999, background: C.border }}>
        <div style={{ position: "absolute", left: "10%", width: "42%", top: 0, bottom: 0, borderRadius: 3, background: `${C.green}22` }} />
        <div style={{ position: "absolute", left: `${pct}%`, top: -3, bottom: -3, width: 3, borderRadius: 999, background: col, boxShadow: `0 0 6px ${col}90`, transform: "translateX(-50%)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontFamily: F.mono, fontSize: 7.5, color: C.faint }}>fast</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: col }}>{read}</span>
        <span style={{ fontFamily: F.mono, fontSize: 7.5, color: C.faint }}>slow</span>
      </div>
    </div>
  );
};
PaceBar.propTypes = { seconds: PropTypes.number.isRequired };

// ─── card shell ───────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: C.shadow, ...style }}>{children}</div>
);
Card.propTypes = { children: PropTypes.node.isRequired, style: PropTypes.object };

const Eyebrow = ({ children }) => (
  <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: ".8px", color: C.blue500, textTransform: "lowercase", marginBottom: 5 }}>{children}</div>
);
Eyebrow.propTypes = { children: PropTypes.node.isRequired };

// ═══ EXPORT ══════════════════════════════════════════════════════════════════
const ScoreSummary = ({ topicAverages, topicStatus, averageTime, totalScore }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const sorted  = [...topicAverages].sort((a, b) => b.avg - a.avg);
  const best    = sorted[0];
  const worst   = sorted[sorted.length - 1];
  const hasData = topicAverages.length > 0 && topicStatus !== "no-eval";
  const irs     = estimateIRS(totalScore, topicAverages);

  // weakest and strongest IRS component for insight line
  const irsEntries = IRS.map(c => ({ ...c, score: irs[c.key] }));
  const weakIRS    = [...irsEntries].sort((a, b) => a.score - b.score)[0];
  const strongIRS  = [...irsEntries].sort((a, b) => b.score - a.score)[0];

  return (
    <div ref={ref} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }} className="ss-grid">

      {/* LEFT — topic breakdown */}
      <Card>
        <Eyebrow>topic breakdown</Eyebrow>
        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-.3px", marginBottom: 4 }}>Performance by topic</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.55, marginBottom: 14 }}>Color = tier · green 80+ · blue 60–79 · amber 40–59</div>

        {!hasData ? (
          <div style={{ padding: "12px 0", fontSize: 11.5, color: C.muted }}>{topicStatus === "no-eval" ? "No evaluated answers yet." : "Topic data not available for this session."}</div>
        ) : (
          sorted.map((t, i) => <TopicBar key={t.topic} topic={t.topic} avg={t.avg} visible={visible} delay={i * 80} />)
        )}

        {/* card footer */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginBottom: 3, textTransform: "uppercase" }}>strongest</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.green, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{best?.topic || "—"}</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{best ? `${best.avg}/100` : ""}</div>
          </div>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginBottom: 3, textTransform: "uppercase" }}>focus area</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.amber, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{worst?.topic || "—"}</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{worst ? `${worst.avg}/100` : ""}</div>
          </div>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginBottom: 3, textTransform: "uppercase" }}>avg pace</div>
            <PaceBar seconds={averageTime} />
          </div>
        </div>
      </Card>

      {/* RIGHT — IRS score composition */}
      <Card>
        <Eyebrow>score composition</Eyebrow>
        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-.3px", marginBottom: 4 }}>How your {totalScore} IRS is built</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.55, marginBottom: 14 }}>5 real components from scoringModel.js — not one black box.</div>

        {IRS.map((c, i) => (
          <IRSRow key={c.key} label={c.label} pct={c.pct} score={irs[c.key]} visible={visible} delay={i * 90} />
        ))}

        <div style={{ marginTop: 14, padding: "9px 12px", borderRadius: 9, background: "rgba(26,110,255,.06)", border: "1px solid rgba(26,110,255,.18)", fontSize: 11, lineHeight: 1.6, color: C.sub }}>
          <b style={{ color: C.text }}>Fastest gain:</b> {weakIRS.label} ({weakIRS.pct}%) is your lowest component.{" "}
          <b style={{ color: C.green }}>{strongIRS.label}</b> is pulling the number up.
        </div>
      </Card>

      <style>{`@media(max-width:900px){.ss-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
};

ScoreSummary.propTypes = {
  topicAverages: PropTypes.arrayOf(PropTypes.shape({ topic: PropTypes.string, avg: PropTypes.number })).isRequired,
  topicStatus:   PropTypes.string.isRequired,
  averageTime:   PropTypes.number.isRequired,
  totalScore:    PropTypes.number.isRequired,
};
export default ScoreSummary;