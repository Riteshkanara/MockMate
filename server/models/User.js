const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  googleId:   { type: String, required: true, unique: true, index: true },
  avatar:     { type: String },

  // Set during onboarding
  college:    { type: String, index: true },  // indexed for leaderboard queries
  branch:     { type: String },
  semester:   { type: Number, required: true, min: 1, max: 8 },
  targetCompanies: [{ type: String }],
  weakAreas:       [{ type: String }],

  // Subscription
  plan:       { type: String, required: true, default: 'free', enum: ['free', 'pro', 'college'] },
  planExpiry: { type: Date },

  // Auth
  refreshToken: { type: String },

  // Public profile
  shareSlug: {
    type: String,
    unique: true,
    sparse: true,   // allows many users to have no shareSlug without unique constraint errors
    index: true,
  },

  // AI-generated summary of recurring weak patterns (generated after 5+ sessions)
  weakPatternSummary: { type: String },

  // Aggregate stats — updated on every session completion
  totalSessions:  { type: Number, default: 0 },
  totalInterviews:{ type: Number, default: 0 },
  averageScore:   { type: Number, default: 0 },
  bestScore:      { type: Number, default: 0 },
  readinessScore: { type: Number, default: 0 },

  streak: {
    current:    { type: Number, default: 0 },
    longest:    { type: Number, default: 0 },
    lastActive: { type: Date },
  },

  badges: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);