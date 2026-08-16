const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const publicProfileController = require('../controllers/publicProfileController');

// Auth required — get (or lazily create) the logged-in user's share slug
router.get('/share-link', authMiddleware, publicProfileController.getShareLink);

// Public — no auth — anyone with the link can view
router.get('/:slug', publicProfileController.getPublicProfileBySlug);

module.exports = router;