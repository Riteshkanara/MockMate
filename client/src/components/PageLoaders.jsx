import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Themed page loaders. Every loader is FULLY VISIBLE from the first frame
 * (nothing builds up from empty), and only has gentle idle motion on top, so even a
 * 0.5 s appearance reads clearly:
 *   Leaderboard  full podium + crown, shine sweeps across the bars
 *   Dashboard    score gauge at 87 with an orbiting dot, stat cards shimmer
 *   Analytics    complete trend chart, scanner sweeps across it
 *   History      full timeline with session cards, shimmering text lines
 *   Coach        the original shimmer card
 * Pure CSS + one tiny message rotator. Scoped `mmpl-` classes, reduced-motion safe.
 */

const CSS = `
.mmpl-stage{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;min-height:calc(100vh - 100px);padding:24px;box-sizing:border-box}
.mmpl-stage.mmpl-fixed{position:fixed;inset:0;min-height:0;z-index:9999}
.mmpl-stage::before,.mmpl-stage::after{content:"";position:absolute;width:420px;height:420px;border-radius:50%;pointer-events:none;animation:mmpl-drift 9s ease-in-out infinite}
.mmpl-stage::before{top:-160px;left:-120px;background:radial-gradient(circle,rgba(26,110,255,.10),transparent 68%)}
.mmpl-stage::after{bottom:-180px;right:-120px;background:radial-gradient(circle,rgba(0,200,240,.10),transparent 68%);animation-delay:-4s}
.mmpl-stage>*{position:relative;z-index:1}
@keyframes mmpl-drift{0%,100%{transform:translate(0,0)}50%{transform:translate(26px,18px)}}

.mmpl-label{height:16px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono','SFMono-Regular',ui-monospace,monospace;font-size:11px;font-weight:600;letter-spacing:1.3px;text-transform:uppercase;text-align:center;margin:0}
.mmpl-msg{animation:mmpl-msg 1.9s ease both}
.mmpl-dots span{display:inline-block;animation:mmpl-blink 1.4s infinite}
.mmpl-dots span:nth-child(2){animation-delay:.2s}.mmpl-dots span:nth-child(3){animation-delay:.4s}
@keyframes mmpl-msg{0%,86%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-4px)}}
@keyframes mmpl-blink{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes mmpl-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes mmpl-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}

/* ── Coach ─────────────────────────────────────────────────────────── */
.mmpl-coach{position:relative;width:240px;height:130px;animation:mmpl-float 3.6s ease-in-out infinite}
.mmpl-coach .c{position:absolute;inset:0;border-radius:12px;border:1px solid #d3d3d3;background:#e3e3e3;overflow:hidden}
.mmpl-coach .c.top{padding:15px;box-shadow:0 10px 24px -14px rgba(26,110,255,.28)}
.mmpl-coach .c.top::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,rgba(227,227,227,0) 0%,rgba(227,227,227,0) 40%,rgba(227,227,227,.8) 50%,rgba(227,227,227,0) 60%,rgba(227,227,227,0) 100%);animation:mmpl-shimmer 1.2s linear infinite}
.mmpl-coach .av{width:50px;height:50px;border-radius:50%;background:#cacaca;position:absolute;top:15px;left:15px}
.mmpl-coach .ln{position:absolute;height:10px;border-radius:4px;background:#cacaca}
.mmpl-coach .l1{top:26px;left:73px;width:100px}.mmpl-coach .l2{top:49px;left:73px;width:150px}
.mmpl-coach .l3{top:72px;left:15px;right:15px}.mmpl-coach .l4{top:95px;left:15px;width:92%}

/* ── Leaderboard: podium is fully built, only shine / bob / twinkle move ── */
.mmpl-podium{position:relative;display:flex;align-items:flex-end;gap:10px;height:206px;padding-bottom:6px}
.mmpl-podium::after{content:"";position:absolute;left:-18px;right:-18px;bottom:0;height:5px;border-radius:5px;background:linear-gradient(90deg,transparent,#cfdaf0 18%,#cfdaf0 82%,transparent)}
.mmpl-col{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px}
.mmpl-av{position:relative;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#f4f7fd,#d3dcef);border:2px solid #fff;box-shadow:0 6px 12px -5px rgba(26,60,140,.35);animation:mmpl-float 2.6s ease-in-out infinite}
.mmpl-av::after{content:"";position:absolute;left:50%;top:7px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:rgba(120,140,180,.5);box-shadow:0 11px 0 3px rgba(120,140,180,.4)}
.mmpl-bar{position:relative;width:74px;height:var(--h);border-radius:13px 13px 3px 3px;overflow:hidden}
.mmpl-bar::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);transform:translateX(-120%);animation:mmpl-shine 2.2s ease-in-out infinite}
.mmpl-bar b{position:absolute;top:9px;left:0;right:0;text-align:center;font-size:18px;font-weight:800;color:rgba(255,255,255,.96)}
.mmpl-col.g .mmpl-bar{--h:124px;background:linear-gradient(180deg,#F8D467,#E3A52B);box-shadow:0 14px 28px -10px rgba(227,165,43,.6)}
.mmpl-col.s .mmpl-bar{--h:88px;background:linear-gradient(180deg,#D3DDEC,#A9B8D0)}
.mmpl-col.b .mmpl-bar{--h:64px;background:linear-gradient(180deg,#EBC3A0,#C98F5E)}
.mmpl-col.s .mmpl-bar::after,.mmpl-col.s .mmpl-av{animation-delay:.25s}
.mmpl-col.b .mmpl-bar::after,.mmpl-col.b .mmpl-av{animation-delay:.5s}
.mmpl-crown{position:absolute;top:-32px;font-size:23px;filter:drop-shadow(0 4px 6px rgba(227,165,43,.45));animation:mmpl-crown 2.4s ease-in-out infinite}
.mmpl-spark{position:absolute;top:-10px;left:50%;width:6px;height:6px;border-radius:50%;background:#F6C650;transform:translate(calc(-50% + var(--x,0px)),var(--y,-40px));animation:mmpl-twinkle 1.8s ease-in-out infinite}
.mmpl-spark:nth-of-type(1){--x:-34px;--y:-30px;animation-delay:.05s;background:#7CC4FF}
.mmpl-spark:nth-of-type(2){--x:36px;--y:-26px;animation-delay:.4s}
.mmpl-spark:nth-of-type(3){--x:-18px;--y:-46px;animation-delay:.8s;background:#00C8F0}
.mmpl-spark:nth-of-type(4){--x:20px;--y:-48px;animation-delay:1.1s;background:#7CC4FF}
.mmpl-spark:nth-of-type(5){--x:0px;--y:-56px;animation-delay:1.4s}
@keyframes mmpl-shine{0%{transform:translateX(-120%)}60%,100%{transform:translateX(120%)}}
@keyframes mmpl-crown{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-4px) rotate(4deg)}}
@keyframes mmpl-twinkle{0%,100%{opacity:.25;scale:.6}50%{opacity:1;scale:1.1}}

/* ── Dashboard: gauge already filled, stat cards already in place ──── */
.mmpl-dash{display:flex;flex-direction:column;align-items:center;gap:22px}
.mmpl-gauge{position:relative;width:112px;height:112px}
.mmpl-gauge svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.mmpl-gauge .t{fill:none;stroke:#e1e9fa;stroke-width:6}
.mmpl-gauge .f{fill:none;stroke:url(#mmplGauge);stroke-width:6;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:.13;animation:mmpl-ring 2.4s ease-in-out infinite}
.mmpl-gauge .orb{position:absolute;inset:-9px;border-radius:50%;animation:mmpl-spin 4s linear infinite}
.mmpl-gauge .orb::before{content:"";position:absolute;top:0;left:50%;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:#00C8F0;box-shadow:0 0 12px 2px rgba(0,200,240,.55)}
.mmpl-gauge .num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Inter',system-ui,sans-serif;font-size:30px;font-weight:800;color:#0A1628;letter-spacing:-1px}
.mmpl-gauge .num::after{content:"87"}
.mmpl-mini{display:flex;gap:10px}
.mmpl-mini div{position:relative;overflow:hidden;width:78px;height:46px;border-radius:12px;background:#fff;border:1px solid #dde5f7;padding:9px 10px;box-sizing:border-box;box-shadow:0 8px 18px -12px rgba(26,60,140,.3);animation:mmpl-float 2.6s ease-in-out infinite}
.mmpl-mini div::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(26,110,255,.10) 50%,transparent 65%);animation:mmpl-shimmer 1.6s linear infinite}
.mmpl-mini div:nth-child(2),.mmpl-mini div:nth-child(2)::after{animation-delay:.2s}
.mmpl-mini div:nth-child(3),.mmpl-mini div:nth-child(3)::after{animation-delay:.4s}
.mmpl-mini span{display:block;height:5px;border-radius:3px;background:#e2e9f8}
.mmpl-mini span+span{width:58%;margin-top:7px;background:#b7d0ff}
.mmpl-mini div:first-child span+span{background:linear-gradient(90deg,#FFB86B,#FF8A3D)}
@keyframes mmpl-ring{0%,100%{opacity:1}50%{opacity:.7}}
@keyframes mmpl-spin{to{transform:rotate(360deg)}}

/* ── Analytics: complete chart, scanner sweeps across ──────────────── */
.mmpl-an{position:relative;width:260px}
.mmpl-an svg{display:block;width:100%;height:auto;overflow:visible}
.mmpl-an .grid{stroke:#e3eaf8;stroke-width:1}
.mmpl-an .area{fill:url(#mmplArea)}
.mmpl-an .ln{fill:none;stroke:#1A6EFF;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.mmpl-an .bar{fill:#dbe7ff;transform-box:fill-box;transform-origin:bottom;animation:mmpl-barpulse 1.8s ease-in-out infinite}
.mmpl-an .dot{fill:#fff;stroke:#1A6EFF;stroke-width:2;transform-box:fill-box;transform-origin:center;animation:mmpl-dotpulse 1.8s ease-in-out infinite}
.mmpl-an .dot:nth-of-type(2){animation-delay:.15s}.mmpl-an .dot:nth-of-type(3){animation-delay:.3s}
.mmpl-an .dot:nth-of-type(4){animation-delay:.45s}.mmpl-an .dot:nth-of-type(5){animation-delay:.6s}
.mmpl-an .dot:nth-of-type(6){animation-delay:.75s}
.mmpl-an .scan{position:absolute;top:0;bottom:6px;left:0;width:2px;border-radius:2px;background:linear-gradient(180deg,transparent,#00C8F0 30%,#00C8F0 70%,transparent);box-shadow:0 0 14px 3px rgba(0,200,240,.35);animation:mmpl-scan 2.2s cubic-bezier(.4,0,.2,1) infinite}
.mmpl-an .irs{position:absolute;right:-6px;top:-34px;padding:4px 10px;border-radius:99px;background:#fff;border:1px solid #cfe0ff;box-shadow:0 8px 18px -10px rgba(26,110,255,.5);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:700;color:#1A6EFF;animation:mmpl-float 2.6s ease-in-out infinite}
.mmpl-an .irs::before{content:"IRS ";color:#7A8BAF;font-weight:600}
.mmpl-an .irs::after{content:"74"}
@keyframes mmpl-barpulse{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.86)}}
@keyframes mmpl-dotpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
@keyframes mmpl-scan{0%{left:0}100%{left:calc(100% - 2px)}}

/* ── History: timeline and session cards fully drawn, text lines shimmer ── */
.mmpl-tl{position:relative;width:250px;display:flex;flex-direction:column;gap:12px;padding-left:22px}
.mmpl-tl::before{content:"";position:absolute;left:5px;top:10px;bottom:10px;width:2px;border-radius:2px;background:linear-gradient(180deg,#9DBFFF,#C7DAFF)}
.mmpl-tl .row{position:relative;display:flex;align-items:center;gap:10px;height:52px;padding:0 12px;border-radius:14px;background:#fff;border:1px solid #dde5f7;box-shadow:0 10px 22px -14px rgba(26,60,140,.35);animation:mmpl-nudge 2.4s ease-in-out infinite}
.mmpl-tl .row::before{content:"";position:absolute;left:-22px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:#fff;border:2.5px solid #1A6EFF;box-shadow:0 0 0 4px rgba(26,110,255,.12)}
.mmpl-tl .row:nth-child(2){animation-delay:.2s}.mmpl-tl .row:nth-child(3){animation-delay:.4s}
.mmpl-tl .sc{flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Inter',system-ui,sans-serif;font-size:11px;font-weight:800;color:#1A6EFF;background:#EBF2FF;border:1.5px solid #C7DAFF}
.mmpl-tl .tx{flex:1;display:grid;gap:6px}
.mmpl-tl .tx i{display:block;height:6px;border-radius:3px;background:linear-gradient(90deg,#e4eaf8 30%,#f6f9ff 50%,#e4eaf8 70%);background-size:300% 100%;animation:mmpl-line 1.6s linear infinite}
.mmpl-tl .tx i+i{width:55%;background:linear-gradient(90deg,#c7daff 30%,#e8f0ff 50%,#c7daff 70%);background-size:300% 100%}
@keyframes mmpl-nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
@keyframes mmpl-line{0%{background-position:100% 0}100%{background-position:-100% 0}}

@media (prefers-reduced-motion:reduce){.mmpl-stage *,.mmpl-stage *::after,.mmpl-stage::before{animation-duration:8s!important}}
`;

const Messages = ({ list }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 1900);
    return () => clearInterval(t);
  }, [list]);
  return <span key={i} className="mmpl-msg">{list[i]}</span>;
};
Messages.propTypes = { list: PropTypes.arrayOf(PropTypes.string).isRequired };

const Stage = ({ messages, color, bg, fixed, children }) => (
  <div className={`mmpl-stage${fixed ? ' mmpl-fixed' : ''}`} style={{ background: bg }} role="status" aria-live="polite">
    <style>{CSS}</style>
    {children}
    <p className="mmpl-label" style={{ color }}>
      <Messages list={messages} />
      <span className="mmpl-dots"><span>.</span><span>.</span><span>.</span></span>
    </p>
  </div>
);
Stage.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.string).isRequired, color: PropTypes.string, bg: PropTypes.string,
  fixed: PropTypes.bool, children: PropTypes.node,
};

const MUTED = '#7A8BAF';

// Message lists are module constants so the rotator's effect does not restart on every render.
const MSG = {
  coach: ['Loading your placement command center'],
  board: ['Counting the ranks', 'Sorting the champions', 'Polishing the crown'],
  dash: ['Warming up your dashboard', 'Tallying your streak', 'Reading your IRS'],
  analytics: ['Crunching your sessions', 'Weighing six dimensions', 'Computing your IRS'],
  history: ['Pulling up your sessions', 'Rewinding the tape', 'Dusting off old answers'],
};

export const CoachLoader = ({ label, bg = 'transparent', color = MUTED }) => (
  <Stage messages={label ? [label] : MSG.coach} bg={bg} color={color}>
    <div className="mmpl-coach">
      <div className="c top">
        <div className="av" />
        <div className="ln l1" /><div className="ln l2" /><div className="ln l3" /><div className="ln l4" />
      </div>
    </div>
  </Stage>
);
CoachLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string, color: PropTypes.string };

const PodiumCol = ({ cls, n, crown }) => (
  <div className={`mmpl-col ${cls}`}>
    {crown && (
      <>
        <span className="mmpl-crown" aria-hidden="true">👑</span>
        {[0, 1, 2, 3, 4].map((k) => <i key={k} className="mmpl-spark" />)}
      </>
    )}
    <div className="mmpl-av" />
    <div className="mmpl-bar"><b>{n}</b></div>
  </div>
);
PodiumCol.propTypes = { cls: PropTypes.string, n: PropTypes.number, crown: PropTypes.bool };

export const LeaderboardLoader = ({ label, bg = '#F0F4FF' }) => (
  <Stage messages={label ? [label] : MSG.board} bg={bg} color={MUTED}>
    <div className="mmpl-podium" aria-hidden="true">
      <PodiumCol cls="s" n={2} />
      <PodiumCol cls="g" n={1} crown />
      <PodiumCol cls="b" n={3} />
    </div>
  </Stage>
);
LeaderboardLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string };

export const DashboardLoader = ({ label, bg = '#F0F4FF', fixed = false }) => (
  <Stage messages={label ? [label] : MSG.dash} bg={bg} color={MUTED} fixed={fixed}>
    <div className="mmpl-dash" aria-hidden="true">
      <div className="mmpl-gauge">
        <div className="orb" />
        <svg viewBox="0 0 112 112">
          <defs>
            <linearGradient id="mmplGauge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1A6EFF" /><stop offset="100%" stopColor="#00C8F0" />
            </linearGradient>
          </defs>
          <circle className="t" cx="56" cy="56" r="49" />
          <circle className="f" pathLength="1" cx="56" cy="56" r="49" />
        </svg>
        <div className="num" />
      </div>
      <div className="mmpl-mini">
        {[0, 1, 2].map((i) => <div key={i}><span /><span /></div>)}
      </div>
    </div>
  </Stage>
);
DashboardLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string, fixed: PropTypes.bool };

const AN_PTS = [[14, 78], [56, 62], [98, 68], [140, 42], [182, 48], [224, 22]];
const AN_BARS = [30, 44, 38, 62, 56, 82];

export const AnalyticsLoader = ({ label, bg = '#F0F4FF' }) => (
  <Stage messages={label ? [label] : MSG.analytics} bg={bg} color={MUTED}>
    <div className="mmpl-an" aria-hidden="true">
      <span className="irs" />
      <span className="scan" />
      <svg viewBox="0 0 238 100">
        <defs>
          <linearGradient id="mmplArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A6EFF" stopOpacity=".18" /><stop offset="100%" stopColor="#1A6EFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[22, 50, 78].map((y) => <line key={y} className="grid" x1="0" x2="238" y1={y} y2={y} />)}
        {AN_BARS.map((h, i) => (
          <rect key={i} className="bar" x={AN_PTS[i][0] - 9} y={94 - h} width="18" height={h} rx="4" style={{ animationDelay: `${i * 0.09}s` }} />
        ))}
        <path className="area" d={`M${AN_PTS.map((p) => p.join(' ')).join(' L')} L224 94 L14 94 Z`} />
        <path className="ln" pathLength="1" d={`M${AN_PTS.map((p) => p.join(' ')).join(' L')}`} />
        {AN_PTS.map(([x, y]) => <circle key={x} className="dot" cx={x} cy={y} r="4.5" />)}
      </svg>
    </div>
  </Stage>
);
AnalyticsLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string };

export const HistoryLoader = ({ label, bg = '#F0F4FF' }) => (
  <Stage messages={label ? [label] : MSG.history} bg={bg} color={MUTED}>
    <div className="mmpl-tl" aria-hidden="true">
      {['78', '64', '71'].map((n) => (
        <div className="row" key={n}>
          <span className="sc">{n}</span>
          <span className="tx"><i /><i /></span>
        </div>
      ))}
    </div>
  </Stage>
);
HistoryLoader.propTypes = { label: PropTypes.string, bg: PropTypes.string };
