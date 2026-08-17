import { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKMATE — SHARE SCORE CARD
// Premium achievement-style result card designed for screenshots + social share.
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  navy: '#071A45',
  navy2: '#0B2B73',

  blue: '#2474FF',
  blue2: '#4C8DFF',
  cyan: '#19C9E7',
  violet: '#8B78FF',

  green: '#18B981',
  amber: '#F0A126',
  red: '#E45B5B',

  white: '#FFFFFF',
  ink: '#0C1830',
  text: '#243451',
  sub: '#66758F',
  muted: '#8D9AB0',
  faint: '#B2BDCC',

  line: '#DCE5F1',
  soft: '#F5F8FC',
  blueSoft: '#ECF3FF',
  cyanSoft: '#EAFBFE',
  violetSoft: '#F2EFFF',
  greenSoft: '#EAF9F3',
  amberSoft: '#FFF6E7',
  redSoft: '#FFF0F0',

  shadow:
    '0 14px 45px rgba(11, 48, 113, 0.12)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clamp = value =>
  Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

const getScoreColor = score => {
  if (score >= 85) return C.green;
  if (score >= 70) return C.blue;
  if (score >= 50) return C.amber;
  return C.red;
};

const getScoreSoft = score => {
  if (score >= 85) return C.greenSoft;
  if (score >= 70) return C.blueSoft;
  if (score >= 50) return C.amberSoft;
  return C.redSoft;
};

const getScoreTier = score => {
  if (score >= 90) {
    return {
      label: 'Elite',
      sub: 'Placement Ready',
      icon: '✦',
    };
  }

  if (score >= 80) {
    return {
      label: 'Strong',
      sub: 'Interview Ready',
      icon: '↗',
    };
  }

  if (score >= 70) {
    return {
      label: 'Solid',
      sub: 'On Track',
      icon: '◆',
    };
  }

  if (score >= 60) {
    return {
      label: 'Developing',
      sub: 'Keep Building',
      icon: '◐',
    };
  }

  return {
    label: 'Practice',
    sub: 'Room to Grow',
    icon: '◔',
  };
};

const normalizeQuestion = question => {
  const score = clamp(question?.score);

  return {
    ...question,
    score,
    topic: question?.topic || 'General',
    skipped: Boolean(question?.skipped),
    userAnswer: question?.userAnswer || '',
  };
};

// ─── Circular hero score ──────────────────────────────────────────────────────

const HeroScore = ({ score }) => {
  const safeScore = clamp(score);

  const size = 168;
  const stroke = 11;
  const radius = 66;
  const circumference = 2 * Math.PI * radius;

  const offset =
    circumference -
    (safeScore / 100) * circumference;

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
        viewBox={`0 0 ${size} ${size}`}
        style={{
          display: 'block',
          transform: 'rotate(-90deg)',
        }}
      >
        <defs>
          <linearGradient
            id="mockmate-score-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop
              offset="0%"
              stopColor={C.cyan}
            />
            <stop
              offset="52%"
              stopColor={C.blue2}
            />
            <stop
              offset="100%"
              stopColor={C.violet}
            />
          </linearGradient>

          <filter
            id="mockmate-score-glow"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur
              stdDeviation="4"
              result="blur"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,.12)"
          strokeWidth={stroke}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#mockmate-score-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          filter="url(#mockmate-score-glow)"
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
        <div
          style={{
            color: '#fff',
            fontFamily:
              "'Plus Jakarta Sans', sans-serif",
            fontSize: 46,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-2px',
          }}
        >
          {Math.round(safeScore)}
        </div>

        <div
          style={{
            marginTop: 5,
            fontFamily:
              "'JetBrains Mono', monospace",
            fontSize: 9,
            color: 'rgba(255,255,255,.56)',
            letterSpacing: '1px',
          }}
        >
          OUT OF 100
        </div>
      </div>
    </div>
  );
};

// ─── Mini stat ────────────────────────────────────────────────────────────────

const MiniStat = ({
  icon,
  label,
  value,
  color,
  background,
}) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      background,
      border:
        `1px solid ${color}26`,
      borderRadius: 14,
      padding: '11px 10px',
      textAlign: 'center',
    }}
  >
    <div
      style={{
        color,
        fontSize: 13,
        fontWeight: 800,
        marginBottom: 4,
      }}
    >
      {icon}
    </div>

    <div
      style={{
        color: C.ink,
        fontFamily:
          "'Plus Jakarta Sans', sans-serif",
        fontSize: 16,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {value}
    </div>

    <div
      style={{
        marginTop: 4,
        color: C.sub,
        fontFamily:
          "'JetBrains Mono', monospace",
        fontSize: 7.5,
        fontWeight: 700,
        letterSpacing: '.6px',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  </div>
);

// ─── Topic row ────────────────────────────────────────────────────────────────

const TopicRow = ({
  topic,
  avg,
  rank,
}) => {
  const score = clamp(avg);
  const color = getScoreColor(score);

  return (
    <div
      style={{
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 5,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background:
                rank === 1
                  ? C.violetSoft
                  : rank === 2
                    ? C.blueSoft
                    : C.soft,
              color:
                rank === 1
                  ? C.violet
                  : rank === 2
                    ? C.blue
                    : C.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily:
                "'JetBrains Mono', monospace",
              fontSize: 7.5,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {String(rank).padStart(2, '0')}
          </span>

          <span
            style={{
              color: C.text,
              fontSize: 10.5,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {topic}
          </span>
        </div>

        <span
          style={{
            color,
            fontFamily:
              "'Plus Jakarta Sans', sans-serif",
            fontSize: 10,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {score}
        </span>
      </div>

      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: '#E9EEF5',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            borderRadius: 999,
            background:
              `linear-gradient(90deg, ${color}, ${color}CC)`,
          }}
        />
      </div>
    </div>
  );
};

// ─── Main ScoreCard ───────────────────────────────────────────────────────────

const ScoreCard = ({
  totalScore,
  questions = [],
}) => {
  const { user } = useAuth();

  const cardRef =
    useRef(null);

  const [sharing, setSharing] =
    useState(false);

  const normalizedQuestions =
    useMemo(
      () =>
        questions.map(normalizeQuestion),
      [questions]
    );

  const score =
    clamp(totalScore);

  const tier =
    getScoreTier(score);

  const scoreColor =
    getScoreColor(score);

  const scoreSoft =
    getScoreSoft(score);

  // ─── Question stats ───────────────────────────────────────────────────────

  const answeredQuestions =
    normalizedQuestions.filter(
      q =>
        !q.skipped &&
        q.userAnswer &&
        q.userAnswer.trim() &&
        q.userAnswer !== 'Skipped'
    );

  const skippedQuestions =
    normalizedQuestions.filter(
      q => q.skipped
    );

  const strongQuestions =
    normalizedQuestions.filter(
      q =>
        !q.skipped &&
        q.score >= 80
    );

  const needsWorkQuestions =
    normalizedQuestions.filter(
      q =>
        !q.skipped &&
        q.score < 60
    );

  const objectiveQuestions =
    normalizedQuestions.filter(
      q =>
        ['mcq', 'aptitude'].includes(
          q.questionType
        ) &&
        !q.skipped
    );

  const objectiveCorrect =
    objectiveQuestions.filter(
      q => q.score >= 100
    );

  const accuracy =
    objectiveQuestions.length
      ? Math.round(
          (objectiveCorrect.length /
            objectiveQuestions.length) *
            100
        )
      : null;

  const averageTime =
    answeredQuestions.length
      ? Math.round(
          answeredQuestions.reduce(
            (sum, q) =>
              sum +
              Number(q.timeTaken || 0),
            0
          ) /
            answeredQuestions.length
        )
      : 0;

  // ─── Topic data ────────────────────────────────────────────────────────────

  const topicBreakdown =
    useMemo(() => {
      const map = {};

      normalizedQuestions.forEach(
        q => {
          if (
            q.skipped ||
            !q.topic
          ) {
            return;
          }

          if (!map[q.topic]) {
            map[q.topic] = {
              total: 0,
              count: 0,
            };
          }

          map[q.topic].total +=
            clamp(q.score);

          map[q.topic].count += 1;
        }
      );

      return Object.entries(map)
        .map(
          ([topic, value]) => ({
            topic,
            avg:
              value.count > 0
                ? Math.round(
                    value.total /
                      value.count
                  )
                : 0,
          })
        )
        .sort(
          (a, b) =>
            b.avg - a.avg
        );
    }, [normalizedQuestions]);

  const strongest =
    topicBreakdown[0] ||
    null;

  const weakest =
    topicBreakdown[
      topicBreakdown.length - 1
    ] || null;

  // ─── Share text ───────────────────────────────────────────────────────────

  const shareText = useMemo(() => {
    const topicSummary =
      topicBreakdown
        .slice(0, 3)
        .map(
          item =>
            `${item.topic}: ${item.avg}/100`
        )
        .join(' · ');

    return [
      `🚀 MockMate Interview Score`,
      '',
      `${score}/100 — ${tier.label}`,
      `${tier.sub}`,
      '',
      `👤 ${user?.name || 'Candidate'}`,
      user?.college
        ? `🎓 ${user.college}`
        : '',
      user?.branch
        ? `📚 ${user.branch}`
        : '',
      '',
      `✅ ${answeredQuestions.length}/${normalizedQuestions.length} answered`,
      `🔥 ${strongQuestions.length} strong answers`,
      `🎯 ${needsWorkQuestions.length} answers to improve`,
      accuracy !== null
        ? `🎯 Objective accuracy: ${accuracy}%`
        : '',
      '',
      strongest
        ? `🏆 Strongest: ${strongest.topic} (${strongest.avg}/100)`
        : '',
      weakest && weakest.topic !== strongest?.topic
        ? `📈 Focus next: ${weakest.topic} (${weakest.avg}/100)`
        : '',
      topicSummary
        ? `📊 ${topicSummary}`
        : '',
      '',
      '#MockMate #InterviewPrep #PlacementReady',
    ]
      .filter(Boolean)
      .join('\n');
  }, [
    score,
    tier,
    user,
    answeredQuestions.length,
    normalizedQuestions.length,
    strongQuestions.length,
    needsWorkQuestions.length,
    accuracy,
    strongest,
    weakest,
    topicBreakdown,
  ]);

  // ─── Export image ──────────────────────────────────────────────────────────

  const generateImage = async () => {
    if (!cardRef.current) {
      throw new Error(
        'Score card is not available.'
      );
    }

    await new Promise(resolve =>
      setTimeout(resolve, 150)
    );

    return toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2.5,
      backgroundColor: '#F3F7FC',
      width:
        cardRef.current.offsetWidth,
      height:
        cardRef.current.offsetHeight,
    });
  };

  const handleDownload =
    async () => {
      const toastId =
        toast.loading(
          'Creating your share card...'
        );

      try {
        const dataUrl =
          await generateImage();

        const link =
          document.createElement(
            'a'
          );

        link.download =
          `mockmate-score-${Date.now()}.png`;

        link.href = dataUrl;
        link.click();

        toast.dismiss(
          toastId
        );

        toast.success(
          'Score card saved!'
        );
      } catch (error) {
        toast.dismiss(
          toastId
        );

        console.error(
          'Score card export failed:',
          error
        );

        toast.error(
          'Could not create the score card.'
        );
      }
    };

  const handleShare =
    async () => {
      setSharing(true);

      try {
        const dataUrl =
          await generateImage();

        // Mobile / modern browser share
        if (
          navigator.share &&
          window.File
        ) {
          const response =
            await fetch(dataUrl);

          const blob =
            await response.blob();

          const file =
            new File(
              [blob],
              'mockmate-score.png',
              {
                type: 'image/png',
              }
            );

          const canShareFile =
            navigator.canShare
              ? navigator.canShare({
                  files: [file],
                })
              : false;

          if (canShareFile) {
            await navigator.share({
              title:
                'My MockMate Interview Result',
              text:
                shareText,
              files: [file],
            });

            return;
          }
        }

        // Desktop fallback:
        // copy polished summary and download image
        await navigator.clipboard?.writeText(
          shareText
        );

        const link =
          document.createElement(
            'a'
          );

        link.download =
          `mockmate-score-${Date.now()}.png`;

        link.href = dataUrl;

        link.click();

        toast.success(
          'Score card downloaded and share text copied.'
        );
      } catch (error) {
        // User cancelled native share.
        if (
          error?.name ===
          'AbortError'
        ) {
          return;
        }

        console.error(
          'Share failed:',
          error
        );

        toast.error(
          'Sharing failed. Try Download instead.'
        );
      } finally {
        setSharing(false);
      }
    };

  return (
    <>
      <style>{`
        .mockmate-share-shell {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .mockmate-score-card {
          width: min(760px, 100%);
          border-radius: 30px;
          overflow: hidden;
          position: relative;
          box-shadow:
            0 24px 70px rgba(12, 44, 100, 0.14),
            0 3px 12px rgba(12, 44, 100, 0.06);
        }

        .mockmate-share-button {
          transition:
            transform .16s ease,
            box-shadow .16s ease,
            filter .16s ease;
        }

        .mockmate-share-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }

        @media (max-width: 640px) {
          .mockmate-card-inner {
            padding: 20px !important;
          }

          .mockmate-hero-grid {
            grid-template-columns: 1fr !important;
          }

          .mockmate-hero-score {
            display: flex !important;
            justify-content: center !important;
          }

          .mockmate-user-copy {
            text-align: center !important;
            align-items: center !important;
          }

          .mockmate-stat-grid {
            grid-template-columns: 1fr 1fr !important;
          }

          .mockmate-topic-grid {
            grid-template-columns: 1fr !important;
          }

          .mockmate-bottom-grid {
            grid-template-columns: 1fr !important;
          }

          .mockmate-actions {
            flex-direction: column !important;
          }

          .mockmate-actions button {
            width: 100% !important;
          }
        }
      `}</style>

      <div
        style={{
          marginBottom: 24,
        }}
      >
        {/* ───────────────────────────────────────────────────────────── */}
        {/* SHAREABLE CARD */}
        {/* ───────────────────────────────────────────────────────────── */}

        <div className="mockmate-share-shell">
          <div
            ref={cardRef}
            className="mockmate-score-card"
            style={{
              background:
                'linear-gradient(180deg, #F8FBFF 0%, #FFFFFF 44%, #F7FAFF 100%)',
              color: C.ink,
              fontFamily:
                "'Inter', sans-serif",
            }}
          >
            {/* ── TOP BRAND / HERO ────────────────────────────────────── */}

            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                padding:
                  '26px 28px 30px',
                background:
                  'linear-gradient(135deg, #071A45 0%, #0C3D9D 45%, #2474FF 72%, #19C9E7 100%)',
              }}
            >
              {/* Decorative glows */}

              <div
                style={{
                  position: 'absolute',
                  width: 300,
                  height: 300,
                  borderRadius: '50%',
                  right: -130,
                  top: -180,
                  background:
                    'radial-gradient(circle, rgba(139,120,255,.34), transparent 68%)',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  left: -120,
                  bottom: -150,
                  background:
                    'radial-gradient(circle, rgba(25,201,231,.25), transparent 68%)',
                }}
              />

              {/* Brand line */}

              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  gap: 12,
                  marginBottom: 22,
                }}
              >
                <div
                  style={{
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 31,
                      height: 31,
                      borderRadius: 9,
                      background:
                        'rgba(255,255,255,.15)',
                      border:
                        '1px solid rgba(255,255,255,.2)',
                      display: 'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      color: '#fff',
                      fontWeight: 900,
                    }}
                  >
                    M
                  </div>

                  <div>
                    <div
                      style={{
                        color: '#fff',
                        fontFamily:
                          "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 900,
                        fontSize: 14,
                        letterSpacing:
                          '-.3px',
                      }}
                    >
                      MockMate
                    </div>

                    <div
                      style={{
                        color:
                          'rgba(255,255,255,.55)',
                        fontFamily:
                          "'JetBrains Mono', monospace",
                        fontSize: 7.5,
                        letterSpacing:
                          '1px',
                        marginTop: 1,
                      }}
                    >
                      AI INTERVIEW COACH
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border:
                      '1px solid rgba(255,255,255,.25)',
                    background:
                      'rgba(255,255,255,.08)',
                    borderRadius: 999,
                    padding:
                      '6px 10px',
                    color:
                      'rgba(255,255,255,.82)',
                    fontFamily:
                      "'JetBrains Mono', monospace",
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing:
                      '.6px',
                  }}
                >
                  INTERVIEW RESULT
                </div>
              </div>

              {/* Main hero */}

              <div
                className="mockmate-hero-grid"
                style={{
                  position:
                    'relative',
                  display: 'grid',
                  gridTemplateColumns:
                    '168px 1fr',
                  gap: 24,
                  alignItems:
                    'center',
                }}
              >
                <div
                  className="mockmate-hero-score"
                  style={{
                    display: 'flex',
                    justifyContent:
                      'flex-start',
                  }}
                >
                  <HeroScore
                    score={
                      score
                    }
                  />
                </div>

                <div
                  className="mockmate-user-copy"
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    alignItems:
                      'flex-start',
                  }}
                >
                  <div
                    style={{
                      display:
                        'inline-flex',
                      alignItems:
                        'center',
                      gap: 7,
                      padding:
                        '5px 9px',
                      borderRadius:
                        999,
                      background:
                        'rgba(255,255,255,.10)',
                      border:
                        '1px solid rgba(255,255,255,.18)',
                      color:
                        'rgba(255,255,255,.68)',
                      fontFamily:
                        "'JetBrains Mono', monospace",
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing:
                        '.8px',
                      marginBottom:
                        10,
                    }}
                  >
                    {tier.icon}{' '}
                    {tier.label.toUpperCase()}
                  </div>

                  <div
                    style={{
                      color:
                        '#fff',
                      fontFamily:
                        "'Plus Jakarta Sans', sans-serif",
                      fontSize: 25,
                      fontWeight: 900,
                      lineHeight:
                        1.15,
                      letterSpacing:
                        '-.8px',
                    }}
                  >
                    {user?.name ||
                      'Candidate'}
                  </div>

                  {user?.college && (
                    <div
                      style={{
                        marginTop: 5,
                        color:
                          'rgba(255,255,255,.67)',
                        fontSize: 10.5,
                        lineHeight:
                          1.45,
                      }}
                    >
                      {user.college}
                      {user.branch
                        ? ` · ${user.branch}`
                        : ''}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 15,
                      color: '#fff',
                      fontFamily:
                        "'Plus Jakarta Sans', sans-serif",
                      fontSize: 18,
                      fontWeight: 800,
                    }}
                  >
                    {tier.sub}
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      maxWidth: 380,
                      color:
                        'rgba(255,255,255,.62)',
                      fontSize: 10.5,
                      lineHeight:
                        1.55,
                    }}
                  >
                    {score >= 90
                      ? 'Exceptional interview performance. You are operating at a very strong level.'
                      : score >= 80
                        ? 'Strong performance with a clear signal of interview readiness.'
                        : score >= 70
                          ? 'Solid progress with identifiable areas that can move your score higher.'
                          : 'A useful diagnostic session. Your next practice round has a clear target.'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── STATS ───────────────────────────────────────────────── */}

            <div
              className="mockmate-card-inner"
              style={{
                padding: 24,
              }}
            >
              <div
                className="mockmate-stat-grid"
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(4, 1fr)',
                  gap: 9,
                  marginBottom:
                    18,
                }}
              >
                <MiniStat
                  icon="✓"
                  label="Answered"
                  value={`${answeredQuestions.length}/${normalizedQuestions.length}`}
                  color={
                    C.green
                  }
                  background={
                    C.greenSoft
                  }
                />

                <MiniStat
                  icon="↗"
                  label="Strong"
                  value={
                    strongQuestions.length
                  }
                  color={
                    C.blue
                  }
                  background={
                    C.blueSoft
                  }
                />

                <MiniStat
                  icon="!"
                  label="Focus"
                  value={
                    needsWorkQuestions.length
                  }
                  color={
                    C.red
                  }
                  background={
                    C.redSoft
                  }
                />

                <MiniStat
                  icon="◎"
                  label="Streak"
                  value={
                    user?.streak?.current ||
                    streakFallback(
                      user
                    ) ||
                    0
                  }
                  color={
                    C.violet
                  }
                  background={
                    C.violetSoft
                  }
                />
              </div>

              {/* ── TWO FEATURE BLOCKS ───────────────────────────────── */}

              <div
                className="mockmate-bottom-grid"
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    '1fr 1fr',
                  gap: 12,
                }}
              >
                {/* Strongest */}

                <div
                  style={{
                    border:
                      `1px solid ${C.green}24`,
                    background:
                      `linear-gradient(180deg, ${C.greenSoft}, #fff)`,
                    borderRadius:
                      16,
                    padding: 15,
                  }}
                >
                  <div
                    style={{
                      fontFamily:
                        "'JetBrains Mono', monospace",
                      fontSize: 8,
                      fontWeight: 700,
                      color:
                        C.green,
                      letterSpacing:
                        '.8px',
                      marginBottom:
                        8,
                    }}
                  >
                    🏆 STRONGEST AREA
                  </div>

                  <div
                    style={{
                      fontFamily:
                        "'Plus Jakarta Sans', sans-serif",
                      fontSize: 14,
                      fontWeight: 800,
                      color:
                        C.ink,
                    }}
                  >
                    {strongest?.topic ||
                      'Not enough data'}
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      color:
                        C.sub,
                      fontSize: 10,
                    }}
                  >
                    {strongest
                      ? `${strongest.avg}/100 session average`
                      : 'Keep practising to unlock this signal'}
                  </div>
                </div>

                {/* Weakest */}

                <div
                  style={{
                    border:
                      `1px solid ${C.amber}2A`,
                    background:
                      `linear-gradient(180deg, ${C.amberSoft}, #fff)`,
                    borderRadius:
                      16,
                    padding: 15,
                  }}
                >
                  <div
                    style={{
                      fontFamily:
                        "'JetBrains Mono', monospace",
                      fontSize: 8,
                      fontWeight: 700,
                      color:
                        C.amber,
                      letterSpacing:
                        '.8px',
                      marginBottom:
                        8,
                    }}
                  >
                    📈 FOCUS NEXT
                  </div>

                  <div
                    style={{
                      fontFamily:
                        "'Plus Jakarta Sans', sans-serif",
                      fontSize: 14,
                      fontWeight: 800,
                      color:
                        C.ink,
                    }}
                  >
                    {weakest?.topic ||
                      'Build more data'}
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      color:
                        C.sub,
                      fontSize: 10,
                    }}
                  >
                    {weakest
                      ? `${weakest.avg}/100 — biggest opportunity`
                      : 'Run more questions to unlock targeted coaching'}
                  </div>
                </div>
              </div>

              {/* ── TOPIC BREAKDOWN ─────────────────────────────────── */}

              {topicBreakdown.length >
                0 && (
                <div
                  style={{
                    marginTop: 18,
                    padding:
                      '17px 16px 5px',
                    borderRadius:
                      16,
                    border:
                      `1px solid ${C.line}`,
                    background:
                      C.soft,
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'space-between',
                      gap: 12,
                      marginBottom:
                        14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily:
                          "'JetBrains Mono', monospace",
                        fontSize: 8.5,
                        color:
                          C.muted,
                        fontWeight: 700,
                        letterSpacing:
                          '1px',
                      }}
                    >
                      SESSION DNA
                    </div>

                    <div
                      style={{
                        fontSize: 8,
                        color:
                          C.faint,
                      }}
                    >
                      TOPIC SCORE
                    </div>
                  </div>

                  {topicBreakdown
                    .slice(0, 6)
                    .map(
                      (
                        topic,
                        index
                      ) => (
                        <TopicRow
                          key={
                            topic.topic
                          }
                          topic={
                            topic.topic
                          }
                          avg={
                            topic.avg
                          }
                          rank={
                            index + 1
                          }
                        />
                      )
                    )}
                </div>
              )}

              {/* ── PERFORMANCE BAND ────────────────────────────────── */}

              <div
                style={{
                  marginTop: 16,
                  padding:
                    '14px 15px',
                  borderRadius:
                    15,
                  background:
                    `linear-gradient(135deg, ${scoreSoft}, #fff)`,
                  border:
                    `1px solid ${scoreColor}26`,
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily:
                        "'JetBrains Mono', monospace",
                      fontSize: 8,
                      color:
                        scoreColor,
                      fontWeight: 700,
                      letterSpacing:
                        '.8px',
                    }}
                  >
                    PERFORMANCE
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontFamily:
                        "'Plus Jakarta Sans', sans-serif",
                      fontSize: 15,
                      color:
                        C.ink,
                      fontWeight: 800,
                    }}
                  >
                    {tier.label}
                  </div>
                </div>

                <div
                  style={{
                    textAlign:
                      'right',
                  }}
                >
                  <div
                    style={{
                      fontFamily:
                        "'Plus Jakarta Sans', sans-serif",
                      fontSize: 22,
                      fontWeight: 900,
                      color:
                        scoreColor,
                    }}
                  >
                    {score}
                  </div>

                  <div
                    style={{
                      fontFamily:
                        "'JetBrains Mono', monospace",
                      fontSize: 7.5,
                      color:
                        C.muted,
                      letterSpacing:
                        '.5px',
                    }}
                  >
                    SCORE
                  </div>
                </div>
              </div>

              {/* ── BRAND FOOTER ────────────────────────────────────── */}

              <div
                style={{
                  marginTop: 18,
                  paddingTop:
                    14,
                  borderTop:
                    `1px solid ${C.line}`,
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily:
                        "'Plus Jakarta Sans', sans-serif",
                      fontSize: 10,
                      fontWeight: 900,
                      color:
                        C.ink,
                    }}
                  >
                    MockMate
                  </div>

                  <div
                    style={{
                      marginTop: 2,
                      fontFamily:
                        "'JetBrains Mono', monospace",
                      fontSize: 7,
                      color:
                        C.faint,
                      letterSpacing:
                        '.8px',
                    }}
                  >
                    PRACTICE · PERFORM · PLACE
                  </div>
                </div>

                <div
                  style={{
                    textAlign:
                      'right',
                  }}
                >
                  <div
                    style={{
                      color:
                        C.blue,
                      fontFamily:
                        "'JetBrains Mono', monospace",
                      fontSize: 7.5,
                      fontWeight: 700,
                    }}
                  >
                    #{String(
                      Math.round(
                        score * 13 +
                          normalizedQuestions.length
                      )
                    ).padStart(
                      4,
                      '0'
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 2,
                      color:
                        C.faint,
                      fontSize: 7,
                    }}
                  >
                    SESSION CARD
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* ACTIONS */}
        {/* ───────────────────────────────────────────────────────────── */}

        <div
          className="mockmate-actions"
          style={{
            display: 'flex',
            justifyContent:
              'center',
            gap: 10,
            marginTop: 14,
          }}
        >
          <button
            className="mockmate-share-button"
            onClick={
              handleDownload
            }
            style={{
              border: 'none',
              borderRadius: 12,
              background:
                `linear-gradient(135deg, ${C.blue}, ${C.violet})`,
              color: '#fff',
              padding:
                '12px 18px',
              fontFamily:
                "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow:
                '0 8px 22px rgba(36,116,255,.22)',
            }}
          >
            ↓ Download share card
          </button>

          <button
            className="mockmate-share-button"
            onClick={
              handleShare
            }
            disabled={sharing}
            style={{
              border:
                `1px solid ${C.lineStrong}`,
              borderRadius: 12,
              background:
                C.white,
              color:
                C.blueDark,
              padding:
                '12px 18px',
              fontFamily:
                "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 800,
              cursor: sharing
                ? 'wait'
                : 'pointer',
              boxShadow:
                C.shadowSm,
            }}
          >
            {sharing
              ? 'Preparing…'
              : '↗ Share result'}
          </button>
        </div>

        <div
          style={{
            marginTop: 8,
            textAlign: 'center',
            color: C.faint,
            fontSize: 9.5,
            fontFamily:
              "'JetBrains Mono', monospace",
          }}
        >
          Designed for screenshots,
          LinkedIn, WhatsApp, Discord
          and placement updates.
        </div>
      </div>
    </>
  );
};

// ─── Defensive streak helper ──────────────────────────────────────────────────

const streakFallback = user => {
  return Number(
    user?.streak?.current || 0
  );
};

export default ScoreCard;