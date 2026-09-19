import { useState, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { C as CT, F } from '../../styles/token';


const C = {
  ...CT,
  violet:      CT.blue500,
  violetLight: CT.blue300,
  violetTint:  CT.blue50,
  violetMid:   CT.blue600,
};

StreakCalendar.propTypes = {
  scoreTrend: PropTypes.arrayOf(PropTypes.shape({
    date:      PropTypes.string,
    createdAt: PropTypes.string,
    score:     PropTypes.number,
  })),
};

function StreakCalendar({ scoreTrend }) {
  const today = new Date();
  const WEEKS = 15;
  const DAYS  = WEEKS * 7;
  const containerRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  const sessionMap = useMemo(() => {
    const map = {};
    (scoreTrend || []).forEach(session => {
      const raw = session.date || session.createdAt;
      if (!raw) return;
      const d   = new Date(raw);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key] || (session.score || 0) > map[key]) map[key] = session.score || 0;
    });
    return map;
  }, [scoreTrend]);

  const cells = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (DAYS - 1 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return { date: d, score: sessionMap[key] ?? 0, hasData: key in sessionMap };
  });

  const heatColor = (score, hasData) => {
    if (!hasData)    return C.border;
    if (score >= 85) return C.violetMid;
    if (score >= 70) return C.violet;
    if (score >= 55) return C.violetLight;
    if (score >= 40) return `${C.violet}70`;
    return `${C.violet}35`;
  };

  const dateLabel = (d) =>
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', paddingBottom: 8, position: 'relative' }}>
      {hovered && (
        <div role="tooltip" className="an-fade-in" style={{
          position: 'absolute', left: hovered.x, top: hovered.y,
          transform: 'translate(-50%, -100%)',
          background: C.text, color: '#fff', padding: '6px 10px', borderRadius: 8,
          fontFamily: F.body, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 20,
          boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
          animationDuration: '0.12s',
        }}>
          {hovered.label}
          <div style={{
            position: 'absolute', left: '50%', bottom: -4, transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: `5px solid ${C.text}`,
          }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: WEEKS }, (_, weekIndex) => (
          <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((cell, dayIdx) => (
              <div key={dayIdx}
                aria-label={
                  cell.hasData
                    ? `${dateLabel(cell.date)}: score ${cell.score}`
                    : `${dateLabel(cell.date)}: no session`
                }
                style={{
                  width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                  background: heatColor(cell.score, cell.hasData),
                  cursor: cell.hasData ? 'pointer' : 'default',
                  transition: 'transform 0.12s',
                  border: cell.hasData ? 'none' : `1px solid ${C.border}`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.45)';
                  const rect       = e.currentTarget.getBoundingClientRect();
                  const parentRect = containerRef.current.getBoundingClientRect();
                  setHovered({
                    x: rect.left - parentRect.left + rect.width / 2 + containerRef.current.scrollLeft,
                    y: rect.top  - parentRect.top  - 6,
                    label: cell.hasData
                      ? `${dateLabel(cell.date)} · Score ${cell.score}`
                      : dateLabel(cell.date),
                  });
                }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; setHovered(null); }}
              />
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>Low</span>
        {[`${C.violet}35`, `${C.violet}70`, C.violetLight, C.violet, C.violetMid].map((bg, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: bg, flexShrink: 0 }} />
        ))}
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>High</span>
      </div>
    </div>
  );
}

export default StreakCalendar;