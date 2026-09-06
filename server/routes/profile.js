const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const publicProfileController = require('../controllers/publicProfileController');

// Auth required — get (or lazily create) the logged-in user's share slug
router.get('/share-link', authMiddleware, publicProfileController.getShareLink);

// Auth required — the logged-in user's own profile report (backs ScoreCard's
// self-fetch). MUST be registered before '/:slug' or Express will treat
// "me" as a slug and route it into the public lookup instead.
router.get('/me', authMiddleware, publicProfileController.getMyProfile);

// Public — no auth — anyone with the link can view
router.get('/:slug', publicProfileController.getPublicProfileBySlug);

module.exports = router;