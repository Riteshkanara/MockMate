import { useRef } from 'react';
import { toPng } from 'html-to-image';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';

// Same design tokens as Home.jsx
const C = {
  bg:           "#FFFFFF",
  bgSubtle:     "#F8F9FF",
  bgSection:    "#F0F4FF",
  text:         "#0F0B24",
  textSub:      "#64748B",
  textMuted:    "#9CA3AF",
  border:       "#E5E7EB",
  borderIndigo: "#C7D2FE",
  indigo:       "#4338CA",
  indigoLight:  "#6366F1",
  indigoTint:   "#EEF2FF",
  orange:       "#F97316",
  green:        "#059669",
};

// Circular score — same as Home.jsx
function CircularScore({ score }) {
  const r = 42, size = 100;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? C.green : score >= 60 ? C.indigo : C.orange;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={6} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center"
      }}>
        <div style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 24, fontWeight: 800,
          color, lineHeight: 1
        }}>
          {score}
        </div>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10, color: C.textMuted,
          marginTop: 2, letterSpacing: "0.3px"
        }}>
          / 100
        </div>
      </div>
    </div>
  );
}

const ScoreCard = ({ totalScore, questions }) => {
  const { user } = useAuth();
  const cardRef = useRef(null);

  const getTopicBreakdown = () => {
    const topicMap = {};
    questions.forEach(q => {
      if (!q.topic || typeof q.score !== 'number') return;
      const t = q.topic.toUpperCase();
      if (!topicMap[t]) topicMap[t] = { total: 0, count: 0 };
      topicMap[t].total += q.score;   // 0–100 (already normalised by Bug 8 fix)
      topicMap[t].count += 1;
    });

    return Object.entries(topicMap).map(([topic, val]) => ({
      topic,
      avg: Math.round(val.total / val.count)
    }));
  };

  const topicBreakdown = getTopicBreakdown();

  const getScoreLabel = () => {
    if (totalScore >= 80) return { label: "Excellent", color: C.green };
    if (totalScore >= 60) return { label: "Good Effort", color: C.indigo };
    return { label: "Keep Practicing", color: C.orange };
  };

  const scoreLabel = getScoreLabel();

  const handleDownload = async () => {
    if (!cardRef.current) return;
    const toastId = toast.loading('Generating score card...');
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#FFFFFF',
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight,
      });

      const link = document.createElement('a');
      link.download = `mockmate-score-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.dismiss(toastId);
      toast.success('Score card downloaded!');
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('Failed to generate score card');
      console.error(err);
    }
  };

  return (
    <>  
    <style> {`.score-card {
  width: 100%;
  min-width: 0;
}

.score-card-content {
  min-width: 0;
}

@media (max-width: 600px) {
  .score-card {
    padding: 18px !important;
  }

  .score-card-title {
    font-size: 18px !important;
  }

  .score-card-score {
    font-size: 42px !important;
  }
}`} </style>
    <div style={{ marginBottom: 24 }}>

      {/* Score Card */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div
          ref={cardRef}
          style={{
            width: 480,
            background: C.bg,
            border: `1.5px solid ${C.border}`,
            borderRadius: 20,
            padding: 32,
            fontFamily: "'Inter', sans-serif",
            boxShadow: "0 8px 48px rgba(67,56,202,0.11), 0 2px 12px rgba(0,0,0,0.05)",
            boxSizing: 'border-box',
          }}
        >

          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: `1px solid ${C.border}`
          }}>
            <div>
              {/* MockMate badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: C.indigoTint,
                border: `1px solid ${C.borderIndigo}`,
                borderRadius: 99,
                padding: '4px 12px',
                marginBottom: 10,
              }}>
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11, fontWeight: 600,
                  color: C.indigo,
                  letterSpacing: '0.3px'
                }}>
                  MockMate AI Interview Result
                </span>
              </div>

              {/* User name */}
              <div style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 18, fontWeight: 800,
                color: C.text, marginBottom: 3
              }}>
                {user?.name ?? 'Candidate'}
              </div>

              {/* College */}
              {user?.college && (
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13, color: C.textSub
                }}>
                  {user.college}
                  {user.branch && ` · ${user.branch}`}
                </div>
              )}
            </div>

            {/* Score circle */}
            <CircularScore score={totalScore} />
          </div>

          {/* Score label */}
          <div style={{
            background: C.bgSection,
            border: `1px solid ${C.borderIndigo}`,
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11, fontWeight: 700,
                color: C.indigo,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                marginBottom: 4
              }}>
                Performance
              </div>
              <div style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 20, fontWeight: 800,
                color: scoreLabel.color
              }}>
                {scoreLabel.label}
              </div>
            </div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 42, fontWeight: 800,
              color: scoreLabel.color,
              lineHeight: 1
            }}>
              {totalScore}
              <span style={{
                fontSize: 16,
                color: C.textMuted,
                fontWeight: 500
              }}>/100</span>
            </div>
          </div>

          {/* Topic breakdown */}
          {topicBreakdown.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11, fontWeight: 700,
                color: C.textMuted,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                marginBottom: 12
              }}>
                Topic Breakdown
              </div>

              {topicBreakdown.map(({ topic, avg }) => (
                <div key={topic} style={{ marginBottom: 10 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 5
                  }}>
                    <span style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13, color: C.textSub, fontWeight: 500
                    }}>
                      {topic}
                    </span>
                    <span style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: 13, fontWeight: 700,
                      color: avg >= 70 ? C.green : avg >= 50 ? C.indigo : C.orange
                    }}>
                      {avg}/100
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    background: C.bgSection,
                    borderRadius: 999,
                    height: 6,
                    overflow: 'hidden',
                    border: `1px solid ${C.borderIndigo}`
                  }}>
                    <div style={{
                     width: `${avg}%`,
                      height: '100%',
                      background: avg >= 70 ? C.green : avg >= 50 ? C.indigo : C.orange,
                      borderRadius: 999,
                      transition: 'width 0.6s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{
            borderTop: `1px solid ${C.border}`,
            paddingTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12, color: C.textMuted
            }}>
              Beat my score at MockMate
            </div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13, fontWeight: 800,
              color: C.indigo
            }}>
              Mock<span style={{ color: C.text }}>Mate</span>
            </div>
          </div>

        </div>
      </div>

      {/* Download button */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleDownload}
          style={{
            background: C.indigo,
            border: 'none',
            color: '#fff',
            fontFamily: "'Inter', sans-serif",
            fontSize: 14, fontWeight: 710,
            padding: '13px 32px',
            borderRadius: 10,
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(67,56,202,0.32)',
            transition: 'all 0.18s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.background = '#3730A3';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = C.indigo;
          }}
        >
          Download Score Card
        </button>
      </div>

    </div>
    </>
  );
};

export default ScoreCard;