const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  googleId: { type: String, required: true, unique: true, index: true },
  avatar:   { type: String },

  // ── Onboarding — academic context ────────────────────────────────────────
  college:  { type: String, index: true },   // indexed for leaderboard queries
  branch:   { type: String },
  semester: { type: Number, min: 1, max: 8 },
  cgpa:     { type: Number, min: 0, max: 10 },

  // ── Onboarding — goals & target ───────────────────────────────────────────
  primaryGoal:      { type: String, enum: ['campus', 'offcampus', 'internship', 'upskill'], default: 'campus' },
  targetRole:       { type: String, enum: ['sde', 'frontend', 'backend', 'fullstack', 'data', 'devops'], default: 'sde' },
  packageTarget:    { type: String, enum: ['3-6', '6-12', '12-20', '20+'], default: '6-12' },
  placementTimeline:{ type: String, enum: ['immediate', 'near', 'moderate', 'relaxed'], default: 'near' },
  targetCompanies:  [{ type: String }],
  weakAreas:        [{ type: String }],

  // ── Onboarding — training preferences ────────────────────────────────────
  answerStyle:       { type: String, enum: ['explain', 'code', 'mixed'], default: 'mixed' },
  difficultyPref:    { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  weeklyDays:        { type: Number, min: 1, max: 7, default: 4 },
  preferredLanguage: { type: String, enum: ['javascript', 'python', 'java', 'cpp', 'other'], default: 'javascript' },
  codingExperience:  { type: String, enum: ['<1', '1-2', '2-3', '3+'], default: '1-2' },
  projectUrl:        { type: String, trim: true },

  // ── Subscription ──────────────────────────────────────────────────────────
  plan:       { type: String, required: true, default: 'free', enum: ['free', 'pro', 'college'] },
  planExpiry: { type: Date },

  // ── Auth ──────────────────────────────────────────────────────────────────
  refreshToken: { type: String },

  // ── Public profile ────────────────────────────────────────────────────────
  shareSlug: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },

  // AI-generated summary of recurring weak patterns (generated after 5+ sessions)
  weakPatternSummary: { type: String },

  // ── Aggregate stats — updated on every session completion ─────────────────
  totalSessions:   { type: Number, default: 0 },
  totalInterviews: { type: Number, default: 0 },
  averageScore:    { type: Number, default: 0 },
  bestScore:       { type: Number, default: 0 },
  readinessScore:  { type: Number, default: 0 },

  streak: {
    current:    { type: Number, default: 0 },
    longest:    { type: Number, default: 0 },
    lastActive: { type: Date },
  },

  badges: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);