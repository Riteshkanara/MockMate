import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import API_BASE from '../config/api.js';
import useAuth from './useAuth.js';

import {
  startInterview,
  submitAnswer,
  completeInterview,
  getInterviewSession,
  getQuestionFeedback,
  abandonInterview,
  retryQuestion as retryQuestionApi,
} from '../Services/interviewService';

// ─── Pure helpers (no React, fully testable in isolation) ─────────────────

// Shown the instant an open question is skipped. Identical to the placeholder
// the server stores, so the UI never has to wait for the network round-trip.
const SKIP_PLACEHOLDER = {
  good: '',
  missing: 'Question skipped — no answer submitted.',
  idealHint: 'Loading a model answer…',
  tip: '',
  sampleAnswer: '',
  aiAvailable: true,
  fallback: false,
  skippedPending: true,
};

// A cancelled request (the "Stop" button) is a deliberate action, not an error.
const isCanceled = err =>
  err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError';

const isObjectiveQuestion = q => ['mcq', 'aptitude'].includes(q?.questionType);

// Polling limits. The server self-heals stuck jobs after 90 s, so these are
// upper bounds that only matter if the server is unreachable.
const QUESTIONS_POLL_MAX_MS = 100000;
const ENRICH_POLL_MAX_MS    = 60000;
// Progressive back-off: quick at first (usually ready within a few seconds),
// then gentler so a slow generation doesn't flood the API.
const pollDelay = (attempt, base, step, max) => Math.min(base + attempt * step, max);

// The fields that arrive later from the background analysis. Only these are
// merged in, so the score / verdict the student already saw never changes.
const ENRICHED_KEYS = [
  'sampleAnswer', 'deliveryTip', 'toneAnalysis', 'vocabularyRichness',
  'hesitationPattern', 'starBreakdown', 'followUpQuestions',
  'keywordCoverage', 'confidenceScore',
];

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
  // The server stores timeTaken inside the feedback JSON, not at the top level.
  timeTaken:    Number(data?.timeTaken) || Number(parsed.timeTaken) || 0,
  // True for skipped open questions whose model answer is still being generated.
  skippedPending: parsed.skippedPending === true,
  aiAvailable:  parsed.aiAvailable !== false,
  fallback:     parsed.fallback === true,
  // 'basic' = free tier (Pro parts were removed by the server); locked = what exists but is held back
  tier:         parsed.tier || data?.feedbackTier || 'full',
  locked:       parsed.locked || null,
  // Real first line of the locked model answer / coaching (free tier only; set by the server)
  teasers:      parsed.teasers || null,
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
  // ── Background analysis state ─────────────────────────────────────────────
  enrichPending:      parsed.enrichPending === true || data?.enrichPending === true,
  enrichFailed:       parsed.enrichFailed === true,
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
  // True only while an OPEN answer is being scored (drives the Stop button).
  const [isEvaluating,        setIsEvaluating]        = useState(false);
  // Long interviews start with the first few questions; the rest are generated
  // in the background. `expectedTotal` is the intended number of questions.
  const [questionsPending,    setQuestionsPending]    = useState(false);
  const [expectedTotal,       setExpectedTotal]       = useState(0);
  // The student pressed "Next" on the last AVAILABLE question while more are
  // still being generated — advance the moment the next one lands.
  const [waitingNext,         setWaitingNext]         = useState(false);

  const submitInFlightRef = useRef(false);
  const advanceLockRef    = useRef(false);
  const abortRef          = useRef(null);   // AbortController of the in-flight evaluation
  const pendingSkipRef    = useRef(null);   // promise of an optimistic skip still saving

  // Latest values for async callbacks that must not close over stale state.
  const latestRef = useRef({ questions: [], currentIndex: 0 });
  useEffect(() => { latestRef.current = { questions, currentIndex }; });
  // Mirrors `waitingNext` for the poller below, so it can speed up without
  // restarting (a restart would reset its back-off and time limit).
  const waitingRef = useRef(false);

  // While questions are still arriving, the visible total is the intended one.
  const totalQuestions = questionsPending
    ? Math.max(expectedTotal, questions.length)
    : questions.length;

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
        setExpectedTotal(Number(data.totalQuestions) || normalized.length);
        setQuestionsPending(data.questionsPending === true);
        setWaitingNext(false);
        setCurrentIndex(0);
        setFeedback(null);
        setSelectedAnswerIndex(null);
        setIsSubmitted(false);
        setSessionStarted(true);
        notify_.success('Interview ready — good luck!');
        return data;
      } catch (err) {
        // Plan walls (daily limit / Pro-only mode) are not errors: the page opens
        // the upgrade modal instead, so no red banner or toast here.
        const code = err?.response?.data?.error;
        if (err?.response?.status === 403 && (code === 'daily_limit_reached' || code === 'plan_required')) {
          notify_.dismiss();
          throw err;
        }
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
          setWaitingNext(false);
          setCurrentIndex(0);
          setFeedback(null);
          setSelectedAnswerIndex(null);
          setIsSubmitted(false);
          setSessionStarted(true);
          // The caller only handed us the questions it already had. If the
          // session is still generating more, learn that from the server (best
          // effort) so the rest are picked up too.
          getInterviewSession(sessionId_)
            .then(d => {
              if (d?.questionsPending === true) {
                setExpectedTotal(Number(d.totalQuestions) || rawQuestions.length);
                setQuestionsPending(true);
              }
            })
            .catch(() => {});
          return;
        }
        if (!sessionId_) throw new Error('No interview session was provided.');
        const data       = await getInterviewSession(sessionId_);
        const normalized = Array.isArray(data?.questions)
          ? data.questions.map(normalizeQuestion)
          : [];
        setSessionId(sessionId_);
        setQuestions(normalized);
        setExpectedTotal(Number(data?.totalQuestions) || normalized.length);
        setQuestionsPending(data?.questionsPending === true);
        setWaitingNext(false);
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
      setError('');

      const payload = {
        questionId:   question.id,
        answer:       answer || '',
        answerIndex:  answerIndex ?? null,
        timeTaken:    Number(timeTaken) || 0,
        skipped:      Boolean(skipped),
        voiceMetrics: voiceMetrics || null,
      };

      const controller = new AbortController();
      abortRef.current = controller;

      const stillOnThisQuestion = () => {
        const { questions: qs, currentIndex: idx } = latestRef.current;
        return qs[idx]?.id === question.id;
      };

      // ── Optimistic skip (open questions only) ─────────────────────────────
      // Skipping needs nothing from the model, so show the skipped state at
      // once and save in the background instead of waiting for the network.
      // (Objective questions still wait: they need the correct answer back.)
      if (skipped && !isObjectiveQuestion(question)) {
        setFeedback(buildFeedback({ score: 0 }, SKIP_PLACEHOLDER));
        setIsSubmitted(true);
        submitInFlightRef.current = false; // the UI has moved on; free the lock

        const saving = submitAnswer(sessionId, payload, { signal: controller.signal })
          .then(data => {
            if (stillOnThisQuestion()) setFeedback(buildFeedback(data, parseFeedback(data?.feedback)));
            return data;
          })
          .catch(err => {
            // Only undo the optimistic state if the student is still looking at
            // this question. If they already moved on, an unsaved skip simply
            // counts as an unanswered question (score 0) — the same result.
            if (stillOnThisQuestion()) {
              setIsSubmitted(false);
              setFeedback(null);
              const message = getErrorMessage(err, 'Unable to save your skip.');
              setError(message);
              notify_.error(message);
            } else {
              console.error('Skip could not be saved:', err);
            }
            return null;
          })
          .finally(() => {
            if (pendingSkipRef.current === saving) pendingSkipRef.current = null;
            if (abortRef.current === controller) abortRef.current = null;
          });
        pendingSkipRef.current = saving;
        return { success: true, skipped: true, optimistic: true };
      }

      // ── Normal path ───────────────────────────────────────────────────────
      setIsLoading(true);
      setIsEvaluating(!skipped && !isObjectiveQuestion(question));
      try {
        const data = await submitAnswer(sessionId, payload, { signal: controller.signal });
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
        return data;
      } catch (err) {
        setIsSubmitted(false);
        if (isCanceled(err)) {
          // The student pressed Stop: keep their answer, say so, no error state.
          notify_.info?.('Evaluation stopped — your answer is still here.');
          return null;
        }
        const message = getErrorMessage(err, 'Unable to submit your answer.');
        setError(message);
        notify_.error(message);
        return null;
      } finally {
        setIsLoading(false);
        setIsEvaluating(false);
        submitInFlightRef.current = false;
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [sessionId, questions, currentIndex]
  );

  // "Stop" while an answer is being evaluated: abort the request. The server
  // notices the closed connection and discards the evaluation, so the student
  // can edit and resubmit cleanly.
  const handleStopSubmit = useCallback(() => {
    abortRef.current?.abort();
  }, []);

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

  const advance = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFeedback(null);
    setSelectedAnswerIndex(null);
    setIsSubmitted(false);
    advanceLockRef.current = false;
    return null;
  }, []);

  const finish = useCallback(async () => {
    setIsLoading(true);
    notify_.loading('Preparing your final report…');
    try {
      // Let an optimistic skip finish saving first so it is recorded properly.
      if (pendingSkipRef.current) await pendingSkipRef.current;
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
  }, [sessionId, navigate, refreshUser]);

  const handleNext = useCallback(async () => {
    if (advanceLockRef.current) return null;
    setError('');

    if (currentIndex < questions.length - 1) {
      advanceLockRef.current = true;
      return advance();
    }
    // On the last question we HAVE — but more are still being generated:
    // wait for them instead of ending the interview early.
    if (questionsPending) {
      setWaitingNext(true);
      return null;
    }
    advanceLockRef.current = true;
    return finish();
  }, [currentIndex, questions.length, questionsPending, advance, finish]);

  useEffect(() => { waitingRef.current = waitingNext; }, [waitingNext]);

  // Resolves a "waiting for the next question" state as soon as either the
  // next question arrives (advance) or it becomes clear none are coming
  // (finish with the questions we have).
  useEffect(() => {
    if (!waitingNext || advanceLockRef.current) return;
    if (questions.length > currentIndex + 1) {
      setWaitingNext(false);
      advanceLockRef.current = true;
      advance();
    } else if (!questionsPending) {
      setWaitingNext(false);
      advanceLockRef.current = true;
      finish();
    }
  }, [waitingNext, questions.length, currentIndex, questionsPending, advance, finish]);

  // ── Poll: questions that are still being generated ────────────────────────
  // Runs only while the server says more questions are coming (typically the
  // first 3 arrive instantly and the rest land while the student answers).
  // Ends when the server reports it is done, or at the time limit.
  useEffect(() => {
    if (!sessionId || !questionsPending) return undefined;
    let stopped = false;
    let timer   = null;
    let attempt = 0;
    const startedAt = Date.now();

    const tick = async () => {
      if (stopped) return;
      try {
        const data = await getInterviewSession(sessionId);
        if (stopped) return;
        const incoming = Array.isArray(data?.questions) ? data.questions.map(normalizeQuestion) : [];
        setQuestions(prev => {
          const known = new Set(prev.map(q => q.id));
          const fresh = incoming.filter(q => !known.has(q.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        if (data?.questionsPending === false) { setQuestionsPending(false); return; }
      } catch {
        // transient network error — keep trying until the time limit
      }
      if (stopped) return;
      attempt += 1;
      if (Date.now() - startedAt > QUESTIONS_POLL_MAX_MS) { setQuestionsPending(false); return; }
      // While the student is actively waiting for the next question, check
      // quickly; otherwise back off gently.
      timer = setTimeout(tick, waitingRef.current ? 800 : pollDelay(attempt, 1200, 400, 3000));
    };

    timer = setTimeout(tick, 1200);
    return () => { stopped = true; clearTimeout(timer); };
  }, [sessionId, questionsPending]);

  // ── Poll: background analysis of the answer just submitted ────────────────
  // The verdict (score, good / missing / tip) is shown immediately; the model
  // answer, STAR, keywords, follow-ups and voice analysis fill in here. Keyed
  // on the question id, so moving on cancels it and a late reply can never
  // land on a different question.
  const enrichQuestionId = feedback?.enrichPending && isSubmitted ? questions[currentIndex]?.id : null;
  useEffect(() => {
    if (!sessionId || !enrichQuestionId) return undefined;
    let stopped = false;
    let timer   = null;
    let attempt = 0;
    const startedAt = Date.now();

    const tick = async () => {
      if (stopped) return;
      try {
        const data = await getQuestionFeedback(sessionId, enrichQuestionId);
        if (stopped) return;
        if (data && data.enrichPending === false) {
          const built = buildFeedback({ score: data.score }, parseFeedback(data.feedback));
          setFeedback(prev => {
            if (!prev?.enrichPending) return prev;
            const fields = {};
            ENRICHED_KEYS.forEach(k => { fields[k] = built[k]; });
            return { ...prev, ...fields, enrichPending: false, enrichFailed: built.enrichFailed };
          });
          return;
        }
      } catch {
        // transient network error — keep trying until the time limit
      }
      if (stopped) return;
      attempt += 1;
      if (Date.now() - startedAt > ENRICH_POLL_MAX_MS) {
        setFeedback(prev => (prev?.enrichPending ? { ...prev, enrichPending: false, enrichFailed: true } : prev));
        return;
      }
      timer = setTimeout(tick, pollDelay(attempt, 1200, 300, 2500));
    };

    timer = setTimeout(tick, 1200);
    return () => { stopped = true; clearTimeout(timer); };
  }, [sessionId, enrichQuestionId]);

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
    isEvaluating,
    totalQuestions,
    questionsPending,
    isWaitingForQuestions: waitingNext,
    handleStart,
    hydrateSession,
    handleSubmit,
    handleStopSubmit,
    handleSkip,
    handleTimeUp,
    handleNext,
    selectAnswer,
    handleAbandon,
    handleRetryQuestion,
  };
};

export default useInterview;