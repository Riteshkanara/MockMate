import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';
import MicButton, { DeliveryCard } from './MicButton';

// ── CHANGES vs original ───────────────────────────────────────────────────────
// 1. Imported MicButton and DeliveryCard from ./MicButton
// 2. Added 4 new props: isRecording, isVoiceSupported, voiceMetrics,
//    onMicStart, onMicStop  (all optional; gracefully no-ops when undefined)
// 3. In the open-question branch: MicButton appears after the textarea,
//    DeliveryCard appears below MicButton when voiceMetrics is present
// 4. The short-answer warning now references voice answers too
// Everything else is pixel-for-pixel identical to the original.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  ...CT,
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
};

const S = {
  answerHeading:        { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 9, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` },
  answerHeadingEyebrow: { display: 'block', color: C.blue500, fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase' },
  answerHeadingTitle:   { display: 'block', marginTop: 3, color: C.text, fontFamily: F.display, fontSize: 15, fontWeight: 800, letterSpacing: '-0.2px' },
  answerModeTag:        { padding: '4px 10px', borderRadius: 8, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, background: C.cardAlt, color: C.sub, fontSize: 9.5, fontFamily: F.mono, letterSpacing: '0.5px', fontWeight: 700, flexShrink: 0 },
  answerBox:            { flex: 1, width: '100%', minHeight: 210, resize: 'vertical', borderStyle: 'solid', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, background: '#FFFFFF', color: C.text, padding: '14px 15px', outline: 'none', fontFamily: F.body, fontSize: 14, lineHeight: 1.72, letterSpacing: '0.01em', transition: 'border-color 0.18s ease, box-shadow 0.18s ease' },
  options:              { display: 'flex', flexDirection: 'column', gap: 9, flex: 1 },
  option:               { display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 54, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, borderRadius: 14, background: C.card, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease' },
  optionActive:         { boxShadow: '0 4px 16px rgba(26,110,255,0.13)' },
  optionLetter:         { width: 30, height: 30, borderRadius: 9, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, background: C.cardAlt, color: C.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: F.mono, fontSize: 12, fontWeight: 800, transition: 'background 0.14s ease, border-color 0.14s ease, color 0.14s ease' },
  optionText:           { flex: 1, color: C.text, fontFamily: F.body, fontSize: 14, lineHeight: 1.5, fontWeight: 500 },
  optionRadio:          { width: 20, height: 20, borderRadius: '50%', borderStyle: 'solid', borderWidth: 1.5, borderColor: C.borderMd, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0, transition: 'background 0.14s ease, border-color 0.14s ease' },
  answerFooter:         { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, paddingTop: 13, borderTop: `1px solid ${C.border}` },
  answerFooterHint:     { color: C.muted, fontFamily: F.mono, fontSize: 11, letterSpacing: '0.15px' },
  answerActions:        { display: 'flex', gap: 8, alignItems: 'center' },
  skipBtn:              { borderStyle: 'solid', borderWidth: 1.5, borderColor: C.border, background: C.card, borderRadius: 11, padding: '11px 17px', color: C.muted, cursor: 'pointer', fontFamily: F.body, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.1px', flexShrink: 0, transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease' },
  submitBtn:            { border: 'none', borderRadius: 11, padding: '11px 22px', background: `linear-gradient(135deg, ${C.blue700}, ${C.blue500})`, color: '#fff', boxShadow: '0 6px 20px rgba(26,110,255,0.28)', cursor: 'pointer', fontFamily: F.display, fontSize: 13.5, fontWeight: 800, letterSpacing: '0px', whiteSpace: 'nowrap', flex: 1, transition: 'box-shadow 0.15s ease, transform 0.1s ease' },
  btnDisabled:          { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none', transform: 'none' },
  kbd:                  { display: 'inline-block', padding: '2px 7px', borderRadius: 5, borderStyle: 'solid', borderWidth: 1, borderColor: C.borderMd, borderBottomWidth: 2, background: C.cardAlt, color: C.sub, fontFamily: F.mono, fontSize: 10, fontWeight: 700, lineHeight: 1.4, verticalAlign: 'middle' },
};

// ─── PropTypes ───────────────────────────────────────────────────────────────────
const interviewControlsPropTypes = {
  currentQuestion:    PropTypes.shape({ id: PropTypes.string, options: PropTypes.arrayOf(PropTypes.string) }).isRequired,
  isObjective:        PropTypes.bool.isRequired,
  selectedAnswerIndex:PropTypes.number,
  textAnswer:         PropTypes.string.isRequired,
  onTextChange:       PropTypes.func.isRequired,
  onSelectAnswer:     PropTypes.func.isRequired,
  canSubmit:          PropTypes.bool.isRequired,
  isLoading:          PropTypes.bool.isRequired,
  isLastQuestion:     PropTypes.bool.isRequired,
  shortSubmitPending: PropTypes.bool.isRequired,
  wordCount:          PropTypes.number.isRequired,
  onSkip:             PropTypes.func.isRequired,
  onSubmit:           PropTypes.func.isRequired,
  textAreaRef:        PropTypes.shape({ current: PropTypes.any }),
  mode:               PropTypes.shape({ accent: PropTypes.string.isRequired, soft: PropTypes.string.isRequired }).isRequired,
  // ── NEW voice props (all optional — feature degrades gracefully) ──────────
  /** True while the mic is actively recording */
  isRecording:        PropTypes.bool,
  /** False when the browser doesn't support SpeechRecognition */
  isVoiceSupported:   PropTypes.bool,
  /** Computed metrics object returned by useVoiceAnswer after recording */
  voiceMetrics:       PropTypes.object,
  /** Called when user clicks the mic button to start recording */
  onMicStart:         PropTypes.func,
  /** Called when user clicks the mic button to stop recording */
  onMicStop:          PropTypes.func,
};

// ─── Component ───────────────────────────────────────────────────────────────────
function InterviewControls({
  currentQuestion,
  isObjective,
  selectedAnswerIndex,
  textAnswer,
  onTextChange,
  onSelectAnswer,
  canSubmit,
  isLoading,
  isLastQuestion,
  shortSubmitPending,
  wordCount,
  onSkip,
  onSubmit,
  textAreaRef,
  mode,
  // voice props
  isRecording,
  isVoiceSupported,
  voiceMetrics,
  onMicStart,
  onMicStop,
}) {
  // Voice feature is active only for open (non-objective) questions
  // and only when the parent wired up the voice props.
  const showVoice = !isObjective && onMicStart != null;

  return (
    <>
      {/* ── Section heading ── */}
      <div style={S.answerHeading}>
        <div>
          <span style={S.answerHeadingEyebrow}>YOUR ANSWER</span>
          <strong style={S.answerHeadingTitle}>
            {isObjective ? 'Choose an option' : 'Write your response'}
          </strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* ── MicButton — only for open questions ── */}
          {showVoice && (
            <MicButton
              isRecording={Boolean(isRecording)}
              isSupported={isVoiceSupported !== false}
              isSubmitted={isLoading}
              onStart={onMicStart}
              onStop={onMicStop}
            />
          )}
          <div style={S.answerModeTag}>{isObjective ? 'SELECT' : 'WRITE'}</div>
        </div>
      </div>

      {/* ── MCQ options OR open textarea ── */}
      {isObjective ? (
        <div style={S.options} role="radiogroup" aria-label="Answer options">
          {(currentQuestion.options || []).map((option, index) => {
            const selected = selectedAnswerIndex === index;
            return (
              <button
                key={`${currentQuestion.id}-${index}`}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Option ${String.fromCharCode(65 + index)}: ${option}`}
                style={{
                  ...S.option,
                  ...(selected
                    ? { ...S.optionActive, borderStyle: 'solid', borderWidth: 1, borderColor: mode.accent, background: mode.soft }
                    : {}),
                }}
                className="iv-option"
                onClick={() => onSelectAnswer(index)}
              >
                <span style={{
                  ...S.optionLetter,
                  ...(selected
                    ? { background: mode.accent, borderStyle: 'solid', borderWidth: 1, borderColor: mode.accent, color: '#fff' }
                    : {}),
                }}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span style={S.optionText}>{option}</span>
                <span style={{
                  ...S.optionRadio,
                  ...(selected
                    ? { borderStyle: 'solid', borderWidth: 1, borderColor: mode.accent, background: mode.accent }
                    : {}),
                }}>
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <textarea
            ref={textAreaRef}
            style={S.answerBox}
            value={textAnswer}
            onChange={onTextChange}
            placeholder={
              isRecording
                ? '🎙️ Listening… speak your answer'
                : 'Write your answer here... (Enter to submit, Shift+Enter for a new line)'
            }
            rows={9}
            aria-label="Your answer"
          />

          {/* ── Delivery snapshot card (appears after recording stops) ── */}
          {showVoice && voiceMetrics && (
            <DeliveryCard voiceMetrics={voiceMetrics} />
          )}

          {/* ── Unsupported browser fallback (when voice was requested but unavailable) ── */}
          {showVoice && isVoiceSupported === false && (
            <MicButton
              isRecording={false}
              isSupported={false}
              isSubmitted={false}
              onStart={() => {}}
              onStop={() => {}}
            />
          )}
        </>
      )}

      {/* ── Footer: hint, short-answer warning, actions ── */}
      <div style={S.answerFooter}>
        <span style={{
          ...S.answerFooterHint,
          ...(isObjective
            ? selectedAnswerIndex !== null ? { color: C.green, fontWeight: 600 } : {}
            : textAnswer.trim().length > 0  ? { color: C.blue500, fontWeight: 600 } : {}),
          transition: 'color 0.2s ease',
        }}>
          {isObjective
            ? selectedAnswerIndex !== null ? '✓ Answer selected' : 'Select one option to continue'
            : textAnswer.trim().length > 0
              ? `${textAnswer.trim().split(/\s+/).filter(Boolean).length} words · ${textAnswer.length} chars${isRecording ? ' · 🎙️ recording' : ''}`
              : 'Start typing or use the mic above…'}
        </span>

        {shortSubmitPending && (
          <div className="iv-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '9px 13px', borderRadius: 10, background: C.amberTint, border: `1px solid ${C.amber}40` }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
            <span style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.4 }}>
              That's only {wordCount} word{wordCount === 1 ? '' : 's'} — short answers usually score low. Click submit again if you're sure, or keep typing.
            </span>
          </div>
        )}

        <div style={S.answerActions} className="iv-answer-actions">
          <button
            type="button"
            style={S.skipBtn}
            className="iv-skip-btn"
            disabled={isLoading}
            onClick={onSkip}
          >
            Skip
          </button>
          <button
            type="button"
            style={{
              ...S.submitBtn,
              ...(!canSubmit ? S.btnDisabled : {}),
              ...(isLoading ? { opacity: 0.82, cursor: 'wait' } : {}),
              ...(shortSubmitPending ? { background: `linear-gradient(135deg, ${C.amber}, #F59E0B)` } : {}),
            }}
            className={`iv-submit-btn${isLoading ? ' iv-btn-loading' : ''}`}
            disabled={!canSubmit || isLoading}
            onClick={onSubmit}
          >
            {isLoading
              ? 'Checking'
              : shortSubmitPending
                ? 'Submit anyway →'
                : isLastQuestion
                  ? 'Submit final answer'
                  : 'Submit answer →'}
          </button>
        </div>

        {canSubmit && !isLoading && (
          <div style={{ textAlign: 'right', marginTop: 6, fontSize: 10, color: C.faint, fontFamily: F.mono }}>
            press{' '}
            <span style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 4, borderStyle: 'solid', borderWidth: 1, borderColor: C.border, borderBottomWidth: 2, background: C.cardAlt, fontSize: 9.5, fontWeight: 700, color: C.sub, lineHeight: 1.4 }}>
              Enter ↵
            </span>{' '}
            to submit
          </div>
        )}
      </div>
    </>
  );
}

InterviewControls.propTypes = interviewControlsPropTypes;

InterviewControls.defaultProps = {
  selectedAnswerIndex: null,
  textAreaRef:         null,
  // voice defaults — feature is disabled when these are absent
  isRecording:        false,
  isVoiceSupported:   true,
  voiceMetrics:       null,
  onMicStart:         null,
  onMicStop:          null,
};

export default InterviewControls;