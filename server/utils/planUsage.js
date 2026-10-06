/**
 * MockMate — plan usage helpers
 * Daily interview counting + reset window. "Day" = calendar day in IST, because
 * every user is in India and "resets at midnight" must mean THEIR midnight.
 */
const Session = require('../models/Session');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** { start, end } of the current IST day, as real Date objects (UTC instants). */
const getDayWindowIST = (now = new Date()) => {
  const istNow = now.getTime() + IST_OFFSET_MS;
  const istMidnight = Math.floor(istNow / DAY_MS) * DAY_MS;
  const start = new Date(istMidnight - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/**
 * Interviews that count toward today's limit.
 * A session counts the moment it starts, EXCEPT one abandoned before the first
 * answer — quitting on question 1 shouldn't burn a slot.
 */
const countTodaySessions = async (userId) => {
  const { start, end } = getDayWindowIST();
  return Session.countDocuments({
    $or: [{ user: userId }, { userId }],
    createdAt: { $gte: start, $lt: end },
    $nor: [{ status: 'abandoned', currentQuestion: { $lte: 0 } }],
  });
};

module.exports = { getDayWindowIST, countTodaySessions };
