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
      deliveryTip: '',
      aiAvailable: false,
      fallback: true,
    };
  }
};

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

const buildFeedback = (data, parsed) => ({
  score:        Number(data?.score) || 0,
  correct:      data?.correct ?? null,
  timeTaken:    Number(data?.timeTaken) || 0,
  aiAvailable:  parsed.aiAvailable !== false,
  fallback:     parsed.fallback === true,
  good:         parsed.good         || '',
  missing:      parsed.missing      || '',
  idealHint:    parsed.idealHint    || '',
  tip:          parsed.tip          || '',
  sampleAnswer: parsed.sampleAnswer || '',
  deliveryTip:        parsed.deliveryTip        || null,
  // ── Voice delivery ────────────────────────────────────────────────────────
  toneAnalysis:       parsed.toneAnalysis       || null,
  vocabularyRichness: parsed.vocabularyRichness || null,
  hesitationPattern:  parsed.hesitationPattern  || null,
  // ── Enriched analysis ─────────────────────────────────────────────────────
  starBreakdown:      parsed.starBreakdown      || null,
  followUpQuestions:  Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
  keywordCoverage:    parsed.keywordCoverage    || null,
  confidenceScore:    parsed.confidenceScore    || null,
  complexityRating:   parsed.complexityRating   || null,
  // ── Raw ───────────────────────────────────────────────────────────────────
  raw:          data?.feedback      || '',
  voiceMetrics: data?.voiceMetrics  || null, // echoed back from server for FeedbackPanel
});

const getErrorMessage = (err, fallback = 'Something went wrong.') =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  fallback;

export const useInterview = ({ notify } = {}) => {
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

  const submitInFlightRef = useRef(false);
  const advanceLockRef    = useRef(false);

  const handleStart = useCallback(
    async (mode = 'quick', company = '', topic = '', difficulty = 'mixed', extra = {}) => {
      setIsLoading(true);
      setError('');
      notify_.loading('Generating your interview…');
      try {
        // extra carries the newer fields (topics array, role, experienceLevel)
        // as an options bag so existing 4-arg call sites keep working
        // unchanged, and startInterview forwards everything to the backend.
        const data = await startInterview({ mode, company, topic, difficulty, ...extra });
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
    []
  );

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
    []
  );

  const handleSubmit = useCallback(
    async (answer = '', answerIndex = null, timeTaken = 0, skipped = false, voiceMetrics = null) => {
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
          questionId:   question.id,
          answer:       answer || '',
          answerIndex:  answerIndex ?? null,
          timeTaken:    Number(timeTaken) || 0,
          skipped:      Boolean(skipped),
          voiceMetrics: voiceMetrics || null,
        });
        const parsed = parseFeedback(data?.feedback);
        setFeedback(buildFeedback(data, parsed));
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
    [sessionId, questions, currentIndex]
  );

  const handleSkip = useCallback(
    async timeTaken => {
      await handleSubmit('', null, Number(timeTaken) || 0, true);
      // Scroll is handled by the caller (Interview.jsx), which measures the
      // room header's live position — this hook has no layout/DOM context
      // of its own, so it shouldn't own a scroll target.
    },
    [handleSubmit]
  );

  const handleTimeUp = useCallback(
    async timeTaken => {
      if (submitInFlightRef.current || isSubmitted || isLoading) return;
      await handleSubmit(
        '',
        null,
        Number(timeTaken) || questions[currentIndex]?.timeLimit || 0,
        true
      );
    },
    [isSubmitted, isLoading, handleSubmit, questions, currentIndex]
  );

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
  }, [currentIndex, questions.length, sessionId, navigate, refreshUser]);

  const selectAnswer = useCallback(
    index => setSelectedAnswerIndex(index),
    []
  );

  const handleRetryQuestion = useCallback(
    async questionId => {
      if (!sessionId || !questionId) return null;
      setIsLoading(true);
      notify_.loading('Re-evaluating your answer…');
      try {
        const data   = await retryQuestionApi(sessionId, questionId);
        const parsed = parseFeedback(data?.feedback);
        const qualityUpdate = buildFeedback(data, parsed);
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
    [sessionId]
  );

  useEffect(() => {
    const handleUnload = () => {
      if (!sessionId || !sessionStarted) return;
      navigator.sendBeacon(`${API_BASE}/interview/${sessionId}/abandon`);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sessionId, sessionStarted]);

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