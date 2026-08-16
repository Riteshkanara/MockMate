const User = require('../models/User.js');

// Save onboarding data
exports.saveOnboarding = async (req, res) => {
  try {
    const { college, branch, semester, targetCompanies, weakAreas } = req.body;
    const userId = req.user._id; // From authMiddleware

    // Validate required fields
    if (!college || !branch || !semester) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Update user in MongoDB
    const user = await User.findByIdAndUpdate(
      userId,
      {
        college,
        branch,
        semester: parseInt(semester),
        targetCompanies,
        weakAreas
      },
      { new: true } // Return updated user
    );

    res.json({ 
      message: 'Onboarding saved successfully',
      user 
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Failed to save onboarding' });
  }
};