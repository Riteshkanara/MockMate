import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import Button from '../../components/Button';
import { getAICoach } from '../../Services/interviewService';

const slope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = values.reduce((a, v) => a + v, 0) / n;
  const num = values.reduce((a, v, i) => a + (i - xm) * (v - ym), 0);
  const den = values.reduce((a, _, i) => a + Math.pow(i - xm, 2), 0);
  return den ? num / den : 0;
};

const stdDev = (values) => {
  if (values.length < 2) return 0;
  const m = values.reduce((a, v) => a + v, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + Math.pow(v - m, 2), 0) / (values.length - 1));
};

const scoreColor = (s) => s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.amber : C.orange;

const SECTION_ACCENTS = {
  'VERDICT':               C.cyan400,
  'CRITICAL GAPS':         '#FF6B6B',
  'STRENGTHS TO LEVERAGE': '#4ADE9C',
  '30-DAY BATTLE PLAN':    C.blue400,
  'MINDSET ALERT':         '#F0B94D',
};

const SECTION_ICONS = {
  'VERDICT':               '◎',
  'CRITICAL GAPS':         '▲',
  'STRENGTHS TO LEVERAGE': '✦',
  '30-DAY BATTLE PLAN':    '▤',
  'MINDSET ALERT':         '◐',
};

const dark0 = '#080F1E';

const AICoachDrawer = ({ open, onClose, irs, archetype, topTier, weakest, strongest, scoreTrend }) => {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const scores        = (scoreTrend || []).map(s => s.score || 0);
  const recentSlope   = scores.length >= 2 ? slope(scores.slice(-6)) : 0;
  const scoreVariance = scores.length >= 2 ? stdDev(scores) : 0;

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const runAnalysis = useCallback(async () => {
    setLoading(true); setAnalysis(''); setDone(false);
    try {
      const coach = await getAICoach();
      if (coach?.analysis) {
        const a = coach.analysis;
        setAnalysis([
          'VERDICT', a.verdict, '',
          'CRITICAL GAPS', a.criticalGaps, '',
          'STRENGTHS TO LEVERAGE', a.strengths, '',
          '30-DAY BATTLE PLAN', a.battlePlan, '',
          'MINDSET ALERT', a.mindset,
        ].join('\n'));
      } else {
        setAnalysis('Unable to generate analysis. Try again.');
      }
    } catch (err) {
      setAnalysis(err?.isQuota
        ? 'QUOTA EXHAUSTED\n\nGemini free-tier limit (20 req/day) used up. Open server/.env, set GEMINI_MODEL=gemini-2.5-flash, restart. Resets at midnight Pacific.'
        : 'Could not reach AI coach. Check your connection and try again.'
      );
    } finally {
      setLoading(false); setDone(true);
    }
  }, []);

  useEffect(() => {
    if (!open || done || loading || analysis) return;
    let cancelled = false;
    const trigger = async () => {
      try {
        await runAnalysis();
      } catch (err) {
        if (!cancelled) {
          console.error('[AICoachDrawer trigger] runAnalysis threw unexpectedly:', err);
          setAnalysis('Could not start analysis. Please try again.');
          setDone(true);
        }
      }
    };
    trigger();
    return () => { cancelled = true; };
  }, [open, done, loading, analysis, runAnalysis]);

  const sections = done
    ? analysis
        .split(/\n(?=[A-Z][A-Z ]{3,}\n)/)
        .filter(Boolean)
        .map(s => {
          const lines   = s.trim().split('\n');
          const heading = lines[0].trim();
          const body    = lines.slice(1).join('\n').trim();
          return { heading, body, accent: SECTION_ACCENTS[heading] || C.blue400, icon: SECTION_ICONS[heading] || '•' };
        })
        .filter(s => s.heading && s.body)
    : [];

  const sl = recentSlope;

  const statBar = [
    { label: 'IRS',       val: `${irs}/100`,            color: scoreColor(irs) },
    { label: 'Tier',      val: topTier?.label || '—',   color: C.cyan400 },
    { label: 'Archetype', val: archetype?.label || '—', color: C.blue400 },
    { label: 'Trend',     val: sl >= 0 ? `+${sl.toFixed(1)}/s` : `${sl.toFixed(1)}/s`, color: sl >= 0 ? '#4ADE9C' : '#FF8B6B' },
  ];

  const loadingMsgs = [
    `Scanning IRS = ${irs}/100 across 6 dimensions…`,
    `Computing variance (StdDev: ${scoreVariance.toFixed(1)})…`,
    `Mapping ${strongest?.label || '—'} vs ${weakest?.label || '—'}…`,
    'Drafting 30-day battle plan…',
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(6,14,32,0.55)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.28s ease',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Readiness Coach"
        style={{
          position: 'fixed', top: 0, right: 0,
          width: 'min(540px, 100vw)', height: '100vh',
          zIndex: 10000, overflowY: 'auto',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.32s cubic-bezier(.16,1,.3,1)',
          background: `linear-gradient(160deg, ${dark0} 0%, #001535 60%, ${dark0} 100%)`,
          borderLeft: '1px solid rgba(0,200,240,0.16)',
          boxShadow: '-32px 0 72px rgba(2,8,24,0.55)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <style>{`
          @keyframes drawerSection { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
          @keyframes livePulse2    { 0%,100% { opacity:1; } 50% { opacity:0.28; } }
        `}</style>
        <div style={{ padding: '24px 26px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, position: 'sticky', top: 0, background: dark0, zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: C.cyan400, marginBottom: 7 }}>AI Readiness Coach</div>
              <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Your personalised action plan</h2>
              <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.44)', fontSize: 12, lineHeight: 1.6, maxWidth: 380 }}>
                Built from your IRS components, score variance, and dimension gaps.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 2 }}>
              {done && <Button surface="dark" variant="ghost" size="sm" onClick={runAnalysis} disabled={loading}>Re-analyse</Button>}
              <button onClick={onClose} aria-label="Close AI coach" style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginTop: 18, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
            {statBar.map((item, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: '0.8px', color: 'rgba(255,255,255,0.3)', marginBottom: 4, textTransform: 'lowercase' }}>{item.label}</div>
                <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: item.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '20px 26px 32px', flex: 1 }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingMsgs.map((msg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,200,240,0.1)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan400, flexShrink: 0, animation: `livePulse2 1.4s ease ${i * 0.28}s infinite` }} />
                  <div style={{ color: 'rgba(255,255,255,0.44)', fontSize: 12, fontFamily: F.mono }}>{msg}</div>
                </div>
              ))}
            </div>
          )}
          {done && sections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sections.map((s, i) => (
                <div key={i} style={{ padding: '15px 17px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `2px solid ${s.accent}`, animation: `drawerSection 0.36s ease ${i * 0.07}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: s.accent }}>{s.icon}</span>
                    <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 600, letterSpacing: '1px', color: s.accent, textTransform: 'lowercase' }}>{s.heading}</div>
                  </div>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-line' }}>{s.body}</p>
                </div>
              ))}
              <div style={{ marginTop: 6, padding: '13px 16px', borderRadius: 11, background: 'rgba(26,110,255,0.1)', border: '1px solid rgba(26,110,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>Skill velocity, confidence gaps, and blind spots are on your Analytics page.</div>
                <a href="/analytics" onClick={onClose} style={{ borderRadius: 8, background: `linear-gradient(135deg, ${C.blue500}, ${C.cyan500})`, color: '#fff', padding: '8px 14px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}>Full analytics →</a>
              </div>
            </div>
          )}
          {done && sections.length === 0 && analysis && (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{analysis}</p>
          )}
        </div>
      </div>
    </>
  );
};

AICoachDrawer.propTypes = {
  open:       PropTypes.bool.isRequired,
  onClose:    PropTypes.func.isRequired,
  irs:        PropTypes.number.isRequired,
  archetype:  PropTypes.object,
  topTier:    PropTypes.object,
  weakest:    PropTypes.object,
  strongest:  PropTypes.object,
  scoreTrend: PropTypes.array.isRequired,
};

export default AICoachDrawer;