const User = require('../models/User.js');

/**
 * POST /auth/onboarding
 * Saves the user's college, branch, semester, target companies, and weak areas.
 * Called once after Google login if the user hasn't completed onboarding yet.
 */
exports.saveOnboarding = async (req, res) => {
  try {
    const userId = req.user._id;
    const { college, branch, semester, targetCompanies, weakAreas } = req.body;

    // Validate required fields
    if (!college || !branch || !semester) {
      return res.status(400).json({ error: 'college, branch, and semester are required' });
    }

    const parsedSemester = parseInt(semester, 10);
    if (isNaN(parsedSemester) || parsedSemester < 1 || parsedSemester > 8) {
      return res.status(400).json({ error: 'semester must be a number between 1 and 8' });
    }

    // Sanitize array fields — ensure they are arrays of strings
    const safeCompanies = Array.isArray(targetCompanies)
      ? targetCompanies.map(String).filter(Boolean).slice(0, 10)
      : [];

    const safeWeakAreas = Array.isArray(weakAreas)
      ? weakAreas.map(String).filter(Boolean).slice(0, 10)
      : [];

    const user = await User.findByIdAndUpdate(
      userId,
      {
        college:         String(college).trim(),
        branch:          String(branch).trim(),
        semester:        parsedSemester,
        targetCompanies: safeCompanies,
        weakAreas:       safeWeakAreas,
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Onboarding saved successfully', user });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Failed to save onboarding' });
  }
};