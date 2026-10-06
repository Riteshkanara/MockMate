import PropTypes from 'prop-types';

/**
 * Small inline icon set for the interview flow.
 * Emoji render differently on every OS (and look out of place next to the
 * rest of the UI), so the setup page, room and feedback use these instead.
 * 24x24 grid, 2px stroke, inherits colour from `currentColor`.
 */
const PATHS = {
  bolt:      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  target:    <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  building:  <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-4h4v4" /></>,
  book:      <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>,
  listcheck: <><path d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17" /><path d="M12 6h8M12 12h8M12 18h8" /></>,
  calc:      <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>,
  shuffle:   <><path d="M3 7h3a5 5 0 0 1 4 2l4 6a5 5 0 0 0 4 2h3M3 17h3a5 5 0 0 0 4-2M14 9a5 5 0 0 1 4-2h3" /><path d="m18 4 3 3-3 3M18 14l3 3-3 3" /></>,
  arrow:     <path d="M5 12h14m-6-6 6 6-6 6" />,
  check:     <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x:         <path d="M6 6l12 12M18 6 6 18" />,
  mic:       <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  clock:     <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chevDown:  <path d="m6 9 6 6 6-6" />,
  chevUp:    <path d="m6 15 6-6 6 6" />,
  info:      <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  alert:     <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
  skip:      <><path d="m5 5 9 7-9 7V5Z" /><path d="M19 5v14" /></>,
  retry:     <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  lightbulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z" /></>,
  lock:      <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  message:   <path d="M4 5h16v11H9l-5 4V5Z" />,
  edit:      <path d="m4 20 4-1 11-11-3-3L5 16l-1 4ZM14 6l3 3" />,
  trophy:    <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4M12 13v4M9 20h6" /></>,
  copy:      <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  chart:     <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  help:      <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></>,
};

function Icon({ name, size = 18, stroke = 2, style, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'block', ...style }}
      {...rest}
    >
      {PATHS[name] || null}
    </svg>
  );
}

Icon.propTypes = {
  name:   PropTypes.string.isRequired,
  size:   PropTypes.number,
  stroke: PropTypes.number,
  style:  PropTypes.object,
};

export default Icon;
