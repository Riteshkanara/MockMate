import PropTypes from 'prop-types';

/**
 * ProIcon — small self-contained SVG icons for the Pro/lock UI.
 * The app does not load an icon font, so icons here are inline SVG and always render.
 * Every icon is 24x24, stroke-only, and inherits the surrounding text colour.
 */
const PATHS = {
  trophy:   <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a2 2 0 0 0 2 4" /><path d="M16 6h3a2 2 0 0 1-2 4" /><path d="M12 13v4" /><path d="M9 20h6" /></>,
  bulb:     <><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z" /></>,
  mic:      <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></>,
  radar:    <><path d="M12 3l8 6-3 10H7L4 9l8-6Z" /><path d="M12 8l4 3-1.5 5h-5L8 11l4-3Z" /></>,
  route:    <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></>,
  target:   <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  flame:    <><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9Z" /></>,
  spark:    <><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8L19 15Z" /></>,
  clock:    <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16" /><path d="M8 3v4M16 3v4" /><path d="M9 15l2 2 4-4" /></>,
  chat:     <><path d="M5 5h14v10H9l-4 4V5Z" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4" /></>,
  report:   <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 15v-3M12 15V9M15 15v-5" /></>,
  bolt:     <><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></>,
  lock:     <><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};

export default function ProIcon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      {PATHS[name] || PATHS.lock}
    </svg>
  );
}

ProIcon.propTypes = { name: PropTypes.string.isRequired, size: PropTypes.number };
