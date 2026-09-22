import { useEffect, useState, useRef, useCallback } from 'react';
import styled, { keyframes, createGlobalStyle, css } from 'styled-components';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — hardcoded light theme, never flips dark
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  pageBg:       '#F0F2F7',
  cardBg:       '#FFFFFF',
  cardBorder:   '#E4E8F0',
  cardShadow:   '0 2px 8px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.08)',

  blue:         '#1A6EFF',
  blueSoft:     '#EEF4FF',
  blueRing:     'rgba(26,110,255,0.13)',
  blueGlow:     'rgba(26,110,255,0.10)',
  bluePulse:    'rgba(26,110,255,0.32)',

  green:        '#16A34A',
  greenSoft:    '#F0FDF4',
  greenRing:    'rgba(22,163,74,0.13)',

  textPrimary:  '#0D1B3E',
  textSecondary:'#6B7280',
  textMuted:    '#A0AABF',

  stepBorder:   '#E8ECF4',
  stepDoneBg:   '#FAFBFF',
  badgeBorder:  '#D0D7E8',

  hintBg:       '#F5F7FC',
  hintBorder:   '#E8ECF4',
  hintText:     '#6B7280',
  hintAmber:    '#D97706',

  progressBg:   '#E8ECF4',

  radius:       { card: '20px', steps: '12px', badge: '50%', hint: '10px' },
  font:         "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// ─────────────────────────────────────────────────────────────────────────────
// Step data
//
// Steps are driven by TWO independent clocks:
//   1. Real server phase ('checking' → 'waking' → 'ready') from App.jsx
//   2. An internal timer that advances the UI every STEP_DURATION ms
//
// The UI advances whichever is further ahead. This means:
//   • On a warm server (instant 200) we still show the first step briefly
//     (MIN_SHOW_MS in App.jsx handles that), then the step timer catches up.
//   • On a cold server the steps advance naturally, never racing ahead of
//     what is actually happening.
//   • Step 3 ("Ready to go") only activates once the server is confirmed up
//     (phase === 'ready' in progress, or timer has run long enough).
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Establishing connection', status: 'Connecting to server…'  },
  { label: 'Loading AI models',       status: 'Warming up models…'     },
  { label: 'Syncing data',            status: 'Syncing services…'      },
  { label: 'Ready to go',             status: 'Almost there…'          },
];

// Progress % on the global bar per active step index
const PROGRESS_MAP = [8, 34, 64, 90];

// How long each step stays "active" before the UI auto-advances (ms)
const STEP_DURATION = 2600;

// ─────────────────────────────────────────────────────────────────────────────
// Keyframes
// ─────────────────────────────────────────────────────────────────────────────
const cardEntrance = keyframes`
  from { opacity: 0; transform: translateY(18px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
`;

const ringPulse = keyframes`
  0%   { transform: scale(0.82); opacity: 0.55; }
  100% { transform: scale(1.90); opacity: 0;    }
`;

const fadeSlideUp = keyframes`
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0);   }
`;

const dotPulse = keyframes`
  0%, 60%, 100% { opacity: 0.25; }
  30%            { opacity: 1;    }
`;

const barSweep = keyframes`
  from { width: 0%; }
  to   { width: 88%; }
`;

const tickPop = keyframes`
  0%   { transform: scale(0.45); }
  65%  { transform: scale(1.20); }
  100% { transform: scale(1);    }
`;

const hintReveal = keyframes`
  from { opacity: 0; transform: translateY(7px); }
  to   { opacity: 1; transform: translateY(0);   }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Global style
// ─────────────────────────────────────────────────────────────────────────────
// Font is loaded via <link> in index.html — @import in createGlobalStyle
// is not supported by styled-components' CSSOM injection path.
const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Styled components
// ─────────────────────────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${T.pageBg};
  background-image:
    radial-gradient(circle at 28% 18%, rgba(26,110,255,0.055) 0%, transparent 48%),
    radial-gradient(circle at 74% 78%, rgba(99,102,241,0.04)  0%, transparent 48%);
  z-index: 9999;
  font-family: ${T.font};
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 348px;
  padding: 38px 32px 28px;
  border-radius: ${T.radius.card};
  background: ${T.cardBg};
  border: 1px solid ${T.cardBorder};
  box-shadow: ${T.cardShadow};
  animation: ${cardEntrance} 0.48s cubic-bezier(0.22, 1, 0.36, 1) both;
`;

// ── Icon stage ───────────────────────────────────────────────────────────────

const IconStage = styled.div`
  position: relative;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22px;
`;

const Ring = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid ${T.bluePulse};
  opacity: 0;
  animation: ${ringPulse} 2.6s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
  animation-delay: ${({ $delay }) => $delay}s;
`;

const Core = styled.div`
  position: relative;
  z-index: 1;
  width: 54px;
  height: 54px;
  border-radius: 15px;
  background: ${T.blue};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 7px ${T.blueGlow};

  &::before {
    content: '';
    display: block;
    width: 20px;
    height: 20px;
    background: white;
    clip-path: polygon(
      60% 0%,
      30% 48%,
      52% 48%,
      38% 100%,
      72% 46%,
      50% 46%
    );
  }
`;

// ── Title ────────────────────────────────────────────────────────────────────

const Title = styled.h1`
  font-size: 19px;
  font-weight: 600;
  color: ${T.textPrimary};
  letter-spacing: -0.35px;
  margin-bottom: 5px;
  line-height: 1;
`;

// ── Status row ───────────────────────────────────────────────────────────────

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  margin-bottom: 20px;
`;

const StatusText = styled.span`
  font-size: 12.5px;
  font-weight: 500;
  color: ${T.blue};
  animation: ${fadeSlideUp} 0.28s ease both;
`;

const Dots = styled.span`
  display: flex;
  gap: 3px;
  align-items: center;
  padding-top: 1px;
`;

const Dot = styled.span`
  display: inline-block;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: ${T.blue};
  animation: ${dotPulse} 1.25s ${({ $delay }) => $delay}s ease-in-out infinite;
`;

// ── Global progress bar ──────────────────────────────────────────────────────

const ProgressTrack = styled.div`
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: ${T.progressBg};
  overflow: hidden;
  margin-bottom: 22px;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: ${T.blue};
  width: ${({ $pct }) => $pct}%;
  transition: width 0.65s cubic-bezier(0.22, 1, 0.36, 1);
`;

// ── Steps list ───────────────────────────────────────────────────────────────

const StepList = styled.div`
  width: 100%;
  border: 1px solid ${T.stepBorder};
  border-radius: ${T.radius.steps};
  overflow: hidden;
  margin-bottom: 20px;
`;

const StepRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid ${T.stepBorder};
  background: ${({ $state }) =>
    $state === 'active' ? T.blueSoft :
    $state === 'done'   ? T.stepDoneBg :
    T.cardBg};
  transition: background 0.35s ease;

  &:last-child {
    border-bottom: none;
  }
`;

const Badge = styled.div`
  width: 20px;
  height: 20px;
  border-radius: ${T.radius.badge};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  transition: background 0.35s, border-color 0.35s, box-shadow 0.35s, color 0.35s;

  ${({ $state }) =>
    $state === 'done' ? css`
      background:  ${T.green};
      border:      1.5px solid ${T.green};
      color:       #ffffff;
      box-shadow:  0 0 0 3px ${T.greenRing};
      animation:   ${tickPop} 0.34s cubic-bezier(0.22,1,0.36,1) both;
    ` : $state === 'active' ? css`
      background:  ${T.blue};
      border:      1.5px solid ${T.blue};
      color:       #ffffff;
      box-shadow:  0 0 0 3px ${T.blueRing};
    ` : css`
      background:  transparent;
      border:      1.5px solid ${T.badgeBorder};
      color:       ${T.textMuted};
    `}
`;

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M2 5.2L4.1 7.4L8 3" stroke="white" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StepLabel = styled.span`
  flex: 1;
  font-size: 12.5px;
  font-weight: ${({ $state }) => $state === 'active' ? 500 : 400};
  color: ${({ $state }) =>
    $state === 'active' ? T.textPrimary :
    $state === 'done'   ? T.textSecondary :
    T.textMuted};
  transition: color 0.3s, font-weight 0.3s;
`;

const MiniTrack = styled.div`
  width: 40px;
  height: 2px;
  border-radius: 999px;
  background: ${T.stepBorder};
  overflow: hidden;
  flex-shrink: 0;
`;

const MiniFill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: ${({ $state }) => $state === 'done' ? T.green : T.blue};
  transition: background 0.35s;

  ${({ $state }) =>
    $state === 'done' ? css`
      width: 100%;
      transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1), background 0.35s;
    ` : $state === 'active' ? css`
      width: 0%;
      animation: ${barSweep} ${STEP_DURATION}ms ease forwards;
    ` : css`
      width: 0%;
    `}
`;

// ── Hint ─────────────────────────────────────────────────────────────────────

const Hint = styled.div`
  width: 100%;
  border-radius: ${T.radius.hint};
  background: ${T.hintBg};
  border: 1px solid ${T.hintBorder};
  padding: 10px 14px;
  font-size: 11.5px;
  color: ${T.hintText};
  line-height: 1.65;
  text-align: center;
  animation: ${hintReveal} 0.5s ease both;
`;

const Elapsed = styled.span`
  color: ${T.hintAmber};
  font-weight: 500;
`;

// ─────────────────────────────────────────────────────────────────────────────
// Component
//
// Props:
//   phase: 'checking' | 'waking' | 'ready'  (from App.jsx / useServerWake)
//
// Step advancement logic:
//   • An internal timer fires every STEP_DURATION ms to advance the visual step.
//   • The timer is capped: it will NOT advance to the final step (index 3)
//     unless the real server phase is 'ready'. This keeps the UI honest —
//     we never show "Ready to go" before the server has confirmed it is up.
//   • When phase becomes 'ready' and the timer hasn't reached the last step
//     yet, we immediately jump to it.
// ─────────────────────────────────────────────────────────────────────────────

const ServerWakeScreen = ({ phase = 'checking' }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed]       = useState(0);
  const stepRef = useRef(0);

  // ── Step auto-advance timer ──────────────────────────────────────────────
  // Advances one step at a time, but stops at STEPS.length - 2 until the
  // server confirms it is ready (phase === 'ready').
  const LAST_STEP    = STEPS.length - 1;
  const PENULTIMATE  = STEPS.length - 2; // stop here until server is ready

  useEffect(() => {
    const id = setInterval(() => {
      const cap = phase === 'ready' ? LAST_STEP : PENULTIMATE;
      if (stepRef.current < cap) {
        stepRef.current += 1;
        setActiveStep(stepRef.current);
      }
    }, STEP_DURATION);

    return () => clearInterval(id);
  }, [phase]); // re-run when phase changes so the cap updates immediately

  // ── Jump to final step when server becomes ready ─────────────────────────
  // If the timer is stuck on penultimate (e.g. server was slow) and phase
  // just flipped to 'ready', advance immediately rather than waiting for
  // the next tick.
  useEffect(() => {
    if (phase === 'ready' && stepRef.current < LAST_STEP) {
      stepRef.current = LAST_STEP;
      setActiveStep(LAST_STEP);
    }
  }, [phase]);

  // ── Elapsed timer for the hint ───────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const showHint    = elapsed >= 8;
  const showElapsed = elapsed > 15;

  return (
    <>
      <GlobalStyle />
      <Overlay role="status" aria-live="polite" aria-label="MockMate is starting up">
        <Card>

          {/* ── Icon ── */}
          <IconStage aria-hidden="true">
            <Ring $delay={0}    />
            <Ring $delay={0.87} />
            <Ring $delay={1.74} />
            <Core />
          </IconStage>

          {/* ── Title ── */}
          <Title>MockMate</Title>

          {/* ── Status ── */}
          <StatusRow>
            {/* key forces re-mount → fadeSlideUp replays on each step change */}
            <StatusText key={activeStep}>
              {STEPS[activeStep].status}
            </StatusText>
            <Dots aria-hidden="true">
              <Dot $delay={0}   />
              <Dot $delay={0.2} />
              <Dot $delay={0.4} />
            </Dots>
          </StatusRow>

          {/* ── Global progress bar ── */}
          <ProgressTrack aria-hidden="true">
            <ProgressFill $pct={PROGRESS_MAP[activeStep]} />
          </ProgressTrack>

          {/* ── Steps ── */}
          <StepList>
            {STEPS.map((step, i) => {
              const state =
                i < activeStep  ? 'done'   :
                i === activeStep ? 'active' :
                'idle';

              return (
                <StepRow key={i} $state={state}>
                  <Badge $state={state}>
                    {state === 'done' ? <CheckIcon /> : i + 1}
                  </Badge>

                  <StepLabel $state={state}>
                    {step.label}
                  </StepLabel>

                  <MiniTrack aria-hidden="true">
                    {/*
                      key={`${i}-${activeStep}`} forces the MiniFill to remount
                      whenever activeStep changes, which restarts the barSweep
                      animation for the newly-active row and re-triggers the
                      width:100% snap for completed rows.
                    */}
                    <MiniFill
                      $state={state}
                      key={`${i}-${activeStep}`}
                    />
                  </MiniTrack>
                </StepRow>
              );
            })}
          </StepList>

          {/* ── Hint (appears after 8 s of being on wake screen) ── */}
          {showHint && (
            /* key forces re-mount if hint was hidden and shown again */
            <Hint key="hint">
              Free hosting sleeps after inactivity — first load takes ~30s.
              {showElapsed && (
                <> <Elapsed>{elapsed}s elapsed — still waking…</Elapsed></>
              )}
            </Hint>
          )}

        </Card>
      </Overlay>
    </>
  );
};

export default ServerWakeScreen;