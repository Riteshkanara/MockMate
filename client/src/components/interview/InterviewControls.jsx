import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { C as CT, F } from '../../styles/token';
import MicButton, { DeliveryCard, VoiceStatusStrip } from './MicButton';
import Icon from './icons';

const C = {
  ...CT,
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
};

// Guidance range for a written/spoken answer. Under the floor an answer rarely
// has room for reasoning plus an example; past the ceiling it usually rambles.
const WORDS_MIN  = 40;
const WORDS_MAX  = 150;
const WORDS_FAIL = 8;   // matches MIN_ANSWER_WORDS in Interview.jsx

const lengthStatus = (words) => {
  if (words === 0)           return { text: '',                                            tone: 'idle' };
  if (words < WORDS_FAIL)    return { text: 'Too short to score well',                     tone: 'warn' };
  if (words < WORDS_MIN)     return { text: 'Add your reasoning or an example',            tone: 'info' };
  if (words <= WORDS_MAX)    return { text: 'Good length',                                 tone: 'good' };
  return                            { text: 'Long. Make every sentence earn its place',    tone: 'warn' };
};

const TONE = {
  idle: { color: C.faint,  bar: C.border },
  info: { color: C.blue600, bar: C.blue400 },
  good: { color: C.green,  bar: C.green },
  warn: { color: C.amber,  bar: C.amber },
};

const S = {
  head:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, minHeight: 40 },
  title:      { margin: 0, color: C.text, fontFamily: F.display, fontSize: 17, fontWeight: 800, letterSpacing: '-0.25px' },
  answerBox:  { flex: 1, width: '100%', minHeight: 230, resize: 'vertical', borderStyle: 'solid', borderWidth: 1.5, borderColor: C.border, borderRadius: 13, background: '#FFFFFF', color: C.text, padding: '15px 16px', outline: 'none', fontFamily: F.body, fontSize: 15, lineHeight: 1.7 },
  meter:      { marginTop: 10 },
  meterRow:   { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 7, flexWrap: 'wrap' },
  meterCount: { fontFamily: F.mono, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  meterText:  { fontSize: 13, fontWeight: 600 },
  meterTrack: { position: 'relative', height: 5, borderRadius: 999, background: C.border, overflow: 'hidden' },
  meterBand:  { position: 'absolute', top: 0, bottom: 0, background: `${C.green}26` },
  options:    { display: 'flex', flexDirection: 'column', gap: 10, flex: 1 },
  opt:        { display: 'flex', alignItems: 'stretch', borderStyle: 'solid', borderWidth: 1.5, borderColor: C.border, borderRadius: 14, background: C.card, overflow: 'hidden' },
  optMain:    { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 13, minHeight: 58, padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: C.text },
  optLetter:  { width: 32, height: 32, borderRadius: 9, borderStyle: 'solid', borderWidth: 1.5, borderColor: C.borderMd, background: C.cardAlt, color: C.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: F.mono, fontSize: 13, fontWeight: 800 },
  optText:    { flex: 1, fontFamily: F.body, fontSize: 15, lineHeight: 1.5, fontWeight: 500 },
  optStrike:  { width: 46, flexShrink: 0, border: 'none', borderLeft: `1px solid ${C.border}`, background: 'transparent', color: C.faint, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  footer:     { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` },
  hint:       { color: C.muted, fontSize: 13, lineHeight: 1.5 },
  actions:    { display: 'flex', gap: 10, alignItems: 'stretch' },
  skipBtn:    { borderStyle: 'solid', borderWidth: 1.5, borderColor: C.border, background: C.card, borderRadius: 12, padding: '0 18px', minHeight: 50, color: C.muted, cursor: 'pointer', fontFamily: F.body, fontSize: 14, fontWeight: 700, flexShrink: 0 },
  submitBtn:  { flex: 1, minHeight: 50, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 12, padding: '0 22px', background: `linear-gradient(135deg, ${C.blue700}, ${C.blue500})`, color: '#fff', boxShadow: '0 6px 20px rgba(26,110,255,0.28)', cursor: 'pointer', fontFamily: F.display, fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' },
  btnDisabled:{ opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' },
  notice:     { display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 13px', borderRadius: 11, fontSize: 13.5, lineHeight: 1.5 },
  kbd:        { display: 'inline-block', padding: '1px 6px', borderRadius: 5, borderStyle: 'solid', borderWidth: 1, borderColor: C.borderMd, borderBottomWidth: 2, background: C.cardAlt, color: C.sub, fontFamily: F.mono, fontSize: 11, fontWeight: 700, lineHeight: 1.4 },
};

const interviewControlsPropTypes = {
  currentQuestion:     PropTypes.shape({ id: PropTypes.string, options: PropTypes.arrayOf(PropTypes.string) }).isRequired,
  isObjective:         PropTypes.bool.isRequired,
  selectedAnswerIndex: PropTypes.number,
  textAnswer:          PropTypes.string.isRequired,
  onTextChange:        PropTypes.func.isRequired,
  onSelectAnswer:      PropTypes.func.isRequired,
  canSubmit:           PropTypes.bool.isRequired,
  isLoading:           PropTypes.bool.isRequired,
  isEvaluating:        PropTypes.bool,
  isTranscribing:      PropTypes.bool,
  isLastQuestion:      PropTypes.bool.isRequired,
  shortSubmitPending:  PropTypes.bool.isRequired,
  wordCount:           PropTypes.number.isRequired,
  onSkip:              PropTypes.func.isRequired,
  // Optional: while an open answer is being scored, Skip becomes "Stop".
  onStopSubmit:        PropTypes.func,
  onSubmit:            PropTypes.func.isRequired,
  textAreaRef:         PropTypes.shape({ current: PropTypes.any }),
  mode:                PropTypes.shape({ accent: PropTypes.string.isRequired, soft: PropTypes.string.isRequired }).isRequired,
  showKeys:            PropTypes.bool,
  // Voice props (all optional, the feature degrades gracefully)
  isRecording:            PropTypes.bool,
  isVoiceSupported:       PropTypes.bool,
  voiceUnsupportedReason: PropTypes.oneOf(['ios', 'browser', null]),
  voiceMetrics:           PropTypes.object,
  voiceError:             PropTypes.string,
  isVoiceSilent:          PropTypes.bool,
  onMicStart:             PropTypes.func,
  onMicStop:              PropTypes.func,
  onDismissVoiceError:    PropTypes.func,
};

function InterviewControls({
  currentQuestion, isObjective, selectedAnswerIndex = null, textAnswer, onTextChange, onSelectAnswer,
  canSubmit, isLoading, isEvaluating = false, isTranscribing = false, isLastQuestion, shortSubmitPending, wordCount,
  onSkip, onStopSubmit, onSubmit, textAreaRef = null, mode, showKeys = true,
  isRecording = false, isVoiceSupported = true, voiceUnsupportedReason = null, voiceMetrics = null, voiceError = null, isVoiceSilent = false,
  onMicStart = null, onMicStop = null, onDismissVoiceError = null,
}) {
  const showVoice = !isObjective && onMicStart != null;

  // ── Options the user has ruled out (multiple choice only) ──
  const [struck, setStruck] = useState([]);
  useEffect(() => { setStruck([]); }, [currentQuestion?.id]);
  // Choosing an option (mouse or 1–4 / A–D keys) always brings it back.
  useEffect(() => {
    if (selectedAnswerIndex != null) setStruck((s) => s.filter((i) => i !== selectedAnswerIndex));
  }, [selectedAnswerIndex]);

  const toggleStrike = (index) => {
    setStruck((s) => (s.includes(index) ? s.filter((i) => i !== index) : [...s, index]));
    if (selectedAnswerIndex === index) onSelectAnswer(null);
  };

  // ── Skip needs a second tap: it scores 0 and can't be undone ──
  const [skipArmed, setSkipArmed] = useState(false);
  const skipTimer = useRef(null);
  useEffect(() => () => clearTimeout(skipTimer.current), []);
  useEffect(() => { setSkipArmed(false); }, [currentQuestion?.id]);

  const handleSkip = () => {
    if (!skipArmed) {
      setSkipArmed(true);
      clearTimeout(skipTimer.current);
      skipTimer.current = setTimeout(() => setSkipArmed(false), 4000);
      return;
    }
    clearTimeout(skipTimer.current);
    setSkipArmed(false);
    onSkip();
  };

  const length = lengthStatus(wordCount);
  const tone   = TONE[length.tone];
  const meterPct = Math.min(100, (wordCount / WORDS_MAX) * 100);
  const chosenLetter = selectedAnswerIndex != null ? String.fromCharCode(65 + selectedAnswerIndex) : null;

  return (
    <>
      <div style={S.head}>
        <h2 style={S.title}>{isObjective ? 'Choose your answer' : 'Your answer'}</h2>
        {showVoice && (
          <MicButton
            isRecording={Boolean(isRecording)}
            isSupported={isVoiceSupported !== false}
            unsupportedReason={voiceUnsupportedReason}
            isSubmitted={isLoading}
            isSilent={Boolean(isVoiceSilent)}
            onStart={onMicStart}
            onStop={onMicStop}
          />
        )}
      </div>

      {isObjective ? (
        <div style={S.options} role="radiogroup" aria-label="Answer options">
          {(currentQuestion.options || []).map((option, index) => {
            const selected = selectedAnswerIndex === index;
            const out      = struck.includes(index);
            const letter   = String.fromCharCode(65 + index);
            return (
              <div
                key={`${currentQuestion.id}-${index}`}
                className={`iv-opt${selected ? ' iv-opt-selected' : ''}${out ? ' iv-opt-out' : ''}`}
                style={{
                  ...S.opt,
                  ...(selected ? { borderColor: mode.accent, background: mode.soft, boxShadow: `0 0 0 3px ${mode.accent}22` } : null),
                  ...(out ? { background: C.cardAlt, opacity: 0.6 } : null),
                }}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Option ${letter}: ${option}${out ? ' (ruled out)' : ''}`}
                  className="iv-opt-main"
                  style={S.optMain}
                  disabled={isLoading}
                  onClick={() => onSelectAnswer(index)}
                >
                  <span style={{ ...S.optLetter, ...(selected ? { background: mode.accent, borderColor: mode.accent, color: '#fff' } : null) }}>
                    {selected ? <Icon name="check" size={15} stroke={3} /> : letter}
                  </span>
                  <span style={{ ...S.optText, ...(out ? { textDecoration: 'line-through', color: C.muted } : null) }}>{option}</span>
                </button>
                <button
                  type="button"
                  className="iv-opt-strike"
                  style={S.optStrike}
                  disabled={isLoading}
                  aria-label={out ? `Restore option ${letter}` : `Rule out option ${letter}`}
                  title={out ? 'Restore this option' : 'Rule this option out'}
                  onClick={() => toggleStrike(index)}
                >
                  <Icon name={out ? 'retry' : 'x'} size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <textarea
            ref={textAreaRef}
            style={{ ...S.answerBox, ...(isEvaluating ? { background: C.cardAlt, color: C.sub } : null) }}
            value={textAnswer}
            onChange={onTextChange}
            readOnly={isEvaluating}
            placeholder={isRecording ? 'Listening. Speak your answer.' : 'Type your answer, or use your voice.'}
            rows={9}
            aria-label="Your answer"
          />

          <div style={S.meter} aria-live="polite">
            <div style={S.meterRow}>
              <span style={{ ...S.meterCount, color: tone.color }}>
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
                {isRecording ? ', recording' : ''}
              </span>
              <span style={{ ...S.meterText, color: tone.color }}>
                {isTranscribing ? 'Transcribing your recording…' : length.text || `Aim for ${WORDS_MIN}–${WORDS_MAX} words`}
              </span>
            </div>
            <div style={S.meterTrack} aria-hidden="true">
              <div style={{ ...S.meterBand, left: `${(WORDS_MIN / WORDS_MAX) * 100}%`, right: 0 }} />
              <div style={{ position: 'relative', height: '100%', width: `${meterPct}%`, borderRadius: 999, background: tone.bar, transition: 'width 0.25s ease, background 0.25s ease' }} />
            </div>
          </div>

          {showVoice && (isRecording || voiceError) && (
            <VoiceStatusStrip
              isRecording={Boolean(isRecording)}
              isSilent={Boolean(isVoiceSilent)}
              voiceError={voiceError}
              onDismissError={onDismissVoiceError}
            />
          )}

          {showVoice && voiceMetrics && <DeliveryCard voiceMetrics={voiceMetrics} />}

          {showVoice && isVoiceSupported === false && (
            <MicButton
              isRecording={false}
              isSupported={false}
              unsupportedReason={voiceUnsupportedReason}
              isSubmitted={false}
              onStart={() => {}}
              onStop={() => {}}
            />
          )}
        </>
      )}

      <div style={S.footer}>
        {isObjective && (
          <span style={{ ...S.hint, ...(chosenLetter ? { color: C.green, fontWeight: 600 } : null) }} aria-live="polite">
            {chosenLetter ? `Option ${chosenLetter} selected` : 'Pick an option to continue'}
          </span>
        )}

        {shortSubmitPending && (
          <div className="iv-fade-in" role="alert" style={{ ...S.notice, background: C.amberTint, border: `1px solid ${C.amber}40`, color: C.sub }}>
            <Icon name="alert" size={16} style={{ color: C.amber, marginTop: 2 }} />
            <span>That&apos;s only {wordCount} word{wordCount === 1 ? '' : 's'}, and short answers usually score low. Keep writing, or submit anyway.</span>
          </div>
        )}

        {isEvaluating && (
          <div className="iv-fade-in" role="status" style={{ ...S.notice, background: C.blue50, border: `1px solid ${C.blue100}`, color: C.blue700, alignItems: 'center' }}>
            <span className="iv-spin-dark" />
            <span>{isObjective ? 'Checking your answer…' : 'Evaluating your answer against the question…'}</span>
          </div>
        )}

        <div style={S.actions} className="iv-answer-actions">
          {isEvaluating && !isObjective && onStopSubmit ? (
            // Same slot and style as Skip, so nothing shifts when evaluation starts.
            // Stopping keeps the typed answer so it can be edited.
            <button
              type="button"
              style={S.skipBtn}
              className="iv-skip-btn"
              aria-label="Stop evaluating and keep editing your answer"
              onClick={onStopSubmit}
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              style={{ ...S.skipBtn, ...(skipArmed ? { borderColor: C.red, color: C.red, background: C.redTint } : null) }}
              className="iv-skip-btn"
              disabled={isLoading}
              onClick={handleSkip}
            >
              {skipArmed ? 'Tap again to skip (scores 0)' : 'Skip question'}
            </button>
          )}
          <button
            type="button"
            style={{
              ...S.submitBtn,
              ...(!canSubmit ? S.btnDisabled : null),
              ...(isLoading ? { opacity: 0.85, cursor: 'wait' } : null),
              ...(shortSubmitPending ? { background: `linear-gradient(135deg, ${C.amber}, #F59E0B)`, boxShadow: '0 6px 20px rgba(217,119,6,0.28)' } : null),
            }}
            className="iv-submit-btn"
            disabled={!canSubmit || isLoading}
            onClick={onSubmit}
          >
            {isLoading
              ? <><span className="iv-spin" />{isObjective ? 'Checking' : 'Evaluating'}</>
              : shortSubmitPending
                ? 'Submit anyway'
                : isLastQuestion
                  ? 'Submit final answer'
                  : 'Submit answer'}
          </button>
        </div>

        {showKeys && canSubmit && !isLoading && (
          <div style={{ textAlign: 'right', fontSize: 12.5, color: C.faint }}>
            or press <kbd style={S.kbd}>Enter</kbd>
          </div>
        )}
      </div>
    </>
  );
}

InterviewControls.propTypes = interviewControlsPropTypes;

export default InterviewControls;
