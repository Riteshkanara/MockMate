/**
 * Feedback sections. Each has a Body (content only) and a Card (Body inside the
 * standard section frame). Real data uses the Card; the locked preview renders the
 * same Body with SAMPLE data inside a LockedSection, so both states share one layout.
 */
import PropTypes from 'prop-types';
import { useState } from 'react';
import { C, F } from '../../../styles/token';
import Icon from '../icons';
import { LockedBlock } from './Locked';
import { markKeywords, num, safeArr, splitNumbered, splitParts, starIsEmpty, wordCount } from './helpers';
import { Bar, HUE, Pill, Points, Section, card } from './ui';

// ── Fix this first ─────────────────────────────────────────────────────────────
export function FixFirstBody({ tip }) {
  const numbered = splitNumbered(tip);
  return numbered.length > 1
    ? <Points items={numbered} color={C.brand500} />
    : <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: C.text }}>{tip.trim()}</p>;
}
FixFirstBody.propTypes = { tip: PropTypes.string.isRequired };

export function FixFirstCard({ tip }) {
  if (!tip || !tip.trim()) return null;
  return (
    <Section id="fb-fix" icon="lightbulb" hue="fix" title="Fix this first" sub="The single change that lifts this answer most">
      <div style={{ borderLeft: `3px solid ${C.brand500}`, paddingLeft: 14 }}><FixFirstBody tip={tip} /></div>
    </Section>
  );
}
FixFirstCard.propTypes = { tip: PropTypes.string };

// ── What worked / What to add ──────────────────────────────────────────────────
export function WorkedAndMissing({ good, missing }) {
  const goodParts = splitParts(good);
  const missParts = splitParts(missing);
  if (!goodParts.length && !missParts.length) return null;
  const both = goodParts.length && missParts.length;
  return (
    <div id="fb-review" className="fb-twocol fb-scroll" style={{ display: 'grid', gridTemplateColumns: both ? '1fr 1fr' : '1fr', gap: 12 }}>
      {goodParts.length > 0 && (
        <Section icon="check" hue="worked" title="What worked" tinted>
          <Points items={goodParts} color={C.success} />
        </Section>
      )}
      {missParts.length > 0 && (
        <Section icon="target" hue="add" title="What to add" tinted>
          <Points items={missParts} color={C.warning} />
        </Section>
      )}
    </div>
  );
}
WorkedAndMissing.propTypes = { good: PropTypes.string, missing: PropTypes.string };

// ── Compare: your answer vs a strong answer ────────────────────────────────────
function ModelBody({ sampleAnswer, idealHint, missed = [] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(sampleAnswer); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked: ignore */ }
  };
  const steps = splitParts(sampleAnswer);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {idealHint && (
        <div style={{ padding: '11px 13px', borderRadius: 12, background: HUE.model.tint, border: `1px solid ${HUE.model.b}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.indigo, marginBottom: 3 }}>The key idea</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text }}>{idealHint}</div>
        </div>
      )}
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {steps.map((st, i) => (
          <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: HUE.model.tint, color: C.indigo, fontFamily: F.mono, fontSize: 12, fontWeight: 800, marginTop: 1 }}>{i + 1}</span>
            <span style={{ fontSize: 14.5, lineHeight: 1.7, color: C.text, flex: 1 }}>
              {markKeywords(st, missed).map((p, k) => (p.hit ? <mark key={k} className="fb-mark">{p.t}</mark> : <span key={k}>{p.t}</span>))}
            </span>
          </li>
        ))}
      </ol>
      {missed.length > 0 && (
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          <mark className="fb-mark">Highlighted</mark> words are keywords your answer did not mention.
        </div>
      )}
      {sampleAnswer && (
        <button type="button" className="fb-btn" onClick={copy} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 38, padding: '0 13px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.sub, fontFamily: F.body, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
          <Icon name={copied ? 'check' : 'copy'} size={15} />{copied ? 'Copied' : 'Copy model answer'}
        </button>
      )}
    </div>
  );
}
ModelBody.propTypes = { sampleAnswer: PropTypes.string, idealHint: PropTypes.string, missed: PropTypes.array };

export function CompareCard({ userAnswer = '', sampleAnswer = '', idealHint = '', missed = [], defaultTab = 'yours', modelLocked = false, teaser = '', sample = null }) {
  const hasYours = Boolean(userAnswer && userAnswer.trim());
  const hasModel = Boolean(sampleAnswer) || modelLocked;
  const [tab, setTab] = useState(defaultTab === 'model' && hasModel ? 'model' : hasYours ? 'yours' : 'model');
  if (!hasYours && !hasModel) return null;

  const tabs = [hasYours && { id: 'yours', label: 'Your answer' }, hasModel && { id: 'model', label: 'Model answer', lock: modelLocked }].filter(Boolean);
  const right = tab === 'yours' ? `${wordCount(userAnswer)} words` : (modelLocked ? 'Example' : `${wordCount(sampleAnswer)} words`);

  return (
    <Section id="fb-compare" icon="trophy" hue="model" title="Compare with a strong answer" sub="See the gap, line by line" right={right}>
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Compare answers" style={{ display: 'inline-flex', padding: 3, borderRadius: 12, background: C.brand50, border: `1px solid ${C.brand100}`, marginBottom: 14 }}>
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="fb-tab" onClick={() => setTab(t.id)}
              style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', minHeight: 40, borderRadius: 9, display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: F.body, fontSize: 14, fontWeight: 700, background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? C.brand700 : C.sub, boxShadow: tab === t.id ? '0 1px 6px rgba(26,110,255,.16)' : 'none' }}>
              {t.label}{t.lock && <Icon name="lock" size={13} stroke={2.4} />}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel">
        {tab === 'yours' && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: C.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{userAnswer}</p>}
        {tab === 'model' && !modelLocked && <ModelBody sampleAnswer={sampleAnswer} idealHint={idealHint} missed={missed} />}
        {tab === 'model' && modelLocked && (
          <>
            {teaser && <p style={{ margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.65, fontWeight: 600, color: C.text }}>{teaser}</p>}
            <LockedBlock feature="detailedFeedback" cta="Unlock the model answer" hint="Your own model answer appears the moment you upgrade" height={190}>
              <ModelBody sampleAnswer={sample?.sampleAnswer} idealHint={sample?.idealHint} missed={safeArr(sample?.keywordCoverage?.missed)} />
            </LockedBlock>
          </>
        )}
      </div>
    </Section>
  );
}
CompareCard.propTypes = { userAnswer: PropTypes.string, sampleAnswer: PropTypes.string, idealHint: PropTypes.string, missed: PropTypes.array, defaultTab: PropTypes.string, modelLocked: PropTypes.bool, teaser: PropTypes.string, sample: PropTypes.object };

// ── Follow-ups ─────────────────────────────────────────────────────────────────
export function FollowUpsBody({ questions, interactive = true }) {
  const [done, setDone] = useState({});
  return (
    <>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>An interviewer could ask these next. Think through your answer to each, then tick it off.</p>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q, i) => {
          const on = Boolean(done[i]);
          return (
            <li key={i}>
              <button type="button" className="fb-btn" disabled={!interactive} aria-pressed={on} onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                style={{ width: '100%', display: 'flex', gap: 11, alignItems: 'flex-start', textAlign: 'left', padding: '11px 12px', minHeight: 48, borderRadius: 12, background: on ? HUE.worked.tint : C.surfaceAlt, border: `1px solid ${on ? HUE.worked.b : C.border}`, cursor: interactive ? 'pointer' : 'default', fontFamily: F.body }}>
                <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? C.success : HUE.follow.tint, color: on ? '#fff' : HUE.follow.c, border: `1px solid ${on ? C.success : HUE.follow.b}`, fontFamily: F.mono, fontSize: 12, fontWeight: 800 }}>
                  {on ? <Icon name="check" size={13} stroke={3} /> : i + 1}
                </span>
                <span style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text, flex: 1 }}>{q}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}
FollowUpsBody.propTypes = { questions: PropTypes.array.isRequired, interactive: PropTypes.bool };

export function FollowUpsCard({ questions }) {
  const list = safeArr(questions);
  if (!list.length) return null;
  return (
    <Section id="fb-follow" icon="help" hue="follow" title="Likely follow-ups" sub={`${list.length} questions to be ready for`}>
      <FollowUpsBody questions={list} />
    </Section>
  );
}
FollowUpsCard.propTypes = { questions: PropTypes.array };

// ── Deep dive tabs: keywords, structure, confidence, delivery ──────────────────
export function KeywordsBody({ keywords }) {
  const hit = safeArr(keywords?.hit);
  const missed = safeArr(keywords?.missed);
  if (!hit.length && !missed.length) return null;
  const total = hit.length + missed.length;
  const pct = Math.round((hit.length / total) * 100);
  const col = pct >= 70 ? C.success : pct >= 40 ? C.warning : C.danger;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 7 }}>
        <span>Keywords you covered</span><span style={{ color: col, fontFamily: F.mono }}>{hit.length} of {total}</span>
      </div>
      <Bar pct={pct} color={col} height={8} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
        {hit.map((k) => <Pill key={`h-${k}`} color={C.success}><Icon name="check" size={12} stroke={3} />{k}</Pill>)}
        {missed.map((k) => <Pill key={`m-${k}`} color={C.danger}><Icon name="x" size={12} stroke={3} />{k}</Pill>)}
      </div>
      {missed.length > 0 && <p style={{ margin: '10px 0 0', fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>Red keywords were not in your answer. Work them in where they fit naturally.</p>}
    </div>
  );
}
KeywordsBody.propTypes = { keywords: PropTypes.object };

export function StarBody({ starBreakdown }) {
  if (starIsEmpty(starBreakdown)) return null;
  const { S, T, A, R, overall } = starBreakdown;
  const pillars = [
    { label: 'Situation', data: S, color: C.accent500 },
    { label: 'Task', data: T, color: C.brand500 },
    { label: 'Action', data: A, color: C.violet },
    { label: 'Result', data: R, color: C.success },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {pillars.map(({ label, data, color }) => {
        if (!data) return null;
        const s = Math.max(0, Math.min(100, Number(data.score) || 0));
        return (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 14, fontWeight: 700, color: C.text }}>
              <span>{label}</span><span style={{ color, fontFamily: F.mono }}>{s}/100</span>
            </div>
            <Bar pct={s} color={color} height={6} />
            {data.note && <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, marginTop: 4 }}>{data.note}</div>}
          </div>
        );
      })}
      {overall && !/not applicable/i.test(overall) && (
        <div style={{ padding: '11px 13px', borderRadius: 12, background: C.brand50, border: `1px solid ${C.brand100}`, fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{overall}</div>
      )}
    </div>
  );
}
StarBody.propTypes = { starBreakdown: PropTypes.object };

export function ConfidenceBody({ confidenceScore }) {
  if (confidenceScore == null) return null;
  const obj = typeof confidenceScore === 'object';
  const score = Math.max(0, Math.min(100, num(confidenceScore) || 0));
  const label = obj && confidenceScore.label ? confidenceScore.label : score >= 75 ? 'Confident' : score >= 50 ? 'Neutral' : score >= 30 ? 'Hesitant' : 'Uncertain';
  const note = obj ? confidenceScore.note : null;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.violet }}>{label}</span>
        <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 700, color: C.sub }}>{score}%</span>
      </div>
      <Bar pct={score} color={C.violet} height={8} />
      {obj && (confidenceScore.formalPct != null || confidenceScore.hedgingPct != null) && (
        <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
          {confidenceScore.formalPct != null && <Pill color={C.accent600}>Formal wording {confidenceScore.formalPct}%</Pill>}
          {confidenceScore.hedgingPct != null && <Pill color={C.warning}>Hedging words {confidenceScore.hedgingPct}%</Pill>}
        </div>
      )}
      {note && <p style={{ margin: '10px 0 0', fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{note}</p>}
    </div>
  );
}
ConfidenceBody.propTypes = { confidenceScore: PropTypes.oneOfType([PropTypes.object, PropTypes.number]) };

export function DeliveryBody({ vm, feedback }) {
  if (!vm) return null;
  const { wpm, fillerWords, answerLength } = vm;
  const tone = feedback?.toneAnalysis, vocab = feedback?.vocabularyRichness, hes = feedback?.hesitationPattern;
  const wpmColor = { tooSlow: C.warning, ideal: C.success, tooFast: C.danger }[wpm?.band] || C.brand500;
  const fillers = fillerWords?.total ?? 0;
  const fillerColor = fillers === 0 ? C.success : fillers <= 3 ? C.warning : C.danger;
  const scores = [
    tone && { k: 'Tone', v: tone.score, sub: tone.label },
    vocab && { k: 'Vocabulary', v: vocab.score, sub: vocab.label },
    hes && { k: 'Fluency', v: hes.score, sub: hes.pattern },
  ].filter(Boolean);
  const box = { padding: '12px 14px', borderRadius: 12, background: C.surfaceAlt, border: `1px solid ${C.border}` };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="fb-twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={box}>
          <div style={{ fontSize: 13, color: C.muted }}>Speaking pace</div>
          <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: wpmColor, margin: '2px 0 6px' }}>{wpm?.wpm > 0 ? `${wpm.wpm} wpm` : 'Not measured'}</div>
          <Bar pct={Math.min(100, ((wpm?.wpm || 0) / 200) * 100)} color={wpmColor} height={5} />
          {wpm?.label && <div style={{ fontSize: 13, color: C.sub, marginTop: 6 }}>{wpm.label}{wpm.hint ? `. ${wpm.hint}` : ''}</div>}
        </div>
        <div style={box}>
          <div style={{ fontSize: 13, color: C.muted }}>Filler words</div>
          <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: fillerColor, margin: '2px 0 6px' }}>{fillers === 0 ? 'None' : fillers}</div>
          {fillers > 0 && safeArr(fillerWords?.breakdown).length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {fillerWords.breakdown.map(({ word, count }) => <Pill key={word} color={count >= 3 ? C.danger : C.warning}>&quot;{word}&quot; x{count}</Pill>)}
            </div>
          ) : <div style={{ fontSize: 13, color: C.sub }}>{fillers === 0 ? 'Clean delivery.' : ''}</div>}
        </div>
      </div>
      {answerLength && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            <span>Length</span>
            <span style={{ color: C.sub, fontWeight: 600 }}>{answerLength.wordCount} words, target {answerLength.min}–{answerLength.max}</span>
          </div>
          <div style={{ position: 'relative', height: 7, borderRadius: 99, background: C.brand50, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: `${(answerLength.min / 350) * 100}%`, width: `${((answerLength.max - answerLength.min) / 350) * 100}%`, height: '100%', background: `${C.success}30` }} />
            <div style={{ position: 'relative', height: '100%', width: `${Math.min(100, (answerLength.wordCount / 350) * 100)}%`, borderRadius: 99, background: answerLength.rating === 'ideal' ? C.success : C.warning }} />
          </div>
          {answerLength.hint && <div style={{ fontSize: 13.5, color: C.muted, marginTop: 5 }}>{answerLength.hint}</div>}
        </div>
      )}
      {scores.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scores.length}, 1fr)`, gap: 10 }}>
          {scores.map((s) => (
            <div key={s.k} style={{ ...box, padding: '11px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 800, color: C.text }}>{s.v}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.sub }}>{s.k}</div>
              <div style={{ fontSize: 12.5, color: C.muted }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}
      {[tone?.note, vocab?.note, hes?.note].filter(Boolean).map((n, i) => <p key={i} style={{ margin: 0, fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{n}</p>)}
      {feedback?.deliveryTip && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: HUE.delivery.tint, border: `1px solid ${HUE.delivery.b}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.violet, marginBottom: 3 }}>Delivery tip</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text }}>{feedback.deliveryTip}</div>
        </div>
      )}
    </div>
  );
}
DeliveryBody.propTypes = { vm: PropTypes.object, feedback: PropTypes.object };

const TAB_BODY = {
  keywords:   ({ data }) => <KeywordsBody keywords={data.feedback?.keywordCoverage || data.feedback?.keywords} />,
  structure:  ({ data }) => <StarBody starBreakdown={data.feedback?.starBreakdown} />,
  confidence: ({ data }) => <ConfidenceBody confidenceScore={data.feedback?.confidenceScore} />,
  delivery:   ({ data }) => <DeliveryBody vm={data.vm} feedback={data.feedback} />,
};
const TAB_LABEL = { keywords: 'Keywords', structure: 'Structure', confidence: 'Confidence', delivery: 'Delivery' };

/** Tab ids that have real content for a Pro answer. */
export const availableTabs = (feedback, vm) => {
  const kw = feedback?.keywordCoverage || feedback?.keywords;
  return [
    (safeArr(kw?.hit).length || safeArr(kw?.missed).length) && 'keywords',
    !starIsEmpty(feedback?.starBreakdown) && 'structure',
    feedback?.confidenceScore != null && 'confidence',
    vm && 'delivery',
  ].filter(Boolean);
};

/**
 * One tabbed card. Real (Pro): shows the tabs that have data, first one open.
 * Locked (free): same tabs, same bodies, SAMPLE data inside a LockedBlock.
 */
export function DeepDiveCard({ feedback, vm, tabs, locked = false, voice = false }) {
  const [tab, setTab] = useState(tabs[0]);
  if (!tabs.length) return null;
  const active = tabs.includes(tab) ? tab : tabs[0];
  const Body = TAB_BODY[active];
  const data = { feedback, vm };
  const labelOf = (t) => (t === 'delivery' && voice ? 'Voice report' : TAB_LABEL[t]);
  return (
    <Section id="fb-deep" icon="chart" hue="analysis" title="Deep analysis" sub={tabs.map(labelOf).join(', ')}>
      <div role="tablist" aria-label="Deep analysis" className="fb-chips" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 2, scrollbarWidth: 'none' }}>
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={active === t} className="fb-tab" onClick={() => setTab(t)}
            style={{ flexShrink: 0, minHeight: 40, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, cursor: 'pointer', fontFamily: F.body, fontSize: 14, fontWeight: 700, border: `1px solid ${active === t ? HUE.analysis.c : C.border}`, background: active === t ? HUE.analysis.tint : C.surface, color: active === t ? HUE.analysis.c : C.sub }}>
            {labelOf(t)}{locked && <Icon name="lock" size={12} stroke={2.4} />}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="fb-in" key={active}>
        {locked ? (
          <LockedBlock feature={active === 'delivery' && voice ? 'voiceEvaluation' : 'detailedFeedback'} cta={active === 'delivery' && voice ? 'Unlock my voice report' : `Unlock ${TAB_LABEL[active].toLowerCase()} analysis`} hint="Shown with example data. Yours appears when you upgrade." height={230}>
            <Body data={data} />
          </LockedBlock>
        ) : <Body data={data} />}
      </div>
    </Section>
  );
}
DeepDiveCard.propTypes = { feedback: PropTypes.object, vm: PropTypes.object, tabs: PropTypes.arrayOf(PropTypes.string).isRequired, locked: PropTypes.bool, voice: PropTypes.bool };

// ── Multiple choice review ─────────────────────────────────────────────────────
export function McqReview({ question, correct, userAnswerIndex, skipped }) {
  const ci = question?.correctAnswerIndex;
  const options = safeArr(question?.options);
  const explanation = question?.explanation || '';
  return (
    <>
      {explanation && (
        <Section id="fb-fix" icon="lightbulb" hue="fix" title="Why this is the answer">
          <Points items={splitParts(explanation)} color={C.brand500} />
        </Section>
      )}
      {options.length > 0 && (
        <section style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 10px', fontFamily: F.display, fontSize: 15.5, fontWeight: 800, color: C.text }}>All options</div>
          {options.map((opt, i) => {
            const isC = i === ci;
            const isU = i === userAnswerIndex;
            const wrong = isU && !correct;
            const col = isC ? C.success : wrong ? C.danger : C.muted;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: isC ? C.successTint : wrong ? C.dangerTint : C.surface, borderTop: `1px solid ${C.border}`, minHeight: 50 }}>
                <span style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, border: `1.5px solid ${isC || wrong ? col : C.border}`, color: col, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 800 }}>
                  {isC ? <Icon name="check" size={15} stroke={3} /> : wrong ? <Icon name="x" size={15} stroke={3} /> : String.fromCharCode(65 + i)}
                </span>
                <span style={{ flex: 1, fontSize: 14.5, lineHeight: 1.5, color: C.text, fontWeight: isC ? 700 : 500 }}>{opt}</span>
                {isC && <span style={{ fontSize: 13, fontWeight: 700, color: C.success }}>{skipped ? 'Correct answer' : 'Correct'}</span>}
                {wrong && <span style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>Your answer</span>}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
McqReview.propTypes = { question: PropTypes.object, correct: PropTypes.bool, userAnswerIndex: PropTypes.number, skipped: PropTypes.bool };
