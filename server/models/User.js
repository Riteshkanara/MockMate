const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  googleId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  avatar: { type: String },
  college: { type: String },
  branch: { type: String },
  plan: { 
    type: String, 
    required: true, 
    default: 'free',
    enum: ['free', 'pro', 'college']
  },
  shareSlug: {
    type: String,
    unique: true,
    sparse: true,   // allows many users to have shareSlug: undefined
    index: true
  },
  refreshToken: { type: String },
  weakPatternSummary: { type: String },
  semester: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 8 
  },
  targetCompanies: [{ type: String }],
  weakAreas: [{ type: String }],
  planExpiry: { type: Date },
  totalSessions: { type: Number, default: 0 },
  totalInterviews: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },
  readinessScore: { type: Number, default: 0 },
  streak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActive: { type: Date },

  },
  badges: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);