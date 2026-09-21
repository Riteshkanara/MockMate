import { useEffect, useState, useRef } from 'react';
import styled, { keyframes } from 'styled-components';

// ── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  'Waking the server',
  'Loading models',
  'Connecting services',
  'Almost ready',
];

const MESSAGES = [
  'Starting up…',
  'Waking the server…',
  'Loading models…',
  'Connecting services…',
  'Almost there…',
];

// ── Keyframes ────────────────────────────────────────────────────────────────
const pulseRing = keyframes`
  0%   { transform: scale(0.82); opacity: 0.6; }
  100% { transform: scale(1.7);  opacity: 0; }
`;
const orbit0 = keyframes`
  from { transform: rotate(0deg)   translateX(34px) rotate(0deg); }
  to   { transform: rotate(360deg) translateX(34px) rotate(-360deg); }
`;
const orbit1 = keyframes`
  from { transform: rotate(120deg) translateX(34px) rotate(-120deg); }
  to   { transform: rotate(480deg) translateX(34px) rotate(-480deg); }
`;
const orbit2 = keyframes`
  from { transform: rotate(240deg) translateX(34px) rotate(-240deg); }
  to   { transform: rotate(600deg) translateX(34px) rotate(-600deg); }
`;
const shimmer = keyframes`
  0%   { background-position: -240% 0; }
  100% { background-position: 240% 0; }
`;
const cardIn = keyframes`
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
`;
const statusIn = keyframes`
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const dot1anim = keyframes`0%,60%,100%{opacity:.25} 20%{opacity:1}`;
const dot2anim = keyframes`0%,60%,100%{opacity:.25} 40%{opacity:1}`;
const dot3anim = keyframes`0%,60%,100%{opacity:.25} 60%{opacity:1}`;
const amberFill = keyframes`
  from { width: 0%; }
  to   { width: 100%; }
`;
const tickPop = keyframes`
  0%   { transform: scale(0.4); opacity: 0; }
  60%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1);   opacity: 1; }
`;

// ── Styled components ────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F0F2F7;
  /* Subtle blue + indigo radial tints */
  background-image:
    radial-gradient(circle at 30% 20%, rgba(26,110,255,0.06) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(99,102,241,0.05) 0%, transparent 50%);
  z-index: 9999;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 44px 36px 32px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.07);
  width: 320px;
  animation: ${cardIn} 0.42s cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.06),
    0 20px 48px rgba(0, 0, 0, 0.08);
`;

// Icon stage
const IconStage = styled.div`
  position: relative;
  width: 80px; height: 80px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 22px;
`;

const Ring = styled.div`
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 1.5px solid rgba(26, 110, 255, 0.4);
  animation: ${pulseRing} 2.2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
  animation-delay: ${(p) => p.$delay ?? 0}s;
`;

const Core = styled.div`
  position: relative; z-index: 1;
  width: 54px; height: 54px;
  border-radius: 15px;
  background: linear-gradient(135deg, #1A6EFF 0%, #3B8EFF 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  box-shadow:
    0 0 0 4px rgba(26, 110, 255, 0.10),
    0 6px 20px rgba(26, 110, 255, 0.30);
`;

const Dot = styled.div`
  position: absolute;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #1A6EFF;
  top: 50%; left: 50%;
  margin: -3px;
  opacity: ${(p) => p.$opacity};
  animation: ${(p) => p.$anim} 2.6s linear infinite;
`;

// Title & status
const Title = styled.div`
  font-size: 20px; font-weight: 600;
  color: #0D1B3E;
  letter-spacing: -0.35px;
  margin-bottom: 4px;
`;

const StatusRow = styled.div`
  display: flex; align-items: center; gap: 5px;
  min-height: 20px;
  margin-bottom: 20px;
`;

const StatusText = styled.span`
  font-size: 13px; font-weight: 500;
  color: #1A6EFF;
  animation: ${statusIn} 0.28s ease;
`;

const DotsWrap = styled.span`display: flex; gap: 3px; align-items: center;`;
const DotBase = styled.span`
  display: inline-block;
  width: 3px; height: 3px;
  border-radius: 50%;
  background: #1A6EFF;
`;
const D1 = styled(DotBase)`animation: ${dot1anim} 1.2s ease-in-out infinite;`;
const D2 = styled(DotBase)`animation: ${dot2anim} 1.2s ease-in-out infinite;`;
const D3 = styled(DotBase)`animation: ${dot3anim} 1.2s ease-in-out infinite;`;

// Shimmer bar
const ShimmerTrack = styled.div`
  width: 200px; height: 3px;
  border-radius: 999px;
  background: #E8ECF4;
  overflow: hidden;
  margin-bottom: 24px;
`;
const ShimmerBar = styled.div`
  height: 100%; border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(26,110,255,0.4) 30%,
    #1A6EFF 55%,
    rgba(26,110,255,0.4) 70%,
    transparent 100%
  );
  background-size: 240% 100%;
  animation: ${shimmer} 1.8s ease-in-out infinite;
`;

// Steps
const StepList = styled.div`
  display: flex; flex-direction: column; gap: 0;
  width: 100%;
  margin-bottom: 20px;
  border: 1px solid #EEF1F8;
  border-radius: 12px;
  overflow: hidden;
`;

const StepRow = styled.div`
  display: flex; align-items: center; gap: 10px;
  font-size: 13px;
  padding: 10px 14px;
  border-bottom: 1px solid #EEF1F8;
  transition: background 0.3s, color 0.3s;
  background: ${(p) => p.$active ? '#F7F9FF' : p.$done ? '#FAFBFF' : '#ffffff'};
  color: ${(p) => p.$active ? '#0D1B3E' : p.$done ? '#6B7280' : '#A0AABF'};
  font-weight: ${(p) => p.$active ? 500 : 400};

  &:last-child { border-bottom: none; }
`;

const StepIcon = styled.div`
  width: 20px; height: 20px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; flex-shrink: 0;
  font-weight: 600;
  transition: background 0.3s, border-color 0.3s, box-shadow 0.3s, color 0.3s;

  ${(p) =>
    p.$done
      ? `
        background: #16A34A;
        border: 1.5px solid #16A34A;
        color: #fff;
        box-shadow: 0 0 0 3px rgba(22,163,74,0.12);
        animation: ${tickPop} 0.35s cubic-bezier(0.22,1,0.36,1);
      `
      : p.$active
      ? `
        background: #1A6EFF;
        border: 1.5px solid #1A6EFF;
        color: #fff;
        box-shadow: 0 0 0 3px rgba(26,110,255,0.15);
      `
      : `
        background: transparent;
        border: 1.5px solid #D8DDE8;
        color: #A0AABF;
      `}
`;

const MiniTrack = styled.div`
  flex: 1; height: 2px;
  border-radius: 999px;
  background: #EEF1F8;
  overflow: hidden;
`;

const MiniFill = styled.div`
  height: 100%; border-radius: 999px;
  width: ${(p) => (p.$done ? '100%' : '0%')};
  background: ${(p) => (p.$done ? '#16A34A' : '#1A6EFF')};
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  animation: ${(p) => (p.$active && !p.$done ? amberFill : 'none')} 2.4s ease forwards;
`;

// Hint
const Hint = styled.div`
  font-size: 11.5px; color: #8A95A8;
  text-align: center; line-height: 1.6;
  padding: 10px 14px;
  border-radius: 10px;
  background: #F5F7FC;
  border: 1px solid #E8ECF4;
  width: 100%;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : '4px')});
  transition: opacity 0.5s, transform 0.5s;
`;

const ElapsedTag = styled.span`
  color: #D97706;
  font-weight: 600;
`;

// ── Component ────────────────────────────────────────────────────────────────
const ServerWakeScreen = () => {
  const [msgIdx,      setMsgIdx]      = useState(0);
  const [activeStep,  setActiveStep]  = useState(0);
  const [elapsed,     setElapsed]     = useState(0);
  const msgRef  = useRef(0);
  const stepRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      msgRef.current = (msgRef.current + 1) % MESSAGES.length;
      setMsgIdx(msgRef.current);

      if (stepRef.current < STEPS.length - 1) {
        stepRef.current += 1;
        setActiveStep(stepRef.current);
      }
    }, 2400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Overlay>
      <Card>
        {/* Icon */}
        <IconStage>
          <Ring $delay={0} />
          <Ring $delay={0.75} />
          <Ring $delay={1.5} />
          <Core>⚡</Core>
          <Dot $anim={orbit0} $opacity={0.85} />
          <Dot $anim={orbit1} $opacity={0.45} />
          <Dot $anim={orbit2} $opacity={0.20} />
        </IconStage>

        <Title>MockMate</Title>

        <StatusRow>
          {/* key forces remount → animation replays on each message change */}
          <StatusText key={msgIdx}>{MESSAGES[msgIdx]}</StatusText>
          <DotsWrap><D1 /><D2 /><D3 /></DotsWrap>
        </StatusRow>

        <ShimmerTrack><ShimmerBar /></ShimmerTrack>

        <StepList>
          {STEPS.map((label, i) => {
            const done   = i < activeStep;
            const active = i === activeStep;
            return (
              <StepRow key={i} $done={done} $active={active}>
                <StepIcon $done={done} $active={active}>
                  {done ? '✓' : active ? '●' : i + 1}
                </StepIcon>
                <span style={{ flex: 1 }}>{label}</span>
                <MiniTrack>
                  <MiniFill
                    $done={done}
                    $active={active}
                    key={`${i}-${activeStep}`}
                  />
                </MiniTrack>
              </StepRow>
            );
          })}
        </StepList>

        <Hint $visible={elapsed >= 8}>
          Free hosting sleeps after inactivity — first load takes ~30 s.
          {elapsed > 15 && (
            <> <ElapsedTag>{elapsed}s elapsed — still waking…</ElapsedTag></>
          )}
        </Hint>
      </Card>
    </Overlay>
  );
};

export default ServerWakeScreen;