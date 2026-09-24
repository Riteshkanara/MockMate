// ─── speechMetrics.js ────────────────────────────────────────────────────────
// Pure, dependency-free functions for client-side speech analysis.
// No React, no side-effects — fully testable in isolation.
//
// WHY client-side: These metrics are computed from the raw transcript + timing
// data the browser already has. Sending them to Gemini to "estimate" them
// would cost tokens and introduce AI hallucination. We compute ground truth
// here and hand Gemini only the one thing it's actually good at: generating a
// natural-language improvement tip from those numbers.
//
// v2 additions (deep delivery analysis — the part most interview-prep tools
// don't attempt because it requires timestamped chunks, not just a final
// transcript):
//   - Pace consistency: did the person speed up/slow down mid-answer, or
//     hold a steady rhythm? Flagged separately from raw average WPM because
//     a "150 wpm average" can hide a nervous fast start and a trailing-off
//     finish, which reads very differently to an interviewer.
//   - Pause analysis: long silent gaps between speech chunks — thinking
//     pauses vs. dead air. A few 1-2s pauses read as thoughtful; several
//     4s+ gaps read as unprepared.
//   - Filler trend: whether filler words clustered at the start (nerves
//     settling in) or crept in over time (fatigue/losing structure).
//   - Composite delivery score (0-100): a single number combining pace,
//     fillers, pauses, and length-fit, weighted toward what interviewers
//     actually penalize — mirrors the written-answer score so the two are
//     comparable at a glance.
//
// v2.1 additions (vocabulary + sentence clarity — fed to Gemini as ground
// truth so AI scores are anchored to real numbers, not hallucinated):
//   - Vocabulary diversity (TTR): unique/total word ratio → Rich/Average/Basic
//   - Sentence clarity: avg words/sentence → Clear/Mixed/Dense
//   - Filler rate: fillers per 100 words (normalised, easier to compare)
// ─────────────────────────────────────────────────────────────────────────────

// ── Filler word list ──────────────────────────────────────────────────────────
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
  technical:  { min: 80,  max: 200, label: 'Technical'  },
  behavioral: { min: 150, max: 300, label: 'Behavioral' },
  hr:         { min: 100, max: 250, label: 'HR'         },
  open:       { min: 80,  max: 250, label: 'Open'       },
};

// ── Pause thresholds (seconds of silence between transcript chunks) ──────────
const PAUSE_THRESHOLDS = {
  thinking: 1.2,  // below this: natural speech rhythm, not counted
  notable:  2.5,  // 1.2–2.5s: a "thinking pause" — normal, even good
  long:     4.0,  // 2.5–4s: borderline — flagged if it happens more than twice
  // 4s+: a "dead air" gap — always flagged
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count words in a string (splits on whitespace, filters empties). */
const countWords = (text = '') =>
  text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

/** Normalise topic to the key used in LENGTH_TARGETS. */
const resolveQuestionCategory = (topic = '', questionType = 'open') => {
  const t = String(topic).toLowerCase();
  if (t === 'hr' || t.includes('hr'))            return 'hr';
  if (t === 'behavioral' || t.includes('behav')) return 'behavioral';
  if (questionType === 'open')                   return 'technical';
  return 'open';
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ─── 1. Filler word detection (+ positional trend + rate) ─────────────────────
/**
 * Counts filler word occurrences and, when chunk timing is available, whether
 * they cluster early, late, or spread evenly through the answer.
 * Also returns `rate` (fillers per 100 words) for normalised comparison.
 *
 * @param {string} transcript
 * @param {Array<{text: string, tOffset: number}>} [chunks] - timestamped final
 *   transcript chunks, if the caller tracked them (see useVoiceAnswer v2)
 * @returns {{ total, breakdown, rate, trend: 'front-loaded'|'back-loaded'|'even'|null }}
 */
export const detectFillerWords = (transcript = '', chunks = []) => {
  if (!transcript) return { total: 0, breakdown: [], rate: 0, trend: null };

  const lower = transcript.toLowerCase();
  const breakdown = [];
  let total = 0;

  FILLER_WORDS.forEach((filler) => {
    let count = 0;
    if (filler.includes(' ')) {
      let pos = 0;
      while ((pos = lower.indexOf(filler, pos)) !== -1) {
        count++;
        pos += filler.length;
      }
    } else {
      const re = new RegExp(`(?<![a-z])${filler}(?![a-z])`, 'gi');
      const matches = lower.match(re);
      count = matches ? matches.length : 0;
    }
    if (count > 0) {
      breakdown.push({ word: filler, count });
      total += count;
    }
  });

  breakdown.sort((a, b) => b.count - a.count);

  // Normalised rate — fillers per 100 words (for Gemini prompt)
  const wc   = countWords(transcript);
  const rate = wc > 0 ? Math.round((total / wc) * 100) : 0;

  // Positional trend — only computable with timestamped chunks
  let trend = null;
  if (total >= 3 && chunks.length >= 2) {
    const lastOffset = chunks[chunks.length - 1]?.tOffset || 1;
    const midpoint = lastOffset / 2;
    let early = 0;
    let late  = 0;
    chunks.forEach((chunk) => {
      const chunkFillerCount = FILLER_WORDS.reduce((sum, f) => {
        const re = f.includes(' ')
          ? null
          : new RegExp(`(?<![a-z])${f}(?![a-z])`, 'gi');
        if (re) {
          const m = chunk.text.toLowerCase().match(re);
          return sum + (m ? m.length : 0);
        }
        let c = 0, pos = 0;
        const low = chunk.text.toLowerCase();
        while ((pos = low.indexOf(f, pos)) !== -1) { c++; pos += f.length; }
        return sum + c;
      }, 0);
      if (chunk.tOffset < midpoint) early += chunkFillerCount;
      else late += chunkFillerCount;
    });
    if      (early > late  * 1.5) trend = 'front-loaded';
    else if (late  > early * 1.5) trend = 'back-loaded';
    else                           trend = 'even';
  }

  return { total, breakdown, rate, trend };
};

// ─── 2. Words per minute (+ pace consistency) ─────────────────────────────────
/**
 * Calculates overall WPM, and when timestamped chunks are available, whether
 * the pace held steady or swung significantly through the answer.
 *
 * @param {string} transcript
 * @param {number} durationSeconds
 * @param {Array<{text: string, tOffset: number}>} [chunks]
 * @returns {{ wpm, band, label, hint, consistency: {rating, firstHalfWpm, secondHalfWpm}|null }}
 */
export const calculateWPM = (transcript = '', durationSeconds = 0, chunks = []) => {
  const words   = countWords(transcript);
  const minutes = Math.max(durationSeconds, 1) / 60;
  const wpm     = words > 0 ? Math.round(words / minutes) : 0;

  let band;
  if      (wpm <= 0)                          band = 'tooSlow';
  else if (wpm <= WPM_BANDS.tooSlow.max)      band = 'tooSlow';
  else if (wpm <= WPM_BANDS.ideal.max)        band = 'ideal';
  else                                         band = 'tooFast';

  let consistency = null;
  if (chunks.length >= 4 && durationSeconds > 8) {
    const mid             = durationSeconds / 2;
    const firstHalf       = chunks.filter((c) => c.tOffset < mid);
    const secondHalf      = chunks.filter((c) => c.tOffset >= mid);
    const wordsIn         = (arr) => arr.reduce((sum, c) => sum + countWords(c.text), 0);
    const firstHalfWords  = wordsIn(firstHalf);
    const secondHalfWords = wordsIn(secondHalf);
    const firstHalfWpm    = Math.round(firstHalfWords  / (mid / 60 || 1));
    const secondHalfWpm   = Math.round(secondHalfWords / (mid / 60 || 1));
    const delta           = Math.abs(firstHalfWpm - secondHalfWpm);
    const rating          = delta < 20 ? 'steady' : delta < 45 ? 'shifting' : 'volatile';
    consistency = { rating, firstHalfWpm, secondHalfWpm };
  }

  return {
    wpm,
    band,
    label: WPM_BANDS[band].label,
    hint:  WPM_BANDS[band].hint,
    consistency,
  };
};

// ─── 3. Answer length analysis ────────────────────────────────────────────────
/**
 * Rates answer length against the target range for the question category.
 * @param {string} transcript
 * @param {string} topic
 * @param {string} questionType
 * @returns {{ wordCount, category, rating: 'tooShort'|'ideal'|'tooLong', min, max, hint }}
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

  return { wordCount, category: target.label, rating, min: target.min, max: target.max, hint };
};

// ─── 4. Pause analysis ────────────────────────────────────────────────────────
/**
 * Analyzes gaps between timestamped transcript chunks to distinguish
 * thoughtful pauses from dead air. Requires chunk timing — returns null
 * when unavailable (older browsers, or transcript reconstructed without
 * timestamps).
 *
 * @param {Array<{text: string, tOffset: number, tEnd: number}>} chunks
 * @param {number} durationSeconds
 * @returns {{
 *   totalPauses, longestPauseSeconds, deadAirCount,
 *   thinkingPauseCount, totalSilenceSeconds,
 *   rating: 'smooth'|'some-hesitation'|'frequent-gaps'
 * } | null}
 */
export const analyzePauses = (chunks = [], durationSeconds = 0) => {
  if (!chunks || chunks.length < 2) return null;

  let thinkingPauseCount = 0;
  let deadAirCount       = 0;
  let longestPauseSeconds = 0;
  let totalSilenceSeconds = 0;

  for (let i = 1; i < chunks.length; i++) {
    const gap = chunks[i].tOffset - (chunks[i - 1].tEnd ?? chunks[i - 1].tOffset);
    if (gap <= 0) continue;
    if (gap >= PAUSE_THRESHOLDS.thinking) {
      totalSilenceSeconds += gap;
      if (gap > longestPauseSeconds) longestPauseSeconds = gap;
      if (gap >= PAUSE_THRESHOLDS.long) deadAirCount++;
      else                               thinkingPauseCount++;
    }
  }

  const totalPauses = thinkingPauseCount + deadAirCount;
  let rating;
  if      (deadAirCount >= 2 || totalSilenceSeconds > durationSeconds * 0.3) rating = 'frequent-gaps';
  else if (deadAirCount === 1 || thinkingPauseCount >= 3)                    rating = 'some-hesitation';
  else                                                                         rating = 'smooth';

  return {
    totalPauses,
    longestPauseSeconds: Math.round(longestPauseSeconds * 10) / 10,
    deadAirCount,
    thinkingPauseCount,
    totalSilenceSeconds: Math.round(totalSilenceSeconds * 10) / 10,
    rating,
  };
};

// ─── 5. Vocabulary diversity ──────────────────────────────────────────────────
/**
 * Measures how varied the vocabulary is (Type-Token Ratio).
 * TTR = unique words / total words. Normalised to 0-100 score.
 * Fed to Gemini as a ground-truth anchor for the vocabularyRichness score.
 *
 * @param {string} transcript
 * @returns {{ uniqueWords, totalWords, ttr, score, label: 'Rich'|'Average'|'Basic' }}
 */
export const analyzeVocabularyDiversity = (transcript = '') => {
  if (!transcript.trim()) return { uniqueWords: 0, totalWords: 0, ttr: 0, score: 0, label: 'Basic' };

  const words  = transcript.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const total  = words.length;
  const unique = new Set(words).size;
  const ttr    = total > 0 ? unique / total : 0;

  // TTR: >0.70 Rich, 0.45–0.70 Average, <0.45 Basic
  const score = Math.round(ttr * 100);
  const label = ttr >= 0.70 ? 'Rich' : ttr >= 0.45 ? 'Average' : 'Basic';

  return { uniqueWords: unique, totalWords: total, ttr: Math.round(ttr * 100) / 100, score, label };
};

// ─── 6. Sentence clarity ──────────────────────────────────────────────────────
/**
 * Analyses sentence structure for clarity signals.
 * Ideal interview sentence length: 10–25 words (concise but complete).
 * Fed to Gemini as a ground-truth anchor for the toneAnalysis score.
 *
 * @param {string} transcript
 * @returns {{ sentenceCount, avgWordsPerSentence, score, label: 'Clear'|'Mixed'|'Dense', hint }}
 */
export const analyzeSentenceClarity = (transcript = '') => {
  if (!transcript.trim()) return { sentenceCount: 0, avgWordsPerSentence: 0, score: 0, label: 'Dense', hint: 'No transcript to analyse.' };

  const sentences = transcript
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && countWords(s) >= 3);

  const sentenceCount = sentences.length;
  if (sentenceCount === 0) return { sentenceCount: 0, avgWordsPerSentence: 0, score: 50, label: 'Mixed', hint: 'Speak in complete sentences.' };

  const totalWords          = sentences.reduce((acc, s) => acc + countWords(s), 0);
  const avgWordsPerSentence = Math.round(totalWords / sentenceCount);

  let score, label, hint;
  if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) {
    score = 90 + Math.round((1 - Math.abs(avgWordsPerSentence - 17) / 8) * 10);
    label = 'Clear';
    hint  = 'Sentence length is well-structured — easy to follow.';
  } else if (avgWordsPerSentence < 10) {
    score = Math.max(40, 60 + (avgWordsPerSentence - 5) * 5);
    label = 'Mixed';
    hint  = 'Sentences are a little short — try elaborating each point slightly.';
  } else {
    score = Math.max(20, 80 - (avgWordsPerSentence - 25) * 3);
    label = 'Dense';
    hint  = 'Long sentences make answers harder to follow — break them up.';
  }

  return { sentenceCount, avgWordsPerSentence, score: Math.min(100, score), label, hint };
};

// ─── 7. Composite delivery score ──────────────────────────────────────────────
/**
 * Combines pace, fillers, pauses, and length-fit into a single 0-100 score,
 * weighted toward what actually reads badly to a human interviewer: dead air
 * and heavy filler use hurt more than being slightly off the ideal length.
 *
 * @returns {{ score: number, breakdown: {pace, fillers, pauses, length} }}
 */
export const computeDeliveryScore = (wpmResult, fillerResult, pauseResult, lengthResult) => {
  let paceScore = 100;
  if (wpmResult.band === 'tooSlow') paceScore = 55;
  if (wpmResult.band === 'tooFast') paceScore = 60;
  if (wpmResult.consistency?.rating === 'volatile') paceScore -= 15;
  paceScore = clamp(paceScore, 0, 100);

  const fillerScore = clamp(100 - fillerResult.total * 8, 20, 100);

  let pauseScore = 100;
  if (pauseResult) {
    pauseScore = 100 - pauseResult.deadAirCount * 20 - pauseResult.thinkingPauseCount * 4;
    pauseScore = clamp(pauseScore, 15, 100);
  }

  const lengthScore = lengthResult.rating === 'ideal' ? 100 : lengthResult.rating === 'tooShort' ? 45 : 70;

  const weights = { pace: 0.3, fillers: 0.3, pauses: 0.25, length: 0.15 };
  const score   = Math.round(
    paceScore    * weights.pace    +
    fillerScore  * weights.fillers +
    pauseScore   * weights.pauses  +
    lengthScore  * weights.length
  );

  return {
    score: clamp(score, 0, 100),
    breakdown: { pace: paceScore, fillers: fillerScore, pauses: pauseScore, length: lengthScore },
  };
};

// ─── 8. Master compute function ───────────────────────────────────────────────
/**
 * Computes the full delivery analysis in one call. Pass timestamped chunks
 * for the deep analysis (pace consistency, pause detection, filler trend);
 * without them those fields degrade to null and the basic metrics still work.
 *
 * v2.1: also computes vocabularyDiversity and sentenceClarity which are sent
 * to Gemini as ground-truth anchors (not re-computed by the AI).
 *
 * @param {string} transcript
 * @param {number} durationSeconds
 * @param {string} topic
 * @param {string} questionType
 * @param {Array<{text: string, tOffset: number, tEnd: number}>} [chunks]
 * @returns {SpeechMetrics}
 */
export const computeSpeechMetrics = (transcript, durationSeconds, topic, questionType, chunks = []) => {
  const fillerWords          = detectFillerWords(transcript, chunks);
  const wpm                  = calculateWPM(transcript, durationSeconds, chunks);
  const answerLength         = analyzeAnswerLength(transcript, topic, questionType);
  const pauses               = analyzePauses(chunks, durationSeconds);
  const delivery             = computeDeliveryScore(wpm, fillerWords, pauses, answerLength);
  const vocabularyDiversity  = analyzeVocabularyDiversity(transcript);
  const sentenceClarity      = analyzeSentenceClarity(transcript);

  return {
    fillerWords,
    wpm,
    answerLength,
    pauses,
    deliveryScore:       delivery.score,
    deliveryBreakdown:   delivery.breakdown,
    vocabularyDiversity,
    sentenceClarity,
    durationSeconds,
    recordedAt:          Date.now(),
  };
};