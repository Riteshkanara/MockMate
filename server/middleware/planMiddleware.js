/**
 * MockMate — Plan Middleware
 * Use AFTER authMiddleware so req.user._id is populated.
 *
 * Usage:
 *   router.post('/ai-coach', authMiddleware, requirePro('aiCoach'), controller)
 *
 * Does its own lightweight DB lookup (plan + planExpiry only) because
 * authMiddleware deliberately does NOT hit the DB on every request — see
 * the note in authMiddleware.js. Controllers that separately need the full
 * user document still do their own User.findById; this is a second,
 * cheap, projected query and not worth avoiding via req context-passing.
 */

const { getPlanConfig } = require('../config/planConfig');
const User = require('../models/User');

const requirePro = (feature) => async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const user   = await User.findById(userId).select('plan planExpiry').lean();
    const config = getPlanConfig(user);

    const val = config[feature];
    const allowed =
      val === true ||
      val === Infinity ||
      (Array.isArray(val) && val.length > 0) ||
      (typeof val === 'number' && val > 0);    // handles maxQuestionsPerSession

    if (!allowed) {
      return res.status(403).json({
        error:       'plan_required',
        feature,
        currentPlan: config._effectivePlan,
        expired:     config._expired,
        message: config._expired
          ? 'Your Pro subscription has expired. Renew to access this feature.'
          : 'This feature requires a Pro subscription.',
      });
    }

    next();
  } catch (err) {
    console.error('planMiddleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { requirePro };