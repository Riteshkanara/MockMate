/**
 * MockMate — FeedbackPanel.jsx  (v7)
 * ─────────────────────────────────────────────────────────────────────────────
 * One layout for every plan. Free users see the SAME sections Pro users get; the
 * Pro-only ones are rendered with clearly-labelled EXAMPLE data behind a lock.
 *
 *   Hero            score, band ladder, points to next band, session comparison
 *   Jump chips      fast navigation on long (mobile) panels, locks on Pro sections
 *   Fix this first  the single most useful change          (Pro; free sees first line)
 *   Worked / Add    what worked and what to add            (free + Pro)
 *   Compare         your answer vs a model answer          (your answer free; model Pro)
 *   Follow-ups      likely next questions, tick-off        (Pro)
 *   Deep analysis   tabs: keywords, structure, confidence, delivery   (Pro)
 *   Unlock bar      one calm summary of what Pro adds      (free only)
 *   Next            one primary action, pinned to the bottom
 *
 * Real Pro data never reaches a free user (server/utils/feedbackTier.js strips it),
 * so the locked sections are examples, not blurred copies of real analysis.
 *
 * Source split: ./feedback/{helpers,sampleFeedback,ui,Locked,Hero,Sections}
 * Exports: FeedbackPanel (named + default)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import PropTypes from 'prop-types';
import { useEffect, useMemo, useRef } from 'react';
import { C, F } from '../../styles/token';
import useUpgrade from '../../hooks/useUpgrade';
import ProBadge from '../pro/ProBadge';
import Icon from './icons';
import { McqHero, ScoreHero } from './feedback/Hero';
import { LockedSection } from './feedback/Locked';
import {
  CompareCard, DeepDiveCard, FixFirstBody, FixFirstCard, FollowUpsBody, FollowUpsCard,
  McqReview, WorkedAndMissing, availableTabs,
} from './feedback/Sections';
import { SAMPLE_FEEDBACK, SAMPLE_VOICE } from './feedback/sampleFeedback';
import { isStarTopic, safeArr, splitParts, verdict } from './feedback/helpers';
import { Notice, PANEL_CSS, PendingBlock } from './feedback/ui';

// ═══════════════════════════════════════════════════════════════════════════════
// Jump chips
// ═══════════════════════════════════════════════════════════════════════════════
function JumpChips({ items, rootRef }) {
  if (items.length < 4) return null;
  const go = (id) => rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  return (
    <nav aria-label="Jump to a section" className="fb-chips" style={{ display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -2px', padding: '2px' }}>
      {items.map((it) => (
        <button key={it.id} type="button" className="fb-chip" onClick={() => go(it.id)}
          style={{ flexShrink: 0, minHeight: 38, padding: '0 13px', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, border: `1px solid ${C.border}`, background: C.surface, color: C.sub, fontFamily: F.body, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
          {it.label}{it.locked && <Icon name="lock" size={12} stroke={2.4} style={{ color: C.brand500 }} />}
        </button>
      ))}
    </nav>
  );
}
JumpChips.propTypes = { items: PropTypes.array.isRequired, rootRef: PropTypes.object.isRequired };

// ═══════════════════════════════════════════════════════════════════════════════
// Unlock bar (free only): one summary instead of a CTA on every card
// ═══════════════════════════════════════════════════════════════════════════════
function UnlockBar({ names, voiceHot }) {
  const { openUpgrade } = useUpgrade();
  if (!names.length) return null;
  return (
    <section aria-label="What Pro adds to this answer" style={{ borderRadius: 18, padding: '16px 18px', background: `linear-gradient(135deg, ${C.brand50}, #fff 70%)`, border: `1px solid ${C.brand100}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '.12em', color: C.brand600, marginBottom: 3 }}>
            {names.length} MORE INSIGHT{names.length > 1 ? 'S' : ''} ON THIS ANSWER
          </div>
          <div style={{ fontFamily: F.display, fontSize: 16.5, fontWeight: 800, color: C.text, letterSpacing: '-0.2px' }}>
            {voiceHot ? 'Your voice report is ready' : 'See exactly how to score higher'}
          </div>
        </div>
        <ProBadge variant="pro" size="md" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {names.map((n) => (
          <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: '#fff', border: `1px solid ${C.brand100}`, color: C.brand700, fontSize: 13, fontWeight: 700 }}>
            <Icon name="lock" size={11} stroke={2.4} />{n}
          </span>
        ))}
      </div>
      <button type="button" className="fb-next" onClick={() => openUpgrade(voiceHot ? 'voiceEvaluation' : 'detailedFeedback')}
        style={{ minHeight: 48, border: 'none', borderRadius: 13, cursor: 'pointer', background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`, color: '#fff', fontFamily: F.display, fontSize: 15, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 20px rgba(26,110,255,.28)', transition: 'transform .14s ease, filter .14s ease' }}>
        <Icon name="bolt" size={16} stroke={2.4} />Unlock the full report
      </button>
      <p style={{ margin: 0, textAlign: 'center', fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
        Blurred sections show an example, not your analysis. Your own appears the moment you upgrade, including past sessions.
      </p>
    </section>
  );
}
UnlockBar.propTypes = { names: PropTypes.arrayOf(PropTypes.string).isRequired, voiceHot: PropTypes.bool };

// ═══════════════════════════════════════════════════════════════════════════════
// Next bar
// ═══════════════════════════════════════════════════════════════════════════════
function NextBar({ onNext, isLoading, isLast, showKeys }) {
  return (
    <div style={{ position: 'sticky', bottom: 12, zIndex: 4, marginTop: 4 }}>
      <button
        type="button"
        className="fb-next"
        onClick={onNext}
        disabled={isLoading}
        style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 'none', borderRadius: 16, padding: '0 20px', background: isLoading ? C.blue200 : `linear-gradient(135deg, ${C.blue800}, ${C.blue600} 55%, ${C.blue500})`, color: '#fff', fontFamily: F.display, fontSize: 16, fontWeight: 800, cursor: isLoading ? 'wait' : 'pointer', boxShadow: '0 8px 24px rgba(26,110,255,.32), 0 2px 6px rgba(0,31,107,.2)', transition: 'transform .14s ease, filter .14s ease, box-shadow .14s ease' }}
      >
        {isLoading ? (
          <><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', animation: 'fbSpin .8s linear infinite' }} />{isLast ? 'Preparing your report…' : 'Loading…'}</>
        ) : (
          <>{isLast ? 'See my results' : 'Next question'}<Icon name="arrow" size={19} stroke={2.4} /></>
        )}
        {!isLoading && showKeys && (
          <span aria-hidden="true" style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.26)', fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>Enter</span>
        )}
      </button>
    </div>
  );
}
NextBar.propTypes = { onNext: PropTypes.func.isRequired, isLoading: PropTypes.bool, isLast: PropTypes.bool, showKeys: PropTypes.bool };

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function FeedbackPanel({
  question, feedback = null, onNext, isLoading, isLast, userAnswerIndex = null, skipped = false,
  timeLimit = 0, previousScores = [], voiceMetrics = null, userAnswer = '', onRetry = null, isRetrying = false, showKeys = true, timeTaken: timeTakenProp = 0,
}) {
  const rootRef = useRef(null);
  const objective = ['mcq', 'aptitude'].includes(question?.questionType);
  const score = Number(feedback?.score) || 0;
  const correct = feedback?.correct === true;
  const aiOk = feedback?.aiAvailable !== false;
  const vm = voiceMetrics || feedback?.voiceMetrics || null;
  const basic = feedback?.tier === 'basic';
  const timeTaken = Number(timeTakenProp) || Number(feedback?.timeTaken) || 0;

  // On a single-column layout the feedback sits below the question, so bring it
  // into view. On desktop it is already beside the question, so leave the page still.
  useEffect(() => {
    if (window.innerWidth <= 1020) rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const { body, names, chips, voiceHot } = useMemo(() => {
    const out = { body: null, names: [], chips: [], voiceHot: false };

    // ── Skipped ──
    if (skipped) {
      if (objective) { out.body = <McqReview question={question} correct={false} userAnswerIndex={null} skipped />; return out; }
      const pending = feedback?.skippedPending && !feedback?.sampleAnswer;
      if (basic) {
        out.body = (
          <>
            <Notice tone="warn" icon="skip" title="You skipped this question">It scored 0. Here is how the model answer is laid out.</Notice>
            <CompareCard modelLocked teaser={feedback?.teasers?.modelAnswer} sample={SAMPLE_FEEDBACK} />
          </>
        );
        out.names = ['Model answer'];
        return out;
      }
      out.body = (
        <>
          <Notice tone="warn" icon="skip" title="You skipped this question">
            It scored 0. {pending ? 'The model answer is still being prepared and will be in your final report.' : 'Here is what a strong answer covers.'}
          </Notice>
          {!pending && <CompareCard sampleAnswer={feedback?.sampleAnswer} idealHint={feedback?.idealHint} defaultTab="model" />}
        </>
      );
      return out;
    }

    // ── Multiple choice / aptitude ──
    if (objective) { out.body = <McqReview question={question} correct={correct} userAnswerIndex={userAnswerIndex} />; return out; }

    // ── Evaluator was unavailable ──
    if (!aiOk) {
      out.body = (
        <Notice tone="warn" icon="alert" title="We couldn't evaluate this answer">
          Your answer was saved. Try again now, or continue to the next question.
          {onRetry && (
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={onRetry} disabled={isRetrying}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px', border: 'none', borderRadius: 11, background: C.amber, color: '#fff', fontFamily: F.body, fontSize: 14, fontWeight: 700, cursor: isRetrying ? 'wait' : 'pointer', opacity: isRetrying ? 0.7 : 1 }}>
                {isRetrying
                  ? <><span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', animation: 'fbSpin .8s linear infinite' }} />Trying again…</>
                  : <><Icon name="retry" size={16} />Try again</>}
              </button>
            </div>
          )}
        </Notice>
      );
      return out;
    }

    // ── FREE: same sections as Pro, Pro-only ones as labelled examples ──
    if (basic) {
      const lk = feedback?.locked || {};
      const teasers = feedback?.teasers || {};
      out.voiceHot = Boolean(vm) && Boolean(lk.delivery);
      const deepTabs = [
        lk.analysis && 'keywords',
        lk.analysis && isStarTopic(question?.topic) && 'structure',
        lk.analysis && 'confidence',
        lk.delivery && 'delivery',
      ].filter(Boolean);
      const hasReview = splitParts(feedback?.good).length || splitParts(feedback?.missing).length;

      out.chips = [
        lk.coaching && { id: 'fb-fix', label: 'Fix first', locked: true },
        hasReview && { id: 'fb-review', label: 'Review' },
        (lk.modelAnswer || userAnswer) && { id: 'fb-compare', label: 'Compare', locked: Boolean(lk.modelAnswer) },
        lk.analysis && { id: 'fb-follow', label: 'Follow-ups', locked: true },
        deepTabs.length > 0 && { id: 'fb-deep', label: 'Analysis', locked: true },
      ].filter(Boolean);
      out.names = [
        lk.coaching && 'Coaching',
        lk.modelAnswer && 'Model answer',
        lk.analysis && 'Follow-ups',
        lk.analysis && 'Deep analysis',
        lk.delivery && (vm ? 'Voice report' : 'Delivery'),
      ].filter(Boolean);

      out.body = (
        <>
          {lk.coaching && (
            <LockedSection id="fb-fix" feature="detailedFeedback" icon="lightbulb" hue="fix" title="Fix this first" sub="The single change that lifts this answer most" teaser={teasers.coaching} cta="Unlock coaching" hint="Your own coaching appears when you upgrade" height={96}>
              <FixFirstBody tip={SAMPLE_FEEDBACK.tip} />
            </LockedSection>
          )}
          <WorkedAndMissing good={feedback?.good} missing={feedback?.missing} />
          {(lk.modelAnswer || userAnswer) && (
            <CompareCard userAnswer={userAnswer} modelLocked={Boolean(lk.modelAnswer)} teaser={teasers.modelAnswer} sample={SAMPLE_FEEDBACK} />
          )}
          {lk.analysis && (
            <LockedSection id="fb-follow" feature="detailedFeedback" icon="help" hue="follow" title="Likely follow-ups" sub="Questions to be ready for" cta="Unlock follow-ups" height={150}>
              <FollowUpsBody questions={SAMPLE_FEEDBACK.followUpQuestions} interactive={false} />
            </LockedSection>
          )}
          {deepTabs.length > 0 && <DeepDiveCard feedback={SAMPLE_FEEDBACK} vm={SAMPLE_VOICE} tabs={deepTabs} locked voice={Boolean(vm)} />}
        </>
      );
      return out;
    }

    // ── PRO / trial: everything, real data ──
    const enrichPending = feedback?.enrichPending === true;
    const tabs = availableTabs(feedback, vm);
    const missed = safeArr((feedback?.keywordCoverage || feedback?.keywords)?.missed);
    const hasReview = splitParts(feedback?.good).length || splitParts(feedback?.missing).length;
    out.chips = [
      feedback?.tip?.trim() && { id: 'fb-fix', label: 'Fix first' },
      hasReview && { id: 'fb-review', label: 'Review' },
      (feedback?.sampleAnswer || userAnswer) && { id: 'fb-compare', label: 'Compare' },
      safeArr(feedback?.followUpQuestions).length > 0 && { id: 'fb-follow', label: 'Follow-ups' },
      tabs.length > 0 && { id: 'fb-deep', label: 'Analysis' },
    ].filter(Boolean);

    out.body = (
      <>
        <FixFirstCard tip={feedback?.tip} />
        <WorkedAndMissing good={feedback?.good} missing={feedback?.missing} />
        <CompareCard userAnswer={userAnswer} sampleAnswer={feedback?.sampleAnswer} idealHint={feedback?.idealHint} missed={missed} />
        {enrichPending && !feedback?.sampleAnswer && <PendingBlock label="Writing your model answer…" lines={2} />}
        {enrichPending && <PendingBlock label="Analysing keywords, structure and confidence…" lines={3} />}
        {feedback?.enrichFailed && !enrichPending && !feedback?.sampleAnswer && (
          <Notice tone="info" icon="info" title="Detailed breakdown unavailable">
            It couldn&apos;t be generated for this answer. Your score and feedback above are unaffected.
          </Notice>
        )}
        <FollowUpsCard questions={feedback?.followUpQuestions} />
        {tabs.length > 0 && <DeepDiveCard feedback={feedback} vm={vm} tabs={tabs} />}
      </>
    );
    return out;
  }, [skipped, objective, question, correct, userAnswerIndex, feedback, aiOk, basic, onRetry, isRetrying, userAnswer, vm]);

  return (
    <div ref={rootRef} className="fb-scroll fb-in" style={{ fontFamily: F.body, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{PANEL_CSS}</style>

      {!skipped && !objective && aiOk && (
        <div className="fb-sr" role="status">{`Score ${score} out of 100. ${verdict(score).label}.`}</div>
      )}

      {!skipped && (objective
        ? <McqHero correct={correct} question={question} userAnswerIndex={userAnswerIndex} timeTaken={timeTaken} timeLimit={timeLimit} />
        : aiOk && <ScoreHero score={score} timeTaken={timeTaken} timeLimit={timeLimit} previousScores={previousScores} feedback={feedback} basic={basic} />)}

      <JumpChips items={chips} rootRef={rootRef} />

      {body}

      {basic && !objective && <UnlockBar names={names} voiceHot={voiceHot} />}

      <NextBar onNext={onNext} isLoading={isLoading} isLast={isLast} showKeys={showKeys} />
    </div>
  );
}

FeedbackPanel.propTypes = {
  question:        PropTypes.object.isRequired,
  feedback:        PropTypes.object,
  onNext:          PropTypes.func.isRequired,
  isLoading:       PropTypes.bool.isRequired,
  isLast:          PropTypes.bool.isRequired,
  userAnswerIndex: PropTypes.number,
  skipped:         PropTypes.bool,
  timeLimit:       PropTypes.number,
  timeTaken:       PropTypes.number,
  previousScores:  PropTypes.arrayOf(PropTypes.number),
  voiceMetrics:    PropTypes.object,
  userAnswer:      PropTypes.string,
  onRetry:         PropTypes.func,
  isRetrying:      PropTypes.bool,
  showKeys:        PropTypes.bool,
  // Accepted for backward compatibility with older call sites; no longer used.
  questionIndex:   PropTypes.number,
  totalQuestions:  PropTypes.number,
};
export { FeedbackPanel };
export default FeedbackPanel;
