import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardAnalytics } from '../../Services/interviewService';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import LockedFeatureCard from '../pro/LockedFeatureCard';
import ProBadge from '../pro/ProBadge';

/**
 * CoachFree — the AI Coach page for free users.
 * The Coach spends real AI quota on every message, so it is Pro-only (server-enforced on
 * /ai-coach and /ai-freeform). Free users get a clear page that says what the Coach does,
 * with lines drawn from their own free data, instead of a dead end or a broken chat box.
 */
export default function CoachFree() {
  const navigate = useNavigate();
  const { openUpgrade } = useUpgrade();
  const [weakest, setWeakest] = useState(null);
  const [sessions, setSessions] = useState(null);

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
    })();
    return () => { cancelled = true; };
  }, []);

  const personal = weakest
    ? `From your sessions: ${weakest.topic} is your lowest topic at ${weakest.averageScore}%.`
    : sessions === 0
      ? 'Finish one interview and the Coach has something real to work with.'
      : null;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '24px 20px 64px', fontFamily: F.body }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <section style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, padding: 'clamp(22px, 4vw, 40px)', background: `linear-gradient(135deg, ${C.brand700}, ${C.brand500} 70%, ${C.accent600})`, color: '#fff', boxShadow: '0 16px 44px rgba(0,68,196,.22)' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -90, right: -70, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', opacity: .85, marginBottom: 10 }}>
              AI COACH <ProBadge variant="pro" style={{ background: 'rgba(255,255,255,.2)', boxShadow: 'none' }} />
            </div>
            <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 900, letterSpacing: '-.8px', lineHeight: 1.15, maxWidth: 620 }}>
              A coach that has read every one of your sessions
            </h1>
            <p style={{ margin: '12px 0 0', maxWidth: 560, fontSize: 14.5, lineHeight: 1.65, color: 'rgba(255,255,255,.88)' }}>
              It tells you what is costing you marks, what to practise this week and how to answer for the company you are targeting.
            </p>
            {personal && (
              <p style={{ margin: '12px 0 0', fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{personal}</p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              <button type="button" onClick={() => openUpgrade('aiCoach')} style={{ height: 46, padding: '0 22px', borderRadius: 13, border: 'none', cursor: 'pointer', background: '#fff', color: C.brand700, fontFamily: F.display, fontSize: 14.5, fontWeight: 800 }}>
                Unlock the AI Coach
              </button>
              <button type="button" onClick={() => navigate('/interview')} style={{ height: 46, padding: '0 20px', borderRadius: 13, cursor: 'pointer', background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.28)', fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>
                Keep practising free
              </button>
            </div>
          </div>
        </section>

        <div style={{ margin: '26px 0 12px', fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text }}>What the Coach does for you</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: 12 }}>
          <LockedFeatureCard icon="calendar" title="Today's focus" feature="aiCoach" desc="One clear thing to practise today, chosen from your weakest area." hook={weakest ? `Likely starting point: ${weakest.topic}` : undefined} />
          <LockedFeatureCard icon="route" title="Weekly plan" feature="aiCoach" desc="A realistic 7-day plan built around your actual scores, not a generic list." />
          <LockedFeatureCard icon="chat" title="Ask the Coach anything" feature="aiCoach" desc="Chat about a weak answer, a company round or how to structure a response." />
          <LockedFeatureCard icon="building" title="Company prep" feature="aiCoach" desc="Gap analysis against the companies you are targeting." />
          <LockedFeatureCard icon="report" title="Session debrief" feature="aiCoach" desc="A plain-language review of your latest interview." />
          <LockedFeatureCard icon="radar" title="Weakness radar" feature="fullAnalytics" desc="Your skill dimensions on one chart, with the weakest one called out." />
        </div>

        <p style={{ margin: '22px 4px 0', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          Free practice, scores and your last 7 days of progress stay available. Nothing you have done is deleted.
        </p>
      </div>
    </div>
  );
}
