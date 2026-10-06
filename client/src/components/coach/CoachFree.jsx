import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardAnalytics } from '../../Services/interviewService';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from '../pro/ProBadge';
import ProTease from '../pro/ProTease';
import { WeaknessRadar } from './WeaknessRadar';
import { SAMPLE_ANALYTICS, SAMPLE_COACH, SAMPLE_TREND } from '../pro/previewData';

/**
 * CoachFree: the AI Coach page for free users.
 * It shows the REAL Pro layout, section by section, with example content blurred behind a
 * lock and only the first line readable. The Coach spends AI quota on every message, so the
 * real Coach stays Pro-only (enforced on the server); nothing here is real Pro output.
 */
const noop = () => {};
const p = { margin: '0 0 8px' };

function Sparkline() {
  const pts = SAMPLE_TREND.map((s, i) => [20 + i * 64, 120 - s.score * 1.1]);
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0]},${q[1]}`).join(' ');
  return (
    <svg viewBox="0 0 660 140" width="100%" height="140" role="presentation">
      <path d={`${d} L${pts[pts.length - 1][0]},140 L20,140 Z`} fill="rgba(26,110,255,.10)" />
      <path d={d} fill="none" stroke={C.brand500} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r="6" fill="#fff" stroke={C.brand500} strokeWidth="3" />)}
    </svg>
  );
}

function Bar({ label, pct, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: C.text }}>
        <span>{label}</span><span>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: C.border, marginTop: 5 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color }} />
      </div>
    </div>
  );
}

const Divider = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '26px 2px 12px' }}>
    <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: C.brand600 }}>{label}</span>
    <span style={{ flex: 1, height: 1, background: C.border }} />
  </div>
);

const BENEFITS = [
  'Today\'s focus, chosen from your weakest area',
  'A 7-day plan built from your real scores',
  'Company-by-company readiness gaps',
  'A plain-language debrief after every session',
  'Chat about any weak answer, any time',
  'Full analytics, blind spots and salary-tier roadmap',
];

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

  const todayLead = weakest
    ? `Today: work on ${weakest.topic}, your lowest topic at ${weakest.averageScore}%.`
    : SAMPLE_COACH.today[0];

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

        <p style={{ margin: '14px 4px 0', fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
          Below is the real Coach. The blurred content is an example, so you can see what you get. Your own version is built from your sessions.
        </p>

        <Divider label="TODAY'S FOCUS AND WEEKLY PLAN" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 14 }}>
          <ProTease feature="aiCoach" tone="dark" eyebrow="Today's focus" title="One thing to practise today" lead={todayLead} cta="Unlock today's focus" hint="Chosen from your weakest area" blurHeight={170}>
            {SAMPLE_COACH.today.slice(1).map((t) => <p key={t} style={p}>{t}</p>)}
          </ProTease>
          <ProTease feature="aiCoach" eyebrow="Weekly plan" title="Your next 7 days" lead={`${SAMPLE_COACH.week[0][0]}: ${SAMPLE_COACH.week[0][1]}`} cta="Unlock the weekly plan" hint="Built around your real scores" blurHeight={170}>
            {SAMPLE_COACH.week.slice(1).map(([d, t]) => <p key={d} style={p}><strong>{d}:</strong> {t}</p>)}
          </ProTease>
        </div>

        <Divider label="YOUR TRAJECTORY" />
        <ProTease feature="aiCoach" eyebrow="Progress" title="How your last 10 sessions moved" lead="Your scores from every session, plotted against your own average." cta="Unlock your trajectory" blurHeight={150}>
          <Sparkline />
        </ProTease>

        <Divider label="DIMENSION BREAKDOWN" />
        <ProTease feature="fullAnalytics" showBadge eyebrow="Dimension health" title="All 6 dimensions, weakest first" lead="See exactly which skill is holding your score back." cta="Unlock the full breakdown" blurHeight={250} tag="EXAMPLE">
          <WeaknessRadar analyticsData={SAMPLE_ANALYTICS} navigate={noop} />
        </ProTease>

        <Divider label="COMPANY TARGETING" />
        <ProTease feature="aiCoach" eyebrow="Company readiness" title="How ready you are for each company" lead="Pick a company and the Coach shows the gaps to close before that round." cta="Unlock company prep" blurHeight={170}>
          {SAMPLE_COACH.companies.map(([n, v]) => <Bar key={n} label={n} pct={v} color={C.brand500} />)}
        </ProTease>

        <Divider label="SESSION REVIEW" />
        <ProTease feature="aiCoach" eyebrow="Session debrief" title="A plain-language review of your latest session" lead={SAMPLE_COACH.debrief[0]} cta="Unlock session debriefs" blurHeight={150}>
          {SAMPLE_COACH.debrief.slice(1).map((t) => <p key={t} style={p}>{t}</p>)}
        </ProTease>

        <Divider label="ASK THE COACH" />
        <ProTease feature="aiCoach" eyebrow="Coach chat" title="Ask about any weak answer" lead="Ask anything: why a score was low, how to structure an answer, what to practise next." cta="Unlock Coach chat" blurHeight={170}>
          {SAMPLE_COACH.chat.map(([who, t]) => (
            <div key={t} style={{ display: 'flex', justifyContent: who === 'you' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{ maxWidth: '82%', padding: '9px 13px', borderRadius: 14, background: who === 'you' ? C.brand500 : C.surfaceAlt, color: who === 'you' ? '#fff' : C.text, fontSize: 13.5 }}>{t}</div>
            </div>
          ))}
        </ProTease>

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
