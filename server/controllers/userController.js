const User = require('../models/User.js');

/**
 * POST /auth/onboarding
 * Saves the full onboarding profile. Called once after Google login.
 */
exports.saveOnboarding = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      // Academic context
      college, branch, semester, cgpa,
      // Goals
      primaryGoal, targetRole, packageTarget, placementTimeline,
      targetCompanies, weakAreas,
      // Training prefs
      answerStyle, difficultyPref, weeklyDays,
      preferredLanguage, codingExperience, projectUrl,
    } = req.body;

    // ── Required field validation ──────────────────────────────────────────
    if (!college || !branch || !semester) {
      return res.status(400).json({ error: 'college, branch, and semester are required' });
    }

    const parsedSemester = parseInt(semester, 10);
    if (isNaN(parsedSemester) || parsedSemester < 1 || parsedSemester > 8) {
      return res.status(400).json({ error: 'semester must be between 1 and 8' });
    }

    // ── Optional numeric validation ────────────────────────────────────────
    let parsedCgpa = null;
    if (cgpa !== undefined && cgpa !== '' && cgpa !== null) {
      parsedCgpa = parseFloat(cgpa);
      if (isNaN(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
        return res.status(400).json({ error: 'cgpa must be between 0 and 10' });
      }
    }

    let parsedWeeklyDays = 4;
    if (weeklyDays !== undefined) {
      parsedWeeklyDays = parseInt(weeklyDays, 10);
      if (isNaN(parsedWeeklyDays) || parsedWeeklyDays < 1 || parsedWeeklyDays > 7) {
        parsedWeeklyDays = 4;
      }
    }

    // ── Sanitize enum fields ───────────────────────────────────────────────
    const VALID_GOALS       = ['campus', 'offcampus', 'internship', 'upskill'];
    const VALID_ROLES       = ['sde', 'frontend', 'backend', 'fullstack', 'data', 'devops'];
    const VALID_PACKAGES    = ['3-6', '6-12', '12-20', '20+'];
    const VALID_TIMELINES   = ['immediate', 'near', 'moderate', 'relaxed'];
    const VALID_STYLES      = ['explain', 'code', 'mixed'];
    const VALID_DIFFICULTY  = ['easy', 'medium', 'hard'];
    const VALID_LANGUAGES   = ['javascript', 'python', 'java', 'cpp', 'other'];
    const VALID_EXPERIENCE  = ['<1', '1-2', '2-3', '3+'];

    const safeEnum = (val, allowed, fallback) =>
      allowed.includes(val) ? val : fallback;

    // ── Sanitize array fields ──────────────────────────────────────────────
    const safeArray = (arr, limit = 10) =>
      Array.isArray(arr)
        ? arr.map(String).filter(Boolean).slice(0, limit)
        : [];

    // ── Sanitize project URL ───────────────────────────────────────────────
    let safeProjectUrl = '';
    if (projectUrl && typeof projectUrl === 'string') {
      const trimmed = projectUrl.trim();
      // Accept github, linkedin, portfolio URLs — basic check
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        safeProjectUrl = trimmed.slice(0, 500);
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        // Academic
        college:  String(college).trim(),
        branch:   String(branch).trim(),
        semester: parsedSemester,
        ...(parsedCgpa !== null && { cgpa: parsedCgpa }),

        // Goals
        primaryGoal:       safeEnum(primaryGoal, VALID_GOALS, 'campus'),
        targetRole:        safeEnum(targetRole, VALID_ROLES, 'sde'),
        packageTarget:     safeEnum(packageTarget, VALID_PACKAGES, '6-12'),
        placementTimeline: safeEnum(placementTimeline, VALID_TIMELINES, 'near'),
        targetCompanies:   safeArray(targetCompanies),
        weakAreas:         safeArray(weakAreas),

        // Training
        answerStyle:       safeEnum(answerStyle, VALID_STYLES, 'mixed'),
        difficultyPref:    safeEnum(difficultyPref, VALID_DIFFICULTY, 'medium'),
        weeklyDays:        parsedWeeklyDays,
        preferredLanguage: safeEnum(preferredLanguage, VALID_LANGUAGES, 'javascript'),
        codingExperience:  safeEnum(codingExperience, VALID_EXPERIENCE, '1-2'),
        ...(safeProjectUrl && { projectUrl: safeProjectUrl }),
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