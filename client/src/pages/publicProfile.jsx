import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicProfile } from '../Services/profileServices';

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC PROFILE — /p/:slug
// Renders a read-only, unauthenticated view of another user's score card.
// Matches the blueprint-blue system used across MockMate.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg: '#F0F4FF',
  card: '#FFFFFF',
  cardAlt: '#F8FAFF',
  text: '#0A1628',
  sub: '#3D5280',
  muted: '#7A8BAF',
  border: '#DDE5F7',
  borderMd: '#B8CAF0',
  blue50: '#EBF2FF',
  blue500: '#1A6EFF',
  blue600: '#0057E8',
  blue700: '#0044C4',
  blue900: '#001F6B',
  cyan400: '#00C8F0',
  cyan500: '#00ADE0',
  green: '#059669',
  amber: '#D97706',
  orange: '#EA580C',
};

const F = {
  display: "'Plus Jakarta Sans', 'Lexend', sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

const scoreColor = (s) => (s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange);

const PublicProfile = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | notfound | error

  useEffect(() => {
    (async () => {
      try {
        const data = await getPublicProfile(slug);
        setProfile(data);
        setStatus('ok');
      } catch (e) {
        setStatus(e?.response?.status === 404 ? 'notfound' : 'error');
      }
    })();
  }, [slug]);

  if (status === 'loading') {
    return (
      <Shell>
        <div style={S.centerWrap}>
          <div style={S.spinner} />
          <div style={S.loadText}>Loading profile…</div>
        </div>
      </Shell>
    );
  }

  if (status === 'notfound') {
    return (
      <Shell>
        <div style={S.centerWrap}>
          <h1 style={S.notFoundTitle}>Profile not found</h1>
          <p style={S.notFoundSub}>This share link doesn't match any MockMate profile.</p>
          <Link to="/" style={S.homeLink}>Go to MockMate →</Link>
        </div>
      </Shell>
    );
  }

  if (status === 'error') {
    return (
      <Shell>
        <div style={S.centerWrap}>
          <h1 style={S.notFoundTitle}>Couldn't load this profile</h1>
          <p style={S.notFoundSub}>Something went wrong. Try refreshing the page.</p>
        </div>
      </Shell>
    );
  }

  if (!profile.hasData) {
    return (
      <Shell>
        <div style={S.centerWrap}>
          <div style={S.avatarBig}>{(profile.name ?? 'A')[0].toUpperCase()}</div>
          <h1 style={S.notFoundTitle}>{profile.name} hasn't run an interview yet</h1>
          <p style={S.notFoundSub}>Check back once they've completed their first session.</p>
          <Link to="/" style={S.homeLink}>Try MockMate yourself →</Link>
        </div>
      </Shell>
    );
  }

  const { name, irs, tier, archetype, strongestDim, weakestDim, averageScore, bestScore, totalInterviews, dimensionProfile } = profile;

  return (
    <Shell>
      <div style={S.container}>
        {/* Hero score card */}
        <section style={S.hero}>
          <div style={S.heroGlow} />
          <div style={S.heroEyebrow}>MOCKMATE · PUBLIC SCORE CARD</div>
          <div style={S.heroTop}>
            <div style={S.heroLeft}>
              <div style={S.irsNum}>{irs}<span style={S.irsMax}>/100</span></div>
              <div style={S.irsLabel}>INTERVIEW READINESS SCORE</div>
              <div style={{ ...S.tierPill, background: `${tier.color ?? C.blue500}22`, color: tier.color ?? C.blue500 }}>
                {tier.label} eligible
              </div>
            </div>
            <div style={S.heroRight}>
              <h1 style={S.heroName}>{name}</h1>
              <p style={S.heroSub}>
                {totalInterviews} mock interview{totalInterviews !== 1 ? 's' : ''} completed ·{' '}
                {archetype.icon} {archetype.label}
              </p>
            </div>
          </div>
        </section>

        {/* Quick stats */}
        <section style={S.statsRow}>
          <StatCard label="Avg score" value={averageScore} unit="/100" color={scoreColor(averageScore)} />
          <StatCard label="Best session" value={bestScore} unit="/100" color={C.blue500} />
          <StatCard label="Strongest" value={strongestDim?.label ?? '—'} color={C.green} small />
          <StatCard label="Weakest" value={weakestDim?.label ?? '—'} color={C.amber} small />
        </section>

        {/* Dimension breakdown */}
        <section style={S.card}>
          <div style={S.eyebrowDark}>SIX-DIMENSION BREAKDOWN</div>
          <h2 style={S.cardH2}>Readiness profile</h2>
          <div style={S.dimList}>
            {dimensionProfile.map(d => (
              <div key={d.key} style={S.dimRow}>
                <div style={S.dimMeta}>
                  <span style={S.dimName}>{d.label}</span>
                  <span style={{ ...S.dimScore, color: d.hasData ? scoreColor(d.score) : C.muted }}>
                    {d.hasData ? d.score : '—'}
                  </span>
                </div>
                <div style={S.dimTrack}>
                  <div style={{
                    ...S.dimFill,
                    width: d.hasData ? `${d.score}%` : '0%',
                    background: d.hasData ? scoreColor(d.score) : C.border,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={S.ctaWrap}>
          <p style={S.ctaText}>Want to see how you compare?</p>
          <Link to="/" style={S.ctaBtn}>Run your own MockMate interview →</Link>
        </div>
      </div>
    </Shell>
  );
};

const StatCard = ({ label, value, unit, color, small }) => (
  <div style={S.statCard}>
    <div style={S.statLabel}>{label}</div>
    <div style={S.statValRow}>
      <span style={{ ...S.statVal, color, fontSize: small ? 16 : 28 }}>{value}</span>
      {unit && <span style={S.statUnit}>{unit}</span>}
    </div>
  </div>
);

const Shell = ({ children }) => (
  <div style={S.page}>
    {children}
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      * { box-sizing: border-box; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (max-width: 640px) {
        .pp-hero-top { flex-direction: column !important; align-items: flex-start !important; gap: 20px !important; }
        .pp-stats { grid-template-columns: repeat(2, 1fr) !important; }
      }
    `}</style>
  </div>
);

const S = {
  page: {
    minHeight: '100vh', background: C.bg,
    backgroundImage: `radial-gradient(ellipse at 8% 0%, rgba(26,110,255,0.07) 0%, transparent 48%)`,
    padding: '40px 20px 80px', fontFamily: F.body,
  },
  container: { maxWidth: 720, margin: '0 auto' },

  centerWrap: { minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px' },
  spinner: { width: 40, height: 40, borderRadius: '50%', border: `4px solid ${C.blue50}`, borderTopColor: C.blue500, animation: 'spin 0.75s linear infinite' },
  loadText: { marginTop: 16, fontSize: 13, color: C.muted },
  notFoundTitle: { fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.text, margin: '16px 0 8px' },
  notFoundSub: { fontSize: 13, color: C.muted, maxWidth: 340 },
  homeLink: { marginTop: 18, fontSize: 13, fontWeight: 700, color: C.blue600, textDecoration: 'none' },
  avatarBig: {
    width: 64, height: 64, borderRadius: 18, background: C.blue50, border: `1px solid ${C.borderMd}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, fontWeight: 800, color: C.blue600, fontFamily: F.display,
  },

  hero: {
    position: 'relative', overflow: 'hidden', padding: '32px 28px', marginBottom: 16, borderRadius: 24,
    background: `linear-gradient(135deg, ${C.blue900} 0%, ${C.blue700} 45%, ${C.blue600} 75%, ${C.cyan600 ?? C.cyan500} 100%)`,
    boxShadow: '0 24px 64px rgba(0,31,107,0.32)',
  },
  heroGlow: {
    position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%',
    background: `radial-gradient(circle, rgba(0,200,240,0.22), transparent 68%)`,
  },
  heroEyebrow: { fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '1.6px', color: C.cyan400, marginBottom: 20, position: 'relative' },
  heroTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, position: 'relative' },
  heroLeft: { flexShrink: 0 },
  irsNum: { fontFamily: F.display, fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1 },
  irsMax: { fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.5)' },
  irsLabel: { fontFamily: F.mono, fontSize: 9, fontWeight: 600, letterSpacing: '1.2px', color: 'rgba(255,255,255,0.55)', marginTop: 6 },
  tierPill: { display: 'inline-flex', marginTop: 10, padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700 },
  heroRight: { textAlign: 'right', minWidth: 0 },
  heroName: { margin: 0, fontFamily: F.display, fontSize: 26, fontWeight: 800, color: '#fff' },
  heroSub: { margin: '8px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.75)' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 },
  statCard: { padding: '14px 16px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` },
  statLabel: { fontSize: 10.5, fontWeight: 600, color: C.sub },
  statValRow: { display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 6 },
  statVal: { fontFamily: F.display, fontWeight: 800, lineHeight: 1.1 },
  statUnit: { fontFamily: F.mono, fontSize: 11, color: C.muted },

  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, marginBottom: 20 },
  eyebrowDark: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.5px', color: C.blue500, marginBottom: 6 },
  cardH2: { margin: '0 0 16px', fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.text },

  dimList: { display: 'flex', flexDirection: 'column', gap: 12 },
  dimRow: { padding: '10px 12px', borderRadius: 10, background: C.cardAlt, border: `1px solid ${C.border}` },
  dimMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  dimName: { fontSize: 12, fontWeight: 700, color: C.text },
  dimScore: { fontFamily: F.display, fontSize: 14, fontWeight: 800 },
  dimTrack: { height: 5, borderRadius: 999, background: C.border, overflow: 'hidden' },
  dimFill: { height: '100%', borderRadius: 999 },

  ctaWrap: { textAlign: 'center', padding: '20px 0' },
  ctaText: { fontSize: 13, color: C.muted, marginBottom: 10 },
  ctaBtn: {
    display: 'inline-block', textDecoration: 'none',
    background: `linear-gradient(135deg, ${C.blue600}, ${C.blue500})`,
    color: '#fff', padding: '12px 22px', borderRadius: 12,
    fontSize: 13, fontWeight: 700, fontFamily: F.body,
  },
};

export default PublicProfile;