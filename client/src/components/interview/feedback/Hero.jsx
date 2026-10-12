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

const TIER = [
  { e: '🌱', c: '#FCA5A5' }, { e: '📈', c: '#FCD34D' }, { e: '💪', c: '#7DD3FC' }, { e: '🔥', c: '#6EE7B7' }, { e: '🏆', c: '#FDE68A' },
];
const SEG = ['#F87171', '#FBBF24', '#38BDF8', '#34D399', '#A7F3D0'];
const SPARKS = [[-8, 12, 0], [104, 0, 0.4], [118, 70, 0.9], [-14, 96, 1.3], [60, -14, 0.6], [24, 150, 1.7]];

/** Five-step ladder: every band has its own colour; the marker carries the score. */
function BandLadder({ score }) {
  const idx = bandIndex(score);
  const widths = BANDS.map((b, i) => (BANDS[i + 1] ? BANDS[i + 1].min : 100) - b.min);
  const pos = Math.max(2, Math.min(98, score));
  return (
    <div style={{ marginTop: 20 }} aria-hidden="true">
      <div style={{ position: 'relative', display: 'flex', gap: 4, height: 10 }}>
        {BANDS.map((b, i) => (
          <div key={b.label} style={{ flex: widths[i], borderRadius: 99, background: SEG[i], opacity: i < idx ? 0.55 : i === idx ? 1 : 0.2, boxShadow: i === idx ? `0 0 14px ${SEG[i]}99` : 'none' }} />
        ))}
        <span className="fb-marker" style={{ position: 'absolute', left: `${pos}%`, top: -27, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ padding: '2px 8px', borderRadius: 8, background: '#fff', color: C.brand700, fontFamily: F.display, fontSize: 12, fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,.28)' }}>{Math.round(score)}</span>
          <span style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #fff' }} />
        </span>
      </div>
      <div style={{ display: 'flex', marginTop: 9, gap: 4 }}>
        {BANDS.map((b, i) => (
          <span key={b.label} style={{ flex: widths[i], fontSize: 10.5, fontWeight: i === idx ? 800 : 600, color: i === idx ? '#fff' : 'rgba(255,255,255,.5)', textAlign: 'left', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap', letterSpacing: '.02em' }}>{b.min}</span>
        ))}
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
    <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 3, height: 24, padding: '0 4px' }} role="img" aria-label={`Scores this session: ${all.join(', ')}`}>
      {all.map((v, i) => (
        <span key={i} className={i === all.length - 1 ? 'fb-bar' : undefined} style={{ width: 6, height: `${Math.max(14, v)}%`, borderRadius: 3, background: i === all.length - 1 ? '#fff' : 'rgba(255,255,255,.34)', boxShadow: i === all.length - 1 ? '0 0 8px rgba(255,255,255,.7)' : 'none' }} />
      ))}
    </div>
  );
}
SessionBars.propTypes = { previous: PropTypes.arrayOf(PropTypes.number).isRequired, score: PropTypes.number.isRequired };

const TILE = {
  time: { e: '⏱️', bg: 'rgba(0,200,240,.16)', bd: 'rgba(95,224,255,.38)' },
  kw:   { e: '🎯', bg: 'rgba(52,211,153,.16)', bd: 'rgba(110,231,183,.38)' },
  conf: { e: '💬', bg: 'rgba(167,139,250,.18)', bd: 'rgba(196,181,253,.4)' },
};

export function ScoreHero({ score, timeTaken = 0, timeLimit = 0, previousScores = [], feedback = null, basic = false }) {
  const { openUpgrade } = useUpgrade();
  const v = verdict(score);
  const shown = useCountUp(score);
  const accent = heroScoreColor(score);
  const next = nextBand(score);
  const cmp = compareToSession(score, previousScores);
  const idx = bandIndex(score);
  const tier = TIER[idx];
  const SIZE = 156, R = 64, CIRC = 2 * Math.PI * R;
  const [go, setGo] = useState(false);
  useEffect(() => { const id = setTimeout(() => setGo(true), 40); return () => clearTimeout(id); }, []);

  const kw = feedback?.keywordCoverage;
  const hit = safeArr(kw?.hit).length;
  const total = hit + safeArr(kw?.missed).length;
  const conf = num(feedback?.confidenceScore);
  const stats = [
    timeTaken > 0 ? { k: 'Time used', t: 'time', v: timeLimit ? `${fmtTime(timeTaken)} / ${fmtTime(timeLimit)}` : fmtTime(timeTaken) } : null,
    basic ? { k: 'Keywords', t: 'kw', locked: true } : (total > 0 ? { k: 'Keywords', t: 'kw', v: `${hit} of ${total}` } : null),
    basic ? { k: 'Confidence', t: 'conf', locked: true } : (conf != null ? { k: 'Confidence', t: 'conf', v: `${conf}%` } : null),
  ].filter(Boolean);
  const celebrate = score >= 60;

  return (
    <div className="fb-hero" style={{ background: HERO_BG, borderRadius: 26, padding: '24px 20px 20px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: heroShadow }}>
      <div aria-hidden="true" className="fb-glow" style={{ position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.24), rgba(255,255,255,0) 68%)', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: -90, left: -70, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${accent}33, transparent 70%)`, pointerEvents: 'none' }} />
      <span aria-hidden="true" className="fb-hero-sweep" />

      <div className="fb-hero-top" style={{ display: 'flex', alignItems: 'center', gap: 22, position: 'relative' }}>
        <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }} role="img" aria-label={`Score ${score} out of 100`}>
          {celebrate && SPARKS.map(([x, y, d], i) => (
            <span key={i} aria-hidden="true" className="fb-spark" style={{ position: 'absolute', left: x, top: y, fontSize: i % 2 ? 11 : 14, animationDelay: `${d + 0.5}s`, color: i % 3 === 0 ? '#FDE68A' : '#A5F3FC' }}>✦</span>
          ))}
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)', display: 'block', overflow: 'visible' }} aria-hidden="true">
            <defs>
              <linearGradient id="fbRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={accent} /><stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R + 11} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth={4} strokeDasharray="1.2 5.4" />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.15)" strokeWidth={11} />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="url(#fbRing)" strokeWidth={11} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={go ? CIRC * (1 - Math.max(0, Math.min(100, score)) / 100) : CIRC}
              style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(.16,1,.3,1)', filter: `drop-shadow(0 0 9px ${accent}aa)` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: F.display, fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: '-2.4px', fontVariantNumeric: 'tabular-nums', textShadow: '0 4px 18px rgba(0,0,0,.25)' }}>{shown}</span>
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.7)', marginTop: 4, fontWeight: 600, letterSpacing: '.08em' }}>OUT OF 100</span>
          </div>
          <span className="fb-pop" aria-hidden="true" style={{ position: 'absolute', right: -4, bottom: 2, width: 46, height: 46, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, background: '#fff', boxShadow: `0 8px 20px rgba(0,0,0,.3), 0 0 0 3px ${tier.c}` }}>{tier.e}</span>
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.24)', fontFamily: F.mono, fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: tier.c }}>{`BAND ${idx + 1} OF ${BANDS.length}`}</span>
          <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 800, letterSpacing: '-0.7px', lineHeight: 1.1, marginTop: 8 }}>{v.label}</div>
          <p style={{ margin: '7px 0 0', fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,.88)' }}>{v.sub}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
            {cmp && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 99, background: cmp.dir === 'up' ? 'rgba(52,211,153,.2)' : cmp.dir === 'down' ? 'rgba(248,113,113,.2)' : 'rgba(255,255,255,.14)', border: `1px solid ${cmp.dir === 'up' ? 'rgba(110,231,183,.5)' : cmp.dir === 'down' ? 'rgba(252,165,165,.5)' : 'rgba(255,255,255,.24)'}`, fontSize: 13, fontWeight: 700 }}>
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
      <div style={{ marginTop: 12, padding: '9px 13px', borderRadius: 12, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 17 }}>{next ? '🚀' : '🏆'}</span>
        {next ? <span>{`${next.need} more point${next.need === 1 ? '' : 's'} to reach `}<span style={{ color: SEG[idx + 1] }}>{`“${next.label}”`}</span></span> : 'Top band reached. Keep this answer as your benchmark.'}
      </div>

      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 8, marginTop: 12 }}>
          {stats.map((st) => {
            const t = TILE[st.t];
            const body = (
              <>
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{t.e}</span>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, minHeight: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 5 }}>
                  {st.locked ? <LockMini /> : st.v}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', marginTop: 1, fontWeight: 600 }}>{st.k}</div>
              </>
            );
            const base = { padding: '11px 6px', textAlign: 'center', borderRadius: 14, background: t.bg, border: `1px solid ${t.bd}` };
            return st.locked
              ? <button key={st.k} type="button" onClick={() => openUpgrade('detailedFeedback')} aria-label={`${st.k}: Pro feature. Opens upgrade options.`} style={{ ...base, color: '#fff', cursor: 'pointer', fontFamily: F.body }}>{body}</button>
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
