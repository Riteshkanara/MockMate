/**
 * ConfettiScore — Score reveal with canvas confetti burst
 * ─────────────────────────────────────────────────────────────────────────
 * Shows a number score that pops in with a brief confetti burst.
 * Fires once on mount if score >= 70, twice if >= 85.
 *
 * No external confetti library needed — pure canvas.
 *
 * Props:
 *   score    number   0-100
 *   size     number   font-size in px
 *   color    string   hex color
 */
import { useEffect, useRef } from 'react';

const randomBetween = (a, b) => a + Math.random() * (b - a);
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const COLORS = ['#1A6EFF', '#00C8F0', '#059669', '#D97706', '#6D5BEE', '#00ADE0'];

const ConfettiScore = ({ score = 0, size = 64, color = '#1A6EFF', style = {} }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (score < 65) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const count = score >= 85 ? 80 : 45;

    const particles = Array.from({ length: count }, () => ({
      x: W / 2 + randomBetween(-20, 20),
      y: H / 2 + randomBetween(-10, 10),
      vx: randomBetween(-5, 5),
      vy: randomBetween(-8, -2),
      size: randomBetween(3, 7),
      color: randomFrom(COLORS),
      opacity: 1,
      rotation: randomBetween(0, 360),
      rotV: randomBetween(-4, 4),
      shape: randomFrom(['rect', 'circle', 'line']),
    }));

    let frame;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      let anyAlive = false;
      particles.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.22; // gravity
        p.vx *= 0.99;
        p.rotation += p.rotV;
        p.opacity -= 0.018;
        if (p.opacity <= 0) return;
        anyAlive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-p.size / 2, 0);
          ctx.lineTo(p.size / 2, 0);
          ctx.stroke();
        }
        ctx.restore();
      });
      if (anyAlive) frame = requestAnimationFrame(tick);
    };

    // Delay slightly so score animation plays first
    const delay = setTimeout(() => { frame = requestAnimationFrame(tick); }, 400);
    return () => { clearTimeout(delay); cancelAnimationFrame(frame); };
  }, [score]);

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <span style={{
        position: 'relative', zIndex: 2,
        fontSize: size,
        fontWeight: 900,
        color,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: '-2px',
        lineHeight: 1,
        animation: 'mm-score-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}>
        {Math.round(score)}
      </span>
    </div>
  );
};

export default ConfettiScore;
