import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import API_BASE from '../config/api.js';

// ═══════════════════════════════════════════════════════════════════════════
// Navbar — Blueprint Blue instrument bar
// Tokens are an EXACT mirror of Analytics/Dashboard's C + F so the navbar
// reads as the same product, not a different app bolted on top.
// Signature element: the logomark's ring doubles as a live IRS gauge —
// the same number the dashboard shows, always visible, always ticking.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg:        '#F0F4FF',
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
  orangeTint:'#FFF7ED',

  red:       '#DC2626',
  redTint:   '#FEF2F2',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

const NAV_LINKS = [
  { label: 'Dashboard',   path: '/dashboard' },
  { label: 'History',     path: '/history' },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'Analytics',   path: '/analytics' },
];
const HIDDEN_ROUTES = ['/auth/callback', '/onboarding'];

const scoreColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

// ─── Logomark: ring gauge + target core, built from SVG, not an emoji ───────
const Logomark = ({ irs = 0, size = 36 }) => {
  const r = size / 2 - 3;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, irs));
  const offset = circ - (pct / 100) * circ;
  const color = scoreColor(pct);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <defs>
          <linearGradient id="mm-logo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C.blue500} />
            <stop offset="100%" stopColor={C.cyan400} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill={C.blue900} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.14)" strokeWidth={2.5}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#mm-logo-grad)" strokeWidth={2.5}
          strokeDasharray={circ} strokeDashoffset={pct > 0 ? offset : circ}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>
      {/* Target crosshair core, sits centred over the ring */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={C.cyan400} strokeWidth="1.6" opacity="0.55" />
          <circle cx="12" cy="12" r="4.5" stroke={C.cyan400} strokeWidth="1.6" opacity="0.85" />
          <circle cx="12" cy="12" r="1.4" fill={color} />
        </svg>
      </div>
    </div>
  );
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [scrolled, setScrolled]     = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropOpen, setDropOpen]     = useState(false);
  const dropRef = useRef(null);
  const navRef  = useRef(null);
  const linkRefs = useRef({});

  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  // ── Stats sourced the same way Dashboard/Analytics compute them ──────────
  // user.irs / user.averageScore / user.streak.current are expected to be
  // populated by the same analytics payload the Dashboard/Analytics pages
  // consume (getAnalytics()). Falls back gracefully if absent so the navbar
  // never crashes on a fresh account with zero sessions.
  const irs        = user?.irs ?? user?.readinessScore ?? 0;
  const avgScore   = user?.averageScore ?? null;
  const streak     = user?.streak?.current ?? 0;
  const tierLabel  = user?.tierLabel ?? (irs >= 80 ? '₹20 LPA+' : irs >= 60 ? '₹12–20 LPA' : irs >= 38 ? '₹6–12 LPA' : '₹3–6 LPA');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDropOpen(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    const activeEl = linkRefs.current[location.pathname];
    if (activeEl && navRef.current) {
      const navBox = navRef.current.getBoundingClientRect();
      const linkBox = activeEl.getBoundingClientRect();
      setIndicator({ left: linkBox.left - navBox.left, width: linkBox.width, opacity: 1 });
    } else {
      setIndicator(prev => ({ ...prev, opacity: 0 }));
    }
  }, [location.pathname, user]);

  if (HIDDEN_ROUTES.includes(location.pathname)) return null;

  const isActive = (path) => location.pathname === path;

  const navStyle = {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    width: '100%',
    background: scrolled ? 'rgba(240,244,255,0.85)' : 'rgba(240,244,255,0.65)',
    backdropFilter: 'blur(22px) saturate(180%)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    borderBottom: `1px solid ${scrolled ? 'rgba(26,110,255,0.14)' : 'rgba(26,110,255,0.08)'}`,
    boxShadow: scrolled
      ? '0 1px 0 rgba(255,255,255,0.7) inset, 0 12px 32px -12px rgba(0,31,107,0.14)'
      : '0 1px 0 rgba(255,255,255,0.5) inset',
    transition: 'background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

        .mm-nav-link {
          position: relative;
          display: flex;
          align-items: center;
          padding: 8px 15px;
          border-radius: 9px;
          font-family: ${F.body};
          font-size: 13.5px;
          font-weight: 500;
          letter-spacing: -0.1px;
          color: ${C.sub};
          text-decoration: none;
          transition: color 0.18s ease;
          border: none;
          background: transparent;
          cursor: pointer;
          white-space: nowrap;
          z-index: 1;
        }
        .mm-nav-link:hover { color: ${C.text}; }
        .mm-nav-link.active { color: ${C.blue600}; font-weight: 700; }

        .mm-nav-indicator {
          position: absolute;
          top: 4px;
          height: 34px;
          border-radius: 9px;
          background: ${C.blue50};
          border: 1px solid ${C.borderMd};
          transition: left 0.32s cubic-bezier(.22,1,.36,1), width 0.32s cubic-bezier(.22,1,.36,1), opacity 0.2s ease;
          pointer-events: none;
        }

        .mm-cta { position: relative; overflow: hidden; }
        .mm-cta::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.30) 50%, transparent 70%);
          transform: translateX(-120%);
          transition: transform 0.6s ease;
        }
        .mm-cta:hover::after { transform: translateX(120%); }
        .mm-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,87,232,0.38) !important; }
        .mm-cta:active { transform: translateY(0) scale(0.98); }

        .mm-avatar-btn:hover { border-color: ${C.borderStr} !important; background: ${C.blue50} !important; }

        .mm-stat-pill { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .mm-stat-pill:hover { transform: translateY(-1px); }

        .mm-drop-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 9px 12px;
          border-radius: 10px;
          border: none;
          background: transparent;
          font-family: ${F.body};
          font-size: 13.5px;
          font-weight: 500;
          color: ${C.text};
          cursor: pointer;
          text-align: left;
          transition: background 0.12s ease, color 0.12s ease, padding-left 0.15s ease;
        }
        .mm-drop-item:hover { background: ${C.cardAlt}; color: ${C.blue600}; padding-left: 15px; }
        .mm-drop-item.danger { color: ${C.red}; }
        .mm-drop-item.danger:hover { background: ${C.redTint}; color: ${C.red}; padding-left: 15px; }

        .mm-mobile-link {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          border: none;
          background: transparent;
          font-family: ${F.body};
          font-size: 14px;
          font-weight: 500;
          color: ${C.sub};
          cursor: pointer;
          text-align: left;
          text-decoration: none;
          transition: all 0.15s;
        }
        .mm-mobile-link:hover, .mm-mobile-link.active { background: ${C.blue50}; color: ${C.blue600}; }

        .mm-streak { animation: streakBreathe 3s ease-in-out infinite; }
        @keyframes streakBreathe {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234,88,12,0.16); }
          50%      { box-shadow: 0 0 0 4px rgba(234,88,12,0); }
        }

        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .mm-nav-link:focus-visible,
        .mm-drop-item:focus-visible,
        .mm-mobile-link:focus-visible,
        button:focus-visible {
          outline: 2px solid ${C.blue500};
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .mm-nav-indicator, .mm-cta::after, .mm-streak { transition: none !important; animation: none !important; }
        }

        @media (max-width: 1050px) { .mm-stat-strip { display: none !important; } }
        @media (max-width: 767px)  { .mm-desktop-only { display: none !important; } }
        @media (min-width: 768px)  { .mm-mobile-only { display: none !important; } }
      `}</style>

      <nav style={navStyle}>
        <div style={{
          maxWidth: 1220,
          margin: '0 auto',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>

          {/* ── Logo ── */}
          <Link
            to={user ? '/dashboard' : '/'}
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}
          >
            <Logomark irs={irs} size={36} />
            <div>
              <div style={{
                fontFamily: F.display,
                fontSize: 17,
                fontWeight: 800,
                color: C.text,
                letterSpacing: '-0.5px',
                lineHeight: 1,
              }}>
                Mock<span style={{
                  background: `linear-gradient(120deg, ${C.blue600}, ${C.cyan500})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>Mate</span>
              </div>
              <div style={{
                fontFamily: F.mono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '1.6px',
                textTransform: 'uppercase',
                color: C.muted,
                marginTop: 3,
              }}>
                AI Interview
              </div>
            </div>
          </Link>

          {/* ── Desktop Nav Links (sliding indicator) ── */}
          {user && (
            <div
              ref={navRef}
              className="mm-desktop-only"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}
            >
              <div className="mm-nav-indicator" style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }} />
              {NAV_LINKS.map(link => (
                <Link
                  key={link.path}
                  ref={el => { linkRefs.current[link.path] = el; }}
                  to={link.path}
                  className={`mm-nav-link${isActive(link.path) ? ' active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* ── Right Side ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

            {user ? (
              <>
                {/* Live stat strip — IRS, avg score, streak. Mirrors Dashboard numbers. */}
                <div className="mm-stat-strip" style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>

                  {/* IRS pill */}
                  <div className="mm-stat-pill" style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: C.blue50, border: `1px solid ${C.borderMd}`,
                    borderRadius: 99, padding: '5px 11px 5px 9px',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor(irs), flexShrink: 0 }} />
                    <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.4px' }}>IRS</span>
                    <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: C.blue700 }}>{irs}</span>
                  </div>

                  {/* Avg score pill */}
                  {avgScore !== null && (
                    <div className="mm-stat-pill" style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: C.cyanTint, border: `1px solid #A0E8FA`,
                      borderRadius: 99, padding: '5px 11px',
                    }}>
                      <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.cyan600, letterSpacing: '0.4px' }}>AVG</span>
                      <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: C.cyan600 }}>{avgScore}</span>
                    </div>
                  )}

                  {/* Streak pill */}
                  {streak > 0 && (
                    <div
                      className="mm-stat-pill mm-streak"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: C.orangeTint, border: `1px solid #FDBA74`,
                        borderRadius: 99, padding: '5px 11px',
                        fontFamily: F.display, fontSize: 12.5, fontWeight: 800, color: C.orange,
                      }}
                    >
                      🔥 {streak}
                    </div>
                  )}
                </div>

                {/* New Interview CTA */}
                <button
                  className="mm-desktop-only mm-cta"
                  onClick={() => navigate('/interview')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
                    border: 'none',
                    color: '#fff',
                    fontFamily: F.body,
                    fontSize: 13,
                    fontWeight: 700,
                    padding: '9px 16px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0,87,232,0.32)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  New interview
                </button>

                {/* Avatar + Dropdown */}
                <div ref={dropRef} style={{ position: 'relative' }} className="mm-desktop-only">
                  <button
                    className="mm-avatar-btn"
                    onClick={() => setDropOpen(!dropOpen)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: dropOpen ? C.blue50 : 'rgba(255,255,255,0.7)',
                      border: `1.5px solid ${dropOpen ? C.borderStr : C.border}`,
                      borderRadius: 11,
                      padding: '5px 10px 5px 5px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28,
                      borderRadius: 8,
                      background: `linear-gradient(135deg, ${C.blue600}, ${C.cyan500})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: F.display,
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#fff',
                      flexShrink: 0,
                    }}>
                      {user.name?.[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.text }}>
                      {user.name?.split(' ')[0]}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: C.muted,
                      display: 'inline-block',
                      transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}>
                      ▾
                    </span>
                  </button>

                  {dropOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      right: 0,
                      width: 250,
                      background: 'rgba(255,255,255,0.92)',
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      border: `1.5px solid ${C.border}`,
                      borderRadius: 16,
                      padding: '6px',
                      boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset, 0 20px 50px rgba(0,31,107,0.16), 0 4px 16px rgba(0,31,107,0.08)',
                      animation: 'dropIn 0.18s cubic-bezier(.22,1,.36,1)',
                    }}>

                      <div style={{ padding: '12px 12px 14px', borderBottom: `1px solid ${C.border}`, marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: `linear-gradient(135deg, ${C.blue600}, ${C.cyan500})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: F.display, fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
                          }}>
                            {user.name?.[0]?.toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: C.text }}>
                              {user.name?.split(' ')[0]}
                            </div>
                            <div style={{ fontFamily: F.body, fontSize: 11.5, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {user.college ?? 'MockMate User'}
                            </div>
                          </div>
                        </div>

                        {/* Mini readiness readout inside dropdown */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
                          background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 6px',
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: scoreColor(irs) }}>{irs}</div>
                            <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, letterSpacing: '0.4px', marginTop: 1 }}>IRS</div>
                          </div>
                          <div style={{ textAlign: 'center', borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.cyan600 }}>{avgScore ?? '—'}</div>
                            <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, letterSpacing: '0.4px', marginTop: 1 }}>AVG</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.orange }}>{streak}</div>
                            <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, letterSpacing: '0.4px', marginTop: 1 }}>STREAK</div>
                          </div>
                        </div>

                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: C.blue50,
                          border: `1px solid ${C.borderMd}`,
                          borderRadius: 99,
                          padding: '3px 9px',
                          marginTop: 8,
                          fontFamily: F.mono,
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.blue600,
                          letterSpacing: '0.4px',
                        }}>
                          {tierLabel} eligible
                        </div>
                      </div>

                      {[
                        { icon: '📊', label: 'Dashboard', path: '/dashboard' },
                        { icon: '🕘', label: 'Interview history', path: '/history' },
                        { icon: '🏆', label: 'Leaderboard', path: '/leaderboard' },
                        { icon: '📈', label: 'Analytics', path: '/analytics' },
                        { icon: '🎯', label: 'New interview', path: '/interview' },
                      ].map(item => (
                        <button key={item.path} className="mm-drop-item" onClick={() => { setDropOpen(false); navigate(item.path); }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 7, background: C.cardAlt,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
                          }}>
                            {item.icon}
                          </div>
                          {item.label}
                        </button>
                      ))}

                      <div style={{ height: 1, background: C.border, margin: '6px 0' }} />

                      <button className="mm-drop-item danger" onClick={() => { setDropOpen(false); logout(); }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 7, background: C.redTint,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
                        }}>
                          🚪
                        </div>
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile hamburger */}
                <button
                  className="mm-mobile-only"
                  onClick={() => setMobileOpen(!mobileOpen)}
                  aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                  style={{
                    background: mobileOpen ? C.blue50 : 'rgba(255,255,255,0.7)',
                    border: `1.5px solid ${mobileOpen ? C.borderStr : C.border}`,
                    borderRadius: 10,
                    width: 38, height: 38,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 16,
                    color: mobileOpen ? C.blue600 : C.sub,
                    transition: 'all 0.15s',
                  }}
                >
                  {mobileOpen ? '✕' : '☰'}
                </button>
              </>
            ) : (
              <a
                href={`${API_BASE}/auth/google`}
                className="mm-cta"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
                  color: '#fff',
                  fontFamily: F.body,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '9px 18px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(0,87,232,0.32)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                Login with Google
              </a>
            )}
          </div>
        </div>

        {/* ── Mobile Menu ── */}
        {mobileOpen && user && (
          <div style={{
            borderTop: `1px solid ${C.border}`,
            padding: '12px 16px 16px',
            background: 'rgba(240,244,255,0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            animation: 'slideDown 0.2s ease',
          }}>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', background: C.card, borderRadius: 14,
              marginBottom: 10, border: `1px solid ${C.border}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.blue600}, ${C.cyan500})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.display, fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: C.text }}>
                  {user.name?.split(' ')[0]}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>
                  {user.college ?? 'MockMate User'}
                </div>
              </div>
            </div>

            {/* Mobile stat strip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ textAlign: 'center', padding: '8px 4px', background: C.blue50, border: `1px solid ${C.borderMd}`, borderRadius: 10 }}>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, color: scoreColor(irs) }}>{irs}</div>
                <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginTop: 1 }}>IRS</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px 4px', background: C.cyanTint, border: '1px solid #A0E8FA', borderRadius: 10 }}>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.cyan600 }}>{avgScore ?? '—'}</div>
                <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginTop: 1 }}>AVG</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px 4px', background: C.orangeTint, border: '1px solid #FDBA74', borderRadius: 10 }}>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.orange }}>🔥{streak}</div>
                <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginTop: 1 }}>STREAK</div>
              </div>
            </div>

            {NAV_LINKS.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`mm-mobile-link${isActive(link.path) ? ' active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            <button
              onClick={() => { setMobileOpen(false); navigate('/interview'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginTop: 6,
                padding: '12px 14px', background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`, border: 'none', borderRadius: 11,
                fontFamily: F.body, fontSize: 14, fontWeight: 700, color: '#fff',
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,87,232,0.3)',
              }}
            >
              New interview
            </button>

            <div style={{ height: 1, background: C.border, margin: '10px 0' }} />

            <button
              onClick={() => { setMobileOpen(false); logout(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '11px 14px', background: C.redTint, border: '1px solid #FECACA', borderRadius: 11,
                fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.red, cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;