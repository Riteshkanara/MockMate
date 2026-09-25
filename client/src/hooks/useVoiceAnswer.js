import { useCallback, useEffect, useRef, useState } from 'react';
import { computeSpeechMetrics } from '../utils/speechMetrics';

// ─── Browser support detection ────────────────────────────────────────────────
const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const isSpeechRecognitionSupported = Boolean(SpeechRecognition);

// iOS Safari (all versions as of this writing) ships no SpeechRecognition at
// all — window.SpeechRecognition is simply undefined there, same as any other
// unsupported browser. We detect the platform separately so the UI can show a
// more accurate message ("not supported on iPhone/iPad" vs a generic browser
// warning) instead of leaving the user guessing why the mic button never
// showed up.
const isIOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|od|ad)/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as "MacIntel" with touch support — the classic sniff misses it.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const voiceUnsupportedReason = isSpeechRecognitionSupported
  ? null
  : isIOS
    ? 'ios'
    : 'browser';

// Errors the browser can throw mid-recording. Anything not in this map still
// gets a generic message, but this covers everything that's shown up in the
// wild — Android Chrome's cloud STT dropping on flaky data ('network'),
// no-mic hardware ('audio-capture'), and permission edge cases distinct from
// the initial prompt ('not-allowed' after a prior grant gets revoked, e.g. in
// Chrome's site settings mid-session).
const ERROR_MESSAGES = {
  'not-allowed':          'Microphone access was denied. Check your browser or phone settings and try again.',
  'service-not-allowed':  'Microphone access was denied. Check your browser or phone settings and try again.',
  'audio-capture':        "Couldn't find a microphone. Check that one is connected and not in use by another app.",
  network:                'Voice recognition needs an internet connection. Check your signal and try again — or switch to typing.',
  aborted:                null, // user- or code-initiated stop; not an error worth surfacing
  'no-speech':            null, // handled separately as a silence nudge, not a hard error
};

// How long to wait with zero speech detected before nudging the user that
// nothing is being picked up (thumb slipped, phone muted, mic blocked by a
// case, etc.) — separate from the browser's own 'no-speech' event, which
// fires unreliably across mobile browsers and is not something to rely on.
const SILENCE_NUDGE_MS = 6000;

// If the browser's onend/restart cycle fires faster than this repeatedly,
// something is wrong at the OS/permission level (seen on some Android
// devices when the mic is yanked mid-call) — stop trying instead of spinning
// and draining the battery.
const RESTART_LOOP_WINDOW_MS = 2000;
const RESTART_LOOP_MAX_COUNT = 4;

// Android Chrome (Chromium bug 40324711, still open) — with continuous:true,
// the recognizer's own onend event stops firing after the first spoken
// utterance: recognition looks "live" but silently stops transcribing
// anything further. Firefox/desktop Chrome/Safari don't have this bug and
// continuous mode works fine there. So on Android we run in *non*-continuous
// mode and drive our own restart loop from onresult/onspeechend instead of
// relying on the browser's onend — see restartForAndroid() below.
const isAndroid =
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

// Android's cloud speech service can take a couple of seconds to warm up
// before the first partial result comes back, even on a good connection —
// longer than the generic silence nudge should wait before assuming nothing
// is being picked up.
const SILENCE_NUDGE_MS_ANDROID = 9000;

// ─── useVoiceAnswer ───────────────────────────────────────────────────────────
/**
 * Manages voice recording via the Web Speech API, with mobile-hardened
 * error handling: network drops, silent recordings, and restart loops all
 * surface a clear voiceError instead of leaving the mic stuck or silent.
 *
 * @param {{
 *   onTranscriptChange: (text: string) => void,
 *   topic:              string,
 *   questionType:       string,
 *   questionId:         string,
 * }} options
 *
 * Returns:
 *   isRecording    {boolean}        - True while mic is active
 *   isSupported    {boolean}        - False when browser lacks SpeechRecognition
 *   unsupportedReason {'ios'|'browser'|null} - Why voice isn't available, for messaging
 *   voiceMetrics   {object|null}    - Computed metrics after recording stops
 *   voiceError     {string|null}    - Human-readable error surfaced during/after recording
 *   isSilent       {boolean}        - True once SILENCE_NUDGE_MS has elapsed with no speech
 *   startRecording()                - Begin capture
 *   stopRecording()                 - End capture + compute metrics
 *   clearVoiceData()                - Reset transcript + metrics (on question change)
 *   dismissVoiceError()             - Clear voiceError without touching the transcript
 */
export const useVoiceAnswer = ({
  onTranscriptChange,
  topic        = '',
  questionType = 'open',
  questionId   = '',
} = {}) => {
  const [isRecording,  setIsRecording]  = useState(false);
  const [voiceMetrics, setVoiceMetrics] = useState(null);
  const [voiceError,   setVoiceError]   = useState(null);
  const [isSilent,      setIsSilent]    = useState(false);

  const recognitionRef    = useRef(null);
  const fullTranscriptRef = useRef('');
  const interimRef        = useRef('');
  const startTimeRef      = useRef(0);
  const isRecordingRef    = useRef(false);
  const hasHeardSpeechRef = useRef(false);
  const silenceTimerRef   = useRef(null);
  const restartTimestampsRef = useRef([]);
  // Timestamped final chunks — { text, tOffset, tEnd } in seconds since start.
  // Feeds the deep analysis in speechMetrics.js (pace consistency, pauses,
  // filler positional trend). Kept separate from fullTranscriptRef because
  // that ref is a flat string and can't carry timing.
  const chunksRef = useRef([]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    const delay = isAndroid ? SILENCE_NUDGE_MS_ANDROID : SILENCE_NUDGE_MS;
    silenceTimerRef.current = setTimeout(() => {
      if (isRecordingRef.current && !hasHeardSpeechRef.current) {
        setIsSilent(true);
      }
    }, delay);
  }, [clearSilenceTimer]);

  const hardStop = useCallback((reason) => {
    isRecordingRef.current = false;
    setIsRecording(false);
    clearSilenceTimer();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* already stopped */ }
    }
    if (reason) setVoiceError(reason);
  }, [clearSilenceTimer]);

  // Reset everything when question changes
  useEffect(() => {
    if (recognitionRef.current && isRecordingRef.current) {
      try { recognitionRef.current.abort(); } catch { /* noop */ }
    }
    fullTranscriptRef.current  = '';
    interimRef.current         = '';
    hasHeardSpeechRef.current  = false;
    restartTimestampsRef.current = [];
    chunksRef.current = [];
    clearSilenceTimer();
    setIsRecording(false);
    setVoiceMetrics(null);
    setVoiceError(null);
    setIsSilent(false);
    isRecordingRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* noop */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the tab is backgrounded mid-recording (user switches apps on mobile,
  // locks the screen, or answers a call), most mobile browsers silently kill
  // the mic stream without ever firing a clean error event. Stopping here
  // avoids a recording that looks "live" in the UI but is actually dead.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isRecordingRef.current) {
        hardStop('Recording paused because the app went into the background. Tap the mic to resume.');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [hardStop]);

  // Creates and starts one SpeechRecognition instance. On Android this is
  // called repeatedly (each utterance is its own single-shot session,
  // stitched together in fullTranscriptRef) because continuous mode's onend
  // never fires there — see the isAndroid comment above. On every other
  // platform continuous:true works normally and this only runs once.
  const beginSession = useCallback(() => {
    const recognition = new SpeechRecognition();
    recognition.continuous      = !isAndroid;
    recognition.interimResults  = true;
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

      if (newFinal || interim) {
        hasHeardSpeechRef.current = true;
        setIsSilent(false);
        armSilenceTimer(); // re-arm — the nudge is for silence gaps, not just the very start
      }

      if (newFinal) {
        fullTranscriptRef.current += newFinal;
        const now = (Date.now() - startTimeRef.current) / 1000;
        const prevEnd = chunksRef.current.length
          ? chunksRef.current[chunksRef.current.length - 1].tEnd
          : 0;
        chunksRef.current.push({ text: newFinal, tOffset: prevEnd, tEnd: now });
      }
      interimRef.current = interim;

      const combined = (fullTranscriptRef.current + interim).trim();
      onTranscriptChange?.(combined);
    };

    recognition.onerror = (event) => {
      const known = Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, event.error);
      const message = known ? ERROR_MESSAGES[event.error] : `Voice recognition hit an error (${event.error}). Try again or switch to typing.`;

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        hardStop(message);
        return;
      }

      if (event.error === 'network') {
        // Don't hard-stop immediately — onend will fire and the restart
        // logic below will retry a couple of times before giving up, since
        // a single dropped packet on mobile data is common and recoverable.
        setVoiceError(message);
        return;
      }

      // 'no-speech' on Android fires constantly between utterances in
      // single-shot mode — that's expected, not an error, and onend below
      // restarts the session automatically. Don't warn-spam the console
      // for it.
      if (message && event.error !== 'no-speech') {
        console.warn('[useVoiceAnswer] SpeechRecognition error:', event.error);
      }
    };

    recognition.onend = () => {
      if (!isRecordingRef.current) return;

      const now = Date.now();
      restartTimestampsRef.current = restartTimestampsRef.current.filter((t) => now - t < RESTART_LOOP_WINDOW_MS);
      restartTimestampsRef.current.push(now);

      // On Android every utterance legitimately ends the session — that's
      // not a failure loop, it's how single-shot mode is meant to work — so
      // don't count those restarts toward the loop-detection limit. Only
      // count restarts that happen with no speech heard at all in between,
      // which is the real "something's wrong" signal there.
      const restartIsExpected = isAndroid && hasHeardSpeechRef.current;
      if (!restartIsExpected && restartTimestampsRef.current.length > RESTART_LOOP_MAX_COUNT) {
        hardStop('Voice recognition kept dropping. This can happen on a weak connection — try again, or switch to typing.');
        return;
      }
      if (isAndroid && hasHeardSpeechRef.current) {
        // Reset the loop window on a successful utterance so a long, healthy
        // recording session never trips the loop guard.
        restartTimestampsRef.current = [];
      }

      try {
        recognition.start();
      } catch {
        // Rapid stop/start on Android can throw "already started" for a few
        // ms right after onend fires — retry once shortly instead of
        // killing the whole recording over a timing race.
        setTimeout(() => {
          if (!isRecordingRef.current) return;
          try {
            recognition.start();
          } catch {
            hardStop('Voice recognition stopped unexpectedly. Try again, or switch to typing.');
          }
        }, 250);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      return true;
    } catch (err) {
      console.warn('[useVoiceAnswer] Could not start recognition:', err);
      return false;
    }
  }, [onTranscriptChange, armSilenceTimer, hardStop]);

  const startRecording = useCallback(() => {
    if (!isSpeechRecognitionSupported || isRecordingRef.current) return;

    setVoiceError(null);
    setIsSilent(false);
    hasHeardSpeechRef.current = false;
    restartTimestampsRef.current = [];
    chunksRef.current = [];
    startTimeRef.current = Date.now();

    const started = beginSession();
    if (started) {
      setIsRecording(true);
      isRecordingRef.current = true;
      armSilenceTimer();
    } else {
      setVoiceError('Could not start the microphone. Try again in a moment.');
    }
  }, [beginSession, armSilenceTimer]);

  // Returns the freshly-computed metrics synchronously (in addition to
  // updating voiceMetrics state as before), so a caller that needs the
  // result in the same tick — e.g. a timer-expiry auto-submit that can't
  // wait for a React state update to land before it reads the value —
  // doesn't have to poll state. Existing callers that ignore the return
  // value (the mic button) are unaffected.
  const stopRecording = useCallback(() => {
    if (!recognitionRef.current || !isRecordingRef.current) return null;

    isRecordingRef.current = false;
    setIsRecording(false);
    setIsSilent(false);
    clearSilenceTimer();

    recognitionRef.current.stop();

    const durationSeconds = (Date.now() - startTimeRef.current) / 1000;
    const finalTranscript = fullTranscriptRef.current.trim();

    if (finalTranscript) {
      const metrics = computeSpeechMetrics(finalTranscript, durationSeconds, topic, questionType, chunksRef.current);
      setVoiceMetrics(metrics);
      return metrics;
    } else if (hasHeardSpeechRef.current === false && durationSeconds > 2) {
      // Recorded for a meaningful stretch but nothing was ever transcribed —
      // more useful than silently handing back an empty box.
      setVoiceError("Didn't catch any speech. Check your mic isn't muted and try again.");
    }
    return null;
  }, [topic, questionType, clearSilenceTimer]);

  const clearVoiceData = useCallback(() => {
    fullTranscriptRef.current = '';
    interimRef.current        = '';
    hasHeardSpeechRef.current = false;
    chunksRef.current = [];
    setVoiceMetrics(null);
    setVoiceError(null);
    setIsSilent(false);
  }, []);

  const dismissVoiceError = useCallback(() => setVoiceError(null), []);

  return {
    isRecording,
    isSupported: isSpeechRecognitionSupported,
    unsupportedReason: voiceUnsupportedReason,
    voiceMetrics,
    voiceError,
    isSilent,
    startRecording,
    stopRecording,
    clearVoiceData,
    dismissVoiceError,
  };
};

export default useVoiceAnswer;
