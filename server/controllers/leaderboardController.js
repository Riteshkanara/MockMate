const Session = require('../models/Session');
const User = require('../models/User');

// Get start of current week (Monday 12:00 AM)
const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// GET /leaderboard
const getLeaderboard = async (req, res) => {
  try {
    
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const weekStart = getWeekStart();

    // Get current user's college
    const currentUser = await User.findById(userId).select('college name');
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Aggregate weekly sessions per user
    const weeklyStats = await Session.aggregate([
      {
  $match: {
    status: 'completed',
    createdAt: { $gte: weekStart },
  },
},
{
  $addFields: {
    resolvedUser: { $ifNull: ['$userId', '$user'] }
  }
},
{
  $group: {
          _id: '$resolvedUser',
          weeklyAvgScore: { $avg: '$averageScore' },
          weeklySessionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          weeklyAvgScore: { $round: ['$weeklyAvgScore', 1] },
          weeklySessionCount: 1,
          name: '$user.name',
          college: '$user.college',
          avatar: '$user.avatar',
          streak: '$user.streak.current'
        }
      },
      { $sort: { weeklyAvgScore: -1 } }
    ]);

    // Global top 50
    const global = weeklyStats.slice(0, 50).map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isCurrentUser: entry._id.toString() === userId.toString()
    }));

    // College leaderboard — filter by same college
    const college = weeklyStats
      .filter(entry => entry.college === currentUser.college)
      .slice(0, 50)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        isCurrentUser: entry._id.toString() === userId.toString()
      }));

    // Find current user rank in global
    const globalRank = global.findIndex(e => e.isCurrentUser) + 1;
    const collegeRank = college.findIndex(e => e.isCurrentUser) + 1;

    const currentUserEntry = weeklyStats.find(e => e._id.toString() === userId.toString());

    res.json({
      global,
      college,
      currentUser: {
        name: currentUser.name,
        college: currentUser.college,
        globalRank: globalRank || null,
        collegeRank: collegeRank || null,
        weeklyAvgScore: currentUserEntry?.weeklyAvgScore ?? null,
        weeklySessionCount: currentUserEntry?.weeklySessionCount ?? 0,
      },
      weekStart: weekStart.toISOString()
    });

  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: 'Failed to load leaderboard' });
  }
};

module.exports = { getLeaderboard };