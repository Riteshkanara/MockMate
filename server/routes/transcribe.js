// server/routes/transcribe.js
// ─────────────────────────────────────────────────────────────────────────────
// POST /transcribe
// Accepts an audio file upload, forwards it to transcribeController.
// Multer parses the multipart/form-data; authMiddleware gates the endpoint
// so only logged-in users can burn your OpenAI credits.
// ─────────────────────────────────────────────────────────────────────────────

const express    = require('express');
const multer     = require('multer');
const rateLimit  = require('express-rate-limit');
const { transcribeAudio } = require('../controllers/transcribeController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ── Multer — memory storage (buffer goes straight to Whisper/Gemini) ─────────
// 25 MB matches Whisper's own upload limit; anything larger is rejected before
// it even reaches the controller's size check, saving the controller parse time.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// ── Per-endpoint rate limit — tighter than the global 200/15 min ─────────────
// Each transcription hits OpenAI ($) so cap at 20 req/min per IP.
// Free users answering 5–10 questions per session → ~2 req/min max in practice.
const transcribeLimiter = rateLimit({
  windowMs:        60 * 1000,  // 1 minute
  max:             20,
  standardHeaders: true,
    legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id ?? req.user?.id ?? 'unknown'),
  message: { error: 'Too many transcription requests. Slow down a bit.' },
});

// POST /transcribe
router.post(
  '/',
  authMiddleware,         // must be logged in
  transcribeLimiter,      // per-IP rate limit
  upload.single('audio'), // parse the multipart file field named "audio"
  transcribeAudio,        // run Whisper / Gemini
);

module.exports = router;