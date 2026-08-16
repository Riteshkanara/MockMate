import { useLocation, useNavigate } from 'react-router-dom';
import ScoreCard from '../components/ScoreCard';

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
  indigoHover:  "#3730A3",
  indigoTint:   "#EEF2FF",
  orange:       "#F97316",
  orangeTint:   "#FFF7ED",
  green:        "#059669",
  greenTint:    "#ECFDF5",
  red:          "#DC2626",
  redTint:      "#FEF2F2",
  yellow:       "#D97706",
  yellowTint:   "#FFFBEB",
  shadowCard:   "0 2px 20px rgba(67,56,202,0.08), 0 1px 4px rgba(0,0,0,0.04)",
};

const Result = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const result = location.state?.result;

  if (!result) {
    navigate('/');
    return null;
  }

  const {
    score: totalScore = 0,   // backend calls it 'score', not 'totalScore'
    questions = [],
    streak,
    newBadges = [],
  } = result;

  // Normalize questions: parse the feedback JSON string and attach aiFeedback shape
  // that the rest of this component expects.
  const normalizedQuestions = questions.map(q => {
    let aiFeedback = null;
    if (!q.skipped && q.feedback) {
      try {
        const fb = typeof q.feedback === 'string' ? JSON.parse(q.feedback) : q.feedback;
        if (fb && typeof fb === 'object') {
          aiFeedback = {
            score: typeof q.score === 'number' ? q.score : 0,  // already 0–100
            good:         fb.good         || '',
            missing:      fb.missing      || '',
            idealHint:    fb.idealHint    || '',
            tip:          fb.tip          || '',
            sampleAnswer: fb.sampleAnswer || '',
            aiAvailable:  fb.aiAvailable !== false,
          };
        }
      } catch { aiFeedback = null; }
    }
    return {
      ...q,
      text: q.text || q.question,   // defensive alias
      aiFeedback,
    };
  });

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------

  const evaluatedQuestions = questions.filter(
    q =>
      q.aiFeedback &&
      q.aiFeedback.aiAvailable !== false &&
      typeof q.aiFeedback.score === 'number'
  );

  const skippedQuestions = questions.filter(
    q => q.skipped === true
  );

 const answeredQuestions = questions.filter(
  q =>
    q.userAnswer &&
    q.userAnswer.trim() &&
    q.userAnswer !== 'Skipped' &&
    !q.skipped
);

  const averageTime = answeredQuestions.length > 0
      ? Math.round(
          answeredQuestions.reduce(
            (total, q) => total + (q.timeTaken || 0),
            0
          ) / answeredQuestions.length
        )
      : 0;

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getScoreColor = score => {
    if (score >= 80) return C.green;
    if (score >= 60) return C.orange;
    return C.red;
  };

  const getQuestionScoreColor = score => {
    if (score >= 80) return C.green;
    if (score >= 60) return C.orange;
    return C.red;
  };

  const getScoreMessage = () => {
    if (totalScore >= 80) {
      return {
        label: 'Excellent Performance',
        sub: "You're interview-ready. Keep the streak going.",
        icon: '🏆',
      };
    }

    if (totalScore >= 60) {
      return {
        label: 'Good Effort',
        sub: 'Solid attempt. Review the tips below and try again.',
        icon: '💪',
      };
    }

    return {
      label: 'Keep Practicing',
      sub: "Every rep counts. You'll get there.",
      icon: '🚀',
    };
  };

  const getPerformanceLabel = () => {
    if (totalScore >= 80) return 'Strong';
    if (totalScore >= 60) return 'Developing';
    return 'Needs Practice';
  };

  const msg = getScoreMessage();

  const strongQuestions = evaluatedQuestions.filter(
    q => q.aiFeedback.score >= 80
  ).length;

  const improvementQuestions = evaluatedQuestions.filter(
    q => q.aiFeedback.score < 60
  ).length;

  // ---------------------------------------------------------
  // No result fallback
  // ---------------------------------------------------------

  if (!questions.length) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bgSubtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: 40,
            textAlign: 'center',
            maxWidth: 440,
            boxShadow: C.shadowCard,
          }}
        >
          <div style={{ fontSize: 42, marginBottom: 12 }}>
            📋
          </div>

          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              color: C.text,
              margin: '0 0 8px',
            }}
          >
            No interview result found
          </h2>

          <p
            style={{
              color: C.textSub,
              fontSize: 14,
              margin: '0 0 24px',
            }}
          >
            Start a new mock interview to see your performance here.
          </p>

          <button
            onClick={() => navigate('/interview')}
            style={{
              width: '100%',
              background: C.indigo,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Start Interview →
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
        }

        .result-page button {
          font-family: 'Inter', sans-serif;
        }

        .result-question:hover {
          border-color: #C7D2FE !important;
        }

        @media (max-width: 600px) {
          .result-page {
            padding: 24px 14px !important;
          }

          .score-hero {
            padding: 28px 20px !important;
          }

          .score-number {
            font-size: 58px !important;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr !important;
          }

          .action-buttons {
            flex-direction: column !important;
          }
        }
          .result-container {
  width: 100%;
  min-width: 0;
}

.result-card {
  width: 100%;
  min-width: 0;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.result-actions {
  display: flex;
  gap: 12px;
}

.result-actions button {
  flex: 1;
  min-width: 0;
}

@media (max-width: 600px) {
  .result-container {
    padding: 20px 12px !important;
  }

  .result-card {
    padding: 20px 14px !important;
  }

  .result-grid {
    grid-template-columns: 1fr !important;
  }

  .result-actions {
    flex-direction: column !important;
  }

  .result-actions button {
    width: 100% !important;
  }
}
      `}</style>

      <div
        className="result-page"
        style={{
          minHeight: '100vh',
          background: C.bgSubtle,
          padding: '40px 24px 60px',
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
          }}
        >

          {/* ------------------------------------------------ */}
          {/* Header */}
          {/* ------------------------------------------------ */}

          <div
            style={{
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: C.indigoTint,
                border: `1px solid ${C.borderIndigo}`,
                borderRadius: 99,
                padding: '5px 14px',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 12 }}>
                ✓
              </span>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.indigo,
                  letterSpacing: '0.4px',
                }}
              >
                INTERVIEW COMPLETE
              </span>
            </div>

            <h1
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 28,
                fontWeight: 800,
                color: C.text,
                margin: '0 0 6px',
                letterSpacing: '-0.8px',
              }}
            >
              Your Interview Results
            </h1>

            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                color: C.textSub,
                margin: 0,
              }}
            >
              Here's how you performed in this mock interview.
            </p>
          </div>

          {/* ------------------------------------------------ */}
          {/* Score Hero */}
          {/* ------------------------------------------------ */}

          <div
            className="score-hero"
            style={{
              background: C.bg,
              border: `1.5px solid ${C.border}`,
              borderRadius: 20,
              padding: '34px 30px',
              textAlign: 'center',
              marginBottom: 16,
              boxShadow: C.shadowCard,
            }}
          >
            <div
              style={{
                fontSize: 30,
                marginBottom: 8,
              }}
            >
              {msg.icon}
            </div>

            <div
              className="score-number"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 70,
                fontWeight: 800,
                color: getScoreColor(totalScore),
                lineHeight: 1,
                letterSpacing: '-3px',
              }}
            >
              {totalScore}
            </div>

            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                color: C.textMuted,
                marginTop: 5,
                marginBottom: 15,
              }}
            >
              out of 100
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background:
                  totalScore >= 80
                    ? C.greenTint
                    : totalScore >= 60
                    ? C.orangeTint
                    : C.redTint,
                color: getScoreColor(totalScore),
                borderRadius: 99,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              {getPerformanceLabel()}
            </div>

            <div
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 19,
                fontWeight: 800,
                color: C.text,
                marginBottom: 5,
              }}
            >
              {msg.label}
            </div>

            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                color: C.textSub,
                margin: 0,
              }}
            >
              {msg.sub}
            </p>
          </div>

          {/* ------------------------------------------------ */}
          {/* Quick Stats */}
          {/* ------------------------------------------------ */}

          <div
            className="stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {[
              {
                icon: '✓',
                label: 'Answered',
                value: `${answeredQuestions.length}/${questions.length}`,
                color: C.green,
                bg: C.greenTint,
              },
              {
                icon: '↗',
                label: 'Strong',
                value: strongQuestions,
                color: C.indigo,
                bg: C.indigoTint,
              },
              {
                icon: '⏭',
                label: 'Skipped',
                value: skippedQuestions.length,
                color: C.orange,
                bg: C.orangeTint,
              },
              {
                icon: '⏱',
                label: 'Avg. Time',
                value: formatTime(averageTime),
                color: C.textSub,
                bg: C.bgSection,
              },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '14px 10px',
                  textAlign: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: stat.bg,
                    color: stat.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 7px',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {stat.icon}
                </div>

                <div
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 17,
                    fontWeight: 800,
                    color: C.text,
                  }}
                >
                  {stat.value}
                </div>

                <div
                  style={{
                    fontSize: 10,
                    color: C.textMuted,
                    marginTop: 2,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* ------------------------------------------------ */}
          {/* Streak / Badges */}
          {/* ------------------------------------------------ */}

          {(streak || newBadges.length > 0) && (
            <div
              style={{
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                borderRadius: 16,
                padding: '18px 20px',
                marginBottom: 16,
                boxShadow: '0 1px 6px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                {streak && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: C.orangeTint,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}
                    >
                      🔥
                    </div>

                    <div>
                      <div
                        style={{
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontSize: 15,
                          fontWeight: 800,
                          color: C.text,
                        }}
                      >
                        {streak.current} day streak
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: C.textSub,
                        }}
                      >
                        Keep practicing consistently
                      </div>
                    </div>
                  </div>
                )}

                {newBadges.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: C.indigoTint,
                      border: `1px solid ${C.borderIndigo}`,
                      borderRadius: 10,
                      padding: '8px 12px',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🏅</span>

                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: C.indigo,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.7px',
                        }}
                      >
                        New Badge
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: C.text,
                          fontWeight: 700,
                        }}
                      >
                        {newBadges.length} earned
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* Performance Summary */}
          {/* ------------------------------------------------ */}

          <div
            style={{
              background: C.bg,
              border: `1.5px solid ${C.border}`,
              borderRadius: 20,
              padding: '24px',
              marginBottom: 16,
              boxShadow: C.shadowCard,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.indigo,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  margin: '0 0 4px',
                }}
              >
                Performance
              </p>

              <h2
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.text,
                  margin: 0,
                }}
              >
                Quick Summary
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div
                style={{
                  background: C.greenTint,
                  border: '1px solid #A7F3D0',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.green,
                    marginBottom: 4,
                  }}
                >
                  ✓ Strength
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#065F46',
                    lineHeight: 1.5,
                  }}
                >
                  {strongQuestions > 0
                    ? `You scored 8+ on ${strongQuestions} question${
                        strongQuestions === 1 ? '' : 's'
                      }.`
                    : 'Keep practicing to build stronger answers.'}
                </div>
              </div>

              <div
                style={{
                  background: C.orangeTint,
                  border: '1px solid #FED7AA',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.orange,
                    marginBottom: 4,
                  }}
                >
                  ↗ Focus Area
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#9A3412',
                    lineHeight: 1.5,
                  }}
                >
                  {improvementQuestions > 0
                    ? `${improvementQuestions} answer${
                        improvementQuestions === 1 ? '' : 's'
                      } could use more improvement.`
                    : 'Great consistency across your answers.'}
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------ */}
          {/* Existing ScoreCard */}
          {/* ------------------------------------------------ */}

          <div style={{ marginBottom: 16 }}>
            <ScoreCard
              totalScore={totalScore}
              questions={questions}
            />
          </div>

          {/* ------------------------------------------------ */}
          {/* Question Breakdown */}
          {/* ------------------------------------------------ */}

          <div
            style={{
              background: C.bg,
              border: `1.5px solid ${C.border}`,
              borderRadius: 20,
              padding: '24px',
              marginBottom: 20,
              boxShadow: C.shadowCard,
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.indigo,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  margin: '0 0 4px',
                }}
              >
                Review
              </p>

              <h2
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.text,
                  margin: 0,
                }}
              >
                Question Breakdown
              </h2>

              <p
                style={{
                  fontSize: 12,
                  color: C.textSub,
                  margin: '5px 0 0',
                }}
              >
                Review your answers and the feedback from each question.
              </p>
            </div>

            {normalizedQuestions.map((q, index) => {
  const aiAvailable =
    q.aiFeedback?.aiAvailable !== false &&
    typeof q.aiFeedback?.score === 'number';

              const score = aiAvailable
                ? q.aiFeedback.score
                : null;

              return (
                <div
                  className="result-question"
                  key={index}
                  style={{
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom:
                      index === questions.length - 1 ? 0 : 12,
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Question header */}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.indigo,
                          background: C.indigoTint,
                          border: `1px solid ${C.borderIndigo}`,
                          padding: '3px 9px',
                          borderRadius: 99,
                        }}
                      >
                        Q{index + 1}
                      </span>

                      <span
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 11,
                          color: C.textSub,
                          fontWeight: 600,
                        }}
                      >
                        {q.topic || 'General'}
                      </span>

                      {q.skipped && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: C.orange,
                            background: C.orangeTint,
                            padding: '3px 8px',
                            borderRadius: 99,
                          }}
                        >
                          Skipped
                        </span>
                      )}
                    </div>

                    {aiAvailable ? (
                      <span
                        style={{
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontSize: 16,
                          fontWeight: 800,
                          color: getQuestionScoreColor(score),
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {score}/100
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.textMuted,
                          background: C.bgSection,
                          padding: '4px 8px',
                          borderRadius: 99,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        AI unavailable
                      </span>
                    )}
                  </div>

                  {/* Question */}

                  <p
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.text,
                      margin: '0 0 10px',
                      lineHeight: 1.55,
                    }}
                  >
                    {q.text}
                  </p>

                  {/* User answer */}

                  {q.userAnswer && !q.skipped && q.userAnswer !== 'Skipped' && (
                    <div
                      style={{
                        background: C.bgSection,
                        border: `1px solid ${C.border}`,
                        borderRadius: 9,
                        padding: '10px 12px',
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.textSub,
                          textTransform: 'uppercase',
                          letterSpacing: '0.8px',
                          marginBottom: 4,
                        }}
                      >
                        Your answer
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: C.text,
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {q.userAnswer}
                      </div>
                    </div>
                  )}

                  {/* AI unavailable */}

                 {q.skipped ? (
  <div
    style={{
      background: C.orangeTint,
      border: '1px solid #FED7AA',
      borderRadius: 9,
      padding: '10px 12px',
      marginBottom: 10,
      fontSize: 11,
      color: '#9A3412',
      lineHeight: 1.5,
    }}
  >
    ⏭️ You skipped this question.
  </div>
) : !aiAvailable ? (
  <div
    style={{
      background: C.yellowTint,
      border: '1px solid #FDE68A',
      borderRadius: 9,
      padding: '10px 12px',
      marginBottom: 10,
      fontSize: 11,
      color: '#92400E',
      lineHeight: 1.5,
    }}
  >
    ⚠️ Your answer was saved, but AI evaluation was unavailable.
  </div>
) : null}

                  {/* AI feedback */}

                  {aiAvailable && q.aiFeedback?.tip && (
                    <div
                      style={{
                        background: C.indigoTint,
                        border: `1px solid ${C.borderIndigo}`,
                        borderRadius: 9,
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.indigo,
                          marginBottom: 3,
                        }}
                      >
                        💡 Improvement tip
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: C.text,
                          lineHeight: 1.5,
                        }}
                      >
                        {q.aiFeedback.tip}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ------------------------------------------------ */}
          {/* Bottom Actions */}
          {/* ------------------------------------------------ */}

          <div
            className="action-buttons"
            style={{
              display: 'flex',
              gap: 12,
            }}
          >
            <button
              onClick={() => navigate('/interview')}
              style={{
                flex: 1,
                background: C.indigo,
                border: 'none',
                color: '#fff',
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                padding: '14px',
                borderRadius: 12,
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(67,56,202,0.28)',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = C.indigoHover;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = C.indigo;
              }}
            >
              Try Again →
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              style={{
                flex: 1,
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                color: C.textSub,
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                padding: '14px',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = C.borderIndigo;
                e.currentTarget.style.color = C.indigo;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.color = C.textSub;
              }}
            >
              ← Dashboard
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default Result;