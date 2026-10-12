const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const {
  buildDimensionProfile,
  computeIRS,
  tierForScoreGated,
  computeTierReadiness,
  findBlockingDimension,
  TIERS,
  stdDev,
  trendSlope,
} = require('../utils/scoringModel');
const { evaluateBadges } = require('../utils/badgeEngine');
const { renderProfileCard, themeFor } = require('../services/ogImage');

const ARCHETYPES = [
  { id: 'inconsistentGenius', label: 'Inconsistent Genius' },
  { id: 'consistentClimber',  label: 'Consistent Climber'  },
  { id: 'speedRunner',        label: 'Speed Runner'        },
  { id: 'deepThinker',        label: 'Deep Thinker'        },
  { id: 'pressureCooker',     label: 'Pressure Cooker'     },
];

const deriveArchetype = (scores, avgTimePerQ) => {
  if (scores.length < 2) return ARCHETYPES[1];
  const sd    = stdDev(scores);
  const slope = trendSlope(scores);
  return sd > 18                                  ? ARCHETYPES[0]
    : slope > 2                                   ? ARCHETYPES[1]
    : avgTimePerQ != null && avgTimePerQ < 22     ? ARCHETYPES[2]
    : avgTimePerQ != null && avgTimePerQ > 52     ? ARCHETYPES[3]
    : ARCHETYPES[4];
};

const TIER_RANK = { platinum: 4, gold: 3, silver: 2, bronze: 1 };

const pickHeroBadge = (badges) => {
  const unlocked = badges.filter((b) => b.unlocked);
  if (!unlocked.length) return null;
  return [...unlocked].sort((a, b) => {
    const tierDiff = (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0);
    if (tierDiff !== 0) return tierDiff;
    return (b.meta ? 1 : 0) - (a.meta ? 1 : 0);
  })[0];
};

const norm = (v) => String(v || '').trim().toLowerCase();

// WHY: one aggregation feeds every "where do I stand" number on the share
// card (overall, college, state). College/state are matched case-insensitively
// because both are free-text / onboarding values.
const getGlobalStanding = async (userId, user = {}) => {
  const rows = await Session.aggregate([
    { $match: { status: 'completed' } },
    { $addFields: { resolvedUser: { $ifNull: ['$user', '$userId'] } } },
    { $match: { resolvedUser: { $ne: null } } },
    { $group: { _id: '$resolvedUser', avgScore: { $avg: '$averageScore' } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $project: { avgScore: 1, college: '$u.college', state: '$u.state' } },
    { $sort: { avgScore: -1 } },
  ]);

  const empty = {
    rank: null, totalCandidates: rows.length, percentile: null, beatCount: 0,
    collegeRank: null, collegeTotal: 0, stateRank: null, stateTotal: 0,
  };
  const rankIndex = rows.findIndex((r) => r._id.toString() === userId.toString());
  if (rankIndex === -1 || rows.length === 0) return empty;

  const totalCandidates = rows.length;
  const rank = rankIndex + 1;
  const percentile = totalCandidates > 1
    ? Math.round(((totalCandidates - rank) / (totalCandidates - 1)) * 100)
    : 100;

  const within = (key) => {
    const mine = norm(user[key]);
    if (!mine) return { rank: null, total: 0 };
    const group = rows.filter((r) => norm(r[key]) === mine);
    const idx = group.findIndex((r) => r._id.toString() === userId.toString());
    return { rank: idx >= 0 ? idx + 1 : null, total: group.length };
  };
  const col = within('college');
  const st  = within('state');

  return {
    rank, totalCandidates, percentile,
    // WHY: standard "Top X%" = rank / total (rank 1 of 15 → Top 7%), never inflated to Top 1%.
    topPercent: Math.max(1, Math.ceil((rank / totalCandidates) * 100)),
    beatCount: totalCandidates - rank,
    collegeRank: col.rank, collegeTotal: col.total,
    stateRank: st.rank, stateTotal: st.total,
  };
};

exports.getGlobalStanding = getGlobalStanding;

const buildProfileReport = async (user) => {
  const sessions = await Session.find({
    $or: [{ userId: user._id }, { user: user._id }],
    status: 'completed',
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!sessions.length) {
    return {
      name:            user.name,
      college:         user.college || null,
      avatar:          user.avatar || null,
      totalInterviews: 0,
      hasData:         false,
    };
  }

  const scores       = sessions.map((s) => s.totalScore).filter((s) => typeof s === 'number');
  const averageScore = scores.length ? Math.round(scores.reduce((a, s) => a + s, 0) / scores.length) : 0;
  const bestScore    = scores.length ? Math.max(...scores) : 0;

  const scoreTrend = sessions.map((s, i) => ({
    interview: i + 1,
    score:     s.totalScore || 0,
    date:      s.createdAt,
  }));

  const topicStats = {};
  sessions.forEach((session) => {
    session.questions?.forEach((question) => {
      const topic = question.topic || 'General';
      const score = typeof question.score === 'number' ? question.score : null;
      if (score === null) return;
      if (!topicStats[topic]) topicStats[topic] = { topic, totalScore: 0, count: 0 };
      topicStats[topic].totalScore += score;
      topicStats[topic].count      += 1;
    });
  });

  const topicPerformance = Object.values(topicStats).map((t) => ({
    topic:        t.topic,
    averageScore: Math.round(t.totalScore / t.count),
  }));

  const topicPerfDetail = topicPerformance.map((t) => ({ ...t, attempts: t.count || 1 }));
  const { profile: dimensionProfile } = buildDimensionProfile(topicPerfDetail);

  let totalAnswered = 0;
  const difficultyMix = { easy: 0, medium: 0, hard: 0 };
  sessions.forEach((session) => {
    (session.questions || []).forEach((question) => {
      if (question.skipped || !question.userAnswer || question.userAnswer === 'Skipped') return;
      totalAnswered += 1;
      const d = String(question.difficulty || 'medium').toLowerCase();
      if (difficultyMix[d] != null) difficultyMix[d] += 1;
      else difficultyMix.medium += 1;
    });
  });

  // FIX: pass `totalAnswered` (not totalAnsweredQuestions) — matches what scoringModel.js expects
  const irs = computeIRS({
    dimensionProfile,
    scoreTrend,
    topicPerformance,
    averageScore,
    totalAnswered,
    difficultyMix,
  });

  const { tier, isGated, sessionsNeededForRawTier } = tierForScoreGated(irs, sessions.length);

  const tierIndex = TIERS.findIndex((t) => t.label === tier.label);
  const nextTier  = TIERS[tierIndex + 1] || null;
  let tierProgress = null;
  if (nextTier) {
    const readiness = computeTierReadiness(dimensionProfile, nextTier, sessions.length);
    const blocker   = findBlockingDimension(readiness);
    tierProgress = {
      label:             nextTier.label,
      readinessPct:      readiness.readinessPct,
      confidenceGate:    readiness.confidenceGate,
      blockingDimension: blocker
        ? { key: blocker.key, label: blocker.label, gap: Math.round(blocker.gap) }
        : null,
    };
  }

  const answeredQuestions = sessions
    .flatMap((s) => s.questions || [])
    .filter((q) => q.userAnswer && q.userAnswer !== 'Skipped' && typeof q.timeTaken === 'number');

  const avgTimePerQ = answeredQuestions.length
    ? Math.round(answeredQuestions.reduce((a, q) => a + q.timeTaken, 0) / answeredQuestions.length)
    : null;

  const archetype    = deriveArchetype(scoreTrend.map((s) => s.score), avgTimePerQ);
  const activeDims  = dimensionProfile.filter((d) => d.hasData);
  const strongestDim = [...activeDims].sort((a, b) => b.score - a.score)[0] || null;
  const weakestDim   = [...activeDims].sort((a, b) => a.score - b.score)[0] || null;
  const badges       = evaluateBadges({ user, sessions });
  const heroBadge    = pickHeroBadge(badges);
  const standing     = await getGlobalStanding(user._id, user);

  return {
    name:                     user.name,
    college:                  user.college || null,
    avatar:                   user.avatar || null,
    hasData:                  true,
    totalInterviews:          sessions.length,
    averageScore,
    bestScore,
    irs,
    tier,
    tierGated:                isGated,
    sessionsNeededForRawTier,
    nextTier:                 tierProgress,
    archetype,
    strongestDim,
    weakestDim,
    dimensionProfile,
    scoreTrend,
    badges,
    heroBadge,
    rank:                     standing.rank,
    totalCandidates:          standing.totalCandidates,
    percentile:               standing.percentile,
    topPercent:               standing.topPercent ?? null,
    beatCount:                standing.beatCount,
    collegeRank:              standing.collegeRank,
    collegeTotal:             standing.collegeTotal,
    stateName:                user.state || null,
    stateRank:                standing.stateRank,
    stateTotal:               standing.stateTotal,
    streak:                   { current: user.streak?.current || 0, longest: user.streak?.longest || 0 },
    badgesUnlocked:           badges.filter((b) => b.unlocked).length,
    badgesTotal:              badges.length,
    bestScoreEver:            bestScore,
  };
};

// FIX: renamed from getProfileBySlug → getPublicProfileBySlug (update your routes file)
exports.getPublicProfileBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: 'Missing slug' });

    const user = await User.findOne({ shareSlug: slug }).lean();
    if (!user) return res.status(404).json({ error: 'Profile not found' });

    const report = await buildProfileReport(user);
    res.json(report);
  } catch (error) {
    console.error('Public profile lookup error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
};

exports.getShareLink = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.shareSlug) {
      let slug;
      let attempts = 0;
      do {
        slug     = crypto.randomBytes(5).toString('base64url');
        attempts += 1;
      } while (await User.exists({ shareSlug: slug }) && attempts < 5);

      user.shareSlug = slug;
      await user.save();
    }

    res.json({ slug: user.shareSlug });
  } catch (error) {
    console.error('Get share link error:', error);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const report = await buildProfileReport(user);
    res.json(report);
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Link-preview support (WhatsApp / LinkedIn / X / Telegram)
// ─────────────────────────────────────────────────────────────────────────────

const OG_TTL_MS = 5 * 60 * 1000;
const OG_MAX_ENTRIES = 200;
const ogCache = new Map(); // slug -> { buf, exp }

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const apiUrl = (req) => {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/$/, '');
  const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0];
  return `${proto}://${req.get('host')}`;
};
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validSlug = (slug) => typeof slug === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(slug);

// GET /profile/:slug/og.png — the 1200×630 preview image
exports.getProfileOgImage = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!validSlug(slug)) return res.status(404).end();

    const hit = ogCache.get(slug);
    let buf = hit && hit.exp > Date.now() ? hit.buf : null;

    if (!buf) {
      const user = await User.findOne({ shareSlug: slug }).lean();
      if (!user) return res.status(404).end();
      const report = await buildProfileReport(user);
      if (!report.hasData) return res.status(404).end();
      buf = await renderProfileCard(report, clientUrl());
      if (ogCache.size >= OG_MAX_ENTRIES) ogCache.delete(ogCache.keys().next().value);
      ogCache.set(slug, { buf, exp: Date.now() + OG_TTL_MS });
    }

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    return res.send(buf);
  } catch (error) {
    console.error('OG image error:', error);
    return res.status(500).end();
  }
};

// GET /profile/:slug/share — tiny HTML page with Open Graph tags for crawlers.
// Real browsers are bounced straight to the SPA profile page.
exports.getProfileSharePage = async (req, res) => {
  const { slug } = req.params;
  const target = validSlug(slug) ? `${clientUrl()}/p/${slug}` : clientUrl();
  try {
    let title = 'MockMate — AI mock interviews that rank you';
    let desc = 'Take a free AI mock interview, get your readiness score and see how you rank.';
    let image = '';

    if (validSlug(slug)) {
      const user = await User.findOne({ shareSlug: slug }).lean();
      if (user) {
        const r = await buildProfileReport(user);
        if (r.hasData) {
          const irs = Math.round(r.irs ?? r.averageScore ?? 0);
          const theme = themeFor(r.tier);
          const level = theme.level.charAt(0) + theme.level.slice(1).toLowerCase();
          const bits = [];
          if (r.topPercent != null && r.totalCandidates >= 10) bits.push(`Top ${r.topPercent}%`);
          else if (r.rank != null) bits.push(`Ranked #${r.rank} of ${r.totalCandidates}`);
          if (r.collegeRank != null && r.college) bits.push(`#${r.collegeRank} at ${r.college}`);
          if (r.stateRank != null && r.stateName) bits.push(`#${r.stateRank} in ${r.stateName}`);
          title = `${r.name} reached ${level} level on MockMate — ${irs}/100`;
          desc = `${bits.length ? `${bits.join(' · ')}. ` : ''}Think you can beat ${irs}? Take the free AI mock interview.`;
          image = `${apiUrl(req)}/profile/${slug}/og.png`;
        }
      }
    }

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MockMate">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(target)}">
${image ? `<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body><script>location.replace(${JSON.stringify(target)});</script>
<p><a href="${esc(target)}">Open ${esc(title)}</a></p></body></html>`;

    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
    return res.send(html);
  } catch (error) {
    console.error('Share page error:', error);
    return res.redirect(302, target);
  }
};

// PATCH /profile/state — lets existing users add the state that unlocks state rank
const VALID_STATES = ['Andhra Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu & Kashmir','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','Uttarakhand','West Bengal','Other'];

exports.updateMyState = async (req, res) => {
  try {
    const { state } = req.body || {};
    if (typeof state !== 'string' || !VALID_STATES.includes(state)) {
      return res.status(400).json({ error: 'Invalid state' });
    }
    await User.findByIdAndUpdate(req.user._id, { state });
    ogCache.clear();
    return res.json({ state });
  } catch (error) {
    console.error('Update state error:', error);
    return res.status(500).json({ error: 'Failed to update state' });
  }
};
