import PropTypes from "prop-types";
import { C, F } from "../../styles/token";

const formatTime = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
};

const propTypes = {
  topicAverages: PropTypes.arrayOf(
    PropTypes.shape({ topic: PropTypes.string, avg: PropTypes.number })
  ).isRequired,
  topicStatus: PropTypes.string.isRequired,
  averageTime: PropTypes.number.isRequired,
  totalScore:  PropTypes.number.isRequired,
};


const ScoreSummary = ({ topicAverages, topicStatus, averageTime, totalScore }) => {
  const strongestTopic = [...topicAverages].sort((a, b) => b.avg - a.avg)[0];
  const weakestTopic   = [...topicAverages].sort((a, b) => a.avg - b.avg)[0];

  const items = [
    {
      label: "strongest",
      value: strongestTopic?.topic || "—",
      sub: strongestTopic
        ? `${strongestTopic.avg}/100`
        : topicStatus === "no-eval" ? "pending" : "no data",
      color: C.green,
    },
    {
      label: "focus area",
      value: weakestTopic?.topic || "—",
      sub: weakestTopic ? `${weakestTopic.avg}/100` : "—",
      color: C.amber,
    },
    { label: "avg pace", value: formatTime(averageTime), sub: "per question", color: C.blue500 },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{ padding: "12px 14px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}
        >
          <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.muted, marginBottom: 5 }}>
            {item.label}
          </div>
          <div
            style={{
              fontFamily: F.display, fontSize: 15, fontWeight: 900, color: item.color,
              lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {item.value}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.sub, marginTop: 3 }}>{item.sub}</div>
        </div>
      ))}
    </div>
  );
};

ScoreSummary.propTypes = propTypes;

export default ScoreSummary;