import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import useAuth from '../hooks/useAuth';
import { useInterview } from '../hooks/useInterview';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — INTERVIEW v5
// Blueprint-blue system. Session flow now hands off cleanly to the dedicated
// /result debrief page — handleNext() already calls completeInterview() and
// navigates there on the final question, so this file no longer needs (or
// builds) its own end-of-session summary. Keyboard-driven flow (Enter to
// submit/advance, 1–4 to pick MCQ options), a sticky compact timer, smoother
// cross-question transitions, and a full responsiveness/motion pass.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg:       '#F0F4FF',
  bgDeep:   '#E8EEFF',

  card:     '#FFFFFF',
  cardAlt:  '#F8FAFF',

  text:     '#0A1628',
  sub:      '#3D5280',
  muted:    '#7A8BAF',
  faint:    '#A8B8D4',

  border:   '#DDE5F7',
  borderMd: '#B8CAF0',
  borderStr:'#7FA3E8',

  blue50:   '#EBF2FF',
  blue100:  '#C7DAFF',
  blue200:  '#9DBFFF',
  blue400:  '#4D8FFF',
  blue500:  '#1A6EFF',
  blue600:  '#0057E8',
  blue700:  '#0044C4',
  blue900:  '#001F6B',

  cyan400:  '#00C8F0',
  cyan500:  '#00ADE0',
  cyan600:  '#0093C4',
  cyanTint: '#E6F9FF',

  violet:   '#6D5BEE',
  violetTint:'#F0EEFF',

  green:    '#059669',
  greenTint:'#ECFDF5',
  greenGlow:'rgba(5,150,105,0.18)',

  amber:    '#D97706',
  amberTint:'#FFFBEB',
  orange:   '#EA580C',

  red:      '#DC2626',
  redTint:  '#FEF2F2',

  shadow:   '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd: '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg: '0 16px 56px rgba(0,31,107,0.18)',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

// ─── Mode metadata ────────────────────────────────────────────────────────
const MODE_META = {
  quick:    { label: 'Quick Mock',        short: 'QUICK',    icon: '⚡', description: 'A focused five-question interview sprint.',        accent: C.blue500,  soft: C.blue50 },
  full:     { label: 'Full Mock',         short: 'FULL',     icon: '🎯', description: 'A complete interview-style session.',               accent: C.green,    soft: C.greenTint },
  company:  { label: 'Company Specific',  short: 'COMPANY',  icon: '🏢', description: 'Practice around a target company.',                 accent: C.amber,    soft: C.amberTint },
  topic:    { label: 'Topic Focus',       short: 'TOPIC',    icon: '📚', description: 'Deep practice around one technical area.',          accent: C.cyan500,  soft: C.cyanTint },
  mcq:      { label: 'Technical MCQ',     short: 'MCQ',      icon: '☑', description: 'Placement-style technical multiple choice.',        accent: C.violet,   soft: C.violetTint },
  aptitude: { label: 'Aptitude',          short: 'APTITUDE', icon: '◈', description: 'Quantitative and logical reasoning.',               accent: C.amber,    soft: C.amberTint },
  mixed:    { label: 'Mixed Assessment',  short: 'MIXED',    icon: '✦', description: 'Technical, aptitude and open interview practice.',  accent: C.blue500,  soft: C.blue50 },
};

const DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   description: 'Build confidence',       accent: C.green,  soft: C.greenTint, glyph: '↑' },
  { value: 'medium', label: 'Medium', description: 'Placement standard',     accent: C.blue500,soft: C.blue50,    glyph: '◆' },
  { value: 'hard',   label: 'Hard',   description: 'High-pressure prep',     accent: C.red,    soft: C.redTint,   glyph: '🔥' },
  { value: 'mixed',  label: 'Mixed',  description: 'Balanced difficulty',    accent: C.violet, soft: C.violetTint,glyph: '✦' },
];

const COMPANIES = ['TCS', 'Infosys', 'Wipro', 'Zoho', 'Razorpay', 'FAANG'];
const TOPICS = ['DSA', 'System Design', 'OOP', 'DBMS', 'OS', 'JavaScript', 'HR', 'Networking'];

const TIME_LIMITS = { mcq: 45, aptitude: 60, open: 120 };

const difficultyMeta = (difficulty) => {
  if (difficulty === 'easy')   return { label: 'Easy',   color: C.green,  background: C.greenTint, border: '#B7E7D7' };
  if (difficulty === 'hard')   return { label: 'Hard',   color: C.red,    background: C.redTint,   border: '#F1C4C9' };
  if (difficulty === 'mixed')  return { label: 'Mixed',  color: C.violet, background: C.violetTint,border: '#D4CEF9' };
  return { label: 'Medium', color: C.amber, background: C.amberTint, border: '#F1D39B' };
};

const formatTime = (seconds) => {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const scoreColor = (s) => (s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.red);

const Interview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    questions,
    currentIndex,
    feedback,
    isSubmitted,
    isLoading,
    error,
    sessionStarted,
    selectedAnswerIndex,
    isAbandoning,

    handleStart,
    hydrateSession,
    handleSubmit,
    handleSkip,
    handleTimeUp,
    handleNext,
    selectAnswer,
    handleAbandon,
  } = useInterview();

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [selectedDifficulty, setSelectedDifficulty] = useState('mixed');
  const [selectedMode, setSelectedMode] = useState(location.state?.mode || 'quick');
  const [selectedCompany, setSelectedCompany] = useState(location.state?.company || '');
  const [selectedTopic, setSelectedTopic] = useState(location.state?.topic || '');
  const [textAnswer, setTextAnswer] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [timerStarted, setTimerStarted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [questionKey, setQuestionKey] = useState(0); // bumps to retrigger enter transition
  const [isAdvancing, setIsAdvancing] = useState(false); // guards double Enter/click on the final question

  const textAreaRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setTimeout(() => setMounted(true), 40));
  }, []);

  const currentQuestion = questions?.[currentIndex];
  const mode = MODE_META[selectedMode] || MODE_META.quick;
  const totalQuestions = questions.length;
  const progress = totalQuestions ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  const isObjective = currentQuestion && ['mcq', 'aptitude'].includes(currentQuestion.questionType);
  const questionDifficulty = difficultyMeta(currentQuestion?.difficulty);
  const isLastQuestion = currentIndex === totalQuestions - 1;

  // ── Restore a dashboard-created session ───────────────────────────────
  useEffect(() => {
    const incoming = location.state;
    if (incoming?.sessionId && incoming?.questions?.length) {
      hydrateSession(incoming.sessionId, incoming.questions);
      setSelectedMode(incoming.mode || selectedMode);
      setSelectedCompany(incoming.company || '');
      setSelectedTopic(incoming.topic || '');
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, hydrateSession, navigate]);

  // ── Reset per-question state, bump transition key ──────────────────────
  useEffect(() => {
    setTextAnswer('');
    setQuestionKey(k => k + 1);
    if (currentQuestion) {
      setSecondsLeft(Number(currentQuestion.timeLimit) || 120);
      setTimerStarted(true);
    } else {
      setTimerStarted(false);
    }
  }, [currentQuestion?.id, currentQuestion?.timeLimit]);

  // ── Timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionStarted || !currentQuestion || isSubmitted || isLoading || !timerStarted) {
      return undefined;
    }
    if (secondsLeft <= 0) {
      handleTimeUp(currentQuestion.timeLimit);
      return undefined;
    }
    const timerId = window.setInterval(() => {
      setSecondsLeft(previous => {
        if (previous <= 1) {
          window.clearInterval(timerId);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [sessionStarted, currentQuestion, isSubmitted, isLoading, timerStarted, secondsLeft, handleTimeUp]);

  const timerPercent = currentQuestion?.timeLimit
    ? Math.max(0, Math.min(100, (secondsLeft / currentQuestion.timeLimit) * 100))
    : 100;
  const timerCritical = secondsLeft <= 15;

  const canSubmit = !isLoading && (isObjective ? selectedAnswerIndex !== null : Boolean(textAnswer.trim()));

  const doSubmit = useCallback(() => {
    if (!canSubmit || isSubmitted) return;
    handleSubmit(
      textAnswer,
      isObjective ? selectedAnswerIndex : null,
      currentQuestion.timeLimit - secondsLeft,
      false
    );
  }, [canSubmit, isSubmitted, handleSubmit, textAnswer, isObjective, selectedAnswerIndex, currentQuestion, secondsLeft]);

  // handleNext() already owns the "is this the last question" branching:
  // it calls completeInterview() + navigates to /result on the final
  // question, or advances currentIndex otherwise. This file just needs to
  // call it — no local summary state, no interception.
  const doAdvance = useCallback(() => {
    if (isAdvancing || isLoading) return;
    if (isLastQuestion) setIsAdvancing(true);
    handleNext();
  }, [isAdvancing, isLoading, isLastQuestion, handleNext]);

  // ── Keyboard flow: Enter submits or advances; 1-4 pick MCQ options ─────
  useEffect(() => {
    if (!sessionStarted) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Don't hijack Enter while typing in the open-answer textarea unless
        // the user explicitly wants to submit — allow plain Enter there too,
        // since Shift+Enter is reserved for newlines.
        if (document.activeElement === textAreaRef.current && !isObjective) {
          e.preventDefault();
          if (!isSubmitted && canSubmit) doSubmit();
          else if (isSubmitted) doAdvance();
          return;
        }
        e.preventDefault();
        if (!isSubmitted && canSubmit) doSubmit();
        else if (isSubmitted) doAdvance();
      }

      if (!isSubmitted && isObjective && ['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        if (currentQuestion?.options?.[idx] !== undefined) {
          selectAnswer(idx);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sessionStarted, isSubmitted, isObjective, canSubmit, doSubmit, doAdvance, currentQuestion, selectAnswer]);

  // ── Live session preview stats for config screen ────────────────────────
  const estimatedMinutes = useMemo(() => {
    const perQ = selectedMode === 'mcq' ? TIME_LIMITS.mcq
      : selectedMode === 'aptitude' ? TIME_LIMITS.aptitude
      : TIME_LIMITS.open;
    const count = selectedMode === 'full' ? 10 : selectedMode === 'mixed' ? 8 : 5;
    return Math.round((perQ * count) / 60);
  }, [selectedMode]);

  const questionCount = selectedMode === 'full' ? 10 : selectedMode === 'mixed' ? 8 : 5;

  const canLaunch = !isLoading
    && !(selectedMode === 'company' && !selectedCompany)
    && !(selectedMode === 'topic' && !selectedTopic);

  // ─────────────────────────────────────────────────────────────────────
  // CONFIG / START SCREEN
  // ─────────────────────────────────────────────────────────────────────
  if (!sessionStarted) {
    return (
      <div style={S.page} className="iv-page">
        <GlobalStyles />
        <div style={{ ...S.container, maxWidth: 1080, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)' }}>

          <div style={S.strip} className="iv-strip">
            <div style={S.stripL}>
              <span style={S.liveDot} />
              <span style={S.mono}>MOCKMATE SESSION BUILDER</span>
            </div>
            <div style={S.stripR} className="iv-strip-r">
              <span style={S.mono}>AI ASSESSMENT READY</span>
            </div>
          </div>

          <section style={S.hero} className="iv-hero">
            <div style={S.heroScan} />
            <div style={S.heroGrid} className="iv-hero-grid">

              <div style={S.previewBlock} className="iv-preview-block">
                <div style={S.irsLabel}>SESSION PREVIEW</div>
                <div style={S.previewModeRow}>
                  <div key={selectedMode} style={{ ...S.previewModeIcon, background: 'rgba(255,255,255,0.14)' }} className="iv-pop-in">{mode.icon}</div>
                  <div>
                    <div style={S.previewModeLabel}>{mode.label}</div>
                    <div style={S.previewModeSub}>{questionCount} questions · ~{estimatedMinutes} min</div>
                  </div>
                </div>
                <div style={S.previewMetaRow}>
                  <span style={S.previewMetaChip}>
                    {selectedDifficulty === 'mixed' ? 'Balanced difficulty' : `${selectedDifficulty} difficulty`}
                  </span>
                  {selectedCompany && <span style={S.previewMetaChip}>{selectedCompany}</span>}
                  {selectedTopic && <span style={S.previewMetaChip}>{selectedTopic}</span>}
                </div>
              </div>

              <div style={S.verdictBlock}>
                <div style={S.eyebrow}>
                  <span style={S.eyebrowDot} />
                  YOUR NEXT INTERVIEW REP
                </div>
                <h1 style={S.heroH1}>
                  Walk in prepared.<br />
                  <span style={{ color: C.cyan400 }}>Walk out better.</span>
                </h1>
                <p style={S.heroSub}>
                  Choose how you want to be challenged. MockMate generates the session around
                  your mode, topic, company and difficulty — then evaluates the actual answers you give.
                </p>
              </div>
            </div>
          </section>

          <section style={S.card} className="iv-builder-card">

            <div style={S.groupBlock}>
              <div style={S.groupHead}>
                <strong style={S.groupTitle}>Assessment type</strong>
                <span style={S.groupTag}>PICK ONE</span>
              </div>
              <div style={S.modeGrid} className="iv-mode-grid">
                {Object.entries(MODE_META).map(([value, meta]) => {
                  const selected = selectedMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      style={{ ...S.modeCard, ...(selected ? { ...S.modeCardActive, borderColor: meta.accent } : {}) }}
                      className="iv-mode-card"
                      onClick={() => setSelectedMode(value)}
                      aria-pressed={selected}
                    >
                      <div style={{ ...S.modeIcon, color: meta.accent, background: meta.soft }}>{meta.icon}</div>
                      <div style={S.modeCopy}>
                        <strong style={S.modeLabel}>{meta.label}</strong>
                        <span style={S.modeDesc}>{meta.description}</span>
                      </div>
                      <div style={{
                        ...S.modeCheck,
                        background: selected ? meta.accent : '#fff',
                        borderColor: selected ? meta.accent : C.borderMd,
                        transform: selected ? 'scale(1)' : 'scale(0.82)',
                      }}>
                        {selected ? '✓' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={S.divider} />

            <div style={S.groupBlock}>
              <div style={S.groupHead}>
                <strong style={S.groupTitle}>Difficulty</strong>
                <span style={S.groupTag}>PASSED DIRECTLY TO AI</span>
              </div>
              <div style={S.difficultyGrid} className="iv-difficulty-grid">
                {DIFFICULTIES.map(option => {
                  const selected = selectedDifficulty === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      style={{ ...S.difficultyCard, ...(selected ? { ...S.difficultyCardActive, borderColor: option.accent } : {}) }}
                      className="iv-difficulty-card"
                      onClick={() => setSelectedDifficulty(option.value)}
                      aria-pressed={selected}
                    >
                      <div style={{ ...S.difficultyIcon, color: option.accent, background: option.soft }}>{option.glyph}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={S.difficultyLabel}>{option.label}</strong>
                        <span style={S.difficultyDesc}>{option.description}</span>
                      </div>
                      <div style={{
                        ...S.difficultyRadio,
                        borderColor: selected ? option.accent : C.borderMd,
                        background: selected ? option.accent : 'transparent',
                      }}>
                        {selected ? '✓' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {(selectedMode === 'company' || selectedMode === 'topic') && (
              <div className="iv-fade-in">
                <div style={S.divider} />
                <div style={S.groupBlock}>
                  <div style={S.groupHead}>
                    <strong style={S.groupTitle}>Target</strong>
                    <span style={S.groupTag}>REQUIRED FOR THIS MODE</span>
                  </div>

                  {selectedMode === 'company' && (
                    <select
                      style={S.builderSelect}
                      value={selectedCompany}
                      onChange={e => setSelectedCompany(e.target.value)}
                    >
                      <option value="">Choose a company</option>
                      {COMPANIES.map(company => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
                  )}

                  {selectedMode === 'topic' && (
                    <select
                      style={S.builderSelect}
                      value={selectedTopic}
                      onChange={e => setSelectedTopic(e.target.value)}
                    >
                      <option value="">Choose a topic</option>
                      {TOPICS.map(topic => (
                        <option key={topic} value={topic}>{topic}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            <div style={S.divider} />

            <div style={S.launchArea} className="iv-launch-area">
              <div style={S.sessionSummary}>
                <div style={{ ...S.summaryIcon, color: mode.accent, background: mode.soft }}>{mode.icon}</div>
                <div>
                  <strong style={S.summaryTitle}>{mode.label}</strong>
                  <span style={S.summarySub}>
                    {selectedDifficulty === 'mixed' ? 'Balanced difficulty' : `${selectedDifficulty} difficulty`}
                    {' · '}
                    {user?.name ? `${user.name.split(' ')[0]}'s session` : 'Personalized session'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                style={{ ...S.btnLaunch, ...(canLaunch ? {} : S.btnDisabled) }}
                className="iv-btn-launch"
                disabled={!canLaunch}
                onClick={() => handleStart(selectedMode, selectedCompany, selectedTopic, selectedDifficulty)}
              >
                {isLoading ? (
                  <>
                    <span style={S.spinner} />
                    Generating questions…
                  </>
                ) : (
                  <>Start interview →</>
                )}
              </button>
            </div>

            <div style={S.footnote}>
              Difficulty: <strong style={{ color: C.sub }}>{selectedDifficulty}</strong>
              {' · '}MCQ: 45s · Aptitude: 60s · Open: 120s
              {' · '}Press <kbd style={S.kbd}>Enter</kbd> to submit answers once you're in
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // SAFETY — questions still loading, or we've just handed off to /result
  // ─────────────────────────────────────────────────────────────────────
  if (!currentQuestion || isAdvancing) {
    return (
      <div style={S.page} className="iv-page">
        <GlobalStyles />
        <div style={S.emptyWrap}>
          <div style={S.emptySpinner} />
          <h2 style={S.emptyTitle}>
            {isAdvancing ? 'Scoring your session' : 'Preparing your interview'}
          </h2>
          <p style={S.emptySub}>
            {isAdvancing ? 'Building your full report — almost there…' : 'Loading your next generated question…'}
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // INTERVIEW ROOM
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page} className="iv-page">
      <GlobalStyles />
      <div style={{ ...S.container, maxWidth: 1140 }}>

        <header style={S.roomTop} className="iv-room-top">
          <div style={S.stripL}>
            <span style={S.liveDot} />
            <span style={S.mono}>LIVE INTERVIEW ROOM</span>
          </div>
          <div style={S.roomActions}>
            <span style={S.mono}>{mode.label.toUpperCase()}</span>
            <span style={{ color: C.borderMd }}>·</span>
            <button type="button" style={S.exitBtn} className="iv-exit-btn" onClick={() => setShowExitConfirm(true)}>Exit</button>
          </div>
        </header>

        {showExitConfirm && (
          <div style={S.exitOverlay} onClick={() => !isAbandoning && setShowExitConfirm(false)}>
            <div style={S.exitModal} onClick={(e) => e.stopPropagation()}>
              <div style={S.exitModalTitle}>Leave this interview?</div>
              <div style={S.exitModalBody}>
                Your progress on this session won't be scored. It'll be marked
                as abandoned so it doesn't count toward your stats or streak.
              </div>
              <div style={S.exitModalRow}>
                <button
                  type="button"
                  style={S.exitModalCancel}
                  onClick={() => setShowExitConfirm(false)}
                  disabled={isAbandoning}
                >
                  Keep going
                </button>
                <button
                  type="button"
                  style={{ ...S.exitModalConfirm, opacity: isAbandoning ? 0.7 : 1 }}
                  onClick={() => handleAbandon('/dashboard')}
                  disabled={isAbandoning}
                >
                  {isAbandoning ? 'Exiting…' : 'Exit interview'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Compact combined progress + timer bar */}
        <section style={S.consoleCard} className="iv-console-card">
          <div style={S.consoleTop}>
            <div style={S.consoleContext}>
              <div style={{ ...S.consoleModeIcon, background: mode.soft, color: mode.accent }}>{mode.icon}</div>
              <div style={{ minWidth: 0 }}>
                <strong style={S.consoleModeLabel}>{mode.label}</strong>
                <span style={S.consoleModeSub}>{currentQuestion.topic || 'General'} · {questionDifficulty.label}</span>
              </div>
            </div>

            <div style={S.consoleRight}>
              {!isSubmitted && (
                <TimerRing seconds={secondsLeft} percent={timerPercent} critical={timerCritical} accent={mode.accent} />
              )}
              <div style={S.questionNumber}>
                <strong style={{ color: mode.accent }}>{String(currentIndex + 1).padStart(2, '0')}</strong>
                <span>/{String(totalQuestions).padStart(2, '0')}</span>
              </div>
            </div>
          </div>

          <div style={S.progressTrack}>
            <div style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${mode.accent}, ${C.cyan400})` }} />
          </div>

          <div style={S.trail} className="iv-trail">
            {Array.from({ length: totalQuestions }).map((_, i) => {
              const isPast = i < currentIndex;
              const isCurrent = i === currentIndex;
              const col = isPast ? mode.accent : C.border;
              return (
                <div
                  key={i}
                  style={{
                    ...S.trailDot,
                    background: isCurrent ? mode.accent : col,
                    transform: isCurrent ? 'scale(1.4)' : 'scale(1)',
                    opacity: isPast || isCurrent ? 1 : 0.5,
                  }}
                  title={`Question ${i + 1}`}
                />
              );
            })}
          </div>
        </section>

        <main style={S.roomGrid} className="iv-room-grid">

          <section key={`q-${questionKey}`} style={S.questionPanel} className="iv-fade-in iv-question-panel">
            <div style={S.questionPanelTop}>
              <span style={S.questionLabel}>QUESTION {String(currentIndex + 1).padStart(2, '0')}</span>
              <div style={S.questionTags}>
                <span style={{ background: questionDifficulty.background, color: questionDifficulty.color, borderColor: questionDifficulty.border, border: '1px solid', padding: '4px 9px', borderRadius: 999, fontSize: 9, fontWeight: 700, fontFamily: F.mono, letterSpacing: '0.5px' }}>
                  {questionDifficulty.label}
                </span>
                <span style={S.questionTagNeutral}>
                  {currentQuestion.questionType === 'mcq' ? 'MCQ' : currentQuestion.questionType === 'aptitude' ? 'APTITUDE' : 'OPEN'}
                </span>
              </div>
            </div>

            <div style={S.questionBody}>
              <div style={S.questionType}>
                {currentQuestion.questionType === 'mcq' ? 'TECHNICAL DECISION'
                  : currentQuestion.questionType === 'aptitude' ? 'REASONING PROBLEM'
                  : 'INTERVIEW RESPONSE'}
              </div>

              <h1 style={S.questionText}>{currentQuestion.text}</h1>

              <div style={S.questionHelp}>
                <span style={{ color: mode.accent }}>✦</span>
                {currentQuestion.questionType === 'mcq'
                  ? 'Choose the strongest answer. Only one option is correct.'
                  : currentQuestion.questionType === 'aptitude'
                    ? 'Solve carefully before choosing. Avoid rushing the arithmetic.'
                    : 'Lead with the core answer, then explain your reasoning or give a practical example.'}
              </div>
            </div>

            {isObjective && !isSubmitted && (
              <div style={S.kbdHint}>
                Press <kbd style={S.kbd}>1</kbd>–<kbd style={S.kbd}>4</kbd> to pick, <kbd style={S.kbd}>Enter</kbd> to submit
              </div>
            )}
          </section>

          <section style={S.answerPanel} className="iv-answer-panel">
            {!isSubmitted ? (
              <>
                <div style={S.answerHeading}>
                  <div>
                    <span style={S.answerHeadingEyebrow}>RESPONSE</span>
                    <strong style={S.answerHeadingTitle}>{isObjective ? 'Choose an answer' : 'Build your response'}</strong>
                  </div>
                  <div style={S.answerModeTag}>{isObjective ? 'SELECT' : 'WRITE'}</div>
                </div>

                {isObjective ? (
                  <div style={S.options}>
                    {(currentQuestion.options || []).map((option, index) => {
                      const selected = selectedAnswerIndex === index;
                      return (
                        <button
                          key={`${currentQuestion.id}-${index}`}
                          type="button"
                          style={{ ...S.option, ...(selected ? { ...S.optionActive, borderColor: mode.accent, background: mode.soft } : {}) }}
                          className="iv-option"
                          onClick={() => selectAnswer(index)}
                        >
                          <span style={{ ...S.optionLetter, ...(selected ? { background: mode.accent, borderColor: mode.accent, color: '#fff' } : {}) }}>
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span style={S.optionText}>{option}</span>
                          <span style={{ ...S.optionRadio, ...(selected ? { borderColor: mode.accent, background: mode.accent } : {}) }}>
                            {selected ? '✓' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    ref={textAreaRef}
                    style={S.answerBox}
                    value={textAnswer}
                    onChange={e => setTextAnswer(e.target.value)}
                    placeholder="Write your answer here... (Enter to submit, Shift+Enter for a new line)"
                    rows={9}
                  />
                )}

                <div style={S.answerFooter}>
                  <span style={S.answerFooterHint}>
                    {isObjective
                      ? (selectedAnswerIndex !== null ? 'Answer selected' : 'Select one option to continue')
                      : `${textAnswer.length} characters`}
                  </span>

                  <div style={S.answerActions}>
                    <button
                      type="button"
                      style={S.skipBtn}
                      className="iv-skip-btn"
                      disabled={isLoading}
                      onClick={() => handleSkip(currentQuestion.timeLimit - secondsLeft)}
                    >
                      Skip
                    </button>

                    <button
                      type="button"
                      style={{ ...S.submitBtn, ...(!canSubmit ? S.btnDisabled : {}) }}
                      className="iv-submit-btn"
                      disabled={!canSubmit}
                      onClick={doSubmit}
                    >
                      {isLoading ? 'Checking…' : isLastQuestion ? 'Submit final answer' : 'Submit answer →'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <FeedbackView
                question={currentQuestion}
                feedback={feedback}
                onNext={doAdvance}
                isLoading={isLoading || isAdvancing}
                isLast={isLastQuestion}
                accent={mode.accent}
              />
            )}
          </section>
        </main>

        {!isSubmitted && (
          <div style={S.roomFoot}>
            <span style={{ color: C.blue500 }}>✦</span>
            Focus on clarity, reasoning and technical correctness.
          </div>
        )}

        {error && (
          <div style={S.errorBanner} className="iv-fade-in">
            <strong>Something went wrong</strong>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════
const TimerRing = ({ seconds, percent, critical, accent }) => {
  const size = 46;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const color = critical ? C.red : accent;

  return (
    <div style={S.ringWrap} className={critical ? 'iv-ring-critical' : ''}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={C.border} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div style={{ ...S.ringLabel, color }}>{formatTime(seconds)}</div>
    </div>
  );
};

const FeedbackView = ({ question, feedback, onNext, isLoading, isLast, accent }) => {
  const score = Number(feedback?.score) || 0;
  const objective = ['mcq', 'aptitude'].includes(question.questionType);
  const correct = feedback?.correct === true;

  const color = objective ? (correct ? C.green : C.red)
    : score >= 80 ? C.green : score >= 60 ? C.blue500 : C.amber;
  const background = objective ? (correct ? C.greenTint : C.redTint)
    : score >= 80 ? C.greenTint : score >= 60 ? C.blue50 : C.amberTint;

  return (
    <div style={S.feedback} className="iv-fade-in">
      <div style={S.feedbackHero}>
        <div style={{ ...S.feedbackScore, color, background }} className="iv-score-pop">
          {objective ? (correct ? '✓' : '×') : score}
        </div>
        <div>
          <span style={S.feedbackEyebrow}>
            {objective ? (correct ? 'CORRECT ANSWER' : 'ANSWER REVIEW') : 'AI INTERVIEW REVIEW'}
          </span>
          <h2 style={S.feedbackTitle}>
            {objective
              ? (correct ? 'Nice work.' : 'Good attempt. Learn from it.')
              : score >= 80 ? 'Strong answer.' : score >= 60 ? 'Solid base. Refine it.' : 'This answer gives you a clear next step.'}
          </h2>
        </div>
      </div>

      {objective ? (
        <div style={S.objectiveFeedback}>
          <div style={S.feedbackResult}>
            <span>RESULT</span>
            <strong style={{ color }}>{correct ? 'Correct' : 'Incorrect'}</strong>
          </div>
          <div style={S.feedbackNote}>{feedback?.raw || 'Your answer has been recorded.'}</div>
        </div>
      ) : (
        <div style={S.feedbackGrid} className="iv-feedback-grid">
          <FeedbackBlock title="What worked" value={feedback?.good} color={C.green} background={C.greenTint} />
          <FeedbackBlock title="What was missing" value={feedback?.missing} color={C.red} background={C.redTint} />
          <FeedbackBlock title="Key idea" value={feedback?.idealHint} color={C.blue500} background={C.blue50} />
          <FeedbackBlock title="Next move" value={feedback?.tip} color={C.amber} background={C.amberTint} />

          {feedback?.sampleAnswer && (
            <div style={S.sample}>
              <span>STRONG ANSWER PATTERN</span>
              <p>{feedback.sampleAnswer}</p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        style={{ ...S.nextBtn, background: `linear-gradient(135deg, ${C.blue700}, ${accent})`, ...(isLoading ? S.btnDisabled : {}) }}
        className="iv-next-btn"
        onClick={onNext}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span style={S.spinner} />
            {isLast ? 'Preparing your report…' : 'Preparing…'}
          </>
        ) : isLast ? 'View your results →' : 'Continue to next question →'}
      </button>
      <div style={S.nextBtnHint}>Press <kbd style={S.kbd}>Enter</kbd> to continue</div>
    </div>
  );
};

const FeedbackBlock = ({ title, value, color, background }) => (
  <div style={{ ...S.feedbackBlock, background, borderColor: `${color}30` }}>
    <span style={{ color }}>{title}</span>
    <p>{value || 'No additional feedback was returned.'}</p>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES
// ═══════════════════════════════════════════════════════════════════════════
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @keyframes ivSpin       { to { transform: rotate(360deg); } }
    @keyframes ivLivePulse  { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
    @keyframes ivScan       { 0% { transform:translateX(-100%); } 100% { transform:translateX(320%); } }
    @keyframes ivFadeIn     { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes ivPopIn      { 0% { opacity:0; transform:scale(0.85); } 100% { opacity:1; transform:scale(1); } }
    @keyframes ivScorePop   { 0% { opacity:0; transform:scale(0.6) rotate(-8deg); } 60% { transform:scale(1.08) rotate(2deg); } 100% { opacity:1; transform:scale(1) rotate(0); } }
    @keyframes ivRingPulse  { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.35); } 50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); } }

    *, *::before, *::after { box-sizing: border-box; }

    .iv-fade-in { animation: ivFadeIn 0.32s cubic-bezier(.16,1,.3,1); }
    .iv-pop-in { animation: ivPopIn 0.28s cubic-bezier(.34,1.56,.64,1); }
    .iv-score-pop { animation: ivScorePop 0.42s cubic-bezier(.34,1.56,.64,1); }
    .iv-ring-critical { border-radius: 50%; animation: ivRingPulse 1.1s ease-in-out infinite; }

    .iv-page button {
      transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease, background 0.14s ease, opacity 0.14s ease;
    }
    .iv-page button:active:not(:disabled) { transform: scale(0.97); }
    .iv-page button:disabled { cursor: not-allowed; }

    .iv-page button:focus-visible,
    .iv-page textarea:focus-visible,
    .iv-page select:focus-visible {
      outline: 2px solid ${C.blue500};
      outline-offset: 2px;
    }

    .iv-mode-card:hover:not(:disabled)       { border-color: ${C.borderStr} !important; box-shadow: ${C.shadow}; transform: translateY(-1px); }
    .iv-difficulty-card:hover:not(:disabled) { border-color: ${C.borderStr} !important; transform: translateY(-1px); }
    .iv-option:hover:not(:disabled)          { border-color: ${C.borderStr} !important; transform: translateY(-1px); }
    .iv-exit-btn:hover                        { background: ${C.cardAlt} !important; border-color: ${C.borderStr} !important; }
    .iv-skip-btn:hover:not(:disabled)         { background: ${C.cardAlt} !important; border-color: ${C.borderStr} !important; }
    .iv-btn-launch:hover:not(:disabled)       { box-shadow: 0 12px 30px rgba(26,110,255,0.36) !important; transform: translateY(-1px); }
    .iv-submit-btn:hover:not(:disabled)       { box-shadow: 0 10px 24px rgba(26,110,255,0.32) !important; transform: translateY(-1px); }
    .iv-next-btn:hover:not(:disabled)         { filter: brightness(1.06); transform: translateY(-1px); }

    .iv-page textarea {
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }
    .iv-page textarea:focus {
      border-color: ${C.blue500};
      box-shadow: 0 0 0 3px rgba(26,110,255,0.08);
      background: #fff;
    }

    .iv-question-panel, .iv-answer-panel, .iv-console-card {
      transition: box-shadow 0.2s ease;
    }

    @media (prefers-reduced-motion: reduce) {
      .iv-page * { animation: none !important; transition: none !important; }
    }

    @media (max-width: 1020px) {
      .iv-hero-grid { grid-template-columns: 1fr !important; gap: 22px !important; text-align: center; }
      .iv-preview-block { display: flex; flex-direction: column; align-items: center; }
      .iv-room-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 760px) {
      .iv-strip-r { display: none !important; }
      .iv-mode-grid { grid-template-columns: 1fr !important; }
      .iv-difficulty-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .iv-launch-area { flex-direction: column !important; align-items: stretch !important; }
      .iv-feedback-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 620px) {
      .iv-room-top { flex-wrap: wrap; gap: 8px; }
      .iv-trail { flex-wrap: wrap; }
    }
    @media (max-width: 480px) {
      .iv-page { padding: 12px 10px 56px !important; }
      .iv-builder-card { padding: 14px !important; }
      .iv-question-panel, .iv-answer-panel { padding: 16px !important; min-height: unset !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  page: {
    minHeight: '100vh',
    background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`,
    padding: '20px 24px 64px',
    fontFamily: F.body,
  },
  container: {
    margin: '0 auto',
    transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(.16,1,.3,1)',
  },

  strip: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 14px', marginBottom: 16, borderRadius: 10,
    background: C.card, border: `1px solid ${C.border}`,
    boxShadow: C.shadow,
  },
  stripL: { display: 'flex', alignItems: 'center', gap: 9 },
  stripR: { display: 'flex', alignItems: 'center', gap: 10 },
  liveDot: {
    width: 7, height: 7, borderRadius: '50%', background: C.green,
    animation: 'ivLivePulse 2.4s ease-in-out infinite',
    boxShadow: `0 0 8px ${C.greenGlow}`,
  },
  mono: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.5px', color: C.muted },

  hero: {
    position: 'relative', overflow: 'hidden',
    padding: '28px 28px', marginBottom: 14, borderRadius: 22,
    background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 45%, ${C.blue600} 75%, ${C.cyan600} 100%)`,
    boxShadow: '0 20px 56px rgba(0,31,107,0.30)',
  },
  heroScan: {
    position: 'absolute', top: 0, left: 0, width: '25%', height: '100%',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
    animation: 'ivScan 9s linear infinite',
  },
  heroGrid: {
    position: 'relative',
    display: 'grid', gridTemplateColumns: '260px 1fr', gap: 30, alignItems: 'center',
  },

  previewBlock: {},
  irsLabel: {
    fontFamily: F.mono, fontSize: 9.5, fontWeight: 600,
    letterSpacing: '1.4px', color: 'rgba(255,255,255,0.6)', marginBottom: 12,
  },
  previewModeRow: { display: 'flex', alignItems: 'center', gap: 11 },
  previewModeIcon: {
    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
  },
  previewModeLabel: { fontFamily: F.display, fontSize: 16, fontWeight: 800, color: '#fff' },
  previewModeSub: { marginTop: 3, fontSize: 11.5, color: 'rgba(255,255,255,0.65)', fontFamily: F.mono },
  previewMetaRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14, justifyContent: 'inherit' },
  previewMetaChip: {
    padding: '5px 10px', borderRadius: 999,
    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff', fontSize: 10.5, fontWeight: 700, fontFamily: F.body,
  },

  verdictBlock: {},
  eyebrow: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontFamily: F.mono, fontSize: 9.5, fontWeight: 700,
    letterSpacing: '1.6px', color: 'rgba(255,255,255,0.7)', marginBottom: 10,
  },
  eyebrowDot: { width: 6, height: 6, borderRadius: '50%', background: C.cyan400 },
  heroH1: {
    margin: 0, fontFamily: F.display, fontSize: 27, fontWeight: 900,
    color: '#fff', lineHeight: 1.15, letterSpacing: '-0.5px', maxWidth: 600,
  },
  heroSub: { margin: '12px 0 0', fontSize: 13, lineHeight: 1.68, color: 'rgba(255,255,255,0.78)', maxWidth: 540 },

  card: {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 20, boxShadow: C.shadow, overflow: 'hidden',
  },
  groupBlock: { padding: '16px 22px' },
  groupHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 10, marginBottom: 11,
  },
  groupTitle: { color: C.text, fontFamily: F.display, fontSize: 13.5, fontWeight: 800 },
  groupTag: { color: C.faint, fontFamily: F.mono, fontSize: 9, letterSpacing: '0.6px' },
  divider: { height: 1, background: C.border },

  modeGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9 },
  modeCard: {
    display: 'flex', alignItems: 'center', gap: 11,
    minHeight: 68, border: `1px solid ${C.border}`, background: C.card,
    borderRadius: 14, padding: 11, cursor: 'pointer', textAlign: 'left',
  },
  modeCardActive: {
    background: `linear-gradient(135deg, ${C.cardAlt}, #fff)`,
    boxShadow: C.shadow,
  },
  modeIcon: {
    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
  },
  modeCopy: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  modeLabel: { color: C.text, fontFamily: F.display, fontSize: 12.5, fontWeight: 800 },
  modeDesc: { marginTop: 2, color: C.muted, fontSize: 11, lineHeight: 1.35 },
  modeCheck: {
    width: 20, height: 20, border: '1.5px solid', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 9, flexShrink: 0,
    transition: 'transform 0.18s cubic-bezier(.34,1.56,.64,1), background 0.14s ease, border-color 0.14s ease',
  },

  difficultyGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  difficultyCard: {
    display: 'flex', alignItems: 'center', gap: 9,
    minHeight: 60, border: `1px solid ${C.border}`, background: C.card,
    borderRadius: 13, padding: 10, cursor: 'pointer', textAlign: 'left',
  },
  difficultyCardActive: { background: C.cardAlt },
  difficultyIcon: {
    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900,
  },
  difficultyLabel: { display: 'block', color: C.text, fontFamily: F.display, fontSize: 12, fontWeight: 800 },
  difficultyDesc: { display: 'block', marginTop: 1, color: C.muted, fontSize: 10, lineHeight: 1.3 },
  difficultyRadio: {
    width: 18, height: 18, borderRadius: '50%', border: '1.5px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 8, flexShrink: 0,
  },

  builderSelect: {
    width: '100%', height: 44, border: `1px solid ${C.borderMd}`, borderRadius: 11,
    background: C.cardAlt, padding: '0 13px', color: C.text,
    fontFamily: F.body, fontSize: 13, outline: 'none',
  },

  launchArea: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, padding: '16px 22px',
    background: C.cardAlt,
  },
  sessionSummary: { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 },
  summaryIcon: {
    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  },
  summaryTitle: { display: 'block', color: C.text, fontFamily: F.display, fontSize: 12.5, fontWeight: 800 },
  summarySub: { display: 'block', marginTop: 2, color: C.muted, fontSize: 11 },

  btnLaunch: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minWidth: 190, border: 'none', borderRadius: 12, padding: '13px 18px',
    color: '#fff', background: `linear-gradient(135deg, ${C.blue700}, ${C.blue500})`,
    boxShadow: `0 8px 22px rgba(26,110,255,0.28)`, cursor: 'pointer',
    fontFamily: F.body, fontSize: 13, fontWeight: 800,
  },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' },
  spinner: {
    width: 13, height: 13, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
    animation: 'ivSpin 0.7s linear infinite', display: 'inline-block',
  },

  footnote: {
    padding: '11px 22px 16px', color: C.faint,
    fontFamily: F.mono, fontSize: 10, letterSpacing: '0.3px',
  },
  kbd: {
    display: 'inline-block', padding: '1px 6px', borderRadius: 5,
    border: `1px solid ${C.borderMd}`, background: C.cardAlt, color: C.sub,
    fontFamily: F.mono, fontSize: 9.5, fontWeight: 700,
  },

  // Room
  roomTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  roomActions: { display: 'flex', alignItems: 'center', gap: 10 },
  exitBtn: {
    border: `1px solid ${C.borderMd}`, background: C.card, borderRadius: 9,
    padding: '7px 12px', color: C.sub, cursor: 'pointer',
    fontSize: 11.5, fontWeight: 700, fontFamily: F.body,
  },

  exitOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 20,
  },
  exitModal: {
    width: '100%', maxWidth: 380, background: C.card, borderRadius: 18,
    border: `1px solid ${C.border}`, boxShadow: '0 24px 60px rgba(10,22,40,0.28)',
    padding: '22px 22px 18px',
  },
  exitModalTitle: { fontSize: 16, fontWeight: 800, color: C.text, fontFamily: F.body, marginBottom: 6 },
  exitModalBody: { fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 18 },
  exitModalRow: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  exitModalCancel: {
    border: `1px solid ${C.border}`, background: C.card, borderRadius: 10,
    padding: '9px 16px', color: C.sub, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 700, fontFamily: F.body,
  },
  exitModalConfirm: {
    border: '1px solid transparent', background: C.red || '#E24C4C', borderRadius: 10,
    padding: '9px 16px', color: '#fff', cursor: 'pointer',
    fontSize: 12.5, fontWeight: 700, fontFamily: F.body,
  },

  consoleCard: {
    padding: '13px 16px', border: `1px solid ${C.border}`, borderRadius: 16,
    background: C.card, boxShadow: C.shadow, marginBottom: 10,
    position: 'sticky', top: 8, zIndex: 5,
  },
  consoleTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  consoleContext: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  consoleModeIcon: {
    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
  },
  consoleModeLabel: { display: 'block', color: C.text, fontFamily: F.display, fontSize: 12.5, fontWeight: 800 },
  consoleModeSub: { display: 'block', marginTop: 1, color: C.muted, fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  consoleRight: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  questionNumber: { display: 'flex', alignItems: 'baseline', gap: 3, fontFamily: F.display, fontSize: 14 },

  progressTrack: {
    marginTop: 10, height: 6, borderRadius: 999, background: '#EAF0F6', overflow: 'hidden',
  },
  trail: { display: 'flex', gap: 5, marginTop: 9 },
  trailDot: { width: 8, height: 8, borderRadius: '50%', transition: 'all 0.25s ease', flexShrink: 0 },

  ringWrap: { position: 'relative', width: 46, height: 46, flexShrink: 0, borderRadius: '50%' },
  ringLabel: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: F.display, fontSize: 10, fontWeight: 800,
  },

  roomGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },

  questionPanel: {
    minHeight: 380, padding: 22, display: 'flex', flexDirection: 'column',
    border: `1px solid ${C.border}`, borderRadius: 18, background: C.card, boxShadow: C.shadow,
  },
  questionPanelTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  questionLabel: { fontFamily: F.mono, color: C.blue500, fontSize: 10, fontWeight: 700, letterSpacing: '1px' },
  questionTags: { display: 'flex', gap: 6 },
  questionTagNeutral: {
    padding: '4px 9px', borderRadius: 999, border: `1px solid ${C.border}`,
    background: C.cardAlt, color: C.muted, fontSize: 9, fontFamily: F.mono, letterSpacing: '0.6px',
  },
  questionBody: { margin: 'auto 0' },
  questionType: {
    marginBottom: 10, color: C.faint, fontSize: 10, letterSpacing: '1.2px',
    fontWeight: 700, fontFamily: F.mono,
  },
  questionText: {
    margin: 0, color: C.text, fontFamily: F.display,
    fontSize: 'clamp(21px, 2.3vw, 28px)', lineHeight: 1.3, fontWeight: 800, letterSpacing: '-0.4px',
  },
  questionHelp: {
    display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 18, paddingTop: 14,
    borderTop: `1px solid ${C.border}`, color: C.sub, fontSize: 12.5, lineHeight: 1.55,
  },
  kbdHint: {
    marginTop: 14, fontSize: 10.5, color: C.faint, fontFamily: F.mono,
    display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
  },

  answerPanel: {
    minHeight: 380, padding: 18,
    border: `1px solid ${C.border}`, borderRadius: 18, background: C.card, boxShadow: C.shadow,
  },
  answerHeading: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 9, marginBottom: 13 },
  answerHeadingEyebrow: { display: 'block', color: C.blue500, fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1px' },
  answerHeadingTitle: { display: 'block', marginTop: 3, color: C.text, fontFamily: F.display, fontSize: 15, fontWeight: 800 },
  answerModeTag: {
    padding: '4px 9px', borderRadius: 999, border: `1px solid ${C.border}`,
    background: C.cardAlt, color: C.muted, fontSize: 9, fontFamily: F.mono, letterSpacing: '0.7px',
  },

  answerBox: {
    width: '100%', minHeight: 220, resize: 'vertical',
    border: `1px solid ${C.borderMd}`, borderRadius: 14, background: C.cardAlt,
    color: C.text, padding: 13, outline: 'none',
    fontFamily: F.body, fontSize: 13.5, lineHeight: 1.7,
  },

  options: { display: 'flex', flexDirection: 'column', gap: 8 },
  option: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 50,
    border: `1px solid ${C.border}`, borderRadius: 13, background: C.card,
    padding: '9px 11px', cursor: 'pointer', textAlign: 'left',
  },
  optionActive: { boxShadow: C.shadow },
  optionLetter: {
    width: 27, height: 27, borderRadius: 8, border: `1px solid ${C.border}`,
    background: C.cardAlt, color: C.sub, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, fontFamily: F.mono, fontSize: 11, fontWeight: 800,
    transition: 'background 0.14s ease, border-color 0.14s ease, color 0.14s ease',
  },
  optionText: { flex: 1, color: C.text, fontSize: 13, lineHeight: 1.45 },
  optionRadio: {
    width: 19, height: 19, borderRadius: '50%', border: `1px solid ${C.borderMd}`,
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 9, flexShrink: 0,
    transition: 'background 0.14s ease, border-color 0.14s ease',
  },

  answerFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    marginTop: 13, paddingTop: 13, borderTop: `1px solid ${C.border}`,
  },
  answerFooterHint: { color: C.faint, fontFamily: F.mono, fontSize: 10 },
  answerActions: { display: 'flex', gap: 8 },
  skipBtn: {
    border: `1px solid ${C.borderMd}`, background: C.card, borderRadius: 10,
    padding: '10px 15px', color: C.sub, cursor: 'pointer',
    fontFamily: F.body, fontSize: 12, fontWeight: 800,
  },
  submitBtn: {
    border: 'none', borderRadius: 10, padding: '10px 17px',
    background: `linear-gradient(135deg, ${C.blue700}, ${C.blue500})`, color: '#fff',
    boxShadow: `0 7px 18px rgba(26,110,255,0.22)`, cursor: 'pointer',
    fontFamily: F.body, fontSize: 12, fontWeight: 800,
  },

  feedback: { minHeight: 340, display: 'flex', flexDirection: 'column' },
  feedbackHero: { display: 'flex', alignItems: 'center', gap: 13, paddingBottom: 14, borderBottom: `1px solid ${C.border}` },
  feedbackScore: {
    width: 52, height: 52, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: F.display, fontSize: 19, fontWeight: 900, flexShrink: 0,
  },
  feedbackEyebrow: { color: C.blue500, fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1px' },
  feedbackTitle: { margin: '4px 0 0', color: C.text, fontFamily: F.display, fontSize: 16.5, fontWeight: 800 },

  feedbackGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9, marginTop: 13 },
  feedbackBlock: { padding: 11, border: '1px solid', borderRadius: 12 },
  sample: { gridColumn: '1 / -1', padding: 11, borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}` },

  objectiveFeedback: { marginTop: 13 },
  feedbackResult: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 12, background: C.cardAlt,
  },
  feedbackNote: {
    marginTop: 8, padding: 12, borderRadius: 12, background: C.cardAlt,
    border: `1px solid ${C.border}`, color: C.sub, fontSize: 12.5, lineHeight: 1.55, wordBreak: 'break-word',
  },

  nextBtn: {
    width: '100%', marginTop: 'auto', border: 'none', borderRadius: 12, padding: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    color: '#fff', fontFamily: F.body, fontSize: 13, fontWeight: 800, cursor: 'pointer',
    boxShadow: `0 9px 22px rgba(26,110,255,0.24)`,
  },
  nextBtnHint: { marginTop: 8, textAlign: 'center', fontSize: 10.5, color: C.faint, fontFamily: F.mono },

  roomFoot: { marginTop: 11, textAlign: 'center', color: C.muted, fontSize: 11.5, letterSpacing: '0.2px' },

  errorBanner: {
    marginTop: 10, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
    padding: '10px 13px', borderRadius: 11, background: C.redTint, border: '1px solid #F0C5C9',
    color: C.red, fontSize: 12, fontFamily: F.mono,
  },

  emptyWrap: { minHeight: '72vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  emptySpinner: {
    width: 46, height: 46, borderRadius: '50%', border: `4px solid ${C.blue50}`,
    borderTopColor: C.blue500, animation: 'ivSpin 0.75s linear infinite',
  },
  emptyTitle: { marginTop: 16, fontFamily: F.display, fontSize: 16, fontWeight: 700, color: C.text },
  emptySub: { marginTop: 5, fontSize: 12.5, color: C.muted },
};

export default Interview;