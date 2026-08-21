import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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

const parseFeedback = feedback => {
  if (!feedback) {
    return {};
  }

  if (typeof feedback === 'object') {
    return feedback;
  }

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

const normalizeQuestion = question => ({
  id: question?.id,
  text:
    question?.text ||
    'Please answer the interview question.',
  topic: question?.topic || 'General',
  difficulty: question?.difficulty || 'medium',
  timeLimit:
    Number(question?.timeLimit) > 0
      ? Number(question.timeLimit)
      : question?.questionType === 'aptitude'
        ? 60
        : question?.questionType === 'mcq'
          ? 45
          : 90,
  questionType:
    question?.questionType || 'open',
  options: Array.isArray(question?.options)
    ? question.options
    : [],
});

export const useInterview = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [sessionId, setSessionId] =
    useState(null);

  const [questions, setQuestions] =
    useState([]);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [feedback, setFeedback] =
    useState(null);

  const [isSubmitted, setIsSubmitted] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [sessionStarted, setSessionStarted] =
    useState(false);

  const [selectedAnswerIndex, setSelectedAnswerIndex] =
    useState(null);

  const [isAbandoning, setIsAbandoning] =
    useState(false);

  // Synchronous lock shared by EVERY path that can submit the current
  // question — the "Submit answer" button, Enter key, Skip, AND the
  // timer's time-up path. React state (isLoading/isSubmitted) only
  // updates on the next render, so two calls fired in the same tick
  // (e.g. user clicks Submit at the exact moment the timer hits zero)
  // can both slip past an isLoading/isSubmitted check before either
  // write commits. This ref can't be raced: it's set the instant a
  // submit starts and cleared only in handleSubmit's finally.
  const submitInFlightRef = useRef(false);

  const getErrorMessage = (
    err,
    fallback = 'Something went wrong.'
  ) => {
    return (
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      fallback
    );
  };

  // ─────────────────────────────────────────────────────────────
  // START
  // ─────────────────────────────────────────────────────────────

  const handleStart = useCallback(
    async (
      mode = 'quick',
      company = '',
      topic = '',
      difficulty = 'mixed'
    ) => {
      setIsLoading(true);
      setError('');

      const toastId =
        toast.loading(
          'Building your interview...'
        );

      try {
        const data =
          await startInterview({
            mode,
            company,
            topic,
            difficulty,
          });

        const normalized =
          Array.isArray(data?.questions)
            ? data.questions.map(
                normalizeQuestion
              )
            : [];

        if (!data?.sessionId) {
          throw new Error(
            'The server did not return a session ID.'
          );
        }

        if (!normalized.length) {
          throw new Error(
            'The server did not return any questions.'
          );
        }

        setSessionId(
          data.sessionId
        );

        setQuestions(normalized);
        setCurrentIndex(0);
        setFeedback(null);
        setSelectedAnswerIndex(null);
        setIsSubmitted(false);
        setSessionStarted(true);

        toast.dismiss(toastId);
        toast.success(
          'Interview ready!'
        );

        return data;
      } catch (err) {
        toast.dismiss(toastId);

        const message =
          getErrorMessage(
            err,
            'Unable to start the interview.'
          );

        setError(message);

        toast.error(message);

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ─────────────────────────────────────────────────────────────
  // DASHBOARD HYDRATION
  // ─────────────────────────────────────────────────────────────

  const hydrateSession = useCallback(
    async (sid, qs = []) => {
      setError('');

      try {
        if (sid && qs?.length) {
          setSessionId(sid);

          setQuestions(
            qs.map(normalizeQuestion)
          );

          setCurrentIndex(0);
          setFeedback(null);
          setSelectedAnswerIndex(null);
          setIsSubmitted(false);
          setSessionStarted(true);

          return;
        }

        if (!sid) {
          throw new Error(
            'No interview session was provided.'
          );
        }

        const data =
          await getInterviewSession(
            sid
          );

        const normalized =
          Array.isArray(data?.questions)
            ? data.questions.map(
                normalizeQuestion
              )
            : [];

        setSessionId(sid);
        setQuestions(normalized);

        setCurrentIndex(
          Number(data?.currentQuestion) || 0
        );

        setFeedback(null);
        setSelectedAnswerIndex(null);
        setIsSubmitted(false);
        setSessionStarted(true);
      } catch (err) {
        const message =
          getErrorMessage(
            err,
            'Unable to restore this interview session.'
          );

        setError(message);

        toast.error(message);
      }
    },
    []
  );

  // ─────────────────────────────────────────────────────────────
  // SUBMIT CURRENT QUESTION
  // ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (
      answer = '',
      answerIndex = null,
      timeTaken = 0,
      skipped = false
    ) => {
      if (!sessionId) {
        setError(
          'Interview session is missing.'
        );
        return null;
      }

      const question =
        questions[currentIndex];

      if (!question) {
        setError(
          'Current question is missing.'
        );
        return null;
      }

      // Hard, synchronous guard: only one submit can be in flight for the
      // current question no matter how many callers race to trigger one —
      // a manual click, Enter, and the timer's timeout path can all fire
      // within the same tick. Whichever gets here first wins; every other
      // caller (including the timer) is a no-op.
      if (submitInFlightRef.current) {
        return null;
      }
      submitInFlightRef.current = true;

      setIsLoading(true);
      setError('');

      const toastId =
        toast.loading(
          skipped
            ? 'Saving skipped question...'
            : question.questionType === 'open'
              ? 'Evaluating your answer...'
              : 'Checking your answer...'
        );

      try {
        const data =
          await submitAnswer(
            sessionId,
            {
              questionId:
                question.id,

              answer:
                answer || '',

              answerIndex:
                answerIndex === null ||
                answerIndex === undefined
                  ? null
                  : answerIndex,

              timeTaken:
                Number(timeTaken) || 0,

              skipped:
                Boolean(skipped),
            }
          );

        const parsedFeedback =
          parseFeedback(
            data?.feedback
          );

        setFeedback({
          score:
            Number(data?.score) || 0,

          correct:
            data?.correct ?? null,

          aiAvailable:
            parsedFeedback.aiAvailable !==
            false,

          fallback:
            parsedFeedback.fallback ===
            true,

          good:
            parsedFeedback.good ||
            '',

          missing:
            parsedFeedback.missing ||
            '',

          idealHint:
            parsedFeedback.idealHint ||
            '',

          tip:
            parsedFeedback.tip ||
            '',

          sampleAnswer:
            parsedFeedback.sampleAnswer ||
            '',

          raw:
            data?.feedback || '',
        });

        setIsSubmitted(true);

        toast.dismiss(toastId);

        const wasSkipped = Boolean(data?.skipped);

        if (wasSkipped) {
          // Skipped — neutral grey toast, not a red error
          toast('Question skipped.', { icon: '⏭️' });
        } else if (
          question.questionType !== 'open' &&
          data?.correct === true
        ) {
          toast.success('Correct answer!');
        } else if (
          question.questionType !== 'open' &&
          data?.correct === false
        ) {
          // Wrong MCQ/aptitude answer — red but honest message
          toast.error('Wrong answer.');
        } else if (
          parsedFeedback.aiAvailable === false
        ) {
          toast.error(
            'Answer saved. AI evaluation is temporarily unavailable.'
          );
        } else {
          toast.success('Feedback ready!');
        }

        return data;
      } catch (err) {
        toast.dismiss(toastId);

        setIsSubmitted(false);

        const message =
          getErrorMessage(
            err,
            'Unable to submit your answer.'
          );

        setError(message);

        toast.error(message);

        return null;
      } finally {
        setIsLoading(false);
        submitInFlightRef.current = false;
      }
    },
    [
      sessionId,
      questions,
      currentIndex,
    ]
  );

  // ─────────────────────────────────────────────────────────────
  // SKIP
  // ─────────────────────────────────────────────────────────────

  const handleSkip = useCallback(
    async timeTaken => {
      return handleSubmit(
        '',
        null,
        Number(timeTaken) || 0,
        true
      );
    },
    [handleSubmit]
  );

  // ─────────────────────────────────────────────────────────────
  // TIME UP
  // ─────────────────────────────────────────────────────────────

  const handleTimeUp =
    useCallback(
      async timeTaken => {
        if (
          isSubmitted ||
          isLoading ||
          submitInFlightRef.current
        ) {
          return;
        }

        await handleSubmit(
          '',
          null,
          Number(timeTaken) ||
            questions[currentIndex]
              ?.timeLimit ||
            0,
          true
        );
      },
      [
        isSubmitted,
        isLoading,
        handleSubmit,
        questions,
        currentIndex,
      ]
    );

  // ─────────────────────────────────────────────────────────────
  // NEXT
  // ─────────────────────────────────────────────────────────────

  const advanceLockRef = useRef(false);

  const handleNext =
    useCallback(async () => {
      // Guards against currentIndex being bumped twice for one user action
      // (e.g. a double Next click, or an effect re-firing) — which used to
      // silently skip over the next question with no answer recorded.
      if (advanceLockRef.current) return null;
      advanceLockRef.current = true;

      setError('');

      const isLast =
        currentIndex >=
        questions.length - 1;

      if (isLast) {
        setIsLoading(true);

        const toastId =
          toast.loading(
            'Preparing your final report...'
          );

        try {
          const data =
            await completeInterview(
              sessionId
            );

          // Refresh auth context so Navbar IRS/AVG update immediately
          refreshUser().catch(() => {});

          toast.dismiss(toastId);

          toast.success(
            'Interview completed!'
          );

          navigate('/result', {
            state: {
              result: data,
            },
          });

          return data;
        } catch (err) {
          toast.dismiss(toastId);

          const message =
            getErrorMessage(
              err,
              'Unable to complete the interview.'
            );

          setError(message);

          toast.error(message);

          return null;
        } finally {
          setIsLoading(false);
          advanceLockRef.current = false;
        }
      }

      setCurrentIndex(
        previous => previous + 1
      );

      setFeedback(null);
      setSelectedAnswerIndex(
        null
      );
      setIsSubmitted(false);
      advanceLockRef.current = false;
    }, [
      currentIndex,
      questions.length,
      sessionId,
      navigate,
    ]);

  const selectAnswer =
    useCallback(index => {
      setSelectedAnswerIndex(
        index
      );
    }, []);

  // ─────────────────────────────────────────────────────────────
  // RETRY QUESTION — re-runs AI evaluation on an already-submitted
  // open answer and merges the fresh score/feedback into state.
  // ─────────────────────────────────────────────────────────────

  const handleRetryQuestion = useCallback(
    async questionId => {
      if (!sessionId || !questionId) return null;

      setIsLoading(true);

      const toastId = toast.loading('Re-evaluating your answer...');

      try {
        const data = await retryQuestionApi(sessionId, questionId);

        const parsedFeedback = parseFeedback(data?.feedback);

        setFeedback(previous => ({
          ...previous,
          score: Number(data?.score) || 0,
          aiAvailable: parsedFeedback.aiAvailable !== false,
          fallback: parsedFeedback.fallback === true,
          good: parsedFeedback.good || '',
          missing: parsedFeedback.missing || '',
          idealHint: parsedFeedback.idealHint || '',
          tip: parsedFeedback.tip || '',
          sampleAnswer: parsedFeedback.sampleAnswer || '',
          raw: data?.feedback || '',
        }));

        toast.dismiss(toastId);
        toast.success('Re-evaluated!');

        return data;
      } catch (err) {
        toast.dismiss(toastId);

        const message = getErrorMessage(
          err,
          'Unable to retry this question.'
        );

        setError(message);
        toast.error(message);

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  // Tab-close / page-unload abandon — fires sendBeacon so the backend marks
  // the session abandoned even if the user closes the tab without clicking Exit.
  // sendBeacon can't set headers, so the token goes in the query string; the
  // auth middleware accepts ?token= specifically for this route.
   useEffect(() => {
    const handleUnload = () => {
      if (!sessionId || !sessionStarted) return;
      // sendBeacon can't send cookies or headers, so we can't auth this call.
      // The abandon route on the server must NOT use authMiddleware —
      // it should only use sessionId from the URL to mark the session abandoned.
      const url = `${API_BASE}/interview/${sessionId}/abandon`;
      navigator.sendBeacon(url);
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sessionId, sessionStarted]);

  // Marks the in-progress session as abandoned on the backend before
  // navigating away, so it doesn't linger as a stale "in-progress" row
  // that pollutes History/Analytics/streak calculations. Best-effort:
  // if there's no active session, or the call fails, the caller still
  // navigates — we never trap the user on this screen because a
  // network call failed.
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
        // Non-fatal — the exit shouldn't be blocked by this.
        console.error('Abandon interview failed:', err);
      } finally {
        setIsAbandoning(false);
        navigate(destination);
      }
    },
    [sessionId, sessionStarted, navigate]
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