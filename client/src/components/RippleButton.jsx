/**
 * RippleButton — Button with Material-style ripple on click
 * ─────────────────────────────────────────────────────────────────────────
 * Drop-in for any button that needs the tactile ripple feedback.
 * Inherits all Button props plus rippleColor.
 *
 * Usage:
 *   <RippleButton onClick={...}>Click me</RippleButton>
 */
import { useRef, useState } from 'react';

const RippleButton = ({
  children,
  onClick,
  rippleColor = 'rgba(255,255,255,0.3)',
  style = {},
  className = '',
  disabled = false,
  ...rest
}) => {
  const [ripples, setRipples] = useState([]);
  const containerRef = useRef(null);

  const handleClick = (e) => {
    if (disabled) return;

    const rect = containerRef.current.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top  - size / 2;
    const id = Date.now();

    setRipples(prev => [...prev, { id, x, y, size }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 700);

    if (onClick) onClick(e);
  };

  return (
    <button
      ref={containerRef}
      onClick={handleClick}
      disabled={disabled}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      className={className}
      {...rest}
    >
      {ripples.map(({ id, x, y, size }) => (
        <span
          key={id}
          style={{
            position: 'absolute',
            left: x, top: y,
            width: size, height: size,
            borderRadius: '50%',
            background: rippleColor,
            animation: 'mm-ripple 0.65s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            pointerEvents: 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes mm-ripple {
          from { transform: scale(0); opacity: 0.6; }
          to   { transform: scale(1); opacity: 0; }
        }
      `}</style>
      {children}
    </button>
  );
};

export default RippleButton;