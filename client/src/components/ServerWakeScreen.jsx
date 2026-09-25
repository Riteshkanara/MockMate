import { useEffect, useState, useRef, useCallback } from 'react';
import styled, { keyframes, createGlobalStyle, css } from 'styled-components';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  blue:      '#1A6EFF',
  blueDark:  '#1045C8',
  blueSoft:  '#EEF4FF',
  teal:      '#06B6D4',
  green:     '#16A34A',
  greenSoft: '#F0FDF4',
  greenBright:'#22C55E',
  textPri:   '#0A1628',
  textSec:   '#5A6478',
  textMuted: '#9CA3B8',
  stepBorder:'#E8ECF4',
  badgeBorder:'#CBD5E8',
  hintAmber: '#D97706',
  progBg:    '#E8ECF4',
  cardBorder:'#E2E8F4',
  pageBg:    '#EEF1F8',
  font: `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`,
  easeOut:      'cubic-bezier(.22,1,.36,1)',
  easeSpring:   'cubic-bezier(.34,1.56,.64,1)',
  easeStandard: 'cubic-bezier(.4,0,.2,1)',
};

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { label:'Establishing connection', emoji:'🔗', action:'Connecting to server',  aEmoji:'🔗' },
  { label:'Loading AI models',       emoji:'🧠', action:'Loading AI models',      aEmoji:'🧠' },
  { label:'Syncing data',            emoji:'🔄', action:'Syncing your data',       aEmoji:'🔄' },
  { label:'Ready to go',             emoji:'✨', action:'All systems ready',       aEmoji:'🎯' },
];
// progress % reached at the END of each step
const PROG = [10, 36, 66, 92];
const DUR  = 2600; // ms per step

// Matches CSS cubic-bezier(.22,1,.36,1) closely enough for smooth per-frame stepping
const easeOutFn = (x) => 1 - Math.pow(1 - x, 3);

const BURST_COLORS = [
  '#22C55E','#34D399','#6EE7B7',
  '#1A6EFF','#60A5FA','#A78BFA',
  '#FCD34D','#F9A8D4','#FB7185',
];

const ORBS = [
  { r:44, spd:0.030, sz:3.8, ph:0,   op:0.78 },
  { r:58, spd:0.019, sz:3.0, ph:130, op:0.56 },
  { r:72, spd:0.013, sz:2.4, ph:255, op:0.38 },
];

// ─── Inline SVG icons (white, 22×22) ─────────────────────────────────────────
const IconWifi = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path d="M2 7.5C5.5 3.8 16.5 3.8 20 7.5" stroke="white" strokeWidth="1.9" strokeLinecap="round"/>
    <path d="M5 10.8C7.5 8.3 14.5 8.3 17 10.8" stroke="white" strokeWidth="1.9" strokeLinecap="round"/>
    <path d="M8 14C9.2 12.7 12.8 12.7 14 14" stroke="white" strokeWidth="1.9" strokeLinecap="round"/>
    <circle cx="11" cy="17.5" r="1.5" fill="white"/>
  </svg>
);
const IconChip = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="5.5" y="5.5" width="11" height="11" rx="2.5" stroke="white" strokeWidth="1.8"/>
    <rect x="8.5" y="8.5" width="5"  height="5"  rx="1.2" fill="white"/>
    <line x1="11" y1="1.5"  x2="11" y2="4.5"  stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
    <line x1="11" y1="17.5" x2="11" y2="20.5" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
    <line x1="1.5"  y1="11" x2="4.5"  y2="11" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
    <line x1="17.5" y1="11" x2="20.5" y2="11" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
const IconDB = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <ellipse cx="11" cy="6" rx="7" ry="2.6" stroke="white" strokeWidth="1.8"/>
    <path d="M4 6v5c0 1.436 3.134 2.6 7 2.6s7-1.164 7-2.6V6"  stroke="white" strokeWidth="1.8"/>
    <path d="M4 11v5c0 1.436 3.134 2.6 7 2.6s7-1.164 7-2.6v-5" stroke="white" strokeWidth="1.8"/>
  </svg>
);
const IconSparkle = () => (
  <svg width="22" height="22" viewBox="0 0 52 52" fill="none" aria-hidden="true">
    <path d="M13 36V19l13 10 13-10v17" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="13" cy="19" r="2.2" fill="white" opacity="0.65"/>
    <circle cx="39" cy="19" r="2.2" fill="white" opacity="0.65"/>
    <path d="M18 39h16" stroke="rgba(255,255,255,0.40)" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const STEP_ICONS = [IconWifi, IconChip, IconDB, IconSparkle];

// ─── Keyframes ────────────────────────────────────────────────────────────────
const bgBloom = keyframes`
  0%   { opacity:0; transform:scale(.6); }
  45%  { opacity:1; }
  100% { opacity:0; transform:scale(1.8); }
`;
const cardRise = keyframes`
  from { opacity:0; transform:translateY(22px) scale(.95); }
  to   { opacity:1; transform:none; }
`;
const childRise = keyframes`
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:none; }
`;
const rowIn = keyframes`
  from { opacity:0; transform:translateX(-7px); }
  to   { opacity:1; transform:none; }
`;
const lblPop = keyframes`
  0%   { opacity:0; transform:translateY(5px); }
  100% { opacity:1; transform:none; }
`;

// Icon crossfade — soft blur+scale morph, no rotation fight
const iconOut = keyframes`
  0%   { opacity:1; transform:scale(1);    filter:blur(0); }
  100% { opacity:0; transform:scale(.82);  filter:blur(2px); }
`;
const iconIn = keyframes`
  0%   { opacity:0; transform:scale(1.16); filter:blur(3px); }
  60%  { opacity:1; }
  100% { opacity:1; transform:scale(1);    filter:blur(0); }
`;

const spin = keyframes`to { transform:rotate(360deg); }`;

const shimmer = keyframes`
  0%   { background-position:-200% center; }
  100% { background-position: 300% center; }
`;

const tpop = keyframes`
  0%   { transform:scale(.15) rotate(-25deg); opacity:0; }
  65%  { transform:scale(1.35) rotate(5deg);  opacity:1; }
  82%  { transform:scale(.92); }
  100% { transform:none; }
`;
const bglow = keyframes`
  0%   { box-shadow:0 0 0 0   rgba(22,163,74,.55); }
  65%  { box-shadow:0 0 0 7px rgba(22,163,74,0);   }
  100% { box-shadow:0 0 0 3px rgba(22,163,74,.13); }
`;
const rowShim = keyframes`
  0%   { background-position:-200% center; opacity:1; }
  100% { background-position: 300% center; opacity:0; }
`;
const heartbeat = keyframes`
  0%   { transform:scale(1);    }
  42%  { transform:scale(1.03); }
  100% { transform:scale(1);    }
`;

// ─── Global reset ─────────────────────────────────────────────────────────────
const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }
  }
`;

// ─── Styled components ────────────────────────────────────────────────────────
const PageBg = styled.div`
  position:fixed; inset:0;
  background:${T.pageBg};
  background-image:
    radial-gradient(ellipse 60% 40% at 28% 18%, rgba(26,110,255,.08) 0%, transparent 70%),
    radial-gradient(ellipse 50% 50% at 74% 82%, rgba(6,182,212,.05)  0%, transparent 70%);
  display:flex; align-items:center; justify-content:center;
  font-family:${T.font}; z-index:9999; overflow:hidden;
`;

const BgBloom = styled.div`
  position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(circle at 50% 50%, rgba(26,110,255,.12) 0%, transparent 60%);
  animation:${bgBloom} .95s ${T.easeOut} .04s both;
`;

const Card = styled.div`
  display:flex; flex-direction:column; align-items:center;
  width:332px; padding:0 0 20px;
  border-radius:22px; background:#fff;
  border:1px solid ${({$ready})=>$ready?'rgba(22,163,74,.35)':T.cardBorder};
  box-shadow:
    0 1px 3px  rgba(0,0,0,.04),
    0 6px 20px rgba(0,0,0,.07),
    0 28px 56px rgba(0,0,0,.07)
    ${({$ready})=>$ready?',0 0 0 4px rgba(22,163,74,.10)':''};
  animation:${cardRise} .65s ${T.easeOut} .12s both
    ${({$heartbeat})=>$heartbeat?css`, ${heartbeat} .55s ${T.easeOut} both`:''};
  transition:border-color .65s ease, box-shadow .65s ease;
  position:relative; overflow:hidden;
`;

const Hero = styled.div`
  width:100%; padding:22px 28px 18px;
  display:flex; flex-direction:column; align-items:center;
  border-bottom:1px solid #E3EAF8;
  position:relative; overflow:hidden;
  background:${({$ready})=>$ready
    ? 'linear-gradient(158deg,#F5FFF8 0%,#EDFBF2 55%,#E6F9ED 100%)'
    : 'linear-gradient(158deg,#F7F9FF 0%,#EFF3FF 55%,#E9EFFF 100%)'};
  transition:background 1.3s ${T.easeOut};
  &::before {
    content:''; position:absolute; inset:0;
    background-image:radial-gradient(circle, rgba(26,110,255,.13) 1px, transparent 1px);
    background-size:20px 20px;
    mask-image:radial-gradient(ellipse 90% 85% at 50% 10%, black 20%, transparent 100%);
    pointer-events:none;
    opacity:${({$ready})=>$ready?.4:1};
    transition:opacity .8s ease;
  }
`;

const HeroDeco = styled.span`
  position:absolute;
  font-size:${({$sz})=>$sz||36}px;
  opacity:${({$op})=>$op||.055};
  pointer-events:none; user-select:none; line-height:1;
  top:${({$t})=>$t||'auto'};    bottom:${({$b})=>$b||'auto'};
  left:${({$l})=>$l||'auto'};   right:${({$r})=>$r||'auto'};
  transform:rotate(${({$rot})=>$rot||0}deg);
`;

const OrbWrap = styled.div`
  position:relative; width:106px; height:106px;
  margin-bottom:14px; flex-shrink:0; z-index:1;
  animation:${childRise} .5s ${T.easeOut} .28s both;
`;
const OrbCanvas = styled.canvas`
  position:absolute; inset:0; width:106px; height:106px;
`;

const Core = styled.div`
  position:absolute; top:50%; left:50%;
  transform:translate(-50%,-50%);
  width:48px; height:48px;
  border-radius:${({$ready})=>$ready?'50%':'15px'};
  display:flex; align-items:center; justify-content:center;
  background:${({$ready})=>$ready
    ? 'linear-gradient(145deg,#2DD46B 0%,#16A34A 100%)'
    : 'linear-gradient(145deg,#2278FF 0%,#1045C8 100%)'};
  box-shadow:${({$ready})=>$ready
    ? '0 0 0 1px rgba(255,255,255,.2) inset,0 2px 4px rgba(22,163,74,.28),0 6px 18px rgba(34,197,94,.42),0 0 0 6px rgba(22,163,74,.11)'
    : '0 0 0 1px rgba(255,255,255,.2) inset,0 2px 4px rgba(16,69,200,.28),0 6px 18px rgba(26,110,255,.38),0 0 0 6px rgba(26,110,255,.09)'};
  transition:
    background    .85s ${T.easeOut},
    box-shadow    .85s ${T.easeOut},
    border-radius .6s  ${T.easeSpring};
  z-index:2;
`;

// Icon crossfade — soft blur+scale morph, no rotation fight
const IconSlot = styled.div`
  width:24px; height:24px; position:relative;
  display:flex; align-items:center; justify-content:center;
`;
const IconLayer = styled.div`
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  will-change:opacity, transform, filter;
  ${({$exiting})=>$exiting&&css`
    animation:${iconOut} .32s ${T.easeStandard} forwards;
  `}
  ${({$entering})=>$entering&&css`
    animation:${iconIn} .42s ${T.easeOut} .12s backwards;
  `}
`;

const Wordmark = styled.div`
  display:flex; flex-direction:column; align-items:center; gap:7px;
  position:relative; z-index:1;
  animation:${childRise} .5s ${T.easeOut} .40s both;
`;
const AppName = styled.h1`
  font-size:18px; font-weight:600; color:${T.textPri};
  letter-spacing:-.45px; line-height:1;
`;

const StatusPill = styled.div`
  display:inline-flex; align-items:center; gap:6px;
  padding:4px 11px 4px 7px; border-radius:999px;
  background:${({$ready})=>$ready?'rgba(22,163,74,.08)':'rgba(26,110,255,.08)'};
  border:1px solid ${({$ready})=>$ready?'rgba(22,163,74,.18)':'rgba(26,110,255,.15)'};
  transition:background .55s ease, border-color .55s ease;
`;
const SpinnerArc = styled.circle`
  fill:none;
  stroke:${({$ready})=>$ready?T.green:T.blue};
  stroke-width:2; stroke-linecap:round;
  stroke-dasharray:24; stroke-dashoffset:${({$ready})=>$ready?0:18};
  transform-origin:6.5px 6.5px;
  animation:${({$ready})=>$ready?'none':css`${spin} 1.05s linear infinite`};
  transition:stroke .5s ease, stroke-dashoffset .4s ease;
`;
const PillText = styled.span`
  font-size:11.5px; font-weight:500; letter-spacing:.01em; white-space:nowrap;
  color:${({$ready})=>$ready?T.green:T.blue};
  transition:color .5s ease;
`;

const ActionLabel = styled.p`
  margin-top:11px; font-size:12px; font-weight:400;
  color:${({$ready})=>$ready?T.green:T.textSec};
  min-height:17px; position:relative; z-index:1;
  display:flex; align-items:center; gap:5px;
  transition:color .45s ease;
  animation:${({$init})=>$init
    ? css`${childRise} .5s ${T.easeOut} .50s both`
    : css`${lblPop} .32s ${T.easeOut} both`};
`;

const Lower = styled.div`
  width:100%; padding:14px 20px 0;
  display:flex; flex-direction:column;
`;

const ProgTrack = styled.div`
  height:2.5px; border-radius:999px;
  background:${T.progBg}; overflow:hidden; margin-bottom:12px;
`;
// Width is now driven purely by a rAF loop via inline style — no CSS width
// transition fighting a keyframe. Only the background-color eases.
const ProgFill = styled.div`
  height:100%; border-radius:999px;
  background:${({$ready})=>$ready
    ? `linear-gradient(90deg,${T.green},${T.greenBright})`
    : `linear-gradient(90deg,${T.blue},${T.teal})`};
  position:relative; overflow:hidden;
  transition:background 1.1s ${T.easeOut};
  &::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.55) 50%,transparent);
    background-size:200% 100%;
    animation:${shimmer} 1.6s linear infinite;
  }
`;

const StepList = styled.div`
  border:1px solid ${T.stepBorder};
  border-radius:12px; overflow:hidden; background:#fff;
`;

const StepRow = styled.div`
  display:flex; align-items:center; gap:9px;
  padding:9px 12px;
  border-bottom:1px solid ${T.stepBorder};
  &:last-child { border-bottom:none; }
  position:relative; overflow:hidden;
  background:${({$s})=>$s==='active'?T.blueSoft:$s==='done'?T.greenSoft:'#fff'};
  transition:background .48s ${T.easeStandard};
  animation:${rowIn} .45s ${T.easeOut} ${({$delay})=>$delay}ms both;
  ${({$shimmer})=>$shimmer&&css`
    &::after {
      content:''; position:absolute; inset:0;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.75) 50%,transparent);
      background-size:200% 100%;
      animation:${rowShim} .6s ${T.easeStandard} both;
    }
  `}
`;

const StepEmoji = styled.span`
  font-size:14px; line-height:1; flex-shrink:0; width:18px; text-align:center;
  transform:${({$done})=>$done?'scale(1.15)':'scale(1)'};
  transition:transform .4s ${T.easeSpring};
`;

const Badge = styled.div`
  width:18px; height:18px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0; font-size:8.5px; font-weight:600; line-height:1;
  border:1.5px solid ${T.badgeBorder};
  color:${T.textMuted}; background:transparent;
  transition:background .36s ${T.easeStandard}, border-color .36s ${T.easeStandard},
             color .36s ${T.easeStandard}, box-shadow .36s ${T.easeStandard};
  ${({$s})=>$s==='active'&&css`
    background:${T.blue}; border-color:${T.blue};
    color:#fff; box-shadow:0 0 0 3px rgba(26,110,255,.16);
  `}
  ${({$s})=>$s==='done'&&css`
    background:${T.green}; border-color:${T.green};
    color:#fff; animation:${bglow} .5s ${T.easeStandard} both;
  `}
`;

const CheckSvg = styled.svg`
  width:10px; height:10px;
  path { animation:${tpop} .42s ${T.easeOut} both; }
`;

const StepLabel = styled.span`
  flex:1; font-size:12px;
  font-weight:${({$s})=>$s==='active'?500:400};
  color:${({$s})=>$s==='active'?T.textPri:$s==='done'?T.textSec:T.textMuted};
  transition:color .32s ease, font-weight .2s ease;
`;

const MiniTrack = styled.div`
  width:36px; height:2px; border-radius:999px;
  background:${T.stepBorder}; overflow:hidden; flex-shrink:0;
`;
// Width for the active row is driven via inline style by the same rAF loop
// that drives the main progress bar — they're always perfectly in sync.
const MiniFill = styled.div`
  height:100%; border-radius:999px; position:relative; overflow:hidden;
  background:${({$s})=>$s==='done'?T.green:$s==='active'
    ? `linear-gradient(90deg,${T.blue},${T.teal})`
    : T.stepBorder};
  transition:${({$s})=>$s==='done'?`width .48s ${T.easeOut}, background .3s ease`:'background .3s ease'};
  ${({$s})=>$s==='active'&&css`
    &::after {
      content:''; position:absolute; inset:0;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.7) 50%,transparent);
      background-size:200% 100%;
      animation:${shimmer} 1.2s linear infinite;
    }
  `}
`;

const HintBox = styled.div`
  margin:10px 20px 0;
  border-radius:9px; background:#F5F7FC;
  border:1px solid ${T.stepBorder};
  padding:8px 12px;
  font-size:11px; color:${T.textSec}; line-height:1.6; text-align:center;
  animation:${childRise} .45s ease both;
`;
const HintAmber = styled.span`color:${T.hintAmber}; font-weight:500;`;

// ─── Orbital canvas + burst hook ──────────────────────────────────────────────
function useOrbitalCanvas(canvasRef, isReady, burstRef) {
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    cv.width  = 212;
    cv.height = 212;
    const C = 106;
    let t0 = null, lastTs = null, raf;

    const draw = (ts) => {
      if (!t0) t0 = ts;
      if (!lastTs) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;

      const t = ts - t0;
      const ready = isReady;
      const rb = ready ? 'rgba(22,163,74,' : 'rgba(26,110,255,';
      const pc = ready ? '#22C55E' : '#3B82F6';
      const gb = ready ? 'rgba(34,197,94,' : 'rgba(26,110,255,';

      ctx.clearRect(0, 0, 212, 212);

      ORBS.forEach(o => {
        ctx.beginPath();
        ctx.arc(C, C, o.r, 0, Math.PI * 2);
        ctx.strokeStyle = rb + (o.op * .20) + ')';
        ctx.lineWidth   = 1;
        ctx.setLineDash([2, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        const a  = ((t * o.spd + o.ph) % 360) * Math.PI / 180;
        const px = C + o.r * Math.cos(a);
        const py = C + o.r * Math.sin(a);

        const g = ctx.createRadialGradient(px, py, 0, px, py, o.sz * 3.5);
        g.addColorStop(0, gb + (o.op * .55) + ')');
        g.addColorStop(1, gb + '0)');
        ctx.beginPath();
        ctx.arc(px, py, o.sz * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, o.sz, 0, Math.PI * 2);
        ctx.fillStyle   = pc;
        ctx.globalAlpha = o.op;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // burst particles — frame-rate independent using dt
      const dtScale = dt / 16.6667;
      const burst = burstRef.current;
      burst.forEach(p => {
        if (p.life <= 0) return;
        p.x   += p.vx * .016 * dtScale;
        p.y   += p.vy * .016 * dtScale;
        p.vx  *= Math.pow(.91, dtScale);
        p.vy  *= Math.pow(.91, dtScale);
        p.life -= p.decay * dtScale;
        const ease = p.life > .5 ? 1 : p.life * 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * ease, 0, Math.PI * 2);
        ctx.fillStyle   = p.color;
        ctx.globalAlpha = Math.max(0, p.life * .9);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isReady]);
}

// ─── Main component ───────────────────────────────────────────────────────────
const ServerWakeScreen = ({ phase = 'checking' }) => {
  const [activeStep,   setActiveStep]   = useState(0);
  const [iconCurrent,  setIconCurrent]  = useState(0);
  const [iconPrev,     setIconPrev]     = useState(null);
  const [elapsed,      setElapsed]      = useState(0);
  const [shimRow,      setShimRow]      = useState(null);
  const [heartbeating, setHeartbeating] = useState(false);
  const [labelKey,     setLabelKey]     = useState(0);
  const [initDone,     setInitDone]     = useState(false);
  // progress % re-rendered from the rAF loop via state, throttled to ~60fps naturally by rAF
  const [progPct,      setProgPct]      = useState(0);
  const [miniPct,      setMiniPct]      = useState(0);

  const stepRef      = useRef(0);
  const canvasRef     = useRef(null);
  const burstRef      = useRef([]);
  const progFromRef   = useRef(0);
  const progToRef     = useRef(PROG[0]);
  const stepStartRef  = useRef(null);

  const LAST = STEPS.length - 1;
  const PEN  = STEPS.length - 2;
  const isReady = phase === 'ready' && activeStep === LAST;

  useEffect(() => {
    const t = setTimeout(() => setInitDone(true), 600);
    return () => clearTimeout(t);
  }, []);

  const launchBurst = useCallback(() => {
    burstRef.current = Array.from({ length: 9 }, (_, i) => {
      const angle = (i / 9) * Math.PI * 2 + Math.random() * .4;
      const speed = 38 + Math.random() * 32;
      return {
        x: 106, y: 106,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2.8 + Math.random() * 2.4,
        color: BURST_COLORS[i % BURST_COLORS.length],
        life: 1,
        decay: .016 + Math.random() * .012,
      };
    });
  }, []);

  useOrbitalCanvas(canvasRef, isReady, burstRef);

  // ── Single continuous rAF driver for BOTH the main bar and the active
  //    mini-bar. They read from the same clock, so they can never disagree
  //    or visually "jump" relative to each other — true glide, every frame.
  useEffect(() => {
    let raf;
    const tick = (ts) => {
      if (stepStartRef.current === null) stepStartRef.current = ts;
      const elapsedInStep = ts - stepStartRef.current;
      const rawT  = Math.min(1, elapsedInStep / DUR);
      const eased = easeOutFn(rawT);
      const current = progFromRef.current + (progToRef.current - progFromRef.current) * eased;
      setProgPct(current);
      setMiniPct(rawT * 88);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const advanceProgressTarget = useCallback((newStepIndex) => {
    progFromRef.current  = progPct;      // continue smoothly from current visual position
    progToRef.current    = PROG[newStepIndex];
    stepStartRef.current = null;         // reset clock; will be set on next tick
  }, [progPct]);

  useEffect(() => {
    const id = setInterval(() => {
      const cap = phase === 'ready' ? LAST : PEN;
      if (stepRef.current < cap) {
        const prev = stepRef.current;
        const next = prev + 1;
        stepRef.current = next;

        setShimRow(prev);
        setTimeout(() => setShimRow(null), 640);

        setIconPrev(prev);
        setTimeout(() => setIconPrev(null), 320);
        setIconCurrent(next);

        setActiveStep(next);
        setLabelKey(k => k + 1);
        advanceProgressTarget(next);
      }
    }, DUR);
    return () => clearInterval(id);
  }, [phase, advanceProgressTarget]);

  useEffect(() => {
    if (phase === 'ready' && stepRef.current < LAST) {
      const prev = stepRef.current;
      stepRef.current = LAST;

      setShimRow(prev);
      setTimeout(() => setShimRow(null), 640);

      setIconPrev(prev);
      setTimeout(() => setIconPrev(null), 320);
      setIconCurrent(LAST);

      setActiveStep(LAST);
      setLabelKey(k => k + 1);
      advanceProgressTarget(LAST);
    }
  }, [phase, advanceProgressTarget]);

  useEffect(() => {
    if (!isReady) return;
    const t1 = setTimeout(() => launchBurst(), 350);
    const t2 = setTimeout(() => {
      setHeartbeating(true);
      setTimeout(() => setHeartbeating(false), 620);
    }, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isReady, launchBurst]);

  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const CurrentIcon = STEP_ICONS[iconCurrent];
  const PrevIcon    = iconPrev !== null ? STEP_ICONS[iconPrev] : null;
  const s = STEPS[activeStep];

  return (
    <>
      <GlobalStyle/>
      <PageBg role="status" aria-live="polite" aria-label="MockMate is starting up">
        <BgBloom aria-hidden="true"/>

        <Card $ready={isReady} $heartbeat={heartbeating}>

          <Hero $ready={isReady}>
            <HeroDeco aria-hidden="true" $t="12px" $l="14px" $rot={-14}>🎤</HeroDeco>
            <HeroDeco aria-hidden="true" $b="14px" $r="12px" $rot={12}>📊</HeroDeco>
            <HeroDeco aria-hidden="true" $t="10px" $r="16px" $rot={8} $sz={28} $op={.04}>🏆</HeroDeco>

            <OrbWrap aria-hidden="true">
              <OrbCanvas ref={canvasRef}/>
              <Core $ready={isReady}>
                <IconSlot>
                  {PrevIcon && (
                    <IconLayer key={`exit-${iconPrev}`} $exiting>
                      <PrevIcon/>
                    </IconLayer>
                  )}
                  <IconLayer key={`enter-${iconCurrent}`} $entering>
                    <CurrentIcon/>
                  </IconLayer>
                </IconSlot>
              </Core>
            </OrbWrap>

            <Wordmark>
              <AppName>MockMate</AppName>
              <StatusPill $ready={isReady}>
                {!isReady ? (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="rgba(26,110,255,.2)" strokeWidth="2"/>
                    <SpinnerArc cx="6.5" cy="6.5" r="4.5" $ready={false}/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="5.5" fill={T.green}/>
                    <path d="M3.5 6.8L5.5 8.8L9.5 4.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                <PillText $ready={isReady}>
                  {isReady ? '🎯 Ready to launch' : 'Waking up…'}
                </PillText>
              </StatusPill>
            </Wordmark>

            <ActionLabel key={labelKey} $ready={isReady} $init={!initDone}>
              <span aria-hidden="true">{s.aEmoji}</span>
              <span>{s.action}</span>
            </ActionLabel>
          </Hero>

          <Lower>
            <ProgTrack aria-hidden="true">
              {/* width driven by rAF-derived state — glides every frame */}
              <ProgFill style={{ width: `${progPct}%` }} $ready={isReady}/>
            </ProgTrack>

            <StepList>
              {STEPS.map((st, i) => {
                const state = i < activeStep ? 'done' : i === activeStep ? 'active' : 'idle';
                return (
                  <StepRow
                    key={i}
                    $s={state}
                    $delay={550 + i * 60}
                    $shimmer={shimRow === i}
                  >
                    <StepEmoji aria-hidden="true" $done={state === 'done'}>
                      {st.emoji}
                    </StepEmoji>

                    <Badge $s={state}>
                      {state === 'done' ? (
                        <CheckSvg viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5.2L3.8 7.8L8.5 2.8"
                                stroke="white" strokeWidth="1.6"
                                strokeLinecap="round" strokeLinejoin="round"/>
                        </CheckSvg>
                      ) : i + 1}
                    </Badge>

                    <StepLabel $s={state}>{st.label}</StepLabel>

                    <MiniTrack aria-hidden="true">
                      <MiniFill
                        $s={state}
                        style={state === 'active' ? { width: `${miniPct}%` } : undefined}
                      />
                    </MiniTrack>
                  </StepRow>
                );
              })}
            </StepList>
          </Lower>

          {elapsed >= 8 && (
            <HintBox>
              ⏳ Free hosting sleeps after inactivity — first load takes ~15s.
              {elapsed > 15 && <HintAmber> {elapsed}s elapsed…</HintAmber>}
            </HintBox>
          )}

        </Card>
      </PageBg>
    </>
  );
};

export default ServerWakeScreen;