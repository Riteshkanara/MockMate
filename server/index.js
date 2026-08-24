const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const interviewRoutes = require('./routes/interview');
const dashboardRoutes = require('./routes/dashboard');
const leaderboardRoutes = require('./routes/leaderboard');
const profileRoutes = require('./routes/profile');

const app = express();

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — locked to the frontend origin ──────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Body + cookie parsing ──────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ── Rate limiting — global fallback (prevents brute-force on any route) ───
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

const interviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only limit AI-calling routes, skip all data-fetch GETs
    if (req.method === 'GET') return true;

    // POST routes that are AI-heavy
    const aiPosts = ['/interview/start', '/interview/ai-coach', '/interview/ai-freeform'];
    const isDynamicAiPost =
      /^\/interview\/[^/]+\/(answer|complete)$/.test(req.path);

    return !aiPosts.includes(req.path) && !isDynamicAiPost;
  },
  message: { error: 'Too many interview requests. Slow down a bit.' },
});

app.use('/interview', interviewLimiter);

// ── Passport ──────────────────────────────────────────────────────────────
app.use(passport.initialize());

// ── MongoDB connection ─────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    console.log('Database name:', mongoose.connection.name);
  })
  .catch((err) => console.error('MongoDB connection error:', err));
// ── Health check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'MockMate API is running' });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/interview', interviewRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/profile', profileRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});