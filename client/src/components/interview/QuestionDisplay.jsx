import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';
import Icon from './icons';

const C = {
  ...CT,
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
};

const S = {
  panel:     { minHeight: 260, padding: '24px 24px 22px', display: 'flex', flexDirection: 'column', borderStyle: 'solid', borderWidth: 1, borderColor: C.border, borderRadius: 18, background: C.card, boxShadow: C.shadow },
  top:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 16 },
  topic:     { color: C.blue600, fontFamily: F.display, fontSize: 14, fontWeight: 800, letterSpacing: '-0.1px' },
  tags:      { display: 'flex', gap: 6, flexShrink: 0 },
  tag:       { padding: '4px 10px', borderRadius: 999, borderStyle: 'solid', borderWidth: 1, fontSize: 12, fontWeight: 700, fontFamily: F.body },
  text:      { margin: 0, color: C.text, fontFamily: F.display, fontSize: 'clamp(18px, 2vw, 23px)', lineHeight: 1.55, fontWeight: 700, letterSpacing: '-0.25px', maxWidth: '62ch' },
  help:      { marginTop: 'auto', paddingTop: 22 },
  helpBox:   { padding: '13px 15px', borderRadius: 13, background: C.cardAlt, border: `1px solid ${C.border}` },
  helpTitle: { display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 8px', color: C.sub, fontSize: 13, fontWeight: 700 },
  steps:     { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, margin: 0, padding: 0, listStyle: 'none' },
  step:      { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 6px', borderRadius: 999, background: '#fff', border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 600 },
  stepNum:   { width: 20, height: 20, borderRadius: '50%', background: C.blue50, color: C.blue700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.mono, fontSize: 11, fontWeight: 800 },
  helpText:  { margin: 0, color: C.sub, fontSize: 13.5, lineHeight: 1.6 },
  kbd:       { display: 'inline-block', padding: '1px 6px', borderRadius: 5, borderStyle: 'solid', borderWidth: 1, borderColor: C.borderMd, borderBottomWidth: 2, background: '#fff', color: C.sub, fontFamily: F.mono, fontSize: 11, fontWeight: 700, lineHeight: 1.4 },
};

// Behavioural questions (HR, STAR, resume) are answered with a different
// structure than technical ones, so the guidance follows the topic.
const BEHAVIOURAL = /behavio|hr\b|star|resume|situation|leadership|conflict|strength|weakness/i;

const TYPE_LABEL = { mcq: 'Multiple choice', aptitude: 'Aptitude', open: 'Written or spoken' };

const questionDisplayPropTypes = {
  currentQuestion: PropTypes.shape({
    questionType: PropTypes.string.isRequired,
    text:         PropTypes.string.isRequired,
    topic:        PropTypes.string,
    options:      PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  currentIndex:   PropTypes.number.isRequired,
  totalQuestions: PropTypes.number.isRequired,
  currentDifficulty: PropTypes.shape({
    label:      PropTypes.string.isRequired,
    color:      PropTypes.string.isRequired,
    background: PropTypes.string.isRequired,
    border:     PropTypes.string.isRequired,
  }).isRequired,
  isObjective: PropTypes.bool.isRequired,
  isSubmitted: PropTypes.bool.isRequired,
  mode: PropTypes.shape({ accent: PropTypes.string.isRequired }).isRequired,
  /** Show keyboard shortcut hints (hidden on touch devices). */
  showKeys: PropTypes.bool,
};

// Left panel of the interview room. The question is the focus: the counter and
// timer already live in the console above, so they are not repeated here.
// The parent sets `key` on this component so React remounts it on every
// question change, which re-triggers the slide-in animation.
function QuestionDisplay({ currentQuestion, currentDifficulty, isObjective, isSubmitted, showKeys = true }) {
  const type      = currentQuestion.questionType;
  const structure = !isObjective && BEHAVIOURAL.test(currentQuestion.topic || '')
    ? ['Situation', 'Task', 'Action', 'Result']
    : !isObjective
      ? ['Answer directly', 'Explain why', 'Give an example']
      : null;

  return (
    <section style={S.panel} className="iv-question-slide iv-question-panel" aria-label="Question">
      <div style={S.top}>
        <span style={S.topic}>{currentQuestion.topic || TYPE_LABEL[type] || 'Question'}</span>
        <div style={S.tags}>
          <span style={{ ...S.tag, background: currentDifficulty.background, color: currentDifficulty.color, borderColor: currentDifficulty.border }}>
            {currentDifficulty.label}
          </span>
          <span style={{ ...S.tag, background: C.cardAlt, color: C.sub, borderColor: C.border }}>
            {TYPE_LABEL[type] || 'Written or spoken'}
          </span>
        </div>
      </div>

      <h1 style={S.text} className="iv-question-text">{currentQuestion.text}</h1>

      {!isSubmitted && (
        <div style={S.help}>
          <div style={S.helpBox}>
            {structure ? (
              <>
                <p style={S.helpTitle}>
                  <Icon name="lightbulb" size={15} style={{ color: C.blue500 }} />
                  {structure.length === 4 ? 'Structure it as STAR' : 'A structure that works'}
                </p>
                <ol style={S.steps}>
                  {structure.map((s, i) => (
                    <li key={s} style={S.step}>
                      <span style={S.stepNum}>{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <>
                <p style={S.helpTitle}>
                  <Icon name="lightbulb" size={15} style={{ color: C.blue500 }} />
                  {type === 'aptitude' ? 'Work it out first' : 'Rule out, then choose'}
                </p>
                <p style={S.helpText}>
                  {type === 'aptitude'
                    ? 'Read the whole question, solve it on paper, then match your result to an option.'
                    : 'Strike out the options you know are wrong, then pick the strongest of what is left.'}
                  {showKeys && (
                    <>
                      {' '}Press <kbd style={S.kbd}>1</kbd>–<kbd style={S.kbd}>4</kbd> or <kbd style={S.kbd}>A</kbd>–<kbd style={S.kbd}>D</kbd> to choose.
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

QuestionDisplay.propTypes = questionDisplayPropTypes;
export default QuestionDisplay;
