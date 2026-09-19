import PropTypes from "prop-types";
import { C, F } from "../../styles/token";

const GRADE_MAP = [
  { min: 90, grade: "S", glyph: "◆", desc: "Elite",          accent: C.violet, tint: C.violetTint, glow: C.violet  },
  { min: 80, grade: "A", glyph: "▲", desc: "Strong",         accent: C.green,  tint: C.greenTint,  glow: C.green   },
  { min: 70, grade: "B", glyph: "●", desc: "Solid",          accent: C.blue500,tint: C.blue50,      glow: C.blue500 },
  { min: 60, grade: "C", glyph: "■", desc: "Developing",     accent: C.amber,  tint: C.amberTint,  glow: C.amber   },
  { min:  0, grade: "D", glyph: "▼", desc: "Needs Practice", accent: C.red,    tint: C.redTint,    glow: C.red     },
];

const getGrade = (s) => GRADE_MAP.find((g) => s >= g.min) || GRADE_MAP[GRADE_MAP.length - 1];

// ─── PropTypes ────────────────────────────────────────────────────────────────

const propTypes = {
  nextStepText: PropTypes.string.isRequired,
  weakestTopic: PropTypes.shape({ topic: PropTypes.string }),
  navigate:     PropTypes.func.isRequired,
  score:        PropTypes.number,
};

// ─── Component ────────────────────────────────────────────────────────────────

const ResultActions = ({ nextStepText, weakestTopic, navigate, score = 0 }) => {
  const grade = getGrade(score);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, padding: "14px 18px", marginBottom: 12, borderRadius: 12,
        background: `linear-gradient(135deg, ${grade.tint} 0%, ${C.blue50} 100%)`,
        border: `1px solid ${grade.accent}30`,
      }}
      className="res-banner"
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: F.mono, fontSize: 9, fontWeight: 800,
            letterSpacing: "1.2px", color: grade.accent, marginBottom: 4,
          }}
        >
          what to do next
        </div>
        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: C.text, marginBottom: 4 }}>
          {weakestTopic
            ? <>Drill <span style={{ color: grade.accent }}>{weakestTopic.topic}</span> next</>
            : "Queue another rep"}
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: C.sub, maxWidth: 480, lineHeight: 1.55 }}>
          {nextStepText}
        </p>
      </div>
      <button
        onClick={() => navigate("/interview")}
        style={{
          border: "none", borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${grade.glow}, ${grade.accent})`,
          color: "#fff", padding: "10px 18px", fontSize: 12.5, fontWeight: 800,
          fontFamily: F.body, cursor: "pointer",
          boxShadow: `0 3px 14px ${grade.accent}50`, whiteSpace: "nowrap",
        }}
      >
        Start another →
      </button>
    </div>
  );
};

ResultActions.propTypes = propTypes;

// ─── Export ───────────────────────────────────────────────────────────────────

export default ResultActions;