import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { getDashboardAnalytics } from '../../Services/interviewService';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from '../pro/ProBadge';
import ProPagePreview from '../pro/ProPagePreview';

/**
 * CoachFree: the AI Coach page for free users.
 * It shows the REAL Pro layout, section by section, with example content blurred behind a
 * lock and only the first line readable. The Coach spends AI quota on every message, so the
 * real Coach stays Pro-only (enforced on the server); nothing here is real Pro output.
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
    <div style={{ minHeight: '100vh', background: C.bg, padding: '24px 20px 72px', fontFamily: F.body }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <section style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, padding: 'clamp(22px, 4vw, 40px)', background: 'linear-gradient(135deg, #0A3FCC 0%, #1A6EFF 60%, #0891B2 130%)', color: '#fff', boxShadow: '0 18px 40px rgba(10,63,204,.28)' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -90, right: -70, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', marginBottom: 12 }}>
              AI COACH <ProBadge variant="pro" style={{ background: 'rgba(255,255,255,.2)', boxShadow: 'none' }} />
            </div>
            <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 'clamp(26px, 4.4vw, 38px)', fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1.12 }}>
              A coach that has read every one of your sessions
            </h1>
            <p style={{ margin: '12px 0 0', maxWidth: 560, fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,.9)' }}>
              It tells you what is costing you marks, what to practise this week and how to answer for the company you are targeting.
            </p>
            {personal && <p style={{ margin: '12px 0 0', fontSize: 14, fontWeight: 800 }}>{personal}</p>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              <button type="button" onClick={() => openUpgrade('aiCoach')} style={{ height: 48, padding: '0 24px', borderRadius: 14, border: 'none', cursor: 'pointer', background: '#fff', color: C.brand700, fontFamily: F.display, fontSize: 14.5, fontWeight: 800 }}>
                Unlock the AI Coach
              </button>
              <button type="button" onClick={() => navigate('/interview')} style={{ height: 48, padding: '0 22px', borderRadius: 14, border: '1px solid rgba(255,255,255,.4)', cursor: 'pointer', background: 'rgba(255,255,255,.12)', color: '#fff', fontFamily: F.display, fontSize: 14.5, fontWeight: 700 }}>
                Keep practising free
              </button>
            </div>
          </div>
        </section>

        <div style={{ marginTop: 18 }}>
          <ProPagePreview feature="aiCoach" name="AI Coach" cta="Unlock my AI Coach" maxHeight={2100} bullets={["Today's focus", '7-day plan', 'Company readiness', 'Coach chat']}>
            {preview}
          </ProPagePreview>
        </div>

        <section style={{ marginTop: 28, borderRadius: 22, padding: 'clamp(20px, 3.6vw, 32px)', background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 14px 34px rgba(15,35,95,.08)' }}>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', color: C.brand600 }}>MOCKMATE PRO</div>
          <h2 style={{ margin: '6px 0 14px', fontFamily: F.display, fontSize: 'clamp(21px, 3vw, 27px)', fontWeight: 900, letterSpacing: '-0.5px', color: C.text }}>
            Everything above, built from your own interviews
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '8px 18px', marginBottom: 20 }}>
            {BENEFITS.map((b) => (
              <div key={b} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 14, color: C.text, lineHeight: 1.5 }}>
                <span style={{ color: C.brand500, fontWeight: 900 }}>✓</span>{b}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openUpgrade('aiCoach')} style={{ height: 50, padding: '0 28px', borderRadius: 14, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', fontFamily: F.display, fontSize: 15, fontWeight: 800, boxShadow: '0 10px 24px rgba(26,110,255,.34)' }}>
              Go Pro and unlock everything
            </button>
            <button type="button" onClick={() => navigate('/pricing')} style={{ height: 50, padding: '0 22px', borderRadius: 14, border: `1px solid ${C.borderMd}`, cursor: 'pointer', background: '#fff', color: C.brand700, fontFamily: F.display, fontSize: 14.5, fontWeight: 700 }}>
              See plans and pricing
            </button>
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
