// ─── speechMetrics.js ────────────────────────────────────────────────────────
// Pure, dependency-free functions for client-side speech analysis.
// No React, no side-effects — fully testable in isolation.
//
// WHY client-side: These metrics are computed from the raw transcript + duration
// that the browser already has. Sending them to Gemini to "estimate" them would
// cost tokens and introduce AI hallucination. We compute the ground truth here
// and hand Gemini only the one thing it's actually good at: generating a
// natural-language improvement tip from those numbers.
// ─────────────────────────────────────────────────────────────────────────────

// ── Filler word list ──────────────────────────────────────────────────────────
// Ordered from most common to least so the breakdown reads naturally.
const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'basically',
  'literally', 'actually', 'so', 'right', 'okay',
];

// ── WPM bands ─────────────────────────────────────────────────────────────────
const WPM_BANDS = {
  tooSlow: { max: 79,  label: 'Too slow',   hint: 'Pick up the pace — interviewers may lose focus.' },
  ideal:   { min: 80,  max: 150, label: 'Ideal pace', hint: 'Clear and comfortable to follow.' },
  tooFast: { min: 151, label: 'Too fast',   hint: 'Slow down — clarity matters more than speed.' },
};

// ── Word count targets by question type ───────────────────────────────────────
const LENGTH_TARGETS = {
  technical: { min: 80,  max: 200, label: 'Technical' },
  behavioral:{ min: 150, max: 300, label: 'Behavioral' },
  hr:        { min: 100, max: 250, label: 'HR' },
  open:      { min: 80,  max: 250, label: 'Open' },  // fallback
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count words in a string (splits on whitespace, filters empties). */
const countWords = (text = '') =>
  text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

/** Normalise topic to the key used in LENGTH_TARGETS. */
const resolveQuestionCategory = (topic = '', questionType = 'open') => {
  const t = String(topic).toLowerCase();
  if (t === 'hr' || t.includes('hr')) return 'hr';
  if (t === 'behavioral' || t.includes('behav')) return 'behavioral';
  // technical covers DSA, OOP, DBMS, OS, JS, System Design, Networking, etc.
  if (questionType === 'open') return 'technical';
  return 'open';
};

// ─── 1. Filler word detection ─────────────────────────────────────────────────
/**
 * Counts filler word occurrences in a transcript.
 *
 * @param {string} transcript
 * @returns {{ total: number, breakdown: Array<{ word: string, count: number }> }}
 */
export const detectFillerWords = (transcript = '') => {
  if (!transcript) return { total: 0, breakdown: [] };

  const lower = transcript.toLowerCase();
  const breakdown = [];
  let total = 0;

  FILLER_WORDS.forEach(filler => {
    // Multi-word fillers: literal substring count (e.g. "you know")
    // Single-word fillers: whole-word match only (avoids "like" in "likewise")
    let count = 0;
    if (filler.includes(' ')) {
      // Simple substring count for phrases
      let pos = 0;
      while ((pos = lower.indexOf(filler, pos)) !== -1) {
        count++;
        pos += filler.length;
      }
    } else {
      // Whole-word regex: matches only if preceded and followed by non-alpha
      const re = new RegExp(`(?<![a-z])${filler}(?![a-z])`, 'gi');
      const matches = lower.match(re);
      count = matches ? matches.length : 0;
    }

    if (count > 0) {
      breakdown.push({ word: filler, count });
      total += count;
    }
  });

  // Sort by frequency descending for the UI
  breakdown.sort((a, b) => b.count - a.count);

  return { total, breakdown };
};

// ─── 2. Words per minute ──────────────────────────────────────────────────────
/**
 * Calculates WPM from transcript and recording duration.
 *
 * @param {string}  transcript      - Full transcribed text
 * @param {number}  durationSeconds - Recording length in seconds
 * @returns {{ wpm: number, band: 'tooSlow'|'ideal'|'tooFast', label: string, hint: string }}
 */
export const calculateWPM = (transcript = '', durationSeconds = 0) => {
  const words   = countWords(transcript);
  const minutes = Math.max(durationSeconds, 1) / 60;  // guard div-by-zero
  const wpm     = words > 0 ? Math.round(words / minutes) : 0;

  let band;
  if (wpm <= 0)                              band = 'tooSlow';
  else if (wpm <= WPM_BANDS.tooSlow.max)    band = 'tooSlow';
  else if (wpm <= WPM_BANDS.ideal.max)      band = 'ideal';
  else                                       band = 'tooFast';

  return {
    wpm,
    band,
    label: WPM_BANDS[band].label,
    hint:  WPM_BANDS[band].hint,
  };
};

// ─── 3. Answer length analysis ────────────────────────────────────────────────
/**
 * Rates answer length against the target range for the question category.
 *
 * @param {string} transcript
 * @param {string} topic          - Question topic string (e.g. "DSA", "HR")
 * @param {string} questionType   - 'open' | 'mcq' | 'aptitude'
 * @returns {{ wordCount: number, category: string, rating: 'tooShort'|'ideal'|'tooLong', min: number, max: number, hint: string }}
 */
export const analyzeAnswerLength = (transcript = '', topic = '', questionType = 'open') => {
  const wordCount = countWords(transcript);
  const category  = resolveQuestionCategory(topic, questionType);
  const target    = LENGTH_TARGETS[category] || LENGTH_TARGETS.open;

  let rating, hint;
  if (wordCount < target.min) {
    rating = 'tooShort';
    hint   = `Aim for at least ${target.min} words — add more depth or an example.`;
  } else if (wordCount > target.max) {
    rating = 'tooLong';
    hint   = `Try to keep it under ${target.max} words — focus on the core points.`;
  } else {
    rating = 'ideal';
    hint   = 'Length is spot-on for this type of question.';
  }

  return {
    wordCount,
    category: target.label,
    rating,
    min: target.min,
    max: target.max,
    hint,
  };
};

// ─── 4. Master compute function ───────────────────────────────────────────────
/**
 * Computes all three metric groups in one call.
 * This is what `useVoiceAnswer` calls after recording stops.
 *
 * @param {string} transcript       - Full transcribed speech
 * @param {number} durationSeconds  - How long the user was recording
 * @param {string} topic            - Question topic
 * @param {string} questionType     - 'open' | 'mcq' | 'aptitude'
 * @returns {SpeechMetrics}
 */
export const computeSpeechMetrics = (transcript, durationSeconds, topic, questionType) => ({
  fillerWords:  detectFillerWords(transcript),
  wpm:          calculateWPM(transcript, durationSeconds),
  answerLength: analyzeAnswerLength(transcript, topic, questionType),
  durationSeconds,
  recordedAt:   Date.now(),
});