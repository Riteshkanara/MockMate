import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { getDashboardAnalytics } from '../../Services/interviewService';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from '../pro/ProBadge';
import ProTease from '../pro/ProTease';
import DNAFingerprint from './DNAFingerprint';
import StreakCalendar from './StreakCalendar';
import { SAMPLE_ANALYTICS_CARDS, SAMPLE_DNA, SAMPLE_TREND } from '../pro/previewData';

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

const fmtTime = (sec) => {
  const s = Math.round(Number(sec) || 0);
  if (s <= 0) return '—';
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

const Card = ({ children, style }) => (
  <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 2px rgba(15,23,42,.04)', ...style }}>{children}</section>
);

const Eyebrow = ({ children, color = C.brand600 }) => (
  <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color, marginBottom: 6, textTransform: 'uppercase' }}>{children}</div>
);

const Stat = ({ label, value, sub }) => (
  <Card style={{ padding: '14px 16px' }}>
    <Eyebrow color={C.textMuted}>{label}</Eyebrow>
    <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '-.5px', lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
  </Card>
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

export default function AnalyticsFree({ initialData = null }) {
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
        {header}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 14 }}>
          <Stat label="Interviews" value={view.total} sub="all time" />
          <Stat label="Average score" value={`${view.avg}`} sub="out of 100" />
          <Stat label="Best score" value={`${view.best}`} sub="your personal best" />
          <Stat label="Avg time / question" value={fmtTime(view.avgTime)} />
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

        <div style={{ margin: '26px 0 6px' }}>
          <Eyebrow>Unlock with Pro</Eyebrow>
          <div style={{ fontFamily: F.display, fontSize: 'clamp(18px, 2.4vw, 22px)', fontWeight: 900, color: C.text, letterSpacing: '-0.3px' }}>
            The parts of your analytics that show you how to improve
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.textMuted }}>
            This is the full Pro analytics. The blurred content is an example; yours is built from your own sessions.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 14, marginTop: 12 }}>
          <ProTease feature="fullAnalytics" eyebrow="Performance DNA" title="Your six skill dimensions" lead="A fingerprint of your score across all six skills, so you know what to fix first." cta="Unlock Skill DNA" blurHeight={230}>
            <DNAFingerprint profile={SAMPLE_DNA} />
          </ProTease>
          <ProTease
            feature="fullAnalytics" eyebrow="Salary-tier roadmap" title="What is blocking your next tier"
            lead={view.next ? `Next up for you: ${view.next.label}.` : 'See the one skill standing between you and your next salary tier.'}
            cta="Unlock your roadmap" blurHeight={230}
          >
            <p style={{ margin: '0 0 8px' }}>You are currently at <strong>{SAMPLE_ANALYTICS_CARDS.roadmap.now}</strong>. The next tier is <strong>{SAMPLE_ANALYTICS_CARDS.roadmap.next}</strong>.</p>
            <p style={{ margin: '0 0 8px' }}>Blocker: <strong>{SAMPLE_ANALYTICS_CARDS.roadmap.blocker}</strong>, {SAMPLE_ANALYTICS_CARDS.roadmap.gap} points short.</p>
            <p style={{ margin: 0 }}>About {SAMPLE_ANALYTICS_CARDS.roadmap.sessions} focused sessions closes the gap.</p>
          </ProTease>
          <ProTease
            feature="blindSpots" eyebrow="Blind spot detection" title="Topics that keep costing you points"
            lead={view.weakest ? `Your lowest topic right now: ${view.weakest.topic} (${view.weakest.averageScore}%).` : 'Topics that keep costing you points across your last 10 sessions.'}
            cta="Unlock blind spots" blurHeight={200}
          >
            {SAMPLE_ANALYTICS_CARDS.blindSpots.map(([n, times, avg]) => (
              <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13.5 }}>
                <span>{n}</span><span>missed {times} times, avg {avg}%</span>
              </div>
            ))}
          </ProTease>
          <ProTease feature="sessionWarmup" eyebrow="Warmup analysis" title="Do you start slow?" lead="See whether your first question costs you marks, and which positions hurt most." cta="Unlock warmup analysis" blurHeight={200}>
            <p style={{ margin: '0 0 8px' }}>Question 1 averages 12 points below your later questions.</p>
            <p style={{ margin: '0 0 8px' }}>Your strongest position is question 4, at 74.</p>
            <p style={{ margin: 0 }}>A 2-minute warmup before you start closes most of that gap.</p>
          </ProTease>
        </div>

        <div style={{ marginTop: 14 }}>
          <ProTease feature="fullAnalytics" eyebrow="Topic intelligence" title="Every topic, with its trend" lead={view.extraTopics > 0 ? `You have ${view.topics.length} topics. Free shows your 3 weakest.` : 'Every topic you have practised, ranked, with its trend.'} cta="Unlock the full topic grid" blurHeight={200}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {SAMPLE_ANALYTICS_CARDS.topics.map(([n, s, tr]) => (
                <div key={n} style={{ padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.surfaceAlt }}>
                  <div style={{ fontWeight: 800, color: C.text }}>{n}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(s) }}>{s}%</div>
                  <div style={{ fontSize: 11.5 }}>{tr === 'up' ? 'Improving' : tr === 'down' ? 'Slipping' : 'Steady'}</div>
                </div>
              ))}
            </div>
          </ProTease>
        </div>

        <div style={{ marginTop: 14 }}>
          <ProTease feature="fullAnalytics" eyebrow="Activity" title="Your practice streak calendar" lead={view.hidden > 0 ? `${view.hidden} older session${view.hidden === 1 ? ' is' : 's are'} waiting in your full history.` : 'Every session you have done, day by day.'} cta="Unlock full history" blurHeight={190}>
            <StreakCalendar scoreTrend={SAMPLE_TREND} />
          </ProTease>
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

AnalyticsFree.propTypes = { initialData: PropTypes.object };
