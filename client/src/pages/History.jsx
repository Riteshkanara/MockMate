import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInterviewHistory } from '../Services/interviewService';
import { C, F } from '../styles/tokens';

// ═══════════════════════════════════════════════════════════════════════════
// History — Blueprint Blue edition
// Every visible score on this page is normalized to 0–100.
// ═══════════════════════════════════════════════════════════════════════════



// ─────────────────────────────────────────────────────────────────────────────
// SCORE NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

const normalizeScore = session => {
  const averageScore = Number(
    session?.averageScore
  );

  if (
    Number.isFinite(averageScore) &&
    averageScore >= 0 &&
    averageScore <= 100
  ) {
    return Math.round(averageScore);
  }

  const directScore = Number(
    session?.score
  );

  if (
    Number.isFinite(directScore) &&
    directScore >= 0 &&
    directScore <= 100
  ) {
    return Math.round(directScore);
  }

  // Defensive legacy fallback:
  // only use totalScore if it can safely represent a 0–100
  // score directly or can be derived from question count.
  const totalScore = Number(
    session?.totalScore
  );

  if (
    Number.isFinite(totalScore) &&
    totalScore >= 0
  ) {
    const questionCount =
      Array.isArray(session?.questions)
        ? session.questions.length
        : Number(
            session?.questionCount || 0
          );

    if (
      totalScore > 100 &&
      questionCount > 0
    ) {
      return Math.max(
        0,
        Math.min(
          100,
          Math.round(
            totalScore / questionCount
          )
        )
      );
    }

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(totalScore)
      )
    );
  }

  return 0;
};

const scoreColor = score =>
  score >= 80
    ? C.green
    : score >= 60
      ? C.blue500
      : score >= 40
        ? C.amber
        : C.orange;

const scoreBg = score =>
  score >= 80
    ? C.greenTint
    : score >= 60
      ? C.blue50
      : score >= 40
        ? C.amberTint
        : C.orangeTint;

// ─────────────────────────────────────────────────────────────────────────────
// Tiny sparkline
// ─────────────────────────────────────────────────────────────────────────────

const Sparkline = ({
  values = [],
  color,
}) => {
  if (values.length < 2) {
    return null;
  }

  const w = 56;
  const h = 20;
  const pad = 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map(
    (value, index) => {
      const x =
        pad +
        (index /
          (values.length - 1)) *
          (w - pad * 2);

      const y =
        h -
        pad -
        ((value - min) / range) *
          (h - pad * 2);

      return `${x.toFixed(
        1
      )},${y.toFixed(1)}`;
    }
  );

  const lastPoint =
    pts[pts.length - 1].split(',');

  return (
    <svg
      width={w}
      height={h}
      style={{
        flexShrink: 0,
      }}
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />

      <circle
        cx={lastPoint[0]}
        cy={lastPoint[1]}
        r="2"
        fill={color}
      />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Score ring
// ─────────────────────────────────────────────────────────────────────────────

const ScoreRing = ({
  score,
  size = 56,
  strokeWidth = 5,
}) => {
  const safeScore = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  );

  const r =
    size / 2 - strokeWidth;

  const circ =
    2 * Math.PI * r;

  const offset =
    circ -
    (safeScore / 100) * circ;

  const color =
    scoreColor(safeScore);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          transform:
            'rotate(-90deg)',
        }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={C.border}
          strokeWidth={strokeWidth}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition:
              'stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)',
          }}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: F.display,
            fontSize: 15,
            fontWeight: 800,
            color,
            lineHeight: 1,
          }}
        >
          {safeScore}
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Relative time
// ─────────────────────────────────────────────────────────────────────────────

const relativeTime = date => {
  if (!date) return '';

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return '';
  }

  const diffMs =
    Date.now() - d.getTime();

  const days = Math.floor(
    diffMs /
      (1000 * 60 * 60 * 24)
  );

  if (days <= 0) {
    return 'Today';
  }

  if (days === 1) {
    return 'Yesterday';
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  if (days < 30) {
    return `${Math.floor(
      days / 7
    )}w ago`;
  }

  return `${Math.floor(
    days / 30
  )}mo ago`;
};

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY PAGE
// ═══════════════════════════════════════════════════════════════════════════

const History = () => {
  const navigate =
    useNavigate();

  const [history, setHistory] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [filter, setFilter] =
    useState('all');

  const [sort, setSort] =
    useState('recent');

  const [error, setError] =
    useState('');

  const [mounted, setMounted] =
    useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD HISTORY
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const loadHistory =
      async () => {
        try {
          setLoading(true);
          setError('');

          const data =
            await getInterviewHistory();

          if (cancelled) {
            return;
          }

          const sessions =
            Array.isArray(
              data?.sessions
            )
              ? data.sessions
              : Array.isArray(
                    data?.history
                  )
                ? data.history
                : [];

          setHistory(sessions);
        } catch (err) {
          if (cancelled) {
            return;
          }

          console.error(
            'Failed to load interview history:',
            err
          );

          setError(
            err?.response?.data
              ?.message ||
              'Unable to load your interview history.'
          );
        } finally {
          if (cancelled) {
            return;
          }

          setLoading(false);

          requestAnimationFrame(
            () =>
              setTimeout(
                () =>
                  setMounted(
                    true
                  ),
                50
              )
          );
        }
      };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // FILTER + SORT
  // ─────────────────────────────────────────────────────────────────────────

  const completedHistory =
    useMemo(() => {
      let result = [
        ...history,
      ];

      if (filter !== 'all') {
        result =
          result.filter(
            session =>
              session.mode
                ?.toLowerCase() ===
              filter.toLowerCase()
          );
      }

      result.sort(
        (a, b) => {
          if (
            sort === 'score'
          ) {
            return (
              normalizeScore(b) -
              normalizeScore(a)
            );
          }

          return (
            new Date(
              b.createdAt || 0
            ) -
            new Date(
              a.createdAt || 0
            )
          );
        }
      );

      return result;
    }, [
      history,
      filter,
      sort,
    ]);

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE STATS
  // ─────────────────────────────────────────────────────────────────────────

  const stats =
    useMemo(() => {
      const scores =
        history
          .map(normalizeScore)
          .filter(score =>
            Number.isFinite(
              score
            )
          );

      const average =
        scores.length
          ? Math.round(
              scores.reduce(
                (
                  sum,
                  score
                ) =>
                  sum + score,
                0
              ) /
                scores.length
            )
          : 0;

      const best =
        scores.length
          ? Math.max(...scores)
          : 0;

      // Chronological scores for trend.
      const chronological =
        [...history]
          .sort(
            (a, b) =>
              new Date(
                a.createdAt || 0
              ) -
              new Date(
                b.createdAt || 0
              )
          )
          .map(
            normalizeScore
          );

      let trend = 0;

      if (
        chronological.length >=
        4
      ) {
        const recent =
          chronological.slice(
            -3
          );

        const prior =
          chronological.slice(
            -6,
            -3
          );

        if (
          prior.length
        ) {
          const recentAverage =
            recent.reduce(
              (a, v) =>
                a + v,
              0
            ) /
            recent.length;

          const priorAverage =
            prior.reduce(
              (a, v) =>
                a + v,
              0
            ) /
            prior.length;

          trend = Math.round(
            recentAverage -
              priorAverage
          );
        }
      }

      return {
        total:
          history.length,
        average,
        best,
        trend,
        sparkValues:
          chronological.slice(
            -8
          ),
      };
    }, [history]);

  // ─────────────────────────────────────────────────────────────────────────
  // PER-TOPIC SPARKLINES
  // ─────────────────────────────────────────────────────────────────────────

  const topicSparklines =
    useMemo(() => {
      const byTopic = {};

      [
        ...history,
      ]
        .sort(
          (a, b) =>
            new Date(
              a.createdAt || 0
            ) -
            new Date(
              b.createdAt || 0
            )
        )
        .forEach(
          session => {
            const key = (
              session.topic ||
              session.company ||
              'General'
            )
              .toLowerCase()
              .trim();

            if (
              !byTopic[key]
            ) {
              byTopic[key] = [];
            }

            byTopic[key].push(
              normalizeScore(
                session
              )
            );
          }
        );

      return byTopic;
    }, [history]);

  // ─────────────────────────────────────────────────────────────────────────
  // LABEL HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const getModeLabel =
    mode => {
      if (!mode) {
        return 'Mock Interview';
      }

      const labels = {
        quick:
          'Quick Interview',
        full:
          'Full Interview',
        company:
          'Company Interview',
        topic:
          'Topic Practice',
        challenge:
          'Challenge',
        mcq:
          'MCQ Interview',
        aptitude:
          'Aptitude Interview',
        mixed:
          'Mixed Assessment',
      };

      return (
        labels[mode] ||
        `${mode} Interview`
      );
    };

  const getModeIcon =
    mode => {
      const icons = {
        quick: '⚡',
        full: '🎯',
        company: '🏢',
        topic: '📚',
        challenge: '🔥',
        mcq: '☑',
        aptitude: '◈',
        mixed: '✦',
      };

      return (
        icons[mode] ||
        '🎯'
      );
    };

  const formatDate =
    date => {
      if (!date) {
        return 'Date unavailable';
      }

      const parsed =
        new Date(date);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return 'Date unavailable';
      }

      return parsed.toLocaleDateString(
        'en-IN',
        {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }
      );
    };

  const formatTime =
    date => {
      if (!date) {
        return '';
      }

      const parsed =
        new Date(date);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return '';
      }

      return parsed.toLocaleTimeString(
        'en-IN',
        {
          hour: 'numeric',
          minute: '2-digit',
        }
      );
    };

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={S.page}>
        <style>{`
          @keyframes hshimmer {
            0% {
              background-position: -200px 0;
            }

            100% {
              background-position: 200px 0;
            }
          }

          .h-skel {
            background:
              linear-gradient(
                90deg,
                ${C.border} 25%,
                #EEF3FF 37%,
                ${C.border} 63%
              );
            background-size: 400px 100%;
            animation:
              hshimmer 1.4s ease infinite;
          }
        `}</style>

        <div style={S.container}>
          <div
            style={{
              marginBottom: 30,
            }}
          >
            <div
              className="h-skel"
              style={{
                width: 270,
                height: 38,
                borderRadius: 8,
                marginBottom: 12,
              }}
            />

            <div
              className="h-skel"
              style={{
                width: 520,
                maxWidth: '80%',
                height: 15,
                borderRadius: 6,
              }}
            />
          </div>

          <div
            style={S.statsGrid}
          >
            {[1, 2, 3].map(
              i => (
                <div
                  key={i}
                  style={{
                    ...S.statCard,
                    display: 'flex',
                  }}
                >
                  <div
                    className="h-skel"
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                    }}
                  />

                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <div
                      className="h-skel"
                      style={{
                        width: 70,
                        height: 10,
                        borderRadius: 5,
                        marginBottom: 8,
                      }}
                    />

                    <div
                      className="h-skel"
                      style={{
                        width: 45,
                        height: 22,
                        borderRadius: 6,
                      }}
                    />
                  </div>
                </div>
              )
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection:
                'column',
              gap: 10,
            }}
          >
            {[1, 2, 3].map(
              i => (
                <div
                  key={i}
                  style={{
                    height: 92,
                    padding: 18,
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: 14,
                    background:
                      C.card,
                    border:
                      `1px solid ${C.border}`,
                    borderRadius: 18,
                  }}
                >
                  <div
                    className="h-skel"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 13,
                    }}
                  />

                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <div
                      className="h-skel"
                      style={{
                        width: 100,
                        height: 10,
                        borderRadius: 5,
                        marginBottom: 8,
                      }}
                    />

                    <div
                      className="h-skel"
                      style={{
                        width: 190,
                        height: 14,
                        borderRadius: 6,
                      }}
                    />
                  </div>

                  <div
                    className="h-skel"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                    }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={S.page}>
      <style>{`
        * {
          box-sizing: border-box;
        }

        @keyframes hFadeUp {
          from {
            opacity: 0;
            transform:
              translateY(8px);
          }

          to {
            opacity: 1;
            transform:
              translateY(0);
          }
        }

        .h-page button:focus-visible,
        .h-page select:focus-visible {
          outline:
            2px solid ${C.blue500};
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .h-page * {
            animation: none !important;
            transition: none !important;
          }
        }

        .h-filter-btn {
          transition:
            background 0.15s,
            color 0.15s,
            box-shadow 0.15s;
        }

        .h-filter-btn:hover:not(.h-filter-active) {
          color: ${C.blue600};
        }

        .h-card {
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease;
        }

        .h-card:hover {
          border-color:
            ${C.borderStr} !important;

          box-shadow:
            0 10px 32px
            rgba(0,87,232,0.10)
            !important;

          transform:
            translateY(-2px);
        }

        .h-cta {
          position: relative;
          overflow: hidden;
          transition:
            transform 0.15s,
            box-shadow 0.15s;
        }

        .h-cta::after {
          content: '';
          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              120deg,
              transparent 30%,
              rgba(255,255,255,0.28) 50%,
              transparent 70%
            );

          transform:
            translateX(-120%);

          transition:
            transform 0.6s ease;
        }

        .h-cta:hover::after {
          transform:
            translateX(120%);
        }

        .h-cta:hover {
          transform:
            translateY(-1px);

          box-shadow:
            0 8px 24px
            rgba(0,87,232,0.34)
            !important;
        }

        @media (max-width: 900px) {
          .history-container {
            padding:
              28px 20px !important;
          }
        }

        @media (max-width: 700px) {
          .history-hero {
            flex-direction:
              column !important;

            align-items:
              flex-start !important;
          }

          .history-stats {
            grid-template-columns:
              1fr !important;
          }

          .history-controls {
            flex-direction:
              column !important;

            align-items:
              flex-start !important;
          }

          .history-controls-right {
            width: 100% !important;

            flex-direction:
              column !important;

            align-items:
              stretch !important;
          }

          .history-filter {
            overflow-x:
              auto;

            width: 100%;
            padding-bottom: 3px;
          }

          .history-card {
            flex-direction:
              column !important;

            align-items:
              flex-start !important;

            gap: 18px !important;
          }

          .history-score {
            width: 100% !important;

            flex-direction:
              row !important;

            justify-content:
              space-between !important;

            border-top:
              1px solid ${C.border};

            padding-top: 14px;
          }
        }

        @media (max-width: 480px) {
          .history-container {
            padding:
              20px 14px !important;
          }
        }
      `}</style>

      <div
        style={{
          ...S.container,
        }}
        className="history-container h-page"
      >
        {/* ── Header ── */}
        <section
          style={S.hero}
          className="history-hero"
        >
          <div
            style={{
              animation: mounted
                ? 'hFadeUp 0.5s ease'
                : 'none',
            }}
          >
            <div
              style={S.eyebrow}
            >
              YOUR PRACTICE JOURNEY
            </div>

            <h1 style={S.title}>
              Interview History
            </h1>

            <p
              style={S.subtitle}
            >
              Review your past interviews,
              track your progress, and see
              how your performance is improving
              over time.
            </p>
          </div>

          <button
            className="h-cta"
            onClick={() =>
              navigate('/interview')
            }
            style={
              S.primaryButton
            }
          >
            <span>🎯</span>
            New Interview
          </button>
        </section>

        {/* ── Stats ── */}
        <section
          style={S.statsGrid}
          className="history-stats"
        >
          <div
            style={S.statCard}
          >
            <div
              style={{
                ...S.statIcon,
                background:
                  C.blue50,
                border:
                  `1px solid ${C.borderMd}`,
              }}
            >
              📋
            </div>

            <div>
              <div
                style={S.statLabel}
              >
                SESSIONS
              </div>

              <div
                style={{
                  ...S.statNumber,
                  color:
                    C.blue700,
                }}
              >
                {stats.total}
              </div>
            </div>
          </div>

          <div
            style={S.statCard}
          >
            <div
              style={{
                ...S.statIcon,
                background:
                  scoreBg(
                    stats.average
                  ),
                border:
                  `1px solid ${C.borderMd}`,
              }}
            >
              📈
            </div>

            <div
              style={{
                flex: 1,
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'space-between',
                gap: 8,
              }}
            >
              <div>
                <div
                  style={
                    S.statLabel
                  }
                >
                  AVG SCORE
                </div>

                <div
                  style={{
                    ...S.statNumber,
                    color:
                      scoreColor(
                        stats.average
                      ),
                  }}
                >
                  {
                    stats.average
                  }

                  <span
                    style={
                      S.scoreSuffix
                    }
                  >
                    /100
                  </span>
                </div>

                {stats.trend !==
                  0 && (
                  <div
                    style={{
                      fontFamily:
                        F.mono,
                      fontSize: 10,
                      fontWeight: 700,
                      color:
                        stats.trend >
                        0
                          ? C.green
                          : C.orange,
                      marginTop: 3,
                    }}
                  >
                    {stats.trend >
                    0
                      ? '↑'
                      : '↓'}{' '}
                    {Math.abs(
                      stats.trend
                    )}{' '}
                    pts
                  </div>
                )}
              </div>

              <Sparkline
                values={
                  stats.sparkValues
                }
                color={
                  C.blue500
                }
              />
            </div>
          </div>

          <div
            style={S.statCard}
          >
            <div
              style={{
                ...S.statIcon,
                background:
                  C.amberTint,
                border:
                  '1px solid #FDE68A',
              }}
            >
              🏆
            </div>

            <div>
              <div
                style={S.statLabel}
              >
                BEST SCORE
              </div>

              <div
                style={{
                  ...S.statNumber,
                  color:
                    C.amber,
                }}
              >
                {stats.best}

                <span
                  style={
                    S.scoreSuffix
                  }
                >
                  /100
                </span>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div
            style={S.errorBox}
          >
            <span>
              ⚠️
            </span>

            <span>
              {error}
            </span>
          </div>
        )}

        {/* ── Controls ── */}
        <section
          style={S.controls}
          className="history-controls"
        >
          <div>
            <h2
              style={
                S.sectionTitle
              }
            >
              Your Interviews
            </h2>

            <p
              style={
                S.sectionSubtitle
              }
            >
              {completedHistory.length ===
              0
                ? 'No interviews found'
                : `${completedHistory.length} interview${
                    completedHistory.length ===
                    1
                      ? ''
                      : 's'
                  }`}
            </p>
          </div>

          <div
            style={
              S.controlsRight
            }
            className="history-controls-right"
          >
            <div
              style={
                S.filterGroup
              }
              className="history-filter"
            >
              {[
                {
                  value: 'all',
                  label: 'All',
                },
                {
                  value: 'quick',
                  label: 'Quick',
                },
                {
                  value: 'full',
                  label: 'Full',
                },
                {
                  value: 'company',
                  label: 'Company',
                },
                {
                  value: 'topic',
                  label: 'Topic',
                },
                {
                  value:
                    'challenge',
                  label:
                    'Challenge',
                },
                {
                  value: 'mcq',
                  label: 'MCQ',
                },
                {
                  value:
                    'aptitude',
                  label:
                    'Aptitude',
                },
                {
                  value: 'mixed',
                  label:
                    'Mixed',
                },
              ].map(
                item => (
                  <button
                    key={
                      item.value
                    }
                    onClick={() =>
                      setFilter(
                        item.value
                      )
                    }
                    className={`h-filter-btn${
                      filter ===
                      item.value
                        ? ' h-filter-active'
                        : ''
                    }`}
                    style={{
                      ...S.filterButton,
                      ...(filter ===
                      item.value
                        ? S.filterButtonActive
                        : {}),
                    }}
                  >
                    {
                      item.label
                    }
                  </button>
                )
              )}
            </div>

            <select
              value={sort}
              onChange={e =>
                setSort(
                  e.target.value
                )
              }
              style={
                S.sortSelect
              }
            >
              <option value="recent">
                Most Recent
              </option>

              <option value="score">
                Highest Score
              </option>
            </select>
          </div>
        </section>

        {/* ── Empty State ── */}
        {!error &&
          completedHistory.length ===
            0 && (
            <div
              style={
                S.emptyCard
              }
            >
              <div
                style={
                  S.emptyIcon
                }
              >
                🎯
              </div>

              <h3
                style={
                  S.emptyTitle
                }
              >
                No interviews yet
              </h3>

              <p
                style={
                  S.emptyText
                }
              >
                Your completed interviews
                will appear here. Start
                your first AI-powered mock
                interview and begin building
                your interview streak.
              </p>

              <button
                onClick={() =>
                  navigate(
                    '/interview'
                  )
                }
                style={
                  S.emptyButton
                }
              >
                Start Your First
                Interview
              </button>
            </div>
          )}

        {/* ── Interview List ── */}
        <div
          style={{
            display: 'flex',
            flexDirection:
              'column',
            gap: 10,
          }}
        >
          {completedHistory.map(
            (
              session,
              index
            ) => {
              const score =
                normalizeScore(
                  session
                );

              const sColor =
                scoreColor(
                  score
                );

              const topicKey =
                (
                  session.topic ||
                  session.company ||
                  'General'
                )
                  .toLowerCase()
                  .trim();

              const spark =
                topicSparklines[
                  topicKey
                ] || [];

              return (
                <article
                  key={
                    session._id ||
                    index
                  }
                  className="h-card history-card"
                  style={{
                    ...S.historyCard,
                    animation:
                      mounted
                        ? `hFadeUp 0.4s ease ${
                            Math.min(
                              index *
                                0.04,
                              0.4
                            )
                          }s backwards`
                        : 'none',
                  }}
                >
                  {/* Left */}
                  <div
                    style={
                      S.historyMain
                    }
                  >
                    <div
                      style={{
                        ...S.interviewIcon,
                        background:
                          C.blue50,
                        border:
                          `1px solid ${C.borderMd}`,
                      }}
                    >
                      {getModeIcon(
                        session.mode
                      )}
                    </div>

                    <div
                      style={
                        S.historyInfo
                      }
                    >
                      <div
                        style={
                          S.historyTopLine
                        }
                      >
                        <span
                          style={
                            S.modeBadge
                          }
                        >
                          {getModeLabel(
                            session.mode
                          )}
                        </span>

                        {session.status ===
                          'completed' && (
                          <span
                            style={
                              S.completedBadge
                            }
                          >
                            ✓ Completed
                          </span>
                        )}

                        {spark.length >=
                          2 && (
                          <span
                            style={{
                              display:
                                'inline-flex',
                              alignItems:
                                'center',
                            }}
                          >
                            <Sparkline
                              values={spark.slice(
                                -6
                              )}
                              color={
                                C.cyan500
                              }
                            />
                          </span>
                        )}
                      </div>

                      <h3
                        style={
                          S.historyTitle
                        }
                      >
                        {
                          session.topic ||
                            session.company ||
                            'General Interview'
                        }
                      </h3>

                      <div
                        style={
                          S.metaRow
                        }
                      >
                        <span>
                          📅{' '}
                          {formatDate(
                            session.createdAt
                          )}
                        </span>

                        <span>
                          🕐{' '}
                          {formatTime(
                            session.createdAt
                          )}
                        </span>

                        <span
                          style={{
                            fontFamily:
                              F.mono,
                            color:
                              C.blue500,
                            fontWeight:
                              700,
                          }}
                        >
                          {relativeTime(
                            session.createdAt
                          )}
                        </span>

                        {session.company && (
                          <span>
                            🏢{' '}
                            {
                              session.company
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div
                    style={
                      S.scoreSection
                    }
                    className="history-score"
                  >
                    <ScoreRing
                      score={
                        score
                      }
                    />

                    <div
                      style={{
                        ...S.performanceLabel,
                        color:
                          sColor,
                      }}
                    >
                      {score >=
                      80
                        ? 'Excellent'
                        : score >=
                            60
                          ? 'Good'
                          : 'Keep Practicing'}
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight:
      'calc(100vh - 64px)',
    background: C.bg,
    backgroundImage:
      `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.06) 0%, transparent 46%), radial-gradient(ellipse at 92% 12%, rgba(0,173,224,0.045) 0%, transparent 40%)`,
    fontFamily: F.body,
    color: C.text,
  },

  container: {
    maxWidth: 1180,
    margin: '0 auto',
    padding:
      '42px 28px 70px',
  },

  hero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: 24,
    marginBottom: 30,
  },

  eyebrow: {
    fontFamily: F.mono,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '1.6px',
    color: C.blue500,
    marginBottom: 8,
  },

  title: {
    margin: 0,
    fontFamily: F.display,
    fontSize:
      'clamp(30px, 4vw, 42px)',
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing:
      '-1.3px',
    color: C.text,
  },

  subtitle: {
    maxWidth: 650,
    margin:
      '10px 0 0',
    color: C.sub,
    fontSize: 14.5,
    lineHeight: 1.65,
  },

  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    border: 'none',
    borderRadius: 12,
    padding:
      '11px 18px',
    background:
      `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow:
      '0 7px 22px rgba(0,87,232,0.30)',
    fontFamily: F.body,
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, minmax(0, 1fr))',
    gap: 16,
    marginBottom: 34,
  },

  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 15,
    padding: 20,
    background: C.card,
    border:
      `1px solid ${C.border}`,
    borderRadius: 18,
    boxShadow:
      '0 1px 12px rgba(26,110,255,0.07)',
  },

  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    fontSize: 20,
    flexShrink: 0,
  },

  statLabel: {
    fontFamily: F.mono,
    color: C.muted,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing:
      '0.5px',
    marginBottom: 4,
  },

  statNumber: {
    fontFamily: F.display,
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing:
      '-0.6px',
  },

  scoreSuffix: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.muted,
    marginLeft: 2,
    fontWeight: 600,
  },

  controls: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems:
      'flex-end',
    gap: 20,
    marginBottom: 18,
  },

  sectionTitle: {
    margin: 0,
    fontFamily: F.display,
    fontSize: 19,
    fontWeight: 800,
    letterSpacing:
      '-0.4px',
    color: C.text,
  },

  sectionSubtitle: {
    margin:
      '4px 0 0',
    color: C.muted,
    fontSize: 12.5,
  },

  controlsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    border:
      `1px solid ${C.border}`,
    background:
      C.cardAlt,
    borderRadius: 11,
  },

  filterButton: {
    border: 'none',
    background:
      'transparent',
    borderRadius: 8,
    padding:
      '7px 11px',
    color: C.sub,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace:
      'nowrap',
    fontFamily: F.body,
  },

  filterButtonActive: {
    background: C.card,
    color: C.blue600,
    boxShadow:
      '0 1px 4px rgba(0,87,232,0.14)',
    fontWeight: 700,
  },

  sortSelect: {
    border:
      `1px solid ${C.border}`,
    background: C.card,
    borderRadius: 10,
    padding:
      '9px 12px',
    color: C.sub,
    fontSize: 12,
    fontWeight: 600,
    outline: 'none',
    cursor: 'pointer',
    fontFamily: F.body,
  },

  historyCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: 24,
    padding: 18,
    background: C.card,
    border:
      `1px solid ${C.border}`,
    borderRadius: 18,
    boxShadow:
      '0 1px 12px rgba(26,110,255,0.06)',
    cursor: 'default',
  },

  historyMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },

  interviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    fontSize: 21,
    flexShrink: 0,
  },

  historyInfo: {
    minWidth: 0,
  },

  historyTopLine: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 5,
  },

  modeBadge: {
    fontFamily: F.mono,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing:
      '0.3px',
    color: C.blue600,
    background:
      C.blue50,
    border:
      `1px solid ${C.borderMd}`,
    padding:
      '4px 9px',
    borderRadius: 7,
  },

  completedBadge: {
    fontFamily: F.mono,
    fontSize: 10,
    fontWeight: 700,
    color: C.green,
    background:
      C.greenTint,
    padding:
      '4px 9px',
    borderRadius: 7,
  },

  historyTitle: {
    margin: 0,
    fontFamily: F.display,
    fontSize: 15,
    fontWeight: 700,
    color: C.text,
    whiteSpace:
      'nowrap',
    overflow:
      'hidden',
    textOverflow:
      'ellipsis',
  },

  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 7,
    color: C.muted,
    fontSize: 11.5,
    fontWeight: 500,
  },

  scoreSection: {
    display: 'flex',
    flexDirection:
      'column',
    alignItems:
      'center',
    justifyContent:
      'center',
    minWidth: 80,
    gap: 6,
  },

  performanceLabel: {
    fontFamily: F.mono,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing:
      '0.3px',
  },

  emptyCard: {
    textAlign: 'center',
    padding:
      '70px 24px',
    background: C.card,
    border:
      `1.5px dashed ${C.borderMd}`,
    borderRadius: 20,
    marginBottom: 10,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    margin:
      '0 auto 15px',
    borderRadius: 18,
    background:
      C.blue50,
    border:
      `1px solid ${C.borderMd}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    fontSize: 28,
  },

  emptyTitle: {
    margin: 0,
    fontFamily: F.display,
    fontSize: 19,
    fontWeight: 800,
    color: C.text,
  },

  emptyText: {
    maxWidth: 480,
    margin:
      '9px auto 20px',
    color: C.sub,
    fontSize: 13.5,
    lineHeight: 1.65,
  },

  emptyButton: {
    border: 'none',
    background:
      `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
    color: '#FFFFFF',
    borderRadius: 11,
    padding:
      '10px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow:
      '0 6px 18px rgba(0,87,232,0.26)',
    fontFamily: F.body,
  },

  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    marginBottom: 20,
    padding:
      '12px 15px',
    background:
      C.redTint,
    border:
      '1px solid #FECACA',
    borderRadius: 12,
    color: C.red,
    fontSize: 13,
    fontWeight: 600,
  },
};

export default History;