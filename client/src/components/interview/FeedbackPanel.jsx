import PropTypes from 'prop-types';
import { useState } from 'react';
import { C as CT, F } from '../../styles/token';


const C = {
  ...CT,
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
};


const S = {
  feedback:       { display: 'flex', flexDirection: 'column', gap: 10 },
  fbScoreStrip:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderRadius: 14, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, marginBottom: 2, flexWrap: 'wrap' },
  fbScoreLeft:    { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  fbScoreEmoji:   { fontSize: 24, lineHeight: 1, flexShrink: 0 },
  fbScoreLabel:   { fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 3 },
  fbScoreVibe:    { fontSize: 12, color: C.sub, lineHeight: 1.4, fontWeight: 500 },
  fbScoreRight:   { display: 'flex', alignItems: 'baseline', gap: 3 },
  fbScoreNum:     { fontFamily: F.display, fontSize: 42, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 },
  fbScoreOutOf:   { fontFamily: F.mono, fontSize: 14, color: C.muted, fontWeight: 600 },
  fbBarWrap:      { marginBottom: 4 },
  fbBarTrack:     { height: 8, borderRadius: 999, background: C.border, overflow: 'hidden', position: 'relative' },
  fbBarFill:      { height: '100%', borderRadius: 999, transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)' },
  fbBarTicks:     { position: 'relative', height: 0 },
  fbBarTick:      { position: 'absolute', top: -8, width: 1, height: 8, background: 'rgba(255,255,255,0.5)', pointerEvents: 'none' },
  fbBlockHeader:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 },
  fbBlockTitle:   { fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase' },
  fbBulletRow:    { display: 'flex', alignItems: 'flex-start', gap: 9 },
  fbBulletDot:    { width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 7 },
  fbBulletText:   { fontSize: 12.5, lineHeight: 1.6, color: C.sub, flex: 1 },
  fbSampleWrap:   { marginBottom: 2, borderRadius: 13, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  fbSampleToggle: { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: C.cardAlt, border: 'none', cursor: 'pointer', fontFamily: F.body, fontSize: 13, fontWeight: 700, color: C.sub, textAlign: 'left', transition: 'background 0.15s ease' },
  fbSampleBadge:  { marginLeft: 'auto', fontSize: 9.5, fontFamily: F.mono, fontWeight: 700, letterSpacing: '0.4px', color: C.faint, textTransform: 'uppercase', flexShrink: 0 },
  fbSampleBody:   { padding: '12px 14px 16px', background: C.card, display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${C.border}` },
  fbSamplePoint:  { display: 'flex', alignItems: 'flex-start', gap: 10 },
  fbSampleDot:    { width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.mono, fontWeight: 800, fontSize: 9 },
  fbSampleText:   { fontSize: 13.5, lineHeight: 1.7, color: C.text, fontWeight: 500 },
  nextBtn:        { width: '100%', border: 'none', borderRadius: 13, padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', fontFamily: F.display, fontSize: 14.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(26,110,255,0.28)', letterSpacing: '-0.1px', transition: 'box-shadow 0.18s ease, transform 0.12s ease' },
  nextBtnHint:    { marginTop: 8, textAlign: 'center', fontSize: 11, color: C.faint, fontFamily: F.mono, letterSpacing: '0.2px' },
  kbd:            { display: 'inline-block', padding: '2px 7px', borderRadius: 5, borderStyle: 'solid', borderWidth: 1, borderColor: C.borderMd, borderBottomWidth: 2, background: C.cardAlt, color: C.sub, fontFamily: F.mono, fontSize: 10, fontWeight: 700, lineHeight: 1.4, verticalAlign: 'middle' },
  spinner:        { width: 13, height: 13, borderRadius: '50%', borderStyle: 'solid', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'ivSpin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },
  btnDisabled:    { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none', transform: 'none' },
  mcqWrap:          { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 },
  mcqExplainWrap:   { borderRadius: 13, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, background: C.blue50, overflow: 'hidden' },
  mcqExplainHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: C.blue50 },
  mcqExplainIcon:   { fontSize: 14, flexShrink: 0 },
  mcqExplainTitle:  { fontSize: 11, fontWeight: 800, fontFamily: F.mono, color: C.blue600, letterSpacing: '0.4px', textTransform: 'uppercase' },
  mcqExplainBody:   { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: C.card },
  mcqExplainText:   { fontSize: 13, lineHeight: 1.65, color: C.sub, fontWeight: 500 },
  mcqNoExplain:     { fontSize: 13, color: C.muted, padding: '12px 14px', borderRadius: 12, background: C.cardAlt, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, fontWeight: 500 },
  mcqOptionsWrap:   { borderRadius: 14, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  mcqOptionsLabel:  { display: 'block', fontSize: 9.5, fontWeight: 800, fontFamily: F.mono, letterSpacing: '0.7px', color: C.muted, textTransform: 'uppercase', padding: '9px 14px 7px', borderBottom: `1px solid ${C.border}`, background: C.cardAlt },
  mcqOptionsList:   { display: 'flex', flexDirection: 'column' },
  mcqOption:        { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderStyle: 'solid', borderWidth: 1, borderColor: C.border, borderRadius: 0 },
  mcqOptionBullet:  { width: 22, height: 22, borderRadius: 6, borderStyle: 'solid', borderWidth: 1.5, borderColor: 'currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: F.mono, flexShrink: 0 },
  mcqOptionText:    { fontSize: 13, flex: 1, lineHeight: 1.5, fontWeight: 500 },
  mcqOptionBadge:   { fontSize: 9, fontWeight: 800, fontFamily: F.mono, letterSpacing: '0.3px', padding: '2px 8px', borderRadius: 999, borderStyle: 'solid', borderWidth: 1, flexShrink: 0, textTransform: 'uppercase' },
};


const splitToBullets = (text = '') => {
  if (!text) return [];
  const numberedSplit = text.split(/(?<!\d)\d+\.\s+/).map(s => s.trim()).filter(Boolean);
  if (numberedSplit.length > 1) return numberedSplit;
  const sentences = text.replace(/([.!?])\s+/g, '$1|||').split('|||').map(s => s.trim()).filter(Boolean);
  return sentences.length <= 1 ? [text.trim()] : sentences;
};

const scoreConfig = (score) => {
  if (score >= 90) return { color: C.green,   bg: C.greenTint,  barGradient: `linear-gradient(90deg, #059669, #10b981)`,           emoji: '🏆', label: 'Excellent',  vibe: "Outstanding. That's interview-ready."                         };
  if (score >= 75) return { color: C.green,   bg: C.greenTint,  barGradient: `linear-gradient(90deg, #059669, #10b981)`,           emoji: '🔥', label: 'Strong',     vibe: 'Really solid. You clearly know this.'                         };
  if (score >= 60) return { color: C.blue500, bg: C.blue50,     barGradient: `linear-gradient(90deg, ${C.blue600}, ${C.blue400})`, emoji: '👍', label: 'Good',       vibe: 'Good base — a bit more depth and this is interview-ready.'    };
  if (score >= 40) return { color: C.amber,   bg: C.amberTint,  barGradient: `linear-gradient(90deg, #b45309, ${C.amber})`,        emoji: '📝', label: 'Developing', vibe: "You're on the right track. A few key points are missing."    };
  return               { color: C.red,     bg: C.redTint,    barGradient: `linear-gradient(90deg, #b91c1c, ${C.red})`,          emoji: '📈', label: 'Needs work', vibe: "Don't worry — this is exactly why you practice."             };
};

// ─── Internal: FeedbackBlock ─────────────────────────────────────────────────
// Renders a coloured card with a title, icon, and bullet list of feedback points.

const feedbackBlockPropTypes = {
  icon:    PropTypes.string.isRequired,
  title:   PropTypes.string.isRequired,
  bullets: PropTypes.arrayOf(PropTypes.string),
  color:   PropTypes.string.isRequired,
  bg:      PropTypes.string.isRequired,
  size:    PropTypes.oneOf(['full', 'half']),
};

function FeedbackBlock({ icon, title, bullets, color, bg, size }) {
  const isHalf     = size === 'half';
  const hasContent = bullets?.length > 0;
  if (!hasContent && size === 'full' && title === 'What worked') return null;

  return (
    <div style={{ padding: isHalf ? '11px 13px' : '13px 16px', background: bg, borderRadius: 13, borderStyle: 'solid', borderWidth: 1, borderColor: `${color}28`, borderLeftStyle: 'solid', borderLeftWidth: 3, borderLeftColor: `${color}70`, display: 'flex', flexDirection: 'column', gap: isHalf ? 7 : 10 }}>
      <div style={S.fbBlockHeader}>
        <span style={{ width: isHalf ? 22 : 26, height: isHalf ? 22 : 26, borderRadius: isHalf ? 6 : 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isHalf ? 11 : 13, flexShrink: 0 }}>{icon}</span>
        <span style={{ ...S.fbBlockTitle, color, fontSize: isHalf ? 10 : 11 }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isHalf ? 5 : 7 }}>
        {(hasContent ? bullets : ['No additional feedback.']).map((pt, i) => (
          <div key={i} style={S.fbBulletRow}>
            <span style={{ ...S.fbBulletDot, background: color, width: isHalf ? 4 : 5, height: isHalf ? 4 : 5, marginTop: isHalf ? 7 : 6 }} />
            <span style={{ ...S.fbBulletText, fontSize: isHalf ? 12 : 12.5, lineHeight: isHalf ? 1.5 : 1.6 }}>{pt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

FeedbackBlock.propTypes = feedbackBlockPropTypes;
FeedbackBlock.defaultProps = { bullets: [], size: 'full' };

// ─── Internal: McqExplanation ─────────────────────────────────────────────────
// Shows the correct answer, user's answer, explanation text, and full option
// list after an MCQ or aptitude question is submitted (or skipped).

const mcqExplanationPropTypes = {
  question:        PropTypes.object.isRequired,
  correct:         PropTypes.bool.isRequired,
  userAnswerIndex: PropTypes.number,
  skipped:         PropTypes.bool,
};

function McqExplanation({ question, correct, userAnswerIndex, skipped }) {
  const correctIndex = question?.correctAnswerIndex;
  const correctText  = correctIndex != null ? question?.options?.[correctIndex] : null;
  const userIndex    = userAnswerIndex ?? null;
  const userText     = userIndex    != null ? question?.options?.[userIndex]    : null;
  const explanation  = question?.explanation || '';

  if (skipped) {
    return (
      <div style={S.mcqWrap}>
        {correctText ? (
          <div style={{ padding: '16px 18px', borderRadius: 14, borderStyle: 'solid', borderWidth: 2, borderColor: `${C.amber}50`, background: C.amberTint }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: `${C.amber}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⏭</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.amber, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Correct answer · not attempted</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: C.amber, background: `${C.amber}20`, borderStyle: 'solid', borderWidth: 1, borderColor: `${C.amber}40`, borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>Remember this</span>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: C.amber, lineHeight: 1.45, paddingLeft: 38 }}>{correctText}</div>
          </div>
        ) : (
          <div style={{ padding: '14px 16px', borderRadius: 12, background: C.cardAlt, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, fontSize: 12, color: C.muted, textAlign: 'center' }}>
            Correct answer unavailable for this question.
          </div>
        )}
        {explanation && (
          <div style={S.mcqExplainWrap}>
            <div style={S.mcqExplainHeader}>
              <span style={S.mcqExplainIcon}>💡</span>
              <span style={S.mcqExplainTitle}>Why this is the answer</span>
            </div>
            <div style={S.mcqExplainBody}>
              {splitToBullets(explanation).map((pt, i) => (
                <div key={i} style={S.fbBulletRow}>
                  <span style={{ ...S.fbBulletDot, background: C.blue500, marginTop: 7 }} />
                  <span style={S.mcqExplainText}>{pt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={S.mcqWrap}>
      <div style={{ display: 'flex', flexDirection: correct ? 'row' : 'column', gap: correct ? 10 : 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 14, borderStyle: 'solid', borderWidth: 1.5, borderColor: correct ? `${C.green}50` : `${C.red}50`, background: correct ? C.greenTint : C.redTint, flex: correct ? 1 : 'unset', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: correct ? `${C.green}20` : `${C.red}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
              {correct ? '✅' : '❌'}
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: correct ? C.green : C.red, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {correct ? 'Your answer · Correct!' : 'Your answer · Incorrect'}
            </span>
          </div>
          <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 600, color: correct ? C.green : C.red, lineHeight: 1.45, paddingLeft: 34 }}>
            {userText || 'No option selected'}
          </div>
        </div>

        {!correct && correctText && (
          <div style={{ padding: '14px 18px', borderRadius: 14, borderStyle: 'solid', borderWidth: 2, borderColor: `${C.green}55`, background: C.greenTint, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: `${C.green}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.green, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Correct answer</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: `${C.green}18`, borderStyle: 'solid', borderWidth: 1, borderColor: `${C.green}35`, borderRadius: 6, padding: '3px 9px' }}>Remember this</span>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: C.green, lineHeight: 1.45, paddingLeft: 34 }}>{correctText}</div>
          </div>
        )}
      </div>

      {explanation ? (
        <div style={S.mcqExplainWrap}>
          <div style={S.mcqExplainHeader}>
            <span style={S.mcqExplainIcon}>💡</span>
            <span style={S.mcqExplainTitle}>Why this is the answer</span>
          </div>
          <div style={S.mcqExplainBody}>
            {splitToBullets(explanation).map((pt, i) => (
              <div key={i} style={S.fbBulletRow}>
                <span style={{ ...S.fbBulletDot, background: C.blue500, marginTop: 7 }} />
                <span style={S.mcqExplainText}>{pt}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={S.mcqNoExplain}>
          {correct ? '🎯 Great recall — on to the next one.' : '📖 Review this topic before your next session.'}
        </div>
      )}

      {question?.options?.length > 0 && (
        <div style={S.mcqOptionsWrap}>
          <span style={S.mcqOptionsLabel}>All options at a glance</span>
          <div style={S.mcqOptionsList}>
            {question.options.map((opt, i) => {
              const isCorrect = i === correctIndex;
              const isUser    = i === userIndex;
              const bg  = isCorrect ? C.greenTint : isUser && !correct ? C.redTint : C.cardAlt;
              const col = isCorrect ? C.green     : isUser && !correct ? C.red     : C.muted;
              const bw  = isCorrect || (isUser && !correct) ? 1.5 : 1;
              const bc  = isCorrect ? `${C.green}40` : isUser && !correct ? `${C.red}30` : C.border;
              return (
                <div key={i} style={{ ...S.mcqOption, background: bg, borderStyle: 'solid', borderWidth: bw, borderColor: bc }} className="iv-mcq-option">
                  <span style={{ ...S.mcqOptionBullet, color: col, borderStyle: 'solid', borderWidth: 1.5, borderColor: `${col}40`, background: isCorrect || isUser ? `${col}15` : 'transparent', fontWeight: isCorrect ? 800 : 600 }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span style={{ ...S.mcqOptionText, color: col, fontWeight: isCorrect ? 600 : 400 }}>{opt}</span>
                  {isCorrect && !isUser    && <span style={{ ...S.mcqOptionBadge, color: C.green, background: `${C.green}15`, borderColor: `${C.green}30` }}>✓ correct</span>}
                  {isCorrect &&  isUser    && <span style={{ ...S.mcqOptionBadge, color: C.green, background: `${C.green}15`, borderColor: `${C.green}30` }}>✓ your pick</span>}
                  {isUser    && !isCorrect && <span style={{ ...S.mcqOptionBadge, color: C.red,   background: `${C.red}12`,   borderColor: `${C.red}25`   }}>your pick</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

McqExplanation.propTypes = mcqExplanationPropTypes;
McqExplanation.defaultProps = { userAnswerIndex: null, skipped: false };

// ─── PropTypes ───────────────────────────────────────────────────────────────
const feedbackPanelPropTypes = {
  /** The full question object for the answered question. */
  question: PropTypes.object.isRequired,
  /** AI-generated feedback object. Null while loading. */
  feedback: PropTypes.object,
  /** Advances to the next question (or navigates to results on the last). */
  onNext: PropTypes.func.isRequired,
  /** True while the next question or results page is loading. */
  isLoading: PropTypes.bool.isRequired,
  /** True when this feedback is for the final question in the session. */
  isLast: PropTypes.bool.isRequired,
  /** Hex accent colour from the current session mode (used for the Next button). */
  accent: PropTypes.string.isRequired,
  /** Index of the option the user picked (null for open questions or skips). */
  userAnswerIndex: PropTypes.number,
  /** True when the user hit Skip rather than submitting an answer. */
  skipped: PropTypes.bool,
  /** 0-based index of this question within the session. */
  questionIndex: PropTypes.number,
  /** Total number of questions in the session. */
  totalQuestions: PropTypes.number,
};

// ─── Component ───────────────────────────────────────────────────────────────
// Renders the post-submission panel inside the answer section:
//   • Score strip + animated score bar (open questions)
//   • Good / Missing / Key idea / Next move feedback blocks
//   • MCQ correct/incorrect breakdown with explanation
//   • Collapsible model answer
//   • Next question / View results button
function FeedbackPanel({
  question,
  feedback,
  onNext,
  isLoading,
  isLast,
  accent,
  userAnswerIndex,
  skipped,
  questionIndex,
  totalQuestions,
}) {
  const [showSample, setShowSample] = useState(false);

  const score     = Number(feedback?.score) || 0;
  const objective = ['mcq', 'aptitude'].includes(question?.questionType);
  const correct   = feedback?.correct === true;
  const cfg       = scoreConfig(score);
  const objColor  = correct ? C.green : C.red;
  const objBg     = correct ? C.greenTint : C.redTint;
  const objEmoji  = correct ? '✅' : '❌';
  const objVibe   = correct
    ? 'Nailed it. On to the next one.'
    : 'Scroll down — the correct answer and explanation are right below.';

  // ── Skipped variant ───────────────────────────────────────────────────────
  if (skipped) {
    const hint   = feedback?.idealHint  || '';
    const sample = feedback?.sampleAnswer || '';
    return (
      <div style={S.feedback} className="iv-fade-in">
        <div style={{ ...S.fbScoreStrip, background: C.cardAlt, borderStyle: 'solid', borderWidth: 1, borderColor: C.border }}>
          <div style={S.fbScoreLeft}>
            <span style={S.fbScoreEmoji}>⏭</span>
            <div>
              <div style={{ ...S.fbScoreLabel, color: C.sub }}>Question skipped</div>
              <div style={S.fbScoreVibe}>No answer was scored — here's what a strong one looks like.</div>
            </div>
          </div>
        </div>

        {objective ? (
          <McqExplanation question={question} correct={false} userAnswerIndex={null} skipped />
        ) : (hint || sample) ? (
          <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', background: C.card }}>
            {hint && (
              <div style={{ padding: '14px 18px', background: C.blue50, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>💡</span>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.blue600, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 3 }}>
                    What this question is really testing
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.5 }}>{hint}</div>
                </div>
              </div>
            )}
            {sample && (
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Model answer</span>
                  <span style={{ flex: 1, height: 1, background: C.border }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {splitToBullets(sample).map((pt, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, background: `linear-gradient(135deg, ${C.blue500}, ${C.cyan500 || C.blue600})`, color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: F.mono, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.7, color: C.text, paddingTop: 1 }}>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '14px 16px', borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, textAlign: 'center' }}>
            No model answer available for this question.
          </div>
        )}

        <div className="iv-next-btn-wrap" style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <button
            type="button"
            style={{ ...S.nextBtn, background: `linear-gradient(135deg, ${C.blue700}, ${accent})`, ...(isLoading ? S.btnDisabled : {}) }}
            className="iv-next-btn"
            onClick={onNext}
            disabled={isLoading}
          >
            {isLoading
              ? <><span style={S.spinner} />{isLast ? 'Preparing your report…' : 'Preparing…'}</>
              : isLast ? 'View your results →' : 'Next question →'}
          </button>
          <div style={S.nextBtnHint}>Press <kbd style={S.kbd}>Enter</kbd> to continue</div>
        </div>
      </div>
    );
  }

  // ── Answered variant ──────────────────────────────────────────────────────
  return (
    <div style={S.feedback} className="iv-fade-in">

      {/* ── Score strip ── */}
      <div style={{ ...S.fbScoreStrip, background: objective ? objBg : cfg.bg, borderStyle: 'solid', borderWidth: 1, borderColor: `${objective ? objColor : cfg.color}28` }}>
        <div style={S.fbScoreLeft}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: objective ? objColor : cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: `0 4px 12px ${(objective ? objColor : cfg.color)}40` }}>
            {objective ? objEmoji : cfg.emoji}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...S.fbScoreLabel, color: objective ? objColor : cfg.color }}>
              {objective ? (correct ? 'Correct answer' : 'Wrong answer') : cfg.label}
            </div>
            <div style={S.fbScoreVibe}>{objective ? objVibe : cfg.vibe}</div>
          </div>
        </div>
        {!objective && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
            <div style={S.fbScoreRight}>
              <div style={{ ...S.fbScoreNum, color: cfg.color }} className="iv-fb-score-num">{score}</div>
              <div style={S.fbScoreOutOf}>/100</div>
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.faint, letterSpacing: '0.2px', textAlign: 'right' }}>
              {feedback?.timeTaken > 0 ? `${feedback.timeTaken}s · ` : ''}Q{questionIndex + 1}/{totalQuestions}
            </span>
          </div>
        )}
      </div>

      {/* ── Score bar (open questions only) ── */}
      {!objective && (
        <div style={S.fbBarWrap}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: '0.4px' }}>SCORE</span>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: cfg.color, fontWeight: 700 }}>
              {score >= 90 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Developing' : 'Needs work'}
            </span>
          </div>
          <div style={S.fbBarTrack}>
            <div style={{ ...S.fbBarFill, width: `${score}%`, background: cfg.barGradient }} className="iv-fb-bar" />
          </div>
          <div style={S.fbBarTicks}>
            {[25, 50, 75].map(t => <div key={t} style={{ ...S.fbBarTick, left: `${t}%` }} />)}
          </div>
        </div>
      )}

      {/* ── Feedback blocks (open) or MCQ explanation ── */}
      {!objective ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }} className="iv-feedback-grid">
          {feedback?.good && splitToBullets(feedback.good).length > 0 && (
            <FeedbackBlock icon="✅" title="What worked"     bullets={splitToBullets(feedback.good)}    color={C.green} bg={C.greenTint} size="full" />
          )}
          <FeedbackBlock icon="🔍" title="What was missing" bullets={splitToBullets(feedback?.missing)} color={C.red}   bg={C.redTint}   size="full" />
          {(feedback?.idealHint || feedback?.tip) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="iv-fb-secondary">
              {feedback?.idealHint && <FeedbackBlock icon="💡" title="Key idea"  bullets={splitToBullets(feedback.idealHint)} color={C.blue500} bg={C.blue50}    size="half" />}
              {feedback?.tip       && <FeedbackBlock icon="🎯" title="Next move" bullets={splitToBullets(feedback.tip)}       color={C.amber}   bg={C.amberTint} size="half" />}
            </div>
          )}
        </div>
      ) : (
        <McqExplanation question={question} correct={correct} userAnswerIndex={userAnswerIndex} />
      )}

      {/* ── Collapsible model answer (open questions only) ── */}
      {!objective && feedback?.sampleAnswer && (
        <div style={S.fbSampleWrap}>
          <button type="button" style={S.fbSampleToggle} className="iv-fb-sample-toggle" onClick={() => setShowSample(v => !v)}>
            <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: showSample ? C.blue500 : C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: showSample ? '#fff' : C.muted, fontWeight: 800, transition: 'all 0.18s ease' }}>
              {showSample ? '▾' : '▸'}
            </span>
            {showSample ? 'Hide ideal answer' : 'See a model answer'}
            <span style={S.fbSampleBadge}>see how a top answer reads</span>
          </button>
          {showSample && (
            <div style={S.fbSampleBody} className="iv-fade-in">
              <div style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
                What a strong answer covers
              </div>
              {splitToBullets(feedback.sampleAnswer).map((pt, i) => (
                <div key={i} style={S.fbSamplePoint}>
                  <span style={{ ...S.fbSampleDot, background: `linear-gradient(135deg, ${C.blue500}, ${C.blue600})`, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ ...S.fbSampleText, fontSize: 13, lineHeight: 1.7 }}>{pt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Next / Results button ── */}
      <div className="iv-next-btn-wrap" style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <button
          type="button"
          style={{ ...S.nextBtn, background: `linear-gradient(135deg, ${C.blue700}, ${accent})`, ...(isLoading ? S.btnDisabled : {}) }}
          className="iv-next-btn"
          onClick={onNext}
          disabled={isLoading}
        >
          {isLoading
            ? <><span style={S.spinner} />{isLast ? 'Preparing your report…' : 'Preparing…'}</>
            : isLast ? '🏁 View my results' : 'Next question →'}
        </button>
        <div style={S.nextBtnHint}>Press <kbd style={S.kbd}>Enter</kbd> to continue</div>
      </div>

    </div>
  );
}

FeedbackPanel.propTypes = feedbackPanelPropTypes;

FeedbackPanel.defaultProps = {
  feedback:        null,
  userAnswerIndex: null,
  skipped:         false,
  questionIndex:   0,
  totalQuestions:  1,
};

export default FeedbackPanel;