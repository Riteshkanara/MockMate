import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import usePlan from '../hooks/usePlan';
import useUpgrade from '../hooks/useUpgrade';
import ProBadge from './pro/ProBadge';
import { getMyProfile, getShareLink, setMyState } from '../Services/profileServices';
import { INDIAN_STATES } from '../utils/indianStates';
import { C as TOKENS } from '../styles/token';
import { ArenaCard, ARENA_BG } from './share/ArenaCard';
import { PlayerCard, GlobalStyles, themeFor, buildShareText, round, F, CARD_W } from './share/PlayerCard';

// ─── Small inline icons for the share buttons ────────────────────────────────
const Svg = ({ children, size = 20, fill = 'none', stroke = 'currentColor', sw = 1.9 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>{children}</svg>
);
Svg.propTypes = { children: PropTypes.node, size: PropTypes.number, fill: PropTypes.string, stroke: PropTypes.string, sw: PropTypes.number };

const IcWhatsApp = () => <Svg><path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3z" /><path d="M9 8.3c0 3.6 3.1 6.7 6.7 6.7l1-1.7-2.1-1-.8.8a4.1 4.1 0 01-2-2l.8-.8-1-2.1z" fill="currentColor" stroke="none" /></Svg>;
const IcLinkedIn = () => <Svg fill="currentColor" stroke="none"><rect x="3" y="9" width="3.6" height="12" rx="0.6" /><circle cx="4.8" cy="4.9" r="2.1" /><path d="M10 9h3.4v1.7c.6-1.1 2-2 3.8-2 3.3 0 3.8 2.2 3.8 5V21h-3.5v-6c0-1.4 0-3-1.9-3s-2.2 1.4-2.2 2.9V21H10z" /></Svg>;
const IcX = () => <Svg fill="currentColor" stroke="none"><path d="M4 4h4.4l11.6 16h-4.4z" /><path d="M19.4 4L13.2 11M4.6 20l6.2-7" stroke="currentColor" strokeWidth="1.9" fill="none" /></Svg>;
const IcLink = () => <Svg><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></Svg>;
const IcShare = () => <Svg size={18}><path d="M12 15V3" /><path d="M7.5 7.5L12 3l4.5 4.5" /><path d="M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6" /></Svg>;
const IcDownload = () => <Svg size={16}><path d="M12 3v12" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 20h14" /></Svg>;

const LoadingCard = () => (
  <div style={{ width: '100%', maxWidth: CARD_W, minHeight: 260, borderRadius: 24, background: `linear-gradient(160deg, ${TOKENS.surfaceAlt}, ${TOKENS.brand50} 60%, ${TOKENS.accentTint})`, border: `1px solid ${TOKENS.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: TOKENS.brand600, letterSpacing: '0.6px' }}>
    <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${TOKENS.brand600}, ${TOKENS.accent400})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontSize: 22, fontWeight: 900, boxShadow: '0 10px 22px rgba(0,87,232,0.28)' }}>M</div>
    forging your player card…
  </div>
);

const EmptyCard = ({ totalScore }) => (
  <div style={{ width: '100%', maxWidth: CARD_W, borderRadius: 24, background: `linear-gradient(160deg, ${TOKENS.surfaceAlt}, ${TOKENS.brand50} 60%, ${TOKENS.accentTint})`, border: `1px solid ${TOKENS.border}`, padding: '24px 22px', boxShadow: '0 8px 28px rgba(26,110,255,0.10)' }}>
    <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: TOKENS.text, marginBottom: 6 }}>First session logged. 🎮</div>
    <div style={{ fontSize: 12.5, color: TOKENS.textSub, lineHeight: 1.6, fontFamily: F.body }}>
      You scored <strong style={{ color: TOKENS.brand600 }}>{round(totalScore)}/100</strong>. Your player card — level, rank and skill fingerprint — unlocks once a couple more sessions give it enough to work with.
    </div>
  </div>
);
EmptyCard.propTypes = { totalScore: PropTypes.number.isRequired };

const ScoreCard = (props) => {
  const { totalScore = 0 } = props;
  const { user } = useAuth();
  const cardRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | empty | error
  const [sharing, setSharing] = useState(false);
  const [format, setFormat] = useState('card'); // card | post (4:5) | story (9:16)
  const [look, setLook] = useState('arena'); // arena (dark, immersive) | light
  const story = format === 'story';
  const compact = format === 'post';
  const holderRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [cardH, setCardH] = useState(0);
  const [still, setStill] = useState(false);
  const [slug, setSlug] = useState(null);
  const { canUseFeature } = usePlan();
  const { openUpgrade } = useUpgrade();
  const canDownload = canUseFeature('scorecardDownload');

  const [levelUp, setLevelUp] = useState(null);

  // WHY: scale the 420px card down on narrow phones instead of scrolling sideways.
  // Only a transform on a wrapper — the exported node itself is never scaled.
  useEffect(() => {
    const holder = holderRef.current;
    const card = cardRef.current;
    if (!holder || !card || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      setScale(Math.min(1, holder.clientWidth / CARD_W));
      setCardH(card.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(holder); ro.observe(card);
    return () => ro.disconnect();
  }, [loadState, format]);

  const loadProfile = useCallback(async (isCancelled = () => false) => {
    try {
      const data = await getMyProfile();
      if (isCancelled()) return;
      if (data?.hasData) { setProfile(data); setLoadState('ready'); } else { setLoadState('empty'); }
    } catch (err) {
      console.error('ScoreCard: profile fetch failed', err);
      if (!isCancelled()) setLoadState('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadProfile(() => cancelled);
    return () => { cancelled = true; };
  }, [loadProfile]);

  // Level-up moment: compare against the last level this browser saw.
  useEffect(() => {
    if (loadState !== 'ready' || !profile) return;
    const order = ['ROOKIE', 'CHALLENGER', 'ELITE', 'LEGEND'];
    const now = themeFor(profile.tier).level;
    try {
      const prev = localStorage.getItem('mm_last_level');
      if (prev && order.indexOf(now) > order.indexOf(prev)) setLevelUp(now);
      localStorage.setItem('mm_last_level', now);
    } catch { /* storage blocked */ }
  }, [loadState, profile]);

  const handleStatePick = async (e) => {
    const state = e.target.value;
    if (!state) return;
    try {
      await setMyState(state);
      toast.success(`State saved — ${state} rank unlocked!`);
      await loadProfile();
    } catch {
      toast.error('Could not save your state. Try again.');
    }
  };

  // Prefetch the public link so the card footer + share text carry a real URL.
  useEffect(() => {
    if (loadState !== 'ready') return undefined;
    let cancelled = false;
    getShareLink().then((r) => { if (!cancelled && r?.slug) setSlug(r.slug); }).catch(() => {});
    return () => { cancelled = true; };
  }, [loadState]);

  const theme = useMemo(() => themeFor(profile?.tier), [profile]);
  const shareUrl = slug ? `${window.location.origin}/p/${slug}` : window.location.origin;
  const shareText = useMemo(() => (profile ? buildShareText(profile, theme, shareUrl) : ''), [profile, theme, shareUrl]);
  // WhatsApp understands *bold*; every other target gets the plain version.
  const whatsappText = useMemo(() => (profile ? buildShareText(profile, theme, shareUrl, { bold: true }) : ''), [profile, theme, shareUrl]);

  // WHY `still`: freezes count-up/ring/sheen so the PNG never captures a half-animated frame.
  const captureCard = useCallback(async () => {
    const node = cardRef.current;
    if (!node) throw new Error('ScoreCard: card ref not mounted');
    setStill(true);
    try {
      await new Promise((r) => setTimeout(r, 160));
      await toPng(node, { skipFonts: true }).catch(() => {});
      return await toPng(node, {
        skipFonts: true, cacheBust: false, pixelRatio: 3,
        backgroundColor: look === 'arena' ? ARENA_BG : theme.bg[0], width: node.offsetWidth, height: node.offsetHeight,
      });
    } finally {
      setStill(false);
    }
  }, [theme, look]);

  const saveImage = (url) => {
    const link = document.createElement('a');
    link.download = `mockmate-card-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  const handleDownload = async () => {
    if (!canDownload) { openUpgrade('scorecardDownload'); return; }
    const id = toast.loading('Rendering your card…');
    try {
      saveImage(await captureCard());
      toast.dismiss(id); toast.success('Card saved!');
    } catch (err) {
      toast.dismiss(id); console.error('ScoreCard export failed:', err);
      toast.error('Could not create the card image.');
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const url = await captureCard();
      if (navigator.share && window.File) {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'mockmate-card.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'My MockMate Player Card', text: shareText, files: [file] });
          return;
        }
      }
      await navigator.clipboard?.writeText(shareText);
      saveImage(url);
      toast.success('Image saved + caption copied!');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Share failed:', err);
      toast.error('Share failed — try Copy link instead.');
    } finally {
      setSharing(false);
    }
  };

  const openExternal = (href) => window.open(href, '_blank', 'noopener,noreferrer');
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast.success('Profile link copied!'); }
    catch { toast.error('Could not copy the link.'); }
  };

  const chipBase = {
    flex: 1, minWidth: 0, padding: '11px 4px 10px', borderRadius: 14, cursor: 'pointer', fontFamily: F.body, fontSize: 11.5, fontWeight: 800,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', color: '#fff',
  };
  const seg = (on) => ({
    flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.6px',
    borderRadius: 10, color: on ? '#fff' : TOKENS.textSub,
    background: on ? `linear-gradient(90deg, ${TOKENS.brand600}, ${TOKENS.accent500})` : 'transparent',
    boxShadow: on ? '0 6px 14px rgba(0,87,232,0.28)' : 'none',
  });

  return (
    <div style={{ maxWidth: CARD_W, margin: '0 auto', fontFamily: F.body }}>
      <GlobalStyles />
      {loadState === 'loading' && <LoadingCard />}
      {loadState === 'empty' && <EmptyCard totalScore={totalScore} />}
      {loadState === 'error' && (
        <div style={{ padding: 18, borderRadius: 14, background: TOKENS.dangerTint, border: `1px solid ${TOKENS.danger}30`, fontSize: 12, color: TOKENS.danger, textAlign: 'center' }}>
          Couldn&apos;t load your card right now — try again in a moment.
        </div>
      )}

      {loadState === 'ready' && profile && (
        <>
          {levelUp && (
            <div className="mm9-pop" style={{ marginBottom: 12, padding: '13px 16px', borderRadius: 16, textAlign: 'center', fontFamily: F.display, fontWeight: 800, fontSize: 15, color: '#fff', background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 12px 28px ${theme.glow}` }}>
              🎉 LEVEL UP — you&apos;re now {levelUp}! Share it while it&apos;s fresh.
            </div>
          )}

          <div style={{ display: 'flex', padding: 4, gap: 4, borderRadius: 14, background: TOKENS.brand50, border: `1px solid ${TOKENS.brand100}`, marginBottom: 8, maxWidth: 340, marginInline: 'auto' }}>
            <button type="button" style={seg(look === 'arena')} onClick={() => setLook('arena')}>ARENA · DARK</button>
            <button type="button" style={seg(look === 'light')} onClick={() => setLook('light')}>SKY · LIGHT</button>
          </div>
          <div style={{ display: 'flex', padding: 4, gap: 4, borderRadius: 14, background: TOKENS.brand50, border: `1px solid ${TOKENS.brand100}`, marginBottom: 14, maxWidth: 340, marginInline: 'auto' }}>
            <button type="button" style={seg(format === 'card')} onClick={() => setFormat('card')}>FULL</button>
            <button type="button" style={seg(format === 'post')} onClick={() => setFormat('post')}>POST 4:5</button>
            <button type="button" style={seg(story)} onClick={() => setFormat('story')}>STORY 9:16</button>
          </div>

          {/* scaled holder: the card keeps its real 420px size for export, only the preview shrinks on phones */}
          <div ref={holderRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '2px 0 6px' }}>
            <div className="mm9-rise" style={{ width: CARD_W * scale, height: cardH ? cardH * scale : undefined, flexShrink: 0 }}>
              <div style={{ width: CARD_W, transformOrigin: 'top left', transform: scale < 1 ? `scale(${scale})` : undefined }}>
                <div ref={cardRef} style={{ width: CARD_W }}>
                  {look === 'arena'
                    ? <ArenaCard profile={profile} user={user} theme={theme} story={story} compact={compact} still={still} shareUrl={shareUrl} />
                    : <PlayerCard profile={profile} user={user} theme={theme} story={story} compact={compact} still={still} shareUrl={shareUrl} />}
                </div>
              </div>
            </div>
          </div>

          {!profile.stateName && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '11px 13px', borderRadius: 14, background: `linear-gradient(90deg, ${TOKENS.brand50}, ${TOKENS.accentTint})`, border: `1px solid ${TOKENS.brand100}`, fontSize: 12.5, color: TOKENS.textSub }}>
              <span style={{ flex: 1 }}>📍 Add your state to unlock your <strong style={{ color: TOKENS.text }}>state rank</strong> on the card</span>
              <select defaultValue="" onChange={handleStatePick} style={{ padding: '7px 8px', borderRadius: 9, border: `1px solid ${TOKENS.borderMd}`, fontFamily: F.body, fontSize: 12, background: '#fff', color: TOKENS.text }}>
                <option value="">Select</option>
                {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </label>
          )}

          <button
            type="button" onClick={handleShare} disabled={sharing}
            style={{
              width: '100%', marginTop: 14, border: 'none', borderRadius: 16, padding: '15px 20px', cursor: sharing ? 'wait' : 'pointer',
              fontFamily: F.display, fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: `linear-gradient(90deg, ${TOKENS.brand600}, ${TOKENS.brand500} 55%, ${TOKENS.accent400})`, boxShadow: '0 14px 30px rgba(0,87,232,0.32)',
            }}
          >
            <IcShare />{sharing ? 'Preparing…' : 'Share my card & challenge friends'}
          </button>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" style={{ ...chipBase, background: 'linear-gradient(160deg,#2FE07A,#16A34A)', boxShadow: '0 8px 18px rgba(22,163,74,0.28)' }} onClick={() => openExternal(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`)}><IcWhatsApp />WhatsApp</button>
            <button type="button" style={{ ...chipBase, background: 'linear-gradient(160deg,#2F8CE0,#0A66C2)', boxShadow: '0 8px 18px rgba(10,102,194,0.28)' }} onClick={() => openExternal(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`)}><IcLinkedIn />LinkedIn</button>
            <button type="button" style={{ ...chipBase, background: 'linear-gradient(160deg,#2B3A55,#0A1628)', boxShadow: '0 8px 18px rgba(10,22,40,0.28)' }} onClick={() => openExternal(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`)}><IcX />X</button>
            <button type="button" style={{ ...chipBase, background: '#fff', color: TOKENS.brand600, border: `1.5px solid ${TOKENS.brand100}`, boxShadow: '0 8px 18px rgba(26,110,255,0.10)' }} onClick={copyLink}><IcLink />Copy link</button>
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 12, background: TOKENS.brand50, border: `1px solid ${TOKENS.brand100}`, fontSize: 11.5, lineHeight: 1.45, color: TOKENS.textSub }}>
            <span style={{ fontSize: 15 }}>🖼️</span>
            <span>Your link opens with a rich preview picture on WhatsApp, LinkedIn and X — no screenshot needed.</span>
          </div>

          <button
            type="button" onClick={handleDownload}
            style={{ width: '100%', marginTop: 8, padding: '12px 20px', borderRadius: 14, cursor: 'pointer', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, background: '#fff', border: `1.5px solid ${TOKENS.brand100}`, color: TOKENS.brand700 }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IcDownload />Download HD image{!canDownload && <ProBadge variant="pro" />}
            </span>
          </button>
        </>
      )}
    </div>
  );
};

export default ScoreCard;
