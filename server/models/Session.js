const mongoose = require('mongoose');

// ── Question sub-schema ────────────────────────────────────────────────────
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
});

// ── Session schema ─────────────────────────────────────────────────────────
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