import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { useInterview } from '../hooks/useInterview';
import InterviewLoader from '../components/InterviewLoader';
import { C as CT, F } from '../styles/token';
import QuestionDisplay   from '../components/interview/QuestionDisplay';
import InterviewControls from '../components/interview/InterviewControls';
import FeedbackPanel     from '../components/interview/FeedbackPanel';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — INTERVIEW v5
// Blueprint-blue system. Session flow hands off to /result debrief page on
// the final question. Keyboard-driven flow (Enter to submit/advance, 1–4 for
// MCQ), sticky compact timer, smooth cross-question transitions, full
// responsiveness and motion pass.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  ...CT,
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
};

// ─── Countdown beep (10s → 1s) ───────────────────────────────────────────
const playTimeWarningBeep = (secondsLeft = 10) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const urgencyRatio = Math.max(0, Math.min(1, (10 - secondsLeft) / 9));
    const freq   = 600 + urgencyRatio * 600;
    const volume = 0.08 + urgencyRatio * 0.12;
    const ticks  = secondsLeft <= 5 ? [0, 0.12] : [0];

    ticks.forEach((offset) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = secondsLeft <= 3 ? 'square' : 'sine';
      osc.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(volume, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.12);
    });

    setTimeout(() => ctx.close?.(), 600);
  } catch {
    // Silently ignore — never surface audio errors to the user.
  }
};

// ─── Mode metadata ────────────────────────────────────────────────────────
const MODE_META = {
  quick:    { label: 'Quick Mock',        short: 'QUICK',    icon: '⚡', description: '5 focused questions — ideal for daily practice.',         accent: C.blue500, soft: C.blue50      },
  full:     { label: 'Full Mock',         short: 'FULL',     icon: '🎯', description: 'A complete placement-style interview session.',            accent: C.green,   soft: C.greenTint   },
  company:  { label: 'Company Specific',  short: 'COMPANY',  icon: '🏢', description: 'Prep tailored around your target company.',               accent: C.amber,   soft: C.amberTint   },
  topic:    { label: 'Topic Focus',       short: 'TOPIC',    icon: '📖', description: 'Deep dive into one technical area.',                      accent: C.cyan500, soft: C.cyanTint    },
  mcq:      { label: 'Technical MCQ',     short: 'MCQ',      icon: '✅', description: 'Placement-style multiple choice questions.',              accent: C.violet,  soft: C.violetTint  },
  aptitude: { label: 'Aptitude',          short: 'APTITUDE', icon: '🧮', description: 'Quantitative and logical reasoning problems.',            accent: C.amber,   soft: C.amberTint   },
  mixed:    { label: 'Mixed Assessment',  short: 'MIXED',    icon: '🔀', description: 'Technical, aptitude and open questions combined.',        accent: C.blue500, soft: C.blue50      },
};

const DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   description: 'Build confidence',    accent: C.green,   soft: C.greenTint,  glyph: '😊' },
  { value: 'medium', label: 'Medium', description: 'Placement standard',  accent: C.blue500, soft: C.blue50,     glyph: '💪' },
  { value: 'hard',   label: 'Hard',   description: 'High-pressure prep',  accent: C.red,     soft: C.redTint,    glyph: '🔥' },
  { value: 'mixed',  label: 'Mixed',  description: 'Balanced difficulty', accent: C.violet,  soft: C.violetTint, glyph: '🎲' },
];

const COMPANIES = ['TCS', 'Infosys', 'Wipro', 'Zoho', 'Razorpay', 'FAANG'];

const TOPICS = ['DSA', 'System Design', 'OOP', 'DBMS', 'OS', 'JavaScript', 'HR', 'Networking'];

const TIME_LIMITS = { mcq: 45, aptitude: 60, open: 90 };

const MODE_QUESTION_COUNT  = { full: 10, mixed: 8 };
const getQuestionCount     = (mode) => MODE_QUESTION_COUNT[mode] ?? 5;

const FALLBACK_TIME_LIMIT  = 120;
const MIN_ANSWER_WORDS     = 8;

const difficultyMeta = (difficulty) => {
  if (difficulty === 'easy')  return { label: 'Easy',   color: C.green,  background: C.greenTint,  border: '#B7E7D7' };
  if (difficulty === 'hard')  return { label: 'Hard',   color: C.red,    background: C.redTint,    border: '#F1C4C9' };
  if (difficulty === 'mixed') return { label: 'Mixed',  color: C.violet, background: C.violetTint, border: '#D4CEF9' };
  return                             { label: 'Medium', color: C.amber,  background: C.amberTint,  border: '#F1D39B' };
};

const formatTime = (seconds) => {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  const mins  = Math.floor(total / 60);
  const secs  = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// INLINE NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

const useNotif = () => {
  const [notif, setNotif] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((message, type = 'info', duration = 3500) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setNotif({ message, type, key: Date.now() });
    if (duration !== Infinity) {
      timerRef.current = setTimeout(() => setNotif(null), duration);
    }
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setNotif(null);
  }, []);

  const notifApi = useMemo(() => ({
    notif,
    loading: (msg)       => show(msg, 'loading', Infinity),
    success: (msg, dur)  => show(msg, 'success', dur ?? 3000),
    error:   (msg, dur)  => show(msg, 'error',   dur ?? 4500),
    info:    (msg, dur)  => show(msg, 'info',     dur ?? 3000),
    dismiss,
  }), [notif, show, dismiss]);

  return notifApi;
};

const NOTIF_ICONS  = { loading: null, success: '✓', error: '✕', info: 'ℹ' };
const NOTIF_COLORS = {
  loading: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', spinner: '#3B82F6' },
  success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', spinner: null },
  error:   { bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C', spinner: null },
  info:    { bg: '#F8FAFF', border: '#C7DAFF', text: '#1A6EFF', spinner: null },
};

const NotifBar = ({ notif }) => {
  if (!notif) return null;
  const { bg, border, text, spinner } = NOTIF_COLORS[notif.type] || NOTIF_COLORS.info;
  const icon = NOTIF_ICONS[notif.type];
  return (
    <div
      key={notif.key}
      className="iv-notif-bar"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', background: bg,
        border: `1px solid ${border}`, borderRadius: 10,
        marginBottom: 10, color: text,
        fontSize: 12.5, fontFamily: F.body, fontWeight: 500, lineHeight: 1.4,
      }}
    >
      {notif.type === 'loading' ? (
        <span className="iv-notif-spinner" style={{ color: spinner, flexShrink: 0 }} />
      ) : (
        <span style={{
          width: 18, height: 18, borderRadius: '50%',
          background: `${text}18`, border: `1.5px solid ${text}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, flexShrink: 0, color: text,
        }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1 }}>{notif.message}</span>
    </div>
  );
};

NotifBar.propTypes = {
  notif: PropTypes.shape({
    key:     PropTypes.number,
    type:    PropTypes.oneOf(['loading', 'success', 'error', 'info']),
    message: PropTypes.string,
  }),
};
NotifBar.defaultProps = { notif: null };

// ═══════════════════════════════════════════════════════════════════════════
// INTERVIEW
// ═══════════════════════════════════════════════════════════════════════════

const Interview = () => {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const notify    = useNotif();

  const {
    questions, currentIndex, feedback, isSubmitted,
    isLoading, error, sessionStarted, selectedAnswerIndex, isAbandoning,
    handleStart, hydrateSession, handleSubmit, handleSkip,
    handleTimeUp, handleNext, selectAnswer, handleAbandon,
  } = useInterview({ notify });

  const [showExitConfirm,    setShowExitConfirm]    = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(
    { easy: 'easy', medium: 'mixed', hard: 'hard' }[user?.difficultyPref] ?? 'mixed'
  );
  const [selectedMode,    setSelectedMode]    = useState(
    location.state?.mode ||
    { frontend: 'topic', backend: 'topic', data: 'topic' }[user?.targetRole] ||
    'quick'
  );
  const [selectedCompany, setSelectedCompany] = useState(location.state?.company || '');
  const [selectedTopic,   setSelectedTopic]   = useState(location.state?.topic   || '');
  const [textAnswer,      setTextAnswer]       = useState('');
  const [secondsLeft,     setSecondsLeft]      = useState(90);
  const [timerActive,     setTimerActive]      = useState(false);
  const [mounted,         setMounted]          = useState(false);
  const [questionKey,     setQuestionKey]      = useState(0);
  const [isAdvancing,     setIsAdvancing]      = useState(false);
  const [wasSkipped,      setWasSkipped]       = useState(false);
  const [shortSubmitPending, setShortSubmitPending] = useState(false);

  const textAnswerRef   = useRef('');
  const answerIndexRef  = useRef(null);
  const textAreaRef     = useRef(null);
  const submitLockRef   = useRef(false);
  const transitionRef   = useRef(false);
  const mountedRef      = useRef(true);
  const beepedTicksRef  = useRef(new Set());
  const submitTimeRef   = useRef(0);
  const secondsLeftRef  = useRef(90);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let rafId;
    let timerId;
    rafId = requestAnimationFrame(() => {
      timerId = setTimeout(() => setMounted(true), 40);
    });
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, []);

  const currentQuestion   = questions?.[currentIndex];
  const mode              = MODE_META[selectedMode] || MODE_META.quick;
  const totalQuestions    = questions?.length ?? 0;
  const progress          = totalQuestions ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  const isObjective       = currentQuestion && ['mcq', 'aptitude'].includes(currentQuestion.questionType);
  const currentDifficulty = difficultyMeta(currentQuestion?.difficulty);
  const isLastQuestion    = currentIndex === totalQuestions - 1;
  const questionsLeft     = Math.max(0, totalQuestions - currentIndex - 1);

  const sessionMinsLeft = useMemo(() => {
    const perQ = Number(currentQuestion?.timeLimit) || TIME_LIMITS.open;
    return Math.ceil((questionsLeft * perQ + secondsLeft) / 60);
  }, [questionsLeft, secondsLeft, currentQuestion?.timeLimit]);

  useEffect(() => {
    if (!showExitConfirm) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [showExitConfirm]);

  useEffect(() => {
    if (!showExitConfirm) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isAbandoning) setShowExitConfirm(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showExitConfirm, isAbandoning]);

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

  useEffect(() => {
    if (isSubmitted) submitTimeRef.current = Date.now();
  }, [isSubmitted]);

  useEffect(() => {
    setTextAnswer('');
    textAnswerRef.current  = '';
    answerIndexRef.current = null;
    setQuestionKey((k) => k + 1);
    setWasSkipped(false);
    setShortSubmitPending(false);
    beepedTicksRef.current = new Set();
    submitLockRef.current  = false;
    setTimerActive(false);

    if (!currentQuestion) {
      setSecondsLeft(0);
      secondsLeftRef.current = 0;
      return undefined;
    }

    const limit = Number(currentQuestion.timeLimit) || FALLBACK_TIME_LIMIT;
    setSecondsLeft(limit);
    secondsLeftRef.current = limit;

    transitionRef.current = true;
    const frameId = window.requestAnimationFrame(() => {
      transitionRef.current = false;
      setTimerActive(true);
    });

    return () => { window.cancelAnimationFrame(frameId); };
  }, [currentQuestion?.id, currentQuestion?.timeLimit]);

  useEffect(() => {
    if (!sessionStarted || !currentQuestion || isSubmitted || isObjective) return undefined;
    const id = setTimeout(() => textAreaRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [sessionStarted, currentQuestion?.id, isObjective, isSubmitted]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sessionStarted || !currentQuestion || isSubmitted || isLoading || !timerActive || transitionRef.current) {
      return undefined;
    }
    const questionId = currentQuestion.id;

    const timerId = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { window.clearInterval(timerId); return 0; }
        const next = prev - 1;
        secondsLeftRef.current = next;
        if (next >= 1 && next <= 10) {
          const beepKey = `${questionId ?? 'unknown'}-${next}`;
          if (!beepedTicksRef.current.has(beepKey)) {
            beepedTicksRef.current.add(beepKey);
            playTimeWarningBeep(next);
          }
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [sessionStarted, currentQuestion?.id, isSubmitted, isLoading, timerActive]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sessionStarted || !currentQuestion || isSubmitted || isLoading || !timerActive) return undefined;
    if (secondsLeft > 0) return undefined;
    if (submitLockRef.current) return undefined;

    submitLockRef.current = true;
    const timeTaken = currentQuestion.timeLimit;

    if (isObjective) {
      if (answerIndexRef.current !== null && answerIndexRef.current !== undefined) {
        handleSubmit(null, answerIndexRef.current, timeTaken, false)
          .finally(() => { if (mountedRef.current) submitLockRef.current = false; });
      } else {
        setWasSkipped(true);
        handleTimeUp(timeTaken)
          .finally(() => { if (mountedRef.current) submitLockRef.current = false; });
      }
    } else if (textAnswerRef.current.trim()) {
      handleSubmit(textAnswerRef.current, null, timeTaken, false)
        .finally(() => { if (mountedRef.current) submitLockRef.current = false; });
    } else {
      setWasSkipped(true);
      handleTimeUp(timeTaken)
        .finally(() => { if (mountedRef.current) submitLockRef.current = false; });
    }
  }, [secondsLeft, sessionStarted, isSubmitted, isLoading, timerActive]);

  const timerPercent = currentQuestion?.timeLimit
    ? Math.max(0, Math.min(100, (secondsLeft / currentQuestion.timeLimit) * 100))
    : 100;

  const timerWarning  = secondsLeft <= 30 && secondsLeft > 15;
  const timerCritical = secondsLeft <= 15;

  const canSubmit = !isLoading && (
    isObjective ? selectedAnswerIndex !== null : Boolean(textAnswer.trim())
  );

  const wordCount = useMemo(
    () => (textAnswer.trim() ? textAnswer.trim().split(/\s+/).length : 0),
    [textAnswer]
  );
  const isShortAnswer = !isObjective && wordCount > 0 && wordCount < MIN_ANSWER_WORDS;

  const doSubmit = useCallback(() => {
    if (!canSubmit || isSubmitted || !currentQuestion) return;
    if (isShortAnswer && !shortSubmitPending) {
      setShortSubmitPending(true);
      return;
    }
    setShortSubmitPending(false);
    handleSubmit(
      textAnswer,
      isObjective ? selectedAnswerIndex : null,
      currentQuestion.timeLimit - secondsLeftRef.current,
      false
    );
  }, [canSubmit, isSubmitted, handleSubmit, textAnswer, isObjective, selectedAnswerIndex, currentQuestion, isShortAnswer, shortSubmitPending]);

  const doAdvance = useCallback(() => {
    if (isAdvancing || isLoading) return;
    if (isLastQuestion) setIsAdvancing(true);
    transitionRef.current = true;
    const result = handleNext();
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        if (mountedRef.current) {
          setIsAdvancing(false);
          setShortSubmitPending(false);
          transitionRef.current = false;
        }
      });
    }
  }, [isAdvancing, isLoading, isLastQuestion, handleNext]);

  const doSubmitRef  = useRef(doSubmit);
  const doAdvanceRef = useRef(doAdvance);
  useEffect(() => { doSubmitRef.current  = doSubmit;  }, [doSubmit]);
  useEffect(() => { doAdvanceRef.current = doAdvance; }, [doAdvance]);

  useEffect(() => {
    if (!sessionStarted) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (isSubmitted) {
          if (Date.now() - submitTimeRef.current < 600) return;
          e.preventDefault();
          doAdvanceRef.current();
          return;
        }
        e.preventDefault();
        if (canSubmit) doSubmitRef.current();
      }
      if (!isSubmitted && isObjective && ['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        if (currentQuestion?.options?.[idx] !== undefined) selectAnswer(idx);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sessionStarted, isSubmitted, isObjective, canSubmit, currentQuestion, selectAnswer]);

  const exitModalRef = useRef(null);
  useEffect(() => {
    if (!showExitConfirm || !exitModalRef.current) return undefined;
    const modal    = exitModalRef.current;
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    modal.addEventListener('keydown', trap);
    return () => modal.removeEventListener('keydown', trap);
  }, [showExitConfirm]);

  const estimatedMinutes = useMemo(() => {
    const perQ  = TIME_LIMITS[selectedMode] ?? TIME_LIMITS.open;
    const count = getQuestionCount(selectedMode);
    return Math.round((perQ * count) / 60);
  }, [selectedMode]);

  const questionCount   = getQuestionCount(selectedMode);
  const canLaunch       = !isLoading && !(selectedMode === 'company' && !selectedCompany) && !(selectedMode === 'topic' && !selectedTopic);
  const difficultyLabel = selectedDifficulty === 'mixed' ? 'Balanced difficulty' : `${selectedDifficulty} difficulty`;

  const handleTextChange = useCallback((e) => {
    const val = e.target.value;
    setTextAnswer(val);
    textAnswerRef.current = val;
    if (shortSubmitPending) setShortSubmitPending(false);
  }, [shortSubmitPending]);

  const handleSelectAnswer = useCallback((idx) => {
    selectAnswer(idx);
    answerIndexRef.current = idx;
  }, [selectAnswer]);

  // ─────────────────────────────────────────────────────────────────────
  // CONFIG SCREEN
  // ─────────────────────────────────────────────────────────────────────
  if (!sessionStarted) {
    if (isLoading) {
      return (
        <div style={{ ...S.page, background: C.bg }} className="iv-page">
          <GlobalStyles />
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
            <InterviewLoader />
          </div>
        </div>
      );
    }

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
                  <div key={selectedMode} style={{ ...S.previewModeIcon, background: 'rgba(255,255,255,0.14)' }} className="iv-pop-in">
                    {mode.icon}
                  </div>
                  <div>
                    <div style={S.previewModeLabel}>{mode.label}</div>
                    <div style={S.previewModeSub}>{questionCount} questions · ~{estimatedMinutes} min</div>
                  </div>
                </div>
                <div style={S.previewMetaRow}>
                  <span style={S.previewMetaChip}>{difficultyLabel}</span>
                  {selectedCompany && <span style={S.previewMetaChip}>{selectedCompany}</span>}
                  {selectedTopic   && <span style={S.previewMetaChip}>{selectedTopic}</span>}
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
            <div style={S.groupBlock} className="iv-group-block">
              <div style={S.groupHead}>
                <strong style={S.groupTitle}><span style={S.groupTitleAccent} />Assessment type</strong>
                <span style={S.groupTag}>PICK ONE</span>
              </div>
              <div style={S.modeGrid} className="iv-mode-grid">
                {Object.entries(MODE_META).map(([value, meta]) => {
                  const selected = selectedMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      style={{ ...S.modeCard, ...(selected ? { ...S.modeCardActive, borderStyle: 'solid', borderWidth: 1.5, borderColor: meta.accent } : {}) }}
                      className="iv-mode-card"
                      onClick={() => setSelectedMode(value)}
                      aria-pressed={selected}
                    >
                      <div style={{ ...S.modeIcon, color: meta.accent, background: meta.soft }}>{meta.icon}</div>
                      <div style={S.modeCopy}>
                        <strong style={S.modeLabel} className="iv-mode-label">{meta.label}</strong>
                        <span style={S.modeDesc} className="iv-mode-desc">{meta.description}</span>
                      </div>
                      <div style={{ ...S.modeCheck, background: selected ? meta.accent : '#fff', borderStyle: 'solid', borderWidth: 1.5, borderColor: selected ? meta.accent : C.borderMd, transform: selected ? 'scale(1)' : 'scale(0.82)' }}>
                        {selected ? '✓' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={S.divider} />

            <div style={S.groupBlock} className="iv-group-block">
              <div style={S.groupHead}>
                <strong style={S.groupTitle}><span style={S.groupTitleAccent} />Difficulty</strong>
                <span style={S.groupTag}>PASSED DIRECTLY TO AI</span>
              </div>
              <div style={S.difficultyGrid} className="iv-difficulty-grid">
                {DIFFICULTIES.map((option) => {
                  const selected = selectedDifficulty === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      style={{ ...S.difficultyCard, ...(selected ? { ...S.difficultyCardActive, borderStyle: 'solid', borderWidth: 1.5, borderColor: option.accent } : {}) }}
                      className="iv-difficulty-card"
                      onClick={() => setSelectedDifficulty(option.value)}
                      aria-pressed={selected}
                    >
                      <div style={{ ...S.difficultyIcon, color: option.accent, background: option.soft }}>{option.glyph}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={S.difficultyLabel} className="iv-difficulty-label">{option.label}</strong>
                        <span style={S.difficultyDesc} className="iv-difficulty-desc">{option.description}</span>
                      </div>
                      <div style={{ ...S.difficultyRadio, borderColor: selected ? option.accent : C.borderMd, background: selected ? option.accent : 'transparent' }}>
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
                <div style={S.groupBlock} className="iv-group-block">
                  <div style={S.groupHead}>
                    <strong style={S.groupTitle}><span style={S.groupTitleAccent} />Target</strong>
                    <span style={S.groupTag}>REQUIRED FOR THIS MODE</span>
                  </div>
                  {selectedMode === 'company' && (
                    <select style={S.builderSelect} className="iv-builder-select" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
                      <option value="">Choose a company</option>
                      {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {selectedMode === 'topic' && (
                    <select style={S.builderSelect} className="iv-builder-select" value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
                      <option value="">Choose a topic</option>
                      {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
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
                    {difficultyLabel}{' · '}
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
                {isLoading ? <><span style={S.spinner} />Generating questions…</> : <>Start interview →</>}
              </button>
            </div>

            <div style={S.footnote} className="iv-footnote">
              Difficulty: <strong style={{ color: C.sub }}>{selectedDifficulty}</strong>
              {' · '}MCQ: 45s · Aptitude: 60s · Open: 90s
              {' · '}Press <kbd style={S.kbd}>Enter</kbd> to submit answers once you're in
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // LOADING / TRANSITION
  // ─────────────────────────────────────────────────────────────────────
  if (!currentQuestion || isAdvancing) {
    return (
      <div style={{ ...S.page, background: C.bg }} className="iv-page">
        <GlobalStyles />
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <InterviewLoader />
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
        {/* ── Room header ── */}
        <header style={S.roomTop} className="iv-room-top">
          <div style={S.stripL}>
            <span style={S.liveDot} />
            <span style={S.mono}>LIVE INTERVIEW ROOM</span>
          </div>
          <div style={S.roomActions}>
            <span style={S.mono}>{mode.label.toUpperCase()}</span>
            <span style={{ color: C.borderMd }}>·</span>
            <button type="button" style={S.exitBtn} className="iv-exit-btn" onClick={() => setShowExitConfirm(true)}>
              Exit
            </button>
          </div>
        </header>

        {/* ── Exit confirmation modal ── */}
        {showExitConfirm && createPortal(
          <div
            style={S.exitOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-interview-title"
            aria-describedby="exit-interview-body"
            onClick={() => !isAbandoning && setShowExitConfirm(false)}
          >
            <div ref={exitModalRef} style={S.exitModal} className="iv-exit-modal" onClick={(e) => e.stopPropagation()}>
              <div id="exit-interview-title" style={S.exitModalTitle}>Leave this interview?</div>
              <div id="exit-interview-body" style={S.exitModalBody}>
                Your progress on this session won't be scored. It'll be marked as abandoned so
                it doesn't count toward your stats or streak.
              </div>
              <div style={S.exitModalRow}>
                <button type="button" style={S.exitModalCancel} onClick={() => setShowExitConfirm(false)} disabled={isAbandoning}>
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
          </div>,
          document.body
        )}

        {/* ── Sticky console card (progress + timer) ── */}
        <section style={S.consoleCard} className="iv-console-card">
          <NotifBar notif={notify.notif} />
          <div style={S.consoleTop}>
            <div style={S.consoleContext}>
              <div style={{ ...S.consoleModeIcon, background: mode.soft, color: mode.accent }} className="iv-console-mode-icon">
                {mode.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={S.consoleModeLabel}>{mode.label}</strong>
                <span style={S.consoleModeSub}>{currentQuestion.topic || 'General'} · {currentDifficulty.label}</span>
              </div>
            </div>
            <div style={S.consoleRight}>
              {!isSubmitted && (
                <TimerRing
                  seconds={secondsLeft}
                  percent={timerPercent}
                  warning={timerWarning}
                  critical={timerCritical}
                  accent={mode.accent}
                />
              )}
              <div style={S.questionNumber}>
                <strong style={{ color: mode.accent }}>{String(currentIndex + 1).padStart(2, '0')}</strong>
                <span>/{String(totalQuestions).padStart(2, '0')}</span>
              </div>
              {questionsLeft > 0 && (
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.faint, whiteSpace: 'nowrap', letterSpacing: '0.2px' }}>
                  {sessionMinsLeft} min left
                </span>
              )}
            </div>
          </div>

          <div style={S.progressTrack}>
            <div style={{
              width: `${progress}%`, height: '100%', borderRadius: 999,
              background: `linear-gradient(90deg, ${mode.accent}, ${C.cyan400})`,
              transition: 'width 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: `0 0 6px ${mode.accent}55`,
            }} />
          </div>

          <div style={S.trail} className="iv-trail">
            {Array.from({ length: totalQuestions }).map((_, i) => {
              const isPast    = i < currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <div
                  key={i}
                  style={{
                    ...S.trailDot,
                    width:      isCurrent ? 18 : 7,
                    background: isCurrent ? mode.accent : isPast ? `${mode.accent}90` : C.border,
                    opacity:    isPast || isCurrent ? 1 : 0.45,
                  }}
                  title={`Question ${i + 1}`}
                />
              );
            })}
          </div>
        </section>

        {/* ── Two-column room grid ── */}
        <main style={S.roomGrid} className="iv-room-grid">

          {/* Left: question display
              key causes QuestionDisplay to remount on question change,
              re-triggering the iv-question-slide CSS animation. */}
          <QuestionDisplay
            key={`q-${questionKey}`}
            currentQuestion={currentQuestion}
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
            currentDifficulty={currentDifficulty}
            isObjective={isObjective}
            isSubmitted={isSubmitted}
            mode={mode}
          />

          {/* Right: answer input (pre-submission) or feedback (post-submission) */}
          <section style={S.answerPanel} className="iv-answer-panel">
            {!isSubmitted ? (
              <InterviewControls
                currentQuestion={currentQuestion}
                isObjective={isObjective}
                selectedAnswerIndex={selectedAnswerIndex}
                textAnswer={textAnswer}
                onTextChange={handleTextChange}
                onSelectAnswer={handleSelectAnswer}
                canSubmit={canSubmit}
                isLoading={isLoading}
                isLastQuestion={isLastQuestion}
                shortSubmitPending={shortSubmitPending}
                wordCount={wordCount}
                onSkip={() => { setWasSkipped(true); handleSkip(currentQuestion.timeLimit - secondsLeftRef.current); }}
                onSubmit={doSubmit}
                textAreaRef={textAreaRef}
                mode={mode}
              />
            ) : (
              <FeedbackPanel
                question={currentQuestion}
                feedback={feedback}
                onNext={doAdvance}
                isLoading={isLoading || isAdvancing}
                isLast={isLastQuestion}
                accent={mode.accent}
                userAnswerIndex={selectedAnswerIndex}
                skipped={wasSkipped}
                questionIndex={currentIndex}
                totalQuestions={totalQuestions}
              />
            )}
          </section>

        </main>

        {/* ── Room footer tip ── */}
        {!isSubmitted && (
          <div style={S.roomFoot} className="iv-footnote">
            {currentQuestion.questionType === 'mcq'
              ? '🎯 Eliminate clearly wrong options first — pattern recognition beats guessing.'
              : currentQuestion.questionType === 'aptitude'
                ? '🧮 Show your working — partial marks matter and it helps you catch errors.'
                : '💬 Clarity beats length. A focused 60-word answer scores better than a rambling 200-word one.'}
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
// TIMER RING
// ═══════════════════════════════════════════════════════════════════════════

const TimerRing = ({ seconds, percent, warning, critical, accent }) => {
  const size          = 58;
  const stroke        = 5;
  const radius        = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset        = circumference * (1 - percent / 100);
  const color         = critical ? C.red : warning ? C.amber : accent;
  const urgencyClass  = critical ? 'iv-ring-critical' : warning ? 'iv-ring-warning' : '';

  return (
    <div
      style={{ ...S.ringWrap, width: size, height: size }}
      className={urgencyClass}
      role="timer"
      aria-label={`Time remaining: ${formatTime(seconds)}`}
      aria-live="off"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={C.border} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease',
            filter: critical
              ? 'drop-shadow(0 0 3px rgba(220,38,38,0.55))'
              : warning
                ? 'drop-shadow(0 0 2px rgba(217,119,6,0.4))'
                : 'none',
          }}
        />
      </svg>
      <div style={{ ...S.ringLabel, color, fontSize: critical ? 13 : warning ? 12 : 11, fontWeight: critical ? 900 : 700, letterSpacing: critical ? '-0.5px' : '0px', transition: 'color 0.4s ease, font-size 0.2s ease' }}>
        {formatTime(seconds)}
      </div>
    </div>
  );
};

TimerRing.propTypes = {
  seconds:  PropTypes.number.isRequired,
  percent:  PropTypes.number.isRequired,
  warning:  PropTypes.bool.isRequired,
  critical: PropTypes.bool.isRequired,
  accent:   PropTypes.string.isRequired,
};

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES
// ═══════════════════════════════════════════════════════════════════════════

const GlobalStyles = () => (
  <style>{`
    @keyframes ivSpin          { to { transform:rotate(360deg); } }
    @keyframes ivLivePulse     { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
    @keyframes ivScan          { 0% { transform:translateX(-100%); } 100% { transform:translateX(320%); } }
    @keyframes ivFadeIn        { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes ivSlideQuestion { from { opacity:0; transform:translateX(10px) translateY(4px); } to { opacity:1; transform:translateX(0) translateY(0); } }
    @keyframes ivPopIn         { 0% { opacity:0; transform:scale(0.85); } 100% { opacity:1; transform:scale(1); } }
    @keyframes ivScorePop      { 0% { opacity:0; transform:scale(0.6) rotate(-8deg); } 60% { transform:scale(1.08) rotate(2deg); } 100% { opacity:1; transform:scale(1) rotate(0); } }
    @keyframes ivBarGrow       { from { width:0%; } }
    @keyframes ivRingPulse     { 0%,100% { box-shadow:0 0 0 0 rgba(220,38,38,0.40); } 50% { box-shadow:0 0 0 7px rgba(220,38,38,0); } }
    @keyframes ivRingWarn      { 0%,100% { box-shadow:0 0 0 0 rgba(217,119,6,0.35); } 50% { box-shadow:0 0 0 6px rgba(217,119,6,0); } }
    @keyframes ivNotifIn       { from { opacity:0; transform:translateY(-6px) scaleY(0.92); } to { opacity:1; transform:translateY(0) scaleY(1); } }
    @keyframes ivNotifSpin     { to { transform:rotate(360deg); } }

    *, *::before, *::after { box-sizing:border-box; }

    .iv-fb-bar         { animation:ivBarGrow 0.7s cubic-bezier(.16,1,.3,1); }
    .iv-fade-in        { animation:ivFadeIn 0.32s cubic-bezier(.16,1,.3,1); }
    .iv-question-slide { animation:ivSlideQuestion 0.30s cubic-bezier(.16,1,.3,1); }
    .iv-pop-in         { animation:ivPopIn 0.28s cubic-bezier(.34,1.56,.64,1); }
    .iv-score-pop      { animation:ivScorePop 0.42s cubic-bezier(.34,1.56,.64,1); }
    .iv-ring-critical  { border-radius:50%; animation:ivRingPulse 1.0s ease-in-out infinite; }
    .iv-ring-warning   { border-radius:50%; animation:ivRingWarn  1.4s ease-in-out infinite; }
    .iv-notif-bar      { animation:ivNotifIn 0.22s cubic-bezier(.16,1,.3,1); transform-origin:top center; }
    .iv-notif-spinner  { display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:ivNotifSpin 0.7s linear infinite; opacity:0.8; }
    .iv-btn-loading::after { content:''; display:inline-block; width:11px; height:11px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:ivSpin 0.65s linear infinite; margin-left:7px; vertical-align:middle; }

    .iv-page button { transition:transform 0.16s cubic-bezier(.16,1,.3,1), box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease, opacity 0.16s ease, filter 0.16s ease, color 0.16s ease; }
    .iv-page button:active:not(:disabled)  { transform:scale(0.96) !important; filter:brightness(0.97); }
    .iv-page button:disabled               { cursor:not-allowed; }
    .iv-page button:focus-visible,
    .iv-page textarea:focus-visible,
    .iv-page select:focus-visible          { outline:2.5px solid ${C.blue500}; outline-offset:2px; }
    .iv-builder-select:focus               { border-color:${C.blue500} !important; box-shadow:0 0 0 3px rgba(26,110,255,0.12) !important; outline:none !important; }

    .iv-mode-card:hover:not(:disabled)       { border-color:${C.borderStr} !important; box-shadow:0 6px 20px rgba(26,110,255,0.10); transform:translateY(-2px); }
    .iv-difficulty-card:hover:not(:disabled) { border-color:${C.borderStr} !important; transform:translateY(-2px); box-shadow:0 4px 14px rgba(26,110,255,0.08); }
    .iv-option:hover:not(:disabled)          { border-color:${C.borderMd}  !important; transform:translateX(2px); box-shadow:0 3px 12px rgba(26,110,255,0.07); }
    .iv-exit-btn:hover                       { background:${C.cardAlt} !important; border-color:${C.borderStr} !important; color:${C.red} !important; }
    .iv-skip-btn:hover:not(:disabled)        { background:${C.cardAlt} !important; border-color:${C.borderMd}  !important; color:${C.sub} !important; }
    .iv-btn-launch:hover:not(:disabled)      { box-shadow:0 14px 36px rgba(26,110,255,0.38) !important; transform:translateY(-2px); }
    .iv-submit-btn:hover:not(:disabled)      { box-shadow:0 12px 28px rgba(26,110,255,0.38) !important; transform:translateY(-2px); filter:brightness(1.05); }
    .iv-next-btn:hover:not(:disabled)        { filter:brightness(1.07); transform:translateY(-2px); box-shadow:0 12px 28px rgba(26,110,255,0.32) !important; }

    .iv-page textarea { transition:border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease; }
    .iv-page textarea:focus                               { border-color:${C.blue500}; box-shadow:0 0 0 3px rgba(26,110,255,0.10); background:#fff; outline:none; }
    .iv-page textarea:not(:placeholder-shown):not(:focus) { border-color:${C.green}80; background:#FAFFFE; }

    .iv-question-panel, .iv-answer-panel, .iv-console-card { transition:box-shadow 0.24s ease, border-color 0.24s ease; }
    .iv-question-panel:hover { box-shadow:0 8px 28px rgba(26,110,255,0.09) !important; border-color:${C.borderMd} !important; }
    .iv-answer-panel:hover   { box-shadow:0 6px 22px rgba(26,110,255,0.07) !important; }

    @media (prefers-reduced-motion: reduce) { .iv-page * { animation:none !important; transition:none !important; } }

    @media (max-width: 1020px) {
      .iv-hero-grid     { grid-template-columns:1fr !important; gap:20px !important; text-align:center; }
      .iv-preview-block { display:flex; flex-direction:column; align-items:center; }
      .iv-room-grid     { grid-template-columns:1fr !important; }
    }
    @media (max-width: 900px)  { .iv-difficulty-grid { grid-template-columns:repeat(2,1fr) !important; } }
    @media (max-width: 760px)  {
      .iv-strip-r            { display:none !important; }
      .iv-mode-grid          { grid-template-columns:1fr !important; }
      .iv-launch-area        { flex-direction:column !important; align-items:stretch !important; gap:12px !important; }
      .iv-launch-area button { width:100% !important; min-width:unset !important; }
      .iv-feedback-grid      { grid-template-columns:1fr !important; }
      .iv-fb-sample-toggle   { font-size:12px !important; }
    }
    @media (max-width: 620px) { .iv-room-top { flex-wrap:wrap; gap:8px; } .iv-trail { flex-wrap:wrap; } }
    @media (max-width: 480px) {
      .iv-page              { padding:12px 10px 72px !important; }
      .iv-hero              { padding:20px 16px !important; border-radius:16px !important; }
      .iv-builder-card      { border-radius:16px !important; }
      .iv-group-block       { padding:14px 16px !important; }
      .iv-mode-card         { min-height:72px !important; padding:12px 14px !important; gap:12px !important; }
      .iv-mode-label        { font-size:14px !important; }
      .iv-mode-desc         { font-size:12.5px !important; }
      .iv-difficulty-grid   { grid-template-columns:repeat(2,1fr) !important; gap:8px !important; }
      .iv-difficulty-card   { min-height:68px !important; padding:11px 12px !important; }
      .iv-difficulty-label  { font-size:13.5px !important; }
      .iv-difficulty-desc   { font-size:12px !important; }
      .iv-builder-select    { height:52px !important; font-size:14px !important; }
      .iv-launch-area       { padding:16px !important; }
      .iv-question-panel, .iv-answer-panel { padding:15px 14px !important; min-height:unset !important; border-radius:14px !important; }
      .iv-question-text     { font-size:16px !important; line-height:1.6 !important; }
      .iv-answer-actions    { flex-direction:column !important; }
      .iv-skip-btn          { width:100% !important; order:2 !important; text-align:center !important; }
      .iv-submit-btn        { width:100% !important; order:1 !important; text-align:center !important; }
      .iv-console-card      { padding:11px 13px !important; position:relative !important; top:unset !important; }
      .iv-console-mode-icon { width:30px !important; height:30px !important; font-size:14px !important; }
      .iv-next-btn-wrap     { position:sticky !important; bottom:16px !important; background:${C.card} !important; padding:12px !important; margin:16px -14px -14px !important; border-radius:0 0 14px 14px !important; box-shadow:0 -4px 16px rgba(10,22,40,0.08) !important; border-top:1px solid ${C.border} !important; }
      .iv-fb-score-num      { font-size:36px !important; letter-spacing:-1.5px !important; }
      .iv-fb-secondary      { grid-template-columns:1fr !important; }
      .iv-footnote          { font-size:11.5px !important; padding:12px 16px 20px !important; line-height:1.8 !important; }
      .iv-exit-modal        { width:calc(100vw - 24px) !important; max-width:380px !important; max-height:calc(100dvh - 24px) !important; margin:0 !important; padding:20px 18px 18px !important; }
      .iv-mcq-option        { padding:12px 13px !important; min-height:52px !important; }
    }
    @media (max-width: 360px) {
      .iv-hero            { padding:16px 14px !important; }
      .iv-group-block     { padding:12px 14px !important; }
      .iv-difficulty-grid { gap:6px !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const S = {
  // ── Layout ──────────────────────────────────────────────────────────────
  page:             { minHeight:'100vh', background:C.bg, backgroundImage:`radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`, padding:'20px 24px 64px', fontFamily:F.body },
  container:        { margin:'0 auto', transition:'opacity 0.5s ease, transform 0.5s cubic-bezier(.16,1,.3,1)' },
  // ── Top strip ───────────────────────────────────────────────────────────
  strip:            { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', marginBottom:16, borderRadius:10, background:C.card, border:`1px solid ${C.border}`, boxShadow:C.shadow },
  stripL:           { display:'flex', alignItems:'center', gap:9 },
  stripR:           { display:'flex', alignItems:'center', gap:10 },
  liveDot:          { width:7, height:7, borderRadius:'50%', background:C.green, animation:'ivLivePulse 2.4s ease-in-out infinite', boxShadow:`0 0 8px ${C.greenGlow}` },
  mono:             { fontFamily:F.mono, fontSize:10.5, letterSpacing:'0.5px', color:C.muted },
  // ── Hero ────────────────────────────────────────────────────────────────
  hero:             { position:'relative', overflow:'hidden', padding:'28px 28px', marginBottom:14, borderRadius:22, background:`linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 45%, ${C.blue600} 75%, ${C.cyan600} 100%)`, boxShadow:'0 20px 56px rgba(0,31,107,0.30)' },
  heroScan:         { position:'absolute', top:0, left:0, width:'25%', height:'100%', background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', animation:'ivScan 9s linear infinite', willChange:'transform', pointerEvents:'none' },
  heroGrid:         { position:'relative', display:'grid', gridTemplateColumns:'260px 1fr', gap:30, alignItems:'center' },
  previewBlock:     { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.13)', borderRadius:18, padding:'18px 20px', backdropFilter:'blur(6px)' },
  irsLabel:         { fontFamily:F.mono, fontSize:9.5, fontWeight:700, letterSpacing:'1.2px', color:'rgba(255,255,255,0.55)', marginBottom:12, textTransform:'uppercase' },
  previewModeRow:   { display:'flex', alignItems:'center', gap:11 },
  previewModeIcon:  { width:42, height:42, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 },
  previewModeLabel: { fontFamily:F.display, fontSize:16, fontWeight:800, color:'#fff' },
  previewModeSub:   { marginTop:3, fontSize:11.5, color:'rgba(255,255,255,0.65)', fontFamily:F.mono },
  previewMetaRow:   { display:'flex', flexWrap:'wrap', gap:6, marginTop:14, justifyContent:'inherit' },
  previewMetaChip:  { padding:'5px 10px', borderRadius:999, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.18)', color:'#fff', fontSize:10.5, fontWeight:700, fontFamily:F.body },
  verdictBlock:     {},
  eyebrow:          { display:'flex', alignItems:'center', gap:7, fontFamily:F.mono, fontSize:10, fontWeight:700, letterSpacing:'1.2px', color:'rgba(255,255,255,0.7)', marginBottom:12, textTransform:'uppercase' },
  eyebrowDot:       { width:6, height:6, borderRadius:'50%', background:C.cyan400, flexShrink:0 },
  heroH1:           { margin:0, fontFamily:F.display, fontSize:'clamp(26px, 4vw, 42px)', fontWeight:900, color:'#fff', lineHeight:1.1, letterSpacing:'-0.8px', maxWidth:600 },
  heroSub:          { margin:'14px 0 0', fontSize:'clamp(13px, 1.4vw, 15px)', lineHeight:1.7, color:'rgba(255,255,255,0.80)', maxWidth:520 },
  // ── Builder card ────────────────────────────────────────────────────────
  card:             { background:C.card, border:`1px solid ${C.border}`, borderRadius:20, boxShadow:C.shadow, overflow:'hidden' },
  groupBlock:       { padding:'16px 22px' },
  groupHead:        { display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:11 },
  groupTitle:       { color:C.text, fontFamily:F.display, fontSize:13.5, fontWeight:800, display:'flex', alignItems:'center', gap:8 },
  groupTitleAccent: { width:3, height:14, borderRadius:2, background:C.blue500, flexShrink:0, display:'inline-block' },
  groupTag:         { color:C.faint, fontFamily:F.mono, fontSize:9.5, letterSpacing:'0.5px' },
  divider:          { height:1, background:C.border },
  // ── Mode grid ───────────────────────────────────────────────────────────
  modeGrid:         { display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:9 },
  modeCard:         { display:'flex', alignItems:'center', gap:12, minHeight:78, borderStyle:'solid', borderWidth:1.5, borderColor:C.border, background:C.card, borderRadius:14, padding:'12px 13px', cursor:'pointer', textAlign:'left', transition:'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease' },
  modeCardActive:   { background:`linear-gradient(135deg, ${C.cardAlt}, #fff)`, boxShadow:`0 0 0 2px ${C.blue500}30, ${C.shadow}`, borderStyle:'solid', borderWidth:1.5, borderColor:`${C.blue500}60` },
  modeIcon:         { width:40, height:40, borderRadius:11, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 },
  modeCopy:         { display:'flex', flexDirection:'column', minWidth:0, flex:1 },
  modeLabel:        { color:C.text, fontFamily:F.display, fontSize:13.5, fontWeight:800, lineHeight:1.2 },
  modeDesc:         { marginTop:3, color:C.muted, fontSize:12, lineHeight:1.4 },
  modeCheck:        { width:20, height:20, borderStyle:'solid', borderWidth:1.5, borderColor:C.borderMd, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:9, flexShrink:0, transition:'transform 0.22s cubic-bezier(.34,1.56,.64,1), background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease' },
  // ── Difficulty grid ─────────────────────────────────────────────────────
  difficultyGrid:       { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 },
  difficultyCard:       { display:'flex', alignItems:'center', gap:9, minHeight:64, borderStyle:'solid', borderWidth:1.5, borderColor:C.border, background:C.card, borderRadius:13, padding:'10px 11px', cursor:'pointer', textAlign:'left', transition:'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease' },
  difficultyCardActive: { background:C.cardAlt, borderStyle:'solid', borderWidth:1.5, borderColor:`${C.blue500}50`, boxShadow:`0 0 0 2px ${C.blue500}20` },
  difficultyIcon:       { width:34, height:34, borderRadius:9, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900 },
  difficultyLabel:      { display:'block', color:C.text, fontFamily:F.display, fontSize:13, fontWeight:800, lineHeight:1.2 },
  difficultyDesc:       { display:'block', marginTop:2, color:C.muted, fontSize:11.5, lineHeight:1.35 },
  difficultyRadio:      { width:18, height:18, borderRadius:'50%', borderStyle:'solid', borderWidth:1.5, borderColor:C.borderMd, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:8, flexShrink:0, transition:'background 0.16s ease, border-color 0.16s ease' },
  builderSelect:        { width:'100%', height:48, border:`1.5px solid ${C.borderMd}`, borderRadius:11, background:C.cardAlt, padding:'0 36px 0 13px', color:C.text, fontFamily:F.body, fontSize:13.5, outline:'none', appearance:'none', WebkitAppearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237C8CAD' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 13px center', cursor:'pointer', transition:'border-color 0.18s ease, box-shadow 0.18s ease' },
  // ── Launch area ─────────────────────────────────────────────────────────
  launchArea:    { display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, padding:'18px 22px', background:C.cardAlt, borderTop:`1px solid ${C.border}` },
  sessionSummary:{ display:'flex', alignItems:'center', gap:12, minWidth:0 },
  summaryIcon:   { width:42, height:42, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 },
  summaryTitle:  { display:'block', color:C.text, fontFamily:F.display, fontSize:13.5, fontWeight:800 },
  summarySub:    { display:'block', marginTop:3, color:C.muted, fontSize:12 },
  btnLaunch:     { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, minWidth:200, border:'none', borderRadius:13, padding:'15px 24px', color:'#fff', background:`linear-gradient(135deg, ${C.blue700}, ${C.blue500})`, boxShadow:'0 10px 26px rgba(26,110,255,0.32)', cursor:'pointer', fontFamily:F.body, fontSize:13.5, fontWeight:800, letterSpacing:'0.1px', whiteSpace:'nowrap', flexShrink:0 },
  btnDisabled:   { opacity:0.45, cursor:'not-allowed', boxShadow:'none', transform:'none' },
  spinner:       { width:13, height:13, borderRadius:'50%', borderStyle:'solid', borderWidth:2, borderColor:'rgba(255,255,255,0.35)', borderTopColor:'#fff', animation:'ivSpin 0.7s linear infinite', display:'inline-block', flexShrink:0 },
  footnote:      { padding:'12px 22px 18px', color:C.faint, fontFamily:F.body, fontSize:11.5, letterSpacing:'0.1px', lineHeight:1.7 },
  kbd:           { display:'inline-block', padding:'2px 7px', borderRadius:5, borderStyle:'solid', borderWidth:1, borderColor:C.borderMd, borderBottomWidth:2, background:C.cardAlt, color:C.sub, fontFamily:F.mono, fontSize:10, fontWeight:700, lineHeight:1.4, verticalAlign:'middle' },
  // ── Room header ─────────────────────────────────────────────────────────
  roomTop:          { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 },
  roomActions:      { display:'flex', alignItems:'center', gap:10 },
  exitBtn:          { borderStyle:'solid', borderWidth:1, borderColor:C.border, background:C.card, borderRadius:9, padding:'7px 13px', color:C.sub, cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:F.body, transition:'border-color 0.15s ease, color 0.15s ease' },
  // ── Exit modal ──────────────────────────────────────────────────────────
  exitOverlay:      { position:'fixed', top:0, right:0, bottom:0, left:0, width:'100vw', height:'100dvh', minHeight:'100vh', background:'rgba(10,22,40,0.6)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px', overflowY:'auto', boxSizing:'border-box', overscrollBehavior:'contain' },
  exitModal:        { width:'min(380px, calc(100vw - 40px))', maxWidth:380, maxHeight:'calc(100dvh - 40px)', overflowY:'auto', background:C.card, borderRadius:20, borderStyle:'solid', borderWidth:1, borderColor:C.border, boxShadow:'0 24px 60px rgba(10,22,40,0.28)', padding:'24px 24px 20px', boxSizing:'border-box', flexShrink:0 },
  exitModalTitle:   { fontSize:17, fontWeight:800, color:C.text, fontFamily:F.display, marginBottom:7, letterSpacing:'-0.2px' },
  exitModalBody:    { fontSize:13.5, color:C.sub, lineHeight:1.6, marginBottom:20, fontWeight:500 },
  exitModalRow:     { display:'flex', gap:10, justifyContent:'flex-end' },
  exitModalCancel:  { borderStyle:'solid', borderWidth:1, borderColor:C.border, background:C.card, borderRadius:10, padding:'10px 18px', color:C.sub, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:F.body, transition:'border-color 0.15s ease' },
  exitModalConfirm: { border:'none', background:C.red, borderRadius:10, padding:'10px 18px', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:F.body, boxShadow:`0 4px 14px ${C.red}40`, transition:'box-shadow 0.15s ease' },
  // ── Console card ────────────────────────────────────────────────────────
  consoleCard:      { padding:'12px 16px', borderStyle:'solid', borderWidth:1, borderColor:C.border, borderRadius:16, background:C.card, boxShadow:C.shadow, marginBottom:10, position:'sticky', top:8, zIndex:5 },
  consoleTop:       { display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 },
  consoleContext:   { display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 },
  consoleModeIcon:  { width:36, height:36, borderRadius:10, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 },
  consoleModeLabel: { display:'block', color:C.text, fontFamily:F.display, fontSize:13, fontWeight:800, letterSpacing:'-0.1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  consoleModeSub:   { display:'block', marginTop:2, color:C.muted, fontFamily:F.mono, fontSize:10, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', letterSpacing:'0.2px' },
  consoleRight:     { display:'flex', alignItems:'center', gap:10, flexShrink:0 },
  questionNumber:   { display:'flex', alignItems:'baseline', gap:2, fontFamily:F.mono, fontSize:14, fontWeight:700, lineHeight:1 },
  progressTrack:    { marginTop:10, height:5, borderRadius:999, background:C.border, overflow:'hidden' },
  trail:            { display:'flex', gap:4, marginTop:10, alignItems:'center' },
  trailDot:         { height:5, borderRadius:999, transition:'all 0.35s cubic-bezier(0.16,1,0.3,1)', flexShrink:0 },
  // ── Timer ring ──────────────────────────────────────────────────────────
  ringWrap:  { position:'relative', width:58, height:58, flexShrink:0, borderRadius:'50%' },
  ringLabel: { position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F.mono, fontWeight:700, pointerEvents:'none', letterSpacing:'-0.3px' },
  // ── Room grid ───────────────────────────────────────────────────────────
  roomGrid:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, alignItems:'start' },
  // ── Answer panel wrapper (houses InterviewControls or FeedbackPanel) ────
  answerPanel: { padding:'18px 18px', borderStyle:'solid', borderWidth:1, borderColor:C.border, borderRadius:18, background:C.card, boxShadow:C.shadow, display:'flex', flexDirection:'column' },
  // ── Room footer ─────────────────────────────────────────────────────────
  roomFoot:    { marginTop:10, textAlign:'center', color:C.muted, fontSize:12, lineHeight:1.6, letterSpacing:'0.1px', fontFamily:F.body, fontWeight:500 },
  errorBanner: { marginTop:10, display:'flex', justifyContent:'center', gap:8, flexWrap:'wrap', padding:'10px 14px', borderRadius:11, background:C.redTint, borderStyle:'solid', borderWidth:1, borderColor:'#FECACA', color:C.red, fontSize:12.5, fontFamily:F.body, fontWeight:600 },
};

export default Interview;