import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  startInterview,
  submitAnswer,
  completeInterview,
}  from '../Services/interviewService';

import toast from 'react-hot-toast';

export const useInterview = () => {
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);

  const getErrorMessage = (err, fallback) => {
    return (
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      fallback
    );
  };

  // --------------------------------------------------
  // START
  // --------------------------------------------------

  const handleStart = async (
    mode,
    company,
    topic
  ) => {
    setIsLoading(true);
    setError('');

    const toastId = toast.loading(
      'Starting interview...'
    );

    try {
      const data = await startInterview({
        mode,
        company,
        topic,
      });

      setSessionId(data.sessionId);
      setQuestions(data.questions || []);
      setCurrentIndex(0);
      setFeedback(null);
      setIsSubmitted(false);
      setSessionStarted(true);

      toast.dismiss(toastId);
      toast.success('Interview started!');
    } catch (err) {
      toast.dismiss(toastId);

      const message = getErrorMessage(
        err,
        'Unable to start the interview.'
      );

      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------
  // HYDRATE (called when Dashboard passes a session)
  // --------------------------------------------------

  const hydrateSession = (sid, qs) => {
    setSessionId(sid);
    setQuestions(qs || []);
    setCurrentIndex(0);
    setFeedback(null);
    setIsSubmitted(false);
    setSessionStarted(true);
  };

 const handleSubmit = async (
  userAnswer,
  skipped = false,
  timeTaken = 120,
  answerIndex = null
) => {
    const currentQuestion =
      questions[currentIndex];

    if (!currentQuestion || !sessionId) {
      setError(
        'Interview session or question is missing.'
      );
      return;
    }

    setIsLoading(true);
    setIsSubmitted(true);
    setError('');

    const toastId = toast.loading(
      skipped
        ? 'Saving answer...'
        : 'Evaluating your answer...'
    );

    try {
    const data = await submitAnswer(
        sessionId,
        {
          questionId: currentQuestion.id,
          answer: userAnswer,
          answerIndex,
          timeTaken,
          skipped,
        }
      );

     // Parse the JSON feedback string from the backend
      let parsedFb = {};
      try {
        parsedFb = typeof data.feedback === 'string'
          ? JSON.parse(data.feedback)
          : (data.feedback || {});
      } catch {
        parsedFb = {};
      }

      setFeedback({
        score: data.score,                            // 0–100
        good:         parsedFb.good         || '',
        missing:      parsedFb.missing      || '',
        idealHint:    parsedFb.idealHint    || '',
        tip:          parsedFb.tip          || '',
        sampleAnswer: parsedFb.sampleAnswer || '',
        aiAvailable:  parsedFb.aiAvailable !== false,
        correct: data.correct,
      });

      toast.dismiss(toastId);

      toast.success(
        skipped
          ? 'Answer saved.'
          : 'Answer evaluated!'
      );
    } catch (err) {
      toast.dismiss(toastId);

      setIsSubmitted(false);

      const message = getErrorMessage(
        err,
        'Unable to submit your answer.'
      );

      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------
  // SKIP
  // --------------------------------------------------

  const handleSkip = async () => {
    const currentQuestion =
      questions[currentIndex];

    if (!currentQuestion || !sessionId) {
      setError(
        'Interview session or question is missing.'
      );
      return;
    }

    setIsLoading(true);
    setError('');

    const toastId = toast.loading(
      'Skipping question...'
    );

    try {
      await submitAnswer(
        sessionId,
        {
          questionId: currentQuestion.id,
          answer: '',
          answerIndex: null,
          timeTaken: 0,
          skipped: true,
        }
      );

      toast.dismiss(toastId);

      const isLast =
        currentIndex === questions.length - 1;

      if (isLast) {
        const data =
          await completeInterview(sessionId);

        toast.success(
          'Interview completed!'
        );

        navigate('/result', {
          state: {
            result: data,
          },
        });

        return;
      }

      setCurrentIndex(
        prev => prev + 1
      );

      setFeedback(null);
      setIsSubmitted(false);

      toast.success(
        'Skipped. Moving to next question.'
      );
    } catch (err) {
      toast.dismiss(toastId);

      console.error(
        'Skip failed:',
        err
      );

      const message = getErrorMessage(
        err,
        'Unable to skip this question.'
      );

      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------
  // TIME UP
  // --------------------------------------------------

  const handleTimeUp = async () => {
    if (isSubmitted || isLoading) {
      return;
    }

    const currentQuestion =
      questions[currentIndex];

    if (!currentQuestion || !sessionId) {
      setError(
        'Interview session or question is missing.'
      );
      return;
    }

    setIsLoading(true);
    setError('');

    const toastId = toast.loading(
      'Time is up. Saving response...'
    );

    try {
      await submitAnswer(
        sessionId,
        {
          questionId: currentQuestion.id,
          answer: '',
          answerIndex: null,
          timeTaken: 120,
          skipped: true,
        }
      );

      toast.dismiss(toastId);

      const isLast =
        currentIndex === questions.length - 1;

      if (isLast) {
        const data =
          await completeInterview(sessionId);

        toast.success(
          'Interview completed!'
        );

        navigate('/result', {
          state: {
            result: data,
          },
        });

        return;
      }

      setCurrentIndex(
        prev => prev + 1
      );

      setFeedback(null);
      setIsSubmitted(false);

      toast.success(
        'Time up. Moving to next question.'
      );
    } catch (err) {
      toast.dismiss(toastId);

      console.error(
        'Time-up submission failed:',
        err
      );

      const message = getErrorMessage(
        err,
        'Unable to save the timed-out question.'
      );

      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------
  // NEXT
  // --------------------------------------------------

  const handleNext = async () => {
    setError('');

    const isLast =
      currentIndex === questions.length - 1;

    if (isLast) {
      setIsLoading(true);

      const toastId = toast.loading(
        'Preparing your final result...'
      );

      try {
        const data =
          await completeInterview(
            sessionId
          );

        toast.dismiss(toastId);

        toast.success(
          'Interview completed!'
        );

        navigate('/result', {
          state: {
            result: data,
          },
        });
      } catch (err) {
        toast.dismiss(toastId);

        const message = getErrorMessage(
          err,
          'Unable to complete the interview.'
        );

        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }

      return;
    }

    setCurrentIndex(
      prev => prev + 1
    );

    setFeedback(null);
    setIsSubmitted(false);
  };
return {
    sessionId,
    questions,
    currentIndex,
    feedback,
    isSubmitted,
    isLoading,
    error,
    sessionStarted,
    handleStart,
    hydrateSession,
    handleSubmit,
    handleSkip,
    handleTimeUp,
    handleNext,
  };
}