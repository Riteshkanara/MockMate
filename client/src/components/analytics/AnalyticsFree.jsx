import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { getDashboardAnalytics } from '../../Services/interviewService';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from '../pro/ProBadge';
import ProLiveDemo from '../pro/ProLiveDemo';

/**
 * AnalyticsFree — the Analytics page for free users.
 *
 * Shows real, useful numbers (last 7 days, headline readiness score, weakest 3 topics)
 * so the page feels like a product, then shows the Pro depth as clearly-labelled locked
 * cards. Pro users never see this component: they get the full Analytics page.
 *
 * Note: /interview/analytics returns one shared payload (the Dashboard needs all of it),
 * so this view chooses what to SHOW. Depth-locking here is a UX lock; the AI Coach,
 * blind-spot and warmup endpoints are server-enforced separately.
 */

const WINDOW_DAYS = 7;
const DAY_MS = 86400000;

const scoreColor = (s) => (s >= 80 ? C.success : s >= 60 ? C.brand500 : s >= 40 ? C.warning : C.danger);

const Card = ({ children, style }) => (
  <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 2px rgba(15,23,42,.04)', ...style }}>{children}</section>
);

const Eyebrow = ({ children, color = C.brand600 }) => (
  <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color, marginBottom: 6, textTransform: 'uppercase' }}>{children}</div>
);

// ── 7-day trend: plain SVG so it has zero chart-library surprises ─────────────
function TrendChart({ points }) {
  const W = 600, H = 170, PX = 28, PY = 18;
  if (points.length === 0) return null;
  const xs = (i) => (points.length === 1 ? W / 2 : PX + (i * (W - PX * 2)) / (points.length - 1));
  const ys = (v) => PY + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - PY * 2);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(p.score).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${line} L${xs(points.length - 1).toFixed(1)},${H - PY} L${xs(0).toFixed(1)},${H - PY} Z` : '';
  const label = `Score trend over your last ${points.length} session${points.length > 1 ? 's' : ''}: ${points.map((p) => p.score).join(', ')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="anfArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.brand500} stopOpacity=".22" /><stop offset="100%" stopColor={C.brand500} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={PX} x2={W - PX} y1={ys(g)} y2={ys(g)} stroke={C.border} strokeDasharray="3 5" />
          <text x={4} y={ys(g) + 3} fontSize="9" fill={C.textMuted} fontFamily={F.mono}>{g}</text>
        </g>
      ))}
      {area && <path d={area} fill="url(#anfArea)" />}
      {points.length > 1 && <path d={line} fill="none" stroke={C.brand500} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((p, i) => (
        <circle key={i} cx={xs(i)} cy={ys(p.score)} r="4.5" fill="#fff" stroke={scoreColor(p.score)} strokeWidth="2.5" />
      ))}
    </svg>
  );
}

export default function AnalyticsFree({ initialData = null, preview = null }) {
  const navigate = useNavigate();
  const { openUpgrade } = useUpgrade();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getDashboardAnalytics()); }
    catch { setError('We could not load your progress right now.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!initialData) load(); }, [initialData, load]);

  const view = useMemo(() => {
    const trend = Array.isArray(data?.scoreTrend) ? data.scoreTrend : [];
    const cutoff = Date.now() - WINDOW_DAYS * DAY_MS;
    const recent = trend.filter((d) => new Date(d.date).getTime() >= cutoff && Number.isFinite(Number(d.score)))
      .map((d) => ({ score: Math.round(Number(d.score)), date: d.date }));
    const topics = [...(data?.topicPerformance || [])].sort((a, b) => a.averageScore - b.averageScore);
    const tiers = Array.isArray(data?.tiers) ? data.tiers : [];
    const tierLabel = data?.currentTier || null;
    const next = tiers.find((t) => !t.isUnlocked && t.label !== tierLabel) || null;
    const irs = Math.round(Number(data?.irs) || 0);
    const t = data?.timePerformance || {};
    return {
      total: Number(data?.totalSessions ?? data?.totalInterviews) || 0,
      avg: Math.round(Number(data?.averageScore) || 0),
      best: Math.round(Number(data?.highestScore ?? data?.bestScore) || 0),
      avgTime: t.averageTimePerQuestion ?? t.avgTimePerQuestion ?? 0,
      recent, hidden: Math.max(0, trend.length - recent.length),
      topics, shown: topics.slice(0, 3), extraTopics: Math.max(0, topics.length - 3),
      irs, tierLabel, next, pointsToNext: next ? Math.max(0, Number(next.minIRS) - irs) : 0,
      weakest: topics[0] || null,
    };
  }, [data]);

  const page = { minHeight: '100vh', background: C.bg, padding: '24px 20px 64px', fontFamily: F.body };
  const wrap = { maxWidth: 1080, margin: '0 auto' };

  if (loading) {
    return (
      <div style={page}><div style={wrap} role="status" aria-label="Loading your progress">
        {[90, 110, 220].map((h, i) => (
          <div key={i} style={{ height: h, borderRadius: 18, marginBottom: 14, background: `linear-gradient(90deg, ${C.border}, ${C.surfaceAlt}, ${C.border})`, opacity: 0.8 }} />
        ))}
      </div></div>
    );
  }

  if (error || !data) {
    return (
      <div style={page}><div style={{ ...wrap, maxWidth: 520 }}>
        <Card style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 6 }}>Couldn&apos;t load your progress</div>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>{error || 'Something went wrong.'} Your data is safe.</div>
          <button type="button" onClick={load} style={{ height: 40, padding: '0 20px', borderRadius: 11, border: 'none', cursor: 'pointer', background: C.brand500, color: '#fff', fontFamily: F.display, fontSize: 13.5, fontWeight: 700 }}>Try again</button>
        </Card>
      </div></div>
    );
  }

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
      <div>
        <Eyebrow>Your progress</Eyebrow>
        <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 'clamp(22px, 3.4vw, 30px)', fontWeight: 900, letterSpacing: '-.6px', color: C.text }}>How your practice is going</h1>
        <p style={{ margin: '8px 0 0', maxWidth: 560, fontSize: 13.5, lineHeight: 1.6, color: C.textSub }}>
          Your last {WINDOW_DAYS} days at a glance. Pro adds the full breakdown of what is holding your score back.
        </p>
      </div>
      <button type="button" onClick={() => navigate('/interview')} style={{ height: 42, padding: '0 20px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', fontFamily: F.display, fontSize: 14, fontWeight: 700, boxShadow: '0 6px 18px rgba(26,110,255,.26)' }}>
        New interview
      </button>
    </div>
  );

  if (view.total === 0) {
    return (
      <div style={page}><div style={wrap}>
        {header}
        <Card style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 34, marginBottom: 8 }} aria-hidden="true">🎯</div>
          <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 6 }}>Your progress starts with one interview</div>
          <div style={{ fontSize: 13.5, color: C.textSub, maxWidth: 420, margin: '0 auto 18px', lineHeight: 1.6 }}>Finish a session and your score, trend and weakest topics show up here.</div>
          <button type="button" onClick={() => navigate('/interview')} style={{ height: 42, padding: '0 22px', borderRadius: 12, border: 'none', cursor: 'pointer', background: C.brand500, color: '#fff', fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>Start an interview</button>
        </Card>
      </div></div>
    );
  }

  const R = 44, CIRC = 2 * Math.PI * R;
  return (
    <div style={page}>
      <div style={wrap}>
        <section aria-label="Free versus Pro Analytics" style={{ margin: '0 0 18px' }}>
          <style>{`
            .pa-wrap { display:grid; grid-template-columns:minmax(0,.9fr) minmax(0,1.6fr); gap:clamp(18px,3vw,34px); align-items:start; padding:clamp(18px,3vw,30px); border-radius:24px; background:#fff; border:1px solid ${C.border}; box-shadow:0 16px 40px -24px rgba(26,110,255,.28);
              background-image:radial-gradient(60% 70% at 0% 0%, rgba(26,110,255,.07) 0%, transparent 60%); }
            .pa-h { margin:0; font-family:${F.display}; font-size:clamp(22px,2.8vw,30px); font-weight:900; letter-spacing:-.6px; line-height:1.15; color:${C.text}; }
            .pa-h em { font-style:normal; background:linear-gradient(100deg,${C.brand500},${C.accent400}); -webkit-background-clip:text; background-clip:text; color:transparent; }
            .pa-p { margin:12px 0 0; font-size:14px; line-height:1.7; color:${C.textSub}; }
            .pa-cta { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:9px; height:48px; padding:0 24px; border:none; border-radius:14px; cursor:pointer; background:linear-gradient(135deg,${C.brand500},${C.brand600}); color:#fff; font-family:${F.display}; font-size:14.5px; font-weight:800; box-shadow:0 12px 26px -8px rgba(26,110,255,.55), inset 0 1px 0 rgba(255,255,255,.25); transition:transform .18s ease, box-shadow .18s ease; }
            .pa-cta::after { content:""; position:absolute; inset:0; background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.35) 50%,transparent 65%); transform:translateX(-120%); transition:transform .6s ease; }
            .pa-cta:hover { transform:translateY(-2px); box-shadow:0 18px 32px -8px rgba(26,110,255,.6), inset 0 1px 0 rgba(255,255,255,.25); }
            .pa-cta:hover::after { transform:translateX(120%); }
            .pa-cta .ar { transition:transform .2s ease; } .pa-cta:hover .ar { transform:translateX(4px); }
            .pa-link { height:48px; padding:0 14px; border:none; background:transparent; cursor:pointer; border-radius:12px; color:${C.textSub}; font-family:${F.display}; font-size:13.5px; font-weight:700; transition:background .15s ease, color .15s ease; }
            .pa-link:hover { background:${C.brand50}; color:${C.brand700}; }
            .pa-cta:focus-visible,.pa-link:focus-visible { outline:2.5px solid ${C.brand500}; outline-offset:3px; }
            .pa-table { border:1px solid ${C.border}; border-radius:18px; overflow:hidden; background:${C.surfaceAlt}; }
            .pa-row { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,.8fr) minmax(0,1fr); gap:14px; align-items:center; padding:14px 16px; background:#fff; transition:background .18s ease; }
            .pa-row + .pa-row { border-top:1px solid ${C.border}; }
            .pa-row:not(.pa-head):hover { background:${C.brand50}; }
            .pa-head { padding:10px 16px; background:${C.surfaceAlt}; font-family:${F.mono}; font-size:10px; font-weight:800; letter-spacing:.12em; color:${C.textMuted}; }
            .pa-feat { display:flex; gap:12px; align-items:center; min-width:0; }
            .pa-ic { flex:none; width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:18px; background:${C.brand50}; border:1px solid ${C.brand100}; }
            .pa-free { font-size:12.5px; color:${C.textMuted}; display:flex; gap:6px; align-items:center; }
            .pa-free::before { content:"–"; color:${C.textFaint}; font-weight:800; }
            .pa-pro { font-size:12.5px; font-weight:700; color:${C.brand700}; display:flex; gap:7px; align-items:center; }
            .pa-pro::before { content:"✓"; flex:none; width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:${C.brand500}; color:#fff; font-size:10px; font-weight:900; }
            @media (max-width:860px) { .pa-wrap { grid-template-columns:1fr; } }
            @media (max-width:560px) { .pa-row { grid-template-columns:1fr; gap:8px; } .pa-head { display:none; } }
            @media (prefers-reduced-motion:reduce) { .pa-cta,.pa-cta::after,.pa-cta .ar,.pa-row { transition:none !important; } }
          `}</style>

          <div className="pa-wrap">
            <div>
              <Eyebrow>Free vs Pro</Eyebrow>
              <h1 className="pa-h">Free shows your score. <em>Pro shows why it is stuck.</em></h1>
              <p className="pa-p">Your free page tells you where you stand. Pro opens up what is holding the number back, and what to do about it before your next interview.</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 22 }}>
                <button type="button" className="pa-cta" onClick={() => openUpgrade('fullAnalytics')}>⚡ Unlock Pro Analytics <span className="ar" aria-hidden="true">→</span></button>
                <button type="button" className="pa-link" onClick={() => navigate('/pricing')}>Compare plans</button>
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
                One-time payment · No auto-renewal<br />Your past sessions unlock instantly
              </div>
            </div>

            <div className="pa-table" role="table" aria-label="What each plan includes">
              <div className="pa-row pa-head" role="row"><span role="columnheader">WHAT YOU GET</span><span role="columnheader">FREE</span><span role="columnheader">PRO</span></div>
              {[
                { ic: '🧩', t: 'Full IRS breakdown', d: 'Six dimensions, each with its own trend', free: 'One overall number', pro: 'Where every point comes from' },
                { ic: '🎯', t: 'Blind spots', d: 'Habits that quietly cost you marks', free: 'Your last 7 days', pro: 'Patterns across every session' },
                { ic: '🛡️', t: 'AI War Room', d: 'Rehearse a company\u2019s toughest follow-ups', free: 'Not included', pro: 'Company-specific drills' },
                { ic: '🪜', t: 'Salary-tier roadmap', d: 'The exact gap to your next ₹LPA tier', free: 'Pass or fail', pro: 'Tier, gap and next steps' },
              ].map((r) => (
                <div className="pa-row" role="row" key={r.t}>
                  <div className="pa-feat" role="cell">
                    <span className="pa-ic" aria-hidden="true">{r.ic}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text }}>{r.t}</div>
                      <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.45, marginTop: 1 }}>{r.d}</div>
                    </div>
                  </div>
                  <div className="pa-free" role="cell">{r.free}</div>
                  <div className="pa-pro" role="cell">{r.pro}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div style={{ marginTop: 14 }}>
          <ProLiveDemo feature="fullAnalytics" name="Analytics" showBar={false} cta="Unlock my Analytics" hint="Explore freely. AI responses (like the War Room) are examples.">
            {preview}
          </ProLiveDemo>
        </div>

        <div style={{ margin: '30px 0 12px' }}>
          <Eyebrow>Your free snapshot</Eyebrow>
          <div style={{ fontFamily: F.display, fontSize: 'clamp(18px, 2.4vw, 22px)', fontWeight: 900, color: C.text, letterSpacing: '-0.3px' }}>
            Your real progress, from your own sessions
          </div>
        </div>

        {/* readiness headline: show the number, sell the "how" */}
        <Card style={{ marginBottom: 14, background: `linear-gradient(135deg, ${C.brand50}, #fff 70%)`, borderColor: C.brand100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
              <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
                <circle cx="52" cy="52" r={R} fill="none" stroke={C.border} strokeWidth="8" />
                <circle cx="52" cy="52" r={R} fill="none" stroke={scoreColor(view.irs)} strokeWidth="8" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - Math.min(100, view.irs) / 100)} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: F.display, fontSize: 30, fontWeight: 900, color: C.text, lineHeight: 1 }}>{view.irs}</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.textMuted, marginTop: 2 }}>READINESS</span>
              </div>
            </div>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <Eyebrow>Interview readiness score</Eyebrow>
              <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                {view.tierLabel ? <>You&apos;re in the {view.tierLabel} range</> : <>Your readiness so far</>}
              </div>
              <div style={{ fontSize: 13.5, color: C.textSub, lineHeight: 1.55 }}>
                {view.next
                  ? (view.pointsToNext > 0
                      ? <><b style={{ color: C.text }}>{view.pointsToNext} point{view.pointsToNext === 1 ? '' : 's'}</b> away from {view.next.label}. </>
                      : <>Keep practising to unlock {view.next.label}. </>)
                  : <>You&apos;re at the top tier. </>}
                Pro shows exactly which skills are holding you back.
              </div>
            </div>
            <button type="button" onClick={() => openUpgrade('fullAnalytics')} style={{ height: 42, padding: '0 18px', borderRadius: 12, border: `1px solid ${C.brand100}`, cursor: 'pointer', background: '#fff', color: C.brand600, fontFamily: F.display, fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              See the breakdown <ProBadge variant="pro" />
            </button>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div>
                <Eyebrow>Score trend</Eyebrow>
                <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text }}>Last {WINDOW_DAYS} days</div>
              </div>
              {view.hidden > 0 && (
                <button type="button" onClick={() => openUpgrade('fullAnalytics')} style={{ border: `1px solid ${C.border}`, background: C.surfaceAlt, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: C.textSub, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {view.hidden} older session{view.hidden === 1 ? '' : 's'} <ProBadge variant="lock" />
                </button>
              )}
            </div>
            {view.recent.length > 0 ? (
              <>
                <TrendChart points={view.recent} />
                {view.recent.length === 1 && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>Complete one more session to see a trend line.</div>}
              </>
            ) : (
              <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>
                No sessions in the last {WINDOW_DAYS} days.
                <div><button type="button" onClick={() => navigate('/interview')} style={{ marginTop: 10, height: 36, padding: '0 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: C.brand500, color: '#fff', fontWeight: 700, fontSize: 13 }}>Practice now</button></div>
              </div>
            )}
          </Card>

          <Card>
            <Eyebrow>Topics to work on</Eyebrow>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 12 }}>Your 3 weakest topics</div>
            {view.shown.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textSub, padding: '20px 0' }}>Answer a few questions and your topics appear here.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {view.shown.map((t) => (
                  <div key={t.topic}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, color: C.text }}>{t.topic}</span>
                      <span style={{ fontFamily: F.mono, fontWeight: 700, color: scoreColor(t.averageScore) }}>{t.averageScore}%</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(2, Math.min(100, t.averageScore))}%`, background: scoreColor(t.averageScore), borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {view.extraTopics > 0 && (
              <button type="button" onClick={() => openUpgrade('fullAnalytics')} style={{ marginTop: 14, width: '100%', height: 38, borderRadius: 10, border: `1px dashed ${C.brand100}`, background: C.brand50, cursor: 'pointer', color: C.brand600, fontFamily: F.body, fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                +{view.extraTopics} more topic{view.extraTopics === 1 ? '' : 's'} in the full grid <ProBadge variant="pro" />
              </button>
            )}
          </Card>
        </div>

        <section style={{ marginTop: 22, borderRadius: 22, padding: 'clamp(20px, 3.6vw, 30px)', background: 'linear-gradient(135deg, #0A3FCC 0%, #1A6EFF 60%, #0891B2 130%)', color: '#fff', boxShadow: '0 16px 36px rgba(10,63,204,.26)' }}>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', opacity: 0.8 }}>MOCKMATE PRO</div>
          <h2 style={{ margin: '6px 0 8px', fontFamily: F.display, fontSize: 'clamp(21px, 3vw, 27px)', fontWeight: 900, letterSpacing: '-0.5px' }}>See exactly what stands between you and the offer</h2>
          <p style={{ margin: '0 0 18px', maxWidth: 560, fontSize: 14.5, lineHeight: 1.65, color: 'rgba(255,255,255,.9)' }}>
            Skill DNA, blind spots, your salary-tier roadmap and your complete history, all built from your own sessions.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openUpgrade('fullAnalytics')} style={{ height: 50, padding: '0 26px', borderRadius: 14, border: 'none', cursor: 'pointer', background: '#fff', color: C.brand700, fontFamily: F.display, fontSize: 15, fontWeight: 800 }}>
              Go Pro and unlock everything
            </button>
            <button type="button" onClick={() => navigate('/pricing')} style={{ height: 50, padding: '0 22px', borderRadius: 14, border: '1px solid rgba(255,255,255,.4)', cursor: 'pointer', background: 'rgba(255,255,255,.12)', color: '#fff', fontFamily: F.display, fontSize: 14.5, fontWeight: 700 }}>
              See plans and pricing
            </button>
          </div>
        </section>

        <p style={{ margin: '22px 4px 0', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          Nothing is ever deleted on the Free plan. Every session and score stays saved, and it all appears the moment you upgrade.
        </p>
      </div>
    </div>
  );
}

AnalyticsFree.propTypes = { initialData: PropTypes.object, preview: PropTypes.node };
