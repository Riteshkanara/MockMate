const { createClient } = require('redis');

// ── Single shared Redis connection for the whole server ────────────────────
// REDIS_URL examples:
//   local via docker-compose: redis://redis:6379
//   local without docker:      redis://127.0.0.1:6379
//   managed (Upstash/Redis Cloud): rediss://default:<password>@<host>:<port>

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err.message);
});

redisClient.on('connect', () => {
  console.log('Redis connected successfully');
});

// Connect once at startup. index.js calls this.
const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

module.exports = { redisClient, connectRedis };
