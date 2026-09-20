const { redisClient } = require('../config/redisClient');

// Call this any time a session becomes 'completed' so the next leaderboard
// request recomputes fresh data instead of waiting out the TTL.
const invalidateLeaderboardCache = async () => {
  try {
    await redisClient.del(['leaderboard:weekly:stats', 'leaderboard:overall:stats']);
  } catch (err) {
    console.error('Failed to invalidate leaderboard cache:', err.message);
  }
};

module.exports = { invalidateLeaderboardCache };
