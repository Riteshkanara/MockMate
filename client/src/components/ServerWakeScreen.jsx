import { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

const MESSAGES = [
  'Starting up MockMate...',
  'Waking the server...',
  'Almost there...',
];


const ServerWakeScreen = () => {
  const [msgIndex, setMsgIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);   

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {                             
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Overlay>
      <Card>
        <Logo>⚡</Logo>
        <Title>MockMate</Title>
        <Subtitle>{MESSAGES[msgIndex]}</Subtitle>
        <LoaderTrack>
          <LoaderBar />
        </LoaderTrack>
        // AFTER
<Hint>
  {elapsed > 15
    ? `Still waking... ${elapsed}s elapsed`
    : 'Free hosting spins down after inactivity — takes ~30 s on first visit'}
</Hint>
      </Card>
    </Overlay>
  );
};

// ── Animations ─────────────────────────────────────────────────────────────
const moving = keyframes`
  50%  { width: 100%; }
  100% { width: 0; right: 0; left: unset; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ── Styled components ──────────────────────────────────────────────────────
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F7F9FF;
  z-index: 9999;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  animation: ${fadeIn} 0.35s ease;
`;

const Logo = styled.div`
  font-size: 40px;
  line-height: 1;
  margin-bottom: 4px;
`;

const Title = styled.h1`
  margin: 0;
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #0A1628;
  letter-spacing: -0.3px;
`;

const Subtitle = styled.p`
  margin: 0;
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #1A6EFF;
  min-height: 20px;
`;

const LoaderTrack = styled.div`
  width: 130px;
  height: 4px;
  border-radius: 30px;
  background: rgba(26, 110, 255, 0.15);
  position: relative;
  margin-top: 4px;
`;

const LoaderBar = styled.div`
  position: absolute;
  background: #1A6EFF;
  top: 0; left: 0;
  width: 0%;
  height: 100%;
  border-radius: 30px;
  animation: ${moving} 1s ease-in-out infinite;
`;

const Hint = styled.p`
  margin: 8px 0 0;
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 11px;
  color: #9AA5B8;
  text-align: center;
  max-width: 260px;
  line-height: 1.5;
`;

export default ServerWakeScreen;
