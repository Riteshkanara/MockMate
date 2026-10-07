import PropTypes from 'prop-types';

/**
 * Themed page loaders: one per page, each hinting at what the page does.
 * Pure CSS (no deps), scoped `mmpl-` classes, respects prefers-reduced-motion.
 * Accents stay inside the MockMate blue/cyan family, with a warm gold (podium)
 * and the logo's violet (history) as supporting colours.
 */

const CSS = `
.mmpl-stage{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;min-height:calc(100vh - 100px);padding:24px;box-sizing:border-box}
.mmpl-stage.mmpl-fixed{position:fixed;inset:0;min-height:0;z-index:9999}
.mmpl-label{font-family:'JetBrains Mono','SFMono-Regular',ui-monospace,monospace;font-size:11px;font-weight:600;letter-spacing:1.3px;text-transform:uppercase;text-align:center;margin:0}
.mmpl-label span{display:inline-block;animation:mmpl-blink 1.4s infinite}
.mmpl-label span:nth-child(2){animation-delay:.2s}.mmpl-label span:nth-child(3){animation-delay:.4s}
@keyframes mmpl-blink{0%,100%{opacity:.25}50%{opacity:1}}

/* ── Coach: floating shimmer card stack ───────────────────────────── */
.mmpl-coach{position:relative;width:260px;height:160px;animation:mmpl-float 3.2s ease-in-out infinite}
.mmpl-coach .c{position:absolute;inset:0;border-radius:16px;border:1px solid #d3d3d3;background:#e3e3e3;overflow:hidden}
.mmpl-coach .c.b2{transform:translate(10px,10px) scale(.96);opacity:.45;background:#dfe6f5;animation:mmpl-sway 3.2s ease-in-out infinite}
.mmpl-coach .c.b1{transform:translate(5px,5px) scale(.98);opacity:.7;background:#e6ebf7;animation:mmpl-sway 3.2s ease-in-out .15s infinite}
.mmpl-coach .c.top{box-shadow:0 18px 40px -14px rgba(26,110,255,.35);padding:18px}
.mmpl-coach .c.top::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0) 38%,rgba(255,255,255,.85) 50%,rgba(255,255,255,0) 62%,rgba(255,255,255,0) 100%);animation:mmpl-shimmer 1.3s linear infinite}
.mmpl-coach .av{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#1A6EFF,#00C8F0);position:absolute;top:18px;left:18px;display:flex;align-items:center;justify-content:center;font-size:20px}
.mmpl-coach .ln{position:absolute;height:10px;border-radius:5px;background:#cacaca}
.mmpl-coach .l1{top:22px;left:80px;width:100px}.mmpl-coach .l2{top:44px;left:80px;width:140px}
.mmpl-coach .l3{top:86px;left:18px;right:18px}.mmpl-coach .l4{top:108px;left:18px;width:86%}.mmpl-coach .l5{top:130px;left:18px;width:60%}
.mmpl-spark{position:absolute;top:-10px;right:-8px;font-size:20px;animation:mmpl-twinkle 1.6s ease-in-out infinite;z-index:3}
@keyframes mmpl-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@keyframes mmpl-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes mmpl-sway{0%,100%{translate:0 0}50%{translate:4px 4px}}
@keyframes mmpl-twinkle{0%,100%{transform:scale(.7) rotate(0);opacity:.5}50%{transform:scale(1.15) rotate(20deg);opacity:1}}

/* ── Leaderboard: podium rising + crown ───────────────────────────── */
.mmpl-podium{position:relative;display:flex;align-items:flex-end;gap:8px;height:150px}
.mmpl-podium .p{width:68px;border-radius:12px 12px 4px 4px;display:flex;align-items:flex-start;justify-content:center;padding-top:8px;font-weight:800;font-size:18px;color:#fff;transform-origin:bottom;transform:scaleY(.15);animation:mmpl-rise 2.4s cubic-bezier(.2,.9,.3,1) infinite}
.mmpl-podium .p2{height:78px;background:linear-gradient(180deg,#9BB3D6,#6F8BB8);animation-delay:.15s}
.mmpl-podium .p1{height:112px;background:linear-gradient(180deg,#FFC93C,#F29D12);animation-delay:0s;box-shadow:0 10px 30px -8px rgba(242,157,18,.55)}
.mmpl-podium .p3{height:56px;background:linear-gradient(180deg,#E0A878,#C07F4C);animation-delay:.3s}
.mmpl-crown{position:absolute;left:50%;top:-6px;margin-left:-14px;font-size:28px;animation:mmpl-crown 2.4s cubic-bezier(.3,1.3,.4,1) infinite}
.mmpl-podium .p span{opacity:0;animation:mmpl-num 2.4s ease infinite}
.mmpl-podium .p2 span{animation-delay:.15s}.mmpl-podium .p3 span{animation-delay:.3s}
@keyframes mmpl-rise{0%{transform:scaleY(.15)}35%,85%{transform:scaleY(1)}100%{transform:scaleY(.15)}}
@keyframes mmpl-num{0%,30%{opacity:0}45%,85%{opacity:1}100%{opacity:0}}
@keyframes mmpl-crown{0%,25%{transform:translateY(-70px) rotate(-18deg);opacity:0}45%{transform:translateY(34px) rotate(8deg);opacity:1}55%,85%{transform:translateY(30px) rotate(0);opacity:1}100%{transform:translateY(-70px);opacity:0}}

/* ── Analytics: line chart draws itself ───────────────────────────── */
.mmpl-chart{width:240px;height:150px}
.mmpl-chart .bar{fill:#cfe0ff;transform-box:fill-box;transform-origin:bottom;transform:scaleY(.1);animation:mmpl-bar 2.2s ease-in-out infinite}
.mmpl-chart .line{fill:none;stroke:#1A6EFF;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:340;stroke-dashoffset:340;animation:mmpl-draw 2.2s ease-in-out infinite}
.mmpl-chart .dot{fill:#00C8F0;stroke:#fff;stroke-width:2;opacity:0;animation:mmpl-dot 2.2s ease-in-out infinite}
.mmpl-chart .axis{stroke:#c3d0ea;stroke-width:1.5}
@keyframes mmpl-draw{0%{stroke-dashoffset:340}60%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:-340}}
@keyframes mmpl-bar{0%{transform:scaleY(.1)}50%,90%{transform:scaleY(1)}100%{transform:scaleY(.1)}}
@keyframes mmpl-dot{0%,55%{opacity:0;transform:scale(0)}70%,90%{opacity:1;transform:scale(1)}100%{opacity:0}}

/* ── History: session cards shuffling ─────────────────────────────── */
.mmpl-stack{position:relative;width:210px;height:130px}
.mmpl-stack .k{position:absolute;left:0;top:0;width:210px;height:112px;border-radius:14px;background:#fff;border:1px solid #dfe5f5;box-shadow:0 12px 28px -12px rgba(124,92,255,.35);padding:14px;box-sizing:border-box;animation:mmpl-shuffle 3.6s cubic-bezier(.5,0,.2,1) infinite}
.mmpl-stack .k:nth-child(1){animation-delay:0s}.mmpl-stack .k:nth-child(2){animation-delay:-1.2s}.mmpl-stack .k:nth-child(3){animation-delay:-2.4s}
.mmpl-stack .pill{width:44px;height:18px;border-radius:9px;background:linear-gradient(90deg,#7C5CFF,#1A6EFF)}
.mmpl-stack .r{height:8px;border-radius:4px;background:#e6eaf6;margin-top:10px}
.mmpl-stack .r.s{width:60%}
@keyframes mmpl-shuffle{
0%{transform:translate(0,22px) scale(.88);opacity:.5;z-index:1}
30%{transform:translate(0,11px) scale(.94);opacity:.8;z-index:2}
60%{transform:translate(0,0) scale(1);opacity:1;z-index:3}
80%{transform:translate(90px,-8px) rotate(9deg);opacity:0;z-index:3}
81%{transform:translate(0,22px) scale(.88);opacity:0;z-index:1}
100%{transform:translate(0,22px) scale(.88);opacity:.5;z-index:1}}

/* ── Dashboard: score ring filling ────────────────────────────────── */
.mmpl-ring{position:relative;width:128px;height:128px}
.mmpl-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.mmpl-ring .t{fill:none;stroke:#dbe6ff;stroke-width:9}
.mmpl-ring .f{fill:none;stroke:url(#mmplGrad);stroke-width:9;stroke-linecap:round;stroke-dasharray:314;stroke-dashoffset:314;animation:mmpl-fill 2.4s ease-in-out infinite}
.mmpl-ring .c{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:34px;animation:mmpl-pop 2.4s ease-in-out infinite}
.mmpl-orbit{position:absolute;inset:-10px;border-radius:50%;border:2px dashed rgba(26,110,255,.25);animation:mmpl-spin 8s linear infinite}
@keyframes mmpl-fill{0%{stroke-dashoffset:314}60%,85%{stroke-dashoffset:60}100%{stroke-dashoffset:314}}
@keyframes mmpl-pop{0%,100%{transform:scale(.9)}50%{transform:scale(1.08)}}
@keyframes mmpl-spin{to{transform:rotate(360deg)}}

@media (prefers-reduced-motion:reduce){.mmpl-stage *,.mmpl-stage *::after{animation-duration:6s!important}}
`;

const Stage = ({ label, color, bg, fixed, children }) => (
  <div className={`mmpl-stage${fixed ? ' mmpl-fixed' : ''}`} style={{ background: bg }} role="status" aria-live="polite">
    <style>{CSS}</style>
    {children}
    <p className="mmpl-label" style={{ color }}>{label}<span>.</span><span>.</span><span>.</span></p>
  </div>
);
Stage.propTypes = {
  label: PropTypes.string.isRequired, color: PropTypes.string, bg: PropTypes.string,
  fixed: PropTypes.bool, children: PropTypes.node,
};

export const CoachLoader = ({ label = 'Loading your placement command center', bg = 'transparent', color = '#5b6b8c' }) => (
  <Stage label={label} bg={bg} color={color}>
    <div className="mmpl-coach">
      <span className="mmpl-spark">✨</span>
      <div className="c b2" /><div className="c b1" />
      <div className="c top">
        <div className="av">⚡</div>
        <div className="ln l1" /><div className="ln l2" /><div className="ln l3" /><div className="ln l4" /><div className="ln l5" />
      </div>
    </div>
  </Stage>
);
CoachLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string, color: PropTypes.string };

export const LeaderboardLoader = ({ label = 'Counting the ranks', bg = '#F0F4FF' }) => (
  <Stage label={label} bg={bg} color="#B7791F">
    <div className="mmpl-podium">
      <span className="mmpl-crown">👑</span>
      <div className="p p2"><span>2</span></div>
      <div className="p p1"><span>1</span></div>
      <div className="p p3"><span>3</span></div>
    </div>
  </Stage>
);
LeaderboardLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string };

export const AnalyticsLoader = ({ label = 'Computing your IRS', bg = '#F0F4FF' }) => (
  <Stage label={label} bg={bg} color="#1A6EFF">
    <svg className="mmpl-chart" viewBox="0 0 240 150" aria-hidden="true">
      <line className="axis" x1="10" y1="135" x2="230" y2="135" />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const h = [40, 62, 50, 84, 72, 104][i];
        return <rect key={i} className="bar" x={20 + i * 36} y={135 - h} width="22" height={h} rx="5" style={{ animationDelay: `${i * 0.08}s` }} />;
      })}
      <polyline className="line" points="31,95 67,73 103,85 139,51 175,63 211,31" />
      {[[31, 95], [67, 73], [103, 85], [139, 51], [175, 63], [211, 31]].map(([x, y], i) => (
        <circle key={i} className="dot" cx={x} cy={y} r="5" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: `${i * 0.1}s` }} />
      ))}
    </svg>
  </Stage>
);
AnalyticsLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string };

export const HistoryLoader = ({ label = 'Pulling up your sessions', bg = '#F0F4FF' }) => (
  <Stage label={label} bg={bg} color="#6A4DE0">
    <div className="mmpl-stack">
      {[0, 1, 2].map((i) => (
        <div className="k" key={i}><div className="pill" /><div className="r" /><div className="r s" /><div className="r" style={{ width: '80%' }} /></div>
      ))}
    </div>
  </Stage>
);
HistoryLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string };

export const DashboardLoader = ({ label = 'Warming up your dashboard', bg = '#F0F4FF', fixed = false }) => (
  <Stage label={label} bg={bg} color="#1A6EFF" fixed={fixed}>
    <div className="mmpl-ring">
      <div className="mmpl-orbit" />
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id="mmplGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1A6EFF" /><stop offset="100%" stopColor="#00C8F0" />
          </linearGradient>
        </defs>
        <circle className="t" cx="60" cy="60" r="50" />
        <circle className="f" cx="60" cy="60" r="50" />
      </svg>
      <div className="c">🎯</div>
    </div>
  </Stage>
);
DashboardLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string, fixed: PropTypes.bool };
