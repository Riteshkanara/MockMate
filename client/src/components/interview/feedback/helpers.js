/**
 * Feedback panel helpers: pure functions, no React.
 */
export const safeArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

// "1. foo 2. bar" or "Sentence one. Sentence two." -> separate points.
export const splitParts = (text = '') => {
  if (!text) return [];
  const byNum = text.split(/(?<!\d)\d+\.\s+/).map((s) => s.trim()).filter(Boolean);
  if (byNum.length > 1) return byNum;
  const bySentence = text.replace(/([.!?])\s+/g, '$1|||').split('|||').map((s) => s.trim()).filter(Boolean);
  return bySentence.length <= 1 ? [text.trim()] : bySentence;
};

// Only a genuinely numbered list ("1. ... 2. ...") is split. A tip is one recommendation.
export const splitNumbered = (text = '') => text.split(/(?<!\d)\d+\.\s+/).map((s) => s.trim()).filter(Boolean);

export const fmtTime = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const num = (v) => (v == null ? null : Math.round(Number(typeof v === 'object' ? v.score : v) || 0));

export const wordCount = (t = '') => (t.trim() ? t.trim().split(/\s+/).length : 0);

// Score bands. `min` is inclusive. Widths on the hero bar are derived from the gaps.
export const BANDS = [
  { min: 0,  label: 'Needs work',    sub: 'Read the model answer, then try this topic again.' },
  { min: 40, label: 'Getting there', sub: 'The direction is right, but important points are missing.' },
  { min: 60, label: 'Good base',     sub: 'You have the core. More specific points would lift it.' },
  { min: 75, label: 'Strong answer', sub: 'Solid and well reasoned. A little more depth and it is polished.' },
  { min: 90, label: 'Outstanding',   sub: 'Interview-ready. This is the kind of answer that gets offers.' },
];

export const bandIndex = (s) => {
  let idx = 0;
  BANDS.forEach((b, i) => { if (s >= b.min) idx = i; });
  return idx;
};

export const verdict = (s) => BANDS[bandIndex(s)];

/** Points needed to reach the next band, or null at the top. Plain arithmetic, nothing invented. */
export const nextBand = (s) => {
  const i = bandIndex(s);
  if (i >= BANDS.length - 1) return null;
  return { label: BANDS[i + 1].label, need: BANDS[i + 1].min - Math.round(s) };
};

// Score colours used on the dark hero.
export const heroScoreColor = (s) => (s >= 70 ? '#6EE7B7' : s >= 40 ? '#FCD34D' : '#FCA5A5');

// How this answer compares with earlier written answers in the same session.
export const compareToSession = (score, previous = []) => {
  if (!previous.length) return null;
  const avg = previous.reduce((a, b) => a + b, 0) / previous.length;
  const diff = Math.round(score - avg);
  if (score > Math.max(...previous)) return { text: 'Your best answer this session', dir: 'up' };
  if (diff >= 3)  return { text: `${diff} above your average so far`, dir: 'up' };
  if (diff <= -3) return { text: `${Math.abs(diff)} below your average so far`, dir: 'down' };
  return { text: 'In line with your average so far', dir: 'flat' };
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Splits text into [{ t, hit }] so missed keywords can be highlighted inside a model answer. */
export const markKeywords = (text = '', words = []) => {
  const list = words.map((w) => String(w).trim()).filter((w) => w.length >= 3);
  if (!text || !list.length) return [{ t: text, hit: false }];
  const re = new RegExp(`(${list.map(esc).join('|')})`, 'gi');
  // split() with one capture group puts every match at an odd index.
  return text.split(re).map((t, i) => ({ t, hit: i % 2 === 1 })).filter((p) => p.t !== '');
};

export const isStarTopic = (topic = '') => /behav|hr|situation|leader|star|culture|team/i.test(topic);

export const starIsEmpty = (sb) => !sb || [sb.S, sb.T, sb.A, sb.R].every((p) => !p || Number(p.score) === 0);
