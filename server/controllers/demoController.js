/**
 * MockMate — demo plan switch (for viva / demos ONLY)
 *
 * Lets the signed-in user flip THEIR OWN account between Free / Pro / Expired and
 * reset their one-time mode trials, so both plans can be shown live without editing
 * the database. It is OFF by default: nothing happens unless the server is started
 * with DEMO_PLAN_SWITCH=true. When off, the route answers 404 as if it didn't exist.
 *
 * Never enable this on a deployment that takes real payments.
 */
const User = require('../models/User');

const DAY_MS = 86400000;
const isEnabled = () => process.env.DEMO_PLAN_SWITCH === 'true';

const setDemoPlan = async (req, res) => {
  if (!isEnabled()) return res.status(404).json({ error: 'Not found.' });

  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

    const { state } = req.body || {};
    // A switch (not an object lookup) so inherited keys like "__proto__" or "constructor"
    // can never be mistaken for a valid state.
    let update = null;
    switch (state) {
      case 'free':         update = { $set: { plan: 'free', planExpiry: null } }; break;
      case 'pro':          update = { $set: { plan: 'pro',  planExpiry: new Date(Date.now() + 30 * DAY_MS) } }; break;
      case 'expired':      update = { $set: { plan: 'pro',  planExpiry: new Date(Date.now() - DAY_MS) } }; break;
      case 'reset-trials': update = { $set: { proTrialsUsed: [] } }; break;
      default:             update = null;
    }

    if (!update) {
      return res.status(400).json({ error: 'invalid_state', message: 'state must be free, pro, expired or reset-trials.' });
    }

    const user = await User.findByIdAndUpdate(userId, update, { new: true })
      .select('plan planExpiry proTrialsUsed').lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json({ ok: true, state, plan: user.plan, planExpiry: user.planExpiry, proTrialsUsed: user.proTrialsUsed || [] });
  } catch (err) {
    console.error('[demo] setDemoPlan error:', err);
    return res.status(500).json({ error: 'Could not change the demo plan.' });
  }
};

module.exports = { setDemoPlan, isDemoSwitchEnabled: isEnabled };
