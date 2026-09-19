import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import API_BASE from '../config/api.js';
import useAuth from './useAuth.js';

import {
  startInterview,
  submitAnswer,
  completeInterview,
  getInterviewSession,
  abandonInterview,
  retryQuestion as retryQuestionApi,
} from '../Services/interviewService';

// ─── Pure helpers (no React, fully testable in isolation) ─────────────────

const parseFeedback = feedback => {
  if (!feedback) return {};
  if (typeof feedback === 'object') return feedback;
  try {
    return JSON.parse(feedback);
  } catch {
    return {
      good: '',
      missing: '',
      idealHint: '',
      tip: '',
      sampleAnswer: '',
      aiAvailable: false,
      fallback: true,
    };
  }
};

// Fills in safe defaults for every field a question object must have.
// Runs once on data received from the server so the rest of the hook
// can read q.timeLimit, q.options etc. without defensive checks everywhere.
const normalizeQuestion = question => ({
  id:         question?.id,
  text:       question?.text || 'Please answer the interview question.',
  topic:      question?.topic || 'General',
  difficulty: question?.difficulty || 'medium',
  timeLimit:
    Number(question?.timeLimit) > 0
      ? Number(question.timeLimit)
      : question?.questionType === 'aptitude'
        ? 60
        : question?.questionType === 'mcq'
          ? 45
          : 90,
  questionType:       question?.questionType || 'open',
  options:            Array.isArray(question?.options) ? question.options : [],
  correctAnswerIndex:
    question?.correctAnswerIndex !== undefined
      ? Number(question.correctAnswerIndex)
      : null,
  explanation:
    typeof question?.explanation === 'string'
      ? question.explanation.trim()
      : '',
});

// Shapes raw API response + parsed feedback into the feedback state object.
// Used by both handleSubmit (full shape) and handleRetryQuestion (spread update).
const buildFeedback = (data, parsed) => ({
  score:        Number(data?.score) || 0,
  correct:      data?.correct ?? null,
  aiAvailable:  parsed.aiAvailable !== false,
  fallback:     parsed.fallback === true,
  good:         parsed.good || '',
  missing:      parsed.missing || '',
  idealHint:    parsed.idealHint || '',
  tip:          parsed.tip || '',
  sampleAnswer: parsed.sampleAnswer || '',
  raw:          data?.feedback || '',
});

// Extracts the most useful error string from an Axios error or plain Error.
const getErrorMessage = (err, fallback = 'Something went wrong.') =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  fallback;

// ─── Hook ─────────────────────────────────────────────────────────────────

export const useInterview = ({ notify } = {}) => {
  // Silent no-op fallback so the hook works without a notify prop in tests
  // or Storybook. In production, Interview.jsx always passes notify.
  const notifyFallback = {
    loading: () => {},
    success: () => {},
    error:   () => {},
    info:    () => {},
    dismiss: () => {},
  };
  const notify_ = notify || notifyFallback;

  const navigate     = useNavigate();
  const { refreshUser } = useAuth();

  // ── Session state ──────────────────────────────────────────────────────
  const [sessionId,           setSessionId]           = useState(null);
  const [questions,           setQuestions]           = useState([]);
  const [currentIndex,        setCurrentIndex]        = useState(0);
  const [feedback,            setFeedback]            = useState(null);
  const [isSubmitted,         setIsSubmitted]         = useState(false);
  const [isLoading,           setIsLoading]           = useState(false);
  const [error,               setError]               = useState('');
  const [sessionStarted,      setSessionStarted]      = useState(false);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null);
  const [isAbandoning,        setIsAbandoning]        = useState(false);

  // WHY: Synchronous lock shared by every submit path — button, Enter, Skip,
  // and timer time-up. React state updates only commit on the next render,
  // so two callers firing in the same tick can both pass an isLoading/isSubmitted
  // check before either write lands. This ref is set the instant a submit starts
  // and cleared only in finally.
  const submitInFlightRef = useRef(false);

  // WHY: Same pattern for handleNext — guards against currentIndex being bumped
  // twice for one user action (double-click, effect re-fire), which used to
  // silently skip a question with no answer recorded.
  const advanceLockRef = useRef(false);

  // ── START ──────────────────────────────────────────────────────────────

  const handleStart = useCallback(
    async (mode = 'quick', company = '', topic = '', difficulty = 'mixed') => {
      setIsLoading(true);
      setError('');
      notify_.loading('Generating your interview…');
      try {
        const data = await startInterview({ mode, company, topic, difficulty });
        const normalized = Array.isArray(data?.questions)
          ? data.questions.map(normalizeQuestion)
          : [];
        if (!data?.sessionId)    throw new Error('The server did not return a session ID.');
        if (!normalized.length)  throw new Error('The server did not return any questions.');
        setSessionId(data.sessionId);
        setQuestions(normalized);
        setCurrentIndex(0);
        setFeedback(null);
        setSelectedAnswerIndex(null);
        setIsSubmitted(false);
        setSessionStarted(true);
        notify_.success('Interview ready — good luck!');
        return data;
      } catch (err) {
        const message = getErrorMessage(err, 'Unable to start the interview.');
        setError(message);
        notify_.error(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── DASHBOARD HYDRATION ────────────────────────────────────────────────
  // Restores a session that was created from the Dashboard quick-launch.
  // If questions are passed directly (fast path), skips the network fetch.

  const hydrateSession = useCallback(
    async (sessionId_, rawQuestions = []) => {
      setError('');
      try {
        if (sessionId_ && rawQuestions?.length) {
          setSessionId(sessionId_);
          setQuestions(rawQuestions.map(normalizeQuestion));
          setCurrentIndex(0);
          setFeedback(null);
          setSelectedAnswerIndex(null);
          setIsSubmitted(false);
          setSessionStarted(true);
          return;
        }
        if (!sessionId_) throw new Error('No interview session was provided.');
        const data       = await getInterviewSession(sessionId_);
        const normalized = Array.isArray(data?.questions)
          ? data.questions.map(normalizeQuestion)
          : [];
        setSessionId(sessionId_);
        setQuestions(normalized);
        setCurrentIndex(Number(data?.currentQuestion) || 0);
        setFeedback(null);
        setSelectedAnswerIndex(null);
        setIsSubmitted(false);
        setSessionStarted(true);
      } catch (err) {
        const message = getErrorMessage(err, 'Unable to restore this interview session.');
        setError(message);
        notify_.error(message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── SUBMIT CURRENT QUESTION ────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (answer = '', answerIndex = null, timeTaken = 0, skipped = false) => {
      if (!sessionId) { setError('Interview session is missing.'); return null; }
      const question = questions[currentIndex];
      if (!question)  { setError('Current question is missing.');  return null; }
      if (submitInFlightRef.current) return null;
      submitInFlightRef.current = true;
      setIsLoading(true);
      setError('');
      notify_.loading(skipped ? 'Saving…' : 'Evaluating your answer…');
      try {
        const data = await submitAnswer(sessionId, {
          questionId:  question.id,
          answer:      answer || '',
          answerIndex: answerIndex ?? null,
          timeTaken:   Number(timeTaken) || 0,
          skipped:     Boolean(skipped),
        });
        const parsed = parseFeedback(data?.feedback);
        setFeedback(buildFeedback(data, parsed));
        // WHY: correctAnswerIndex and explanation are deliberately withheld from
        // the initial question list (startInterview's publicQuestions) so the answer
        // cannot be read from the network tab before answering. The submit endpoint
        // sends them back only for the question just answered — patch that one entry.
        if (data?.correctAnswerIndex != null) {
          setQuestions(prev =>
            prev.map(q =>
              q.id === question.id
                ? {
                    ...q,
                    correctAnswerIndex: Number(data.correctAnswerIndex),
                    explanation:        data.explanation || q.explanation || '',
                  }
                : q
            )
          );
        }
        setIsSubmitted(true);
        notify_.dismiss();
        return data;
      } catch (err) {
        setIsSubmitted(false);
        const message = getErrorMessage(err, 'Unable to submit your answer.');
        setError(message);
        notify_.error(message);
        return null;
      } finally {
        setIsLoading(false);
        submitInFlightRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, questions, currentIndex]
  );

  // ── SKIP ───────────────────────────────────────────────────────────────

  const handleSkip = useCallback(
  async timeTaken => {
    await handleSubmit('', null, Number(timeTaken) || 0, true);
    window.scrollTo({ top: 183, behavior: 'smooth' });
  },
  [handleSubmit]
);
  // ── TIME UP ────────────────────────────────────────────────────────────

  const handleTimeUp = useCallback(
    async timeTaken => {
      if (isSubmitted || isLoading || submitInFlightRef.current) return;
      await handleSubmit(
        '',
        null,
        Number(timeTaken) || questions[currentIndex]?.timeLimit || 0,
        true
      );
    },
    [isSubmitted, isLoading, handleSubmit, questions, currentIndex]
  );

  // ── NEXT ───────────────────────────────────────────────────────────────

  const handleNext = useCallback(async () => {
    if (advanceLockRef.current) return null;
    advanceLockRef.current = true;
    setError('');

    const isLastQuestion = currentIndex >= questions.length - 1;

    if (isLastQuestion) {
      setIsLoading(true);
      notify_.loading('Preparing your final report…');
      try {
        const data = await completeInterview(sessionId);
        // Refresh auth so Navbar streak/score updates immediately without a page reload.
        refreshUser().catch(() => {});
        notify_.success('Interview completed!');
        navigate('/result', { state: { result: data } });
        return data;
      } catch (err) {
        const message = getErrorMessage(err, 'Unable to complete the interview.');
        setError(message);
        notify_.error(message);
        return null;
      } finally {
        setIsLoading(false);
        advanceLockRef.current = false;
      }
    }

    setCurrentIndex(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFeedback(null);
    setSelectedAnswerIndex(null);
    setIsSubmitted(false);
    advanceLockRef.current = false;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, questions.length, sessionId, navigate, refreshUser]);

  // ── SELECT MCQ OPTION ──────────────────────────────────────────────────

  const selectAnswer = useCallback(
    index => setSelectedAnswerIndex(index),
    []
  );

  // ── RETRY QUESTION ─────────────────────────────────────────────────────
  // Re-runs AI evaluation on an already-submitted open answer and merges the
  // fresh score/feedback into state without overwriting the correctness result.

  const handleRetryQuestion = useCallback(
    async questionId => {
      if (!sessionId || !questionId) return null;
      setIsLoading(true);
      notify_.loading('Re-evaluating your answer…');
      try {
        const data   = await retryQuestionApi(sessionId, questionId);
        const parsed = parseFeedback(data?.feedback);
        // WHY: Spread over prev so `correct` (set on first submit) is preserved —
        // retry re-evaluates open answer quality, not the correctness determination.
        const { correct: _correct, ...qualityUpdate } = buildFeedback(data, parsed);
        setFeedback(prev => ({ ...prev, ...qualityUpdate }));
        notify_.success('Re-evaluation complete!');
        return data;
      } catch (err) {
        const message = getErrorMessage(err, 'Unable to retry this question.');
        setError(message);
        notify_.error(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId]
  );

  // ── TAB-CLOSE ABANDON ──────────────────────────────────────────────────
  // WHY: sendBeacon fires on tab-close so the backend marks the session
  // abandoned even when the user never clicks Exit. sendBeacon cannot set
  // auth headers — the abandon route must accept the sessionId from the URL
  // without requiring authMiddleware.

  useEffect(() => {
    const handleUnload = () => {
      if (!sessionId || !sessionStarted) return;
      navigator.sendBeacon(`${API_BASE}/interview/${sessionId}/abandon`);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sessionId, sessionStarted]);

  // ── EXPLICIT ABANDON (Exit button) ────────────────────────────────────
  // WHY: Marks the session abandoned before navigating so it doesn't linger
  // as a stale in-progress row in History/Analytics/streak calculations.
  // Best-effort — a network failure never traps the user; we always navigate.

  const handleAbandon = useCallback(
    async (destination = '/dashboard') => {
      if (!sessionId || sessionStarted === false) {
        navigate(destination);
        return;
      }
      setIsAbandoning(true);
      try {
        await abandonInterview(sessionId);
      } catch (err) {
        notify_.error(getErrorMessage(err, 'Could not mark session as abandoned.'));
      } finally {
        setIsAbandoning(false);
        navigate(destination);
      }
    },
    [sessionId, sessionStarted, navigate, notify_]
  );

  // ── PUBLIC API ─────────────────────────────────────────────────────────

  return {
    sessionId,
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
    handleRetryQuestion,
  };
};

export default useInterview;