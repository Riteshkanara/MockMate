import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { getDashboardAnalytics } from '../../Services/interviewService';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from '../pro/ProBadge';
import ProLiveDemo from '../pro/ProLiveDemo';
import { CoachLoader } from '../PageLoaders';

/**
 * CoachFree: the AI Coach page for free users.
 * It shows the REAL Coach page, fully visible and clickable, filled with example data. The
 * Coach spends AI quota on every message, so pressing a button inside the demo shows an EXAMPLE
 * response (first lines readable, the rest blurred). The real Coach stays Pro-only (enforced on
 * the server); nothing here is real Pro output and the demo never calls the server.
 */
const BENEFITS = [
  'Today\'s focus, chosen from your weakest area',
  'A 7-day plan built from your real scores',
  'Company-by-company readiness gaps',
  'A plain-language debrief after every session',
  'Chat about any weak answer, any time',
  'Full analytics, blind spots and salary-tier roadmap',
];

export default function CoachFree({ preview = null }) {
  const navigate = useNavigate();
  const { openUpgrade } = useUpgrade();
  const [weakest, setWeakest] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getDashboardAnalytics();
        if (cancelled) return;
        const t = [...(d?.topicPerformance || [])].sort((a, b) => a.averageScore - b.averageScore)[0];
        setWeakest(t || null);
        setSessions(Number(d?.totalSessions ?? d?.totalInterviews) || 0);
      } catch { /* the page works fine without personal lines */ }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const personal = weakest
    ? `From your sessions: ${weakest.topic} is your lowest topic at ${weakest.averageScore}%.`
    : sessions === 0
      ? 'Finish one interview and the Coach has something real to work with.'
      : null;

  if (!ready) return <CoachLoader bg={C.bg} />;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '24px 20px 72px', fontFamily: F.body }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <style>{`
          .cf-hero { position:relative; overflow:hidden; border-radius:24px; padding:clamp(22px,4vw,44px); background:#fff; border:1px solid ${C.brand100}; box-shadow:0 18px 44px -22px rgba(26,110,255,.30);
            background-image:radial-gradient(60% 90% at 100% 0%, rgba(0,200,240,.13) 0%, transparent 60%), radial-gradient(55% 80% at 0% 100%, rgba(26,110,255,.08) 0%, transparent 60%); }
          .cf-grid { position:relative; display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr); gap:clamp(20px,4vw,44px); align-items:center; }
          .cf-eyebrow { display:inline-flex; align-items:center; gap:8px; font-family:${F.mono}; font-size:10.5px; font-weight:800; letter-spacing:.14em; color:${C.brand600}; margin-bottom:14px; }
          .cf-h1 { margin:0; font-family:${F.display}; font-size:clamp(26px,3.9vw,40px); font-weight:900; letter-spacing:-.9px; line-height:1.1; color:${C.text}; }
          .cf-h1 em { font-style:normal; background:linear-gradient(100deg,${C.brand500},${C.accent400}); -webkit-background-clip:text; background-clip:text; color:transparent; }
          .cf-sub { margin:14px 0 0; max-width:520px; font-size:15px; line-height:1.7; color:${C.textSub}; }
          .cf-points { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 0; padding:0; list-style:none; }
          .cf-points li { display:inline-flex; align-items:center; gap:7px; padding:6px 12px; border-radius:99px; background:${C.brand50}; border:1px solid ${C.brand100}; font-size:12.5px; font-weight:700; color:${C.brand700}; }
          .cf-cta { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:9px; height:50px; padding:0 26px; border:none; border-radius:14px; cursor:pointer; background:linear-gradient(135deg,${C.brand500},${C.brand600}); color:#fff; font-family:${F.display}; font-size:15px; font-weight:800; box-shadow:0 12px 26px -8px rgba(26,110,255,.55), inset 0 1px 0 rgba(255,255,255,.25); transition:transform .18s ease, box-shadow .18s ease; }
          .cf-cta::after { content:""; position:absolute; inset:0; background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.35) 50%,transparent 65%); transform:translateX(-120%); transition:transform .6s ease; }
          .cf-cta:hover { transform:translateY(-2px); box-shadow:0 18px 32px -8px rgba(26,110,255,.6), inset 0 1px 0 rgba(255,255,255,.25); }
          .cf-cta:hover::after { transform:translateX(120%); }
          .cf-cta .ar { transition:transform .2s ease; }
          .cf-cta:hover .ar { transform:translateX(4px); }
          .cf-ghost { height:50px; padding:0 18px; border:none; background:transparent; cursor:pointer; color:${C.textSub}; font-family:${F.display}; font-size:14.5px; font-weight:700; border-radius:14px; transition:background .15s ease, color .15s ease; }
          .cf-ghost:hover { background:${C.brand50}; color:${C.brand700}; }
          .cf-cta:focus-visible, .cf-ghost:focus-visible { outline:2.5px solid ${C.brand500}; outline-offset:3px; }
          .cf-trust { display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:14px; font-size:12px; color:${C.textMuted}; }
          .cf-trust span::before { content:"✓"; color:${C.brand500}; font-weight:900; margin-right:6px; }
          .cf-eg { position:relative; padding:16px; border-radius:20px; background:rgba(255,255,255,.85); border:1px solid ${C.border}; box-shadow:0 20px 40px -24px rgba(15,35,95,.35); backdrop-filter:blur(6px); transform:rotate(1.2deg); transition:transform .3s ease; }
          .cf-eg:hover { transform:rotate(0) translateY(-3px); }
          .cf-eg-tag { position:absolute; top:-10px; right:16px; padding:3px 10px; border-radius:99px; background:${C.text}; color:#fff; font-family:${F.mono}; font-size:9.5px; font-weight:800; letter-spacing:.1em; }
          .cf-bubble { padding:11px 13px; border-radius:4px 14px 14px 14px; background:${C.surfaceAlt}; border:1px solid ${C.border}; font-size:13px; line-height:1.6; color:${C.text}; }
          .cf-sec { margin-top:28px; border-radius:24px; padding:clamp(20px,3.6vw,34px); background:#fff; border:1px solid ${C.border}; box-shadow:0 14px 34px -20px rgba(15,35,95,.18); }
          .cf-ben { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr)); gap:10px; margin-bottom:22px; }
          .cf-ben div { display:flex; gap:12px; align-items:center; padding:12px 14px; border-radius:14px; background:${C.surfaceAlt}; border:1px solid ${C.border}; font-size:14px; line-height:1.45; color:${C.text}; transition:border-color .18s ease, transform .18s ease, background .18s ease; }
          .cf-ben div:hover { border-color:${C.brand200}; background:#fff; transform:translateY(-2px); }
          .cf-ben i { flex:none; width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-style:normal; font-size:16px; background:${C.brand50}; border:1px solid ${C.brand100}; }
          @media (max-width:820px) { .cf-grid { grid-template-columns:1fr; } .cf-eg { transform:none; } }
          @media (prefers-reduced-motion:reduce) { .cf-cta,.cf-cta::after,.cf-cta .ar,.cf-eg,.cf-ben div { transition:none !important; } }
        `}</style>

        <section className="cf-hero">
          <div className="cf-grid">
            <div>
              <div className="cf-eyebrow">AI COACH <ProBadge variant="pro" /></div>
              <h1 className="cf-h1">A coach that has read <em>every one of your sessions</em></h1>
              <p className="cf-sub">It tells you what is costing you marks, what to practise this week and how to answer for the company you are targeting.</p>
              <ul className="cf-points">
                <li>🎯 Today&apos;s focus</li><li>📅 7-day plan</li><li>🏢 Company gaps</li><li>💬 Ask anything</li>
              </ul>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 24 }}>
                <button type="button" className="cf-cta" onClick={() => openUpgrade('aiCoach')}>⚡ Unlock the AI Coach <span className="ar" aria-hidden="true">→</span></button>
                <button type="button" className="cf-ghost" onClick={() => navigate('/interview')}>Keep practising free</button>
              </div>
              <div className="cf-trust"><span>One-time payment</span><span>No auto-renewal</span><span>Past sessions unlock instantly</span></div>
            </div>

            <div className="cf-eg" aria-label="Example of a Coach reply">
              <span className="cf-eg-tag">EXAMPLE</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C.brand500}, ${C.accent400})`, fontSize: 13 }}>⚡</span>
                <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: C.text }}>Today&apos;s focus</span>
              </div>
              <div className="cf-bubble">
                Your answers start with the solution and skip the situation, so interviewers lose the story. Open with one line of context, then your action, then the result.
              </div>
              {personal && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: C.brand50, border: `1px solid ${C.brand100}`, fontSize: 12.5, lineHeight: 1.5, color: C.brand700, fontWeight: 700 }}>
                  📌 {personal}
                </div>
              )}
            </div>
          </div>
        </section>

        <div style={{ marginTop: 18 }}>
          <ProLiveDemo feature="aiCoach" name="AI Coach" cta="Unlock my AI Coach" hint="Press Get Today's Plan, pick a company or ask a question to see a reply.">
            {preview}
          </ProLiveDemo>
        </div>

        <section className="cf-sec">
          <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', color: C.brand600 }}>MOCKMATE PRO</div>
          <h2 style={{ margin: '6px 0 16px', fontFamily: F.display, fontSize: 'clamp(21px, 3vw, 27px)', fontWeight: 900, letterSpacing: '-0.5px', color: C.text }}>
            Everything above, built from your own interviews
          </h2>
          <div className="cf-ben">
            {BENEFITS.map((b, i) => (
              <div key={b}><i aria-hidden="true">{['🎯', '📅', '🏢', '🧾', '💬', '🧭'][i] || '✓'}</i><span>{b}</span></div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="cf-cta" onClick={() => openUpgrade('aiCoach')}>⚡ Go Pro and unlock everything <span className="ar" aria-hidden="true">→</span></button>
            <button type="button" className="cf-ghost" onClick={() => navigate('/pricing')}>See plans and pricing</button>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
            Free practice, scores and your last 7 days of progress stay available. Nothing you have done is deleted, and your past sessions unlock the moment you upgrade.
          </p>
        </section>
      </div>
    </div>
  );
}

CoachFree.propTypes = { preview: PropTypes.node };
