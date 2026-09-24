import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';

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
    @keyframes mb-pulseAmber { 0%,100%{box-shadow:0 0 0 0 rgba(217,119,6,0.40);} 50%{box-shadow:0 0 0 8px rgba(217,119,6,0);} }
    @keyframes mb-fadeIn { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }
    @keyframes mb-barGrow{ from{width:0%;} to{width:var(--bar-w);} }
    .mb-recording { animation: mb-pulse 1.4s ease-in-out infinite !important; }
    .mb-silent    { animation: mb-pulseAmber 1s ease-in-out infinite !important; }
    .mb-fade-in   { animation: mb-fadeIn 0.28s cubic-bezier(.16,1,.3,1); }
    .mb-bar       { animation: mb-barGrow 0.7s cubic-bezier(.16,1,.3,1) both; }
  `;
  document.head.appendChild(style);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const MetricRow = ({ icon, label, value, valueColor, hint, barPercent, barColor }) => (
  <div style={{ padding: '10px 12px', borderRadius: 11, background: C.cardAlt, border: `1px solid ${C.border}` }}>
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
    {barPercent != null && (
      <div style={{ height: 4, borderRadius: 999, background: C.border, overflow: 'hidden', marginBottom: 5 }}>
        <div className="mb-bar" style={{
          '--bar-w': `${Math.min(100, Math.max(0, barPercent))}%`,
          height: '100%', borderRadius: 999,
          background: barColor || C.blue500,
          width: `${Math.min(100, Math.max(0, barPercent))}%`,
        }} />
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
  icon: PropTypes.string.isRequired, label: PropTypes.string.isRequired, value: PropTypes.string.isRequired,
  valueColor: PropTypes.string, hint: PropTypes.string, barPercent: PropTypes.number, barColor: PropTypes.string,
};
MetricRow.defaultProps = { valueColor: null, hint: null, barPercent: null, barColor: null };

const wpmColor    = (band) => ({ tooSlow: C.amber, ideal: C.green, tooFast: C.danger }[band] || C.blue500);
const wpmPercent  = (wpm)  => Math.min(100, Math.round((wpm / 200) * 100));
const lengthColor = (r) => ({ tooShort: C.amber, ideal: C.green, tooLong: C.warning }[r] || C.blue500);
const lengthLabel = (r) => ({ tooShort: 'Too short', ideal: 'Ideal length', tooLong: 'Too long' }[r] || '—');

const FillerChip = ({ word, count }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999,
    background: count >= 3 ? C.dangerTint : C.warningTint,
    border: `1px solid ${count >= 3 ? C.danger : C.warning}30`,
    fontSize: 11, fontWeight: 700, color: count >= 3 ? C.danger : C.warning,
    fontFamily: F.mono, flexShrink: 0,
  }}>
    "{word}" <span style={{ opacity: 0.7 }}>×{count}</span>
  </span>
);
FillerChip.propTypes = { word: PropTypes.string.isRequired, count: PropTypes.number.isRequired };

// ─── Delivery score ring (compact, inline) ─────────────────────────────────────
const deliveryScoreColor = (s) => (s >= 80 ? C.green : s >= 60 ? C.blue500 : s >= 40 ? C.warning : C.danger);

const DeliveryScoreBadge = ({ score }) => {
  if (score == null) return null;
  const color = deliveryScoreColor(score);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 12px', borderRadius: 11,
      background: `${color}14`, border: `1px solid ${color}35`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: '#fff', border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: F.display, fontSize: 12.5, fontWeight: 800, color }}>{score}</span>
      </div>
      <div>
        <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: C.muted, textTransform: 'uppercase' }}>
          Delivery score
        </div>
        <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 600 }}>
          {score >= 80 ? 'Confident and clear' : score >= 60 ? 'Solid, room to tighten up' : score >= 40 ? 'Some rough patches' : 'Needs practice'}
        </div>
      </div>
    </div>
  );
};
DeliveryScoreBadge.propTypes = { score: PropTypes.number };
DeliveryScoreBadge.defaultProps = { score: null };

// ─── Pause analysis row ─────────────────────────────────────────────────────────
const pauseRatingCopy = {
  smooth:          { label: 'Smooth delivery',   color: 'green',   icon: '🟢' },
  'some-hesitation': { label: 'Some hesitation',  color: 'amber',   icon: '🟡' },
  'frequent-gaps':  { label: 'Frequent gaps',     color: 'danger',  icon: '🔴' },
};

const PauseRow = ({ pauses }) => {
  if (!pauses) return null;
  const copy = pauseRatingCopy[pauses.rating] || pauseRatingCopy.smooth;
  const colorVal = C[copy.color] || C.blue500;
  return (
    <div style={{ padding: '10px 12px', borderRadius: 11, background: C.cardAlt, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14 }}>⏸️</span>
          <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: C.muted, textTransform: 'uppercase' }}>
            Pauses
          </span>
        </div>
        <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: colorVal }}>
          {copy.icon} {copy.label}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5, fontWeight: 500 }}>
        {pauses.deadAirCount > 0
          ? `${pauses.deadAirCount} long gap${pauses.deadAirCount === 1 ? '' : 's'} (${pauses.longestPauseSeconds}s longest) — these read as unprepared moments to an interviewer.`
          : pauses.thinkingPauseCount > 0
            ? `${pauses.thinkingPauseCount} thinking pause${pauses.thinkingPauseCount === 1 ? '' : 's'} — natural and fine in moderation.`
            : 'No notable pauses — a steady, continuous answer.'}
      </div>
    </div>
  );
};
PauseRow.propTypes = { pauses: PropTypes.object };
PauseRow.defaultProps = { pauses: null };

// ─── Pace consistency row ────────────────────────────────────────────────────
const consistencyCopy = {
  steady:   { label: 'Steady pace', color: 'green' },
  shifting: { label: 'Pace shifted', color: 'amber' },
  volatile: { label: 'Pace swung a lot', color: 'danger' },
};

const ConsistencyNote = ({ consistency }) => {
  if (!consistency || consistency.rating === 'steady') return null;
  const copy = consistencyCopy[consistency.rating];
  const colorVal = C[copy.color] || C.blue500;
  const faster = consistency.secondHalfWpm > consistency.firstHalfWpm;
  return (
    <div style={{ fontSize: 11, color: colorVal, fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
      {copy.label}: {consistency.firstHalfWpm} wpm early → {consistency.secondHalfWpm} wpm later
      {faster ? ' (sped up — check you didn\'t rush the ending)' : ' (slowed down — may signal losing your train of thought)'}
    </div>
  );
};
ConsistencyNote.propTypes = { consistency: PropTypes.object };
ConsistencyNote.defaultProps = { consistency: null };

// ─── Filler trend note ────────────────────────────────────────────────────────
const fillerTrendCopy = {
  'front-loaded': 'Fillers clustered early — often nerves settling in as you started.',
  'back-loaded':  'Fillers crept in later — can signal losing structure as the answer went on.',
  even:           'Fillers were spread evenly through the answer.',
};

// ─── DeliveryCard (shown after recording stops) ───────────────────────────────
export const DeliveryCard = ({ voiceMetrics }) => {
  if (!voiceMetrics) return null;
  const { fillerWords, wpm, answerLength, pauses, deliveryScore } = voiceMetrics;

  return (
    <div className="mb-fade-in" style={{
      marginTop: 12, padding: '13px 14px', borderRadius: 14,
      border: `1.5px solid ${C.borderMd}`, background: C.card,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 14 }}>🎤</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: C.muted, textTransform: 'uppercase' }}>
          Delivery snapshot
        </span>
      </div>

      {deliveryScore != null && <DeliveryScoreBadge score={deliveryScore} />}

      {/* WPM + pace consistency */}
      <div>
        <MetricRow
          icon="⚡"
          label="Speaking pace"
          value={wpm.wpm > 0 ? `${wpm.wpm} wpm` : '—'}
          valueColor={wpmColor(wpm.band)}
          hint={wpm.hint}
          barPercent={wpmPercent(wpm.wpm)}
          barColor={wpmColor(wpm.band)}
        />
        <ConsistencyNote consistency={wpm.consistency} />
      </div>

      {/* Filler words + trend */}
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
        {fillerWords.trend && fillerWords.total >= 3 && (
          <div style={{ fontSize: 11, color: C.sub, fontWeight: 500, marginTop: 6, lineHeight: 1.4 }}>
            {fillerTrendCopy[fillerWords.trend]}
          </div>
        )}
      </div>

      {/* Pauses */}
      <PauseRow pauses={pauses} />

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
    pauses:       PropTypes.object,
    deliveryScore: PropTypes.number,
  }),
};
DeliveryCard.defaultProps = { voiceMetrics: null };

// ─── Inline recording-status strip (silence nudge / live error) ──────────────
export const VoiceStatusStrip = ({ isRecording, isSilent, voiceError, onDismissError }) => {
  if (voiceError) {
    return (
      <div className="mb-fade-in" style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10,
        padding: '9px 13px', borderRadius: 10,
        background: C.dangerTint, border: `1px solid ${C.danger}35`,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
        <span style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.45, flex: 1 }}>{voiceError}</span>
        {onDismissError && (
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: C.muted, fontSize: 13, lineHeight: 1, padding: 2, flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  if (isRecording && isSilent) {
    return (
      <div className="mb-fade-in" style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
        padding: '9px 13px', borderRadius: 10,
        background: C.warningTint, border: `1px solid ${C.warning}35`,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>🔇</span>
        <span style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.45 }}>
          Not picking up any speech. Check your mic isn't muted or blocked.
        </span>
      </div>
    );
  }

  return null;
};

VoiceStatusStrip.propTypes = {
  isRecording: PropTypes.bool,
  isSilent: PropTypes.bool,
  voiceError: PropTypes.string,
  onDismissError: PropTypes.func,
};
VoiceStatusStrip.defaultProps = { isRecording: false, isSilent: false, voiceError: null, onDismissError: null };

// ─── MicButton ────────────────────────────────────────────────────────────────
/**
 * Toggle button that starts / stops voice recording.
 * Renders a tailored unsupported-browser fallback (iOS gets a distinct
 * message from generic unsupported browsers, since iOS Safari has zero
 * SpeechRecognition support and "try Chrome" isn't actionable advice there).
 *
 * Props:
 *   isRecording       {boolean}
 *   isSupported       {boolean}
 *   unsupportedReason {'ios'|'browser'|null}
 *   isSubmitted       {boolean}
 *   isSilent          {boolean}  - true once a few seconds pass with no speech detected
 *   onStart           {function}
 *   onStop            {function}
 */
function MicButton({ isRecording, isSupported, unsupportedReason, isSubmitted, isSilent, onStart, onStop }) {
  injectStyles();

  if (!isSupported) {
    const message = unsupportedReason === 'ios'
      ? "Voice input isn't available on iPhone/iPad browsers yet — type your answer instead."
      : "Voice input isn't supported in this browser. Try Chrome or Edge for the best experience.";
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: C.warningTint, border: `1px solid ${C.warning}30`,
        fontSize: 12, color: C.warning, fontWeight: 600, fontFamily: F.body,
      }}>
        <span>⚠️</span>
        <span>{message}</span>
      </div>
    );
  }

  const disabled = isSubmitted;
  const label    = isRecording ? 'Stop recording' : 'Use voice';
  const silentActive = isRecording && isSilent;

  return (
    <button
      type="button"
      aria-label={silentActive ? `${label} — no speech detected` : label}
      aria-pressed={isRecording}
      disabled={disabled}
      onClick={isRecording ? onStop : onStart}
      className={silentActive ? 'mb-silent' : isRecording ? 'mb-recording' : ''}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1.5px solid ${silentActive ? C.warning : isRecording ? C.danger : C.borderMd}`,
        background: silentActive ? C.warningTint : isRecording ? C.dangerTint : C.cardAlt,
        color: silentActive ? C.warning : isRecording ? C.danger : C.sub,
        fontFamily: F.body, fontSize: 12.5, fontWeight: 700,
        opacity: disabled ? 0.45 : 1,
        transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
        flexShrink: 0, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
        {isRecording ? '⏹' : '🎙️'}
      </span>
      {silentActive ? 'Listening… (no sound yet)' : label}
      {isRecording && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: silentActive ? C.warning : C.danger, flexShrink: 0,
          animation: `${silentActive ? 'mb-pulseAmber' : 'mb-pulse'} 1.4s ease-in-out infinite`,
        }} />
      )}
    </button>
  );
}

MicButton.propTypes = {
  isRecording: PropTypes.bool.isRequired,
  isSupported: PropTypes.bool.isRequired,
  unsupportedReason: PropTypes.oneOf(['ios', 'browser', null]),
  isSubmitted: PropTypes.bool,
  isSilent: PropTypes.bool,
  onStart:     PropTypes.func.isRequired,
  onStop:      PropTypes.func.isRequired,
};
MicButton.defaultProps = { unsupportedReason: null, isSubmitted: false, isSilent: false };

export default MicButton;
