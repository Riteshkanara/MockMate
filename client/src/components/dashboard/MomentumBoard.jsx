import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import Button from '../../components/Button';


const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v || 0)));
const ewma  = (values, alpha = 0.35) => !values.length ? 0 : values.reduce((acc, v, i) => i === 0 ? v : alpha * v + (1 - alpha) * acc, values[0]);
const slope = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = values.reduce((a, v) => a + v, 0) / n;
  const num = values.reduce((a, v, i) => a + (i - xm) * (v - ym), 0);
  const den = values.reduce((a, _, i) => a + Math.pow(i - xm, 2), 0);
  return den ? num / den : 0;
};

const daysSinceLast = (scoreTrend) => {
  const last = scoreTrend.at(-1)?.date;
  if (!last) return null;
  return Math.floor((new Date() - new Date(last)) / 86400000);
};

const scoreColor = (s) => {
  if (s >= 80) return C.green;
  if (s >= 60) return C.blue500;
  if (s >= 40) return C.amber;
  return C.orange;
};

const tierRungProgress = (irs, prevMinIRS, minIRS) => {
  const range = minIRS - (prevMinIRS ?? 0);
  if (range <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((irs - (prevMinIRS ?? 0)) / range) * 100)));
};

// ─── Styles ─────────────────────────────────────────────────
const S_MB = {
  eyebrow:         { fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px', color: C.blue500, marginBottom: 7, textTransform: 'lowercase' },
  cardH2:          { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' },
  cardSub:         { margin: '7px 0 0', fontSize: 12.5, lineHeight: 1.65, color: C.sub, maxWidth: 440 },
  momentumGrid:    { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  momentumCard:    { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 11 },
  momentumBadge:   { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, width: 'fit-content', fontFamily: F.mono },
  momentumTopic:   { fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.2 },
  momentumMeta:    { fontSize: 12, color: C.sub, marginTop: 3, lineHeight: 1.5 },
  momentumBar:     { height: 4, borderRadius: 999, background: C.border, overflow: 'hidden' },
  momentumBarFill: { height: '100%', borderRadius: 999, transition: 'width 0.9s cubic-bezier(.16,1,.3,1)' },
  momentumHint:    { fontSize: 12, color: C.sub, lineHeight: 1.6 },
};

// ─── PropTypes ──────────────────────────────────────────────
MomentumBoard.propTypes = {
  irs:             PropTypes.number.isRequired,
  fixTarget:       PropTypes.object,
  weakestDim:      PropTypes.object,
  irsGap:          PropTypes.number.isRequired,
  activeTierFloor: PropTypes.number.isRequired,
  nextTier:        PropTypes.object,
  scoreTrend:      PropTypes.array.isRequired,
  streakDays:      PropTypes.number.isRequired,
  archetype:       PropTypes.object,
  onDrill:         PropTypes.func.isRequired,
  onOpenAnalytics: PropTypes.func.isRequired,
  starting:        PropTypes.bool.isRequired,
};

// ─── Component ──────────────────────────────────────────────
function MomentumBoard({ irs, fixTarget, weakestDim, irsGap, activeTierFloor, nextTier, scoreTrend, streakDays, archetype, onDrill, onOpenAnalytics, starting }) {
  const daysSince   = daysSinceLast(scoreTrend);
  const scores      = useMemo(() => scoreTrend.map(s => s.score || 0), [scoreTrend]);
  const recentSlope = slope(scores.slice(-6));

  const predicted = useMemo(() => {
    if (scores.length < 2) return null;
    const recent = scores.slice(-8);
    return clamp(ewma(recent) + slope(recent) * 0.6);
  }, [scores]);

  const drillTopic = fixTarget?.topic || weakestDim?.label;
  const drillScore = fixTarget?.averageScore ?? weakestDim?.score ?? 0;
  const drillGap   = 100 - drillScore;
  const drillRoi   = fixTarget?.roi ?? null;
  const tierPct    = nextTier ? tierRungProgress(irs, activeTierFloor, nextTier.minScore) : 100;

  const streakAtRisk  = streakDays >= 3 && daysSince >= 2;
  const streakHealthy = streakDays >= 3 && (daysSince === null || daysSince < 2);
  const isTrending    = recentSlope > 1.5;

  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={S_MB.eyebrow}>momentum board</div>
        <h2 style={{ ...S_MB.cardH2, marginBottom: 4 }}>Three things to act on right now</h2>
        <p style={S_MB.cardSub}>Each card is a decision, not a stat. One click starts the session.</p>
      </div>

      <div style={S_MB.momentumGrid} className="mm-momentum-grid">

        {/* Card 1: Highest ROI Fix */}
        <div style={{ ...S_MB.momentumCard, borderColor: drillTopic ? `${C.orange}44` : C.border, background: drillTopic ? `${C.orange}08` : C.card }}>
          <div style={{ ...S_MB.momentumBadge, color: C.orange, background: `${C.orange}18` }}>
            <span>↯</span> highest ROI fix
          </div>
          <div>
            <div style={S_MB.momentumTopic}>{drillTopic || 'No weak topic yet'}</div>
            <div style={S_MB.momentumMeta}>
              Score {drillScore} · {drillGap} pts to max
              {drillRoi != null ? ` · ROI ${Math.round(drillRoi * 10) / 10}` : ''}
            </div>
          </div>
          <div style={S_MB.momentumBar}>
            <div style={{ ...S_MB.momentumBarFill, width: `${drillScore}%`, background: scoreColor(drillScore) }} />
          </div>
          <div style={S_MB.momentumHint}>Closing this gap moves your IRS more than any other single change right now.</div>
          {drillTopic && (
            <Button variant="gradient" size="sm" onClick={() => onDrill(drillTopic)} disabled={starting}>
              Drill {drillTopic} →
            </Button>
          )}
        </div>

        {/* Card 2: Next Tier / Milestone */}
        <div style={{ ...S_MB.momentumCard, borderColor: nextTier && irsGap <= 15 ? `${C.blue500}44` : C.border, background: nextTier && irsGap <= 15 ? `${C.blue500}08` : C.card }}>
          {nextTier ? (
            <>
              <div style={{ ...S_MB.momentumBadge, color: irsGap <= 15 ? C.blue500 : C.muted, background: irsGap <= 15 ? `${C.blue500}18` : C.cardAlt }}>
                <span>↑</span> {irsGap <= 15 ? 'within striking distance' : 'next milestone'}
              </div>
              <div>
                <div style={S_MB.momentumTopic}>{nextTier.label}</div>
                <div style={S_MB.momentumMeta}>{irsGap} IRS points away · Current {scoreTrend.at(-1)?.score ?? '—'}</div>
              </div>
              <div style={S_MB.momentumBar}>
                <div style={{ ...S_MB.momentumBarFill, width: `${tierPct}%`, background: C.blue500 }} />
              </div>
              <div style={S_MB.momentumHint}>
                {irsGap <= 8
                  ? 'One strong session could push you over. Focus on your weakest dimension first.'
                  : `Fix ${weakestDim?.label ?? 'your weakest dimension'} — it's the biggest IRS lever you have.`}
              </div>
              <Button surface="light" variant="secondary" size="sm" onClick={onOpenAnalytics}>See what's blocking →</Button>
            </>
          ) : (
            <>
              <div style={{ ...S_MB.momentumBadge, color: C.green, background: `${C.green}18` }}><span>✓</span> top tier reached</div>
              <div style={S_MB.momentumTopic}>₹20 LPA+ eligible</div>
              <div style={S_MB.momentumHint}>You've crossed every IRS threshold. Now it's about consistency and breadth.</div>
              <Button surface="light" variant="secondary" size="sm" onClick={onOpenAnalytics}>Review your profile →</Button>
            </>
          )}
        </div>

        {/* Card 3: Streak / Archetype */}
        <div style={{ ...S_MB.momentumCard, borderColor: streakAtRisk ? `${C.amber}55` : streakHealthy ? `${C.green}44` : C.border, background: streakAtRisk ? `${C.amber}08` : streakHealthy ? `${C.green}08` : C.card }}>
          {streakAtRisk ? (
            <>
              <div style={{ ...S_MB.momentumBadge, color: C.amber, background: `${C.amber}18` }}><span>⚠</span> streak at risk</div>
              <div>
                <div style={S_MB.momentumTopic}>{streakDays}-day streak</div>
                <div style={S_MB.momentumMeta}>Last session {daysSince}d ago · Resets if you miss today</div>
              </div>
              <div style={S_MB.momentumBar}>
                <div style={{ ...S_MB.momentumBarFill, width: `${Math.min(100, (streakDays / 14) * 100)}%`, background: C.amber }} />
              </div>
              <div style={S_MB.momentumHint}>5-minute quick-fire keeps it alive. Don't lose what you built.</div>
              <Button variant="gradient" size="sm" onClick={() => onDrill('')} disabled={starting}>Keep streak alive →</Button>
            </>
          ) : isTrending && predicted != null ? (
            <>
              <div style={{ ...S_MB.momentumBadge, color: C.green, background: `${C.green}18` }}><span>↗</span> on a roll</div>
              <div>
                <div style={S_MB.momentumTopic}>Predicted {predicted}</div>
                <div style={S_MB.momentumMeta}>+{recentSlope.toFixed(1)} pts/session · EWMA trend</div>
              </div>
              <div style={S_MB.momentumBar}>
                <div style={{ ...S_MB.momentumBarFill, width: `${predicted}%`, background: C.green }} />
              </div>
              <div style={S_MB.momentumHint}>{archetype?.fix}</div>
              <Button variant="gradient" size="sm" onClick={() => onDrill('')} disabled={starting}>Beat the forecast →</Button>
            </>
          ) : (
            <>
              <div style={{ ...S_MB.momentumBadge, color: C.blue500, background: `${C.blue500}18` }}><span>◈</span> your pattern</div>
              <div>
                <div style={S_MB.momentumTopic}>{archetype?.label ?? '—'}</div>
                <div style={S_MB.momentumMeta}>{streakDays > 0 ? `${streakDays}-day streak` : 'No active streak'}</div>
              </div>
              <div style={S_MB.momentumBar}>
                <div style={{ ...S_MB.momentumBarFill, width: `${Math.min(100, (streakDays / 14) * 100)}%`, background: C.blue500 }} />
              </div>
              <div style={S_MB.momentumHint}>{archetype?.fix ?? 'Start a session to build your performance pattern.'}</div>
              <Button surface="light" variant="secondary" size="sm" onClick={() => onDrill('')} disabled={starting}>Start a session →</Button>
            </>
          )}
        </div>

      </div>
    </section>
  );
}

export default MomentumBoard;