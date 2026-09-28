// ─── transcribeController.js ──────────────────────────────────────────────────
// POST /transcribe
// Accepts a raw audio file (webm/mp4/m4a/wav — whatever MediaRecorder produced),
// runs it through Whisper first, falls back to Gemini Audio on any Whisper
// failure, and returns { transcript, provider, durationMs }.
//
// Why two providers?
//   Whisper  → highest accuracy for technical English + Indian-English accents.
//   Gemini   → already integrated (same API key, zero extra cost), good fallback.
//
// Why server-side instead of calling OpenAI directly from the browser?
//   - API keys stay secret.
//   - We can enforce per-user rate limits (see transcribeLimiter in index.js).
//   - The fallback logic lives in one place, not in every client.
// ─────────────────────────────────────────────────────────────────────────────

// Uses Node 18+ built-in fetch / FormData / Blob. (node-fetch v3 is ESM-only and
// cannot be require()d from this CommonJS project; form-data does not work with
// the built-in fetch.)
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// gemini-1.5-* has been shut down by Google. Override with GEMINI_MODEL in .env.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'

// Upper bounds so a hung provider can never leave the user on "transcribing..."
const WHISPER_TIMEOUT_MS = Number(process.env.WHISPER_TIMEOUT_MS) || 15000;
const GEMINI_TIMEOUT_MS  = Number(process.env.GEMINI_TRANSCRIBE_TIMEOUT_MS) || 20000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── Whisper ───────────────────────────────────────────────────────────────────
// $0.006 / minute — a 2-min answer costs ~$0.012.
const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Call OpenAI Whisper with a Buffer of audio data.
 * @param {Buffer} audioBuffer
 * @param {string} mimeType   e.g. 'audio/webm', 'audio/mp4'
 * @param {string} filename   e.g. 'recording.webm'
 * @returns {Promise<string>} transcript text
 */
async function transcribeWithWhisper(audioBuffer, mimeType, filename) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
  form.append('model', 'whisper-1');
  form.append('language', 'en');
  // Prompt helps Whisper handle technical CS vocabulary that STT often mishears.
  form.append(
    'prompt',
    'Technical interview answer. Terms may include: algorithm, recursion, binary search, ' +
    'REST API, SQL, polymorphism, system design, time complexity, Big O notation.'
  );

  const res = await fetch(WHISPER_ENDPOINT, {
    method:  'POST',
    // Content-Type (with the multipart boundary) is set automatically for FormData.
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body:    form,
    signal:  AbortSignal.timeout(WHISPER_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper ${res.status}: ${body}`);
  }

  const data = await res.json();
  if (!data.text) throw new Error('Whisper returned empty transcript');
  return data.text.trim();
}

// ── Gemini Audio fallback ─────────────────────────────────────────────────────

/**
 * Call Gemini (GEMINI_MODEL) with inline audio for transcription.
 * Gemini accepts audio as an inline base64 blob — no separate upload needed.
 */
async function transcribeWithGemini(audioBuffer, mimeType) {
  const base64Audio = audioBuffer.toString('base64');
  // Gemini expects a bare MIME type, e.g. 'audio/webm', not 'audio/webm;codecs=opus'.
  const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();

  const result = await withTimeout(ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: cleanMime,
              data: base64Audio,
            },
          },
          {
            text: 'Transcribe this audio recording exactly. Return only the spoken words — no descriptions, no timestamps, no labels. If nothing was said, return an empty string.',
          },
        ],
      },
    ],
  }), GEMINI_TIMEOUT_MS, 'Gemini transcription');

  // @google/genai returns the response directly (no `.response` wrapper as in the
  // old @google/generative-ai SDK); `.text` is the convention used in aiServices.js.
  const text = result?.text ?? result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text.trim();
}

// ── Controller ────────────────────────────────────────────────────────────────

const transcribeAudio = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file received.' });
  }

  const { buffer, mimetype, originalname, size } = req.file;

  // Guard: reject obviously empty or corrupted uploads (< 1 KB)
  if (size < 1024) {
    return res.status(400).json({ error: 'Audio file too small — nothing was recorded.' });
  }

  // Guard: max 25 MB (Whisper hard limit is 25 MB)
  if (size > 25 * 1024 * 1024) {
    return res.status(413).json({ error: 'Recording too large. Maximum is 25 MB.' });
  }

  const start    = Date.now();
  let transcript = '';
  let provider   = '';

  // ── Try Whisper first ──────────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      transcript = await transcribeWithWhisper(buffer, mimetype, originalname || 'recording.webm');
      provider   = 'whisper';
    } catch (whisperErr) {
      console.warn('[transcribe] Whisper failed, falling back to Gemini:', whisperErr.message);
    }
  } else {
    console.warn('[transcribe] OPENAI_API_KEY not set — skipping Whisper, using Gemini directly.');
  }

  // ── Gemini fallback ────────────────────────────────────────────────────
  if (!transcript) {
    try {
      transcript = await transcribeWithGemini(buffer, mimetype);
      provider   = 'gemini';
    } catch (geminiErr) {
      console.error('[transcribe] Both Whisper and Gemini failed:', geminiErr.message);
      return res.status(502).json({
        error: 'Could not transcribe audio. Please type your answer instead.',
      });
    }
  }

  const durationMs = Date.now() - start;
  console.log(`[transcribe] provider=${provider} chars=${transcript.length} ms=${durationMs}`);

  return res.json({ transcript, provider, durationMs });
};

module.exports = { transcribeAudio };
