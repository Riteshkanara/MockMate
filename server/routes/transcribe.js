// ─── routes/transcribe.js ────────────────────────────────────────────────────
const express = require('express');
const multer  = require('multer');
const rateLimit = require('express-rate-limit');

const authMiddleware       = require('../middleware/authMiddleware');
const { transcribeAudio }  = require('../controllers/transcribeController');

const router = express.Router();

// ── Multer: keep audio in memory (no disk temp files) ────────────────────────
// 25 MB hard cap matches Whisper's limit. We only accept audio MIME types —
// a non-audio upload is rejected before it ever reaches our controller.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported MIME type: ${file.mimetype}`), false);
    }
  },
});

// ── Per-route rate limit: 20 transcriptions / 5 min per USER ──────────────────
// Even a fast user submits one answer per ~90 s, so 20/5min is generous for
// legitimate use while blocking replay attacks.
const transcribeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by authenticated user (authMiddleware runs first), not IP, so users on a
  // shared campus/office network don't consume each other's allowance.
  keyGenerator: (req) => String(req.user?._id ?? req.user?.id ?? 'unknown'),
  message: { error: 'Too many transcription requests. Slow down a bit.' },
});

// POST /transcribe
// auth → rate-limit → multer → controller
router.post(
  '/',
  authMiddleware,
  transcribeLimiter,
  upload.single('audio'),
  transcribeAudio,
);

// Multer error handler (wrong MIME type, file too large, etc.)
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Recording too large. Maximum is 25 MB.' });
  }
  console.error('[transcribe route] Error:', err.message);
  return res.status(400).json({ error: err.message || 'Bad audio upload.' });
});

module.exports = router;
