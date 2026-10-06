/**
 * Feedback panel: shared visual atoms + CSS.
 *
 * Colour system (all from styles/token, no new hex except on the dark hero):
 *   brand blue  → coaching, primary actions, the Pro lock
 *   green       → what worked
 *   amber       → what to add
 *   indigo      → the model answer
 *   cyan        → follow-up questions
 *   teal        → analysis (keywords, structure)
 *   violet      → delivery and confidence
 * Each section keeps one hue, locked or unlocked, so the two states look like the same room.
 */
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { C, F } from '../../../styles/token';
import Icon from '../icons';

export const HUE = {
  fix:      { c: C.brand600, tint: C.brand50,     b: C.brand100 },
  worked:   { c: C.success,  tint: C.successTint, b: `${C.success}33` },
  add:      { c: C.warning,  tint: C.warningTint, b: `${C.warning}38` },
  model:    { c: C.indigo,   tint: C.indigoTint,  b: '#C7D2FE' },
  follow:   { c: C.accent600, tint: C.accentTint, b: C.accent300 },
  analysis: { c: C.teal,     tint: C.tealTint,    b: '#99E6DC' },
  delivery: { c: C.violet,   tint: C.violetTint,  b: '#D6D0FB' },
};

export const PANEL_CSS = `
@keyframes fbBar  { from { width:0 } }
@keyframes fbIn   { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
@keyframes fbSpin { to { transform:rotate(360deg) } }
@keyframes fbShimmer { from { background-position:200% 0 } to { background-position:-100% 0 } }
@keyframes fbGlow { 0%,100% { opacity:.55 } 50% { opacity:.9 } }
.fb-in    { animation:fbIn .42s cubic-bezier(.16,1,.3,1) both; }
.fb-bar   { animation:fbBar .9s cubic-bezier(.16,1,.3,1) both; }
.fb-tab, .fb-chip, .fb-btn { transition:background .15s ease, color .15s ease, box-shadow .15s ease, transform .15s ease, border-color .15s ease; }
.fb-tab:focus-visible, .fb-chip:focus-visible, .fb-btn:focus-visible, .fb-next:focus-visible, .fb-lock:focus-visible { outline:2.5px solid ${C.brand500}; outline-offset:2px; }
.fb-chip:hover { border-color:${C.brand200} !important; background:${C.brand50} !important; }
.fb-btn:hover { background:${C.surfaceAlt} !important; }
.fb-next:hover:not(:disabled) { filter:brightness(1.06); transform:translateY(-1px); box-shadow:0 12px 28px rgba(26,110,255,.34) !important; }
.fb-next:active:not(:disabled) { transform:scale(.99); }
.fb-lock:hover .fb-lock-cta { transform:translateY(-1px); filter:brightness(1.06); }
.fb-scroll { scroll-margin-top:96px; }
.fb-chips::-webkit-scrollbar { display:none; }
.fb-glow { animation:fbGlow 4s ease-in-out infinite; }
.fb-mark { background:${C.warningTint}; color:inherit; border-bottom:2px solid ${C.warning}; border-radius:3px; padding:0 2px; }
.fb-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
@media (prefers-reduced-motion:reduce) {
  .fb-in, .fb-bar, .fb-glow, .fb-shimmer { animation:none !important; }
  .fb-tab, .fb-chip, .fb-btn, .fb-next, .fb-lock-cta { transition:none !important; }
}
@media (max-width:480px) {
  .fb-twocol { grid-template-columns:1fr !important; }
  .fb-hero-top { flex-direction:column !important; align-items:flex-start !important; }
}
`;

export const card = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18,
  boxShadow: '0 1px 2px rgba(15,35,95,.04), 0 8px 24px rgba(26,110,255,.06)',
};

/** Icon chip + title. Used by real and locked sections alike, so they match exactly. */
export function SectionHead({ icon, hue, title, sub, right }) {
  const h = HUE[hue];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
      <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: h.tint, color: h.c, border: `1px solid ${h.b}` }}>
        <Icon name={icon} size={17} stroke={2.2} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3 style={{ margin: 0, fontFamily: F.display, fontSize: 15.5, fontWeight: 800, color: C.text, letterSpacing: '-0.2px', lineHeight: 1.25 }}>{title}</h3>
        {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      {right && <div style={{ flexShrink: 0, fontSize: 13, color: C.muted, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{right}</div>}
    </div>
  );
}
SectionHead.propTypes = { icon: PropTypes.string.isRequired, hue: PropTypes.string.isRequired, title: PropTypes.string.isRequired, sub: PropTypes.string, right: PropTypes.node };

export function Section({ id, icon, hue, title, sub, right, children, tinted = false, pad = '16px 18px' }) {
  const h = HUE[hue];
  return (
    <section id={id} className="fb-scroll" style={{ ...card, padding: pad, ...(tinted ? { background: h.tint, borderColor: h.b } : {}) }}>
      <SectionHead icon={icon} hue={hue} title={title} sub={sub} right={right} />
      {children}
    </section>
  );
}
Section.propTypes = { id: PropTypes.string, icon: PropTypes.string.isRequired, hue: PropTypes.string.isRequired, title: PropTypes.string.isRequired, sub: PropTypes.string, right: PropTypes.node, children: PropTypes.node, tinted: PropTypes.bool, pad: PropTypes.string };

export const Points = ({ items, color }) => (
  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
    {items.map((pt, i) => (
      <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 9 }} />
        <span style={{ fontSize: 14.5, lineHeight: 1.65, color: C.text, flex: 1 }}>{pt}</span>
      </li>
    ))}
  </ul>
);
Points.propTypes = { items: PropTypes.arrayOf(PropTypes.string).isRequired, color: PropTypes.string.isRequired };

export const Bar = ({ pct, color, height = 7, delay = 0 }) => (
  <div style={{ height, borderRadius: 99, background: C.brand50, overflow: 'hidden' }}>
    <div className="fb-bar" style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, borderRadius: 99, background: color, animationDelay: `${delay}ms` }} />
  </div>
);
Bar.propTypes = { pct: PropTypes.number.isRequired, color: PropTypes.string.isRequired, height: PropTypes.number, delay: PropTypes.number };

export const Pill = ({ children, color = C.sub, bg, border }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, color, background: bg || `${color}14`, border: `1px solid ${border || `${color}30`}`, whiteSpace: 'nowrap' }}>
    {children}
  </span>
);
Pill.propTypes = { children: PropTypes.node.isRequired, color: PropTypes.string, bg: PropTypes.string, border: PropTypes.string };

export function Notice({ tone = 'info', icon = 'info', title, children }) {
  const t = {
    info: { c: C.brand700, bg: C.brand50,     b: C.brand100 },
    warn: { c: C.warning,  bg: C.warningTint, b: `${C.warning}40` },
    good: { c: C.success,  bg: C.successTint, b: `${C.success}30` },
  }[tone];
  return (
    <div role="status" style={{ display: 'flex', gap: 11, padding: '13px 15px', borderRadius: 14, background: t.bg, border: `1px solid ${t.b}` }}>
      <Icon name={icon} size={18} style={{ color: t.c, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        {title && <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text, marginBottom: 2 }}>{title}</div>}
        <div style={{ fontSize: 14, lineHeight: 1.6, color: C.sub }}>{children}</div>
      </div>
    </div>
  );
}
Notice.propTypes = { tone: PropTypes.string, icon: PropTypes.string, title: PropTypes.string, children: PropTypes.node };

export function useCountUp(target, duration = 900) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [value, setValue] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce) return undefined;
    let raf; let start = null;
    const tick = (now) => {
      if (start == null) start = now;
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - (1 - t) ** 4) * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);
  return reduce ? target : value;
}

// Placeholder shown where a section WILL appear once background analysis finishes.
export function PendingBlock({ label, lines = 3 }) {
  return (
    <section role="status" aria-live="polite" aria-label={label} style={{ ...card, padding: '14px 18px' }}>
      <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 800, color: C.muted, marginBottom: 11 }}>{label}</div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="fb-shimmer" style={{ height: 10, borderRadius: 6, marginTop: i ? 9 : 0, width: i === lines - 1 ? '62%' : '100%', backgroundImage: `linear-gradient(90deg, ${C.border}, ${C.surfaceAlt}, ${C.border})`, backgroundSize: '300% 100%', animation: 'fbShimmer 1.4s linear infinite' }} />
      ))}
    </section>
  );
}
PendingBlock.propTypes = { label: PropTypes.string.isRequired, lines: PropTypes.number };
