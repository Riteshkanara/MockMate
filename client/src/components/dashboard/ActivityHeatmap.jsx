import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';


const CELL_MAX   = 13;
const CELL_MIN_D = 8;
const CELL_MIN_M = 6;
const GAP_D      = 3;
const GAP_M      = 2;
const MONTH_H    = 16;
const DAY_W      = 26;
const DAY_W_M    = 20;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS  = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const dateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const buildGrid = (scoreTrend, weeksBack = 53) => {
  const byDate = {};
  (scoreTrend ?? []).forEach(s => {
    if (!s.date) return;
    const k = s.date.slice(0, 10);
    byDate[k] = byDate[k]
      ? { score: Math.round((byDate[k].score + (s.score ?? 0)) / 2), count: byDate[k].count + 1 }
      : { score: s.score ?? 0, count: 1 };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() - today.getDay());
  const start = new Date(endSunday);
  start.setDate(start.getDate() - (weeksBack - 1) * 7);

  const weeks = [];
  const cursor = new Date(start);
  for (let w = 0; w < weeksBack; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const k        = dateKey(cursor);
      const isFuture = cursor > today;
      const isToday  = cursor.getTime() === today.getTime();
      const entry    = byDate[k];
      col.push({
        date:     k,
        dateObj:  new Date(cursor),
        score:    entry?.score ?? 0,
        sessions: entry?.count ?? 0,
        hasData:  Boolean(entry),
        isFuture,
        isToday,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(col);
  }

  const activeDates = Object.keys(byDate).sort();
  return { weeks, firstSessionDate: activeDates[0] ?? null, activeDayCount: activeDates.length };
};

const gridStats = (weeks) => {
  const cells = weeks.flat().filter(c => !c.isFuture && c.hasData);
  if (!cells.length) return { activeDays: 0, currentStreak: 0, longestStreak: 0, totalSessions: 0, avgScore: 0 };

  const sortedDates = [...new Set(cells.map(c => c.date))].sort();
  let longest = 1, current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = (new Date(sortedDates[i]) - new Date(sortedDates[i - 1])) / 86400000;
    if (diff === 1) { current++; longest = Math.max(longest, current); } else current = 1;
  }

  const dateSet = new Set(sortedDates);
  const today   = new Date();
  today.setHours(0, 0, 0, 0);
  let currentStreak = 0;
  const probe = new Date(today);
  if (!dateSet.has(dateKey(probe))) probe.setDate(probe.getDate() - 1);
  while (dateSet.has(dateKey(probe))) {
    currentStreak++;
    probe.setDate(probe.getDate() - 1);
  }

  const totalSessions = cells.reduce((s, c) => s + c.sessions, 0);
  const avgScore      = Math.round(cells.reduce((s, c) => s + c.score, 0) / cells.length);
  return { activeDays: cells.length, currentStreak, longestStreak: longest, totalSessions, avgScore };
};

const cellColor = (cell, C) => {
  if (cell.isFuture || !cell.hasData) return cell.isFuture ? 'transparent' : C.cardAlt;
  const s = cell.score;
  if (s >= 85) return C.blue700 ?? '#1D4ED8';
  if (s >= 70) return C.blue600 ?? '#2563EB';
  if (s >= 55) return C.blue500 ?? '#3B82F6';
  if (s >= 35) return C.blue300 ?? '#93C5FD';
  return C.blue100 ?? '#DBEAFE';
};

const attachResizeObserver = (el, setWidth) => {
  if (typeof ResizeObserver === 'undefined') {
    setWidth(el.getBoundingClientRect().width);
    return () => {};
  }
  const ro = new ResizeObserver(entries => {
    const w = entries[0]?.contentRect?.width;
    if (typeof w === 'number') setWidth(w);
  });
  ro.observe(el);
  setWidth(el.getBoundingClientRect().width);
  return () => ro.disconnect();
};

const useBoxWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachResizeObserver(el, setWidth);
  }, []);
  return [ref, width];
};

// ─── Styles ─────────────────────────────────────────────────
const S_HM = {
  eyebrow:          { fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px', color: C.blue500, marginBottom: 7, textTransform: 'lowercase' },
  cardH2:           { margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' },
  cardSub:          { margin: '7px 0 0', fontSize: 12.5, lineHeight: 1.65, color: C.sub, maxWidth: 440 },
  hmPanel:          { position: 'relative', overflow: 'hidden', padding: '24px 26px', marginBottom: 18, borderRadius: 20, background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow },
  hmHeaderRow:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 16, flexWrap: 'wrap' },
  hmRangeChip:      { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 10, background: C.blue50, border: `1px solid ${C.borderMd}`, flexShrink: 0 },
  hmRangeValue:     { fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, color: C.blue600 },
  hmRangeLabel:     { marginTop: 2, fontFamily: F.mono, fontSize: 7.5, color: C.muted },
  hmStatPill:       { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: C.blue50, border: `1px solid ${C.borderMd}`, fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, color: C.blue600 },
  hmGridCard:       { minWidth: 0, padding: '12px 12px 10px', borderRadius: 15, background: C.cardAlt, border: `1px solid ${C.border}` },
  hmGridFooter:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' },
  hmPulseBlock:     { marginTop: 4, padding: '10px 10px 8px', borderRadius: 11, background: C.card, border: `1px solid ${C.border}` },
  hmPulseHeader:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hmPulseCaption:   { fontFamily: F.mono, fontSize: 8.5, color: C.muted },
  hmPulseChart:     { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5, height: 42, marginTop: 8 },
  hmPulseColumn:    { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flex: 1, minWidth: 0, height: '100%' },
  hmPulseBar:       { width: '72%', minWidth: 4, borderRadius: '3px 3px 2px 2px', opacity: 0.94, transition: 'height 0.2s ease' },
  hmPulseAxis:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, fontFamily: F.mono, fontSize: 8, color: C.faint },
  hmInsightEyebrow: { fontFamily: F.mono, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.6px', color: C.blue600, textTransform: 'uppercase' },
  hmInsightTitle:   { fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.text },
  hmSeam:           { position: 'relative', display: 'flex', alignItems: 'center', margin: '22px 0 18px' },
  hmSeamLabel:      { position: 'relative', zIndex: 1, background: C.card, paddingRight: 12, fontFamily: F.mono, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.8px', color: C.muted, textTransform: 'lowercase' },
  hmSnapshotBand:   { display: 'flex', flexDirection: 'column', gap: 14 },
  hmMetricsRow:     { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 },
  hmMetricTile:     { position: 'relative', overflow: 'hidden', padding: '14px 14px 12px', borderRadius: 13, background: C.card, border: `1px solid ${C.border}` },
  hmTileAccent:     { position: 'absolute', top: 0, left: 0, right: 0, height: 3, opacity: 0.85 },
  hmTileIcon:       { fontSize: 15 },
  hmTileValue:      { marginTop: 8, fontFamily: F.display, fontSize: 23, fontWeight: 900, lineHeight: 1 },
  hmTileLabel:      { marginTop: 5, fontFamily: F.mono, fontSize: 9, color: C.muted },
  hmNarrativeRow:   { display: 'grid', gridTemplateColumns: '1.15fr 1fr 0.9fr', gap: 12, alignItems: 'stretch' },
  hmMomentumCard:   { padding: '13px 14px', borderRadius: 13, background: C.card, border: `1px solid ${C.border}` },
  hmBestPair:       { padding: '13px 14px', borderRadius: 13, background: C.card, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  hmBestRow:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hmRateCard:       { padding: '13px 14px', borderRadius: 13, background: C.card, border: `1px solid ${C.border}` },
};

// ─── PropTypes ──────────────────────────────────────────────
ActivityHeatmap.propTypes = {
  scoreTrend:    PropTypes.array.isRequired,
  sapiStreakDays: PropTypes.number,
};

// ─── Component ──────────────────────────────────────────────
function ActivityHeatmap({ scoreTrend, sapiStreakDays }) {
  const [hovered, setHovered]   = useState(null);
  const [pinned, setPinned]     = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const [scrollRef, measuredWidth] = useBoxWidth();

  const handleHeatmapResize = useCallback(() => {
    setIsMobile(window.innerWidth < 640);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleHeatmapResize, { passive: true });
    return () => window.removeEventListener('resize', handleHeatmapResize);
  }, [handleHeatmapResize]);

  const weeksBack = 53;
  const dayLabelW = isMobile ? DAY_W_M : DAY_W;
  const monthH    = isMobile ? 15 : MONTH_H;
  const gapFloor  = isMobile ? GAP_M : GAP_D;
  const cellFloor = isMobile ? CELL_MIN_M : CELL_MIN_D;

  const { cellSize, cellGap, needsScroll } = useMemo(() => {
    if (!measuredWidth) return { cellSize: CELL_MAX, cellGap: gapFloor, needsScroll: false };
    const available = Math.max(0, measuredWidth - dayLabelW - 4);
    const raw       = available / weeksBack - gapFloor;
    const clamped   = Math.max(cellFloor, Math.min(CELL_MAX, raw));
    const tightGap  = clamped === cellFloor && raw < cellFloor ? Math.max(1, gapFloor - 1) : gapFloor;
    return { cellSize: clamped, cellGap: tightGap, needsScroll: raw < cellFloor - 1 };
  }, [measuredWidth, dayLabelW, gapFloor, cellFloor]);

  const { weeks, firstSessionDate } = useMemo(() => buildGrid(scoreTrend, weeksBack), [scoreTrend]);
  const stats         = useMemo(() => gridStats(weeks), [weeks]);
  const longestStreak = Math.max(stats.longestStreak, sapiStreakDays ?? 0);

  const insight = useMemo(() => {
    const cells  = weeks.flat().filter(c => !c.isFuture);
    const active = cells.filter(c => c.hasData);

    const windowAvg = (daysBack, span) => {
      const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - daysBack);
      const to   = span ? new Date(from.getTime() + span * 86400000) : null;
      const slice = active.filter(c => { const d = new Date(c.date); return d >= from && (!to || d < to); });
      return slice.length ? Math.round(slice.reduce((s, c) => s + c.score, 0) / slice.length) : 0;
    };

    const recentAvg = windowAvg(55);
    const priorAvg  = windowAvg(111, 56);
    const hasRecent = active.some(c => new Date(c.date) >= (() => { const d = new Date(); d.setDate(d.getDate() - 55); return d; })());
    const hasPrior  = active.some(c => { const d = new Date(c.date); const from = new Date(); from.setDate(from.getDate() - 111); const to = new Date(from); to.setDate(to.getDate() + 56); return d >= from && d < to; });
    const delta     = hasRecent && hasPrior ? recentAvg - priorAvg : null;

    return {
      strongDays:   active.filter(c => c.score >= 75).length,
      recentAvg,
      delta,
      bestDay:      [...active].sort((a, b) => b.score - a.score)[0] ?? null,
      busiestDay:   [...active].sort((a, b) => b.sessions - a.sessions || b.score - a.score)[0] ?? null,
      activityRate: Math.round((stats.activeDays / (cells.length || 365)) * 100),
    };
  }, [weeks, stats.activeDays]);

  const monthLabels = useMemo(() => {
    const labels = []; let lastKey = null;
    weeks.forEach((col, wi) => {
      const first = col.find(d => d.dateObj.getDate() <= 7);
      if (!first) return;
      const key = `${first.dateObj.getFullYear()}-${first.dateObj.getMonth()}`;
      if (key !== lastKey) { labels.push({ wi, label: MONTH_NAMES[first.dateObj.getMonth()] }); lastKey = key; }
    });
    return labels;
  }, [weeks]);

  const weeklyPulse = useMemo(() =>
    weeks.slice(-12).map((week, index) => {
      const active = week.filter(d => d.hasData && !d.isFuture);
      return {
        index,
        score:    active.length ? Math.round(active.reduce((s, d) => s + d.score, 0) / active.length) : 0,
        sessions: active.reduce((s, d) => s + d.sessions, 0),
        startDate: week[0]?.dateObj,
      };
    }),
  [weeks]);

  const gridWidth = weeks.length * (cellSize + cellGap);

  const onCellEnter = (cell, e) => {
    if (cell.isFuture || isMobile) return;
    const rect       = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.closest('.mm-hm-scroll')?.getBoundingClientRect();
    setHovered({ cell, x: rect.left - (parentRect?.left ?? 0) + rect.width / 2, y: rect.top - (parentRect?.top ?? 0) });
  };

  const statsLabel   = firstSessionDate == null ? 'No sessions yet' : `${stats.activeDays} active day${stats.activeDays === 1 ? '' : 's'} · ${stats.avgScore}/100 avg`;
  const bestDayLabel = insight.bestDay ? insight.bestDay.dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

  const snapMetrics = [
    { icon: '🗓️', value: stats.activeDays,      label: 'active days',    accent: C.blue500 },
    { icon: '🎯', value: insight.strongDays,     label: 'days at 75+',   accent: C.green },
    { icon: '🔥', value: `${longestStreak}d`,   label: 'longest streak', accent: C.amber },
    { icon: '📈', value: stats.avgScore || '—', label: 'average score',  accent: C.cyan500 },
  ];

  return (
    <section style={{ ...S_HM.hmPanel, padding: isMobile ? '16px 12px' : '20px 22px' }} className="mm-hm-panel">
      <div style={S_HM.hmHeaderRow}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={S_HM.eyebrow}>practice activity</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={S_HM.cardH2}>12-month contribution map</h2>
            <span style={S_HM.hmStatPill}>{statsLabel}</span>
          </div>
          <p style={S_HM.cardSub}>
            {firstSessionDate == null
              ? 'Run your first mock interview to start building your preparation history.'
              : 'Each square is one day. Darker blue means a stronger average score that day.'}
          </p>
        </div>
        <div style={S_HM.hmRangeChip}>
          <span style={{ fontSize: 14 }}>◫</span>
          <div>
            <div style={S_HM.hmRangeValue}>53 weeks</div>
            <div style={S_HM.hmRangeLabel}>rolling year</div>
          </div>
        </div>
      </div>

      <div style={S_HM.hmGridCard}>
        <div ref={scrollRef} className="mm-hm-scroll" style={{ position: 'relative', overflowX: needsScroll ? 'auto' : 'hidden', overflowY: 'visible', padding: '2px 2px 8px', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ position: 'relative', width: needsScroll ? gridWidth + dayLabelW : '100%', minWidth: needsScroll ? gridWidth + dayLabelW : 0 }}>

            <div style={{ position: 'relative', height: monthH, marginLeft: dayLabelW }}>
              {monthLabels.map((m, i) => (
                <span key={i} style={{ position: 'absolute', left: m.wi * (cellSize + cellGap), top: 0, fontFamily: F.mono, fontSize: isMobile ? 8.5 : 9.5, color: C.muted, fontWeight: 800 }}>
                  {m.label}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: cellGap, width: dayLabelW, flexShrink: 0 }}>
                {DAY_LABELS.map((d, i) => (
                  <div key={i} style={{ height: cellSize, fontFamily: F.mono, fontSize: isMobile ? 7.5 : 8.5, color: C.faint, display: 'flex', alignItems: 'center', paddingRight: 5 }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: cellGap, justifyContent: needsScroll ? 'flex-start' : 'space-between', flex: needsScroll ? 'initial' : 1 }}>
                {weeks.map((col, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: cellGap }}>
                    {col.map(cell => {
                      const isPinned = pinned?.date === cell.date;
                      const label    = cell.isFuture ? '' : `${cell.dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${cell.hasData ? `, score ${cell.score}${cell.sessions > 1 ? `, ${cell.sessions} sessions` : ''}` : ', no session'}`;
                      return (
                        <div
                          key={cell.date}
                          role={cell.hasData ? 'button' : undefined}
                          tabIndex={cell.hasData ? 0 : -1}
                          aria-label={label || undefined}
                          title={label}
                          onMouseEnter={e => onCellEnter(cell, e)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => cell.hasData && setPinned(isPinned ? null : cell)}
                          onKeyDown={e => { if (!cell.hasData) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned(isPinned ? null : cell); } }}
                          style={{
                            width: cellSize, height: cellSize,
                            borderRadius: isMobile ? 2 : 3,
                            background: cell.isFuture ? 'transparent' : cellColor(cell, C),
                            cursor: cell.hasData ? 'pointer' : 'default',
                            border: cell.isToday ? `1.5px solid ${C.text}` : isPinned ? `1.5px solid ${C.blue700 || C.blue600}` : `1px solid ${cell.hasData ? 'rgba(23,75,150,0.08)' : 'rgba(0,0,0,0.035)'}`,
                            boxShadow:    isPinned ? `0 0 0 2px ${C.blue500}33` : 'none',
                            outlineOffset: 2,
                            transform:    hovered?.cell?.date === cell.date ? 'scale(1.28)' : 'scale(1)',
                            transition:   'transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {hovered && !pinned && (
                <div style={{ position: 'absolute', left: hovered.x, top: Math.max(22, hovered.y - 8), transform: 'translate(-50%, -100%)', background: C.text, color: '#fff', padding: '7px 10px', borderRadius: 8, fontSize: 10.5, fontFamily: F.body, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5, boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}>
                  <div style={{ fontWeight: 800 }}>{hovered.cell.hasData ? `Score ${hovered.cell.score}` : 'No session'}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, opacity: 0.72, marginTop: 2 }}>
                    {hovered.cell.dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {hovered.cell.sessions > 1 ? ` · ${hovered.cell.sessions} sessions` : ''}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={S_HM.hmPulseBlock}>
          <div style={S_HM.hmPulseHeader}>
            <span style={S_HM.hmInsightEyebrow}>recent activity pulse</span>
            <span style={S_HM.hmPulseCaption}>last 12 weeks</span>
          </div>
          <div style={S_HM.hmPulseChart}>
            {weeklyPulse.map((wk, i) => (
              <div key={i} style={S_HM.hmPulseColumn} title={`${wk.startDate?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${wk.score || 0} avg · ${wk.sessions} session${wk.sessions !== 1 ? 's' : ''}`}>
                <div style={{ ...S_HM.hmPulseBar, height: `${Math.max(4, Math.round((wk.score / 100) * 38))}px`, background: wk.score ? cellColor({ score: wk.score, hasData: true, isFuture: false }, C) : C.border }} />
              </div>
            ))}
          </div>
          <div style={S_HM.hmPulseAxis}><span>12 weeks ago</span><span>today</span></div>
        </div>

        <div style={S_HM.hmGridFooter}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>Less</span>
            {[C.cardAlt, C.blue100 ?? '#DBEAFE', C.blue300 ?? '#93C5FD', C.blue500 ?? '#3B82F6', C.blue700 ?? '#1D4ED8'].map((col, i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: col, border: '1px solid rgba(0,0,0,0.05)' }} />
            ))}
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>More</span>
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.faint }}>outline = today</span>
        </div>
      </div>

      {pinned && (
        <div style={{ marginTop: 12, padding: isMobile ? '11px 12px' : '12px 16px', borderRadius: 12, background: `${cellColor(pinned, C)}22`, border: `1px solid ${cellColor(pinned, C)}55`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', animation: 'fadeUp 0.18s ease' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginBottom: 3 }}>
              {pinned.dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: F.display, fontSize: 23, fontWeight: 900, color: C.text }}>{pinned.score}</span>
              <span style={{ fontSize: 11.5, color: C.sub }}>avg score · {pinned.sessions} session{pinned.sessions !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button onClick={() => setPinned(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 11.5, padding: 4 }}>Dismiss ✕</button>
        </div>
      )}

      <div aria-hidden="true" style={S_HM.hmSeam} className="mm-hm-seam">
        <span style={S_HM.hmSeamLabel}>12-month snapshot</span>
      </div>

      <div style={S_HM.hmSnapshotBand} className="mm-hm-snapshot">
        <div>
          <div style={S_HM.hmInsightTitle}>Your preparation rhythm</div>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: C.sub, lineHeight: 1.6, maxWidth: 480 }}>
            A read on how consistently you're showing up, not just how well you're scoring.
          </p>
        </div>

        <div style={S_HM.hmMetricsRow} className="mm-hm-metrics-row">
          {snapMetrics.map((m, i) => (
            <div key={m.label} style={{ ...S_HM.hmMetricTile, animationDelay: `${i * 60}ms` }} className="mm-hm-metric-tile">
              <div style={{ ...S_HM.hmTileAccent, background: m.accent }} />
              <div style={S_HM.hmTileIcon}>{m.icon}</div>
              <div style={{ ...S_HM.hmTileValue, color: C.text }}>{m.value}</div>
              <div style={S_HM.hmTileLabel}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={S_HM.hmNarrativeRow} className="mm-hm-narrative-row">
          <div style={S_HM.hmMomentumCard} className="mm-hm-fade-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={S_HM.hmInsightEyebrow}>recent momentum</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>8 weeks</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
              <div>
                <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 900, color: C.text }}>{insight.recentAvg || '—'}</div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 2 }}>recent avg</div>
              </div>
              {insight.delta != null && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 8, background: insight.delta >= 0 ? `${C.green}14` : `${C.orange}14`, color: insight.delta >= 0 ? C.green : C.orange, fontFamily: F.mono, fontSize: 10, fontWeight: 800 }}>
                  {insight.delta >= 0 ? '↗' : '↘'} {insight.delta >= 0 ? '+' : ''}{insight.delta} pts
                </div>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: C.sub, lineHeight: 1.55 }}>
              {insight.delta == null
                ? 'Keep logging sessions to unlock a trend comparison.'
                : insight.delta > 0
                  ? 'Recent performance is improving against the previous 8-week window.'
                  : insight.delta < 0
                    ? 'Your recent average has dipped. A few focused sessions can turn this around.'
                    : 'Your recent average is holding steady. Keep the rhythm and sharpen your weakest dimension.'}
            </div>
          </div>

          <div style={S_HM.hmBestPair} className="mm-hm-fade-card">
            {[
              { eyebrow: 'best day',    date: bestDayLabel,  val: insight.bestDay?.score ?? '—',    color: C.blue600,  unit: 'score'    },
              { eyebrow: 'busiest day', date: insight.busiestDay ? insight.busiestDay.dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—', val: insight.busiestDay?.sessions ?? 0, color: C.cyan500, unit: 'sessions' },
            ].map((row, i) => (
              <div key={row.eyebrow} style={{ ...S_HM.hmBestRow, ...(i > 0 ? { marginTop: 8 } : {}) }}>
                <div>
                  <div style={S_HM.hmInsightEyebrow}>{row.eyebrow}</div>
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: C.text }}>{row.date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color: row.color }}>{row.val}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted }}>{row.unit}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={S_HM.hmRateCard} className="mm-hm-fade-card">
            <div style={S_HM.hmInsightEyebrow}>annual activity rate</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
              <span style={{ fontFamily: F.display, fontSize: 28, fontWeight: 900, color: C.text }}>{insight.activityRate}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>%</span>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: C.border, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ height: '100%', width: `${insight.activityRate}%`, background: `linear-gradient(90deg, ${C.blue500}, ${C.cyan500})`, borderRadius: 999, transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>Share of days in the last year with a logged session.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ActivityHeatmap;