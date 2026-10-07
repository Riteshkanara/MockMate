/**
 * MockMate — ResultNav.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Wayfinding for the long Result (post-interview report) page:
 *   - <ResultNav>   sticky chip bar: Overview · Topics · Analytics · Answers ·
 *                   Report, active-section highlight, reading-progress line and
 *                   a "Practice again →" button that is always reachable.
 *   - <BackToTop>   floating button that appears after scrolling down.
 *   - <Icon>        inline-SVG arrows/chevrons (no font or glyph dependency).
 *
 * The bar parks just below the fixed site navbar. The offset is MEASURED from
 * the navbar (`.mm-root .mm-capsule`), with a fallback if it isn't found.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import PropTypes from "prop-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { C, F } from "../../styles/token";

const STICKY_FALLBACK = 84;
export const NAV_H = 52;

export const getStickyTop = () => {
  if (typeof document === "undefined") return STICKY_FALLBACK;
  const cap = document.querySelector(".mm-root .mm-capsule");
  if (!cap) return STICKY_FALLBACK;
  return Math.max(0, Math.round(cap.getBoundingClientRect().bottom)) + 8;
};

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ── icons ────────────────────────────────────────────────────────────────────
const PATHS = {
  right:   <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  left:    <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
  up:      <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>,
  chevron: <polyline points="6 9 12 15 18 9" />,
};

export const Icon = ({ name, size = 14, stroke = 2.4, style }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0, ...style }}
  >
    {PATHS[name]}
  </svg>
);
Icon.propTypes = { name: PropTypes.oneOf(Object.keys(PATHS)).isRequired, size: PropTypes.number, stroke: PropTypes.number, style: PropTypes.object };

// Scrolls a section into view, leaving room for navbar + chip bar.
export const scrollToId = (id, extra = 10) => {
  const el = document.getElementById(id);
  if (!el) return;
  // Sections fade up from translateY(18px); measure where the section will END
  // UP, otherwise a not-yet-revealed section lands 18px too high under the bar.
  let ty = 0;
  try { ty = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 || 0; } catch { /* no transform */ }
  const top = window.scrollY + el.getBoundingClientRect().top - ty - (getStickyTop() + NAV_H + extra);
  window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? "auto" : "smooth" });
};

// ── sticky nav ───────────────────────────────────────────────────────────────
export const ResultNav = ({ items, onPractice, practiceLabel = "Practice again", practiceShort = "Again" }) => {
  const barRef = useRef(null);
  const scrollerRef = useRef(null);
  const [active, setActive] = useState(items[0]?.id);
  const [progress, setProgress] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false }); // which side of the chip row has more to scroll to
  const key = items.map((i) => i.id).join("|");

  useEffect(() => {
    let raf = 0;
    const calc = () => {
      raf = 0;
      const top = getStickyTop();
      barRef.current?.style.setProperty("--res-sticky-top", `${top}px`);
      const line = top + NAV_H + 28;
      let current = items[0]?.id;
      items.forEach((it) => {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= line) current = it.id;
      });
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY >= max - 4) current = items[items.length - 1]?.id;
      setActive(current);
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // soft fades on the chip row so it is obvious there is more to scroll to (phones)
  useEffect(() => {
    const box = scrollerRef.current;
    if (!box) return undefined;
    const check = () => setEdges({ start: box.scrollLeft <= 2, end: box.scrollLeft + box.clientWidth >= box.scrollWidth - 2 });
    check();
    box.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => { box.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, [key]);

  // keep the active chip visible on narrow screens
  useEffect(() => {
    const box = scrollerRef.current;
    const chip = box?.querySelector('[aria-current="true"]');
    if (!box || !chip) return;
    box.scrollTo({ left: Math.max(0, chip.offsetLeft - (box.clientWidth - chip.offsetWidth) / 2), behavior: reduced() ? "auto" : "smooth" });
  }, [active]);

  return (
    <nav
      ref={barRef}
      aria-label="Report sections"
      style={{
        position: "sticky", top: "var(--res-sticky-top, 84px)", zIndex: 40,
        height: NAV_H, boxSizing: "border-box", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 10, padding: "0 10px",
        borderRadius: 14, border: `1px solid ${C.border}`,
        background: "rgba(255,255,255,.88)",
        backdropFilter: "blur(14px) saturate(160%)", WebkitBackdropFilter: "blur(14px) saturate(160%)",
        boxShadow: "0 6px 20px rgba(0,31,107,.07)",
      }}
    >
      <div
        ref={scrollerRef} className="res-nav-scroll"
        style={{
          flex: 1, minWidth: 0, display: "flex", gap: 6, overflowX: "auto", position: "relative",
          ...(edges.start && edges.end ? null : (() => {
            const m = `linear-gradient(90deg, ${edges.start ? "#000" : "transparent"} 0, #000 22px, #000 calc(100% - 22px), ${edges.end ? "#000" : "transparent"} 100%)`;
            return { WebkitMaskImage: m, maskImage: m };
          })()),
        }}
      >
        {items.map((it) => {
          const on = it.id === active;
          return (
            <button
              key={it.id} type="button" className="res-chip"
              aria-current={on ? "true" : undefined}
              onClick={() => scrollToId(it.id)}
              style={{
                flexShrink: 0, minHeight: 34, padding: "7px 13px", borderRadius: 999, cursor: "pointer",
                fontFamily: F.display, fontSize: 12.5, fontWeight: 800, letterSpacing: "-.1px",
                border: `1px solid ${on ? C.blue600 : C.border}`,
                background: on ? C.blue600 : C.card, color: on ? "#fff" : C.sub,
                boxShadow: on ? "0 3px 10px rgba(0,87,232,.28)" : "none",
              }}
            >
              {it.label}
            </button>
          );
        })}
      </div>

      {onPractice && (
        <button
          type="button" className="res-go" onClick={onPractice} aria-label={practiceLabel}
          style={{
            flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, minHeight: 36,
            padding: "8px 12px 8px 14px", borderRadius: 11, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${C.blue700}, ${C.blue500})`, color: "#fff",
            fontFamily: F.display, fontSize: 12.5, fontWeight: 800,
            boxShadow: "0 3px 12px rgba(26,110,255,.32)", whiteSpace: "nowrap",
          }}
        >
          <span className="res-go-label">{practiceLabel}</span>
          <span className="res-go-short" aria-hidden="true">{practiceShort}</span>
          <Icon name="right" size={15} stroke={2.6} />
        </button>
      )}

      <div aria-hidden="true" style={{ position: "absolute", left: 10, right: 10, bottom: 0, height: 2, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: `linear-gradient(90deg, ${C.blue500}, ${C.cyan500 || C.blue500})`, transition: "width .12s linear" }} />
      </div>
    </nav>
  );
};
ResultNav.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string.isRequired })).isRequired,
  onPractice: PropTypes.func,
  practiceLabel: PropTypes.string,
  practiceShort: PropTypes.string,
};

// ── floating back-to-top ─────────────────────────────────────────────────────
export const BackToTop = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 700);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const go = useCallback(() => window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }), []);
  return (
    <button
      type="button" onClick={go} aria-label="Back to top" className="res-top" tabIndex={show ? 0 : -1}
      style={{
        position: "fixed", right: 18, bottom: 18, zIndex: 45, width: 44, height: 44, borderRadius: 14,
        border: `1px solid ${C.borderMd}`, background: C.card, color: C.blue600, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 24px rgba(0,31,107,.18)",
        opacity: show ? 1 : 0, transform: show ? "none" : "translateY(10px)",
        pointerEvents: show ? "auto" : "none", transition: "opacity .2s ease, transform .2s ease",
      }}
    >
      <Icon name="up" size={18} stroke={2.6} />
    </button>
  );
};

export const RESULT_NAV_CSS = `
.res-nav-scroll{scrollbar-width:none;-webkit-overflow-scrolling:touch}
.res-nav-scroll::-webkit-scrollbar{display:none}
.res-chip{transition:background .14s ease,color .14s ease,border-color .14s ease}
.res-chip:hover{border-color:${C.blue300 || C.blue500}!important;color:${C.blue700}!important}
.res-chip[aria-current="true"]:hover{color:#fff!important}
.res-go{transition:transform .12s ease,box-shadow .12s ease}
.res-go:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(26,110,255,.4)}
.res-go svg{transition:transform .2s cubic-bezier(.16,1,.3,1)}
.res-go:hover svg{transform:translateX(3px)}
.res-top:hover{background:${C.blue50}!important}
.res-go-short{display:none}
@media (max-width:520px){.res-go-label{display:none}.res-go-short{display:inline}.res-go{padding:8px 11px!important;gap:5px!important}}
@media (pointer:coarse){.res-chip{min-height:40px!important}.res-go{min-height:40px!important}}
`;
