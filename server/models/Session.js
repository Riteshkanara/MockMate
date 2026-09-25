const mongoose = require('mongoose');

// ── CHANGE: Added voiceMetrics to questionSchema ──────────────────────────────
// Stores the pre-computed client-side metrics alongside the transcript.
// All fields are optional (null when the user typed their answer instead of
// speaking) so existing sessions and MCQ/aptitude questions are unaffected.
// ─────────────────────────────────────────────────────────────────────────────

// ── voiceMetrics sub-schema ──────────────────────────────────────────────────
const fillerWordsSchema = new mongoose.Schema({
  total:     { type: Number, default: 0 },
  breakdown: [{ word: String, count: Number }],
}, { _id: false });

const wpmSchema = new mongoose.Schema({
  wpm:   { type: Number, default: 0 },
  band:  { type: String, enum: ['tooSlow', 'ideal', 'tooFast'], default: 'ideal' },
  label: { type: String, default: '' },
  hint:  { type: String, default: '' },
}, { _id: false });

const answerLengthSchema = new mongoose.Schema({
  wordCount: { type: Number, default: 0 },
  category:  { type: String, default: '' },
  rating:    { type: String, enum: ['tooShort', 'ideal', 'tooLong'], default: 'ideal' },
  min:       { type: Number, default: 0 },
  max:       { type: Number, default: 0 },
  hint:      { type: String, default: '' },
}, { _id: false });

const voiceMetricsSchema = new mongoose.Schema({
  fillerWords:     { type: fillerWordsSchema,   default: null },
  wpm:             { type: wpmSchema,            default: null },
  answerLength:    { type: answerLengthSchema,   default: null },
  durationSeconds: { type: Number,               default: 0   },
  recordedAt:      { type: Number,               default: null },
}, { _id: false });

// ── Question sub-schema ───────────────────────────────────────────────────────
const questionSchema = new mongoose.Schema({
  id:                 { type: String },
  text:               { type: String, required: true },
  topic:              { type: String, default: 'General' },
  difficulty:         { type: String, default: 'medium' },
  timeLimit:          { type: Number, default: 120 },
  questionType:       { type: String, enum: ['open', 'mcq', 'aptitude'], default: 'open' },
  options:            [{ type: String }],
  correctAnswerIndex: { type: Number, default: null },
  userAnswer:         { type: String, default: '' },
  userAnswerIndex:    { type: Number, default: null },
  score:              { type: Number, default: 0 },
  feedback:           { type: String, default: '' },
  skipped:            { type: Boolean, default: false },
  timeTaken:          { type: Number, default: 0 },
  // NEW: stores the pre-computed speech metrics (null when no voice was used)
  voiceMetrics:       { type: voiceMetricsSchema, default: null },
});

// ── Session schema ─────────────────────────────────────────────────────────────
const sessionSchema = new mongoose.Schema(
  {
    // Primary owner field — all new sessions write here.
    // `userId` is kept only for backward-compatibility with sessions
    // written before the schema was standardized. Query with:
    //   $or: [{ user: id }, { userId: id }]
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    // Legacy field — do NOT write to this on new sessions.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    mode: {
      type: String,
      enum: ['quick', 'full', 'company', 'topic', 'challenge', 'mcq', 'aptitude', 'mixed'],
      default: 'quick',
    },

    company:         { type: String, default: '' },
    topic:           { type: String, default: '' },
    role:            { type: String, default: '' },
    experienceLevel: { type: String, default: '' },
    questions:       [questionSchema],
    currentQuestion: { type: Number, default: 0 },
    totalScore:      { type: Number, default: 0 },
    averageScore:    { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },

    startedAt:       { type: Date, default: Date.now },
    completedAt:     { type: Date, default: null },
    duration:        { type: Number, default: 0 },
    strengths:       [{ type: String }],
    weaknesses:      [{ type: String }],
    overallFeedback: { type: String, default: '' },
    readinessScore:  { type: Number, default: 0 },
    objectiveCorrect:{ type: Number, default: 0 },
    objectiveTotal:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);