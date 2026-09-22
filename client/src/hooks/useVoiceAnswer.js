import { useCallback, useEffect, useRef, useState } from 'react';
import { computeSpeechMetrics } from '../utils/speechMetrics';

// ─── Browser support detection ────────────────────────────────────────────────
// Done once at module load so repeated hook calls don't re-evaluate.
const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const isSpeechRecognitionSupported = Boolean(SpeechRecognition);

// ─── useVoiceAnswer ───────────────────────────────────────────────────────────
/**
 * Manages voice recording via the Web Speech API.
 *
 * @param {{
 *   onTranscriptChange: (text: string) => void,
 *   topic:              string,
 *   questionType:       string,
 *   questionId:         string,
 * }} options
 *
 * Returns:
 *   isRecording   {boolean}        - True while mic is active
 *   isSupported   {boolean}        - False when browser lacks SpeechRecognition
 *   voiceMetrics  {object|null}    - Computed metrics after recording stops
 *   startRecording()               - Begin capture
 *   stopRecording()                - End capture + compute metrics
 *   clearVoiceData()               - Reset transcript + metrics (on question change)
 */
export const useVoiceAnswer = ({
  onTranscriptChange,
  topic        = '',
  questionType = 'open',
  questionId   = '',
} = {}) => {
  const [isRecording,  setIsRecording]  = useState(false);
  const [voiceMetrics, setVoiceMetrics] = useState(null);

  // Refs so interval/callbacks never stale-close over state
  const recognitionRef    = useRef(null);
  const fullTranscriptRef = useRef('');   // accumulates across pauses
  const interimRef        = useRef('');   // current interim partial
  const startTimeRef      = useRef(0);
  const isRecordingRef    = useRef(false);

  // Reset everything when question changes
  useEffect(() => {
    if (recognitionRef.current && isRecordingRef.current) {
      recognitionRef.current.stop();
    }
    fullTranscriptRef.current = '';
    interimRef.current        = '';
    setIsRecording(false);
    setVoiceMetrics(null);
    isRecordingRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!isSpeechRecognitionSupported || isRecordingRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous      = true;   // keep listening until we call .stop()
    recognition.interimResults  = true;   // get partial results for live preview
    recognition.lang            = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let newFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinal += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      if (newFinal) {
        fullTranscriptRef.current += newFinal;
      }
      interimRef.current = interim;

      // Push the combined text up to the parent (fills the textarea live)
      const combined = (fullTranscriptRef.current + interim).trim();
      onTranscriptChange?.(combined);
    };

    recognition.onerror = (event) => {
      // 'no-speech' is normal (user paused); anything else is worth logging
      if (event.error !== 'no-speech') {
        console.warn('[useVoiceAnswer] SpeechRecognition error:', event.error);
      }
      // Don't auto-stop on no-speech — let the user decide when they're done
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        // Microphone permission denied — clean up
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    };

    recognition.onend = () => {
      // If we're still supposed to be recording (e.g. browser paused us),
      // restart automatically. Otherwise leave stopped.
      if (isRecordingRef.current) {
        try { recognition.start(); } catch { /* already restarting */ }
      }
    };

    recognitionRef.current = recognition;
    startTimeRef.current   = Date.now();

    try {
      recognition.start();
      setIsRecording(true);
      isRecordingRef.current = true;
    } catch (err) {
      console.warn('[useVoiceAnswer] Could not start recognition:', err);
    }
  }, [onTranscriptChange]);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current || !isRecordingRef.current) return;

    // Mark stopped BEFORE calling .stop() so onend doesn't restart
    isRecordingRef.current = false;
    setIsRecording(false);

    recognitionRef.current.stop();

    const durationSeconds = (Date.now() - startTimeRef.current) / 1000;
    const finalTranscript = fullTranscriptRef.current.trim();

    // Compute all metrics client-side — no API call needed
    if (finalTranscript) {
      const metrics = computeSpeechMetrics(
        finalTranscript,
        durationSeconds,
        topic,
        questionType
      );
      setVoiceMetrics(metrics);
    }
  }, [topic, questionType]);

  const clearVoiceData = useCallback(() => {
    fullTranscriptRef.current = '';
    interimRef.current        = '';
    setVoiceMetrics(null);
  }, []);

  return {
    isRecording,
    isSupported: isSpeechRecognitionSupported,
    voiceMetrics,
    startRecording,
    stopRecording,
    clearVoiceData,
  };
};

export default useVoiceAnswer;