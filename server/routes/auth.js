const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');
const User = require('../models/User');
const Session = require('../models/Session');
const { buildDimensionProfile, computeIRS, tierForScore } = require('../utils/scoringModel');
const { computeUserIRS  } = require('../controllers/interviewController');
const { SIMPLE_BADGE_RULES } = require('../utils/badgeEngine');

// Step 1: Redirect user to Google
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
}));

// Step 2: Google redirects back here
router.get('/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`
    }),
      async (req, res) => {
        const accessToken = jwt.sign(
        { id: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { id: req.user._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
    );

    // Save refresh token to DB
    req.user.refreshToken = refreshToken;
    await req.user.save();    // passport's done(null, user) returns the full user doc

    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,        // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    });

    res.redirect(`${process.env.CLIENT_URL}/auth/callback`);
}
);

// Onboarding
router.post('/onboarding', authMiddleware, userController.saveOnboarding);

// Get current logged in user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Use the exact same IRS pipeline as Dashboard/Analytics
    const { irs, averageScore, tierLabel } = await computeUserIRS (user._id).catch(() => ({
      irs: 0, averageScore: user.averageScore ?? 0, tierLabel: '₹3–6 LPA',
    }));

    // Daily goal — count today's completed interview sessions for the navbar
    // goal ring. Target is fixed at 3/day for now; bump it later if you add
    // a per-user configurable goal.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const completedToday = await Session.countDocuments({
      $or: [{ user: user._id }, { userId: user._id }],
      status: 'completed',
      startedAt: { $gte: startOfToday },
    }).catch(() => 0);

    const dailyGoal = { target: 3, completed: completedToday };

    res.json({ user: { ...user.toObject(), irs, averageScore, tierLabel, dailyGoal } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/fix-badges', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    const sessions = await Session.find({
      $or: [{ userId }, { user: userId }],
      status: 'completed',
    }).sort({ createdAt: 1 }).lean();

    // Use the full badge engine — not SIMPLE_BADGE_RULES
    const { evaluateBadges } = require('../utils/badgeEngine');
    const evaluated = evaluateBadges({ user, sessions });
    const earnedIds = evaluated
      .filter(b => b.unlocked)
      .map(b => b.id);

    await User.findByIdAndUpdate(userId, { badges: earnedIds });

    res.json({
      message: 'Badges fixed!',
      totalSessions: sessions.length,
      newBadges: earnedIds,
      allBadges: earnedIds,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/refresh', async (req, res) => {
    const token = req.cookies?.refreshToken;

    if (!token) return res.status(401).json({ error: 'No refresh token' });

    try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== token) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const newAccessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000,
        });

        res.json({ ok: true });
    } catch (err) {
        return res.status(401).json({ error: 'Refresh token expired or invalid' });
    }
});

router.post('/logout', authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    } catch (_) {}

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ ok: true });
});

module.exports = router;





