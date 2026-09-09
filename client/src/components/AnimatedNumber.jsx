/**
 * AnimatedNumber — smooth number counting animation
 * ─────────────────────────────────────────────────────────────────────────
 * Counts from 0 (or `from`) to `value` with easing.
 * Triggers once the element enters the viewport.
 *
 * Usage:
 *   <AnimatedNumber value={74} suffix="/100" />
 *   <AnimatedNumber value={8.25} decimals={2} prefix="₹" />
 */
import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const AnimatedNumber = ({
  value = 0,
  from = 0,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  style = {},
  className = '',
  triggerOnView = true,
}) => {
  const ref = useRef(null);
  const [displayed, setDisplayed] = useState(from);
  const rafRef = useRef(null);
  const hasAnimated = useRef(false);

  const runAnimation = () => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    // Reduced motion — snap immediately
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(value);
      return;
    }

    let startTime = null;
    const tick = (ts) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setDisplayed(from + (value - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!triggerOnView) {
      runAnimation();
      return;
    }

    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { runAnimation(); observer.unobserve(el); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const formatted = decimals > 0
    ? displayed.toFixed(decimals)
    : Math.round(displayed).toLocaleString('en-IN');

  return (
    <span ref={ref} style={style} className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
};

export default AnimatedNumber;