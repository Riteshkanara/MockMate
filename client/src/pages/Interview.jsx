import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useInterview } from '../hooks/useInterview';
import useAuth  from '../hooks/useAuth';

import ProgressBar from '../components/ProgressBar';
import Timer from '../components/Timer';
import QuestionCard from '../components/QuestionCard';
import AnswerBox from '../components/AnswerBox';
import FeedbackCard from '../components/FeedBackCard';
import QuestionSkeleton from '../components/QuestionSkeleton';
import FeedbackSkeleton from '../components/FeedbackSkeleton';

const C = {
  bg: '#FFFFFF',
  bgSubtle: '#F8F9FF',
  bgSection: '#F0F4FF',

  text: '#0F0B24',
  textSub: '#64748B',
  textMuted: '#9CA3AF',

  border: '#E5E7EB',
  borderIndigo: '#C7D2FE',

  indigo: '#4338CA',
  indigoHover: '#3730A3',
  indigoTint: '#EEF2FF',

  orange: '#F97316',
  green: '#059669',

  shadow:
    '0 1px 4px rgba(0,0,0,0.06), 0 2px 10px rgba(0,0,0,0.04)',

  shadowCard:
    '0 2px 20px rgba(67,56,202,0.08), 0 1px 4px rgba(0,0,0,0.04)',
};

const MODES = [
  {
    value: 'quick',
    label: 'Quick Mock',
    icon: '⚡',
    desc: '5 questions · 2 min each',
    bg: C.indigoTint,
    border: C.borderIndigo,
    color: C.indigo,
  },
  {
    value: 'full',
    label: 'Full Mock',
    icon: '🎯',
    desc: '10 questions · 3 min each',
    bg: '#F0FDF4',
    border: '#BBF7D0',
    color: '#059669',
  },
  {
    value: 'company',
    label: 'Company Specific',
    icon: '🏢',
    desc: 'Pattern-matched questions',
    bg: '#FFFBEB',
    border: '#FDE68A',
    color: '#D97706',
  },
  {
    value: 'topic',
    label: 'Topic Focus',
    icon: '📚',
    desc: 'Deep dive one topic',
    bg: '#F0F9FF',
    border: '#BAE6FD',
    color: '#0284C7',
  },
];

const COMPANIES = [
  'TCS',
  'Infosys',
  'Wipro',
  'Zoho',
  'Razorpay',
  'FAANG',
];

const TOPICS = [
  'DSA',
  'System Design',
  'OOP',
  'DBMS',
  'OS',
  'HR',
];

const Interview = () => {
  const { user } = useAuth();

const {
  questions,
  currentIndex,
  feedback,
  isSubmitted,
  isLoading,
  error,
  sessionStarted,
  handleStart,
  handleSubmit,
  handleSkip,
  handleTimeUp,
  handleNext,
  hydrateSession,
} = useInterview();

const location = useLocation();

  // If Dashboard passed a pre-created session, hydrate it so we skip mode-select.
  useEffect(() => {
    const state = location.state;
    if (state?.sessionId && state?.questions?.length) {
      hydrateSession(state.sessionId, state.questions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedMode, setSelectedMode] = useState(
    location.state?.mode || 'quick'
  );
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

  const getTimeLimit = (mode) => {
    if (mode === 'quick') return 120;
    if (mode === 'full') return 180;
    if (mode === 'company') return 180;
    if (mode === 'topic') return 150;

    return 120;
  };

  const getDifficultyStyle = (difficulty) => {
    if (difficulty === 'easy') {
      return {
        background: '#ECFDF5',
        color: '#047857',
        border: '#A7F3D0',
      };
    }

    if (difficulty === 'hard') {
      return {
        background: '#FEF2F2',
        color: '#B91C1C',
        border: '#FECACA',
      };
    }

    return {
      background: '#FFFBEB',
      color: '#B45309',
      border: '#FDE68A',
    };
  };

  /*
   * ---------------------------------------------------------
   * START INTERVIEW SCREEN
   * ---------------------------------------------------------
   */

  if (!sessionStarted) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
          }
        `}</style>

        <div
          style={{
            minHeight: '100vh',
            background: C.bgSubtle,
            padding: '40px 24px',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 600,
              margin: '0 auto',
            }}
          >
            {/* Header */}
            <div
              style={{
                textAlign: 'center',
                marginBottom: 36,
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
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: C.green,
                    display: 'inline-block',
                  }}
                />

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.indigo,
                  }}
                >
                  AI-powered · Real questions
                </span>
              </div>

              <h1
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 32,
                  fontWeight: 800,
                  color: C.text,
                  margin: '0 0 8px',
                  letterSpacing: '-1px',
                }}
              >
                Start Interview
              </h1>

              <p
                style={{
                  fontSize: 15,
                  color: C.textSub,
                  margin: 0,
                }}
              >
                Welcome back,{' '}
                {user?.name?.split(' ')[0] || 'there'}. Choose your mode
                below.
              </p>
            </div>

            {/* Mode selection */}
            <div style={{ marginBottom: 24 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.indigo,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Select Mode
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                {MODES.map((mode) => {
                  const selected = selectedMode === mode.value;

                  return (
                    <div
                      key={mode.value}
                      onClick={() => setSelectedMode(mode.value)}
                      style={{
                        background: selected ? mode.bg : C.bg,
                        border: `1.5px solid ${
                          selected ? mode.border : C.border
                        }`,
                        borderRadius: 14,
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        boxShadow: selected
                          ? C.shadowCard
                          : 'none',
                        transform: selected
                          ? 'translateY(-1px)'
                          : 'none',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 22,
                          marginBottom: 8,
                        }}
                      >
                        {mode.icon}
                      </div>

                      <div
                        style={{
                          fontFamily:
                            "'Plus Jakarta Sans', sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                          color: selected
                            ? mode.color
                            : C.text,
                          marginBottom: 3,
                        }}
                      >
                        {mode.label}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: C.textMuted,
                        }}
                      >
                        {mode.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Company selector */}
            {selectedMode === 'company' && (
              <div
                style={{
                  background: C.bg,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 14,
                  padding: 20,
                  marginBottom: 16,
                  boxShadow: C.shadow,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.indigo,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  Select Company
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {COMPANIES.map((company) => {
                    const selected =
                      selectedCompany === company;

                    return (
                      <button
                        key={company}
                        type="button"
                        onClick={() =>
                          setSelectedCompany(company)
                        }
                        style={{
                          background: selected
                            ? C.indigo
                            : C.bgSection,
                          border: `1.5px solid ${
                            selected
                              ? C.indigo
                              : C.borderIndigo
                          }`,
                          color: selected
                            ? '#fff'
                            : C.indigo,
                          fontSize: 13,
                          fontWeight: 600,
                          padding: '7px 16px',
                          borderRadius: 99,
                          cursor: 'pointer',
                        }}
                      >
                        {company}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Topic selector */}
            {selectedMode === 'topic' && (
              <div
                style={{
                  background: C.bg,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 14,
                  padding: 20,
                  marginBottom: 16,
                  boxShadow: C.shadow,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.indigo,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  Select Topic
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {TOPICS.map((topic) => {
                    const selected =
                      selectedTopic === topic;

                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() =>
                          setSelectedTopic(topic)
                        }
                        style={{
                          background: selected
                            ? C.indigo
                            : C.bgSection,
                          border: `1.5px solid ${
                            selected
                              ? C.indigo
                              : C.borderIndigo
                          }`,
                          color: selected
                            ? '#fff'
                            : C.indigo,
                          fontSize: 13,
                          fontWeight: 600,
                          padding: '7px 16px',
                          borderRadius: 99,
                          cursor: 'pointer',
                        }}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Start button */}
            <button
              type="button"
              onClick={() =>
                handleStart(
                  selectedMode,
                  selectedCompany,
                  selectedTopic
                )
              }
              disabled={isLoading}
              style={{
                width: '100%',
                background: isLoading
                  ? C.textMuted
                  : C.indigo,
                border: 'none',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                padding: '15px',
                borderRadius: 12,
                cursor: isLoading
                  ? 'not-allowed'
                  : 'pointer',
                boxShadow:
                  '0 4px 18px rgba(67,56,202,0.32)',
                transition: 'all 0.18s',
              }}
            >
              {isLoading
                ? 'Generating questions...'
                : 'Start Interview →'}
            </button>
          </div>
        </div>
      </>
    );
  }

  /*
   * ---------------------------------------------------------
   * SAFETY CHECK
   * ---------------------------------------------------------
   */

  const currentQuestion = questions?.[currentIndex];

  if (!currentQuestion) {
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
            borderRadius: 16,
            padding: 32,
            textAlign: 'center',
            maxWidth: 420,
            boxShadow: C.shadowCard,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>
            ⚠️
          </div>

          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              color: C.text,
              margin: '0 0 8px',
            }}
          >
            Loading question...
          </h2>

          <p
            style={{
              color: C.textSub,
              fontSize: 14,
              margin: 0,
            }}
          >
            Please wait a moment.
          </p>
        </div>
      </div>
    );
  }

  const difficultyStyle = getDifficultyStyle(
    currentQuestion.difficulty
  );

 

  /*
   * ---------------------------------------------------------
   * INTERVIEW SCREEN
   * ---------------------------------------------------------
   */

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }
          @media (max-width: 768px) {
  .interview-container {
    padding: 24px 16px !important;
  }

  .interview-header {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 12px !important;
  }

  .interview-actions {
    width: 100% !important;
    flex-direction: column !important;
  }

  .interview-actions button {
    width: 100% !important;
  }

  .question-layout {
    grid-template-columns: 1fr !important;
  }

  .question-card {
    width: 100% !important;
  }

  .answer-box {
    width: 100% !important;
  }

  .timer {
    width: 100% !important;
  }
}

@media (max-width: 480px) {
  .interview-container {
    padding: 18px 12px !important;
  }

  .question-card {
    padding: 16px !important;
  }

  .answer-box {
    padding: 12px !important;
  }

  .interview-title {
    font-size: 24px !important;
  }
}
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          background: C.bgSubtle,
          padding: '28px 20px 48px',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
          }}
        >
          {/* ------------------------------------------------ */}
          {/* TOP HEADER                                      */}
          {/* ------------------------------------------------ */}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily:
                    "'Plus Jakarta Sans', sans-serif",
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.text,
                  marginBottom: 3,
                }}
              >
                Mock Interview
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: C.textMuted,
                }}
              >
                Stay focused. You've got this.
              </div>
            </div>

            <div
              style={{
                background: C.indigoTint,
                border: `1px solid ${C.borderIndigo}`,
                color: C.indigo,
                padding: '6px 11px',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {selectedMode === 'quick'
                ? '⚡ Quick Mock'
                : selectedMode === 'full'
                ? '🎯 Full Mock'
                : selectedMode === 'company'
                ? '🏢 Company'
                : '📚 Topic'}
            </div>
          </div>

          {/* ------------------------------------------------ */}
          {/* PROGRESS + TIMER                                */}
          {/* ------------------------------------------------ */}

          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 18,
              boxShadow: C.shadow,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.textSub,
                    }}
                  >
                    Progress
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.indigo,
                    }}
                  >
                    {currentIndex + 1} / {questions.length}
                  </span>
                </div>

                <ProgressBar
                  current={currentIndex + 1}
                  total={questions.length}
                />
              </div>

              {!isSubmitted && (
                <div
                  style={{
                    minWidth: 92,
                    paddingLeft: 12,
                    borderLeft: `1px solid ${C.border}`,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <Timer
                    key={`${currentIndex}-${selectedMode}`}
                    timeLimit={getTimeLimit(selectedMode)}
                    onTimeUp={handleTimeUp}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------ */}
          {/* QUESTION HEADER                                 */}
          {/* ------------------------------------------------ */}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              padding: '0 2px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                }}
              >
                Question {currentIndex + 1}
              </span>

              <span
                style={{
                  fontSize: 12,
                  color: C.textMuted,
                }}
              >
                of {questions.length}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              {currentQuestion.topic && (
                <span
                  style={{
                    background: C.indigoTint,
                    border: `1px solid ${C.borderIndigo}`,
                    color: C.indigo,
                    padding: '4px 9px',
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {currentQuestion.topic}
                </span>
              )}

              {currentQuestion.difficulty && (
                <span
                  style={{
                    background: difficultyStyle.background,
                    border: `1px solid ${difficultyStyle.border}`,
                    color: difficultyStyle.color,
                    padding: '4px 9px',
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'capitalize',
                  }}
                >
                  {currentQuestion.difficulty}
                </span>
              )}
            </div>
          </div>

          {/* ------------------------------------------------ */}
          {/* QUESTION CARD                                  */}
          {/* ------------------------------------------------ */}

          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: 4,
              boxShadow: C.shadowCard,
              marginBottom: 16,
            }}
          >
            {isLoading ? (
              <div style={{ padding: 20 }}>
                <QuestionSkeleton />
              </div>
            ) : (
              <QuestionCard
                question={currentQuestion.text}
                topic={currentQuestion.topic}
                difficulty={currentQuestion.difficulty}
                number={currentIndex + 1}
              />
            )}
          </div>

          {/* ------------------------------------------------ */}
          {/* ANSWER SECTION                                  */}
          {/* ------------------------------------------------ */}

          {!isSubmitted && !isLoading && (
            <div
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: 18,
                boxShadow: C.shadow,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: C.indigoTint,
                    color: C.indigo,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                  }}
                >
                  ✍️
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                    }}
                  >
                    Your Answer
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: C.textMuted,
                    }}
                  >
                    Explain your thinking clearly.
                  </div>
                </div>
              </div>

            <AnswerBox
  onSubmit={handleSubmit}
  onSkip={handleSkip}
  isSubmitted={isSubmitted}
  question={currentQuestion}
/>
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* FEEDBACK LOADING                                */}
          {/* ------------------------------------------------ */}

          {isLoading && isSubmitted && (
            <div
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: 20,
                boxShadow: C.shadow,
                marginTop: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: C.indigoTint,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                  }}
                >
                  ✨
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                    }}
                  >
                    Analyzing your answer
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: C.textMuted,
                    }}
                  >
                    Preparing your interview feedback...
                  </div>
                </div>
              </div>

              <FeedbackSkeleton />
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* FEEDBACK                                       */}
          {/* ------------------------------------------------ */}

          {isSubmitted && feedback && !isLoading && (
            <div
              style={{
                marginTop: 16,
              }}
            >
            <FeedbackCard
  feedback={feedback}
  onNext={handleNext}
  isRetrying={isLoading}
  isLast={currentIndex === questions.length - 1}
/>
            </div>
          )}

         {error && (
  <div
    style={{
      background: '#FEF2F2',
      border: '1px solid #FECACA',
      color: '#DC2626',
      padding: '12px 16px',
      borderRadius: 12,
      marginTop: 16,
      textAlign: 'center',
      fontSize: 13,
    }}
  >
    {error}
  </div>
)}

          {/* ------------------------------------------------ */}
          {/* BOTTOM TIP                                     */}
          {/* ------------------------------------------------ */}

          {!isSubmitted && !isLoading && (
            <div
              style={{
                textAlign: 'center',
                marginTop: 16,
                fontSize: 11,
                color: C.textMuted,
              }}
            >
              💡 Tip: Focus on the approach, not just the final answer only.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Interview;