const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT from the httpOnly cookie and attaches
 * { _id } to req.user so every controller can do req.user._id.
 *
 * NOTE: This intentionally does NOT do a DB lookup on every request
 * (that would add a DB round-trip to every API call). Controllers
 * that need the full User document must call User.findById(req.user._id)
 * themselves. This is the standard pattern for JWT auth.
 */
const authMiddleware = (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: decoded.id };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;