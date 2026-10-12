/**
 * Share-card preview image (1200×630 PNG) for WhatsApp / LinkedIn / X link previews.
 * satori turns a small element tree into SVG; resvg rasterises it to PNG.
 * Pure JS + prebuilt binary — no headless browser, safe on Render's free tier.
 *
 * Design: the app's light-blue look (matches client PlayerCard) — big readable score,
 * rank and name so it still works as a tiny WhatsApp thumbnail, with a radar + dimension
 * list for the full-size LinkedIn / X view.
 */
const fs = require('fs');
const path = require('path');

const W = 1200;
const H = 630;
const BAND_H = 92;
const MIN_CANDIDATES_FOR_PERCENT = 10; // keep in sync with client PlayerCard

// Brand tokens — mirror client/src/styles/token.js
const INK = '#FFFFFF';
const SUB = 'rgba(214,228,255,0.82)';
const MUTED = 'rgba(165,190,240,0.70)';
const BORDER = 'rgba(255,255,255,0.18)';
const PANEL = 'rgba(255,255,255,0.09)';
const DEEP = '#04122E';
const BRAND500 = '#1A6EFF';
const BRAND600 = '#0057E8';
const BRAND700 = '#0044C4';
const CYAN400 = '#00C8F0';
const DIM_COLORS = ['#5EA8FF', '#22D3EE', '#B28BFF', '#34E0C4', '#FFC53D', '#FF7AA8'];

// Mirrors the client ArenaCard palette — keep in sync with client/src/components/share/ArenaCard.jsx
const THEMES = [
  { match: '₹3',  level: 'ROOKIE',     accent: '#FFB547', accent2: '#FF7A45', bg: ['#030B24', '#07204F', '#0A3A8F'] },
  { match: '₹6',  level: 'CHALLENGER', accent: '#22D3EE', accent2: '#3B82F6', bg: ['#030B24', '#07204F', '#0A3A8F'] },
  { match: '₹12', level: 'ELITE',      accent: '#FFD60A', accent2: '#FF9F1C', bg: ['#030B24', '#07204F', '#0A3A8F'] },
  { match: '₹20', level: 'LEGEND',     accent: '#B28BFF', accent2: '#4DE3FF', bg: ['#030B24', '#07204F', '#0A3A8F'] },
];
const themeFor = (tier) => THEMES.find((t) => tier?.label?.startsWith(t.match)) || THEMES[1];

const readFont = (pkg, file) => {
  const dir = path.dirname(require.resolve(`${pkg}/package.json`));
  return fs.readFileSync(path.join(dir, 'files', file));
};

let fontCache = null;
const getFonts = () => {
  if (fontCache) return fontCache;
  fontCache = [
    { name: 'Inter', data: readFont('@fontsource/inter', 'inter-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Inter', data: readFont('@fontsource/inter', 'inter-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'Mono',  data: readFont('@fontsource/jetbrains-mono', 'jetbrains-mono-latin-700-normal.woff'), weight: 700, style: 'normal' },
  ];
  return fontCache;
};

const ell = (str, n) => (str.length > n ? `${str.slice(0, n - 1).trim()}…` : str);
const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const svgUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const shortLabel = (label = '') =>
  label === 'Technical Depth' ? 'Technical'
  : label === 'Problem Solving' ? 'Problem'
  : label === 'Communication' ? 'Comm.'
  : label === 'CS Fundamentals' ? 'CS Core'
  : label === 'System Design' ? 'Design'
  : label;

const ringSvg = (score, theme, size = 210) => {
  const stroke = 20, r = (size - stroke) / 2 - 6, c = 2 * Math.PI * r;
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${theme.accent}"/><stop offset="1" stop-color="${theme.accent2}"/></linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r - stroke / 2 + 2}" fill="#04122E" fill-opacity="0.6"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#g)" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - clamp(score) / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`);
};

const radarSvg = (dims, theme, size = 270) => {
  const cx = size / 2, cy = size / 2, R = size / 2 - 16, n = dims.length || 6;
  const pt = (i, v) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100];
  };
  const str = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const ring = (lv) => dims.map((_, i) => str(pt(i, lv))).join(' ');
  const scores = dims.map((d) => (d.hasData ? Math.max(8, clamp(d.score)) : 4));
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${theme.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${theme.accent2}" stop-opacity="0.30"/></linearGradient></defs>
    <polygon points="${ring(100)}" fill="#FFFFFF" fill-opacity="0.06" stroke="#7DD3FC" stroke-opacity="0.45" stroke-width="1.6"/>
    ${[75, 50, 25].map((lv) => `<polygon points="${ring(lv)}" fill="none" stroke="#7DD3FC" stroke-opacity="0.25" stroke-width="1.4"/>`).join('')}
    ${dims.map((_, i) => { const p = pt(i, 100); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#7DD3FC" stroke-opacity="0.25" stroke-width="1.4"/>`; }).join('')}
    <polygon points="${scores.map((v, i) => str(pt(i, v))).join(' ')}" fill="url(#f)" stroke="${theme.accent}" stroke-width="3.4" stroke-linejoin="round"/>
    ${scores.map((v, i) => { const p = pt(i, v); return dims[i].hasData ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="7" fill="${DIM_COLORS[i % DIM_COLORS.length]}" stroke="#04122E" stroke-width="3"/>` : ''; }).join('')}
  </svg>`);
};

const contourSvg = () => {
  const ring = (cx, cy, r, ph) => {
    const pts = [];
    for (let k = 0; k < 40; k += 1) { const a = (k / 40) * Math.PI * 2; const rad = r * (1 + 0.13 * Math.sin(3 * a + ph) + 0.07 * Math.sin(5 * a + ph * 1.7)); pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad * 0.8).toFixed(1)}`); }
    return `<path d="M${pts.join('L')}Z" fill="none" stroke="#7DD3FC" stroke-opacity="0.16" stroke-width="1.5"/>`;
  };
  const rings = [];
  [[1000, 120, 0.4], [120, 560, 1.9]].forEach(([cx, cy, ph]) => { for (let i = 1; i <= 8; i += 1) rings.push(ring(cx, cy, 40 + i * 42, ph + i * 0.1)); });
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${rings.join('')}<path d="M980 -10 C1100 160 560 240 700 400 S900 560 760 640" fill="none" stroke="#FFFFFF" stroke-opacity="0.07" stroke-width="3" stroke-dasharray="6 14"/></svg>`);
};
const starSvg = () => svgUri('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" fill="#04122E"/></svg>');
const shieldSvg = () => svgUri('<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6z"/><path d="M8.7 12l2.4 2.4L15.6 9.8"/></svg>');

// tiny hyperscript so we don't need a JSX build step on the server.
// satori needs display:flex on every div, which `h` guarantees.
const h = (type, style, ...children) => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length <= 1 ? children[0] : children },
});
const text = (str, style) => h('div', style, String(str));
const img = (src, w, ht, style = {}) => ({ type: 'img', props: { src, width: w, height: ht, style } });

const buildTree = (report, siteUrl) => {
  const theme = themeFor(report.tier);
  const irs = Math.round(report.irs ?? report.averageScore ?? 0);
  const dims = report.dimensionProfile?.length ? report.dimensionProfile : [];
  const showPercent = report.topPercent != null && report.totalCandidates >= MIN_CANDIDATES_FOR_PERCENT;
  const heroLabel = showPercent ? "YOU'RE IN THE" : 'CURRENT RANK';
  const heroValue = showPercent ? `Top ${report.topPercent}%` : (report.rank != null ? `#${report.rank}` : `${irs}`);
  const heroSize = heroValue.length <= 6 ? 88 : heroValue.length === 7 ? 80 : 68;
  const place = ell([report.college, report.stateName].filter(Boolean).join('  ·  ') || 'MockMate candidate', 44);
  const name = ell(report.name || 'MockMate candidate', 24);
  const beat = report.beatCount > 0
    ? `Outscored ${report.beatCount} ${report.beatCount === 1 ? 'candidate' : 'candidates'}`
    : 'Just getting started — the climb begins.';

  const tiles = [
    report.rank != null && { k: 'OVERALL', v: `#${report.rank}`, s: `of ${report.totalCandidates}`, c: '#5EA8FF' },
    report.collegeRank != null && { k: ell((report.college || 'COLLEGE').toUpperCase(), 11), v: `#${report.collegeRank}`, s: `of ${report.collegeTotal}`, c: '#B28BFF' },
    report.stateRank != null && { k: ell((report.stateName || 'STATE').toUpperCase(), 11), v: `#${report.stateRank}`, s: `of ${report.stateTotal}`, c: '#34E0C4' },
  ].filter(Boolean);

  const tile = (t) => h('div', {
    flexDirection: 'column', width: 178, marginRight: 12, padding: '10px 16px 12px', borderRadius: 20, backgroundColor: PANEL,
    border: `2px solid ${BORDER}`, borderTop: `6px solid ${t.c}`,
  },
  text(t.k, { fontFamily: 'Mono', fontSize: 15, fontWeight: 700, color: MUTED, letterSpacing: 1 }),
  h('div', { alignItems: 'baseline', marginTop: 4 },
    text(t.v, { fontFamily: 'Inter', fontSize: 38, fontWeight: 800, color: INK, letterSpacing: -1 }),
    text(t.s, { fontFamily: 'Mono', fontSize: 16, fontWeight: 700, color: MUTED, marginLeft: 8 })));

  const dimRow = (d, i) => h('div', { alignItems: 'center', width: 190, marginBottom: 9, marginRight: i % 2 === 0 ? 16 : 0 },
    h('div', { width: 14, height: 14, borderRadius: 14, backgroundColor: DIM_COLORS[i % DIM_COLORS.length], marginRight: 10 }),
    text(shortLabel(d.label), { fontFamily: 'Inter', fontSize: 19, fontWeight: 600, color: SUB, flex: 1 }),
    text(d.hasData ? Math.round(d.score) : '–', { fontFamily: 'Inter', fontSize: 23, fontWeight: 800, color: d.hasData ? DIM_COLORS[i % DIM_COLORS.length] : 'rgba(165,190,240,0.6)' }));

  const miniStat = (k, v, c) => h('div', { flexDirection: 'column', alignItems: 'center', flex: 1 },
    text(v, { fontFamily: 'Inter', fontSize: 30, fontWeight: 800, color: c, lineHeight: 1.1 }),
    text(k, { fontFamily: 'Mono', fontSize: 13, fontWeight: 700, color: MUTED, letterSpacing: 1, marginTop: 2 }));
  const miniStats = [];
  if (report.streak?.current > 0) miniStats.push(miniStat('DAY STREAK', report.streak.current, '#FF9F5A'));
  miniStats.push(miniStat('BEST', Math.round(report.bestScore || 0), '#FFC53D'));
  miniStats.push(miniStat('SESSIONS', report.totalInterviews || 0, '#5EA8FF'));

  const left = h('div', { flexDirection: 'column', width: 610 },
    // brand row
    h('div', { alignItems: 'center', justifyContent: 'space-between', width: 600 },
      h('div', { alignItems: 'center' },
        h('div', { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundImage: `linear-gradient(135deg, ${BRAND600}, ${CYAN400})`, boxShadow: '0 8px 18px rgba(0,87,232,0.32)' },
          text('M', { fontFamily: 'Inter', fontSize: 32, fontWeight: 800, color: '#FFFFFF' })),
        h('div', { marginLeft: 14 },
          text('Mock', { fontFamily: 'Inter', fontSize: 34, fontWeight: 800, color: INK, letterSpacing: -1 }),
          text('Mate', { fontFamily: 'Inter', fontSize: 34, fontWeight: 800, color: '#5EC8FF', letterSpacing: -1 }))),
      h('div', { alignItems: 'center', padding: '9px 22px 9px 16px', borderRadius: 999, backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`, boxShadow: '0 8px 18px rgba(26,110,255,0.22)' },
        img(starSvg(), 22, 22, { marginRight: 10 }),
        text(theme.level, { fontFamily: 'Mono', fontSize: 21, fontWeight: 700, letterSpacing: 2.5, color: DEEP }))),
    // identity
    text(name, { fontFamily: 'Inter', fontSize: 50, fontWeight: 800, color: INK, letterSpacing: -1.5, marginTop: 18, lineHeight: 1.1 }),
    text(place, { fontFamily: 'Inter', fontSize: 24, fontWeight: 600, color: SUB, marginTop: 2 }),
    // ring + hero
    h('div', { alignItems: 'center', marginTop: 18 },
      h('div', { position: 'relative', width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
        img(ringSvg(irs, theme, 190), 190, 190, { position: 'absolute', top: 0, left: 0 }),
        h('div', { flexDirection: 'column', alignItems: 'center' },
          text(irs, { fontFamily: 'Inter', fontSize: 74, fontWeight: 800, color: INK, letterSpacing: -3, lineHeight: 1 }),
          text('READINESS', { fontFamily: 'Mono', fontSize: 14, fontWeight: 700, letterSpacing: 2, color: theme.accent, marginTop: 4 }))),
      h('div', { flexDirection: 'column', marginLeft: 28, flex: 1 },
        text(heroLabel, { fontFamily: 'Mono', fontSize: 19, fontWeight: 700, letterSpacing: 3, color: MUTED }),
        text(heroValue, { fontFamily: 'Inter', fontSize: heroSize, fontWeight: 800, color: theme.accent, letterSpacing: -3, lineHeight: 1.05, whiteSpace: 'nowrap' }),
        h('div', { width: 78, height: 7, borderRadius: 7, marginTop: 6, backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }),
        text(beat, { fontFamily: 'Inter', fontSize: 22, fontWeight: 600, color: SUB, marginTop: 10 }))),
    // rank tiles
    tiles.length ? h('div', { marginTop: 18 }, ...tiles.map((t) => tile(t))) : null);

  const right = h('div', {
    flexDirection: 'column', alignItems: 'center', width: 444, padding: '24px 24px 14px', borderRadius: 40, backgroundColor: PANEL,
    border: `2px solid ${BORDER}`,
  },
  h('div', { width: 396, justifyContent: 'space-between', alignItems: 'center' },
    text('SKILL FINGERPRINT', { fontFamily: 'Mono', fontSize: 17, fontWeight: 700, letterSpacing: 2, color: theme.accent }),
    text(`${dims.filter((d) => d.hasData).length}/${dims.length || 6} MEASURED`, { fontFamily: 'Mono', fontSize: 14, fontWeight: 700, color: MUTED })),
  dims.length ? img(radarSvg(dims, theme, 232), 232, 232, { marginTop: 6 }) : null,
  dims.length ? h('div', { flexWrap: 'wrap', width: 396, marginTop: 8 }, ...dims.slice(0, 6).map((d, i) => dimRow(d, i))) : null,
  h('div', { width: 396, marginTop: 'auto', paddingTop: 10, borderTop: `2px dashed ${BORDER}`, justifyContent: 'space-between' }, ...miniStats));

  return h('div', {
    width: W, height: H, flexDirection: 'column', position: 'relative', fontFamily: 'Inter', color: INK,
    backgroundImage: `linear-gradient(135deg, ${theme.bg[0]} 0%, ${theme.bg[1]} 55%, ${theme.bg[2]} 100%)`,
  },
  // glows + topographic rings
  h('div', { position: 'absolute', top: -220, right: -140, width: 640, height: 640, borderRadius: 640, backgroundImage: `radial-gradient(circle, ${theme.accent}66, ${theme.accent}00 65%)` }),
  h('div', { position: 'absolute', bottom: -100, left: -220, width: 620, height: 620, borderRadius: 620, backgroundImage: 'radial-gradient(circle, rgba(109,91,238,0.36), rgba(109,91,238,0) 65%)' }),
  img(contourSvg(), W, H, { position: 'absolute', top: 0, left: 0 }),

  h('div', { padding: '34px 56px 0', height: H - BAND_H, alignItems: 'flex-start', justifyContent: 'space-between' }, left, right),

  // footer band
  h('div', { height: BAND_H, padding: '0 56px', alignItems: 'center', justifyContent: 'space-between', backgroundImage: `linear-gradient(100deg, ${BRAND700} 0%, ${BRAND500} 58%, ${CYAN400} 100%)` },
    h('div', { alignItems: 'center' },
      img(shieldSvg(), 40, 40, { marginRight: 16 }),
      h('div', { flexDirection: 'column' },
        text(`Think you can beat ${irs}?`, { fontFamily: 'Inter', fontSize: 38, fontWeight: 800, color: '#FFFFFF', letterSpacing: -1 }),
        text('Take a free AI mock interview · verified scores', { fontFamily: 'Inter', fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 2 }))),
    h('div', { alignItems: 'center', padding: '10px 24px', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)', border: '2px solid rgba(255,255,255,0.55)' },
      text(ell(siteUrl.replace(/^https?:\/\//, ''), 30), { fontFamily: 'Mono', fontSize: 22, fontWeight: 700, color: '#FFFFFF' }))));
};

let satoriFn = null;
let ResvgCtor = null;

const renderProfileCard = async (report, siteUrl = 'mockmate.app') => {
  if (!satoriFn) satoriFn = (await import('satori')).default;
  if (!ResvgCtor) ResvgCtor = (await import('@resvg/resvg-js')).Resvg;
  const tree = buildTree(report, siteUrl);
  const svg = await satoriFn(tree, { width: W, height: H, fonts: getFonts() });
  return new ResvgCtor(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
};

module.exports = { renderProfileCard, themeFor };
