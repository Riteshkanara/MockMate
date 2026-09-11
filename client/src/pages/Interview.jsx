import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import InterviewLoader from '../components/InterviewLoader';
import { C as CT, F } from '../styles/token';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKMATE — INTERVIEW v5
// Blueprint-blue system. Session flow now hands off cleanly to the dedicated
// /result debrief page — handleNext() already calls completeInterview() and
// navigates there on the final question, so this file no longer needs (or
// builds) its own end-of-session summary. Keyboard-driven flow (Enter to
// submit/advance, 1–4 to pick MCQ options), a sticky compact timer, smoother
// cross-question transitions, and a full responsiveness/motion pass.
// ═══════════════════════════════════════════════════════════════════════════

// Shared tokens cover every color used here via their legacy aliases.
// violet/violetTint are the only values not in the shared palette — they're
// used exclusively for the MCQ mode accent and "Mixed" difficulty chip.
const C = {
  ...CT,
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
};

// ─── Countdown beep (10s → 1s) ───────────────────────────────────────────────
// Fires every second from 10 down to 1. Pitch rises as time runs out so the
// user gets an instinctive sense of urgency without needing to read the timer:
//   10s → low calm tick (600 Hz)
//   5s  → mid urgency  (800 Hz)
//   3s  → sharp alert  (1000 Hz)
//   1s  → highest cue  (1200 Hz)
// Volume also increases slightly with urgency. No audio file / no bundle cost.
// Wrapped in try/catch — a missed beep never breaks the interview.
const playTimeWarningBeep = (secondsLeft = 10) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Map seconds left → frequency and volume
    const t = Math.max(0, Math.min(1, (10 - secondsLeft) / 9)); // 0 at 10s, 1 at 1s
    const freq   = 600 + t * 600;   // 600 Hz → 1200 Hz
    const volume = 0.08 + t * 0.12; // 0.08 → 0.20

    // Double-tick at 5s and below for extra urgency
    const ticks = secondsLeft <= 5 ? [0, 0.12] : [0];

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
  quick: {
    label: 'Quick Mock',
    short: 'QUICK',
    icon: '⚡',
    description: '5 focused questions — ideal for daily practice.',
    accent: C.blue500,
    soft: C.blue50,
  },
  full: {
    label: 'Full Mock',
    short: 'FULL',
    icon: '🎯',
    description: 'A complete placement-style interview session.',
    accent: C.green,
    soft: C.greenTint,
  },
  company: {
    label: 'Company Specific',
    short: 'COMPANY',
    icon: '🏢',
    description: 'Prep tailored around your target company.',
    accent: C.amber,
    soft: C.amberTint,
  },
  topic: {
    label: 'Topic Focus',
    short: 'TOPIC',
    icon: '📖',
    description: 'Deep dive into one technical area.',
    accent: C.cyan500,
    soft: C.cyanTint,
  },
  mcq: {
    label: 'Technical MCQ',
    short: 'MCQ',
    icon: '✅',
    description: 'Placement-style multiple choice questions.',
    accent: C.violet,
    soft: C.violetTint,
  },
  aptitude: {
    label: 'Aptitude',
    short: 'APTITUDE',
    icon: '🧮',
    description: 'Quantitative and logical reasoning problems.',
    accent: C.amber,
    soft: C.amberTint,
  },
  mixed: {
    label: 'Mixed Assessment',
    short: 'MIXED',
    icon: '🔀',
    description: 'Technical, aptitude and open questions combined.',
    accent: C.blue500,
    soft: C.blue50,
  },
};

const DIFFICULTIES = [
  {
    value: 'easy',
    label: 'Easy',
    description: 'Build confidence',
    accent: C.green,
    soft: C.greenTint,
    glyph: '😊',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Placement standard',
    accent: C.blue500,
    soft: C.blue50,
    glyph: '💪',
  },
  {
    value: 'hard',
    label: 'Hard',
    description: 'High-pressure prep',
    accent: C.red,
    soft: C.redTint,
    glyph: '🔥',
  },
  {
    value: 'mixed',
    label: 'Mixed',
    description: 'Balanced difficulty',
    accent: C.violet,
    soft: C.violetTint,
    glyph: '🎲',
  },
];

const COMPANIES = ['TCS', 'Infosys', 'Wipro', 'Zoho', 'Razorpay', 'FAANG'];

const TOPICS = [
  'DSA',
  'System Design',
  'OOP',
  'DBMS',
  'OS',
  'JavaScript',
  'HR',
  'Networking',
];

const TIME_LIMITS = {
  mcq: 45,
  aptitude: 60,
  open: 90,
};

const difficultyMeta = (difficulty) => {
  if (difficulty === 'easy') {
    return {
      label: 'Easy',
      color: C.green,
      background: C.greenTint,
      border: '#B7E7D7',
    };
  }

  if (difficulty === 'hard') {
    return {
      label: 'Hard',
      color: C.red,
      background: C.redTint,
      border: '#F1C4C9',
    };
  }

  if (difficulty === 'mixed') {
    return {
      label: 'Mixed',
      color: C.violet,
      background: C.violetTint,
      border: '#D4CEF9',
    };
  }

  return {
    label: 'Medium',
    color: C.amber,
    background: C.amberTint,
    border: '#F1D39B',
  };
};

const formatTime = (seconds) => {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// INLINE NOTIFICATION SYSTEM
// Replaces react-hot-toast for all in-session feedback. A slim animated bar
// at the top of the console card — visible, contextual, non-intrusive.
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

  // Convenience methods matching toast API shape
  const notifApi = useMemo(() => ({
    notif,
    loading: (msg) => show(msg, 'loading', Infinity),
    success: (msg, dur) => show(msg, 'success', dur ?? 3000),
    error:   (msg, dur) => show(msg, 'error',   dur ?? 4500),
    info:    (msg, dur) => show(msg, 'info',     dur ?? 3000),
    dismiss,
  }), [notif, show, dismiss]);

  return notifApi;
};

const NOTIF_ICONS = {
  loading: null,   // spinner rendered via CSS
  success: '✓',
  error:   '✕',
  info:    'ℹ',
};

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
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        marginBottom: 10,
        color: text,
        fontSize: 12.5,
        fontFamily: F.body,
        fontWeight: 500,
        lineHeight: 1.4,
      }}
    >
      {notif.type === 'loading' ? (
        <span className="iv-notif-spinner" style={{ color: spinner, flexShrink: 0 }} />
      ) : (
        <span style={{
          width: 18, height: 18, borderRadius: '50%',
          background: `${text}18`, border: `1.5px solid ${text}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, flexShrink: 0,
          color: text,
        }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1 }}>{notif.message}</span>
    </div>
  );
};

const Interview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // In-session notification bar — replaces react-hot-toast for all interview events
  const notify = useNotif();

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
  } = useInterview({ notify });

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Default difficulty comes from the user's onboarding pref:
  //   'easy'   → 'easy'   (start gentle)
  //   'medium' → 'mixed'  (balanced, the old default)
  //   'hard'   → 'hard'   (throw me in)
  const [selectedDifficulty, setSelectedDifficulty] = useState(
    { easy: 'easy', medium: 'mixed', hard: 'hard' }[user?.difficultyPref] ?? 'mixed'
  );

  // Default mode comes from location.state (dashboard quick-launch) or the
  // user's saved targetRole from onboarding:
  //   frontend / backend / data → 'topic'   (role-specific focus)
  //   sde / fullstack / devops  → 'quick'   (broad coverage)
  const [selectedMode, setSelectedMode] = useState(
    location.state?.mode ||
    { frontend: 'topic', backend: 'topic', data: 'topic' }[user?.targetRole] ||
    'quick'
  );
  const [selectedCompany, setSelectedCompany] = useState(
    location.state?.company || ''
  );
  const [selectedTopic, setSelectedTopic] = useState(
    location.state?.topic || ''
  );
  const [textAnswer, setTextAnswer] = useState('');

  // Refs that mirror the two answer state values so the timer's useEffect
  // can read the latest answer without adding them to its dependency array.
  // Without this, every keystroke re-ran the effect, cleared the interval,
  // and restarted it — causing the timer to visually freeze while typing.
  const textAnswerRef = useRef('');
  const selectedAnswerIndexRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [timerStarted, setTimerStarted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [questionKey, setQuestionKey] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  // Tracks "no real answer was submitted for this question" — covers both an
  // explicit Skip click and an auto-skip on time-up with nothing entered.
  // The client-side questions array is never mutated with a skipped flag
  // (only the backend record is), so FeedbackView has no other way to tell
  // a genuine low-scoring answer apart from a skip without this.
  const [wasSkipped, setWasSkipped] = useState(false);
  // Guards a single accidental "submitted way too early" mistake on
  // open-ended questions — very short answers almost always score low, and
  // an early Enter-key slip (or misjudging how much detail is expected) is
  // otherwise unrecoverable once submitted. Shows one inline confirmation
  // the first time; confirming or editing the answer clears it.
  const [confirmingShortSubmit, setConfirmingShortSubmit] = useState(false);
  const SHORT_ANSWER_WORD_THRESHOLD = 8;

  const textAreaRef = useRef(null);
  const submitLockRef = useRef(false);
  const transitionRef = useRef(false);
  // Tracks which (questionId, secondsValue) pairs have already beeped so
  // each tick fires at most once per second per question, even across effect
  // re-renders. Stored as a Set rather than a single id so we can track
  // individual second-marks rather than just "has this question beeped".
  const lastBeepQuestionRef = useRef(new Set());
  const lastSubmitTimeRef = useRef(0);

  useEffect(() => {
    requestAnimationFrame(() => setTimeout(() => setMounted(true), 40));
  }, []);

  const currentQuestion = questions?.[currentIndex];

  const mode = MODE_META[selectedMode] || MODE_META.quick;

  const totalQuestions = questions?.length ?? 0;

  const progress = totalQuestions
    ? ((currentIndex + 1) / totalQuestions) * 100
    : 0;

  const isObjective =
    currentQuestion &&
    ['mcq', 'aptitude'].includes(currentQuestion.questionType);

  const questionDifficulty = difficultyMeta(currentQuestion?.difficulty);

  const isLastQuestion = currentIndex === totalQuestions - 1;

  // Session-level time estimate: remaining questions × average time per question
  // Approximate: remaining questions × 90s average → minutes remaining
  const questionsLeft = Math.max(0, totalQuestions - currentIndex - 1);
  const sessionMinsLeft = Math.ceil((questionsLeft * 90 + secondsLeft) / 60);

  // ── Restore a dashboard-created session ───────────────────────────────
  useEffect(() => {
    const incoming = location.state;

    if (incoming?.sessionId && incoming?.questions?.length) {
      hydrateSession(incoming.sessionId, incoming.questions);

      /* eslint-disable react-hooks/set-state-in-effect */
      setSelectedMode(incoming.mode || selectedMode);
      setSelectedCompany(incoming.company || '');
      setSelectedTopic(incoming.topic || '');
      /* eslint-enable react-hooks/set-state-in-effect */

      navigate(location.pathname, {
        replace: true,
        state: {},
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, hydrateSession, navigate]);

  // ── Track submit timestamp ──────────────────────────────────────────────
  useEffect(() => {
    if (isSubmitted) {
      lastSubmitTimeRef.current = Date.now();
    }
  }, [isSubmitted]);

  // ── Reset per-question state ────────────────────────────────────────────
  // Intentional: these setState calls batch in React 18 and are safe here.
  // The effect runs exactly when the question id/timeLimit changes, which is
  // the right time to reset all transient per-question UI state in one shot.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setTextAnswer('');
    setQuestionKey((k) => k + 1);
    setWasSkipped(false);
    setConfirmingShortSubmit(false);
    lastBeepQuestionRef.current = new Set();

    transitionRef.current = true;

    submitLockRef.current = false;

    setTimerStarted(false);

    if (!currentQuestion) {
      setSecondsLeft(0);
      return undefined;
    }

    setSecondsLeft(Number(currentQuestion.timeLimit) || 120);

    const frameId = window.requestAnimationFrame(() => {
      transitionRef.current = false;
      setTimerStarted(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
    // currentQuestion object itself is intentionally excluded — only id and
    // timeLimit are needed to detect a question change. Including the full
    // object would cause re-runs on every render where the reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, currentQuestion?.timeLimit]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (
      !sessionStarted ||
      !currentQuestion ||
      isSubmitted ||
      isLoading ||
      !timerStarted ||
      transitionRef.current
    ) {
      return undefined;
    }

    if (secondsLeft <= 0) {
      if (submitLockRef.current) {
        return undefined;
      }

      submitLockRef.current = true;

      const timeTaken = currentQuestion.timeLimit;

      if (isObjective) {
        if (
          selectedAnswerIndexRef.current !== null &&
          selectedAnswerIndexRef.current !== undefined
        ) {
          handleSubmit(
            null,
            selectedAnswerIndexRef.current,
            timeTaken,
            false
          ).finally(() => {
            submitLockRef.current = false;
          });
        } else {
          setWasSkipped(true);
          handleTimeUp(timeTaken).finally(() => {
            submitLockRef.current = false;
          });
        }
      } else if (textAnswerRef.current.trim()) {
        handleSubmit(
          textAnswerRef.current,
          null,
          timeTaken,
          false
        ).finally(() => {
          submitLockRef.current = false;
        });
      } else {
        setWasSkipped(true);
        handleTimeUp(timeTaken).finally(() => {
          submitLockRef.current = false;
        });
      }

      return undefined;
    }

    const timerId = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timerId);
          return 0;
        }

        // Countdown beep every second from 10 down to 1 — purely audio,
        // complements the existing visual ring pulse so users who aren't
        // watching the timer still feel the urgency. The guard uses a Set
        // keyed by (questionId + secondsValue) so each tick only fires once
        // even if this effect re-renders mid-second.
        const next = previous - 1;
        if (next >= 1 && next <= 10) {
          const beepKey = `${currentQuestion?.id}-${next}`;
          if (!lastBeepQuestionRef.current.has(beepKey)) {
            lastBeepQuestionRef.current.add(beepKey);
            playTimeWarningBeep(next);
          }
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [
    sessionStarted,
    currentQuestion,
    isSubmitted,
    isLoading,
    timerStarted,
    secondsLeft,
    handleTimeUp,
    handleSubmit,
    isObjective,
    // textAnswerRef and selectedAnswerIndexRef are refs — intentionally excluded.
    // Reading .current inside the interval callback always gets the latest value
    // without re-creating the interval on every keystroke.
  ]);

  const timerPercent = currentQuestion?.timeLimit
    ? Math.max(
        0,
        Math.min(
          100,
          (secondsLeft / currentQuestion.timeLimit) * 100
        )
      )
    : 100;

  // Sync refs after every render so timer effect reads latest values without
  // adding them to its dep array. useLayoutEffect runs synchronously before
  // paint — the timer interval always sees the current answer on its next tick.
  useLayoutEffect(() => {
    textAnswerRef.current = textAnswer;
    selectedAnswerIndexRef.current = selectedAnswerIndex;
  });

  const timerWarning  = secondsLeft <= 30 && secondsLeft > 15;
  const timerCritical = secondsLeft <= 15;

  const canSubmit =
    !isLoading &&
    (isObjective
      ? selectedAnswerIndex !== null
      : Boolean(textAnswer.trim()));

  const wordCount = useMemo(
    () => (textAnswer.trim() ? textAnswer.trim().split(/\s+/).length : 0),
    [textAnswer]
  );
  const isShortOpenAnswer =
    !isObjective && wordCount > 0 && wordCount < SHORT_ANSWER_WORD_THRESHOLD;

  const doSubmit = useCallback(() => {
    if (!canSubmit || isSubmitted || !currentQuestion) {
      return;
    }

    // First attempt on a very short open-ended answer: hold it and ask for
    // confirmation instead of submitting straight away. A second doSubmit()
    // call (button click or Enter again) with the guard already tripped
    // goes through — so this only ever costs the user one extra keypress
    // when they actually meant to submit something that short.
    if (isShortOpenAnswer && !confirmingShortSubmit) {
      setConfirmingShortSubmit(true);
      return;
    }

    setConfirmingShortSubmit(false);
    handleSubmit(
      textAnswer,
      isObjective ? selectedAnswerIndex : null,
      currentQuestion.timeLimit - secondsLeft,
      false
    );
  }, [
    canSubmit,
    isSubmitted,
    handleSubmit,
    textAnswer,
    isObjective,
    selectedAnswerIndex,
    currentQuestion,
    secondsLeft,
    isShortOpenAnswer,
    confirmingShortSubmit,
  ]);

  const doAdvance = useCallback(() => {
    if (isAdvancing || isLoading) {
      return;
    }

    if (isLastQuestion) {
      setIsAdvancing(true);
    }

    transitionRef.current = true;

    handleNext();
  }, [
    isAdvancing,
    isLoading,
    isLastQuestion,
    handleNext,
  ]);

  // ── Keyboard flow ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionStarted) {
      return undefined;
    }

    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (isSubmitted) {
          const msSinceSubmit =
            Date.now() - lastSubmitTimeRef.current;

          if (msSinceSubmit < 600) {
            return;
          }

          e.preventDefault();
          doAdvance();
          return;
        }

        if (
          document.activeElement === textAreaRef.current &&
          !isObjective
        ) {
          e.preventDefault();

          if (canSubmit) {
            doSubmit();
          }

          return;
        }

        e.preventDefault();

        if (canSubmit) {
          doSubmit();
        }
      }

      if (
        !isSubmitted &&
        isObjective &&
        ['1', '2', '3', '4'].includes(e.key)
      ) {
        const idx = Number(e.key) - 1;

        if (currentQuestion?.options?.[idx] !== undefined) {
          selectAnswer(idx);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    sessionStarted,
    isSubmitted,
    isObjective,
    canSubmit,
    doSubmit,
    doAdvance,
    currentQuestion,
    selectAnswer,
  ]);

  // ── Live session preview stats for config screen ────────────────────────
  const estimatedMinutes = useMemo(() => {
    const perQ =
      selectedMode === 'mcq'
        ? TIME_LIMITS.mcq
        : selectedMode === 'aptitude'
          ? TIME_LIMITS.aptitude
          : TIME_LIMITS.open;

    const count =
      selectedMode === 'full'
        ? 10
        : selectedMode === 'mixed'
          ? 8
          : 5;

    return Math.round((perQ * count) / 60);
  }, [selectedMode]);

  const questionCount =
    selectedMode === 'full'
      ? 10
      : selectedMode === 'mixed'
        ? 8
        : 5;

  const canLaunch =
    !isLoading &&
    !(selectedMode === 'company' && !selectedCompany) &&
    !(selectedMode === 'topic' && !selectedTopic);

  // ─────────────────────────────────────────────────────────────────────
  // CONFIG / START SCREEN
  // ─────────────────────────────────────────────────────────────────────
  if (!sessionStarted) {
    // ───────────────────────────────────────────────────────────────────
    // NEW: immediately replace the configuration screen while the
    // interview is being generated.
    // ───────────────────────────────────────────────────────────────────
    if (isLoading) {
      return (
        <div style={{ ...S.page, background: C.bg }} className="iv-page">
          <GlobalStyles />
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
          }}>
            <InterviewLoader />
          </div>
        </div>
      );
    }

    return (
      <div style={S.page} className="iv-page">
        <GlobalStyles />

        <div
          style={{
            ...S.container,
            maxWidth: 1080,
            opacity: mounted ? 1 : 0,
            transform: mounted
              ? 'none'
              : 'translateY(10px)',
          }}
        >
          <div style={S.strip} className="iv-strip">
            <div style={S.stripL}>
              <span style={S.liveDot} />

              <span style={S.mono}>
                MOCKMATE SESSION BUILDER
              </span>
            </div>

            <div style={S.stripR} className="iv-strip-r">
              <span style={S.mono}>
                AI ASSESSMENT READY
              </span>
            </div>
          </div>

          <section style={S.hero} className="iv-hero">
            <div style={S.heroScan} />

            <div
              style={S.heroGrid}
              className="iv-hero-grid"
            >
              <div
                style={S.previewBlock}
                className="iv-preview-block"
              >
                <div style={S.irsLabel}>
                  SESSION PREVIEW
                </div>

                <div style={S.previewModeRow}>
                  <div
                    key={selectedMode}
                    style={{
                      ...S.previewModeIcon,
                      background:
                        'rgba(255,255,255,0.14)',
                    }}
                    className="iv-pop-in"
                  >
                    {mode.icon}
                  </div>

                  <div>
                    <div style={S.previewModeLabel}>
                      {mode.label}
                    </div>

                    <div style={S.previewModeSub}>
                      {questionCount} questions · ~
                      {estimatedMinutes} min
                    </div>
                  </div>
                </div>

                <div style={S.previewMetaRow}>
                  <span style={S.previewMetaChip}>
                    {selectedDifficulty === 'mixed'
                      ? 'Balanced difficulty'
                      : `${selectedDifficulty} difficulty`}
                  </span>

                  {selectedCompany && (
                    <span style={S.previewMetaChip}>
                      {selectedCompany}
                    </span>
                  )}

                  {selectedTopic && (
                    <span style={S.previewMetaChip}>
                      {selectedTopic}
                    </span>
                  )}
                </div>
              </div>

              <div style={S.verdictBlock}>
                <div style={S.eyebrow}>
                  <span style={S.eyebrowDot} />

                  YOUR NEXT INTERVIEW REP
                </div>

                <h1 style={S.heroH1}>
                  Walk in prepared.
                  <br />

                  <span style={{ color: C.cyan400 }}>
                    Walk out better.
                  </span>
                </h1>

                <p style={S.heroSub}>
                  Choose how you want to be challenged.
                  MockMate generates the session around
                  your mode, topic, company and difficulty —
                  then evaluates the actual answers you give.
                </p>
              </div>
            </div>
          </section>

          <section
            style={S.card}
            className="iv-builder-card"
          >
            <div style={S.groupBlock} className="iv-group-block">
              <div style={S.groupHead}>
                <strong style={S.groupTitle}>
                  <span style={S.groupTitleAccent} />
                  Assessment type
                </strong>

                <span style={S.groupTag}>
                  PICK ONE
                </span>
              </div>

              <div
                style={S.modeGrid}
                className="iv-mode-grid"
              >
                {Object.entries(MODE_META).map(
                  ([value, meta]) => {
                    const selected =
                      selectedMode === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        style={{
                          ...S.modeCard,
                          ...(selected
                            ? {
                                ...S.modeCardActive,
                                borderStyle: 'solid',
                                borderWidth: 1.5,
                                borderColor: meta.accent,
                              }
                            : {}),
                        }}
                        className="iv-mode-card"
                        onClick={() =>
                          setSelectedMode(value)
                        }
                        aria-pressed={selected}
                      >
                        <div
                          style={{
                            ...S.modeIcon,
                            color: meta.accent,
                            background: meta.soft,
                          }}
                        >
                          {meta.icon}
                        </div>

                        <div style={S.modeCopy}>
                          <strong style={S.modeLabel} className="iv-mode-label">
                            {meta.label}
                          </strong>

                          <span style={S.modeDesc} className="iv-mode-desc">
                            {meta.description}
                          </span>
                        </div>

                        <div
                          style={{
                            ...S.modeCheck,
                            background: selected ? meta.accent : '#fff',
                            borderStyle: 'solid',
                            borderWidth: 1.5,
                            borderColor: selected ? meta.accent : C.borderMd,
                            transform: selected ? 'scale(1)' : 'scale(0.82)',
                          }}
                        >
                          {selected ? '✓' : ''}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div style={S.divider} />

            <div style={S.groupBlock} className="iv-group-block">
              <div style={S.groupHead}>
                <strong style={S.groupTitle}>
                  <span style={S.groupTitleAccent} />
                  Difficulty
                </strong>

                <span style={S.groupTag}>
                  PASSED DIRECTLY TO AI
                </span>
              </div>

              <div
                style={S.difficultyGrid}
                className="iv-difficulty-grid"
              >
                {DIFFICULTIES.map((option) => {
                  const selected =
                    selectedDifficulty ===
                    option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      style={{
                        ...S.difficultyCard,
                        ...(selected
                          ? {
                              ...S.difficultyCardActive,
                              borderStyle: 'solid',
                              borderWidth: 1.5,
                              borderColor: option.accent,
                            }
                          : {}),
                      }}
                      className="iv-difficulty-card"
                      onClick={() =>
                        setSelectedDifficulty(
                          option.value
                        )
                      }
                      aria-pressed={selected}
                    >
                      <div
                        style={{
                          ...S.difficultyIcon,
                          color: option.accent,
                          background: option.soft,
                        }}
                      >
                        {option.glyph}
                      </div>

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={S.difficultyLabel}
                          className="iv-difficulty-label"
                        >
                          {option.label}
                        </strong>

                        <span
                          style={S.difficultyDesc}
                          className="iv-difficulty-desc"
                        >
                          {option.description}
                        </span>
                      </div>

                      <div
                        style={{
                          ...S.difficultyRadio,
                          borderColor: selected
                            ? option.accent
                            : C.borderMd,
                          background: selected
                            ? option.accent
                            : 'transparent',
                        }}
                      >
                        {selected ? '✓' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {(selectedMode === 'company' ||
              selectedMode === 'topic') && (
              <div className="iv-fade-in">
                <div style={S.divider} />

                <div style={S.groupBlock} className="iv-group-block">
                  <div style={S.groupHead}>
                    <strong style={S.groupTitle}>
                      <span style={S.groupTitleAccent} />
                      Target
                    </strong>

                    <span style={S.groupTag}>
                      REQUIRED FOR THIS MODE
                    </span>
                  </div>

                  {selectedMode === 'company' && (
                    <select
                      style={S.builderSelect}
                      className="iv-builder-select"
                      value={selectedCompany}
                      onChange={(e) =>
                        setSelectedCompany(
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Choose a company
                      </option>

                      {COMPANIES.map((company) => (
                        <option
                          key={company}
                          value={company}
                        >
                          {company}
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedMode === 'topic' && (
                    <select
                      style={S.builderSelect}
                      className="iv-builder-select"
                      value={selectedTopic}
                      onChange={(e) =>
                        setSelectedTopic(
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Choose a topic
                      </option>

                      {TOPICS.map((topic) => (
                        <option
                          key={topic}
                          value={topic}
                        >
                          {topic}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            <div style={S.divider} />

            <div
              style={S.launchArea}
              className="iv-launch-area"
            >
              <div style={S.sessionSummary}>
                <div
                  style={{
                    ...S.summaryIcon,
                    color: mode.accent,
                    background: mode.soft,
                  }}
                >
                  {mode.icon}
                </div>

                <div>
                  <strong style={S.summaryTitle}>
                    {mode.label}
                  </strong>

                  <span style={S.summarySub}>
                    {selectedDifficulty === 'mixed'
                      ? 'Balanced difficulty'
                      : `${selectedDifficulty} difficulty`}
                    {' · '}

                    {user?.name
                      ? `${user.name.split(' ')[0]}'s session`
                      : 'Personalized session'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                style={{
                  ...S.btnLaunch,
                  ...(canLaunch
                    ? {}
                    : S.btnDisabled),
                }}
                className="iv-btn-launch"
                disabled={!canLaunch}
                onClick={() =>
                  handleStart(
                    selectedMode,
                    selectedCompany,
                    selectedTopic,
                    selectedDifficulty
                  )
                }
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

            <div style={S.footnote} className="iv-footnote">
              Difficulty:{' '}
              <strong style={{ color: C.sub }}>
                {selectedDifficulty}
              </strong>
              {' · '}MCQ: 45s · Aptitude: 60s · Open: 90s
              {' · '}Press{' '}
              <kbd style={S.kbd}>Enter</kbd> to submit
              answers once you're in
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // SAFETY / LOADING
  // ─────────────────────────────────────────────────────────────────────
  if (!currentQuestion || isAdvancing) {
    return (
      <div style={{ ...S.page, background: C.bg }} className="iv-page">
        <GlobalStyles />
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}>
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

      <div
        style={{
          ...S.container,
          maxWidth: 1140,
        }}
      >
        <header
          style={S.roomTop}
          className="iv-room-top"
        >
          <div style={S.stripL}>
            <span style={S.liveDot} />

            <span style={S.mono}>
              LIVE INTERVIEW ROOM
            </span>
          </div>

          <div style={S.roomActions}>
            <span style={S.mono}>
              {mode.label.toUpperCase()}
            </span>

            <span style={{ color: C.borderMd }}>
              ·
            </span>

            <button
              type="button"
              style={S.exitBtn}
              className="iv-exit-btn"
              onClick={() =>
                setShowExitConfirm(true)
              }
            >
              Exit
            </button>
          </div>
        </header>

        {showExitConfirm && (
          <div
            style={S.exitOverlay}
            onClick={() =>
              !isAbandoning &&
              setShowExitConfirm(false)
            }
          >
            <div
              style={S.exitModal}
              className="iv-exit-modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div style={S.exitModalTitle}>
                Leave this interview?
              </div>

              <div style={S.exitModalBody}>
                Your progress on this session won't be
                scored. It'll be marked as abandoned so it
                doesn't count toward your stats or streak.
              </div>

              <div style={S.exitModalRow}>
                <button
                  type="button"
                  style={S.exitModalCancel}
                  onClick={() =>
                    setShowExitConfirm(false)
                  }
                  disabled={isAbandoning}
                >
                  Keep going
                </button>

                <button
                  type="button"
                  style={{
                    ...S.exitModalConfirm,
                    opacity: isAbandoning
                      ? 0.7
                      : 1,
                  }}
                  onClick={() =>
                    handleAbandon('/dashboard')
                  }
                  disabled={isAbandoning}
                >
                  {isAbandoning
                    ? 'Exiting…'
                    : 'Exit interview'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Compact combined progress + timer bar */}
        <section
          style={S.consoleCard}
          className="iv-console-card"
        >
          {/* Inline notification bar — replaces all toasts during a session */}
          <NotifBar notif={notify.notif} />

          <div style={S.consoleTop}>
            <div style={S.consoleContext}>
              <div
                style={{
                  ...S.consoleModeIcon,
                  background: mode.soft,
                  color: mode.accent,
                }}
                className="iv-console-mode-icon"
              >
                {mode.icon}
              </div>

              <div
                style={{
                  minWidth: 0,
                }}
              >
                <strong
                  style={S.consoleModeLabel}
                >
                  {mode.label}
                </strong>

                <span style={S.consoleModeSub}>
                  {currentQuestion.topic || 'General'} ·{' '}
                  {questionDifficulty.label}
                </span>
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
                <strong style={{ color: mode.accent }}>
                  {String(currentIndex + 1).padStart(2, '0')}
                </strong>

                <span>
                  /{String(totalQuestions).padStart(2, '0')}
                </span>
              </div>

              {/* Session time estimate — faint, only when multiple questions remain */}
              {questionsLeft > 0 && (
                <span style={{
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.faint,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.2px',
                }}>
                  {sessionMinsLeft} min left
                </span>
              )}
            </div>
          </div>

          <div style={S.progressTrack}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                borderRadius: 999,
                background: `linear-gradient(90deg, ${mode.accent}, ${C.cyan400})`,
                transition: 'width 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: `0 0 6px ${mode.accent}55`,
              }}
            />
          </div>

          <div
            style={S.trail}
            className="iv-trail"
          >
            {Array.from({
              length: totalQuestions,
            }).map((_, i) => {
              const isPast = i < currentIndex;
              const isCurrent =
                i === currentIndex;

              const col = isPast
                ? mode.accent
                : C.border;

              return (
                <div
                  key={i}
                  style={{
                    ...S.trailDot,
                    width: isCurrent ? 18 : 7,
                    background: isCurrent
                      ? mode.accent
                      : isPast
                        ? `${mode.accent}90`
                        : C.border,
                    opacity: isPast || isCurrent ? 1 : 0.45,
                  }}
                  title={`Question ${i + 1}`}
                />
              );
            })}
          </div>
        </section>

        <main
          style={S.roomGrid}
          className="iv-room-grid"
        >
          <section
            key={`q-${questionKey}`}
            style={S.questionPanel}
            className="iv-question-slide iv-question-panel"
          >
            <div style={S.questionPanelTop}>
              {/* Q n of N pill — reduces "how many left" anxiety */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={S.questionLabel}>
                  Q{currentIndex + 1} of {questions.length}
                </span>
              </div>

              <div style={S.questionTags}>
                <span
                  style={{
                    background: questionDifficulty.background,
                    color: questionDifficulty.color,
                    borderStyle: 'solid',
                    borderWidth: 1,
                    borderColor: questionDifficulty.border,
                    padding: '4px 9px',
                    borderRadius: 999,
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: F.mono,
                    letterSpacing: '0.5px',
                  }}
                >
                  {questionDifficulty.label}
                </span>

                <span
                  style={S.questionTagNeutral}
                >
                  {currentQuestion.questionType ===
                  'mcq'
                    ? 'MCQ'
                    : currentQuestion.questionType ===
                        'aptitude'
                      ? 'APTITUDE'
                      : 'OPEN'}
                </span>
              </div>
            </div>

            <div style={S.questionBody}>
              <div style={S.questionType}>
                {currentQuestion.topic
                  ? currentQuestion.topic.toUpperCase()
                  : currentQuestion.questionType === 'mcq'
                    ? 'MULTIPLE CHOICE'
                    : currentQuestion.questionType === 'aptitude'
                      ? 'APTITUDE'
                      : 'OPEN QUESTION'}
              </div>

              <h1 style={S.questionText} className="iv-question-text">
                {currentQuestion.text}
              </h1>

              <div style={S.questionHelp}>
                <span style={{ color: mode.accent, flexShrink: 0, fontSize: 14 }}>
                  {currentQuestion.questionType === 'mcq'
                    ? '🎯'
                    : currentQuestion.questionType === 'aptitude'
                      ? '🧮'
                      : '💬'}
                </span>
                {currentQuestion.questionType === 'mcq'
                  ? 'Only one option is correct — eliminate wrong ones first, then pick the strongest.'
                  : currentQuestion.questionType === 'aptitude'
                    ? 'Read carefully before calculating. Write your working if it helps.'
                    : 'Start with a direct answer, then explain your reasoning with a short example.'}
              </div>
            </div>

            {isObjective && !isSubmitted && (
              <div style={S.kbdHint}>
                Press{' '}
                <kbd style={S.kbd}>1</kbd>–
                <kbd style={S.kbd}>4</kbd> to pick,{' '}
                <kbd style={S.kbd}>Enter</kbd> to
                submit
              </div>
            )}
          </section>

          <section
            style={S.answerPanel}
            className="iv-answer-panel"
          >
            {!isSubmitted ? (
              <>
                <div style={S.answerHeading}>
                  <div>
                    <span style={S.answerHeadingEyebrow}>
                      YOUR ANSWER
                    </span>
                    <strong style={S.answerHeadingTitle}>
                      {isObjective ? 'Choose an option' : 'Write your response'}
                    </strong>
                  </div>

                  <div style={S.answerModeTag}>
                    {isObjective
                      ? 'SELECT'
                      : 'WRITE'}
                  </div>
                </div>

                {isObjective ? (
                  <div style={S.options}>
                    {(currentQuestion.options || []).map(
                      (option, index) => {
                        const selected =
                          selectedAnswerIndex ===
                          index;

                        return (
                          <button
                            key={`${currentQuestion.id}-${index}`}
                            type="button"
                            style={{
                              ...S.option,
                              ...(selected
                                ? {
                                    ...S.optionActive,
                                    borderStyle: 'solid',
                                    borderWidth: 1,
                                    borderColor: mode.accent,
                                    background: mode.soft,
                                  }
                                : {}),
                            }}
                            className="iv-option"
                            onClick={() =>
                              selectAnswer(index)
                            }
                          >
                            <span
                              style={{
                                ...S.optionLetter,
                                ...(selected
                                  ? {
                                      background: mode.accent,
                                      borderStyle: 'solid',
                                      borderWidth: 1,
                                      borderColor: mode.accent,
                                      color: '#fff',
                                    }
                                  : {}),
                              }}
                            >
                              {String.fromCharCode(
                                65 + index
                              )}
                            </span>

                            <span
                              style={S.optionText}
                            >
                              {option}
                            </span>

                            <span
                              style={{
                                ...S.optionRadio,
                                ...(selected
                                  ? {
                                      borderStyle: 'solid',
                                      borderWidth: 1,
                                      borderColor: mode.accent,
                                      background: mode.accent,
                                    }
                                  : {}),
                              }}
                            >
                              {selected ? '✓' : ''}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <textarea
                    ref={textAreaRef}
                    style={S.answerBox}
                    value={textAnswer}
                    onChange={(e) => {
                      setTextAnswer(
                        e.target.value
                      );
                      if (confirmingShortSubmit) {
                        setConfirmingShortSubmit(false);
                      }
                    }}
                    placeholder="Write your answer here... (Enter to submit, Shift+Enter for a new line)"
                    rows={9}
                  />
                )}

                <div style={S.answerFooter}>
                  <span
                    style={{
                      ...S.answerFooterHint,
                      ...(isObjective
                        ? selectedAnswerIndex !== null
                          ? { color: C.green, fontWeight: 600 }
                          : {}
                        : textAnswer.trim().length > 0
                          ? { color: C.blue500, fontWeight: 600 }
                          : {}),
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {isObjective
                      ? selectedAnswerIndex !== null
                        ? '✓ Answer selected'
                        : 'Select one option to continue'
                      : textAnswer.trim().length > 0
                        ? `${textAnswer.trim().split(/\s+/).filter(Boolean).length} words · ${textAnswer.length} chars`
                        : 'Start typing your answer…'}
                  </span>

                  {confirmingShortSubmit && (
                    <div
                      className="iv-fade-in"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 10,
                        padding: '9px 13px',
                        borderRadius: 10,
                        background: C.amberTint,
                        border: `1px solid ${C.amber}40`,
                      }}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                      <span style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.4 }}>
                        That's only {wordCount} word{wordCount === 1 ? '' : 's'} — short answers usually score low. Click submit again if you're sure, or keep typing.
                      </span>
                    </div>
                  )}

                  <div
                    style={S.answerActions}
                    className="iv-answer-actions"
                  >
                    <button
                      type="button"
                      style={S.skipBtn}
                      className="iv-skip-btn"
                      disabled={isLoading}
                      onClick={() => {
                        setWasSkipped(true);
                        handleSkip(
                          currentQuestion.timeLimit -
                            secondsLeft
                        );
                      }}
                    >
                      Skip
                    </button>

                    <button
                      type="button"
                      style={{
                        ...S.submitBtn,
                        ...(!canSubmit
                          ? S.btnDisabled
                          : {}),
                        ...(isLoading
                          ? { opacity: 0.82, cursor: 'wait' }
                          : {}),
                        ...(confirmingShortSubmit
                          ? { background: `linear-gradient(135deg, ${C.amber}, #F59E0B)` }
                          : {}),
                      }}
                      className={`iv-submit-btn${isLoading ? ' iv-btn-loading' : ''}`}
                      disabled={!canSubmit || isLoading}
                      onClick={doSubmit}
                    >
                      {isLoading
                        ? 'Checking'
                        : confirmingShortSubmit
                          ? 'Submit anyway →'
                          : isLastQuestion
                            ? 'Submit final answer'
                            : 'Submit answer →'}
                    </button>
                  </div>

                  {/* Enter ↵ to submit hint — faint, only shows when answer ready */}
                  {canSubmit && !isLoading && (
                    <div style={{
                      textAlign: 'right',
                      marginTop: 6,
                      fontSize: 10,
                      color: C.faint,
                      fontFamily: F.mono,
                    }}>
                      press{' '}
                      <span style={{
                        display: 'inline-block',
                        padding: '1px 5px',
                        borderRadius: 4,
                        borderStyle: 'solid',
                        borderWidth: 1,
                        borderColor: C.border,
                        borderBottomWidth: 2,
                        background: C.cardAlt,
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: C.sub,
                        lineHeight: 1.4,
                      }}>
                        Enter ↵
                      </span>{' '}
                      to submit
                    </div>
                  )}
                </div>
              </>
            ) : (
              <FeedbackView
                question={currentQuestion}
                feedback={feedback}
                onNext={doAdvance}
                isLoading={
                  isLoading || isAdvancing
                }
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
          <div
            style={S.errorBanner}
            className="iv-fade-in"
          >
            <strong>
              Something went wrong
            </strong>

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

const TimerRing = ({
  seconds,
  percent,
  warning,
  critical,
  accent,
}) => {
  const size = 58;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference * (1 - percent / 100);

  // Three-stage colour: accent → amber → red
  const color = critical
    ? C.red
    : warning
      ? C.amber
      : accent;

  // Urgency class drives the pulse animation
  const urgencyClass = critical
    ? 'iv-ring-critical'
    : warning
      ? 'iv-ring-warning'
      : '';

  return (
    <div
      style={{
        ...S.ringWrap,
        width: size,
        height: size,
      }}
      className={urgencyClass}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: 'rotate(-90deg)',
        }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={C.border}
          strokeWidth={stroke}
          fill="none"
        />

        {/* Drain arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition:
              'stroke-dashoffset 1s linear, stroke 0.4s ease',
            filter: critical
              ? 'drop-shadow(0 0 3px rgba(220,38,38,0.55))'
              : warning
                ? 'drop-shadow(0 0 2px rgba(217,119,6,0.4))'
                : 'none',
          }}
        />
      </svg>

      <div
        style={{
          ...S.ringLabel,
          color,
          fontSize: critical ? 13 : warning ? 12 : 11,
          fontWeight: critical ? 900 : 700,
          letterSpacing: critical ? '-0.5px' : '0px',
          transition: 'color 0.4s ease, font-size 0.2s ease',
        }}
      >
        {formatTime(seconds)}
      </div>
    </div>
  );
};

// ── Splits a paragraph string into bullet-ready sentences ─────────────────
const splitToBullets = (text = '') => {
  if (!text) return [];

  // If the text contains numbered list markers (e.g. "1. ... 2. ..."),
  // split on them and strip the number prefix — avoids "1." showing as
  // a standalone bullet with the sentence as the next one.
  const numberedSplit = text
    .split(/(?<!\d)\d+\.\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (numberedSplit.length > 1) return numberedSplit;

  // Fallback: sentence boundaries
  const sentences = text
    .replace(/([.!?])\s+/g, '$1|||')
    .split('|||')
    .map(s => s.trim())
    .filter(Boolean);
  return sentences.length <= 1 ? [text.trim()] : sentences;
};
// ── Score metadata ─────────────────────────────────────────────────────────
const scoreConfig = (score) => {
  if (score >= 90) return {
    color: C.green,
    bg: C.greenTint,
    barGradient: `linear-gradient(90deg, #059669, #10b981)`,
    emoji: '🏆',
    label: 'Excellent',
    vibe: 'Outstanding. That\'s interview-ready.',
  };
  if (score >= 75) return {
    color: C.green,
    bg: C.greenTint,
    barGradient: `linear-gradient(90deg, #059669, #10b981)`,
    emoji: '🔥',
    label: 'Strong',
    vibe: 'Really solid. You clearly know this.',
  };
  if (score >= 60) return {
    color: C.blue500,
    bg: C.blue50,
    barGradient: `linear-gradient(90deg, ${C.blue600}, ${C.blue400})`,
    emoji: '👍',
    label: 'Good',
    vibe: 'Good base — a bit more depth and this is interview-ready.',
  };
  if (score >= 40) return {
    color: C.amber,
    bg: C.amberTint,
    barGradient: `linear-gradient(90deg, #b45309, ${C.amber})`,
    emoji: '📝',
    label: 'Developing',
    vibe: 'You\'re on the right track. A few key points are missing.',
  };
  return {
    color: C.red,
    bg: C.redTint,
    barGradient: `linear-gradient(90deg, #b91c1c, ${C.red})`,
    emoji: '📈',
    label: 'Needs work',
    vibe: 'Don\'t worry — this is exactly why you practice.',
  };
};

const FeedbackView = ({
  question,
  feedback,
  onNext,
  isLoading,
  isLast,
  accent,
  userAnswerIndex,
  skipped = false,
  questionIndex = 0,
  totalQuestions = 1,
}) => {
  const [showSample, setShowSample] = useState(false);

  const score   = Number(feedback?.score) || 0;
  const objective = ['mcq', 'aptitude'].includes(question?.questionType);
  const correct   = feedback?.correct === true;

  const cfg = scoreConfig(score);

  // For objective questions
  const objColor = correct ? C.green : C.red;
  const objBg    = correct ? C.greenTint : C.redTint;
  const objEmoji = correct ? '✅' : '❌';
  const objVibe  = correct
    ? 'Nailed it. On to the next one.'
    : 'Scroll down — the correct answer and explanation are right below.';

  // ── Skipped question — no score badge, no red "needs work" framing. This
  // was previously indistinguishable from a genuinely weak scored answer
  // (same score strip, same empty feedback blocks), which read as
  // demoralizing for something the user chose not to attempt. Instead this
  // shows a neutral summary plus whatever model-answer content the backend
  // returns, so the skip still teaches something.
  if (skipped) {
    const hint = feedback?.idealHint || '';
    const sample = feedback?.sampleAnswer || '';
    return (
      <div style={S.feedback} className="iv-fade-in">
        <div style={{
          ...S.fbScoreStrip,
          background: C.cardAlt,
          borderStyle: 'solid',
          borderWidth: 1,
          borderColor: C.border,
        }}>
          <div style={S.fbScoreLeft}>
            <span style={S.fbScoreEmoji}>⏭</span>
            <div>
              <div style={{ ...S.fbScoreLabel, color: C.sub }}>Question skipped</div>
              <div style={S.fbScoreVibe}>No answer was scored — here's what a strong one looks like.</div>
            </div>
          </div>
        </div>

        {objective ? (
          <McqExplanation
            question={question}
            correct={false}
            userAnswerIndex={null}
            skipped
          />
        ) : (hint || sample) ? (
          <div style={{
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
            background: C.card,
          }}>
            {hint && (
              <div style={{
                padding: '14px 18px',
                background: C.blue50,
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>💡</span>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.blue600, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 3 }}>
                    What this question is really testing
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.5 }}>
                    {hint}
                  </div>
                </div>
              </div>
            )}
            {sample && (
              <div style={{ padding: '16px 18px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13,
                }}>
                  <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                    Model answer
                  </span>
                  <span style={{ flex: 1, height: 1, background: C.border }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {splitToBullets(sample).map((pt, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                        background: `linear-gradient(135deg, ${C.blue500}, ${C.cyan500 || C.blue600})`,
                        color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: F.mono,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.7, color: C.text, paddingTop: 1 }}>
                        {pt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '14px 16px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, textAlign: 'center' }}>
            No model answer available for this question.
          </div>
        )}

        <div className="iv-next-btn-wrap" style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <button
            type="button"
            style={{ ...S.nextBtn, background: `linear-gradient(135deg, ${C.blue700}, ${accent})`, ...(isLoading ? S.btnDisabled : {}) }}
            className="iv-next-btn"
            onClick={onNext}
            disabled={isLoading}
          >
            {isLoading ? (<><span style={S.spinner} />{isLast ? 'Preparing your report…' : 'Preparing…'}</>) : isLast ? 'View your results →' : 'Next question →'}
          </button>
          <div style={S.nextBtnHint}>Press <kbd style={S.kbd}>Enter</kbd> to continue</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.feedback} className="iv-fade-in">

      {/* ── Score strip ──────────────────────────────────────────────────── */}
      <div style={{
        ...S.fbScoreStrip,
        background: objective ? objBg : cfg.bg,
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: `${objective ? objColor : cfg.color}28`,
      }}>
        <div style={S.fbScoreLeft}>
          {/* Emoji badge */}
          <div style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: objective ? objColor : cfg.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, boxShadow: `0 4px 12px ${(objective ? objColor : cfg.color)}40`,
          }}>
            {objective ? objEmoji : cfg.emoji}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...S.fbScoreLabel, color: objective ? objColor : cfg.color }}>
              {objective ? (correct ? 'Correct answer' : 'Wrong answer') : cfg.label}
            </div>
            <div style={S.fbScoreVibe}>
              {objective ? objVibe : cfg.vibe}
            </div>
          </div>
        </div>

        {!objective && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
            <div style={S.fbScoreRight}>
              <div style={{ ...S.fbScoreNum, color: cfg.color }} className="iv-fb-score-num">
                {score}
              </div>
              <div style={S.fbScoreOutOf}>/100</div>
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.faint, letterSpacing: '0.2px', textAlign: 'right' }}>
              {feedback?.timeTaken > 0 ? `${feedback.timeTaken}s · ` : ''}Q{questionIndex + 1}/{totalQuestions}
            </span>
          </div>
        )}
      </div>

      {/* ── Score bar (open only) ────────────────────────────────────────── */}
      {!objective && (
        <div style={S.fbBarWrap}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: '0.4px' }}>SCORE</span>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: cfg.color, fontWeight: 700 }}>
              {score >= 90 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Developing' : 'Needs work'}
            </span>
          </div>
          <div style={S.fbBarTrack}>
            <div style={{ ...S.fbBarFill, width: `${score}%`, background: cfg.barGradient }} className="iv-fb-bar" />
          </div>
          <div style={S.fbBarTicks}>
            {[25, 50, 75].map(t => (
              <div key={t} style={{ ...S.fbBarTick, left: `${t}%` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Open question feedback ───────────────────────────────────────── */}
      {!objective ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }} className="iv-feedback-grid">

          {/* What worked + What was missing — full-width primary blocks */}
          {feedback?.good && splitToBullets(feedback.good).length > 0 && (
            <FeedbackBlock
              icon="✅"
              title="What worked"
              bullets={splitToBullets(feedback.good)}
              color={C.green}
              bg={C.greenTint}
              size="full"
            />
          )}

          <FeedbackBlock
            icon="🔍"
            title="What was missing"
            bullets={splitToBullets(feedback?.missing)}
            color={C.red}
            bg={C.redTint}
            size="full"
          />

          {/* Key idea + Next move — side by side secondary row */}
          {(feedback?.idealHint || feedback?.tip) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="iv-fb-secondary">
              {feedback?.idealHint && (
                <FeedbackBlock
                  icon="💡"
                  title="Key idea"
                  bullets={splitToBullets(feedback.idealHint)}
                  color={C.blue500}
                  bg={C.blue50}
                  size="half"
                />
              )}
              {feedback?.tip && (
                <FeedbackBlock
                  icon="🎯"
                  title="Next move"
                  bullets={splitToBullets(feedback.tip)}
                  color={C.amber}
                  bg={C.amberTint}
                  size="half"
                />
              )}
            </div>
          )}

        </div>
      ) : (
        <McqExplanation
          question={question}
          correct={correct}
          userAnswerIndex={userAnswerIndex}
        />
      )}

      {/* ── Sample answer toggle (open only) ────────────────────────────── */}
      {!objective && feedback?.sampleAnswer && (
        <div style={S.fbSampleWrap}>
          <button
            type="button"
            style={S.fbSampleToggle}
            className="iv-fb-sample-toggle"
            onClick={() => setShowSample(v => !v)}
          >
            <span style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
              background: showSample ? C.blue500 : C.cardAlt,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: showSample ? '#fff' : C.muted, fontWeight: 800,
              transition: 'all 0.18s ease',
            }}>
              {showSample ? '▾' : '▸'}
            </span>
            {showSample ? 'Hide ideal answer' : 'See a model answer'}
            <span style={S.fbSampleBadge}>see how a top answer reads</span>
          </button>

          {showSample && (
            <div style={S.fbSampleBody} className="iv-fade-in">
              <div style={{
                fontFamily: F.mono, fontSize: 9, fontWeight: 700,
                color: C.muted, letterSpacing: '0.6px', textTransform: 'uppercase',
                marginBottom: 12,
              }}>
                What a strong answer covers
              </div>
              {splitToBullets(feedback.sampleAnswer).map((pt, i) => (
                <div key={i} style={S.fbSamplePoint}>
                  <span style={{
                    ...S.fbSampleDot,
                    background: `linear-gradient(135deg, ${C.blue500}, ${C.blue600})`,
                    color: '#fff', fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ ...S.fbSampleText, fontSize: 13, lineHeight: 1.7 }}>{pt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Continue button ──────────────────────────────────────────────── */}
      <div className="iv-next-btn-wrap" style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <button
          type="button"
          style={{
            ...S.nextBtn,
            background: `linear-gradient(135deg, ${C.blue700}, ${accent})`,
            ...(isLoading ? S.btnDisabled : {}),
          }}
          className="iv-next-btn"
          onClick={onNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <><span style={S.spinner} />{isLast ? 'Preparing your report…' : 'Preparing…'}</>
          ) : isLast ? (
            '🏁 View my results'
          ) : (
            'Next question →'
          )}
        </button>
        <div style={S.nextBtnHint}>
          Press <kbd style={S.kbd}>Enter</kbd> to continue
        </div>
      </div>
    </div>
  );
};

const FeedbackBlock = ({ icon, title, bullets, color, bg, size = 'full' }) => {
  const isHalf = size === 'half';
  const hasContent = bullets?.length > 0;
  if (!hasContent && size === 'full' && title === 'What worked') return null;

  return (
    <div style={{
      padding: isHalf ? '11px 13px' : '13px 16px',
      background: bg,
      borderRadius: 13,
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: `${color}28`,
      borderLeftStyle: 'solid',
      borderLeftWidth: 3,
      borderLeftColor: `${color}70`,
      display: 'flex',
      flexDirection: 'column',
      gap: isHalf ? 7 : 10,
    }}>
      <div style={S.fbBlockHeader}>
        <span style={{
          width: isHalf ? 22 : 26, height: isHalf ? 22 : 26,
          borderRadius: isHalf ? 6 : 8,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isHalf ? 11 : 13, flexShrink: 0,
        }}>
          {icon}
        </span>
        <span style={{ ...S.fbBlockTitle, color, fontSize: isHalf ? 10 : 11 }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isHalf ? 5 : 7 }}>
        {(hasContent ? bullets : ['No additional feedback.']).map((pt, i) => (
          <div key={i} style={S.fbBulletRow}>
            <span style={{
              ...S.fbBulletDot,
              background: color,
              width: isHalf ? 4 : 5,
              height: isHalf ? 4 : 5,
              marginTop: isHalf ? 7 : 6,
            }} />
            <span style={{
              ...S.fbBulletText,
              fontSize: isHalf ? 12 : 12.5,
              lineHeight: isHalf ? 1.5 : 1.6,
            }}>
              {pt}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MCQ EXPLANATION CARD
// ═══════════════════════════════════════════════════════════════════════════

const McqExplanation = ({ question, correct, userAnswerIndex, skipped = false }) => {
  const correctIndex = question?.correctAnswerIndex;
  const correctText  = (correctIndex !== null && correctIndex !== undefined)
    ? question?.options?.[correctIndex] : null;
  const userIndex = userAnswerIndex ?? null;
  const userText  = (userIndex !== null && userIndex !== undefined)
    ? question?.options?.[userIndex] : null;
  const explanation = question?.explanation || '';

  // ── Skipped ────────────────────────────────────────────────────────────
  if (skipped) {
    return (
      <div style={S.mcqWrap}>
        {correctText ? (
          <div style={{
            padding: '16px 18px', borderRadius: 14,
            borderStyle: 'solid', borderWidth: 2, borderColor: `${C.amber}50`,
            background: C.amberTint,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: `${C.amber}25`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14,
              }}>⏭</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.amber, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Correct answer · not attempted
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: C.amber,
                background: `${C.amber}20`, borderStyle: 'solid', borderWidth: 1,
                borderColor: `${C.amber}40`, borderRadius: 6, padding: '3px 9px', flexShrink: 0,
              }}>Remember this</span>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: C.amber, lineHeight: 1.45, paddingLeft: 38 }}>
              {correctText}
            </div>
          </div>
        ) : (
          <div style={{ padding: '14px 16px', borderRadius: 12, background: C.cardAlt, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, fontSize: 12, color: C.muted, textAlign: 'center' }}>
            Correct answer unavailable for this question.
          </div>
        )}
        {explanation ? (
          <div style={S.mcqExplainWrap}>
            <div style={S.mcqExplainHeader}>
              <span style={S.mcqExplainIcon}>💡</span>
              <span style={S.mcqExplainTitle}>Why this is the answer</span>
            </div>
            <div style={S.mcqExplainBody}>
              {splitToBullets(explanation).map((pt, i) => (
                <div key={i} style={S.fbBulletRow}>
                  <span style={{ ...S.fbBulletDot, background: C.blue500, marginTop: 7 }} />
                  <span style={S.mcqExplainText}>{pt}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ── Answered ───────────────────────────────────────────────────────────
  return (
    <div style={S.mcqWrap}>
      <div style={{ display: 'flex', flexDirection: correct ? 'row' : 'column', gap: correct ? 10 : 12 }}>
        {/* User pick */}
        <div style={{
          padding: '14px 16px', borderRadius: 14,
          borderStyle: 'solid', borderWidth: 1.5,
          borderColor: correct ? `${C.green}50` : `${C.red}50`,
          background: correct ? C.greenTint : C.redTint,
          flex: correct ? 1 : 'unset', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: correct ? `${C.green}20` : `${C.red}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
            }}>{correct ? '✅' : '❌'}</span>
            <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: correct ? C.green : C.red, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {correct ? 'Your answer · Correct!' : 'Your answer · Incorrect'}
            </span>
          </div>
          <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 600, color: correct ? C.green : C.red, lineHeight: 1.45, paddingLeft: 34 }}>
            {userText || 'No option selected'}
          </div>
        </div>

        {/* Correct answer when wrong */}
        {!correct && correctText && (
          <div style={{
            padding: '14px 18px', borderRadius: 14,
            borderStyle: 'solid', borderWidth: 2, borderColor: `${C.green}55`,
            background: C.greenTint, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: `${C.green}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.green, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Correct answer</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: `${C.green}18`, borderStyle: 'solid', borderWidth: 1, borderColor: `${C.green}35`, borderRadius: 6, padding: '3px 9px' }}>
                Remember this
              </span>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: C.green, lineHeight: 1.45, paddingLeft: 34 }}>
              {correctText}
            </div>
          </div>
        )}
      </div>

      {/* Why this is the answer */}
      {explanation ? (
        <div style={S.mcqExplainWrap}>
          <div style={S.mcqExplainHeader}>
            <span style={S.mcqExplainIcon}>💡</span>
            <span style={S.mcqExplainTitle}>Why this is the answer</span>
          </div>
          <div style={S.mcqExplainBody}>
            {splitToBullets(explanation).map((pt, i) => (
              <div key={i} style={S.fbBulletRow}>
                <span style={{ ...S.fbBulletDot, background: C.blue500, marginTop: 7 }} />
                <span style={S.mcqExplainText}>{pt}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={S.mcqNoExplain}>
          {correct ? '🎯 Great recall — on to the next one.' : '📖 Review this topic before your next session.'}
        </div>
      )}

      {/* All options at a glance */}
      {question?.options?.length > 0 && (
        <div style={S.mcqOptionsWrap}>
          <span style={S.mcqOptionsLabel}>All options at a glance</span>
          <div style={S.mcqOptionsList}>
            {question.options.map((opt, i) => {
              const isCorrect = i === correctIndex;
              const isUser    = i === userIndex;
              const bg  = isCorrect ? C.greenTint : isUser && !correct ? C.redTint : C.cardAlt;
              const col = isCorrect ? C.green : isUser && !correct ? C.red : C.muted;
              const bw  = isCorrect || (isUser && !correct) ? 1.5 : 1;
              const bc  = isCorrect ? `${C.green}40` : isUser && !correct ? `${C.red}30` : C.border;
              return (
                <div key={i} style={{ ...S.mcqOption, background: bg, borderStyle: 'solid', borderWidth: bw, borderColor: bc }} className="iv-mcq-option">
                  <span style={{ ...S.mcqOptionBullet, color: col, borderStyle: 'solid', borderWidth: 1.5, borderColor: `${col}40`, background: isCorrect || isUser ? `${col}15` : 'transparent', fontWeight: isCorrect ? 800 : 600 }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span style={{ ...S.mcqOptionText, color: col, fontWeight: isCorrect ? 600 : 400 }}>{opt}</span>
                  {isCorrect && !isUser  && <span style={{ ...S.mcqOptionBadge, color: C.green, background: `${C.green}15`, borderStyle: 'solid', borderWidth: 1, borderColor: `${C.green}30` }}>✓ correct</span>}
                  {isCorrect && isUser   && <span style={{ ...S.mcqOptionBadge, color: C.green, background: `${C.green}15`, borderStyle: 'solid', borderWidth: 1, borderColor: `${C.green}30` }}>✓ your pick</span>}
                  {isUser && !isCorrect  && <span style={{ ...S.mcqOptionBadge, color: C.red,   background: `${C.red}12`,   borderStyle: 'solid', borderWidth: 1, borderColor: `${C.red}25`   }}>your pick</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES
// ═══════════════════════════════════════════════════════════════════════════

const GlobalStyles = () => (
  <style>{`
    @keyframes ivSpin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes ivLivePulse {
      0%,100% {
        opacity:1;
      }

      50% {
        opacity:0.3;
      }
    }

    @keyframes ivScan {
      0% {
        transform:translateX(-100%);
      }

      100% {
        transform:translateX(320%);
      }
    }

    @keyframes ivFadeIn {
      from {
        opacity:0;
        transform:translateY(6px);
      }

      to {
        opacity:1;
        transform:translateY(0);
      }
    }

    /* Directional slide for question-to-question transitions — feels like
       moving forward through the session rather than things just appearing */
    @keyframes ivSlideQuestion {
      from {
        opacity: 0;
        transform: translateX(10px) translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateX(0) translateY(0);
      }
    }

    @keyframes ivPopIn {
      0% {
        opacity:0;
        transform:scale(0.85);
      }

      100% {
        opacity:1;
        transform:scale(1);
      }
    }

    @keyframes ivScorePop {
      0% {
        opacity:0;
        transform:scale(0.6) rotate(-8deg);
      }

      60% {
        transform:scale(1.08) rotate(2deg);
      }

      100% {
        opacity:1;
        transform:scale(1) rotate(0);
      }
    }

    @keyframes ivBarGrow {
      from { width: 0%; }
    }

    .iv-fb-bar {
      animation: ivBarGrow 0.7s cubic-bezier(.16,1,.3,1);
    }

    @keyframes ivRingPulse {
      0%,100% {
        box-shadow: 0 0 0 0 rgba(220,38,38,0.40);
      }
      50% {
        box-shadow: 0 0 0 7px rgba(220,38,38,0);
      }
    }

    @keyframes ivRingWarn {
      0%,100% {
        box-shadow: 0 0 0 0 rgba(217,119,6,0.35);
      }
      50% {
        box-shadow: 0 0 0 6px rgba(217,119,6,0);
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    .iv-fade-in {
      animation: ivFadeIn 0.32s cubic-bezier(.16,1,.3,1);
    }

    /* Question panel gets the directional slide — feels like advancing */
    .iv-question-slide {
      animation: ivSlideQuestion 0.30s cubic-bezier(.16,1,.3,1);
    }

    .iv-pop-in {
      animation: ivPopIn 0.28s cubic-bezier(.34,1.56,.64,1);
    }

    .iv-score-pop {
      animation: ivScorePop 0.42s cubic-bezier(.34,1.56,.64,1);
    }

    .iv-ring-critical {
      border-radius: 50%;
      animation: ivRingPulse 1.0s ease-in-out infinite;
    }

    .iv-ring-warning {
      border-radius: 50%;
      animation: ivRingWarn 1.4s ease-in-out infinite;
    }

    .iv-page button {
      transition:
        transform 0.16s cubic-bezier(.16,1,.3,1),
        box-shadow 0.16s ease,
        border-color 0.16s ease,
        background 0.16s ease,
        opacity 0.16s ease,
        filter 0.16s ease,
        color 0.16s ease;
    }

    .iv-page button:active:not(:disabled) {
      transform: scale(0.96) !important;
      filter: brightness(0.97);
    }

    .iv-page button:disabled {
      cursor: not-allowed;
    }

    .iv-page button:focus-visible,
    .iv-page textarea:focus-visible,
    .iv-page select:focus-visible {
      outline: 2.5px solid ${C.blue500};
      outline-offset: 2px;
    }

    /* Select focus ring — needs separate rule since selects have native chrome */
    .iv-builder-select:focus {
      border-color: ${C.blue500} !important;
      box-shadow: 0 0 0 3px rgba(26,110,255,0.12) !important;
      outline: none !important;
    }

    .iv-mode-card:hover:not(:disabled) {
      border-color: ${C.borderStr} !important;
      box-shadow: 0 6px 20px rgba(26,110,255,0.10);
      transform: translateY(-2px);
    }

    .iv-difficulty-card:hover:not(:disabled) {
      border-color: ${C.borderStr} !important;
      transform: translateY(-2px);
      box-shadow: 0 4px 14px rgba(26,110,255,0.08);
    }

    /* MCQ options get a horizontal nudge — feels like selection, not hover */
    .iv-option:hover:not(:disabled) {
      border-color: ${C.borderMd} !important;
      transform: translateX(2px);
      box-shadow: 0 3px 12px rgba(26,110,255,0.07);
    }

    .iv-exit-btn:hover {
      background: ${C.cardAlt} !important;
      border-color: ${C.borderStr} !important;
      color: ${C.red} !important;
    }

    .iv-skip-btn:hover:not(:disabled) {
      background: ${C.cardAlt} !important;
      border-color: ${C.borderMd} !important;
      color: ${C.sub} !important;
    }

    .iv-btn-launch:hover:not(:disabled) {
      box-shadow: 0 14px 36px rgba(26,110,255,0.38) !important;
      transform: translateY(-2px);
    }

    .iv-submit-btn:hover:not(:disabled) {
      box-shadow: 0 12px 28px rgba(26,110,255,0.38) !important;
      transform: translateY(-2px);
      filter: brightness(1.05);
    }

    .iv-next-btn:hover:not(:disabled) {
      filter: brightness(1.07);
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(26,110,255,0.32) !important;
    }

    .iv-page textarea {
      transition:
        border-color 0.18s ease,
        box-shadow 0.18s ease,
        background 0.18s ease;
    }

    .iv-page textarea:focus {
      border-color: ${C.blue500};
      box-shadow: 0 0 0 3px rgba(26,110,255,0.10);
      background: #fff;
      outline: none;
    }

    /* Textarea with content (ready to submit) — subtle green-tinted border
       signals "you have something to say" without distracting */
    .iv-page textarea:not(:placeholder-shown):not(:focus) {
      border-color: ${C.green}80;
      background: #FAFFFE;
    }

    @keyframes ivNotifIn {
      from { opacity: 0; transform: translateY(-6px) scaleY(0.92); }
      to   { opacity: 1; transform: translateY(0)    scaleY(1); }
    }

    @keyframes ivNotifSpin {
      to { transform: rotate(360deg); }
    }

    .iv-notif-bar {
      animation: ivNotifIn 0.22s cubic-bezier(.16,1,.3,1);
      transform-origin: top center;
    }

    .iv-notif-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: ivNotifSpin 0.7s linear infinite;
      opacity: 0.8;
    }

    @keyframes ivSpin {
      to { transform: rotate(360deg); }
    }
    .iv-btn-loading::after {
      content: '';
      display: inline-block;
      width: 11px;
      height: 11px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: ivSpin 0.65s linear infinite;
      margin-left: 7px;
      vertical-align: middle;
    }

    .iv-question-panel,
    .iv-answer-panel,
    .iv-console-card {
      transition:
        box-shadow 0.24s ease,
        border-color 0.24s ease;
    }

    .iv-question-panel:hover {
      box-shadow: 0 8px 28px rgba(26,110,255,0.09) !important;
      border-color: ${C.borderMd} !important;
    }

    .iv-answer-panel:hover {
      box-shadow: 0 6px 22px rgba(26,110,255,0.07) !important;
    }

    @media (prefers-reduced-motion: reduce) {
      .iv-page * {
        animation: none !important;
        transition: none !important;
      }
    }

    /* ── 1020px: hero stacks, room grid stacks ──────────────────────── */
    @media (max-width: 1020px) {
      .iv-hero-grid {
        grid-template-columns: 1fr !important;
        gap: 20px !important;
        text-align: center;
      }

      .iv-preview-block {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .iv-room-grid {
        grid-template-columns: 1fr !important;
      }
    }

    /* ── 900px: difficulty goes 2-col ───────────────────────────────── */
    @media (max-width: 900px) {
      .iv-difficulty-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
    }

    /* ── 760px: mode grid 1-col, launch area stacks, hide strip right ─ */
    @media (max-width: 760px) {
      .iv-strip-r {
        display: none !important;
      }

      .iv-mode-grid {
        grid-template-columns: 1fr !important;
      }

      .iv-launch-area {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 12px !important;
      }

      .iv-launch-area button {
        width: 100% !important;
        min-width: unset !important;
      }

      .iv-feedback-grid {
        grid-template-columns: 1fr !important;
      }

      .iv-fb-sample-toggle {
        font-size: 12px !important;
      }
    }

    /* ── 620px: room top wraps, trail wraps ─────────────────────────── */
    @media (max-width: 620px) {
      .iv-room-top {
        flex-wrap: wrap;
        gap: 8px;
      }

      .iv-trail {
        flex-wrap: wrap;
      }
    }

    /* ── 480px: the main mobile breakpoint (360–480px Android) ─────── */
    @media (max-width: 480px) {
      /* Page */
      .iv-page {
        padding: 12px 10px 72px !important;
      }

      /* Hero */
      .iv-hero {
        padding: 20px 16px !important;
        border-radius: 16px !important;
      }

      /* Builder card */
      .iv-builder-card {
        border-radius: 16px !important;
      }

      .iv-group-block {
        padding: 14px 16px !important;
      }

      /* Mode cards — full width, bigger tap targets */
      .iv-mode-card {
        min-height: 72px !important;
        padding: 12px 14px !important;
        gap: 12px !important;
      }

      .iv-mode-label {
        font-size: 14px !important;
      }

      .iv-mode-desc {
        font-size: 12.5px !important;
      }

      /* Difficulty cards — 2-col with bigger text */
      .iv-difficulty-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 8px !important;
      }

      .iv-difficulty-card {
        min-height: 68px !important;
        padding: 11px 12px !important;
      }

      .iv-difficulty-label {
        font-size: 13.5px !important;
      }

      .iv-difficulty-desc {
        font-size: 12px !important;
      }

      /* Select dropdowns — 48px tap target */
      .iv-builder-select {
        height: 52px !important;
        font-size: 14px !important;
      }

      /* Launch area */
      .iv-launch-area {
        padding: 16px !important;
      }

      /* Session panels */
      .iv-question-panel,
      .iv-answer-panel {
        padding: 15px 14px !important;
        min-height: unset !important;
        border-radius: 14px !important;
      }

      /* Question text — slightly smaller clamp on very narrow screens */
      .iv-question-text {
        font-size: 16px !important;
        line-height: 1.6 !important;
      }

      /* Answer actions — skip and submit stack to column on narrow phones */
      .iv-answer-actions {
        flex-direction: column !important;
      }

      .iv-skip-btn {
        width: 100% !important;
        order: 2 !important;
        text-align: center !important;
      }

      .iv-submit-btn {
        width: 100% !important;
        order: 1 !important;
        text-align: center !important;
      }

      /* Console card */
      .iv-console-card {
        padding: 11px 13px !important;
        position: relative !important;
        top: unset !important;
      }

      /* Console mode icon — slightly smaller */
      .iv-console-mode-icon {
        width: 30px !important;
        height: 30px !important;
        font-size: 14px !important;
      }

      /* Next button — sticky bottom on mobile so user doesn't have to scroll */
      .iv-next-btn-wrap {
        position: sticky !important;
        bottom: 16px !important;
        background: ${C.card} !important;
        padding: 12px !important;
        margin: 16px -14px -14px !important;
        border-radius: 0 0 14px 14px !important;
        box-shadow: 0 -4px 16px rgba(10,22,40,0.08) !important;
        border-top: 1px solid ${C.border} !important;
      }

      /* Score number */
      .iv-fb-score-num {
        font-size: 36px !important;
        letter-spacing: -1.5px !important;
      }

      /* Feedback secondary row stacks on mobile */
      .iv-fb-secondary {
        grid-template-columns: 1fr !important;
      }

      /* Footnote */
      .iv-footnote {
        font-size: 11.5px !important;
        padding: 12px 16px 20px !important;
        line-height: 1.8 !important;
      }

      /* Exit modal */
      .iv-exit-modal {
        margin: 0 10px !important;
      }

      /* MCQ options — bigger tap area on mobile */
      .iv-mcq-option {
        padding: 12px 13px !important;
        min-height: 52px !important;
      }
    }

    /* ── 360px: absolute minimum Android ────────────────────────────── */
    @media (max-width: 360px) {
      .iv-hero {
        padding: 16px 14px !important;
      }

      .iv-group-block {
        padding: 12px 14px !important;
      }

      .iv-difficulty-grid {
        gap: 6px !important;
      }
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
    backgroundImage:
      `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`,
    padding: '20px 24px 64px',
    fontFamily: F.body,
  },

  container: {
    margin: '0 auto',
    transition:
      'opacity 0.5s ease, transform 0.5s cubic-bezier(.16,1,.3,1)',
  },

  strip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    marginBottom: 16,
    borderRadius: 10,
    background: C.card,
    border: `1px solid ${C.border}`,
    boxShadow: C.shadow,
  },

  stripL: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
  },

  stripR: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: C.green,
    animation:
      'ivLivePulse 2.4s ease-in-out infinite',
    boxShadow: `0 0 8px ${C.greenGlow}`,
  },

  mono: {
    fontFamily: F.mono,
    fontSize: 10.5,
    letterSpacing: '0.5px',
    color: C.muted,
  },

  hero: {
    position: 'relative',
    overflow: 'hidden',
    padding: '28px 28px',
    marginBottom: 14,
    borderRadius: 22,
    background:
      `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 45%, ${C.blue600} 75%, ${C.cyan600} 100%)`,
    boxShadow:
      '0 20px 56px rgba(0,31,107,0.30)',
  },

  heroScan: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '25%',
    height: '100%',
    background:
      'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
    animation: 'ivScan 9s linear infinite',
    willChange: 'transform',
    pointerEvents: 'none',
  },

  heroGrid: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    gap: 30,
    alignItems: 'center',
  },

  previewBlock: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.13)',
    borderRadius: 18,
    padding: '18px 20px',
    backdropFilter: 'blur(6px)',
  },

  irsLabel: {
    fontFamily: F.mono,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: '1.2px',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  previewModeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
  },

  previewModeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },

  previewModeLabel: {
    fontFamily: F.display,
    fontSize: 16,
    fontWeight: 800,
    color: '#fff',
  },

  previewModeSub: {
    marginTop: 3,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: F.mono,
  },

  previewMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
    justifyContent: 'inherit',
  },

  previewMetaChip: {
    padding: '5px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.12)',
    border:
      '1px solid rgba(255,255,255,0.18)',
    color: '#fff',
    fontSize: 10.5,
    fontWeight: 700,
    fontFamily: F.body,
  },

  verdictBlock: {},

  eyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontFamily: F.mono,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '1.2px',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: C.cyan400,
    flexShrink: 0,
  },

  heroH1: {
    margin: 0,
    fontFamily: F.display,
    fontSize: 'clamp(26px, 4vw, 42px)',
    fontWeight: 900,
    color: '#fff',
    lineHeight: 1.1,
    letterSpacing: '-0.8px',
    maxWidth: 600,
  },

  heroSub: {
    margin: '14px 0 0',
    fontSize: 'clamp(13px, 1.4vw, 15px)',
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.80)',
    maxWidth: 520,
  },

  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 20,
    boxShadow: C.shadow,
    overflow: 'hidden',
  },

  groupBlock: {
    padding: '16px 22px',
  },

  groupHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 11,
  },

  groupTitle: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 13.5,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  groupTitleAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    background: C.blue500,
    flexShrink: 0,
    display: 'inline-block',
  },

  groupTag: {
    color: C.faint,
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: '0.5px',
  },

  divider: {
    height: 1,
    background: C.border,
  },

  modeGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, 1fr)',
    gap: 9,
  },

  modeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 78,
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: C.border,
    background: C.card,
    borderRadius: 14,
    padding: '12px 13px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
  },

  modeCardActive: {
    background: `linear-gradient(135deg, ${C.cardAlt}, #fff)`,
    boxShadow: `0 0 0 2px ${C.blue500}30, ${C.shadow}`,
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: `${C.blue500}60`,
  },

  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },

  modeCopy: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },

  modeLabel: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 13.5,
    fontWeight: 800,
    lineHeight: 1.2,
  },

  modeDesc: {
    marginTop: 3,
    color: C.muted,
    fontSize: 12,
    lineHeight: 1.4,
  },

  modeCheck: {
    width: 20,
    height: 20,
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: C.borderMd,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 9,
    flexShrink: 0,
    transition:
      'transform 0.22s cubic-bezier(.34,1.56,.64,1), background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease',
  },

  difficultyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },

  difficultyCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    minHeight: 64,
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: C.border,
    background: C.card,
    borderRadius: 13,
    padding: '10px 11px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
  },

  difficultyCardActive: {
    background: C.cardAlt,
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: `${C.blue500}50`,
    boxShadow: `0 0 0 2px ${C.blue500}20`,
  },

  difficultyIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 900,
  },

  difficultyLabel: {
    display: 'block',
    color: C.text,
    fontFamily: F.display,
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.2,
  },

  difficultyDesc: {
    display: 'block',
    marginTop: 2,
    color: C.muted,
    fontSize: 11.5,
    lineHeight: 1.35,
  },

  difficultyRadio: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: C.borderMd,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 8,
    flexShrink: 0,
    transition: 'background 0.16s ease, border-color 0.16s ease',
  },

  builderSelect: {
    width: '100%',
    height: 48,
    border: `1.5px solid ${C.borderMd}`,
    borderRadius: 11,
    background: C.cardAlt,
    padding: '0 36px 0 13px',
    color: C.text,
    fontFamily: F.body,
    fontSize: 13.5,
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237C8CAD' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 13px center',
    cursor: 'pointer',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
  },

  launchArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: '18px 22px',
    background: C.cardAlt,
    borderTop: `1px solid ${C.border}`,
  },

  sessionSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },

  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 17,
  },

  summaryTitle: {
    display: 'block',
    color: C.text,
    fontFamily: F.display,
    fontSize: 13.5,
    fontWeight: 800,
  },

  summarySub: {
    display: 'block',
    marginTop: 3,
    color: C.muted,
    fontSize: 12,
  },

  btnLaunch: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 200,
    border: 'none',
    borderRadius: 13,
    padding: '15px 24px',
    color: '#fff',
    background: `linear-gradient(135deg, ${C.blue700}, ${C.blue500})`,
    boxShadow: '0 10px 26px rgba(26,110,255,0.32)',
    cursor: 'pointer',
    fontFamily: F.body,
    fontSize: 13.5,
    fontWeight: 800,
    letterSpacing: '0.1px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  btnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },

  spinner: {
    width: 13,
    height: 13,
    borderRadius: '50%',
    border:
      '2px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    animation:
      'ivSpin 0.7s linear infinite',
    display: 'inline-block',
  },

  footnote: {
    padding: '12px 22px 18px',
    color: C.faint,
    fontFamily: F.mono,
    fontSize: 11,
    letterSpacing: '0.2px',
    lineHeight: 1.7,
  },

  kbd: {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: 5,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.borderMd,
    borderBottomWidth: 2,
    background: C.cardAlt,
    color: C.sub,
    fontFamily: F.mono,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.4,
    verticalAlign: 'middle',
  },

  roomTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },

  roomActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  exitBtn: {
    border: `1px solid ${C.borderMd}`,
    background: C.card,
    borderRadius: 9,
    padding: '7px 12px',
    color: C.sub,
    cursor: 'pointer',
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: F.body,
  },

  exitOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,22,40,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: 20,
  },

  exitModal: {
    width: '100%',
    maxWidth: 380,
    background: C.card,
    borderRadius: 18,
    border: `1px solid ${C.border}`,
    boxShadow:
      '0 24px 60px rgba(10,22,40,0.28)',
    padding: '22px 22px 18px',
  },

  exitModalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: C.text,
    fontFamily: F.body,
    marginBottom: 6,
  },

  exitModalBody: {
    fontSize: 13,
    color: C.sub,
    lineHeight: 1.5,
    marginBottom: 18,
  },

  exitModalRow: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },

  exitModalCancel: {
    border: `1px solid ${C.border}`,
    background: C.card,
    borderRadius: 10,
    padding: '9px 16px',
    color: C.sub,
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 700,
    fontFamily: F.body,
  },

  exitModalConfirm: {
    border: '1px solid transparent',
    background: C.red || '#E24C4C',
    borderRadius: 10,
    padding: '9px 16px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 700,
    fontFamily: F.body,
  },

  consoleCard: {
    padding: '12px 16px',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    background: C.card,
    boxShadow: C.shadow,
    marginBottom: 10,
    position: 'sticky',
    top: 8,
    zIndex: 5,
  },
  consoleTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  consoleContext: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  consoleModeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 17,
  },
  consoleModeLabel: {
    display: 'block',
    color: C.text,
    fontFamily: F.display,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '-0.1px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  consoleModeSub: {
    display: 'block',
    marginTop: 2,
    color: C.muted,
    fontFamily: F.mono,
    fontSize: 10,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    letterSpacing: '0.2px',
  },
  consoleRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  questionNumber: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 2,
    fontFamily: F.mono,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
  },
  progressTrack: {
    marginTop: 10,
    height: 5,
    borderRadius: 999,
    background: C.border,
    overflow: 'hidden',
  },
  trail: {
    display: 'flex',
    gap: 4,
    marginTop: 10,
    alignItems: 'center',
  },
  trailDot: {
    height: 5,
    borderRadius: 999,
    transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
    flexShrink: 0,
  },
  ringWrap: {
    position: 'relative',
    width: 58,
    height: 58,
    flexShrink: 0,
    borderRadius: '50%',
  },
  ringLabel: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: F.mono,
    fontWeight: 700,
    pointerEvents: 'none',
    letterSpacing: '-0.3px',
  },
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    alignItems: 'start',
  },
  questionPanel: {
    minHeight: 380,
    padding: '22px 22px',
    display: 'flex',
    flexDirection: 'column',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    background: C.card,
    boxShadow: C.shadow,
  },
  questionPanelTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 18,
  },
  questionLabel: {
    fontFamily: F.mono,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.2px',
    color: C.blue500,
  },
  questionTags: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  questionTagNeutral: {
    padding: '4px 10px',
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    background: C.cardAlt,
    color: C.sub,
    fontSize: 9.5,
    fontFamily: F.mono,
    letterSpacing: '0.4px',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  questionBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  questionType: {
    marginBottom: 10,
    color: C.muted,
    fontSize: 10.5,
    letterSpacing: '0.8px',
    fontWeight: 700,
    fontFamily: F.mono,
    textTransform: 'uppercase',
  },
  questionText: {
    margin: 0,
    color: C.text,
    fontFamily: F.display,
    fontSize: 'clamp(16px, 2vw, 21px)',
    lineHeight: 1.65,
    fontWeight: 700,
    letterSpacing: '-0.2px',
  },
  questionHelp: {
    display: 'flex',
    gap: 9,
    alignItems: 'flex-start',
    marginTop: 20,
    paddingTop: 14,
    borderTop: `1px solid ${C.border}`,
    color: C.sub,
    fontSize: 12.5,
    lineHeight: 1.62,
    fontWeight: 500,
  },
  kbdHint: {
    marginTop: 14,
    fontSize: 11,
    color: C.faint,
    fontFamily: F.mono,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  answerPanel: {
    padding: '18px 18px',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    background: C.card,
    boxShadow: C.shadow,
    display: 'flex',
    flexDirection: 'column',
  },
  answerHeading: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 9,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottom: `1px solid ${C.border}`,
  },
  answerHeadingEyebrow: {
    display: 'block',
    color: C.blue500,
    fontFamily: F.mono,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: '0.9px',
    textTransform: 'uppercase',
  },
  answerHeadingTitle: {
    display: 'block',
    marginTop: 3,
    color: C.text,
    fontFamily: F.display,
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: '-0.2px',
  },
  answerModeTag: {
    padding: '4px 10px',
    borderRadius: 8,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    background: C.cardAlt,
    color: C.sub,
    fontSize: 9.5,
    fontFamily: F.mono,
    letterSpacing: '0.5px',
    fontWeight: 700,
    flexShrink: 0,
  },
  answerBox: {
    flex: 1,
    width: '100%',
    minHeight: 210,
    resize: 'vertical',
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    background: '#FFFFFF',
    color: C.text,
    padding: '14px 15px',
    outline: 'none',
    fontFamily: F.body,
    fontSize: 14,
    lineHeight: 1.72,
    letterSpacing: '0.01em',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
    flex: 1,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    minHeight: 54,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    background: C.card,
    padding: '11px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease',
  },
  optionActive: {
    boxShadow: `0 4px 16px rgba(26,110,255,0.13)`,
  },
  optionLetter: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    background: C.cardAlt,
    color: C.sub,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: F.mono,
    fontSize: 12,
    fontWeight: 800,
    transition: 'background 0.14s ease, border-color 0.14s ease, color 0.14s ease',
  },
  optionText: {
    flex: 1,
    color: C.text,
    fontFamily: F.body,
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 500,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: C.borderMd,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    flexShrink: 0,
    transition: 'background 0.14s ease, border-color 0.14s ease',
  },
  answerFooter: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 14,
    paddingTop: 13,
    borderTop: `1px solid ${C.border}`,
  },
  answerFooterHint: {
    color: C.muted,
    fontFamily: F.mono,
    fontSize: 11,
    letterSpacing: '0.15px',
  },
  answerActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  skipBtn: {
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: C.border,
    background: C.card,
    borderRadius: 11,
    padding: '11px 17px',
    color: C.muted,
    cursor: 'pointer',
    fontFamily: F.body,
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: '0.1px',
    flexShrink: 0,
    transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
  },
  submitBtn: {
    border: 'none',
    borderRadius: 11,
    padding: '11px 22px',
    background: `linear-gradient(135deg, ${C.blue700}, ${C.blue500})`,
    color: '#fff',
    boxShadow: '0 6px 20px rgba(26,110,255,0.28)',
    cursor: 'pointer',
    fontFamily: F.display,
    fontSize: 13.5,
    fontWeight: 800,
    letterSpacing: '0px',
    whiteSpace: 'nowrap',
    flex: 1,
    transition: 'box-shadow 0.15s ease, transform 0.1s ease',
  },
  feedback: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  fbScoreStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 14,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  fbScoreLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  fbScoreEmoji: {
    fontSize: 24,
    lineHeight: 1,
    flexShrink: 0,
  },
  fbScoreLabel: {
    fontFamily: F.mono,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  fbScoreVibe: {
    fontSize: 12,
    color: C.sub,
    lineHeight: 1.4,
    fontWeight: 500,
  },
  fbScoreRight: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 3,
  },
  fbScoreNum: {
    fontFamily: F.display,
    fontSize: 42,
    fontWeight: 900,
    letterSpacing: '-2px',
    lineHeight: 1,
  },
  fbScoreOutOf: {
    fontFamily: F.mono,
    fontSize: 14,
    color: C.muted,
    fontWeight: 600,
  },
  fbBarWrap: {
    marginBottom: 4,
  },
  fbBarTrack: {
    height: 8,
    borderRadius: 999,
    background: C.border,
    overflow: 'hidden',
    position: 'relative',
  },
  fbBarFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)',
  },
  fbBarTicks: {
    position: 'relative',
    height: 0,
  },
  fbBarTick: {
    position: 'absolute',
    top: -8,
    width: 1,
    height: 8,
    background: 'rgba(255,255,255,0.5)',
    pointerEvents: 'none',
  },
  fbBlocks: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 4,
  },
  feedbackBlock: {
    padding: '13px 16px',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
  },
  fbBlockHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  fbBlockIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  fbBlockTitle: {
    fontFamily: F.mono,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  fbBullets: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fbBulletRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 9,
  },
  fbBulletDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: 7,
  },
  fbBulletText: {
    fontSize: 12.5,
    lineHeight: 1.6,
    color: C.sub,
    flex: 1,
  },
  mcqWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 4,
  },
  mcqAnswerRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  mcqAnswerBox: {
    padding: '12px 14px',
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  mcqAnswerTag: {
    fontSize: 10,
    fontWeight: 800,
    fontFamily: F.mono,
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  },
  mcqAnswerText: {
    fontSize: 13.5,
    fontWeight: 600,
    color: C.text,
    lineHeight: 1.5,
  },
  mcqExplainWrap: {
    borderRadius: 13,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    background: C.blue50,
    overflow: 'hidden',
  },
  mcqExplainHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderBottom: `1px solid ${C.border}`,
    background: C.blue50,
  },
  mcqExplainIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  mcqExplainTitle: {
    fontSize: 11,
    fontWeight: 800,
    fontFamily: F.mono,
    color: C.blue600,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
  },
  mcqExplainBody: {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: C.card,
  },
  mcqExplainText: {
    fontSize: 13,
    lineHeight: 1.65,
    color: C.sub,
    fontWeight: 500,
  },
  mcqNoExplain: {
    fontSize: 13,
    color: C.muted,
    padding: '12px 14px',
    borderRadius: 12,
    background: C.cardAlt,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    fontWeight: 500,
  },
  mcqOptionsWrap: {
    borderRadius: 14,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  mcqOptionsLabel: {
    display: 'block',
    fontSize: 9.5,
    fontWeight: 800,
    fontFamily: F.mono,
    letterSpacing: '0.7px',
    color: C.muted,
    textTransform: 'uppercase',
    padding: '9px 14px 7px',
    borderBottom: `1px solid ${C.border}`,
    background: C.cardAlt,
  },
  mcqOptionsList: {
    display: 'flex',
    flexDirection: 'column',
  },
  mcqOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 0,
  },
  mcqOptionBullet: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: 'currentColor',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 800,
    fontFamily: F.mono,
    flexShrink: 0,
  },
  mcqOptionText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 1.5,
    fontWeight: 500,
  },
  mcqOptionBadge: {
    fontSize: 9,
    fontWeight: 800,
    fontFamily: F.mono,
    letterSpacing: '0.3px',
    padding: '2px 8px',
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: `${C.green}30`,
    color: C.green,
    background: `${C.green}15`,
    flexShrink: 0,
    textTransform: 'uppercase',
  },
  fbSampleWrap: {
    marginBottom: 2,
    borderRadius: 13,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  fbSampleToggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 14px',
    background: C.cardAlt,
    border: 'none',
    cursor: 'pointer',
    fontFamily: F.body,
    fontSize: 13,
    fontWeight: 700,
    color: C.sub,
    textAlign: 'left',
    transition: 'background 0.15s ease',
  },
  fbSampleBadge: {
    marginLeft: 'auto',
    fontSize: 9.5,
    fontFamily: F.mono,
    fontWeight: 700,
    letterSpacing: '0.4px',
    color: C.faint,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  fbSampleBody: {
    padding: '12px 14px 16px',
    background: C.card,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    borderTop: `1px solid ${C.border}`,
  },
  fbSamplePoint: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  fbSampleDot: {
    width: 20,
    height: 20,
    borderRadius: 6,
    flexShrink: 0,
    marginTop: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: F.mono,
    fontWeight: 800,
    fontSize: 9,
  },
  fbSampleText: {
    fontSize: 13.5,
    lineHeight: 1.7,
    color: C.text,
    fontWeight: 500,
  },
  nextBtn: {
    width: '100%',
    border: 'none',
    borderRadius: 13,
    padding: '15px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: '#fff',
    fontFamily: F.display,
    fontSize: 14.5,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(26,110,255,0.28)',
    letterSpacing: '-0.1px',
    transition: 'box-shadow 0.18s ease, transform 0.12s ease',
  },
  nextBtnHint: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11,
    color: C.faint,
    fontFamily: F.mono,
    letterSpacing: '0.2px',
  },
  roomFoot: {
    marginTop: 10,
    textAlign: 'center',
    color: C.muted,
    fontSize: 12,
    lineHeight: 1.6,
    letterSpacing: '0.1px',
    fontFamily: F.body,
    fontWeight: 500,
  },
  errorBanner: {
    marginTop: 10,
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    padding: '10px 14px',
    borderRadius: 11,
    background: C.redTint,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#FECACA',
    color: C.red,
    fontSize: 12.5,
    fontFamily: F.body,
    fontWeight: 600,
  },
  btnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    boxShadow: 'none',
    transform: 'none',
  },
  spinner: {
    width: 13,
    height: 13,
    borderRadius: '50%',
    borderStyle: 'solid',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    animation: 'ivSpin 0.7s linear infinite',
    display: 'inline-block',
    flexShrink: 0,
  },
  footnote: {
    padding: '12px 22px 18px',
    color: C.faint,
    fontFamily: F.body,
    fontSize: 11.5,
    letterSpacing: '0.1px',
    lineHeight: 1.7,
  },
  kbd: {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: 5,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.borderMd,
    borderBottomWidth: 2,
    background: C.cardAlt,
    color: C.sub,
    fontFamily: F.mono,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.4,
    verticalAlign: 'middle',
  },
  roomTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  roomActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  exitBtn: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    background: C.card,
    borderRadius: 9,
    padding: '7px 13px',
    color: C.sub,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: F.body,
    transition: 'border-color 0.15s ease, color 0.15s ease',
  },
  exitOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,22,40,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: 20,
  },
  exitModal: {
    width: '100%',
    maxWidth: 380,
    background: C.card,
    borderRadius: 20,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    boxShadow: '0 24px 60px rgba(10,22,40,0.28)',
    padding: '24px 24px 20px',
  },
  exitModalTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: C.text,
    fontFamily: F.display,
    marginBottom: 7,
    letterSpacing: '-0.2px',
  },
  exitModalBody: {
    fontSize: 13.5,
    color: C.sub,
    lineHeight: 1.6,
    marginBottom: 20,
    fontWeight: 500,
  },
  exitModalRow: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  exitModalCancel: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: C.border,
    background: C.card,
    borderRadius: 10,
    padding: '10px 18px',
    color: C.sub,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: F.body,
    transition: 'border-color 0.15s ease',
  },
  exitModalConfirm: {
    border: 'none',
    background: C.red,
    borderRadius: 10,
    padding: '10px 18px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: F.body,
    boxShadow: `0 4px 14px ${C.red}40`,
    transition: 'box-shadow 0.15s ease',
  },
  emptyWrap: {
    minHeight: '72vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontFamily: F.display,
    fontSize: 16,
    fontWeight: 700,
    color: C.text,
  },
  emptySub: {
    marginTop: 5,
    fontSize: 12.5,
    color: C.muted,
  },
};

export default Interview;