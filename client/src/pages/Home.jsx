/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import API_BASE from '../config/api.js';
import Button from '../components/Button';

const GOOGLE_AUTH_URL = `${API_BASE}/auth/google`;

// ─── Design tokens — exact mirror of Dashboard v4 + Analytics ───────────────
const C = {
  bg:        '#F0F4FF',
  bgDeep:    '#E8EEFF',
  card:      '#FFFFFF',
  cardAlt:   '#F8FAFF',
  text:      '#0A1628',
  sub:       '#3D5280',
  muted:     '#7A8BAF',
  faint:     '#A8B8D4',
  border:    '#DDE5F7',
  borderMd:  '#B8CAF0',
  borderStr: '#7FA3E8',
  blue50:    '#EBF2FF',
  blue100:   '#C7DAFF',
  blue200:   '#9DBFFF',
  blue400:   '#4D8FFF',
  blue500:   '#1A6EFF',
  blue600:   '#0057E8',
  blue700:   '#0044C4',
  blue900:   '#001F6B',
  cyan400:   '#00C8F0',
  cyan500:   '#00ADE0',
  cyan600:   '#0093C4',
  cyanTint:  '#E6F9FF',
  green:     '#059669',
  greenTint: '#ECFDF5',
  amber:     '#D97706',
  amberTint: '#FFFBEB',
  orange:    '#EA580C',
  red:       '#DC2626',
  shadow:    '0 1px 12px rgba(26,110,255,0.07)',
  shadowMd:  '0 6px 28px rgba(26,110,255,0.12)',
  shadowLg:  '0 16px 56px rgba(0,31,107,0.20)',
};

const F = {
  display: "'Plus Jakarta Sans', sans-serif",
  body:    "'Inter', -apple-system, sans-serif",
  mono:    "'JetBrains Mono', 'SF Mono', monospace",
};

// ─── Package tiers — from Analytics TIERS, calibrated to Indian placement ────
const TIERS = [
  { label: '₹3–6 LPA',   minScore: 0,  color: C.muted,   bg: C.blue50,    border: C.borderMd, desc: 'Service companies, off-campus starts',   advice: 'Focus on DSA basics and communication fundamentals.' },
  { label: '₹6–12 LPA',  minScore: 38, color: C.amber,   bg: C.amberTint, border: '#FDE68A',  desc: 'Mid-tier product, IT MNCs, campus drives', advice: 'Strengthen problem solving and topic breadth.' },
  { label: '₹12–20 LPA', minScore: 60, color: C.blue500, bg: C.blue50,    border: C.borderMd, desc: 'Top product companies, FAANG-adjacent',   advice: 'Master system design and consistency under pressure.' },
  { label: '₹20 LPA+',   minScore: 80, color: C.cyan500, bg: C.cyanTint,  border: '#7DE8FF',  desc: 'FAANG, unicorn startups, remote-first',   advice: 'Achieve elite cross-dimension performance.' },
];

// ─── Six dimensions — from Analytics DIMENSIONS (weighted, real formula) ─────
const DIMENSIONS = [
  { key: 'technical',      label: 'Technical Depth',  icon: '⚙',  weight: 28, demo: 74, tip: 'Core CS fundamentals — the first thing screeners test.' },
  { key: 'problemSolving', label: 'Problem Solving',   icon: '🔍', weight: 22, demo: 68, tip: 'How you break unknowns — decisive in live coding rounds.' },
  { key: 'communication',  label: 'Communication',     icon: '💬', weight: 18, demo: 82, tip: 'Clarity of thought — interviewers notice it fast.' },
  { key: 'behavioral',     label: 'Behavioral',        icon: '🤝', weight: 12, demo: 71, tip: 'Situational judgment under HR scrutiny.' },
  { key: 'design',         label: 'System Design',     icon: '🏗',  weight: 10, demo: 55, tip: 'Matters at ₹12 LPA+ — often the differentiator.' },
  { key: 'fundamentals',   label: 'CS Fundamentals',   icon: '📚', weight: 10, demo: 79, tip: 'Breadth of core knowledge separates prepared from lucky.' },
];

// ─── Interview modes ──────────────────────────────────────────────────────────
const MODES = [
  { label: 'Technical',     icon: '⚙️', color: C.blue500, bg: C.blue50,    border: C.borderMd },
  { label: 'HR Round',      icon: '🤝', color: C.green,   bg: C.greenTint, border: '#BBF7D0' },
  { label: 'System Design', icon: '🏗️', color: C.amber,   bg: C.amberTint, border: '#FDE68A' },
  { label: 'DSA Live',      icon: '💻', color: C.cyan500, bg: C.cyanTint,  border: '#7DE8FF' },
  { label: 'Mock Final',    icon: '🎯', color: C.orange,  bg: '#FFF7ED',   border: '#FDBA74' },
];

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '🤖', title: 'AI That Pushes Back',           desc: 'Follow-up questions, pressure tests, edge cases — exactly like a senior engineer at a product company.',                                tag: 'Claude-powered'  },
  { icon: '📊', title: 'Interview Readiness Score',      desc: 'A 4-component weighted composite across 6 dimensions. Not a single average — a real readiness metric mapped to salary tiers.',          tag: 'Data-driven'     },
  { icon: '🎙️', title: 'Voice Answers',                  desc: 'Speak your answer out loud. Real interviews are conversations, not multiple choice.',                                                     tag: 'Natural flow'    },
  { icon: '🔍', title: 'Weak Pattern Detector',          desc: 'Tracks where you stall across sessions — fixes the recurring gap, not just one bad answer.',                                              tag: 'Cross-session AI'},
  { icon: '🔥', title: 'Streak Accountability',          desc: 'Miss a day, break the chain. 30 days earns Placement Ready — a badge that actually means something.',                                     tag: 'Real pressure'   },
  { icon: '🏫', title: 'College Leaderboard',             desc: 'See exactly where you rank against peers from your college. The board resets each week.',                                                 tag: 'Competitive'     },
];

// ─── IRS formula components (from Dashboard + Analytics computeIRS) ───────────
const IRS_COMPONENTS = [
  { label: 'Dimension-weighted avg',  pct: 40, color: C.blue500, demo: 74, note: '6 dimensions, each with a real weight' },
  { label: 'EWMA trend (α = 0.35)',   pct: 25, color: C.cyan500, demo: 68, note: 'Recent sessions count more than old ones' },
  { label: 'Topic breadth',           pct: 15, color: C.amber,   demo: 75, note: 'Drilling one topic can\'t fake readiness' },
  { label: 'Consistency (1 − CV)',    pct: 20, color: C.green,   demo: 82, note: 'Steady 70 beats wild 50 / 90 swings' },
];

// ─── Rotating demo sessions (hero card) ──────────────────────────────────────
const SESSIONS = [
  { question: 'Explain the difference between SQL and NoSQL databases.',   score: 78, feedback: ['Good grasp of CAP theorem', 'Add real-world examples', 'Missed eventual consistency'], mode: 'Technical', time: '2m 34s', irs: 62 },
  { question: 'How would you optimize a slow REST API endpoint?',          score: 91, feedback: ['Excellent caching strategy', 'Correct indexing logic', 'Clean N+1 solution'],          mode: 'Technical', time: '3m 12s', irs: 74 },
  { question: 'Tell me about a project you\'re most proud of.',            score: 85, feedback: ['Strong STAR structure', 'Good technical depth', 'Quantify your impact more'],          mode: 'HR Round',  time: '4m 01s', irs: 71 },
];

// ─── Pricing plans ────────────────────────────────────────────────────────────
const PRICING = [
  { name: 'Free',    price: '₹0',     period: 'forever',    highlight: false, cta: 'Start Free',  action: 'auth',    features: ['5 sessions / month', 'Basic AI feedback', 'IRS score tracking', 'College leaderboard'] },
  { name: 'Pro',     price: '₹199',   period: '/month',     highlight: true,  cta: 'Go Pro',      action: 'auth',    features: ['Unlimited sessions', 'Voice answers', 'Resume-personalised prep', 'Weak pattern detector', 'AI follow-up questions', 'Priority support'] },
  { name: 'College', price: '₹2,999', period: '/semester',  highlight: false, cta: 'Contact Us',  action: 'contact', features: ['Everything in Pro', 'Admin analytics panel', 'Batch performance reports', 'Custom question sets', 'Placement cell dashboard'] },
];

// ─── Animated IRS Demo Ring ───────────────────────────────────────────────────
const DemoIRSRing = ({ score = 74, size = 190, strokeWidth = 14 }) => {
  const [displayed, setDisplayed] = useState(0);
  const r    = size / 2 - strokeWidth / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (displayed / 100) * circ;

  useEffect(() => {
    let start = null;
    const dur = 1800;
    const raf = requestAnimationFrame(function tick(ts) {
      if (!start) start = ts;
      const p  = Math.min((ts - start) / dur, 1);
      const e  = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(e * score));
      if (p < 1) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const col  = score >= 80 ? C.green : score >= 60 ? C.blue500 : C.amber;
  const col2 = score >= 80 ? C.cyan400 : score >= 60 ? C.cyan400 : '#FBBF24';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="irsGradHome" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={col}  />
            <stop offset="100%" stopColor={col2} />
          </linearGradient>
          <filter id="irsGlowHome">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Tick marks */}
        {Array.from({ length: 48 }, (_, i) => {
          const ang  = (i / 48) * 2 * Math.PI - Math.PI / 2;
          const isMaj = i % 6 === 0;
          const inner = r - (isMaj ? 9 : 5);
          const outer = r + (isMaj ? 4 : 2);
          return (
            <line key={i}
              x1={size/2 + inner * Math.cos(ang)} y1={size/2 + inner * Math.sin(ang)}
              x2={size/2 + outer * Math.cos(ang)} y2={size/2 + outer * Math.sin(ang)}
              stroke={isMaj ? C.borderMd : C.border}
              strokeWidth={isMaj ? 1.2 : 0.7}
            />
          );
        })}
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={C.border} strokeWidth={strokeWidth}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
        {/* Progress */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="url(#irsGradHome)" strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          filter="url(#irsGlowHome)"
        />
        {/* End dot */}
        {displayed > 2 && (() => {
          const ang = (displayed / 100) * 2 * Math.PI - Math.PI / 2;
          return <circle
            cx={size/2 + r * Math.cos(ang)} cy={size/2 + r * Math.sin(ang)}
            r={6} fill={col2} stroke={C.card} strokeWidth={3} filter="url(#irsGlowHome)"
          />;
        })()}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ fontFamily: F.display, fontSize: 54, fontWeight: 900, color: C.text, lineHeight: 1, letterSpacing: '-2px' }}>
          {displayed}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: '2px', marginTop: 5, textTransform: 'uppercase' }}>
          IRS Score
        </div>
      </div>
    </div>
  );
};

// ─── Dark glassmorphism session card (hero) ───────────────────────────────────
const DemoSessionCard = ({ onStart }) => {
  const [idx,  setIdx]  = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(i => (i + 1) % SESSIONS.length); setFade(true); }, 320);
    }, 4200);
    return () => clearInterval(t);
  }, []);

  const s    = SESSIONS[idx];
  const mode = MODES.find(m => m.label === s.mode);
  const scoreColor = s.score >= 90 ? C.green : s.score >= 80 ? C.blue400 : C.cyan400;

  return (
    <div style={{
      background: 'rgba(0, 20, 72, 0.55)',
      border: '1px solid rgba(0, 200, 240, 0.22)',
      borderRadius: 20, padding: '22px 20px',
      backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
      width: '100%', maxWidth: 390,
      boxShadow: '0 12px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 33, height: 33, borderRadius: 9, background: 'rgba(26,110,255,0.22)', border: '1px solid rgba(26,110,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 12.5, fontWeight: 700, color: '#fff' }}>MockMate AI</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, display: 'inline-block', animation: 'mmLivePulse 1.6s ease-in-out infinite', boxShadow: '0 0 6px rgba(5,150,105,0.6)' }} />
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.green }}>LIVE SESSION</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 99, padding: '3px 10px' }}>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>⏱ {s.time}</span>
          <span style={{ width: 1, height: 9, background: 'rgba(255,255,255,0.15)', display: 'inline-block' }} />
          <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: mode?.color || C.cyan400 }}>{s.mode}</span>
        </div>
      </div>

      {/* Question */}
      <div style={{ background: 'rgba(26,110,255,0.12)', border: '1px solid rgba(26,110,255,0.26)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease' }}>
        <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.cyan400, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 5 }}>Question</div>
        <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.5 }}>{s.question}</div>
      </div>

      {/* Score + Feedback */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16, opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease 0.05s' }}>
        {/* Mini score ring */}
        <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0 }}>
          <svg width={68} height={68} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
            <circle cx={34} cy={34} r={27} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={7} />
            <circle cx={34} cy={34} r={27} fill="none"
              stroke={scoreColor} strokeWidth={7} strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 27}
              strokeDashoffset={2 * Math.PI * 27 * (1 - s.score / 100)}
              style={{ transition: 'stroke-dashoffset 0.7s ease, stroke 0.4s' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.score}</div>
            <div style={{ fontFamily: F.mono, fontSize: 7, color: 'rgba(255,255,255,0.40)', marginTop: 1 }}>/100</div>
          </div>
        </div>
        {/* Feedback bullets */}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>AI Feedback</div>
          {s.feedback.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5 }}>
              <span style={{ color: C.cyan400, fontSize: 12, lineHeight: 1.3, flexShrink: 0 }}>›</span>
              <span style={{ fontFamily: F.body, fontSize: 11, color: 'rgba(255,255,255,0.68)', lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease 0.1s' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,173,224,0.15)', border: '1px solid rgba(0,200,240,0.25)', borderRadius: 99, padding: '4px 11px' }}>
          <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.cyan400 }}>IRS {s.irs}/100</span>
          <span style={{ width: 1, height: 8, background: 'rgba(0,200,240,0.3)', display: 'inline-block' }} />
          <span style={{ fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.40)' }}>₹12–20 LPA</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {SESSIONS.map((_, i) => (
            <div key={i} style={{ width: i === idx ? 18 : 5, height: 5, borderRadius: 99, background: i === idx ? C.cyan400 : 'rgba(255,255,255,0.20)', transition: 'all 0.35s ease' }} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Home Page ────────────────────────────────────────────────────────────────
const Home = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 400); }, []);

  const goToAuth      = () => { window.location.href = GOOGLE_AUTH_URL; };
  const goToInterview = () => { if (user) navigate('/interview'); else window.location.href = GOOGLE_AUTH_URL; };

  if (isLoading) return null;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ background: C.bg, fontFamily: F.body }}>

        {/* ── STATUS STRIP ──────────────────────────────────────────────────── */}
        <div style={S.strip}>
          <div style={S.stripInner}>
            <div style={S.stripLeft}>
              <span style={S.liveDot} />
              <span style={S.monoText}>MOCKMATE READINESS SYSTEM</span>
              <span style={{ color: C.borderMd, fontSize: 10 }}>·</span>
              <span style={{ ...S.monoText, color: C.green }}>LIVE</span>
            </div>
            <div style={S.stripRight} className="mm-strip-right">
              <span style={S.monoText}>Built for Indian CS placements · PDU · CHARUSAT · NIRMA · GU</span>
            </div>
          </div>
        </div>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section style={S.hero}>
          <div style={S.heroScan} />
          {/* Subtle dot grid overlay */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

          <div style={S.heroInner} className="mm-hero-inner">
            {/* Left column */}
            <div style={S.heroLeft}>
              <div style={S.heroBadge}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', animation: 'mmLivePulse 1.6s ease-in-out infinite', boxShadow: '0 0 8px rgba(5,150,105,0.6)' }} />
                <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                  AI-powered · IRS tracking · 5 interview modes
                </span>
              </div>

              <h1 style={S.heroH1}>
                Practice interviews.<br />
                <span style={{ color: C.cyan400 }}>Get the offer.</span>
              </h1>

              <p style={S.heroSub}>
                MockMate runs real AI-powered interviews and maps your performance across 6 weighted dimensions into one Interview Readiness Score — telling you exactly which salary tier you're ready for.
              </p>

              <div style={S.heroActions}>
                <Button surface="dark" size="lg" onClick={goToInterview}>
                  Start your first interview →
                </Button>
                <a href="#irs" style={S.btnHeroGhost}>
                  How IRS works ↓
                </a>
              </div>

              {/* Stats row */}
              <div style={S.heroStats}>
                {[['₹199/mo', 'Pro plan'], ['6 dimensions', 'tracked per session'], ['4 tiers', 'salary readiness mapped']].map(([n, l]) => (
                  <div key={l}>
                    <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{n}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 9, color: 'rgba(255,255,255,0.40)', marginTop: 3, letterSpacing: '0.3px' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: demo session card */}
            <div style={S.heroRight}>
              <DemoSessionCard />
            </div>
          </div>
        </section>

        {/* ── INTERVIEW MODES ───────────────────────────────────────────────── */}
        <section style={S.modesSection}>
          <div style={S.sectionInner}>
            <p style={S.eyebrow}>5 interview modes</p>
            <div style={S.modeRow}>
              {MODES.map(m => (
                <button key={m.label} onClick={goToInterview}
                  style={{ ...S.modeChip, background: m.bg, border: `1.5px solid ${m.border}` }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 18px ${m.border}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  <span style={{ fontFamily: F.display, fontSize: 13.5, fontWeight: 700, color: m.color }}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── IRS EXPLAINER ─────────────────────────────────────────────────── */}
        <section id="irs" style={S.irsSection}>
          <div style={S.sectionInner}>
            <div style={S.irsGrid} className="mm-irs-grid">

              {/* Left: ring + tier badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                <div>
                  <p style={{ ...S.eyebrow, textAlign: 'center' }}>Interview Readiness Score</p>
                  <h2 style={{ ...S.sectionH2, textAlign: 'center', marginBottom: 8 }}>One number.<br />Every dimension counted.</h2>
                  <p style={{ ...S.sectionSub, textAlign: 'center', maxWidth: 340, margin: '0 auto' }}>
                    Not a single average you can game by drilling one topic. A real weighted composite from six interview dimensions.
                  </p>
                </div>
                <DemoIRSRing score={74} size={190} strokeWidth={14} />
                {/* Tier badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 20px', background: C.blue50, border: `1.5px solid ${C.borderMd}`, borderRadius: 14, width: '100%', maxWidth: 280 }}>
                  <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 900, color: C.blue500 }}>₹12–20 LPA</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>eligible at IRS ≥ 60</div>
                  <div style={{ width: '100%', height: 6, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: mounted ? '74%' : '0%', borderRadius: 99, background: `linear-gradient(90deg, ${C.blue500}, ${C.cyan500})`, transition: 'width 2s cubic-bezier(.16,1,.3,1)' }} />
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>74/100 — 6 IRS pts to ₹20 LPA+</div>
                </div>
              </div>

              {/* Right: 4 components */}
              <div>
                <p style={S.eyebrow}>How IRS is computed</p>
                <h2 style={{ ...S.sectionH2, fontSize: 24, marginBottom: 10 }}>4 real statistical components</h2>
                <p style={S.sectionSub}>
                  A student who always scores 70 ranks higher than one who swings between 50 and 90. Consistency is built into the formula — not optional.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 22 }}>
                  {IRS_COMPONENTS.map((c, i) => (
                    <div key={i} style={{ padding: '14px 15px', borderRadius: 13, background: C.cardAlt, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: C.text }}>{c.label}</span>
                          <span style={{ marginLeft: 8, fontFamily: F.mono, fontSize: 9, color: C.muted }}>weight {c.pct}%</span>
                        </div>
                        <span style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: c.color }}>{c.demo}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 99, background: C.border, overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ height: '100%', width: mounted ? `${c.demo}%` : '0%', borderRadius: 99, background: c.color, transition: `width ${1.2 + i * 0.15}s cubic-bezier(.16,1,.3,1)`, boxShadow: `0 0 8px ${c.color}55` }} />
                      </div>
                      <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>{c.note}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, padding: '12px 15px', borderRadius: 12, background: C.blue50, border: `1px solid ${C.borderMd}` }}>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.sub }}>
                    IRS = dim·avg×0.40 + EWMA×0.25 + breadth×0.15 + (1−CV)×0.20
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PACKAGE TIERS ─────────────────────────────────────────────────── */}
        <section style={S.tiersSection}>
          <div style={S.sectionInner}>
            <p style={S.eyebrow}>Package tier readiness</p>
            <h2 style={S.sectionH2}>Your IRS maps directly<br />to a real salary tier.</h2>
            <p style={S.sectionSub}>Every threshold was calibrated against real Indian placement market data from 2024–25. Not estimates.</p>
            <div style={S.tiersGrid} className="mm-tiers-grid">
              {TIERS.map((tier, i) => (
                <div key={tier.label}
                  style={{ ...S.tierCard, background: tier.bg, border: `2px solid ${tier.border}` }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = C.shadowMd; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = C.shadow; }}
                >
                  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: tier.color, letterSpacing: '1px', marginBottom: 6, opacity: 0.7 }}>
                    IRS ≥ {i === 0 ? 'any score' : tier.minScore}
                  </div>
                  <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color: tier.color, marginBottom: 8 }}>{tier.label}</div>
                  <div style={{ height: 1, background: tier.border, marginBottom: 12 }} />
                  <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.55, marginBottom: 12 }}>{tier.desc}</div>
                  <div style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.55)', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                    {tier.advice}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SIX DIMENSIONS ────────────────────────────────────────────────── */}
        <section style={S.dimsSection}>
          <div style={S.sectionInner}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
              <div>
                <p style={S.eyebrow}>6 skill dimensions</p>
                <h2 style={{ ...S.sectionH2, marginBottom: 8 }}>Every interview dissected<br />across six weighted axes.</h2>
                <p style={S.sectionSub}>You can't fake overall readiness by drilling one topic. Each dimension has a real weight in the IRS formula.</p>
              </div>
              <Button variant="secondary" onClick={goToInterview}>
                See your real dimensions →
              </Button>
            </div>
            <div style={S.dimsGrid} className="mm-dims-grid">
              {DIMENSIONS.map((dim, i) => {
                const col = dim.demo >= 80 ? C.green : dim.demo >= 60 ? C.blue500 : C.amber;
                return (
                  <div key={dim.key} title={dim.tip}
                    style={{ ...S.dimCard, border: `1.5px solid ${dim.demo >= 80 ? col + '55' : C.border}`, background: dim.demo >= 80 ? `${col}07` : C.card }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderStr; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = C.shadowMd; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = dim.demo >= 80 ? col + '55' : C.border; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = C.shadow; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{dim.icon}</span>
                        <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: C.text }}>{dim.label}</span>
                      </div>
                      <span style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, color: col }}>{dim.demo}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: C.border, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: mounted ? `${dim.demo}%` : '0%', borderRadius: 99, background: col, transition: `width ${1.1 + i * 0.1}s cubic-bezier(.16,1,.3,1)` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{dim.weight}% of IRS</span>
                      <span style={{ fontFamily: F.mono, fontSize: 9, color: col, fontWeight: 700 }}>
                        {dim.demo >= 80 ? '✓ Strong' : dim.demo >= 60 ? '→ Developing' : '↑ Focus needed'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────────────────── */}
        <section style={{ ...S.dimsSection, background: C.bg }}>
          <div style={S.sectionInner}>
            <p style={S.eyebrow}>What makes it different</p>
            <h2 style={S.sectionH2}>Built for the gap between<br />knowing and performing.</h2>
            <div style={S.featuresGrid} className="mm-features-grid">
              {FEATURES.map((f, i) => (
                <div key={i} style={S.featureCard}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderStr; e.currentTarget.style.boxShadow = C.shadowMd; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = C.shadow; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.blue50, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>{f.icon}</div>
                  <div style={{ display: 'inline-block', background: C.blue50, border: `1px solid ${C.borderMd}`, borderRadius: 99, padding: '3px 10px', marginBottom: 10, fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>{f.tag}</div>
                  <h3 style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, margin: '0 0 8px', lineHeight: 1.3 }}>{f.title}</h3>
                  <p style={{ fontFamily: F.body, fontSize: 13, color: C.sub, lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STREAK CALLOUT ────────────────────────────────────────────────── */}
        <section style={S.streakSection}>
          <div style={S.sectionInner}>
            <div style={S.streakBox} className="mm-streak-box">
              <div style={{ flex: '1 1 320px' }}>
                <p style={S.eyebrow}>Streak accountability</p>
                <h2 style={{ fontFamily: F.display, fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 900, color: C.text, margin: '0 0 14px', letterSpacing: '-0.8px', lineHeight: 1.18 }}>
                  Miss a day.<br />Break the chain.
                </h2>
                <p style={{ fontFamily: F.body, fontSize: 14, color: C.sub, lineHeight: 1.68, margin: 0, maxWidth: 380 }}>
                  The streak system replicates what daily placement prep actually demands. Each badge is earned through real behaviour — not gifted after a one-off session.
                </p>
              </div>
              <div style={S.badgeGrid} className="mm-badge-grid">
                {[
                  { icon: '🎯', label: 'First Interview', sub: 'Day 1', bg: C.blue50,    border: C.borderMd, color: C.blue600 },
                  { icon: '🔥', label: '7-Day Streak',   sub: 'Consistent now',   bg: '#FFF7ED',   border: '#FDBA74', color: C.orange },
                  { icon: '🏆', label: 'Score 90+',       sub: 'IRS ≥ 80',  bg: C.amberTint, border: '#FDE68A', color: C.amber  },
                  { icon: '👑', label: 'Placement Ready', sub: '30-day streak',    bg: C.cyanTint,  border: '#7DE8FF', color: C.cyan500},
                ].map((b, i) => (
                  <div key={i} style={{ ...S.badgeCard, background: b.bg, border: `1.5px solid ${b.border}` }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = C.shadowMd; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = C.shadow; }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{b.icon}</div>
                    <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: b.color, marginBottom: 3 }}>{b.label}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>{b.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── ARCHETYPE TEASER ──────────────────────────────────────────────── */}
        <section style={{ padding: '72px 32px', background: C.card }}>
          <div style={S.sectionInner}>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }} className="mm-irs-grid">
              <div style={{ flex: '1 1 340px' }}>
                <p style={S.eyebrow}>Interview archetypes</p>
                <h2 style={{ ...S.sectionH2, marginBottom: 10 }}>Your interview personality is data, not vibes.</h2>
                <p style={S.sectionSub}>MockMate uses standard deviation and trend slope on your real score history to assign an archetype — then gives you a fix specific to that pattern.</p>
                <Button variant="secondary" className="mt-5" onClick={goToInterview}>
                  Discover your archetype →
                </Button>
              </div>
              <div style={{ flex: '1 1 400px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: '📈', label: 'Consistent Climber', desc: 'Steady improvement — the archetype that wins campus placements.', color: C.green, bg: C.greenTint, border: '#BBF7D0' },
                  { icon: '🎲', label: 'Inconsistent Genius', desc: 'High variance. Brilliant in flow — needs to build a floor quality.', color: C.amber, bg: C.amberTint, border: '#FDE68A' },
                  { icon: '🧠', label: 'Deep Thinker',        desc: 'Thorough and accurate — needs to improve time under live pressure.', color: C.blue500, bg: C.blue50, border: C.borderMd },
                  { icon: '⚡', label: 'Speed Runner',         desc: 'Fast answers, sometimes sacrifices depth. Think aloud.', color: C.cyan500, bg: C.cyanTint, border: '#7DE8FF' },
                ].map((a, i) => (
                  <div key={i} style={{ padding: '16px 15px', borderRadius: 14, background: a.bg, border: `1.5px solid ${a.border}`, boxShadow: C.shadow, transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = C.shadowMd; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = C.shadow; }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{a.icon}</div>
                    <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: a.color, marginBottom: 6 }}>{a.label}</div>
                    <div style={{ fontFamily: F.body, fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ───────────────────────────────────────────────────────── */}
        <section style={{ padding: '80px 32px', background: C.bg }}>
          <div style={S.sectionInner}>
            <p style={S.eyebrow}>Pricing</p>
            <h2 style={S.sectionH2}>Start free. Go pro when you're serious.</h2>
            <div style={S.pricingGrid} className="mm-pricing-grid">
              {PRICING.map((plan, i) => (
                <div key={i} style={{
                  ...S.pricingCard,
                  background: plan.highlight ? `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 50%, ${C.cyan600} 100%)` : C.card,
                  border: `1.5px solid ${plan.highlight ? 'rgba(0,200,240,0.28)' : C.border}`,
                  boxShadow: plan.highlight ? '0 20px 60px rgba(0,31,107,0.28)' : C.shadow,
                }}>
                  {plan.highlight && (
                    <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: C.blue500, borderRadius: 99, padding: '4px 14px', fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(26,110,255,0.40)' }}>
                      MOST POPULAR
                    </div>
                  )}
                  <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: plan.highlight ? 'rgba(255,255,255,0.55)' : C.sub, marginBottom: 8 }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 22 }}>
                    <span style={{ fontFamily: F.display, fontSize: 40, fontWeight: 900, color: plan.highlight ? '#fff' : C.text }}>{plan.price}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.40)' : C.muted }}>{plan.period}</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: F.body, fontSize: 13.5, color: plan.highlight ? 'rgba(255,255,255,0.82)' : C.sub }}>
                        <span style={{ color: plan.highlight ? C.cyan400 : C.blue500, fontSize: 14, flexShrink: 0 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button style={{
                    width: '100%', padding: '13px',
                    background: plan.highlight ? 'rgba(255,255,255,0.12)' : 'transparent',
                    border: plan.highlight ? '1px solid rgba(255,255,255,0.20)' : `1.5px solid ${C.borderMd}`,
                    color: plan.highlight ? '#fff' : C.sub,
                    fontFamily: F.display, fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: 'pointer', transition: 'all 0.18s',
                  }}
                    onClick={() => plan.action === 'contact' ? window.location.href = 'mailto:hello@mockmate.in' : goToAuth()}
                    onMouseEnter={e => {
                      if (plan.highlight) { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }
                      else { e.currentTarget.style.borderColor = C.blue500; e.currentTarget.style.color = C.blue500; }
                    }}
                    onMouseLeave={e => {
                      if (plan.highlight) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }
                      else { e.currentTarget.style.borderColor = C.borderMd; e.currentTarget.style.color = C.sub; }
                    }}
                  >{plan.cta}</button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
        <section style={{ padding: '0 32px 80px', background: C.bg }}>
          <div style={S.sectionInner}>
            <div style={S.ctaBox}>
              <div style={S.ctaScan} />
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,200,240,0.15)', border: '1px solid rgba(0,200,240,0.25)', borderRadius: 99, padding: '5px 14px', marginBottom: 20 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', animation: 'mmLivePulse 1.6s ease-in-out infinite', boxShadow: '0 0 8px rgba(5,150,105,0.6)' }} />
                  <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.cyan400 }}>READINESS CHALLENGE</span>
                </div>
                <h2 style={{ fontFamily: F.display, fontSize: 'clamp(26px, 4.5vw, 50px)', fontWeight: 900, color: '#fff', margin: '0 0 14px', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
                  The interview that lands your offer<br />is next week.
                </h2>
                <p style={{ fontFamily: F.body, fontSize: 15, color: 'rgba(255,255,255,0.65)', margin: '0 0 32px', lineHeight: 1.65 }}>
                  Don't let it be the first time you've answered under pressure.
                </p>
                <Button surface="dark" size="lg" onClick={goToInterview}>
                  Practice now — it's free
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <footer style={{ background: C.card, borderTop: `1px solid ${C.border}`, padding: '24px 32px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <span style={{ fontFamily: F.display, fontWeight: 900, fontSize: 15, color: C.text }}>
              Mock<span style={{ color: C.blue500 }}>Mate</span>
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>
              © 2026 MockMate · Built by Ritesh Kanara · Gandhinagar University, Gujarat
            </span>
            <div style={{ display: 'flex', gap: 24 }}>
              {[['LinkedIn', 'https://linkedin.com/in/riteshkanara/'], ['GitHub', 'https://github.com/Riteshkanara']].map(([l, h]) => (
                <a key={l} href={h} target="_blank" rel="noreferrer"
                  style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => { e.target.style.color = C.blue500; }}
                  onMouseLeave={e => { e.target.style.color = C.muted; }}
                >{l}</a>
              ))}
            </div>
          </div>
        </footer>

      </div>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  // Status strip
  strip: { position: 'sticky', top: 0, zIndex: 100, background: C.card, borderBottom: `1px solid ${C.border}`, boxShadow: C.shadow },
  stripInner: { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 28px' },
  stripLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  stripRight: { display: 'flex', alignItems: 'center', gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: C.green, display: 'inline-block', animation: 'mmLivePulse 2s ease-in-out infinite', boxShadow: '0 0 8px rgba(5,150,105,0.5)' },
  monoText: { fontFamily: F.mono, fontSize: 10, letterSpacing: '0.4px', color: C.muted },

  // Hero
  hero: { position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 44%, ${C.blue600} 72%, ${C.cyan600} 100%)`, padding: '84px 32px 80px' },
  heroScan: { position: 'absolute', top: 0, left: 0, width: '18%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)', animation: 'mmHeroScan 10s linear infinite', pointerEvents: 'none' },
  heroInner: { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap', position: 'relative' },
  heroLeft: { flex: '1 1 460px', maxWidth: 580 },
  heroRight: { flex: '1 1 360px', display: 'flex', justifyContent: 'center' },
  heroBadge: { display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 99, padding: '5px 14px', marginBottom: 22, backdropFilter: 'blur(10px)' },
  heroH1: { fontFamily: F.display, fontSize: 'clamp(38px, 5.2vw, 62px)', fontWeight: 900, color: '#fff', lineHeight: 1.09, letterSpacing: '-2.2px', margin: '0 0 20px' },
  heroSub: { fontFamily: F.body, fontSize: 16, lineHeight: 1.72, color: 'rgba(255,255,255,0.70)', margin: '0 0 34px', maxWidth: 480 },
  heroActions: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 42 },
  heroStats: { display: 'flex', gap: 36, paddingTop: 34, borderTop: '1px solid rgba(255,255,255,0.12)', flexWrap: 'wrap' },
  btnHeroPrimary: { background: '#fff', border: 'none', color: C.blue700, fontFamily: F.display, fontSize: 14, fontWeight: 800, padding: '13px 26px', borderRadius: 10, cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', transition: 'all 0.18s' },
  btnHeroGhost: { background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.84)', fontFamily: F.display, fontSize: 14, fontWeight: 600, padding: '13px 22px', borderRadius: 10, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', backdropFilter: 'blur(10px)', transition: 'all 0.18s' },

  // Modes
  modesSection: { padding: '42px 32px', background: C.bgDeep, borderTop: `1px solid ${C.borderMd}`, borderBottom: `1px solid ${C.borderMd}` },
  modeRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 },
  modeChip: { display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' },

  // Shared section
  sectionInner: { maxWidth: 1200, margin: '0 auto' },
  eyebrow: { fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.blue500, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 },
  sectionH2: { fontFamily: F.display, fontSize: 'clamp(26px, 3.6vw, 40px)', fontWeight: 900, color: C.text, margin: '0 0 14px', letterSpacing: '-0.9px', lineHeight: 1.15 },
  sectionSub: { fontFamily: F.body, fontSize: 14, color: C.sub, lineHeight: 1.68, margin: 0, maxWidth: 540 },
  btnSecondary: { border: `1.5px solid ${C.borderMd}`, background: C.card, color: C.sub, fontFamily: F.display, fontSize: 13.5, fontWeight: 700, padding: '11px 22px', borderRadius: 10, cursor: 'pointer', boxShadow: C.shadow, transition: 'all 0.18s', whiteSpace: 'nowrap' },

  // IRS section
  irsSection: { padding: '96px 32px', background: C.card },
  irsGrid: { display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 72, alignItems: 'center' },

  // Tiers
  tiersSection: { padding: '80px 32px', background: C.bgDeep },
  tiersGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 },
  tierCard: { padding: '20px 18px', borderRadius: 16, boxShadow: C.shadow, transition: 'all 0.2s', cursor: 'default' },

  // Dimensions
  dimsSection: { padding: '80px 32px', background: C.card },
  dimsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  dimCard: { padding: '16px 15px', borderRadius: 14, boxShadow: C.shadow, transition: 'all 0.22s', cursor: 'default' },

  // Features
  featuresGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 36 },
  featureCard: { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '24px 20px', boxShadow: C.shadow, transition: 'all 0.22s', cursor: 'default' },

  // Streak
  streakSection: { padding: '72px 32px', background: C.bg },
  streakBox: { display: 'flex', alignItems: 'center', gap: 48, flexWrap: 'wrap', background: C.card, border: `1.5px solid ${C.borderMd}`, borderRadius: 22, padding: '40px 36px', boxShadow: C.shadowMd },
  badgeGrid: { flex: '1 1 300px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  badgeCard: { borderRadius: 14, padding: '18px 14px', textAlign: 'center', boxShadow: C.shadow, transition: 'all 0.2s', cursor: 'default' },

  // Pricing
  pricingGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 36 },
  pricingCard: { borderRadius: 18, padding: '28px 24px', position: 'relative' },

  // CTA
  ctaBox: { background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 50%, ${C.cyan600} 100%)`, borderRadius: 24, padding: '72px 40px', position: 'relative', overflow: 'hidden', boxShadow: C.shadowLg },
  ctaScan: { position: 'absolute', top: 0, left: 0, width: '18%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)', animation: 'mmHeroScan 12s linear infinite', pointerEvents: 'none' },
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.borderMd}; border-radius: 99px; }

  @keyframes mmLivePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.80)} }
  @keyframes mmHeroScan  { 0%{transform:translateX(-100%)} 100%{transform:translateX(500%)} }
  @keyframes mmFadeUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

  @media (max-width: 1000px) {
    .mm-irs-grid      { grid-template-columns: 1fr !important; gap: 40px !important; }
    .mm-tiers-grid    { grid-template-columns: repeat(2, 1fr) !important; }
    .mm-features-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .mm-pricing-grid  { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 760px) {
    .mm-hero-inner    { gap: 36px !important; }
    .mm-tiers-grid    { grid-template-columns: 1fr !important; }
    .mm-dims-grid     { grid-template-columns: repeat(2, 1fr) !important; }
    .mm-features-grid { grid-template-columns: 1fr !important; }
    .mm-streak-box    { flex-direction: column !important; gap: 28px !important; }
    .mm-strip-right   { display: none !important; }
  }
  @media (max-width: 540px) {
    .mm-dims-grid  { grid-template-columns: 1fr !important; }
    .mm-badge-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }
`;

export default Home;