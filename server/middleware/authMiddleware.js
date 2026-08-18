const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = { _id: decoded.id };
    next();
  } catch (error) {
    console.error('Token error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;