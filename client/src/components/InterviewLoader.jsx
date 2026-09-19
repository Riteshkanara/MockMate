import { useState, useEffect, useRef } from 'react';

// Rotating messages shown while the interview generates.
// They cycle every 2.2s so the user always has something to read —
// never just staring at a spinner wondering if it's frozen.
const MESSAGES = [
  { headline: 'Crafting your questions…',   sub: 'Tailoring difficulty and topics to your session.' },
  { headline: 'Analysing your weak areas…', sub: 'Prioritising topics where you need the most practice.' },
  { headline: 'Setting the difficulty…',    sub: 'Calibrating each question to challenge you correctly.' },
  { headline: 'Building answer rubrics…',   sub: 'Preparing how your responses will be evaluated.' },
  { headline: 'Almost ready…',              sub: 'Your interview is about to begin. Take a breath.' },
];

// ─── Typewriter SVG ────────────────────────────────────────────────────────
// Completely rebuilt animation:
//   • Paper rises smoothly with no dead-time at the start
//   • Text lines on paper appear one by one as the carriage slides left
//   • Carriage slide is a smooth continuous motion, not discrete jumps
//   • Key presses vary in intensity (2px vs 3px) to feel more human
//   • Carriage-return ding moment at paper eject
//   • Reduced-motion: collapses to a static illustration instantly
const TypewriterSVG = ({ reduced }) => (
  <svg
    viewBox="0 0 160 120"
    width="160"
    height="120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ overflow: 'visible' }}
  >
    <style>{`
      :root {
        --tw-blue:      #3B6EF8;
        --tw-blue-dark: #1A4FDB;
        --tw-key:       #ffffff;
        --tw-paper:     #EEF0FD;
        --tw-line:      #C8CAE8;
        --tw-tool:      #FBC56C;
        --tw-dur:       3.2s;
      }

      /* ── Reduced motion — everything static ── */
      @media (prefers-reduced-motion: reduce) {
        .tw-carriage  { animation: none !important; transform: translateX(0); }
        .tw-paper     { animation: none !important; transform: translateY(10px); }
        .tw-line1, .tw-line2, .tw-line3 { animation: none !important; opacity: 1; }
        .tw-keys      { animation: none !important; }
        .tw-body      { animation: none !important; }
        .tw-cursor    { animation: none !important; opacity: 0; }
      }

      /* ── Body bounce — subtle, only at carriage-return moment ── */
      .tw-body {
        transform-origin: center bottom;
        animation: twBodyBounce var(--tw-dur) ease-in-out infinite;
      }
      @keyframes twBodyBounce {
        0%, 78%, 100% { transform: translateY(0); }
        84%            { transform: translateY(-3px); }
        90%            { transform: translateY(1px); }
        95%            { transform: translateY(0); }
      }

      /* ── Carriage slides smoothly left over the typing phase ── */
      .tw-carriage {
        animation: twCarriage var(--tw-dur) cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      @keyframes twCarriage {
        0%   { transform: translateX(28px); }   /* start right */
        5%   { transform: translateX(24px); }   /* settle */
        72%  { transform: translateX(-14px); }  /* end of line */
        78%  { transform: translateX(-18px); }  /* overshoot slightly */
        82%  { transform: translateX(-18px); }  /* hold (paper eject) */
        88%  { transform: translateX(28px); }   /* snap back (carriage return) */
        100% { transform: translateX(28px); }   /* hold start */
      }

      /* ── Paper rises continuously as lines are typed ── */
      .tw-paper {
        animation: twPaper var(--tw-dur) linear infinite;
      }
      @keyframes twPaper {
        0%   { transform: translateY(42px); opacity: 1; }
        5%   { transform: translateY(36px); opacity: 1; }
        30%  { transform: translateY(24px); opacity: 1; }
        55%  { transform: translateY(12px); opacity: 1; }
        75%  { transform: translateY(2px);  opacity: 1; }
        82%  { transform: translateY(-2px); opacity: 1; }
        88%  { transform: translateY(42px); opacity: 0; }  /* instant reset */
        89%  { transform: translateY(42px); opacity: 1; }  /* new sheet */
        100% { transform: translateY(42px); opacity: 1; }
      }

      /* ── Text lines appear one by one ── */
      .tw-line1 {
        animation: twLine var(--tw-dur) linear infinite;
        animation-delay: 0s;
      }
      .tw-line2 {
        animation: twLine var(--tw-dur) linear infinite;
        animation-delay: calc(var(--tw-dur) * 0.22);
      }
      .tw-line3 {
        animation: twLine var(--tw-dur) linear infinite;
        animation-delay: calc(var(--tw-dur) * 0.44);
      }
      @keyframes twLine {
        0%, 5%   { opacity: 0; }
        12%      { opacity: 1; }
        80%      { opacity: 1; }
        87%      { opacity: 0; }
        100%     { opacity: 0; }
      }

      /* ── Keys press with varying intensity ── */
      .tw-keys {
        animation: twKeys var(--tw-dur) linear infinite;
      }
      @keyframes twKeys {
        /* Row 1 presses — light keys */
        6%  { filter: drop-shadow(0 2px 0 rgba(0,0,0,0.3)); transform: scaleY(0.97); }
        8%  { filter: none; transform: scaleY(1); }
        14% { filter: drop-shadow(0 3px 0 rgba(0,0,0,0.4)); transform: scaleY(0.96); }
        16% { filter: none; transform: scaleY(1); }
        22% { filter: drop-shadow(0 2px 0 rgba(0,0,0,0.3)); transform: scaleY(0.97); }
        24% { filter: none; transform: scaleY(1); }
        /* Row 2 presses — heavier */
        30% { filter: drop-shadow(0 3px 0 rgba(0,0,0,0.4)); transform: scaleY(0.95); }
        32% { filter: none; transform: scaleY(1); }
        38% { filter: drop-shadow(0 2px 0 rgba(0,0,0,0.3)); transform: scaleY(0.97); }
        40% { filter: none; transform: scaleY(1); }
        46% { filter: drop-shadow(0 3px 0 rgba(0,0,0,0.4)); transform: scaleY(0.96); }
        48% { filter: none; transform: scaleY(1); }
        /* Row 3 — spacebar (biggest press) */
        54% { filter: drop-shadow(0 4px 0 rgba(0,0,0,0.5)); transform: scaleY(0.94); }
        56% { filter: none; transform: scaleY(1); }
        62% { filter: drop-shadow(0 2px 0 rgba(0,0,0,0.3)); transform: scaleY(0.97); }
        64% { filter: none; transform: scaleY(1); }
        70% { filter: drop-shadow(0 3px 0 rgba(0,0,0,0.4)); transform: scaleY(0.96); }
        72% { filter: none; transform: scaleY(1); }
        0%, 100% { filter: none; transform: scaleY(1); }
      }

      /* ── Cursor blinks at the typing position ── */
      .tw-cursor {
        animation: twCursor 0.55s step-end infinite;
      }
      @keyframes twCursor {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0; }
      }
    `}</style>

    {/* ── Typewriter body ── */}
    <g className="tw-body">

      {/* Base / body */}
      <rect x="10" y="68" width="140" height="44" rx="8"
        fill="url(#twBodyGrad)" />

      {/* Body top ridge */}
      <rect x="14" y="62" width="132" height="12" rx="5"
        fill="url(#twTopGrad)" />

      {/* Platen (paper roller) — darker bar */}
      <rect x="18" y="57" width="124" height="10" rx="4"
        fill="#1A3EBF" />

      {/* ── Carriage group (slides left/right) ── */}
      <g className="tw-carriage">
        {/* Carriage block */}
        <rect x="22" y="42" width="76" height="18" rx="4"
          fill="url(#twCarriageGrad)" />

        {/* Ribbon spool left */}
        <circle cx="28" cy="48" r="4" fill="#F59E0B" />
        <circle cx="28" cy="48" r="2" fill="#B45309" />

        {/* Ribbon spool right */}
        <circle cx="90" cy="48" r="4" fill="#F59E0B" />
        <circle cx="90" cy="48" r="2" fill="#B45309" />

        {/* Ribbon */}
        <rect x="32" y="47" width="54" height="2" rx="1"
          fill="#B45309" opacity="0.6" />

        {/* Print head */}
        <rect x="56" y="55" width="4" height="8" rx="1"
          fill="#FBC56C" />

        {/* ── Paper ── */}
        <g className="tw-paper">
          {/* Paper sheet */}
          <rect x="36" y="4" width="34" height="52" rx="3"
            fill="#EEF0FD" />

          {/* Paper shadow at roller */}
          <rect x="36" y="50" width="34" height="6" rx="1"
            fill="#D4D6EF" opacity="0.5" />

          {/* Text lines — appear one by one */}
          <rect className="tw-line1" x="40" y="10" width="24" height="3" rx="1.5"
            fill="#C8CAE8" opacity="0" />
          <rect className="tw-line1" x="40" y="10" width="18" height="3" rx="1.5"
            fill="#C8CAE8" opacity="0" />

          <rect className="tw-line2" x="40" y="18" width="26" height="3" rx="1.5"
            fill="#C8CAE8" opacity="0" />
          <rect className="tw-line2" x="40" y="22" width="20" height="3" rx="1.5"
            fill="#C8CAE8" opacity="0" />

          <rect className="tw-line3" x="40" y="30" width="22" height="3" rx="1.5"
            fill="#C8CAE8" opacity="0" />
          <rect className="tw-line3" x="40" y="34" width="28" height="3" rx="1.5"
            fill="#C8CAE8" opacity="0" />

          {/* Blinking cursor at current write position */}
          <rect className="tw-cursor" x="58" y="38" width="2" height="10" rx="1"
            fill="#3B6EF8" />
        </g>

        {/* Carriage return lever */}
        <rect x="96" y="44" width="6" height="12" rx="2"
          fill="#FBC56C" />
        <rect x="98" y="36" width="2" height="10" rx="1"
          fill="#FBC56C" />
      </g>

      {/* ── Keyboard ── */}
      <g className="tw-keys" style={{ transformOrigin: '80px 100px' }}>
        {/* Key row 1 */}
        {[18,30,42,54,66,78,90,102,114,126].map((x,i) => (
          <rect key={`r1-${i}`} x={x} y="75" width="9" height="7" rx="2"
            fill="white" opacity="0.92" />
        ))}
        {/* Key row 2 */}
        {[22,35,48,61,74,87,100,113].map((x,i) => (
          <rect key={`r2-${i}`} x={x} y="85" width="9" height="7" rx="2"
            fill="white" opacity="0.92" />
        ))}
        {/* Spacebar */}
        <rect x="38" y="95" width="84" height="7" rx="3"
          fill="white" opacity="0.92" />
      </g>

      {/* Type badge */}
      <rect x="118" y="70" width="26" height="10" rx="3"
        fill="rgba(255,255,255,0.15)" />
      <text x="131" y="78" textAnchor="middle"
        fontFamily="monospace" fontSize="5" fontWeight="700"
        fill="rgba(255,255,255,0.7)">
        MM
      </text>
    </g>

    {/* ── Gradients ── */}
    <defs>
      <linearGradient id="twBodyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3B6EF8" />
        <stop offset="100%" stopColor="#1A4FDB" />
      </linearGradient>
      <linearGradient id="twTopGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4B7BF8" />
        <stop offset="100%" stopColor="#2B5EE8" />
      </linearGradient>
      <linearGradient id="twCarriageGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5B8BF9" />
        <stop offset="100%" stopColor="#2B5EE8" />
      </linearGradient>
    </defs>
  </svg>
);

// ─── Main InterviewLoader ──────────────────────────────────────────────────
const InterviewLoader = ({ reduced = false }) => {
  const [msgIdx, setMsgIdx]     = useState(0);
  const [visible, setVisible]   = useState(true);
  const [dots, setDots]         = useState('');
  const timerRef                = useRef(null);

  // Cycle through messages with a crossfade
  useEffect(() => {
    const advance = () => {
      setVisible(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, 320);
    };
    timerRef.current = setInterval(advance, 2800);
    return () => clearInterval(timerRef.current);
  }, []);

  // Animated dots on the sub-text
  useEffect(() => {
    const t = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 420);
    return () => clearInterval(t);
  }, []);

  const msg = MESSAGES[msgIdx];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      userSelect: 'none',
    }}>
      {/* Typewriter illustration */}
      <div style={{
        marginBottom: 8,
        filter: 'drop-shadow(0 8px 24px rgba(59,110,248,0.28))',
        transition: 'filter 0.3s ease',
      }}>
        <TypewriterSVG reduced={reduced} />
      </div>

      {/* Rotating headline */}
      <div style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <span style={{
          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
          fontSize: 15,
          fontWeight: 700,
          color: '#0A1628',
          letterSpacing: '-0.2px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.28s ease, transform 0.28s ease',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}>
          {msg.headline}
        </span>
      </div>

      {/* Sub-text with animated dots */}
      <div style={{
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12.5,
          color: '#7A8BAF',
          textAlign: 'center',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.28s ease',
          whiteSpace: 'nowrap',
        }}>
          {msg.sub}{dots}
        </span>
      </div>

      {/* Progress dots */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginTop: 16,
        alignItems: 'center',
      }}>
        {MESSAGES.map((_, i) => (
          <div key={i} style={{
            height: 4,
            borderRadius: 999,
            background: i === msgIdx ? '#3B6EF8' : '#DDE5F7',
            width: i === msgIdx ? 20 : 6,
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        ))}
      </div>
    </div>
  );
};

export default InterviewLoader;