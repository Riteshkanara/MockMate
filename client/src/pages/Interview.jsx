import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { useInterview } from '../hooks/useInterview';
import { useVoiceAnswer } from '../hooks/useVoiceAnswer';   
import InterviewLoader from '../components/InterviewLoader';
import { C as CT, F } from '../styles/token';
import QuestionDisplay   from '../components/interview/QuestionDisplay';
import InterviewControls from '../components/interview/InterviewControls';
import { FeedbackPanel } from '../components/interview/FeedbackPanel';
import { getInterviewMeta } from '../Services/interviewService';
import useUsage from '../hooks/useUsage';
import useUpgrade from '../hooks/useUpgrade';
import ProBadge from '../components/pro/ProBadge';
import UsageMeter from '../components/pro/UsageMeter';
import DailyLimitCard from '../components/pro/DailyLimitCard';
import Icon from '../components/interview/icons';


const C = {
  ...CT,
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
};

// ─── Countdown beep (10s → 1s) ───────────────────────────────────────────
// Single shared AudioContext, created lazily on first beep and reused for
// the rest of the session, instead of one new context per tick (up to ~100
// per interview). Two mobile-specific problems this fixes:
//   1. iOS Safari can create an AudioContext in a 'suspended' state when
//      it's not opened directly inside a user-gesture handler (this one is
//      opened from a setInterval tick, not a tap) — without an explicit
//      resume() call the beep silently never plays, no error thrown.
//   2. Repeatedly creating + closing contexts is wasteful and can cause
//      audible glitches on some Android WebViews under rapid churn.
let sharedAudioCtx = null;
const getSharedAudioContext = () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
};

const playTimeWarningBeep = (secondsLeft = 10) => {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const fire = () => {
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
    };

    // Context can come back 'suspended' (iOS) or need a nudge after the
    // tab was backgrounded — resume() is a no-op if already running.
    if (ctx.state === 'suspended') {
      ctx.resume().then(fire).catch(() => { /* still silent-fail safe */ });
    } else {
      fire();
    }
  } catch {
    // Silently ignore — never surface audio errors to the user.
  }
};

// Height of the fixed top navbar plus a little air. Anything sticky or scrolled-to
// on this page has to clear it.
const NAV_OFFSET = 96;

// ─── Mode metadata ────────────────────────────────────────────────────────
// `count` and `perQ` mirror what the server generates (question count per mode
// and the per-question time limit) so the setup page can show honest numbers
// instead of a hardcoded guess.
const MODE_META = {
  quick:    { label: 'Quick mock',       group: 'interview', icon: 'bolt',      count: 5,  perQ: 120, kind: 'Written or spoken answers',   timeNote: '2 minutes per question',                blurb: 'Five interview questions. A good daily warm-up.',                       accent: C.blue500, soft: C.blue50     },
  full:     { label: 'Full mock',        group: 'interview', icon: 'target',    count: 10, perQ: 120, kind: 'Written or spoken answers',   timeNote: '2 minutes per question',                blurb: 'A full placement-style round with wider topic coverage.',               accent: C.green,   soft: C.greenTint  },
  company:  { label: 'Company specific', group: 'interview', icon: 'building',  count: 5,  perQ: 120, kind: 'Written or spoken answers',   timeNote: '2 minutes per question',                blurb: 'Questions shaped around how your target company interviews.',           accent: C.amber,   soft: C.amberTint  },
  topic:    { label: 'Topic focus',      group: 'interview', icon: 'book',      count: 5,  perQ: 120, kind: 'Written or spoken answers',   timeNote: '2 minutes per question',                blurb: 'Go deep on one or more subjects, such as DBMS or React.',               accent: C.cyan500, soft: C.cyanTint   },
  mcq:      { label: 'Technical MCQ',    group: 'test',      icon: 'listcheck', count: 5,  perQ: 45,  kind: 'Multiple choice',             timeNote: '45 seconds per question',               blurb: 'Placement-style multiple choice on core technical topics.',             accent: C.violet,  soft: C.violetTint },
  aptitude: { label: 'Aptitude',         group: 'test',      icon: 'calc',      count: 5,  perQ: 60,  kind: 'Reasoning',                   timeNote: '60 seconds per question',               blurb: 'Quantitative and logical reasoning problems.',                          accent: C.teal,    soft: C.tealTint   },
  mixed:    { label: 'Mixed assessment', group: 'test',      icon: 'shuffle',   count: 8,  perQ: 75,  kind: 'MCQ, aptitude and written',   timeNote: '45 seconds to 2 minutes per question',  blurb: 'Technical MCQs, aptitude and open questions in one session.',           accent: C.blue500, soft: C.blue50     },
};

const MODE_GROUPS = [
  { id: 'interview', title: 'Interview practice', hint: 'Open questions you answer by typing or speaking.' },
  { id: 'test',      title: 'Written test',       hint: 'Multiple choice and reasoning, marked instantly.' },
];

const DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   description: 'Build confidence',   accent: C.green   },
  { value: 'medium', label: 'Medium', description: 'Placement standard', accent: C.blue500 },
  { value: 'hard',   label: 'Hard',   description: 'High-pressure prep', accent: C.red     },
  { value: 'mixed',  label: 'Mixed',  description: 'A blend of levels',  accent: C.violet  },
];

// Quick-pick companies shown as chips — the AI prompt has real interview-
// format knowledge for these (rounds, technical focus). Any company can
// still be typed in freely; the backend infers a reasonable profile for
// names outside this list. Kept as a fallback default in case /interview/meta
// hasn't loaded yet — the live list from the server is preferred when available.
const FALLBACK_COMPANIES = ['TCS', 'Infosys', 'Wipro', 'Accenture', 'Cognizant', 'Capgemini', 'Zoho', 'Razorpay', 'Flipkart', 'Amazon', 'Google', 'Microsoft'];

// Grouped topics with multi-select support — mirrors server/data/topicGroups.js.
// Used as a fallback default; the live grouping from /interview/meta is
// preferred so adding a topic server-side doesn't require a client redeploy.
const FALLBACK_TOPIC_GROUPS = [
  { id: 'cs-fundamentals', label: 'CS Fundamentals', topics: ['DSA', 'OOP', 'DBMS', 'Operating Systems', 'Computer Networks'] },
  { id: 'web-dev',         label: 'Web Development',  topics: ['JavaScript', 'React', 'Node.js', 'REST APIs', 'System Design'] },
  { id: 'behavioral',      label: 'Behavioral & HR',  topics: ['HR', 'Behavioral (STAR format)', 'Resume Deep-Dive'] },
  { id: 'data-ml',         label: 'Data & ML',        topics: ['SQL', 'Statistics & Probability', 'Machine Learning Basics'] },
];

const FALLBACK_ROLES = [
  { value: 'sde',       label: 'SDE / Generalist' },
  { value: 'frontend',  label: 'Frontend Developer' },
  { value: 'backend',   label: 'Backend Developer' },
  { value: 'fullstack', label: 'Full-Stack Developer' },
  { value: 'data',      label: 'Data / ML' },
  { value: 'devops',    label: 'DevOps / SRE' },
  { value: 'qa',        label: 'QA / SDET' },
];

const FALLBACK_EXPERIENCE_LEVELS = [
  { value: 'fresher', label: 'Fresher (0 YOE)' },
  { value: 'intern',  label: 'Internship-level' },
  { value: 'junior',  label: '0-2 years experience' },
  { value: 'mid',     label: '2-5 years experience' },
];

const TIME_LIMITS = { mcq: 45, aptitude: 60, open: 120 }; // open = 120s, matching the server default

// Fallback only: the live values come from GET /interview/usage (server-authoritative).
const MODE_QUESTION_COUNT  = { quick: 5, mcq: 8, aptitude: 8, mixed: 10, full: 10, company: 10, topic: 10 };
const getQuestionCount     = (mode) => MODE_QUESTION_COUNT[mode] ?? 5;

const FALLBACK_TIME_LIMIT  = 120;
const MIN_ANSWER_WORDS     = 8;

// Coarse pointer + touch points is a more reliable "is this a phone/tablet"
// signal than user-agent sniffing, and matches what actually determines
// whether a hardware Enter key exists to press. Computed once at module
// load — device input type doesn't change mid-session.
const isTouchDevice =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));

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

const NotifBar = ({ notif = null }) => {
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
    isLoading, isWaitingForQuestions, totalQuestions,
    error, sessionStarted, selectedAnswerIndex, isAbandoning,
    handleStart, hydrateSession, handleSubmit, handleStopSubmit, handleSkip, handleRetryQuestion,
    handleTimeUp, handleNext, selectAnswer, handleAbandon,
  } = useInterview({ notify });

  // The hook has no separate evaluating flag: while a submit is in flight and
  // no feedback has arrived yet, the answer is being evaluated.
  const isEvaluatingAnswer = isLoading && !isSubmitted;

  // ── Plan awareness ────────────────────────────────────────────────────
  // usage === null until the server answers; we don't show locks before we know
  // (the server enforces the real rules either way).
  const { usage, refresh: refreshUsage } = useUsage();
  const { openUpgrade } = useUpgrade();

  // 'open' | 'trial' | 'locked'
  const getModeAccess = (value) => {
    if (!usage) return 'open';
    if (usage.allowedModes.includes(value)) return 'open';
    if (usage.trialModes.includes(value)) return 'trial';
    return 'locked';
  };

  const [showExitConfirm,    setShowExitConfirm]    = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(
    { easy: 'easy', medium: 'mixed', hard: 'hard' }[user?.difficultyPref] ?? 'mixed'
  );
  const [selectedMode,    setSelectedMode]    = useState(
    location.state?.mode ||
    { frontend: 'topic', backend: 'topic', data: 'topic' }[user?.targetRole] ||
    'quick'
  );
  const [company, setCompany] = useState(location.state?.company || '');
  const [selectedTopics,  setSelectedTopics]  = useState(
    location.state?.topic ? [location.state.topic] : []
  );
  const [selectedRole, setSelectedRole] = useState(
    location.state?.role || user?.targetRole || 'sde'
  );
  const [selectedExperience, setSelectedExperience] = useState(
    location.state?.experienceLevel ||
    { '<1': 'fresher', '1-2': 'intern', '2-3': 'junior', '3+': 'mid' }[user?.codingExperience] ||
    'fresher'
  );
  const [interviewMeta,   setInterviewMeta]   = useState(null); // fetched /interview/meta, falls back to local constants below
  const [textAnswer,      setTextAnswer]       = useState('');
  const [secondsLeft,     setSecondsLeft]      = useState(90);
  const [timerActive,     setTimerActive]      = useState(false);
  const [mounted,         setMounted]          = useState(false);
  const [questionKey,     setQuestionKey]      = useState(0);
  const [isAdvancing,     setIsAdvancing]      = useState(false);
  const [wasSkipped,      setWasSkipped]       = useState(false);
  const [shortSubmitPending, setShortSubmitPending] = useState(false);
  // Outcome of every answered question this session, by index. Drives the
  // coloured progress trail and the "vs earlier answers" comparison.
  const [results, setResults] = useState([]);
  const [answerSeconds, setAnswerSeconds] = useState(0); // real time the user took on the current question

  const textAnswerRef   = useRef('');
  const answerIndexRef  = useRef(null);
  const textAreaRef     = useRef(null);
  const submitLockRef   = useRef(false);
  const transitionRef   = useRef(false);
  const mountedRef      = useRef(true);
  const beepedTicksRef  = useRef(new Set());
  const submitTimeRef   = useRef(0);
  const secondsLeftRef  = useRef(90);
  // Anchor for the question-change scroll — measured live instead of a
  // hardcoded pixel offset, since the console card's position/height
  // differs between the desktop sticky layout and the mobile stacked one
  // (it drops position:sticky below 480px — see GlobalStyles).
  const roomTopRef      = useRef(null);

  // Shared scroll-to-room-header helper — used both on question change and
  // after skip (skip reveals feedback for the *same* question, so it isn't
  // covered by the question-change effect below). Previously this same
  // scroll lived twice: once here with a hardcoded 183px, and again as a
  // second hardcoded 183px inside useInterview.js's handleSkip. Centralizing
  // it here means there's one measurement, correct on both call sites and
  // on any screen size.
  const scrollToRoomTop = useCallback(() => {
    const node = roomTopRef.current;
    if (node) {
      const targetTop = window.scrollY + node.getBoundingClientRect().top - NAV_OFFSET;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const currentQuestion   = questions?.[currentIndex];
  const isObjective       = currentQuestion && ['mcq', 'aptitude'].includes(currentQuestion.questionType);

  // ── NEW: Voice answer hook ─────────────────────────────────────────────
  // Scoped to open questions only. The hook auto-resets when questionId changes.
  const handleVoiceTranscript = useCallback((text) => {
    setTextAnswer(text);
    textAnswerRef.current = text;
    if (shortSubmitPending) setShortSubmitPending(false);
  }, [shortSubmitPending]);

  const {
  isRecording,
  isTranscribing,
  isSupported:  isVoiceSupported,
  unsupportedReason:  voiceUnsupportedReason,
  voiceMetrics,
  voiceError,
  isSilent: isVoiceSilent,
  startRecording: handleMicStart,
  stopRecording:  handleMicStop,
  clearVoiceData,
  dismissVoiceError,
} = useVoiceAnswer({
    onTranscriptChange: handleVoiceTranscript,
    topic:        currentQuestion?.topic        || '',
    questionType: currentQuestion?.questionType || 'open',
    questionId:   currentQuestion?.id           || '',
  });

  // Keep a stable ref to voiceMetrics so the timer closure can read it
  const voiceMetricsRef = useRef(null);
  useEffect(() => { voiceMetricsRef.current = voiceMetrics; }, [voiceMetrics]);

  // Same pattern for handleMicStop — the timer's setInterval closure below
  // is only rebuilt on [sessionStarted, currentQuestion?.id], so it needs a
  // stable way to reach the *current* stop function rather than capturing
  // whichever one existed when the interval was created.
  const handleMicStopRef = useRef(handleMicStop);
  useEffect(() => { handleMicStopRef.current = handleMicStop; }, [handleMicStop]);
  // ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Tear down the shared beep AudioContext when leaving the interview
      // page entirely — it's reused across questions within one session
      // (see playTimeWarningBeep above) but shouldn't outlive the page.
      if (sharedAudioCtx && sharedAudioCtx.state !== 'closed') {
        sharedAudioCtx.close?.().catch(() => {});
        sharedAudioCtx = null;
      }
    };
  }, []);

  // Load company/topic/role config from the server so this picker never
  // drifts out of sync with what the AI prompt actually knows how to use —
  // falls back to the local FALLBACK_* constants above if the request fails
  // (e.g. offline, or a fresh env where the server isn't reachable yet), so
  // the setup page always works even without this succeeding.
  useEffect(() => {
    let cancelled = false;
    getInterviewMeta()
      .then((data) => { if (!cancelled) setInterviewMeta(data); })
      .catch(() => { /* keep using fallback constants — non-fatal */ });
    return () => { cancelled = true; };
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

  const mode              = MODE_META[selectedMode] || MODE_META.quick;
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
      setCompany(incoming.company || '');
      setSelectedTopics(incoming.topic ? [incoming.topic] : (incoming.topics || []));
      if (incoming.role) setSelectedRole(incoming.role);
      if (incoming.experienceLevel) setSelectedExperience(incoming.experienceLevel);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, hydrateSession, navigate]);

  useEffect(() => {
    if (!isSubmitted) return;
    submitTimeRef.current = Date.now();
    const limit = Number(currentQuestion?.timeLimit) || 0;
    setAnswerSeconds(Math.max(0, Math.min(limit, limit - secondsLeftRef.current)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitted]);

  useEffect(() => {
    if (!isSubmitted || !feedback) return;
    setResults((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        score:       Number(feedback.score) || 0,
        correct:     feedback.correct,
        skipped:     wasSkipped,
        objective:   isObjective,
        aiAvailable: feedback.aiAvailable !== false,
      };
      return next;
    });
  }, [isSubmitted, feedback, currentIndex, wasSkipped, isObjective]);

  // Scores of the written answers before this one (skips and failed
  // evaluations excluded) — the feedback card compares against their average.
  const previousOpenScores = useMemo(
    () => results
      .slice(0, currentIndex)
      .filter((r) => r && !r.objective && !r.skipped && r.aiAvailable)
      .map((r) => r.score),
    [results, currentIndex]
  );

  useEffect(() => {
    if (sessionStarted) scrollToRoomTop();
    setTextAnswer('');
    textAnswerRef.current  = '';
    answerIndexRef.current = null;
    setQuestionKey((k) => k + 1);
    setWasSkipped(false);
    setShortSubmitPending(false);
    beepedTicksRef.current = new Set();
    submitLockRef.current  = false;
    setTimerActive(false);
    clearVoiceData(); // NEW — reset voice state when question changes

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, currentQuestion?.timeLimit]);

  useEffect(() => {
    // Desktop-only: auto-focusing the textarea is a nice convenience when
    // there's a hardware keyboard, since it doesn't cover anything. On
    // touch devices, focusing the textarea immediately pops the on-screen
    // keyboard up over the question the user hasn't read yet — so on mobile
    // we leave the answer box unfocused until the user deliberately taps
    // it, letting them read the question first.
    if (isTouchDevice) return undefined;
    if (!sessionStarted || !currentQuestion || isSubmitted || isObjective) return undefined;
    const id = setTimeout(() => textAreaRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [sessionStarted, currentQuestion?.id, isObjective, isSubmitted]);

  const timerActiveRef = useRef(false);
  const isSubmittedRef = useRef(false);

  useEffect(() => { timerActiveRef.current = timerActive; },  [timerActive]);
  useEffect(() => { isSubmittedRef.current = isSubmitted; }, [isSubmitted]);

  useEffect(() => {
    if (!sessionStarted || !currentQuestion) return undefined;

    const questionId  = currentQuestion.id;
    const timeLimit   = currentQuestion.timeLimit;

    const timerId = window.setInterval(() => {
      if (!timerActiveRef.current || isSubmittedRef.current) return;

      setSecondsLeft((prev) => {
        if (prev <= 0) return 0;

        if (prev <= 1) {
          window.clearInterval(timerId);
          if (!submitLockRef.current) {
            submitLockRef.current = true;
            const isObj = ['mcq', 'aptitude'].includes(currentQuestion?.questionType);
            if (isObj) {
              if (answerIndexRef.current !== null && answerIndexRef.current !== undefined) {
                // Pass null voiceMetrics for objective questions
                handleSubmit(null, answerIndexRef.current, timeLimit, false, null)
                  .finally(() => { if (mountedRef.current) submitLockRef.current = false; });
              } else {
                setWasSkipped(true);
                handleTimeUp(timeLimit)
                  .finally(() => { if (mountedRef.current) submitLockRef.current = false; });
              }
            } else if (textAnswerRef.current.trim()) {
              // Stop any in-progress voice recording before reading
              // metrics — without this, a user still talking when the
              // clock hits zero would submit with voiceMetrics stuck at
              // null (it's only ever populated inside stopRecording), and
              // the mic would keep listening into the next question's
              // transition. FIX: stopRecording() (handleMicStop) returns a
              // Promise, not the metrics synchronously — it must be awaited
              // before falling back to voiceMetricsRef.current. Since this
              // whole block runs inside the setSecondsLeft state updater
              // (which must stay synchronous), the await is done in a
              // separate async helper invoked here without blocking the
              // updater itself.
              (async () => {
                const freshVoiceMetrics = (await handleMicStopRef.current?.()) ?? voiceMetricsRef.current;
                return handleSubmit(textAnswerRef.current, null, timeLimit, false, freshVoiceMetrics);
              })().finally(() => { if (mountedRef.current) submitLockRef.current = false; });
            } else {
              setWasSkipped(true);
              handleTimeUp(timeLimit)
                .finally(() => { if (mountedRef.current) submitLockRef.current = false; });
            }
          }
          return 0;
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted, currentQuestion?.id]);

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

  const doSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitted || !currentQuestion) return;
    if (isShortAnswer && !shortSubmitPending) {
      setShortSubmitPending(true);
      return;
    }
    setShortSubmitPending(false);
    // Same fix as the timer-expiry path: the Submit button isn't disabled
    // while recording (the live transcript already satisfies canSubmit), so
    // a user can tap Submit mid-recording. Stop first and use the freshly
    // computed metrics rather than the (possibly still-null) voiceMetrics
    // state, which only updates after stopRecording runs.
    // FIX: handleMicStop (stopRecording) returns a Promise, not the metrics
    // synchronously — it must be awaited before falling back to voiceMetrics,
    // otherwise the truthy-but-unresolved Promise object itself was being
    // sent to the server as voiceMetrics.
    // Awaiting transcription opens a window in which a second tap (or the
    // timer expiring) could start another submit. Take the same lock the timer
    // path uses; otherwise the second call resolves handleMicStop() to null
    // immediately and can win handleSubmit's in-flight guard WITHOUT the voice
    // metrics, silently dropping them.
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      const freshVoiceMetrics = isObjective ? null : ((await handleMicStop()) ?? voiceMetrics);
      await handleSubmit(
        textAnswer,
        isObjective ? selectedAnswerIndex : null,
        currentQuestion.timeLimit - secondsLeftRef.current,
        false,
        freshVoiceMetrics,
      );
    } finally {
      if (mountedRef.current) submitLockRef.current = false;
    }
  }, [canSubmit, isSubmitted, handleSubmit, textAnswer, isObjective, selectedAnswerIndex, currentQuestion, isShortAnswer, shortSubmitPending, voiceMetrics, handleMicStop]);

  useEffect(() => {
  if (!sessionStarted) return undefined;

  const onPopState = () => {
    window.history.pushState(null, '', window.location.href); // push state back
    setShowExitConfirm(true);
  };

  window.history.pushState(null, '', window.location.href); // lock history
  window.addEventListener('popstate', onPopState);

  return () => window.removeEventListener('popstate', onPopState);
}, [sessionStarted]);

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
      // Mobile virtual keyboards mostly don't dispatch a real
      // key:'Enter' keydown for their "Go"/"Done"/"Return" key — Android's
      // IME reports key:'Unidentified' with keyCode 229 while composing, so
      // this shortcut is desktop-only in practice. That's fine (mobile users
      // tap Submit instead), but skip isComposing/229 explicitly so a stray
      // IME event can never be misread as a real Enter press mid-typing.
      if (e.isComposing || e.keyCode === 229) return;
      if (showExitConfirm) return;
      // Let Enter activate whatever button/link/select currently has focus
      // (Skip, Exit, Next…) instead of hijacking it as "submit answer".
      if (e.key === 'Enter' && e.target?.closest?.('button, a, select, [role="dialog"]')) return;
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
      if (!isSubmitted && isObjective && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // 1–4 and A–D both pick an option (the options are labelled A–D).
        const k   = e.key.toLowerCase();
        const idx = ['1', '2', '3', '4'].includes(k) ? Number(k) - 1
                  : ['a', 'b', 'c', 'd'].includes(k) ? k.charCodeAt(0) - 97
                  : -1;
        if (idx >= 0 && currentQuestion?.options?.[idx] !== undefined) {
          selectAnswer(idx);
          // Keep the ref in sync too — the timer-expiry path reads it, so a
          // keyboard-picked option is no longer lost when the clock hits zero.
          answerIndexRef.current = idx;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sessionStarted, isSubmitted, isObjective, canSubmit, currentQuestion, selectAnswer, showExitConfirm]);

  useEffect(() => {
  if (!sessionStarted) return undefined;

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && !showExitConfirm) {
      setShowExitConfirm(true);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const onBeforeUnload = (e) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}, [sessionStarted, showExitConfirm]);

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

  // A free user must never land on a Pro mode by default (e.g. the role-based default
  // 'topic') and burn their one-time trial on the first click of "Start".
  // Modes chosen deliberately (via navigation state) that turn out locked also fall back.
  const usageReady = !!usage;
  useEffect(() => {
    if (!usageReady) return;
    const explicit = location.state?.mode === selectedMode;
    const access = usage.allowedModes.includes(selectedMode) ? 'open'
      : usage.trialModes.includes(selectedMode) ? 'trial' : 'locked';
    if (access === 'locked' || (access === 'trial' && !explicit)) setSelectedMode('quick');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usageReady]);

  const serverCounts  = usage?.questionCounts;
  const countFor      = (value) => serverCounts?.[value] ?? getQuestionCount(value);
  const questionCount = countFor(selectedMode);

  const estimatedMinutes = useMemo(() => {
    const perQ = MODE_META[selectedMode]?.perQ ?? TIME_LIMITS.open;
    return Math.max(1, Math.round((perQ * questionCount) / 60));
  }, [selectedMode, questionCount]);

  const selectedAccess = getModeAccess(selectedMode);
  const daily          = usage?.daily;
  const limitReached   = !!daily && daily.limit !== null && daily.remaining === 0;

  // The effective company name for launch/preview — either a quick-pick
  // chip or the free-typed value, whichever mode is active.
  const effectiveCompany = company.trim();

  const canLaunch =
    !isLoading &&
    !(selectedMode === 'company' && !effectiveCompany) &&
    !(selectedMode === 'topic' && selectedTopics.length === 0) &&
    !!selectedRole && !!selectedExperience; // role + experience are required for every mode now

  const difficultyLabel = DIFFICULTIES.find((d) => d.value === selectedDifficulty)?.label ?? 'Mixed';

  // Tell the user *why* Start is disabled instead of greying it out silently.
  const launchBlocker =
    selectedMode === 'company' && !effectiveCompany ? 'Choose or type a company to continue.' :
    selectedMode === 'topic' && selectedTopics.length === 0 ? 'Pick at least one topic to continue.' :
    '';

  const companyChips    = interviewMeta?.companies    || FALLBACK_COMPANIES;
  const topicGroups     = interviewMeta?.topicGroups  || FALLBACK_TOPIC_GROUPS;
  const roleOptions     = interviewMeta?.roles            || FALLBACK_ROLES;
  const experienceOptions = interviewMeta?.experienceLevels || FALLBACK_EXPERIENCE_LEVELS;

  const toggleTopic = useCallback((t) => {
    setSelectedTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }, []);

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

  // Starting can fail (server asleep, network). handleStart already reports the
  // error through notify + `error`, so swallow the re-thrown rejection here to
  // avoid an unhandled-promise warning.
  // The server is the judge of plan rules: if it says "upgrade", open the modal;
  // any other failure was already surfaced by useInterview.
  const launch = async () => {
    if (!canLaunch) return;
    if (limitReached) { openUpgrade('dailyInterviewLimit', { resetsAt: daily?.resetsAt }); return; }
    try {
      await handleStart(selectedMode, effectiveCompany, selectedTopics[0] || '', selectedDifficulty, {
        topics: selectedTopics,
        role: selectedRole,
        experienceLevel: selectedExperience,
      });
      refreshUsage();
    } catch (err) {
      const d = err?.response?.data;
      if (err?.response?.status === 403 && d?.error === 'daily_limit_reached') {
        refreshUsage();
        openUpgrade('dailyInterviewLimit', { resetsAt: d.resetsAt });
      } else if (err?.response?.status === 403 && d?.error === 'plan_required') {
        refreshUsage();
        openUpgrade(d.feature, { trialUsed: d.trialUsed });
      }
    }
  };

  const roleLabel  = (roleOptions.find((r) => r.value === selectedRole) || {}).label || selectedRole;
  const levelLabel = (experienceOptions.find((x) => x.value === selectedExperience) || {}).label || selectedExperience;

  // ─────────────────────────────────────────────────────────────────────
  // SETUP SCREEN
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

    const fromProfile = Boolean(user?.targetRole) && selectedRole === user.targetRole;

    return (
      <div style={S.page} className="iv-page iv-page-setup">
        <GlobalStyles />

        <div style={{ ...S.container, maxWidth: 1120, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)' }}>
          <header style={S.setupHead}>
            <h1 style={S.setupTitle}>Set up your interview</h1>
            <p style={S.setupSub}>
              Pick a format and MockMate writes the questions for your role and level.
              Every answer is scored, with specific fixes and a model answer to compare against.
            </p>
          </header>

          <div style={S.setupGrid} className="iv-setup-grid">
            {/* ── Left: the choices ── */}
            <div style={S.builder}>
              <section style={S.card} aria-labelledby="sec-format">
                <h2 id="sec-format" style={S.secTitle}>Format</h2>
                {MODE_GROUPS.map((group) => (
                  <div key={group.id} style={S.modeGroup}>
                    <div style={S.modeGroupHead}>
                      <span style={S.modeGroupTitle}>{group.title}</span>
                      <span style={S.modeGroupHint}>{group.hint}</span>
                    </div>
                    <div style={S.modeGrid} className="iv-mode-grid" role="radiogroup" aria-label={group.title}>
                      {Object.entries(MODE_META).filter(([, m]) => m.group === group.id).map(([value, meta], idx, arr) => {
                        const selected = selectedMode === value;
                        const spanRow  = arr.length % 2 === 1 && idx === arr.length - 1;
                        const cardCount = countFor(value);
                        const mins = Math.max(1, Math.round((cardCount * meta.perQ) / 60));
                        const access = getModeAccess(value);   // 'open' | 'trial' | 'locked'
                        const locked = access === 'locked';
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={locked ? `${meta.label} (Pro). Opens upgrade options.` : undefined}
                            className="iv-mode-card"
                            style={{
                              ...S.modeCard,
                              ...(spanRow ? { gridColumn: '1 / -1', minHeight: 0 } : null),
                              ...(selected ? { borderColor: meta.accent, background: meta.soft, boxShadow: `0 0 0 3px ${meta.accent}22` } : null),
                            }}
                            onClick={() => {
                              // Locked modes never get selected: the click explains the mode and offers Pro.
                              if (locked) { openUpgrade(`mode_${value}`, { trialUsed: true }); return; }
                              setSelectedMode(value);
                            }}
                          >
                            <span style={S.modeTop} className="iv-mode-top">
                              <span className="iv-mode-icon" style={{ ...S.modeIcon, color: meta.accent, background: selected ? '#fff' : meta.soft }}>
                                <Icon name={meta.icon} size={20} />
                              </span>
                              {locked ? (
                                <span className="iv-mode-check" style={{ ...S.modeCheck, background: C.cardAlt, color: C.sub }} aria-hidden="true">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                                </span>
                              ) : (
                                <span className="iv-mode-check" style={{ ...S.modeCheck, ...(selected ? { background: meta.accent, borderColor: meta.accent, color: '#fff' } : null) }}>
                                  {selected && <Icon name="check" size={12} stroke={3} />}
                                </span>
                              )}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                              <strong style={S.modeLabel} className="iv-mode-label">{meta.label}</strong>
                              {access === 'trial'  && <ProBadge variant="trial" label="Try once free" />}
                              {access === 'locked' && <ProBadge variant="pro" />}
                            </span>
                            <span style={S.modeDesc} className="iv-mode-desc">{meta.blurb}</span>
                            <span style={S.modeFacts} className="iv-mode-facts">{cardCount} questions, up to {mins} min</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>

              <section style={S.card} aria-labelledby="sec-difficulty">
                <h2 id="sec-difficulty" style={S.secTitle}>Difficulty</h2>
                <div style={S.diffGrid} className="iv-diff-grid" role="radiogroup" aria-label="Difficulty">
                  {DIFFICULTIES.map((option) => {
                    const selected = selectedDifficulty === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className="iv-diff-card"
                        style={{ ...S.diffCard, ...(selected ? { borderColor: option.accent, background: C.cardAlt, boxShadow: `0 0 0 3px ${option.accent}20` } : null) }}
                        onClick={() => setSelectedDifficulty(option.value)}
                      >
                        <span style={{ ...S.diffDot, background: option.accent }} />
                        <span style={{ minWidth: 0 }}>
                          <strong style={S.diffLabel}>{option.label}</strong>
                          <span style={S.diffDesc}>{option.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {selectedMode === 'company' && (
                <section style={S.card} className="iv-fade-in" aria-labelledby="sec-company">
                  <h2 id="sec-company" style={S.secTitle}>Target company</h2>
                  <p style={S.secHint}>Not on the list? Type it. Questions follow the company&apos;s general hiring style.</p>
                  <input
                    type="text"
                    style={S.input}
                    className="iv-input"
                    placeholder="Type a company, or pick one below"
                    aria-label="Target company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    maxLength={80}
                  />
                  <div style={{ ...S.chipGrid, marginTop: 12 }}>
                    {companyChips.map((c) => {
                      const selected = company.trim().toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          type="button"
                          style={{ ...S.chip, ...(selected ? S.chipActive : null) }}
                          onClick={() => setCompany(c)}
                          aria-pressed={selected}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {selectedMode === 'topic' && (
                <section style={S.card} className="iv-fade-in" aria-labelledby="sec-topics">
                  <div style={S.secRow}>
                    <h2 id="sec-topics" style={{ ...S.secTitle, margin: 0 }}>Topics</h2>
                    <span style={S.secMeta}>{selectedTopics.length ? `${selectedTopics.length} selected` : 'None selected'}</span>
                  </div>
                  <p style={S.secHint}>Pick one or more. Questions blend across everything you choose.</p>
                  {topicGroups.map((group) => (
                    <div key={group.id} style={S.topicGroup}>
                      <div style={S.topicGroupLabel}>{group.label}</div>
                      <div style={S.chipGrid}>
                        {group.topics.map((t) => {
                          const selected = selectedTopics.includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              style={{ ...S.chip, ...(selected ? S.chipActive : null) }}
                              onClick={() => toggleTopic(t)}
                              aria-pressed={selected}
                            >
                              {selected && <Icon name="check" size={13} stroke={3} style={{ display: 'inline-block', marginRight: 5, verticalAlign: '-2px' }} />}
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              )}

              <section style={S.card} aria-labelledby="sec-profile">
                <h2 id="sec-profile" style={S.secTitle}>Your role and level</h2>
                <p style={S.secHint}>
                  This sets how deep the questions go, so a fresher gets fresher-level questions.
                  {fromProfile ? ' Filled in from your profile.' : ''}
                </p>
                <div style={S.roleExpRow} className="iv-role-exp-row">
                  <label style={S.field}>
                    <span style={S.fieldLabel}>Target role</span>
                    <select style={S.select} className="iv-input" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                      {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </label>
                  <label style={S.field}>
                    <span style={S.fieldLabel}>Experience</span>
                    <select style={S.select} className="iv-input" value={selectedExperience} onChange={(e) => setSelectedExperience(e.target.value)}>
                      {experienceOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                  </label>
                </div>
              </section>

              {error && (
                <div style={S.errorBanner} role="alert" className="iv-fade-in">
                  <Icon name="alert" size={16} />
                  <span><strong>Couldn&apos;t start the interview.</strong> {error}</span>
                </div>
              )}
            </div>

            {/* ── Right: live summary + Start ── */}
            <aside style={S.aside} className="iv-aside" aria-label="Your session">
              {limitReached && (
                <DailyLimitCard daily={daily} onUpgrade={() => openUpgrade('dailyInterviewLimit', { resetsAt: daily?.resetsAt })} />
              )}
              <SessionPanel
                mode={mode}
                count={questionCount}
                minutes={estimatedMinutes}
                difficulty={difficultyLabel}
                role={roleLabel}
                level={levelLabel}
                company={selectedMode === 'company' ? effectiveCompany : ''}
                topics={selectedMode === 'topic' ? selectedTopics : []}
                blocker={launchBlocker}
                canLaunch={canLaunch}
                onLaunch={launch}
                showKeys={!isTouchDevice}
                daily={daily}
                access={selectedAccess}
                limitReached={limitReached}
              />
            </aside>
          </div>
        </div>

        {/* Mobile / tablet: Start stays reachable without scrolling back up */}
        <div style={S.launchBar} className="iv-launch-bar">
          <div style={{ minWidth: 0 }}>
            <strong style={S.launchBarTitle}>{mode.label}</strong>
            <span style={{ ...S.launchBarSub, ...(launchBlocker ? { color: C.amber, fontWeight: 600 } : null) }}>
              {launchBlocker || `${questionCount} questions, up to ${estimatedMinutes} min`}
            </span>
          </div>
          <button type="button" style={{ ...S.launchBarBtn, ...(canLaunch ? null : S.btnDisabled) }} className="iv-btn-launch" disabled={!canLaunch} onClick={launch}>
            {limitReached ? 'Go Pro' : selectedAccess === 'trial' ? 'Try free' : 'Start'}
            <Icon name="arrow" size={16} stroke={2.4} />
          </button>
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
  const answeredCount = results.filter(Boolean).length;
  // The loading states are shown inline in the answer panel now, so the
  // notification bar only needs to carry results and errors.
  const roomNotif = notify.notif?.type === 'loading' ? null : notify.notif;

  return (
    <div style={S.page} className="iv-page">
      <GlobalStyles />

      <div style={{ ...S.container, maxWidth: 1140 }}>
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
                This session won&apos;t be scored. It&apos;s marked as abandoned and won&apos;t count toward your stats or streak.
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
                  {isAbandoning ? 'Leaving…' : 'Leave interview'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Sticky console: where you are, how long is left ── */}
        <div ref={roomTopRef} aria-hidden="true" />
        <section style={S.consoleCard} className="iv-console-card" aria-label="Interview progress">
          <NotifBar notif={roomNotif} />
          <div style={S.consoleTop}>
            <div style={S.consoleContext}>
              <div style={{ ...S.consoleModeIcon, background: mode.soft, color: mode.accent }} className="iv-console-mode-icon">
                <Icon name={mode.icon} size={19} />
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={S.consoleModeLabel}>Question {currentIndex + 1} of {totalQuestions}</strong>
                <span style={S.consoleModeSub}>
                  {mode.label}
                  {!isSubmitted && questionsLeft > 0 ? `, about ${sessionMinsLeft} min left` : ''}
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
              <button type="button" style={S.exitBtn} className="iv-exit-btn" onClick={() => setShowExitConfirm(true)}>
                Exit
              </button>
            </div>
          </div>

          <div
            style={S.segments}
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
            aria-valuenow={answeredCount}
          >
            {Array.from({ length: totalQuestions }).map((_, i) => {
              const r = results[i];
              const isCurrent = i === currentIndex;
              const settled = r && (i < currentIndex || (isCurrent && isSubmitted));
              let background = C.border;
              let label = `Question ${i + 1}, not answered yet`;
              if (settled) {
                background = resultColor(r);
                label = `Question ${i + 1}, ${resultLabel(r)}`;
              } else if (i < currentIndex) {
                background = C.borderStr;
                label = `Question ${i + 1}, answered`;
              } else if (isCurrent) {
                background = mode.accent;
                label = `Question ${i + 1}, current`;
              }
              return (
                <div
                  key={i}
                  title={label}
                  aria-label={label}
                  style={{ ...S.segment, background, boxShadow: isCurrent ? `0 0 0 2px ${C.card}, 0 0 0 3.5px ${settled ? background : mode.accent}` : 'none' }}
                />
              );
            })}
          </div>
        </section>

        {/* ── Question | answer (or feedback) ── */}
        <main style={S.roomGrid} className="iv-room-grid">
          <QuestionDisplay
            key={`q-${questionKey}`}
            currentQuestion={currentQuestion}
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
            currentDifficulty={currentDifficulty}
            isObjective={isObjective}
            isSubmitted={isSubmitted}
            mode={mode}
            showKeys={!isTouchDevice}
          />

          <section style={isSubmitted ? S.feedbackCol : S.answerPanel} className={isSubmitted ? 'iv-feedback-col' : 'iv-answer-panel'}>
            {!isSubmitted ? (
              <InterviewControls
                currentQuestion={currentQuestion}
                isObjective={isObjective}
                isTranscribing={isTranscribing}
                selectedAnswerIndex={selectedAnswerIndex}
                textAnswer={textAnswer}
                onTextChange={handleTextChange}
                onSelectAnswer={handleSelectAnswer}
                canSubmit={canSubmit}
                isLoading={isLoading}
                isEvaluating={isEvaluatingAnswer}
                onStopSubmit={handleStopSubmit}
                isLastQuestion={isLastQuestion}
                shortSubmitPending={shortSubmitPending}
                wordCount={wordCount}
                showKeys={!isTouchDevice}
                onSkip={() => {
                  setWasSkipped(true);
                  // Skip resolves instantly server-side (no AI call blocks the
                  // response), so this scroll fires right after the state update.
                  handleSkip(currentQuestion.timeLimit - secondsLeftRef.current)
                    .then(() => { if (mountedRef.current) scrollToRoomTop(); });
                }}
                onSubmit={doSubmit}
                textAreaRef={textAreaRef}
                mode={mode}
                isRecording={isRecording}
                isVoiceSupported={isVoiceSupported}
                voiceUnsupportedReason={voiceUnsupportedReason}
                voiceMetrics={voiceMetrics}
                voiceError={voiceError}
                isVoiceSilent={isVoiceSilent}
                onMicStart={handleMicStart}
                onMicStop={handleMicStop}
                onDismissVoiceError={dismissVoiceError}
              />
            ) : (
              <FeedbackPanel
                question={currentQuestion}
                feedback={feedback}
                userAnswer={isObjective ? '' : textAnswer}
                onNext={doAdvance}
                isLoading={isLoading || isAdvancing || isWaitingForQuestions}
                isLast={isLastQuestion}
                userAnswerIndex={selectedAnswerIndex}
                skipped={wasSkipped}
                questionIndex={currentIndex}
                totalQuestions={totalQuestions}
                timeLimit={currentQuestion.timeLimit}
                timeTaken={answerSeconds}
                previousScores={previousOpenScores}
                voiceMetrics={voiceMetrics || feedback?.voiceMetrics || null}
                onRetry={() => handleRetryQuestion(currentQuestion.id)}
                isRetrying={isLoading && !isAdvancing}
                showKeys={!isTouchDevice}
              />
            )}
          </section>
        </main>

        {error && (
          <div style={S.errorBanner} role="alert" className="iv-fade-in">
            <Icon name="alert" size={16} />
            <span><strong>Something went wrong.</strong> {error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// RESULT COLOURS (progress trail)
// ═══════════════════════════════════════════════════════════════════════════

const resultColor = (r) => {
  if (!r || r.skipped || r.aiAvailable === false) return C.faint;
  if (r.objective) return r.correct ? C.green : C.red;
  return r.score >= 70 ? C.green : r.score >= 40 ? C.amber : C.red;
};

const resultLabel = (r) => {
  if (!r) return 'not answered';
  if (r.skipped) return 'skipped';
  if (r.aiAvailable === false) return 'awaiting evaluation';
  if (r.objective) return r.correct ? 'correct' : 'incorrect';
  return `scored ${r.score} out of 100`;
};

// ═══════════════════════════════════════════════════════════════════════════
// SESSION PANEL — live summary of what will be generated, plus Start
// ═══════════════════════════════════════════════════════════════════════════

const SessionPanel = ({ mode, count, minutes, difficulty, role, level, company = '', topics = [], blocker = '', canLaunch, onLaunch, showKeys = true, daily = null, access = 'open', limitReached = false }) => {
  const isOpen = mode.group === 'interview' || mode.kind.includes('written');
  const rows = [
    ['Difficulty', difficulty],
    ['Role', role],
    ['Level', level],
    company ? ['Company', company] : null,
    topics.length ? ['Topics', topics.join(', ')] : null,
  ].filter(Boolean);

  const gets = isOpen
    ? ['A score out of 100 for each answer', 'Specific fixes and a model answer', 'A full report when you finish']
    : ['Instant marking with an explanation', 'A score and the correct answer for each', 'A full report when you finish'];

  return (
    <div style={S.panel}>
      <div style={S.panelKicker}>Your session</div>

      <div style={S.panelMode}>
        <span key={mode.label} style={S.panelModeIcon} className="iv-pop-in"><Icon name={mode.icon} size={22} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={S.panelModeLabel}>{mode.label}</div>
          <div style={S.panelModeKind}>{mode.kind}</div>
        </div>
      </div>

      <div style={S.panelStats}>
        <div>
          <div style={S.panelStatNum}>{count}</div>
          <div style={S.panelStatLabel}>questions</div>
        </div>
        <div>
          <div style={S.panelStatNum}>~{minutes}</div>
          <div style={S.panelStatLabel}>minutes at most</div>
        </div>
      </div>
      <div style={S.panelNote}>{mode.timeNote}</div>

      <dl style={S.panelList}>
        {rows.map(([k, v]) => (
          <div key={k} style={S.panelRow}>
            <dt style={S.panelRowKey}>{k}</dt>
            <dd style={S.panelRowVal} title={v}>{v}</dd>
          </div>
        ))}
      </dl>

      {daily && (
        <div style={{ marginBottom: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
          <UsageMeter daily={daily} tone="dark" />
        </div>
      )}

      <button
        type="button"
        style={{ ...S.panelBtn, ...(canLaunch ? null : S.panelBtnOff) }}
        className="iv-panel-btn"
        disabled={!canLaunch}
        onClick={onLaunch}
      >
        {limitReached ? 'Go unlimited with Pro' : access === 'trial' ? 'Start free trial' : 'Start interview'}
        <Icon name="arrow" size={18} stroke={2.4} />
      </button>
      <div style={{ ...S.panelFine, ...(blocker ? S.panelBlocker : null) }} role={blocker ? 'status' : undefined}>
        {blocker || (access === 'trial' ? 'One-time free trial of a Pro mode.' : 'The timer starts when the first question appears.')}
      </div>

      <ul style={S.panelGets}>
        {gets.map((g) => (
          <li key={g} style={S.panelGet}>
            <Icon name="check" size={14} stroke={2.6} style={{ marginTop: 3, color: C.cyan300 }} />
            <span>{g}</span>
          </li>
        ))}
      </ul>

      {showKeys && (
        <div style={S.panelKeys}>
          {isOpen
            ? <>In the room: <kbd style={S.kbd}>Enter</kbd> submits, <kbd style={S.kbd}>Shift</kbd>+<kbd style={S.kbd}>Enter</kbd> adds a line.</>
            : <>In the room: <kbd style={S.kbd}>1</kbd>–<kbd style={S.kbd}>4</kbd> or <kbd style={S.kbd}>A</kbd>–<kbd style={S.kbd}>D</kbd> picks, <kbd style={S.kbd}>Enter</kbd> submits.</>}
        </div>
      )}
    </div>
  );
};

SessionPanel.propTypes = {
  mode:      PropTypes.object.isRequired,
  count:     PropTypes.number.isRequired,
  minutes:   PropTypes.number.isRequired,
  difficulty: PropTypes.string.isRequired,
  role:      PropTypes.string.isRequired,
  level:     PropTypes.string.isRequired,
  company:   PropTypes.string,
  topics:    PropTypes.arrayOf(PropTypes.string),
  blocker:   PropTypes.string,
  canLaunch: PropTypes.bool.isRequired,
  onLaunch:  PropTypes.func.isRequired,
  showKeys:  PropTypes.bool,
  daily:     PropTypes.object,
  access:    PropTypes.oneOf(['open', 'trial', 'locked']),
  limitReached: PropTypes.bool,
};
// ═══════════════════════════════════════════════════════════════════════════
// TIMER RING
// ═══════════════════════════════════════════════════════════════════════════

const TimerRing = ({ seconds, percent, warning, critical, accent }) => {
  const size          = 56;
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
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
        />
      </svg>
      <div style={{ ...S.ringLabel, color, fontSize: critical ? 14.5 : 13.5, transition: 'color 0.4s ease' }}>
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
// GLOBAL STYLES (hover states, animation, responsive rules)
// ═══════════════════════════════════════════════════════════════════════════

const GlobalStyles = () => (
  <style>{`
    @keyframes ivSpin          { to { transform:rotate(360deg); } }
    @keyframes ivFadeIn        { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes ivSlideQuestion { from { opacity:0; transform:translateX(10px) translateY(4px); } to { opacity:1; transform:translateX(0) translateY(0); } }
    @keyframes ivPopIn         { 0% { opacity:0; transform:scale(0.85); } 100% { opacity:1; transform:scale(1); } }
    @keyframes ivBarGrow       { from { width:0%; } }
    @keyframes ivRingPulse     { 0%,100% { box-shadow:0 0 0 0 rgba(220,38,38,0.40); } 50% { box-shadow:0 0 0 7px rgba(220,38,38,0); } }
    @keyframes ivRingWarn      { 0%,100% { box-shadow:0 0 0 0 rgba(217,119,6,0.35); } 50% { box-shadow:0 0 0 6px rgba(217,119,6,0); } }
    @keyframes ivNotifIn       { from { opacity:0; transform:translateY(-6px) scaleY(0.92); } to { opacity:1; transform:translateY(0) scaleY(1); } }
    @keyframes ivNotifSpin     { to { transform:rotate(360deg); } }
    @keyframes ivShimmer       { 0% { background-position:-320px 0; } 100% { background-position:320px 0; } }

    *, *::before, *::after { box-sizing:border-box; }

    .iv-fade-in        { animation:ivFadeIn 0.32s cubic-bezier(.16,1,.3,1); }
    .iv-question-slide { animation:ivSlideQuestion 0.30s cubic-bezier(.16,1,.3,1); }
    .iv-pop-in         { animation:ivPopIn 0.28s cubic-bezier(.34,1.56,.64,1); }
    .iv-bar-grow       { animation:ivBarGrow 0.8s cubic-bezier(.16,1,.3,1); }
    .iv-ring-critical  { border-radius:50%; animation:ivRingPulse 1.0s ease-in-out infinite; }
    .iv-ring-warning   { border-radius:50%; animation:ivRingWarn  1.4s ease-in-out infinite; }
    .iv-notif-bar      { animation:ivNotifIn 0.22s cubic-bezier(.16,1,.3,1); transform-origin:top center; }
    .iv-notif-spinner  { display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:ivNotifSpin 0.7s linear infinite; opacity:0.8; }
    .iv-spin           { display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; animation:ivSpin 0.7s linear infinite; }
    .iv-spin-dark      { display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid ${C.borderMd}; border-top-color:${C.blue500}; animation:ivSpin 0.7s linear infinite; }
    .iv-skeleton       { background:linear-gradient(90deg, ${C.bgDeep} 25%, ${C.border} 50%, ${C.bgDeep} 75%); background-size:320px 100%; animation:ivShimmer 1.3s linear infinite; border-radius:8px; }

    .iv-page button { transition:transform 0.16s cubic-bezier(.16,1,.3,1), box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease, opacity 0.16s ease, color 0.16s ease; }
    .iv-page button:active:not(:disabled)  { transform:scale(0.98); }
    .iv-page button:disabled               { cursor:not-allowed; }
    .iv-page button:focus-visible,
    .iv-page textarea:focus-visible,
    .iv-page select:focus-visible,
    .iv-page input:focus-visible           { outline:2.5px solid ${C.blue500}; outline-offset:2px; }
    .iv-input:focus                        { border-color:${C.blue500} !important; box-shadow:0 0 0 3px rgba(26,110,255,0.12) !important; outline:none !important; }

    .iv-mode-card:hover  { border-color:${C.borderStr} !important; box-shadow:0 6px 20px rgba(26,110,255,0.10); }
    .iv-diff-card:hover  { border-color:${C.borderStr} !important; }
    .iv-exit-btn:hover   { background:${C.cardAlt} !important; border-color:${C.borderStr} !important; color:${C.red} !important; }
    .iv-panel-btn:hover:not(:disabled)  { transform:translateY(-1px); box-shadow:0 12px 30px rgba(0,20,80,0.35) !important; }
    .iv-btn-launch:hover:not(:disabled) { filter:brightness(1.06); }

    /* answer controls */
    .iv-opt:hover:not(.iv-opt-selected):not(.iv-opt-out) { border-color:${C.borderStr} !important; background:${C.cardAlt} !important; }
    .iv-opt-strike:hover                { background:${C.redTint} !important; color:${C.red} !important; }
    .iv-skip-btn:hover:not(:disabled)   { background:${C.cardAlt} !important; border-color:${C.borderMd} !important; color:${C.sub} !important; }
    .iv-submit-btn:hover:not(:disabled) { box-shadow:0 10px 26px rgba(26,110,255,0.38) !important; transform:translateY(-1px); }
    .iv-page textarea { transition:border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease; }
    .iv-page textarea:focus { border-color:${C.blue500}; box-shadow:0 0 0 3px rgba(26,110,255,0.10); outline:none; }

    /* feedback */
    .iv-next-btn:hover:not(:disabled)   { filter:brightness(1.06); transform:translateY(-1px); box-shadow:0 12px 28px rgba(26,110,255,0.34) !important; }
    .iv-acc-btn:hover                   { background:${C.cardAlt} !important; }

    @media (prefers-reduced-motion: reduce) { .iv-page * { animation:none !important; transition:none !important; } }

    .iv-launch-bar { display:none; }
    @media (min-width: 1021px) {
      .iv-question-panel { position:sticky; top:228px; }
      .iv-aside          { position:sticky; top:100px; }
    }
    @media (max-width: 1020px) {
      .iv-setup-grid  { grid-template-columns:1fr !important; }
      .iv-aside       { display:none !important; }
      .iv-launch-bar  { display:flex !important; }
      .iv-page-setup  { padding-bottom:104px !important; }
      .iv-room-grid   { grid-template-columns:1fr !important; }
    }
    @media (max-width: 760px) {
      .iv-mode-grid  { grid-template-columns:1fr !important; }
      /* compact horizontal mode rows so seven options don't need a mile of scrolling */
      .iv-mode-card  { display:grid !important; grid-template-columns:40px 1fr 22px; grid-template-rows:auto auto auto; column-gap:12px; align-items:center; min-height:0 !important; padding:12px 13px !important; }
      .iv-mode-top   { display:contents !important; }
      .iv-mode-icon  { grid-area:1 / 1 / 4 / 2; }
      .iv-mode-check { grid-area:1 / 3 / 4 / 4; }
      .iv-mode-label { grid-area:1 / 2; }
      .iv-mode-desc  { grid-area:2 / 2; margin-top:2px !important; }
      .iv-mode-facts { grid-area:3 / 2; padding-top:4px !important; margin-top:0 !important; }
      .iv-diff-grid  { grid-template-columns:repeat(2, 1fr) !important; }
    }
    @media (max-width: 620px) {
      .iv-role-exp-row { grid-template-columns:1fr !important; }
    }
    @media (max-width: 480px) {
      .iv-page             { padding:12px 10px 72px !important; }
      .iv-page-setup       { padding-bottom:110px !important; }
      .iv-card             { padding:16px 14px !important; }
      .iv-console-card     { padding:11px 13px !important; position:relative !important; top:unset !important; }
      .iv-console-mode-icon { width:32px !important; height:32px !important; }
      .iv-question-panel, .iv-answer-panel { padding:16px 14px !important; min-height:unset !important; border-radius:14px !important; }
      .iv-question-text    { font-size:18px !important; line-height:1.55 !important; }
      .iv-answer-actions   { flex-direction:column-reverse !important; }
      .iv-answer-actions button { width:100% !important; }
      .iv-exit-modal       { width:calc(100vw - 24px) !important; max-width:380px !important; max-height:calc(100dvh - 24px) !important; margin:0 !important; padding:20px 18px 18px !important; }
      .iv-opt-main         { min-height:56px !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const S = {
  page:      { minHeight:'100vh', background:C.bg, backgroundImage:`radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)`, padding:'24px 24px 64px', fontFamily:F.body },
  container: { margin:'0 auto', transition:'opacity 0.5s ease, transform 0.5s cubic-bezier(.16,1,.3,1)' },

  // setup
  setupHead:  { margin:'4px 0 22px', maxWidth:680 },
  setupTitle: { margin:0, fontFamily:F.display, fontSize:'clamp(26px, 3.4vw, 34px)', fontWeight:800, color:C.text, letterSpacing:'-0.7px', lineHeight:1.15 },
  setupSub:   { margin:'10px 0 0', fontSize:15, lineHeight:1.65, color:C.sub },
  setupGrid:  { display:'grid', gridTemplateColumns:'minmax(0,1fr) 340px', gap:20, alignItems:'start' },
  builder:    { display:'flex', flexDirection:'column', gap:14, minWidth:0 },
  card:       { background:C.card, border:`1px solid ${C.border}`, borderRadius:18, boxShadow:C.shadow, padding:'20px 22px' },
  secTitle:   { margin:'0 0 12px', fontFamily:F.display, fontSize:16, fontWeight:800, color:C.text, letterSpacing:'-0.2px' },
  secHint:    { margin:'-4px 0 14px', color:C.muted, fontSize:13.5, lineHeight:1.6 },
  secRow:     { display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10, marginBottom:12 },
  secMeta:    { color:C.muted, fontSize:13, fontWeight:600 },

  modeGroup:      { marginTop:6 },
  modeGroupHead:  { display:'flex', alignItems:'baseline', flexWrap:'wrap', gap:'2px 10px', margin:'14px 0 10px' },
  modeGroupTitle: { color:C.sub, fontSize:13.5, fontWeight:700 },
  modeGroupHint:  { color:C.muted, fontSize:13 },
  modeGrid:       { display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:10 },
  modeCard:       { display:'flex', flexDirection:'column', alignItems:'flex-start', textAlign:'left', gap:0, minHeight:150, borderStyle:'solid', borderWidth:1.5, borderColor:C.border, background:C.card, borderRadius:14, padding:'14px 15px', cursor:'pointer' },
  modeTop:        { display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', marginBottom:10 },
  modeIcon:       { width:40, height:40, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center' },
  modeCheck:      { width:22, height:22, borderRadius:'50%', borderStyle:'solid', borderWidth:1.5, borderColor:C.borderMd, display:'flex', alignItems:'center', justifyContent:'center', background:'#fff' },
  modeLabel:      { color:C.text, fontFamily:F.display, fontSize:15, fontWeight:800, lineHeight:1.25 },
  modeDesc:       { marginTop:4, color:C.sub, fontSize:13, lineHeight:1.5 },
  modeFacts:      { marginTop:'auto', paddingTop:10, color:C.muted, fontSize:12.5, fontWeight:600 },

  diffGrid: { display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:10 },
  diffCard: { display:'flex', alignItems:'center', gap:10, textAlign:'left', minHeight:60, borderStyle:'solid', borderWidth:1.5, borderColor:C.border, background:C.card, borderRadius:13, padding:'10px 13px', cursor:'pointer' },
  diffDot:  { width:10, height:10, borderRadius:'50%', flexShrink:0 },
  diffLabel:{ display:'block', color:C.text, fontFamily:F.display, fontSize:14, fontWeight:800, lineHeight:1.2 },
  diffDesc: { display:'block', marginTop:2, color:C.muted, fontSize:12.5, lineHeight:1.35 },

  input:    { width:'100%', height:48, border:`1.5px solid ${C.borderMd}`, borderRadius:11, background:C.cardAlt, padding:'0 14px', color:C.text, fontFamily:F.body, fontSize:14.5, outline:'none' },
  chipGrid: { display:'flex', flexWrap:'wrap', gap:8 },
  chip:     { borderStyle:'solid', borderWidth:1.5, borderColor:C.border, background:C.card, borderRadius:999, padding:'8px 15px', minHeight:38, color:C.sub, cursor:'pointer', fontFamily:F.body, fontSize:13.5, fontWeight:600 },
  chipActive: { borderColor:C.blue500, background:C.blue50, color:C.blue700, boxShadow:`0 0 0 3px ${C.blue500}18` },
  topicGroup:      { marginTop:14 },
  topicGroupLabel: { color:C.sub, fontSize:13, fontWeight:700, marginBottom:8 },

  roleExpRow: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  field:      { display:'flex', flexDirection:'column', gap:6 },
  fieldLabel: { color:C.sub, fontSize:13, fontWeight:700 },
  select:     { width:'100%', height:48, border:`1.5px solid ${C.borderMd}`, borderRadius:11, background:C.cardAlt, padding:'0 36px 0 14px', color:C.text, fontFamily:F.body, fontSize:14.5, outline:'none', appearance:'none', WebkitAppearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237C8CAD' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 14px center', cursor:'pointer' },

  errorBanner: { display:'flex', alignItems:'flex-start', gap:9, padding:'12px 15px', borderRadius:12, background:C.redTint, borderStyle:'solid', borderWidth:1, borderColor:'#FECACA', color:C.red, fontSize:13.5, lineHeight:1.5, marginTop:12 },

  // session panel
  aside:       { minWidth:0 },
  panel:       { position:'relative', overflow:'hidden', borderRadius:22, padding:'22px 22px 20px', color:'#fff', background:`linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 45%, ${C.blue600} 75%, ${C.cyan600} 100%)`, boxShadow:'0 20px 56px rgba(0,31,107,0.28)' },
  panelKicker: { fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.68)', marginBottom:14 },
  panelMode:   { display:'flex', alignItems:'center', gap:13 },
  panelModeIcon:  { width:48, height:48, borderRadius:14, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.14)', border:'1px solid rgba(255,255,255,0.18)' },
  panelModeLabel: { fontFamily:F.display, fontSize:21, fontWeight:800, letterSpacing:'-0.4px', lineHeight:1.15 },
  panelModeKind:  { marginTop:3, fontSize:13, color:'rgba(255,255,255,0.72)' },
  panelStats:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:20, paddingTop:18, borderTop:'1px solid rgba(255,255,255,0.14)' },
  panelStatNum:   { fontFamily:F.display, fontSize:30, fontWeight:800, letterSpacing:'-1px', lineHeight:1, fontVariantNumeric:'tabular-nums' },
  panelStatLabel: { marginTop:5, fontSize:13, color:'rgba(255,255,255,0.7)' },
  panelNote:      { marginTop:12, fontSize:13, color:'rgba(255,255,255,0.72)' },
  panelList:      { margin:'16px 0 0', padding:0 },
  panelRow:       { display:'flex', justifyContent:'space-between', gap:14, padding:'9px 0', borderTop:'1px solid rgba(255,255,255,0.12)' },
  panelRowKey:    { margin:0, color:'rgba(255,255,255,0.66)', fontSize:13.5, flexShrink:0 },
  panelRowVal:    { margin:0, color:'#fff', fontSize:13.5, fontWeight:600, textAlign:'right', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  panelBtn:       { marginTop:18, width:'100%', minHeight:54, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:9, border:'none', borderRadius:14, background:'#fff', color:C.blue800, fontFamily:F.display, fontSize:16, fontWeight:800, cursor:'pointer', boxShadow:'0 8px 22px rgba(0,20,80,0.28)' },
  panelBtnOff:    { opacity:0.55, cursor:'not-allowed', boxShadow:'none' },
  panelFine:      { marginTop:10, textAlign:'center', fontSize:13, color:'rgba(255,255,255,0.72)', lineHeight:1.5 },
  panelBlocker:   { color:'#FFE2A8', fontWeight:600 },
  panelGets:      { listStyle:'none', margin:'18px 0 0', padding:'16px 0 0', borderTop:'1px solid rgba(255,255,255,0.14)', display:'flex', flexDirection:'column', gap:8 },
  panelGet:       { display:'flex', gap:9, fontSize:13.5, lineHeight:1.5, color:'rgba(255,255,255,0.86)' },
  panelKeys:      { marginTop:16, fontSize:12.5, lineHeight:1.9, color:'rgba(255,255,255,0.62)' },
  kbd:            { display:'inline-block', padding:'1px 6px', borderRadius:5, borderStyle:'solid', borderWidth:1, borderColor:'rgba(255,255,255,0.3)', borderBottomWidth:2, background:'rgba(255,255,255,0.12)', color:'#fff', fontFamily:F.mono, fontSize:11, fontWeight:700, lineHeight:1.4 },
  btnDisabled:    { opacity:0.5, cursor:'not-allowed' },

  launchBar:      { position:'fixed', left:0, right:0, bottom:0, zIndex:20, alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', background:'rgba(255,255,255,0.94)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', borderTop:`1px solid ${C.border}`, boxShadow:'0 -8px 24px rgba(10,22,40,0.08)' },
  launchBarTitle: { display:'block', color:C.text, fontFamily:F.display, fontSize:14.5, fontWeight:800 },
  launchBarSub:   { display:'block', marginTop:2, color:C.muted, fontSize:12.5, lineHeight:1.35 },
  launchBarBtn:   { display:'inline-flex', alignItems:'center', gap:8, border:'none', borderRadius:13, padding:'0 22px', minHeight:50, color:'#fff', background:`linear-gradient(135deg, ${C.blue700}, ${C.blue500})`, boxShadow:'0 8px 22px rgba(26,110,255,0.30)', cursor:'pointer', fontFamily:F.display, fontSize:15, fontWeight:800, flexShrink:0 },

  // room
  exitBtn:          { borderStyle:'solid', borderWidth:1, borderColor:C.border, background:C.card, borderRadius:10, padding:'8px 14px', minHeight:38, color:C.sub, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:F.body },
  exitOverlay:      { position:'fixed', top:0, right:0, bottom:0, left:0, width:'100vw', height:'100dvh', minHeight:'100vh', background:'rgba(10,22,40,0.6)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px', overflowY:'auto', boxSizing:'border-box', overscrollBehavior:'contain' },
  exitModal:        { width:'min(400px, calc(100vw - 40px))', maxWidth:400, maxHeight:'calc(100dvh - 40px)', overflowY:'auto', background:C.card, borderRadius:20, borderStyle:'solid', borderWidth:1, borderColor:C.border, boxShadow:'0 24px 60px rgba(10,22,40,0.28)', padding:'24px 24px 20px', boxSizing:'border-box', flexShrink:0 },
  exitModalTitle:   { fontSize:18, fontWeight:800, color:C.text, fontFamily:F.display, marginBottom:8, letterSpacing:'-0.2px' },
  exitModalBody:    { fontSize:14, color:C.sub, lineHeight:1.6, marginBottom:20 },
  exitModalRow:     { display:'flex', gap:10, justifyContent:'flex-end' },
  exitModalCancel:  { borderStyle:'solid', borderWidth:1, borderColor:C.border, background:C.card, borderRadius:11, padding:'11px 18px', minHeight:44, color:C.sub, cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:F.body },
  exitModalConfirm: { border:'none', background:C.red, borderRadius:11, padding:'11px 18px', minHeight:44, color:'#fff', cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:F.body, boxShadow:`0 4px 14px ${C.red}40` },

  consoleCard:      { padding:'12px 16px 14px', borderStyle:'solid', borderWidth:1, borderColor:C.border, borderRadius:16, background:C.card, boxShadow:C.shadow, marginBottom:12, position:'sticky', top:80, zIndex:5 },
  consoleTop:       { display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 },
  consoleContext:   { display:'flex', alignItems:'center', gap:11, minWidth:0, flex:1 },
  consoleModeIcon:  { width:38, height:38, borderRadius:11, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' },
  consoleModeLabel: { display:'block', color:C.text, fontFamily:F.display, fontSize:15, fontWeight:800, letterSpacing:'-0.2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  consoleModeSub:   { display:'block', marginTop:2, color:C.muted, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  consoleRight:     { display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  segments:         { display:'flex', gap:5, marginTop:12 },
  segment:          { flex:1, height:6, borderRadius:999, transition:'background 0.35s ease, box-shadow 0.25s ease' },
  ringWrap:  { position:'relative', flexShrink:0, borderRadius:'50%' },
  ringLabel: { position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F.mono, fontWeight:700, pointerEvents:'none', letterSpacing:'-0.3px', fontVariantNumeric:'tabular-nums' },

  roomGrid:    { display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:14, alignItems:'start' },
  answerPanel: { padding:'20px 20px', borderStyle:'solid', borderWidth:1, borderColor:C.border, borderRadius:18, background:C.card, boxShadow:C.shadow, display:'flex', flexDirection:'column' },
  feedbackCol: { minWidth:0 },
};

export default Interview;
