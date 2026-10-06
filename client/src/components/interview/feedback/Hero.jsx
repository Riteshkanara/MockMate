/**
 * Result hero: score ring, verdict, band ladder, "points to next band", session
 * comparison, and a small stats row. Everything shown is real data or plain arithmetic.
 */
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { C, F } from '../../../styles/token';
import useUpgrade from '../../../hooks/useUpgrade';
import Icon from '../icons';
import { BANDS, bandIndex, compareToSession, fmtTime, heroScoreColor, nextBand, num, safeArr, verdict } from './helpers';
import { useCountUp } from './ui';

const HERO_BG = `radial-gradient(120% 90% at 100% 0%, rgba(0,200,240,.38) 0%, rgba(0,200,240,0) 55%), linear-gradient(140deg, ${C.brand900} 0%, ${C.blue800} 28%, ${C.brand600} 72%, ${C.accent600} 130%)`;
const heroShadow = '0 18px 44px rgba(0,31,107,.26), inset 0 1px 0 rgba(255,255,255,.14)';

const LockMini = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Locked, Pro">
    <rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

/** Five-step ladder with a marker at the score. Segment widths follow the band ranges. */
function BandLadder({ score }) {
  const idx = bandIndex(score);
  const widths = BANDS.map((b, i) => (BANDS[i + 1] ? BANDS[i + 1].min : 100) - b.min);
  const pos = Math.max(1.5, Math.min(98.5, score));
  return (
    <div style={{ marginTop: 16 }} aria-hidden="true">
      <div style={{ position: 'relative', display: 'flex', gap: 3, height: 8 }}>
        {BANDS.map((b, i) => (
          <div key={b.label} style={{ flex: widths[i], borderRadius: 99, background: i <= idx ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.16)', opacity: i < idx ? 0.55 : 1 }} />
        ))}
        <span style={{ position: 'absolute', left: `${pos}%`, top: -4, width: 16, height: 16, marginLeft: -8, borderRadius: '50%', background: '#fff', border: `3px solid ${C.brand600}`, boxShadow: '0 2px 8px rgba(0,0,0,.3)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11.5, color: 'rgba(255,255,255,.62)', fontWeight: 600 }}>
        <span>0</span><span>40</span><span>60</span><span>75</span><span>90</span><span>100</span>
      </div>
    </div>
  );
}
BandLadder.propTypes = { score: PropTypes.number.isRequired };

/** Earlier written answers in this session + this one, as tiny bars. */
function SessionBars({ previous, score }) {
  if (!previous.length) return null;
  const all = [...previous, score].slice(-8);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 3, height: 22 }} role="img" aria-label={`Scores this session: ${all.join(', ')}`}>
      {all.map((v, i) => (
        <span key={i} style={{ width: 6, height: `${Math.max(14, v)}%`, borderRadius: 2, background: i === all.length - 1 ? '#fff' : 'rgba(255,255,255,.38)' }} />
      ))}
    </div>
  );
}
SessionBars.propTypes = { previous: PropTypes.arrayOf(PropTypes.number).isRequired, score: PropTypes.number.isRequired };

export function ScoreHero({ score, timeTaken = 0, timeLimit = 0, previousScores = [], feedback = null, basic = false }) {
  const { openUpgrade } = useUpgrade();
  const v = verdict(score);
  const shown = useCountUp(score);
  const accent = heroScoreColor(score);
  const next = nextBand(score);
  const cmp = compareToSession(score, previousScores);
  const SIZE = 116, R = 47, CIRC = 2 * Math.PI * R;
  const [go, setGo] = useState(false);
  useEffect(() => { const id = setTimeout(() => setGo(true), 40); return () => clearTimeout(id); }, []);

  const kw = feedback?.keywordCoverage;
  const hit = safeArr(kw?.hit).length;
  const total = hit + safeArr(kw?.missed).length;
  const conf = num(feedback?.confidenceScore);
  const stats = [
    timeTaken > 0 ? { k: 'Time used', v: timeLimit ? `${fmtTime(timeTaken)} of ${fmtTime(timeLimit)}` : fmtTime(timeTaken) } : null,
    basic ? { k: 'Keywords covered', locked: true } : (total > 0 ? { k: 'Keywords covered', v: `${hit} of ${total}` } : null),
    basic ? { k: 'Confidence', locked: true } : (conf != null ? { k: 'Confidence', v: `${conf}%` } : null),
  ].filter(Boolean);

  return (
    <div style={{ background: HERO_BG, borderRadius: 22, padding: '22px 20px 18px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: heroShadow }}>
      <div aria-hidden="true" className="fb-glow" style={{ position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.22), rgba(255,255,255,0) 68%)', pointerEvents: 'none' }} />
      <div className="fb-hero-top" style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
        <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }} role="img" aria-label={`Score ${score} out of 100`}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)', display: 'block' }} aria-hidden="true">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={9} />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={accent} strokeWidth={9} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={go ? CIRC * (1 - Math.max(0, Math.min(100, score)) / 100) : CIRC}
              style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)', filter: `drop-shadow(0 0 6px ${accent}88)` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: F.display, fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.8px', fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>out of 100</span>
          </div>
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15 }}>{v.label}</div>
          <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,.88)' }}>{v.sub}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 11 }}>
            {cmp && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 99, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', fontSize: 13, fontWeight: 600 }}>
                {cmp.dir === 'up' && <span aria-hidden="true">▲</span>}
                {cmp.dir === 'down' && <span aria-hidden="true">▼</span>}
                {cmp.text}
              </span>
            )}
            <SessionBars previous={previousScores} score={score} />
          </div>
        </div>
      </div>

      <BandLadder score={score} />
      <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'rgba(255,255,255,.86)', fontWeight: 600 }}>
        {next ? `${next.need} more point${next.need === 1 ? '' : 's'} to reach "${next.label}"` : 'Top band reached. Keep this answer as your benchmark.'}
      </p>

      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, marginTop: 16, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}>
          {stats.map((st, i) => {
            const body = (
              <>
                <div style={{ fontFamily: F.display, fontSize: 15.5, fontWeight: 800, minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {st.locked ? <LockMini /> : st.v}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>{st.k}</div>
              </>
            );
            const base = { padding: '10px 8px', textAlign: 'center', borderLeft: i ? '1px solid rgba(255,255,255,.16)' : 'none' };
            return st.locked
              ? <button key={st.k} type="button" onClick={() => openUpgrade('detailedFeedback')} aria-label={`${st.k}: Pro feature. Opens upgrade options.`} style={{ ...base, border: 'none', borderLeft: base.borderLeft, background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: F.body }}>{body}</button>
              : <div key={st.k} style={base}>{body}</div>;
          })}
        </div>
      )}
    </div>
  );
}
ScoreHero.propTypes = {
  score: PropTypes.number.isRequired, timeTaken: PropTypes.number, timeLimit: PropTypes.number,
  previousScores: PropTypes.arrayOf(PropTypes.number), feedback: PropTypes.object, basic: PropTypes.bool,
};

export function McqHero({ correct = false, question = null, userAnswerIndex = null, timeTaken = 0, timeLimit = 0 }) {
  const options = question?.options || [];
  const ci = question?.correctAnswerIndex;
  const letter = (i) => (i != null ? String.fromCharCode(65 + i) : '');
  const accent = correct ? '#6EE7B7' : '#FCA5A5';
  return (
    <div style={{ background: HERO_BG, borderRadius: 22, padding: '20px', color: '#fff', boxShadow: heroShadow }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 20, flexShrink: 0, background: 'rgba(255,255,255,.12)', border: `1.5px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, boxShadow: `0 0 18px ${accent}44` }}>
          <Icon name={correct ? 'check' : 'x'} size={32} stroke={3} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15 }}>{correct ? 'Correct' : 'Not this time'}</div>
          <p style={{ margin: '5px 0 0', fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,.88)' }}>
            {correct ? 'That is the right answer.' : `The answer is option ${letter(ci)}. The explanation below shows why.`}
            {timeTaken > 0 && <span style={{ color: 'rgba(255,255,255,.68)' }}>{` Answered in ${fmtTime(timeTaken)}${timeLimit ? ` of ${fmtTime(timeLimit)}` : ''}.`}</span>}
          </p>
        </div>
      </div>
      {!correct && userAnswerIndex != null && options[userAnswerIndex] && (
        <div style={{ marginTop: 14, padding: '10px 13px', borderRadius: 12, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: 'rgba(255,255,255,.68)' }}>You chose {letter(userAnswerIndex)}: </span>{options[userAnswerIndex]}
        </div>
      )}
    </div>
  );
}
McqHero.propTypes = { correct: PropTypes.bool, question: PropTypes.object, userAnswerIndex: PropTypes.number, timeTaken: PropTypes.number, timeLimit: PropTypes.number };
