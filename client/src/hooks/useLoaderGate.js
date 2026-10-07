import { useEffect, useRef, useState } from 'react';

/**
 * useLoaderGate(loading, { delay, min })
 *
 * Returns true while the loader should be on screen.
 *  - delay: if loading finishes within ~60 ms, the loader never appears
 *           (so fast/cached loads don't flash it).
 *  - min:   once the loader HAS appeared, keep it for at least ~0.7 s
 *           (so it never blinks for 80ms, which feels like a glitch).
 *
 * Real slow loads are not delayed any further: the loader leaves the moment
 * data is ready, as long as `min` has passed.
 */
export function useLoaderGate(loading, { delay = 60, min = 700 } = {}) {
  const [show, setShow] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    let t;
    if (loading) {
      if (!show) {
        t = setTimeout(() => {
          shownAt.current = Date.now();
          setShow(true);
        }, delay);
      }
    } else if (show) {
      const left = Math.max(0, min - (Date.now() - shownAt.current));
      t = setTimeout(() => setShow(false), left);
    }
    return () => clearTimeout(t);
  }, [loading, show, delay, min]);

  return show;
}

/**
 * Dev-only: lets you SEE the loader even when the API/cache is instant.
 *   Open any page with  ?slowload=3000   -> every gated loader holds ~3s
 *   (stored in sessionStorage so it survives navigation; ?slowload=0 turns it off)
 * Does nothing in production builds.
 */
export function devExtraDelay() {
  if (!import.meta.env.DEV) return 0;
  try {
    const q = new URLSearchParams(window.location.search).get('slowload');
    if (q !== null) sessionStorage.setItem('mm_slowload', q);
    return Number(sessionStorage.getItem('mm_slowload')) || 0;
  } catch {
    return 0;
  }
}

/**
 * Convenience: gate + dev delay in one call.
 *   const showLoader = usePageLoader(loading);
 *   if (showLoader) return <AnalyticsLoader />;
 *   if (loading) return null;   // fast path: render nothing for the first ~120ms
 */
export function usePageLoader(loading, opts) {
  const extra = devExtraDelay();
  const [held, setHeld] = useState(extra > 0);

  useEffect(() => {
    if (!extra) return undefined;
    const t = setTimeout(() => setHeld(false), extra);
    return () => clearTimeout(t);
  }, [extra]);

  return useLoaderGate(loading || held, opts);
}
