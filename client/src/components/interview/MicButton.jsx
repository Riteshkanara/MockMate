import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';

// ── Local colour aliases (matches the pattern in InterviewControls / FeedbackPanel) ──
const C = {
  ...CT,
  violet:     '#6D5BEE',
  violetTint: '#F0EEFF',
};

// ─── Keyframe CSS injected once ───────────────────────────────────────────────
let _stylesInjected = false;
const injectStyles = () => {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes mb-pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.40);} 50%{box-shadow:0 0 0 8px rgba(220,38,38,0);} }
    @keyframes mb-fadeIn { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }
    @keyframes mb-barGrow{ from{width:0%;} to{width:var(--bar-w);} }
    .mb-recording { animation: mb-pulse 1.4s ease-in-out infinite !important; }
    .mb-fade-in   { animation: mb-fadeIn 0.28s cubic-bezier(.16,1,.3,1); }
    .mb-bar       { animation: mb-barGrow 0.7s cubic-bezier(.16,1,.3,1) both; }
  `;
  document.head.appendChild(style);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single metric row inside the delivery card. */
const MetricRow = ({ icon, label, value, valueColor, hint, barPercent, barColor }) => (
  <div style={{
    padding: '10px 12px',
    borderRadius: 11,
    background: C.cardAlt,
    border: `1px solid ${C.border}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: barPercent != null ? 6 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: C.muted, textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: valueColor || C.text, flexShrink: 0 }}>
        {value}
      </span>
    </div>

    {/* Optional progress bar (used for WPM gauge) */}
    {barPercent != null && (
      <div style={{ height: 4, borderRadius: 999, background: C.border, overflow: 'hidden', marginBottom: 5 }}>
        <div
          className="mb-bar"
          style={{
            '--bar-w': `${Math.min(100, Math.max(0, barPercent))}%`,
            height: '100%', borderRadius: 999,
            background: barColor || C.blue500,
            width: `${Math.min(100, Math.max(0, barPercent))}%`,
          }}
        />
      </div>
    )}

    {hint && (
      <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.45, marginTop: 2, fontWeight: 500 }}>
        {hint}
      </div>
    )}
  </div>
);

MetricRow.propTypes = {
  icon:       PropTypes.string.isRequired,
  label:      PropTypes.string.isRequired,
  value:      PropTypes.string.isRequired,
  valueColor: PropTypes.string,
  hint:       PropTypes.string,
  barPercent: PropTypes.number,
  barColor:   PropTypes.string,
};
MetricRow.defaultProps = { valueColor: null, hint: null, barPercent: null, barColor: null };

// ─── WPM colour helpers ───────────────────────────────────────────────────────
const wpmColor = (band) => ({
  tooSlow: C.amber,
  ideal:   C.green,
  tooFast: C.danger,
}[band] || C.blue500);

// WPM gauge: map wpm to 0-100 on a 0-200 scale (clamp at 200+)
const wpmPercent = (wpm) => Math.min(100, Math.round((wpm / 200) * 100));

// ─── Length rating helpers ────────────────────────────────────────────────────
const lengthColor = (rating) => ({
  tooShort: C.amber,
  ideal:    C.green,
  tooLong:  C.warning,
}[rating] || C.blue500);

const lengthLabel = (rating) => ({
  tooShort: 'Too short',
  ideal:    'Ideal length',
  tooLong:  'Too long',
}[rating] || '—');

// ─── Filler word display ──────────────────────────────────────────────────────
const FillerChip = ({ word, count }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 999,
    background: count >= 3 ? C.dangerTint : C.warningTint,
    border: `1px solid ${count >= 3 ? C.danger : C.warning}30`,
    fontSize: 11, fontWeight: 700, color: count >= 3 ? C.danger : C.warning,
    fontFamily: F.mono, flexShrink: 0,
  }}>
    "{word}" <span style={{ opacity: 0.7 }}>×{count}</span>
  </span>
);

FillerChip.propTypes = {
  word:  PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
};

// ─── DeliveryCard (shown after recording stops) ───────────────────────────────
/**
 * Renders the inline delivery metrics breakdown in the answer panel.
 * Only shown for open (non-MCQ) questions when voiceMetrics is present.
 */
export const DeliveryCard = ({ voiceMetrics }) => {
  if (!voiceMetrics) return null;

  const { fillerWords, wpm, answerLength } = voiceMetrics;

  return (
    <div className="mb-fade-in" style={{
      marginTop: 12,
      padding: '13px 14px',
      borderRadius: 14,
      border: `1.5px solid ${C.borderMd}`,
      background: C.card,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 14 }}>🎤</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: C.muted, textTransform: 'uppercase' }}>
          Delivery snapshot
        </span>
      </div>

      {/* WPM */}
      <MetricRow
        icon="⚡"
        label="Speaking pace"
        value={wpm.wpm > 0 ? `${wpm.wpm} wpm` : '—'}
        valueColor={wpmColor(wpm.band)}
        hint={wpm.hint}
        barPercent={wpmPercent(wpm.wpm)}
        barColor={wpmColor(wpm.band)}
      />

      {/* Filler words */}
      <div style={{ padding: '10px 12px', borderRadius: 11, background: C.cardAlt, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: fillerWords.breakdown.length > 0 ? 8 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 14 }}>🔤</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: C.muted, textTransform: 'uppercase' }}>
              Filler words
            </span>
          </div>
          <span style={{
            fontFamily: F.display, fontSize: 13, fontWeight: 800,
            color: fillerWords.total === 0 ? C.green : fillerWords.total <= 3 ? C.warning : C.danger,
          }}>
            {fillerWords.total === 0 ? 'None 🎯' : `${fillerWords.total} total`}
          </span>
        </div>
        {fillerWords.breakdown.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {fillerWords.breakdown.map(({ word, count }) => (
              <FillerChip key={word} word={word} count={count} />
            ))}
          </div>
        )}
        {fillerWords.total === 0 && (
          <div style={{ fontSize: 11.5, color: C.green, fontWeight: 600, marginTop: 2 }}>
            Clean delivery — no filler words detected.
          </div>
        )}
      </div>

      {/* Answer length */}
      <MetricRow
        icon="📏"
        label={`Length · ${answerLength.category}`}
        value={`${answerLength.wordCount} words`}
        valueColor={lengthColor(answerLength.rating)}
        hint={`${lengthLabel(answerLength.rating)} — target ${answerLength.min}–${answerLength.max} words. ${answerLength.hint}`}
      />
    </div>
  );
};

DeliveryCard.propTypes = {
  voiceMetrics: PropTypes.shape({
    fillerWords:  PropTypes.object,
    wpm:          PropTypes.object,
    answerLength: PropTypes.object,
  }),
};
DeliveryCard.defaultProps = { voiceMetrics: null };

// ─── MicButton ────────────────────────────────────────────────────────────────
/**
 * Toggle button that starts / stops voice recording.
 * Also renders the unsupported-browser fallback message.
 *
 * Props:
 *   isRecording  {boolean}   - Current recording state
 *   isSupported  {boolean}   - False when SpeechRecognition is unavailable
 *   isSubmitted  {boolean}   - Disable mic after answer is submitted
 *   onStart      {function}  - Called when user clicks to start recording
 *   onStop       {function}  - Called when user clicks to stop recording
 */
function MicButton({ isRecording, isSupported, isSubmitted, onStart, onStop }) {
  // Inject CSS once on first render
  injectStyles();

  // ── Unsupported browser ───────────────────────────────────────────────────
  if (!isSupported) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: C.warningTint, border: `1px solid ${C.warning}30`,
        fontSize: 12, color: C.warning, fontWeight: 600, fontFamily: F.body,
      }}>
        <span>⚠️</span>
        <span>Voice input isn't supported in this browser. Use Chrome or Edge for the best experience.</span>
      </div>
    );
  }

  // ── Normal button ─────────────────────────────────────────────────────────
  const disabled = isSubmitted;
  const label    = isRecording ? 'Stop recording' : 'Use voice';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isRecording}
      disabled={disabled}
      onClick={isRecording ? onStop : onStart}
      className={isRecording ? 'mb-recording' : ''}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1.5px solid ${isRecording ? C.danger : C.borderMd}`,
        background: isRecording ? C.dangerTint : C.cardAlt,
        color: isRecording ? C.danger : C.sub,
        fontFamily: F.body, fontSize: 12.5, fontWeight: 700,
        opacity: disabled ? 0.45 : 1,
        transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {/* Mic icon — red dot when recording */}
      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
        {isRecording ? '⏹' : '🎙️'}
      </span>
      {label}
      {isRecording && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: C.danger, flexShrink: 0,
          animation: 'mb-pulse 1.4s ease-in-out infinite',
        }} />
      )}
    </button>
  );
}

MicButton.propTypes = {
  isRecording: PropTypes.bool.isRequired,
  isSupported: PropTypes.bool.isRequired,
  isSubmitted: PropTypes.bool,
  onStart:     PropTypes.func.isRequired,
  onStop:      PropTypes.func.isRequired,
};
MicButton.defaultProps = { isSubmitted: false };

export default MicButton;