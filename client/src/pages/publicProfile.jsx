import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams, Link } from 'react-router-dom';
import API_BASE from '../config/api.js';
import useAuth from '../hooks/useAuth';
import { getPublicProfile, getMyProfile } from '../Services/profileServices';
import { C, F } from '../styles/token';
import { rememberChallenge } from '../utils/challenge';
import { GlobalStyles, themeFor, CARD_W, round, clamp } from '../components/share/PlayerCard';
import { ArenaCard } from '../components/share/ArenaCard';

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC PROFILE — /p/:slug
// The page a shared player card links to. Shows the card, then turns the
// visitor into a challenger: head-to-head vs their own real profile if they
// have one, otherwise a sign-in / first-interview call to action.
// ═══════════════════════════════════════════════════════════════════════════

const GOOGLE_AUTH_URL = `${API_BASE}/auth/google`;

const dimsOf = (p) => (p?.dimensionProfile?.length ? p.dimensionProfile : []);

// WHY: card is 420px wide; scale it down on narrow phones instead of overflowing.
const useCardScale = () => {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const calc = () => setScale(Math.min(1, (window.innerWidth - 32) / CARD_W));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return scale;
};

const Shell = ({ children }) => (
  <div style={S.page}>
    <GlobalStyles />
    <div style={S.blobA} />
    <div style={S.blobB} />
    <div style={S.topBar}>
      <Link to="/" style={S.logo}>
        <span style={S.logoMark}>M</span>
        <span>Mock<span style={{ color: C.brand500 }}>Mate</span></span>
      </Link>
      <span style={S.topTag}>FREE AI MOCK INTERVIEWS</span>
    </div>
    {children}
  </div>
);
Shell.propTypes = { children: PropTypes.node };

const Center = ({ title, sub, link, linkText }) => (
  <div style={S.centerWrap}>
    <h1 style={S.centerTitle}>{title}</h1>
    {sub && <p style={S.centerSub}>{sub}</p>}
    {link && <Link to={link} style={S.primaryBtn}>{linkText}</Link>}
  </div>
);
Center.propTypes = { title: PropTypes.string.isRequired, sub: PropTypes.string, link: PropTypes.string, linkText: PropTypes.string };

// ─── Head-to-head ────────────────────────────────────────────────────────────
const VersusRow = ({ label, mine, theirs }) => {
  const iWin = mine != null && theirs != null && mine > theirs;
  const theyWin = mine != null && theirs != null && theirs > mine;
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 5 }}>
        <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: iWin ? C.success : C.textSub }}>{mine ?? '–'}</span>
        <span style={{ color: C.textSub, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900, color: theyWin ? C.brand600 : C.textSub }}>{theirs ?? '–'}</span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ flex: 1, height: 9, borderRadius: 999, background: C.brand50, border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}>
          <div style={{ width: `${clamp(mine)}%`, background: iWin ? `linear-gradient(270deg, ${C.success}, #34D399)` : `linear-gradient(270deg, ${C.textMuted}, ${C.textFaint})`, borderRadius: 999 }} />
        </div>
        <div style={{ flex: 1, height: 9, borderRadius: 999, background: C.brand50, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ width: `${clamp(theirs)}%`, background: `linear-gradient(90deg, ${C.brand600}, ${C.accent400})`, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
};
VersusRow.propTypes = { label: PropTypes.string.isRequired, mine: PropTypes.number, theirs: PropTypes.number };

const ChallengePanel = ({ profile, slug }) => {
  const { user, isLoading } = useAuth() || {};
  const [mine, setMine] = useState(null);
  const [mineState, setMineState] = useState('idle'); // idle | loading | ready | empty
  const isOwn = Boolean(user?.shareSlug && user.shareSlug === slug);
  const firstName = (profile.name || 'them').split(' ')[0];
  const theirIrs = round(profile.irs ?? 0);

  // WHY: survive the Google redirect so the dashboard can show "X challenged you".
  useEffect(() => {
    if (!isLoading && !isOwn) rememberChallenge(slug);
  }, [isLoading, isOwn, slug]);

  useEffect(() => {
    if (!user || isOwn) return undefined;
    let cancelled = false;
    setMineState('loading');
    getMyProfile()
      .then((d) => { if (cancelled) return; if (d?.hasData) { setMine(d); setMineState('ready'); } else setMineState('empty'); })
      .catch(() => { if (!cancelled) setMineState('empty'); });
    return () => { cancelled = true; };
  }, [user, isOwn]);

  const rows = useMemo(() => {
    if (!mine) return [];
    const theirs = dimsOf(profile);
    return dimsOf(mine).map((d) => {
      const t = theirs.find((x) => x.key === d.key);
      return { key: d.key, label: d.label, mine: d.hasData ? round(d.score) : null, theirs: t?.hasData ? round(t.score) : null };
    });
  }, [mine, profile]);

  const wrap = (children) => <section style={S.panel}>{children}</section>;

  if (isLoading) return null;
  if (isOwn) {
    return wrap(
      <>
        <div style={S.eyebrow}>THIS IS YOUR PUBLIC CARD</div>
        <h2 style={S.panelH2}>Send this link to your friends</h2>
        <p style={S.panelP}>Anyone who opens it sees your card and can challenge your {theirIrs}.</p>
        <Link to="/dashboard" style={S.primaryBtn}>Back to dashboard →</Link>
      </>
    );
  }
  if (!user) {
    return wrap(
      <>
        <div style={S.eyebrow}>CHALLENGE ACCEPTED?</div>
        <h2 style={S.panelH2}>Can you beat {firstName}&apos;s {theirIrs}?</h2>
        <p style={S.panelP}>Take a free AI mock interview and get your own player card, level and rank.</p>
        <a href={GOOGLE_AUTH_URL} style={S.primaryBtn}>Sign in with Google & play →</a>
      </>
    );
  }
  if (mineState === 'loading' || mineState === 'idle') return wrap(<div style={S.panelP}>Loading your stats…</div>);
  if (mineState === 'empty') {
    return wrap(
      <>
        <div style={S.eyebrow}>YOU HAVEN&apos;T PLAYED YET</div>
        <h2 style={S.panelH2}>Finish one interview to face {firstName}</h2>
        <p style={S.panelP}>Your first completed session unlocks a head-to-head comparison.</p>
        <Link to="/dashboard" style={S.primaryBtn}>Start an interview →</Link>
      </>
    );
  }

  const myIrs = round(mine.irs ?? 0);
  const gap = myIrs - theirIrs;
  const verdict = gap > 0 ? `You're ahead by ${gap} point${gap === 1 ? '' : 's'} 🔥`
    : gap === 0 ? 'Dead even — one more session decides it'
    : `${Math.abs(gap)} point${Math.abs(gap) === 1 ? '' : 's'} to catch up`;
  return wrap(
    <>
      <div style={S.eyebrow}>HEAD TO HEAD</div>
      <h2 style={S.panelH2}>{verdict}</h2>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 18px', padding: '14px 18px', borderRadius: 18, background: `linear-gradient(100deg, ${C.brand50}, ${C.accentTint})`, border: `1px solid ${C.brand100}`, fontFamily: F.display, fontWeight: 900 }}>
        <div><div style={{ fontSize: 40, color: gap > 0 ? C.success : C.text, lineHeight: 1, letterSpacing: '-1.5px' }}>{myIrs}</div><div style={S.tiny}>YOU</div></div>
        <div style={S.vsBadge}>VS</div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 40, color: C.brand600, lineHeight: 1, letterSpacing: '-1.5px' }}>{theirIrs}</div><div style={S.tiny}>{firstName.toUpperCase()}</div></div>
      </div>
      {rows.map((r) => <VersusRow key={r.key} label={r.label} mine={r.mine} theirs={r.theirs} />)}
      <Link to="/dashboard" style={{ ...S.primaryBtn, marginTop: 10 }}>{gap > 0 ? 'Defend your lead →' : 'Practice & beat them →'}</Link>
    </>
  );
};
ChallengePanel.propTypes = { profile: PropTypes.object.isRequired, slug: PropTypes.string.isRequired };

const PublicProfile = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | notfound | error
  const scale = useCardScale();

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const data = await getPublicProfile(slug);
        if (cancelled) return;
        setProfile(data);
        setStatus('ok');
      } catch (e) {
        if (!cancelled) setStatus(e?.response?.status === 404 ? 'notfound' : 'error');
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (status === 'ok' && profile?.name) document.title = `${profile.name}'s MockMate Player Card`;
  }, [status, profile]);

  if (status === 'loading') return <Shell><div style={S.centerWrap}><div style={S.loadText}>Loading player card…</div></div></Shell>;
  if (status === 'notfound') return <Shell><Center title="Profile not found" sub="This share link doesn't match any MockMate profile." link="/" linkText="Go to MockMate →" /></Shell>;
  if (status === 'error' || !profile) return <Shell><Center title="Couldn't load this profile" sub="Something went wrong. Try refreshing the page." /></Shell>;
  if (!profile.hasData) {
    return <Shell><Center title={`${profile.name} hasn't run an interview yet`} sub="Check back once they've completed their first session." link="/" linkText="Try MockMate yourself →" /></Shell>;
  }

  const theme = themeFor(profile.tier);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  return (
    <Shell>
      <div style={S.container}>
        <div style={S.heroHead}>
          <span style={{ ...S.levelChip, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 8px 18px ${theme.glow}` }}>{theme.icon} {theme.level}</span>
          <h1 style={S.heroTitle}>{(profile.name || 'A candidate').split(' ')[0]}&apos;s player card</h1>
          <p style={S.heroSub}>Readiness <strong style={{ color: C.text }}>{round(profile.irs ?? 0)}/100</strong> — see how you stack up and take the challenge.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="mm9-rise" style={{ zoom: scale, width: CARD_W }}>
            <ArenaCard profile={profile} theme={theme} shareUrl={shareUrl} />
          </div>
        </div>
        <ChallengePanel profile={profile} slug={slug} />
        <div style={S.trustRow}>
          <span style={S.trustPill}>✓ Verified session data</span>
          <span style={S.trustPill}>⚡ Free AI mock interview</span>
          <span style={S.trustPill}>🏆 Ranks &amp; levels</span>
        </div>
        <p style={S.fine}>Scores are computed from verified MockMate interview sessions.</p>
      </div>
    </Shell>
  );
};

const S = {
  page: { position: 'relative', overflow: 'hidden', minHeight: '100vh', background: `linear-gradient(180deg, ${C.bg} 0%, ${C.brand50} 55%, ${C.accentTint} 100%)`, padding: '0 16px 70px', fontFamily: F.body, color: C.text },
  blobA: { position: 'absolute', top: -160, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,240,0.28), rgba(0,200,240,0) 66%)', pointerEvents: 'none' },
  blobB: { position: 'absolute', top: 360, left: -180, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,91,238,0.16), rgba(109,91,238,0) 66%)', pointerEvents: 'none' },
  topBar: { position: 'relative', maxWidth: 560, margin: '0 auto', padding: '20px 0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: F.display, fontSize: 17, fontWeight: 800, letterSpacing: '-0.4px', color: C.text, textDecoration: 'none' },
  logoMark: { width: 30, height: 30, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 900, background: `linear-gradient(135deg, ${C.brand600}, ${C.accent400})`, boxShadow: '0 6px 14px rgba(0,87,232,0.30)' },
  topTag: { fontFamily: F.mono, fontSize: 9, fontWeight: 700, letterSpacing: '1.2px', color: C.brand600, padding: '5px 10px', borderRadius: 999, background: '#fff', border: `1px solid ${C.brand100}` },
  container: { position: 'relative', maxWidth: 560, margin: '0 auto' },
  heroHead: { textAlign: 'center', margin: '4px 0 18px' },
  levelChip: { display: 'inline-block', padding: '6px 14px', borderRadius: 999, fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '1.3px', color: '#fff' },
  heroTitle: { margin: '12px 0 4px', fontFamily: F.display, fontSize: 28, fontWeight: 900, letterSpacing: '-0.8px', color: C.text },
  heroSub: { margin: 0, fontSize: 13.5, color: C.textSub, lineHeight: 1.5 },
  panel: { position: 'relative', overflow: 'hidden', marginTop: 20, padding: '22px 22px 24px', borderRadius: 24, background: '#fff', border: `1px solid ${C.brand100}`, boxShadow: '0 14px 40px rgba(26,110,255,0.14)' },
  eyebrow: { fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '1.3px', color: C.brand600, marginBottom: 6 },
  panelH2: { margin: '0 0 8px', fontFamily: F.display, fontSize: 23, fontWeight: 900, letterSpacing: '-0.5px', color: C.text },
  panelP: { margin: '0 0 16px', fontSize: 13.5, lineHeight: 1.6, color: C.textSub },
  tiny: { fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '1px', color: C.textMuted, marginTop: 6 },
  vsBadge: { width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${C.violet}, ${C.brand500})`, boxShadow: '0 8px 18px rgba(109,91,238,0.32)' },
  primaryBtn: { display: 'block', textAlign: 'center', padding: '15px 20px', borderRadius: 16, textDecoration: 'none', fontFamily: F.display, fontSize: 15, fontWeight: 800, color: '#fff', background: `linear-gradient(90deg, ${C.brand600}, ${C.brand500} 55%, ${C.accent400})`, boxShadow: '0 14px 30px rgba(0,87,232,0.32)' },
  trustRow: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 },
  trustPill: { padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: C.textSub, background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(26,110,255,0.06)' },
  centerWrap: { position: 'relative', maxWidth: 440, margin: '90px auto 0', textAlign: 'center' },
  centerTitle: { margin: '0 0 8px', fontFamily: F.display, fontSize: 24, fontWeight: 900, color: C.text },
  centerSub: { margin: '0 0 22px', fontSize: 14, color: C.textSub, lineHeight: 1.6 },
  loadText: { fontFamily: F.mono, fontSize: 12, color: C.textMuted, marginTop: 60 },
  fine: { marginTop: 14, textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: C.textMuted },
};

export default PublicProfile;
