require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const interviewRoutes = require('./routes/interview');
const dashboardRoutes = require('./routes/dashboard');
const leaderboardRoutes = require('./routes/leaderboard');
const profileRoutes = require('./routes/profile');
const paymentRoutes   = require('./routes/payment'); 

const app = express();

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — locked to the frontend origin ──────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Cookie parsing — MUST be before any route that checks req.cookies ──────
app.use(cookieParser());

// ── Webhook raw body — ONLY for /payment/webhook, before express.json() ────
app.use('/payment/webhook', express.raw({ type: 'application/json', limit: '1mb' }));

// ── Body parsing for everything else ──────────────────────────────────────
app.use(express.json());

// ── Rate limiting ──────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
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
    if (req.method === 'GET') return true;
    const aiPosts = ['/interview/start', '/interview/ai-coach', '/interview/ai-freeform'];
    const isDynamicAiPost =
      /^\/interview\/[^/]+\/(answer|complete)$/.test(req.path);
    return !aiPosts.includes(req.path) && !isDynamicAiPost;
  },
  message: { error: 'Too many interview requests. Slow down a bit.' },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/webhook',
  message: { error: 'Too many payment requests. Slow down a bit.' },
});

app.use('/interview', interviewLimiter);
app.use('/payment', paymentLimiter);

// ── Passport ───────────────────────────────────────────────────────────────
app.use(passport.initialize());

// ── MongoDB connection ─────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    console.log('Database name:', mongoose.connection.name);
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// ── Health check — used by UptimeRobot to prevent Render cold starts ──────
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    db: dbStatus,
  });
});

// ── Root ──────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'MockMate API is running' });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/interview', interviewRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/profile', profileRoutes);
app.use('/payment', paymentRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
