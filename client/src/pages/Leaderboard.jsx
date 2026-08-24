import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE from '../config/api.js';

// ═══════════════════════════════════════════════════════════════════════════
// Leaderboard — Blueprint Blue edition
//
// Supports:
//   1. This Week
//   2. Overall
//
// Each period supports:
//   - Global leaderboard
//   - College leaderboard
//
// Backend response expected:
// {
//   weekly: {
//     global: [],
//     college: [],
//     globalTotal: 0,
//     collegeTotal: 0,
//   },
//   overall: {
//     global: [],
//     college: [],
//     globalTotal: 0,
//     collegeTotal: 0,
//   },
//   currentUser: {
//     name,
//     college,
//     weekly: {...},
//     overall: {...},
//   },
//   weekStart
// }
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg: '#F0F4FF',
  card: '#FFFFFF',
  cardAlt: '#F8FAFF',

  text: '#0A1628',
  sub: '#3D5280',
  muted: '#7A8BAF',
  faint: '#A8B8D4',

  border: '#DDE5F7',
  borderMd: '#B8CAF0',
  borderStr: '#7FA3E8',

  blue50: '#EBF2FF',
  blue100: '#C7DAFF',
  blue200: '#9DBFFF',
  blue400: '#4D8FFF',
  blue500: '#1A6EFF',
  blue600: '#0057E8',
  blue700: '#0044C4',
  blue900: '#001F6B',

  cyan400: '#00C8F0',
  cyan500: '#00ADE0',
  cyan600: '#0093C4',
  cyanTint: '#E6F9FF',

  green: '#059669',
  greenTint: '#ECFDF5',

  amber: '#D97706',
  amberTint: '#FFFBEB',
  orange: '#EA580C',
  orangeTint: '#FFF7ED',

  red: '#DC2626',
  redTint: '#FEF2F2',

  // Podium metals
  gold: '#F59E0B',
  goldTint: '#FFFBEB',
  silver: '#94A3B8',
  silverTint: '#F8FAFC',
  bronze: '#D97706',
  bronzeTint: '#FFFBEB',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const scoreColor = (score) => {
  const s = Number(score) || 0;

  return s >= 80
    ? C.green
    : s >= 60
      ? C.blue500
      : s >= 40
        ? C.amber
        : C.orange;
};

const scoreBg = (score) => {
  const s = Number(score) || 0;

  return s >= 80
    ? C.greenTint
    : s >= 60
      ? C.blue50
      : s >= 40
        ? C.amberTint
        : C.orangeTint;
};

// Efficiency = average score per completed session.
// NOTE:
// This is intentionally the same concept as your previous UI.
const efficiency = (score, sessions) => {
  const numericScore = Number(score) || 0;
  const numericSessions = Number(sessions) || 0;

  return numericSessions > 0
    ? Math.round((numericScore / numericSessions) * 10) / 10
    : 0;
};

// Weekly-only visual rank movement mock.
// Overall leaderboard doesn't pretend to have historical movement data.
const mockDelta = (rank, seed = 0) => {
  const safeRank = Number(rank) || 0;
  const safeSeed = Number(seed) || 0;

  return ((safeSeed * 7 + safeRank * 3) % 9) - 4;
};

// ─── Animated counter ───────────────────────────────────────────────────────

const CountUp = ({ target = 0, duration = 1100, suffix = '' }) => {
  const safeTarget = Number(target) || 0;
  const [val, setVal] = useState(0);

  useEffect(() => {
    let animationFrame;
    let start = null;

    const step = (ts) => {
      if (!start) start = ts;

      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);

      setVal(Math.round(ease * safeTarget));

      if (p < 1) {
        animationFrame = requestAnimationFrame(step);
      }
    };

    animationFrame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [safeTarget, duration]);

  return (
    <span>
      {val}
      {suffix}
    </span>
  );
};

// ─── Rank delta badge ────────────────────────────────────────────────────────

const DeltaBadge = ({ delta, isNew = false, showDelta = true }) => {
  if (!showDelta) {
    return (
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 9,
          fontWeight: 700,
          color: C.faint,
        }}
      >
        —
      </span>
    );
  }

  if (isNew) {
    return (
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 9,
          fontWeight: 800,
          padding: '2px 7px',
          borderRadius: 99,
          background: C.cyanTint,
          color: C.cyan600,
          letterSpacing: '0.3px',
        }}
      >
        NEW
      </span>
    );
  }

  if (delta === 0) {
    return (
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 9,
          fontWeight: 700,
          color: C.faint,
        }}
      >
        —
      </span>
    );
  }

  const up = delta < 0;

  return (
    <span
      style={{
        fontFamily: F.mono,
        fontSize: 9,
        fontWeight: 800,
        padding: '2px 7px',
        borderRadius: 99,
        background: up ? C.greenTint : C.redTint,
        color: up ? C.green : C.red,
      }}
    >
      {up ? `↑${Math.abs(delta)}` : `↓${Math.abs(delta)}`}
    </span>
  );
};

// ─── Score mini-bar ──────────────────────────────────────────────────────────

const ScoreBar = ({ score, max }) => {
  const safeScore = Number(score) || 0;
  const safeMax = Number(max) || 0;

  const pct = safeMax > 0
    ? Math.min((safeScore / safeMax) * 100, 100)
    : 0;

  const color = scoreColor(safeScore);

  return (
    <div
      style={{
        width: 64,
        height: 4,
        borderRadius: 99,
        background: C.border,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 99,
          transition: 'width 0.9s cubic-bezier(.16,1,.3,1)',
        }}
      />
    </div>
  );
};

// ─── Percentile strip ────────────────────────────────────────────────────────

const PercentileStrip = ({ rank, total }) => {
  if (!rank || !total) return null;

  const safeRank = Number(rank);
  const safeTotal = Number(total);

  const pct = Math.max(
    0,
    Math.min(
      100,
      Math.round(((safeTotal - safeRank) / safeTotal) * 100)
    )
  );

  const color =
    pct >= 90
      ? C.green
      : pct >= 70
        ? C.blue500
        : pct >= 50
          ? C.amber
          : C.orange;

  const label =
    pct >= 90
      ? 'Top 10%'
      : pct >= 75
        ? 'Top 25%'
        : pct >= 50
          ? 'Top 50%'
          : 'Needs work';

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 9,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.5px',
          }}
        >
          PERCENTILE
        </span>

        <span
          style={{
            fontFamily: F.display,
            fontSize: 11,
            fontWeight: 800,
            color: '#fff',
          }}
        >
          {label} · {pct}th
        </span>
      </div>

      <div
        style={{
          height: 5,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.15)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${C.blue400}, ${C.cyan400})`,
            transition: 'width 1.2s cubic-bezier(.16,1,.3,1)',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
        }}
      >
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 8,
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          Rank #{safeRank}
        </span>

        <span
          style={{
            fontFamily: F.mono,
            fontSize: 8,
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          {safeTotal} total
        </span>
      </div>
    </div>
  );
};

// ─── Podium block ────────────────────────────────────────────────────────────

const PodiumBlock = ({
  entry,
  place,
  delay,
}) => {
  const heights = {
    1: 138,
    2: 104,
    3: 82,
  };

  const metals = {
    1: {
      medal: '🥇',
      color: C.gold,
      tint: C.goldTint,
      glow: 'rgba(245,158,11,0.35)',
      label: '1st',
    },

    2: {
      medal: '🥈',
      color: C.silver,
      tint: C.silverTint,
      glow: 'rgba(148,163,184,0.30)',
      label: '2nd',
    },

    3: {
      medal: '🥉',
      color: C.bronze,
      tint: C.bronzeTint,
      glow: 'rgba(217,119,6,0.28)',
      label: '3rd',
    },
  };

  const {
    medal,
    color,
    tint,
    glow,
    label,
  } = metals[place];

  const h = heights[place];
  const avatarSize = place === 1 ? 62 : 50;

  const avgScore = Number(entry?.avgScore) || 0;
  const sessionCount = Number(entry?.sessionCount) || 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flex: place === 1 ? 1.2 : 1,
        animation: `lbPodiumRise 0.72s cubic-bezier(.34,1.56,.64,1) ${delay}ms both`,
      }}
    >
      {/* Avatar + info above platform */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 14,
          padding: '0 4px',
        }}
      >
        <div
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: '50%',
            margin: '0 auto 6px',
            background: `linear-gradient(135deg, ${color}44, ${color}BB)`,
            border: `3px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: F.display,
            fontSize: place === 1 ? 24 : 19,
            fontWeight: 900,
            color,
            boxShadow: `0 6px 24px ${glow}`,
          }}
        >
          {entry?.name?.charAt(0).toUpperCase() ?? '?'}
        </div>

        <div
          style={{
            fontSize: place === 1 ? 20 : 16,
            marginBottom: 5,
          }}
        >
          {medal}
        </div>

        <div
          style={{
            fontFamily: F.display,
            fontSize: place === 1 ? 13.5 : 11.5,
            fontWeight: 800,
            color: C.text,
            maxWidth: 100,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry?.name ?? '—'}
        </div>

        <div
          style={{
            fontFamily: F.display,
            fontSize: place === 1 ? 19 : 15,
            fontWeight: 900,
            color,
            marginTop: 3,
            lineHeight: 1,
          }}
        >
          {entry ? (
            <CountUp
              target={avgScore}
              duration={900 + delay}
            />
          ) : (
            '—'
          )}

          <span
            style={{
              fontFamily: F.mono,
              fontSize: 9,
              fontWeight: 600,
              color: C.muted,
            }}
          >
            /100
          </span>
        </div>

        {entry && (
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9,
              color: C.muted,
              marginTop: 4,
              maxWidth: 108,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.college || '—'}
          </div>
        )}

        {entry && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 6,
              padding: '2px 8px',
              borderRadius: 99,
              background: C.blue50,
              border: `1px solid ${C.borderMd}`,
            }}
          >
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 8,
                color: C.blue600,
                fontWeight: 700,
              }}
            >
              ⚡
              {efficiency(avgScore, sessionCount)}
              /session
            </span>
          </div>
        )}
      </div>

      {/* Platform block */}
      <div
        style={{
          width: '100%',
          height: h,
          borderRadius: '12px 12px 0 0',
          background: `linear-gradient(180deg, ${tint} 0%, ${color}1A 100%)`,
          border: `2px solid ${color}44`,
          borderBottom: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 -6px 24px ${glow}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '30%',
            width: '40%',
            height: '100%',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        <span
          style={{
            fontFamily: F.display,
            fontSize: 30,
            fontWeight: 900,
            color: `${color}44`,
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const Leaderboard = () => {
  const navigate = useNavigate();

  const EMPTY_BOARD = useMemo(
    () => ({
      global: [],
      college: [],
      globalTotal: 0,
      collegeTotal: 0,
    }),
    []
  );

  const [activePeriod, setActivePeriod] = useState('weekly');
  const [activeTab, setActiveTab] = useState('global');

  const [leaderboardData, setLeaderboardData] = useState({
    weekly: {
      global: [],
      college: [],
      globalTotal: 0,
      collegeTotal: 0,
    },

    overall: {
      global: [],
      college: [],
      globalTotal: 0,
      collegeTotal: 0,
    },
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // ─── Load leaderboard ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/leaderboard`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        const data = await res.json();

        console.log('Leaderboard response:', {
          status: res.status,
          ok: res.ok,
          data,
        });

        if (!res.ok) {
          throw new Error(
            data?.message ||
              data?.error ||
              `Leaderboard request failed with ${res.status}`
          );
        }

        if (cancelled) return;

        setLeaderboardData({
          weekly: {
            ...EMPTY_BOARD,
            ...(data.weekly || {}),
          },

          overall: {
            ...EMPTY_BOARD,
            ...(data.overall || {}),
          },
        });

        setCurrentUser(data.currentUser ?? null);
      } catch (error) {
        console.error('Leaderboard load error:', error);

        if (!cancelled) {
          toast.error(
            error?.message || 'Failed to load leaderboard'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);

          requestAnimationFrame(() => {
            setTimeout(() => {
              setMounted(true);
            }, 50);
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [EMPTY_BOARD]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const selectedBoard =
    leaderboardData?.[activePeriod] || EMPTY_BOARD;

  const activeData =
    activeTab === 'global'
      ? selectedBoard.global || []
      : selectedBoard.college || [];

  const top3 = activeData.slice(0, 3);

  const maxScore = activeData.length
    ? Math.max(
        ...activeData.map(
          (entry) => Number(entry.avgScore) || 0
        )
      )
    : 100;

  const totalCount =
    activeTab === 'global'
      ? Number(selectedBoard.globalTotal) ||
        activeData.length
      : Number(selectedBoard.collegeTotal) ||
        activeData.length;

  const podiumOrder = [
    top3[1],
    top3[0],
    top3[2],
  ];

  const podiumPlace = [2, 1, 3];
  const podiumDelay = [220, 0, 360];

  const selectedUserPeriod =
    currentUser?.[activePeriod] || null;

  const userRank =
    activeTab === 'global'
      ? selectedUserPeriod?.globalRank ?? null
      : selectedUserPeriod?.collegeRank ?? null;

  const aheadOfUser =
    activeTab === 'global'
      ? selectedUserPeriod?.globalAheadOfUser ?? null
      : selectedUserPeriod?.collegeAheadOfUser ?? null;

  const currentUserScore =
    selectedUserPeriod?.avgScore ?? null;

  const currentUserSessions =
    selectedUserPeriod?.sessionCount ?? 0;

  const gapToNext =
    aheadOfUser &&
    currentUserScore !== null &&
    currentUserScore !== undefined
      ? Math.round(
          (Number(aheadOfUser.avgScore) -
            Number(currentUserScore)) *
            10
        ) / 10
      : null;

  const rankLabel =
    activeTab === 'global'
      ? 'GLOBAL RANK'
      : 'COLLEGE RANK';

  const periodLabel =
    activePeriod === 'weekly'
      ? 'THIS WEEK'
      : 'OVERALL';

  const pageDescription =
    activePeriod === 'weekly'
      ? 'Weekly rankings by average interview score — resets every Monday.'
      : 'Overall rankings based on your average score across all completed interviews.';

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          padding: '40px 24px',
        }}
      >
        <style>
          {`
            @keyframes lbShimmer {
              0% {
                background-position: -200px 0;
              }

              100% {
                background-position: 200px 0;
              }
            }

            .lb-sk {
              background:
                linear-gradient(
                  90deg,
                  ${C.border} 25%,
                  #EEF3FF 37%,
                  ${C.border} 63%
                );

              background-size: 400px 100%;
              animation: lbShimmer 1.4s ease infinite;
            }
          `}
        </style>

        <div
          style={{
            maxWidth: 780,
            margin: '0 auto',
          }}
        >
          <div
            className="lb-sk"
            style={{
              width: 240,
              height: 38,
              borderRadius: 8,
              marginBottom: 10,
            }}
          />

          <div
            className="lb-sk"
            style={{
              width: 360,
              height: 14,
              borderRadius: 6,
              marginBottom: 32,
            }}
          />

          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="lb-sk"
              style={{
                borderRadius: 14,
                height: 72,
                marginBottom: 10,
                opacity: 1 - i * 0.12,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

          * {
            box-sizing: border-box;
          }

          @keyframes lbPodiumRise {
            from {
              opacity: 0;
              transform: translateY(44px) scale(0.94);
            }

            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes lbSlideIn {
            from {
              opacity: 0;
              transform: translateX(-16px);
            }

            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes lbFadeUp {
            from {
              opacity: 0;
              transform: translateY(8px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes lbBannerGlow {
            0%,
            100% {
              box-shadow:
                0 8px 36px rgba(0, 87, 232, 0.30);
            }

            50% {
              box-shadow:
                0 8px 52px rgba(0, 173, 224, 0.38);
            }
          }

          .lb-row {
            transition:
              background 0.16s ease,
              transform 0.16s ease,
              box-shadow 0.16s ease;
          }

          .lb-row:hover {
            background: ${C.blue50} !important;
            transform: translateX(4px);
            box-shadow:
              inset 3px 0 0 ${C.blue500};
          }

          .lb-row-you:hover {
            transform: translateX(4px);
            box-shadow:
              inset 3px 0 0 ${C.cyan500} !important;
          }

          .lb-tab {
            transition: all 0.18s ease;
            cursor: pointer;
          }

          .lb-tab:hover:not(.lb-tab-active) {
            background: ${C.blue50} !important;
            color: ${C.blue600} !important;
          }

          .lb-cta-btn {
            transition:
              transform 0.15s,
              box-shadow 0.15s;
          }

          .lb-cta-btn:hover {
            transform: translateY(-1px);
            box-shadow:
              0 6px 20px rgba(0, 87, 232, 0.28) !important;
          }

          .lb-new-iv-btn {
            position: relative;
            overflow: hidden;
          }

          .lb-new-iv-btn::after {
            content: '';
            position: absolute;
            inset: 0;
            background:
              linear-gradient(
                120deg,
                transparent 30%,
                rgba(255, 255, 255, 0.28) 50%,
                transparent 70%
              );
            transform: translateX(-120%);
            transition: transform 0.6s ease;
          }

          .lb-new-iv-btn:hover::after {
            transform: translateX(120%);
          }

          .lb-new-iv-btn:hover {
            transform: translateY(-1px);
            box-shadow:
              0 8px 24px rgba(0, 87, 232, 0.34) !important;
          }

          @media (max-width: 700px) {
            .lb-hero {
              flex-direction: column !important;
              align-items: flex-start !important;
            }

            .lb-podium-wrap {
              padding:
                20px
                12px
                0 !important;
            }

            .lb-row {
              flex-wrap: wrap !important;
            }

            .lb-college-col {
              display: none !important;
            }

            .lb-efficiency-col {
              display: none !important;
            }
          }

          @media (max-width: 480px) {
            .lb-container {
              padding:
                20px
                14px
                64px !important;
            }

            .lb-banner {
              flex-direction: column !important;
              align-items: flex-start !important;
              gap: 14px !important;
            }
          }
        `}
      </style>

      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          backgroundImage:
            'radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%), radial-gradient(ellipse at 92% 10%, rgba(0,173,224,0.05) 0%, transparent 42%)',
          padding: '36px 24px 80px',
          fontFamily: F.body,
        }}
      >
        <div
          style={{
            maxWidth: 780,
            margin: '0 auto',
          }}
          className="lb-container"
        >
          {/* ── Page header ── */}
          <div
            style={{
              marginBottom: 28,
              animation: mounted
                ? 'lbFadeUp 0.45s ease'
                : 'none',
            }}
            className="lb-hero"
          >
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: C.blue50,
                  border: `1px solid ${C.borderMd}`,
                  borderRadius: 99,
                  padding: '4px 12px',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: C.green,
                    display: 'inline-block',
                    boxShadow:
                      '0 0 0 2px rgba(5,150,105,0.25)',
                  }}
                />

                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.blue600,
                    letterSpacing: '0.4px',
                  }}
                >
                  LIVE RANKINGS
                </span>
              </div>

              <h1
                style={{
                  margin: '0 0 6px',
                  fontFamily: F.display,
                  fontSize: 'clamp(28px, 4vw, 38px)',
                  fontWeight: 900,
                  color: C.text,
                  letterSpacing: '-1px',
                  lineHeight: 1.1,
                }}
              >
                Leaderboard
              </h1>

              <p
                style={{
                  margin: 0,
                  fontFamily: F.body,
                  fontSize: 14,
                  color: C.sub,
                }}
              >
                {pageDescription}
              </p>
            </div>
          </div>

          {/* ── Your rank banner ── */}
          {currentUser && (
            <div
              style={{
                background:
                  `linear-gradient(135deg, ${C.blue900} 0%, #001A50 45%, ${C.blue700} 80%, #003366 100%)`,
                borderRadius: 20,
                padding: '22px 26px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 20,
                animation:
                  'lbBannerGlow 4s ease-in-out infinite',
                position: 'relative',
                overflow: 'hidden',
              }}
              className="lb-banner"
            >
              {/* Dot-grid texture */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage:
                    'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  top: -30,
                  right: 80,
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(0,200,240,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.48)',
                    letterSpacing: '1.6px',
                    marginBottom: 6,
                  }}
                >
                  YOUR STANDING
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      flexShrink: 0,
                      background:
                        `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: F.display,
                      fontSize: 17,
                      fontWeight: 900,
                      color: '#fff',
                    }}
                  >
                    {currentUser.name
                      ?.charAt(0)
                      .toUpperCase() || '?'}
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: F.display,
                        fontSize: 17,
                        fontWeight: 800,
                        color: '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {currentUser.name}
                    </div>

                    <div
                      style={{
                        fontFamily: F.body,
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.55)',
                        marginTop: 1,
                      }}
                    >
                      {currentUser.college || '—'}
                    </div>
                  </div>
                </div>

                {/* Next rank gap */}
                {gapToNext !== null &&
                  gapToNext > 0 &&
                  userRank > 1 && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 8,
                        padding: '5px 10px',
                        borderRadius: 99,
                        background:
                          'rgba(0,200,240,0.12)',
                        border:
                          '1px solid rgba(0,200,240,0.22)',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: F.mono,
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: C.cyan400,
                        }}
                      >
                        +{gapToNext} pts to beat #
                        {userRank - 1} (
                        {aheadOfUser?.name?.split(' ')[0] ||
                          'next rank'}
                        )
                      </span>
                    </div>
                  )}

                {/* #1 */}
                {userRank === 1 && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 8,
                      padding: '5px 10px',
                      borderRadius: 99,
                      background:
                        'rgba(245,158,11,0.15)',
                      border:
                        '1px solid rgba(245,158,11,0.3)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: F.mono,
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: C.gold,
                      }}
                    >
                      🥇 You're #1{' '}
                      {activePeriod === 'weekly'
                        ? 'this week'
                        : 'overall'}{' '}
                      — defend it!
                    </span>
                  </div>
                )}

                <PercentileStrip
                  rank={userRank}
                  total={totalCount}
                />
              </div>

              <div
                style={{
                  textAlign: 'right',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                {userRank ? (
                  <>
                    <div
                      style={{
                        fontFamily: F.display,
                        fontSize: 44,
                        fontWeight: 900,
                        color: '#fff',
                        lineHeight: 1,
                        letterSpacing: '-2px',
                        background:
                          `linear-gradient(135deg, #fff 40%, ${C.cyan400} 100%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      #{userRank}
                    </div>

                    <div
                      style={{
                        fontFamily: F.mono,
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.45)',
                        marginTop: 3,
                        letterSpacing: '0.4px',
                      }}
                    >
                      {rankLabel}
                    </div>

                    {currentUserScore !== null &&
                      currentUserScore !== undefined && (
                        <div
                          style={{
                            marginTop: 8,
                            fontFamily: F.display,
                            fontSize: 14,
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.88)',
                          }}
                        >
                          {currentUserScore}
                          <span
                            style={{
                              fontFamily: F.mono,
                              fontSize: 10,
                              color:
                                'rgba(255,255,255,0.45)',
                            }}
                          >
                            /100
                          </span>
                        </div>
                      )}

                    <div
                      style={{
                        marginTop: 4,
                        fontFamily: F.mono,
                        fontSize: 9.5,
                        color: 'rgba(255,255,255,0.45)',
                      }}
                    >
                      ⚡{' '}
                      {efficiency(
                        currentUserScore,
                        currentUserSessions
                      )}
                      /session
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      fontFamily: F.body,
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.65)',
                      fontWeight: 500,
                      lineHeight: 1.6,
                    }}
                  >
                    {activePeriod === 'weekly' ? (
                      <>
                        Complete an interview
                        <br />
                        this week to get ranked
                      </>
                    ) : (
                      <>
                        Complete an interview
                        <br />
                        to get ranked overall
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Period tabs ── */}
          <div
            style={{
              background: C.card,
              border: `1.5px solid ${C.border}`,
              borderRadius: 14,
              padding: 4,
              display: 'flex',
              gap: 4,
              marginBottom: 10,
            }}
          >
            {[
              {
                id: 'weekly',
                label: '📅  This Week',
              },
              {
                id: 'overall',
                label: '🏆  Overall',
              },
            ].map((period) => (
              <button
                key={period.id}
                onClick={() =>
                  setActivePeriod(period.id)
                }
                className={`lb-tab${
                  activePeriod === period.id
                    ? ' lb-tab-active'
                    : ''
                }`}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: 'none',
                  fontFamily: F.body,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background:
                    activePeriod === period.id
                      ? `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`
                      : 'transparent',
                  color:
                    activePeriod === period.id
                      ? '#fff'
                      : C.sub,
                  boxShadow:
                    activePeriod === period.id
                      ? '0 2px 14px rgba(0,87,232,0.28)'
                      : 'none',
                  transition: 'all 0.18s',
                }}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* ── Scope tabs ── */}
          <div
            style={{
              background: C.card,
              border: `1.5px solid ${C.border}`,
              borderRadius: 14,
              padding: 4,
              display: 'flex',
              gap: 4,
              marginBottom: 22,
            }}
          >
            {['global', 'college'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`lb-tab${
                  activeTab === tab
                    ? ' lb-tab-active'
                    : ''
                }`}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: 'none',
                  fontFamily: F.body,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background:
                    activeTab === tab
                      ? `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`
                      : 'transparent',
                  color:
                    activeTab === tab
                      ? '#fff'
                      : C.sub,
                  boxShadow:
                    activeTab === tab
                      ? '0 2px 14px rgba(0,87,232,0.28)'
                      : 'none',
                  transition: 'all 0.18s',
                }}
              >
                {tab === 'global'
                  ? '🌍  Global'
                  : `🏫  ${
                      currentUser?.college || 'College'
                    }`}
              </button>
            ))}
          </div>

          {/* ── Podium ── */}
          {top3.length >= 1 && (
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 20,
                padding: '26px 24px 0',
                marginBottom: 16,
                overflow: 'hidden',
                boxShadow:
                  '0 4px 24px rgba(26,110,255,0.08)',
              }}
              className="lb-podium-wrap"
            >
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.blue500,
                  letterSpacing: '1.5px',
                  textAlign: 'center',
                  marginBottom: 22,
                }}
              >
                🏆 TOP PERFORMERS {periodLabel}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 8,
                  height: 320,
                }}
              >
                {podiumOrder.map((entry, i) => (
                  <PodiumBlock
                    key={`podium-${podiumPlace[i]}`}
                    entry={entry}
                    place={podiumPlace[i]}
                    delay={podiumDelay[i]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Full table ── */}
          {activeData.length === 0 ? (
            <div
              style={{
                background: C.card,
                border:
                  `1.5px dashed ${C.borderMd}`,
                borderRadius: 20,
                padding: '64px 24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 46,
                  marginBottom: 12,
                }}
              >
                🏆
              </div>

              <div
                style={{
                  fontFamily: F.display,
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.text,
                  marginBottom: 8,
                }}
              >
                {activePeriod === 'weekly'
                  ? 'No rankings this week'
                  : 'No overall rankings yet'}
              </div>

              <div
                style={{
                  fontFamily: F.body,
                  fontSize: 14,
                  color: C.sub,
                  marginBottom: 24,
                }}
              >
                {activePeriod === 'weekly'
                  ? 'Complete an interview this week to appear here.'
                  : 'Complete an interview to appear on the overall leaderboard.'}
              </div>

              <button
                onClick={() => navigate('/interview')}
                className="lb-new-iv-btn"
                style={{
                  background:
                    `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
                  border: 'none',
                  color: '#fff',
                  fontFamily: F.body,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '11px 28px',
                  borderRadius: 11,
                  cursor: 'pointer',
                  boxShadow:
                    '0 4px 16px rgba(0,87,232,0.28)',
                }}
              >
                Start Interview →
              </button>
            </div>
          ) : (
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow:
                  '0 4px 24px rgba(26,110,255,0.07)',
              }}
            >
              {/* Column header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  padding: '11px 20px',
                  borderBottom:
                    `1px solid ${C.border}`,
                  background: C.cardAlt,
                }}
              >
                <div
                  style={{
                    width: 46,
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: C.muted,
                    letterSpacing: '0.5px',
                  }}
                >
                  RANK
                </div>

                <div style={{ width: 44 }} />

                <div
                  style={{
                    flex: 1,
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: C.muted,
                    letterSpacing: '0.5px',
                  }}
                >
                  NAME
                </div>

                <div
                  style={{
                    width: 110,
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: C.muted,
                    letterSpacing: '0.5px',
                  }}
                  className="lb-college-col"
                >
                  COLLEGE
                </div>

                <div
                  style={{
                    width: 68,
                    textAlign: 'center',
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: C.muted,
                    letterSpacing: '0.5px',
                  }}
                  className="lb-efficiency-col"
                >
                  EFF.
                </div>

                <div
                  style={{
                    width: 90,
                    textAlign: 'right',
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: C.muted,
                    letterSpacing: '0.5px',
                  }}
                >
                  SCORE
                </div>
              </div>

              {/* Rows */}
              {activeData.map((entry, idx) => {
                const numericRank =
                  Number(entry.rank) || idx + 1;

                const numericScore =
                  Number(entry.avgScore) || 0;

                const sessionCount =
                  Number(entry.sessionCount) || 0;

                const sColor =
                  scoreColor(numericScore);

                const isYou =
                  Boolean(entry.isCurrentUser);

                const delta =
                  activePeriod === 'weekly'
                    ? mockDelta(
                        numericRank,
                        idx +
                          String(
                            entry._id || ''
                          ).charCodeAt(0) || 0
                      )
                    : 0;

                const isNew =
                  activePeriod === 'weekly' &&
                  sessionCount === 1 &&
                  numericRank > 3;

                const eff = efficiency(
                  numericScore,
                  sessionCount
                );

                return (
                  <div
                    key={
                      entry._id ||
                      `${activePeriod}-${activeTab}-${idx}`
                    }
                    className={`lb-row${
                      isYou
                        ? ' lb-row-you'
                        : ''
                    }`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0,
                      padding: '13px 20px',
                      borderBottom:
                        idx < activeData.length - 1
                          ? `1px solid ${C.border}`
                          : 'none',
                      background: isYou
                        ? `linear-gradient(90deg, ${C.cyanTint} 0%, ${C.blue50} 100%)`
                        : C.card,
                      animation:
                        `lbSlideIn 0.32s ease ${Math.min(
                          idx * 45,
                          600
                        )}ms both`,
                      cursor: 'default',
                    }}
                  >
                    {/* Rank */}
                    <div
                      style={{
                        width: 46,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: F.mono,
                          fontSize: 13,
                          fontWeight: 800,
                          color:
                            numericRank <= 3
                              ? [
                                  C.gold,
                                  C.silver,
                                  C.bronze,
                                ][numericRank - 1]
                              : C.muted,
                        }}
                      >
                        #{numericRank}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div
                      style={{
                        width: 44,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          flexShrink: 0,
                          background: isYou
                            ? `linear-gradient(135deg, ${C.blue600}, ${C.cyan500})`
                            : numericRank <= 3
                              ? `linear-gradient(135deg, ${
                                  [
                                    C.gold,
                                    C.silver,
                                    C.bronze,
                                  ][numericRank - 1]
                                }44, ${
                                  [
                                    C.gold,
                                    C.silver,
                                    C.bronze,
                                  ][numericRank - 1]
                                }99)`
                              : C.blue50,
                          border:
                            `2px solid ${
                              isYou
                                ? C.cyan400
                                : numericRank <= 3
                                  ? `${
                                      [
                                        C.gold,
                                        C.silver,
                                        C.bronze,
                                      ][
                                        numericRank - 1
                                      ]
                                    }66`
                                  : C.borderMd
                            }`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: F.display,
                          fontSize: 14,
                          fontWeight: 800,
                          color: isYou
                            ? '#fff'
                            : numericRank <= 3
                              ? [
                                  C.gold,
                                  C.silver,
                                  C.bronze,
                                ][numericRank - 1]
                              : C.blue600,
                          boxShadow: isYou
                            ? '0 2px 10px rgba(0,173,224,0.30)'
                            : 'none',
                        }}
                      >
                        {entry.name
                          ?.charAt(0)
                          .toUpperCase() || '?'}
                      </div>
                    </div>

                    {/* Name + badges */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          marginBottom: 2,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: F.body,
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: C.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entry.name || 'Unknown'}
                        </span>

                        {isYou && (
                          <span
                            style={{
                              fontFamily: F.mono,
                              fontSize: 9,
                              fontWeight: 800,
                              color: C.cyan600,
                              background: C.cyanTint,
                              border:
                                '1px solid #A0E8FA',
                              padding: '1px 7px',
                              borderRadius: 99,
                              flexShrink: 0,
                            }}
                          >
                            YOU
                          </span>
                        )}

                        <DeltaBadge
                          delta={delta}
                          isNew={isNew}
                          showDelta={
                            activePeriod ===
                            'weekly'
                          }
                        />
                      </div>

                      <div
                        style={{
                          fontFamily: F.mono,
                          fontSize: 10,
                          color: C.muted,
                        }}
                      >
                        {sessionCount} session
                        {sessionCount !== 1
                          ? 's'
                          : ''}
                        {activePeriod ===
                        'weekly'
                          ? ' this week'
                          : ' total'}
                      </div>
                    </div>

                    {/* College */}
                    <div
                      style={{
                        width: 110,
                        fontFamily: F.body,
                        fontSize: 11,
                        color: C.muted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: 8,
                      }}
                      className="lb-college-col"
                    >
                      {entry.college || '—'}
                    </div>

                    {/* Efficiency */}
                    <div
                      style={{
                        width: 68,
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                      className="lb-efficiency-col"
                    >
                      <span
                        style={{
                          fontFamily: F.mono,
                          fontSize: 11,
                          fontWeight: 700,
                          color:
                            eff >= 70
                              ? C.green
                              : eff >= 50
                                ? C.blue500
                                : C.muted,
                        }}
                      >
                        {eff}
                      </span>
                    </div>

                    {/* Score */}
                    <div
                      style={{
                        width: 90,
                        textAlign: 'right',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: F.display,
                          fontSize: 16,
                          fontWeight: 800,
                          color: sColor,
                          marginBottom: 5,
                        }}
                      >
                        {numericScore}

                        <span
                          style={{
                            fontFamily: F.mono,
                            fontSize: 9,
                            fontWeight: 600,
                            color: C.muted,
                          }}
                        >
                          /100
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <ScoreBar
                          score={numericScore}
                          max={maxScore}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Stat summary strip ── */}
          {activeData.length >= 1 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(3, 1fr)',
                gap: 10,
                marginTop: 14,
              }}
            >
              {[
                {
                  label: 'TOP SCORE',
                  val: `${maxScore}/100`,
                  color: C.gold,
                },

                {
                  label: 'FIELD SIZE',
                  val: `${totalCount} ${
                    totalCount === 1
                      ? 'student'
                      : 'students'
                  }`,
                  color: C.blue600,
                },

                {
                  label: 'FIELD AVG',
                  val: `${
                    activeData.length
                      ? Math.round(
                          activeData.reduce(
                            (sum, entry) =>
                              sum +
                              (Number(
                                entry.avgScore
                              ) || 0),
                            0
                          ) /
                            activeData.length
                        )
                      : 0
                  }/100`,
                  color: C.cyan600,
                },
              ].map(
                ({
                  label,
                  val,
                  color,
                }) => (
                  <div
                    key={label}
                    style={{
                      textAlign: 'center',
                      padding: '12px 8px',
                      background: C.card,
                      border:
                        `1px solid ${C.border}`,
                      borderRadius: 14,
                      boxShadow:
                        '0 1px 8px rgba(26,110,255,0.06)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: F.mono,
                        fontSize: 8.5,
                        fontWeight: 700,
                        color: C.muted,
                        letterSpacing: '0.5px',
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>

                    <div
                      style={{
                        fontFamily: F.display,
                        fontSize: 15,
                        fontWeight: 800,
                        color,
                      }}
                    >
                      {val}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ── CTA footer ── */}
          <div
            style={{
              marginTop: 16,
              padding: '22px 26px',
              borderRadius: 18,
              background:
                `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 55%, ${C.cyan600} 100%)`,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
              boxShadow:
                '0 12px 40px rgba(0,31,107,0.26)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                position: 'relative',
              }}
            >
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 5,
                }}
              >
                CLIMB THE RANKS
              </div>

              <div
                style={{
                  fontFamily: F.display,
                  fontSize: 17,
                  fontWeight: 800,
                  marginBottom: 4,
                }}
              >
                {activePeriod === 'weekly'
                  ? 'Every interview moves you up this week.'
                  : 'Every interview contributes to your overall standing.'}
              </div>

              <div
                style={{
                  fontFamily: F.body,
                  fontSize: 12.5,
                  color:
                    'rgba(255,255,255,0.72)',
                }}
              >
                {activePeriod === 'weekly'
                  ? 'Weekly rankings reset every Monday. Your overall record stays intact.'
                  : 'Overall rankings use all of your completed interviews and never reset.'}
              </div>
            </div>

            <button
              onClick={() => navigate('/interview')}
              className="lb-cta-btn"
              style={{
                flexShrink: 0,
                background: '#fff',
                color: C.blue700,
                padding: '11px 20px',
                borderRadius: 10,
                border: 'none',
                fontFamily: F.body,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow:
                  '0 2px 10px rgba(0,0,0,0.14)',
              }}
            >
              Practice Now →
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Leaderboard;