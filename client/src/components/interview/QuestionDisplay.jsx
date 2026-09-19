import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';

// ─── Local colour + font tokens ──────────────────────────────────────────────
const C = {
  ...CT,
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  questionPanel:      { minHeight: 380, padding: '22px 22px', display: 'flex', flexDirection: 'column', borderStyle: 'solid', borderWidth: 1, borderColor: C.border, borderRadius: 18, background: C.card, boxShadow: C.shadow },
  questionPanelTop:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 18 },
  questionLabel:      { fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.2px', color: C.blue500 },
  questionTags:       { display: 'flex', gap: 6, flexShrink: 0 },
  questionTagNeutral: { padding: '4px 10px', borderRadius: 999, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, background: C.cardAlt, color: C.sub, fontSize: 9.5, fontFamily: F.mono, letterSpacing: '0.4px', fontWeight: 700, textTransform: 'uppercase' },
  questionBody:       { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 4 },
  questionType:       { marginBottom: 10, color: C.muted, fontSize: 10.5, letterSpacing: '0.8px', fontWeight: 700, fontFamily: F.mono, textTransform: 'uppercase' },
  questionText:       { margin: 0, color: C.text, fontFamily: F.display, fontSize: 'clamp(16px, 2vw, 21px)', lineHeight: 1.65, fontWeight: 700, letterSpacing: '-0.2px' },
  questionHelp:       { display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 20, paddingTop: 14, borderTop: `1px solid ${C.border}`, color: C.sub, fontSize: 12.5, lineHeight: 1.62, fontWeight: 500 },
  kbdHint:            { marginTop: 14, fontSize: 11, color: C.faint, fontFamily: F.mono, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  kbd:                { display: 'inline-block', padding: '2px 7px', borderRadius: 5, borderStyle: 'solid', borderWidth: 1, borderColor: C.borderMd, borderBottomWidth: 2, background: C.cardAlt, color: C.sub, fontFamily: F.mono, fontSize: 10, fontWeight: 700, lineHeight: 1.4, verticalAlign: 'middle' },
};

// ─── PropTypes ───────────────────────────────────────────────────────────────
const questionDisplayPropTypes = {
  /** The full question object for the current question. */
  currentQuestion: PropTypes.shape({
    questionType: PropTypes.string.isRequired,
    text:         PropTypes.string.isRequired,
    topic:        PropTypes.string,
    options:      PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  /** 0-based index of the current question. */
  currentIndex: PropTypes.number.isRequired,
  /** Total number of questions in the session. */
  totalQuestions: PropTypes.number.isRequired,
  /** Resolved difficulty metadata (color, label, etc.) from difficultyMeta(). */
  currentDifficulty: PropTypes.shape({
    label:      PropTypes.string.isRequired,
    color:      PropTypes.string.isRequired,
    background: PropTypes.string.isRequired,
    border:     PropTypes.string.isRequired,
  }).isRequired,
  /** True when the current question is MCQ or aptitude. */
  isObjective: PropTypes.bool.isRequired,
  /** True after the user has submitted an answer. Hides the keyboard hint. */
  isSubmitted: PropTypes.bool.isRequired,
  /** Mode metadata object from MODE_META. Used for accent colour. */
  mode: PropTypes.shape({
    accent: PropTypes.string.isRequired,
  }).isRequired,
};

// ─── Component ───────────────────────────────────────────────────────────────
// Renders the left panel of the interview room: question text, type/difficulty
// tags, contextual help text, and the MCQ keyboard shortcut hint.
// The parent sets `key={`q-${questionKey}`}` on this component so React remounts
// it on every question change, which re-triggers the iv-question-slide animation.
function QuestionDisplay({
  currentQuestion,
  currentIndex,
  totalQuestions,
  currentDifficulty,
  isObjective,
  isSubmitted,
  mode,
}) {
  return (
    <section style={S.questionPanel} className="iv-question-slide iv-question-panel">

      {/* ── Top row: question counter + type/difficulty chips ── */}
      <div style={S.questionPanelTop}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={S.questionLabel}>Q{currentIndex + 1} of {totalQuestions}</span>
        </div>
        <div style={S.questionTags}>
          <span style={{
            background: currentDifficulty.background,
            color:      currentDifficulty.color,
            borderStyle: 'solid', borderWidth: 1, borderColor: currentDifficulty.border,
            padding: '4px 9px', borderRadius: 999,
            fontSize: 9, fontWeight: 700, fontFamily: F.mono, letterSpacing: '0.5px',
          }}>
            {currentDifficulty.label}
          </span>
          <span style={S.questionTagNeutral}>
            {currentQuestion.questionType === 'mcq'
              ? 'MCQ'
              : currentQuestion.questionType === 'aptitude'
                ? 'APTITUDE'
                : 'OPEN'}
          </span>
        </div>
      </div>

      {/* ── Main question body ── */}
      <div style={S.questionBody}>
        <div style={S.questionType}>
          {currentQuestion.topic
            ? currentQuestion.topic.toUpperCase()
            : currentQuestion.questionType === 'mcq'
              ? 'MULTIPLE CHOICE'
              : currentQuestion.questionType === 'aptitude'
                ? 'APTITUDE'
                : 'OPEN QUESTION'}
        </div>
        <h1 style={S.questionText} className="iv-question-text">
          {currentQuestion.text}
        </h1>
        <div style={S.questionHelp}>
          <span style={{ color: mode.accent, flexShrink: 0, fontSize: 14 }}>
            {currentQuestion.questionType === 'mcq'
              ? '🎯'
              : currentQuestion.questionType === 'aptitude'
                ? '🧮'
                : '💬'}
          </span>
          {currentQuestion.questionType === 'mcq'
            ? 'Only one option is correct — eliminate wrong ones first, then pick the strongest.'
            : currentQuestion.questionType === 'aptitude'
              ? 'Read carefully before calculating. Write your working if it helps.'
              : 'Start with a direct answer, then explain your reasoning with a short example.'}
        </div>
      </div>

      {/* ── MCQ keyboard shortcut hint (hidden after submission) ── */}
      {isObjective && !isSubmitted && (
        <div style={S.kbdHint}>
          Press <kbd style={S.kbd}>1</kbd>–<kbd style={S.kbd}>4</kbd> to pick,{' '}
          <kbd style={S.kbd}>Enter</kbd> to submit
        </div>
      )}

    </section>
  );
}

QuestionDisplay.propTypes = questionDisplayPropTypes;

// ─── Export ──────────────────────────────────────────────────────────────────
export default QuestionDisplay;