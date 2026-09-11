/**
 * AnimatedSection — scroll-triggered reveal with IntersectionObserver
 * ─────────────────────────────────────────────────────────────────────────
 * Wraps any children and fades them up once they enter the viewport.
 * Uses CSS animations (no framer-motion) for minimal bundle impact.
 *
 * Props:
 *   delay    number (ms)  — stagger offset (default 0)
 *   distance number (px)  — how far to translate from (default 18)
 *   once     boolean      — re-animate on every scroll (default: true)
 *   threshold number      — IO threshold (default 0.12)
 *   className string      — extra classes
 */
import { useEffect, useRef, useState } from 'react';

const AnimatedSection = ({
  children,
  delay = 0,
  distance = 18,
  once = true,
  threshold = 0.12,
  className = '',
  style = {},
  ...rest
}) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Respect reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once, threshold]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : `translateY(${distance}px)`,
        transition: `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        willChange: 'opacity, transform',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

export default AnimatedSection;