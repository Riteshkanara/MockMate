import PropTypes from 'prop-types';
import { C, F } from '../../styles/token';
import ProBadge from '../pro/ProBadge';
import UsageMeter from '../pro/UsageMeter';
import DailyLimitCard from '../pro/DailyLimitCard';

/**
 * SetupScreen: the interview builder. The original layout, kept on purpose:
 *   1. a banner that CHANGES with the chosen mode (icon, what you get, your picks)
 *   2. a grid of mode cards, difficulty cards, then target / role / level
 * The Start button lives in the banner, so it is visible without scrolling.
 * Free/Pro rules are passed in (access per mode, daily limit); this component only draws them.
 */

const EMOJI = { quick: '⚡', full: '🎯', company: '🏢', topic: '📖', mcq: '✅', aptitude: '🧮', mixed: '🔀' };
const DIFF_EMOJI = { easy: '😊', medium: '💪', hard: '🔥', mixed: '🎲' };
const GETS = {
  quick:    ['A fast daily warm-up', 'Every answer scored out of 100', 'Fixes and a model answer for each question'],
  full:     ['A complete placement-style round', 'Technical, HR and behavioural questions together', 'A full report on your weakest areas'],
  company:  ["Questions shaped by the company's hiring style", 'Type any company, or pick one', 'See how ready you are for that round'],
  topic:    ['A deep dive into the topics you pick', 'Blend several topics in one session', 'Find the gaps before the interviewer does'],
  mcq:      ['Placement-style multiple choice', 'Marked instantly, with an explanation', 'Strike out options, or use the A to D keys'],
  aptitude: ['Quantitative and logical reasoning', 'Timed like the real test', 'Instant marking with the correct answer'],
  mixed:    ['Technical, aptitude and written questions', 'Switches format like a real assessment day', 'One combined report at the end'],
};

const CSS = `
.su-root *{box-sizing:border-box}
.su-card{transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease}
.su-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(26,110,255,.14)}
.su-card:focus-visible,.su-chip:focus-visible,.su-start:focus-visible,.su-input:focus-visible{outline:3px solid rgba(26,110,255,.4);outline-offset:2px}
.su-chip{transition:background .14s ease, border-color .14s ease, color .14s ease}
.su-chip:hover{border-color:#1A6EFF}
.su-start{transition:transform .15s ease, box-shadow .15s ease, filter .15s ease}
.su-start:not(:disabled):hover{transform:translateY(-1px);filter:brightness(1.04)}
.su-pop{animation:suPop .28s cubic-bezier(.2,.9,.3,1.2)}
.su-fade{animation:suFade .25s ease}
@keyframes suPop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes suFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.su-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:clamp(18px,3vw,36px)}
.su-diff{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.su-bar{display:none}
@media (max-width:880px){.su-hero{grid-template-columns:1fr}.su-diff{grid-template-columns:repeat(2,minmax(0,1fr))}.su-bar{display:flex}.su-hero-cta{display:none}.su-pad{padding-bottom:96px}}
@media (prefers-reduced-motion: reduce){.su-card,.su-chip,.su-start,.su-pop,.su-fade{transition:none;animation:none}}
`;

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const GroupHead = ({ title, tag }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 12px' }}>
    <strong style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.2px' }}>
      <span style={{ width: 4, height: 18, borderRadius: 4, background: C.brand500 }} />
      {title}
    </strong>
    {tag && <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: C.textMuted }}>{tag}</span>}
  </div>
);
GroupHead.propTypes = { title: PropTypes.string.isRequired, tag: PropTypes.string };

export default function SetupScreen(props) {
  const {
    modes, selectedMode, onSelectMode, getAccess, countFor, onLockedClick,
    difficulties, selectedDifficulty, onSelectDifficulty,
    company, onCompany, companyChips, topicGroups, selectedTopics, onToggleTopic,
    roleOptions, selectedRole, onRole, experienceOptions, selectedExperience, onExperience, fromProfile,
    mode, questionCount, minutes, difficultyLabel, roleLabel, levelLabel,
    canLaunch, launchBlocker, onLaunch, limitReached, daily, access, onUpgrade, error, showKeys, mounted,
  } = props;

  const accent = mode.accent;
  const startLabel = limitReached ? 'Go unlimited with Pro' : access === 'trial' ? 'Start free trial' : 'Start interview';
  const gets = GETS[selectedMode] || GETS.quick;
  const isOpen = mode.group === 'interview';
  const chips = [
    difficultyLabel, roleLabel, levelLabel,
    selectedMode === 'company' && company.trim() ? company.trim() : null,
    ...(selectedMode === 'topic' ? selectedTopics : []),
  ].filter(Boolean);

  const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 20, padding: 'clamp(16px, 2.6vw, 26px)', boxShadow: '0 1px 2px rgba(15,35,95,.04), 0 12px 30px rgba(15,35,95,.06)' };
  const sel = { width: '100%', height: 46, borderRadius: 12, border: `1px solid ${C.borderMd}`, background: '#fff', padding: '0 12px', fontFamily: F.body, fontSize: 14, color: C.text };

  return (
    <div className="su-root su-pad" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)', transition: 'opacity .3s ease, transform .3s ease' }}>
      <style>{CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 2px 12px', fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', color: C.textMuted }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.success, boxShadow: '0 0 0 4px rgba(16,185,129,.18)' }} />
          MOCKMATE SESSION BUILDER
        </span>
        <span>AI ASSESSMENT READY</span>
      </div>

      {/* Banner: changes with the chosen mode */}
      <section style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, padding: 'clamp(20px, 3.4vw, 36px)', background: 'linear-gradient(135deg, #0A3FCC 0%, #1A6EFF 58%, #0891B2 130%)', color: '#fff', boxShadow: '0 20px 44px rgba(10,63,204,.28)' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -110, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
        <div className="su-hero" style={{ position: 'relative' }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', opacity: 0.75, marginBottom: 12 }}>SESSION PREVIEW</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div key={selectedMode} className="su-pop" style={{ width: 62, height: 62, borderRadius: 18, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>
                {EMOJI[selectedMode]}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: F.display, fontSize: 'clamp(22px, 3vw, 29px)', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.15 }}>{mode.label}</div>
                <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 3 }}>{questionCount} questions, up to {minutes} min. {mode.kind}.</div>
              </div>
            </div>
            <ul key={`g-${selectedMode}`} className="su-fade" style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: 7 }}>
              {gets.map((g) => (
                <li key={g} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,.94)' }}>
                  <span style={{ color: '#7DE3FF', fontWeight: 900 }}>✓</span>{g}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 16 }}>
              {chips.map((c) => (
                <span key={c} style={{ padding: '5px 11px', borderRadius: 99, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', fontSize: 12, fontWeight: 700 }}>{c}</span>
              ))}
            </div>
          </div>

          <div className="su-hero-cta" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', opacity: 0.75 }}>YOUR NEXT INTERVIEW REP</div>
            <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 'clamp(26px, 3.4vw, 38px)', fontWeight: 900, letterSpacing: '-0.9px', lineHeight: 1.1 }}>
              Walk in prepared.<br /><span style={{ color: '#7DE3FF' }}>Walk out better.</span>
            </h1>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'rgba(255,255,255,.86)' }}>
              MockMate writes the session around your mode, role and difficulty, then scores the answers you actually give.
            </p>
            {daily && <UsageMeter daily={daily} tone="dark" />}
            <button type="button" className="su-start" disabled={!canLaunch} onClick={onLaunch}
              style={{ height: 54, borderRadius: 15, border: 'none', cursor: canLaunch ? 'pointer' : 'not-allowed', background: canLaunch ? '#fff' : 'rgba(255,255,255,.35)', color: canLaunch ? C.brand700 : 'rgba(255,255,255,.8)', fontFamily: F.display, fontSize: 16, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: canLaunch ? '0 12px 28px rgba(0,0,0,.2)' : 'none' }}>
              {startLabel}<Arrow />
            </button>
            <div role={launchBlocker ? 'status' : undefined} style={{ fontSize: 12.5, color: launchBlocker ? '#FFE08A' : 'rgba(255,255,255,.78)', fontWeight: launchBlocker ? 700 : 500 }}>
              {launchBlocker || (access === 'trial' ? 'A one-time free trial of a Pro mode.' : 'The timer starts when the first question appears.')}
            </div>
            {showKeys && isOpen && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>In the room: Enter submits, Shift+Enter adds a line.</div>
            )}
          </div>
        </div>
      </section>

      {limitReached && <div style={{ marginTop: 14 }}><DailyLimitCard daily={daily} onUpgrade={onUpgrade} /></div>}

      <section style={{ ...card, marginTop: 16 }}>
        <GroupHead title="Assessment type" tag="PICK ONE" />
        <div role="radiogroup" aria-label="Assessment type" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 12 }}>
          {modes.map(([value, meta]) => {
            const selected = selectedMode === value;
            const acc = getAccess(value);
            const locked = acc === 'locked';
            const n = countFor(value);
            return (
              <button key={value} type="button" role="radio" aria-checked={selected} className="su-card"
                aria-label={locked ? `${meta.label} (Pro). Opens upgrade options.` : undefined}
                onClick={() => (locked ? onLockedClick(value) : onSelectMode(value))}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', padding: 14, borderRadius: 16, cursor: 'pointer', fontFamily: F.body,
                  border: `1.5px solid ${selected ? meta.accent : C.border}`, background: selected ? meta.soft : '#fff', boxShadow: selected ? `0 0 0 3px ${meta.accent}22` : 'none' }}>
                <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, background: selected ? '#fff' : meta.soft }}>{EMOJI[value]}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <strong style={{ fontFamily: F.display, fontSize: 15.5, fontWeight: 800, color: C.text }}>{meta.label}</strong>
                    {acc === 'trial' && <ProBadge variant="trial" label="Try once free" />}
                    {locked && <ProBadge variant="pro" />}
                  </span>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 13, lineHeight: 1.5, color: C.textSub }}>{meta.blurb}</span>
                  <span style={{ display: 'block', marginTop: 6, fontFamily: F.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: meta.accent }}>{n} questions · up to {Math.max(1, Math.round((n * meta.perQ) / 60))} min</span>
                </span>
                <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900,
                  border: `1.5px solid ${selected ? meta.accent : C.borderMd}`, background: selected ? meta.accent : '#fff', color: '#fff' }}>
                  {locked ? <span style={{ color: C.textMuted, fontSize: 11 }}>🔒</span> : selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ height: 1, background: C.border, margin: '22px 0' }} />

        <GroupHead title="Difficulty" tag="PASSED DIRECTLY TO THE AI" />
        <div className="su-diff" role="radiogroup" aria-label="Difficulty">
          {difficulties.map((d) => {
            const selected = selectedDifficulty === d.value;
            return (
              <button key={d.value} type="button" role="radio" aria-checked={selected} className="su-card" onClick={() => onSelectDifficulty(d.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '12px 13px', borderRadius: 14, cursor: 'pointer', fontFamily: F.body,
                  border: `1.5px solid ${selected ? d.accent : C.border}`, background: selected ? C.surfaceAlt : '#fff', boxShadow: selected ? `0 0 0 3px ${d.accent}22` : 'none' }}>
                <span style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, background: `${d.accent}1A`, flexShrink: 0 }}>{DIFF_EMOJI[d.value]}</span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontFamily: F.display, fontSize: 14.5, fontWeight: 800, color: C.text }}>{d.label}</strong>
                  <span style={{ display: 'block', fontSize: 12, color: C.textSub, marginTop: 1 }}>{d.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        {selectedMode === 'company' && (
          <div className="su-fade">
            <div style={{ height: 1, background: C.border, margin: '22px 0' }} />
            <GroupHead title="Target company" tag="REQUIRED FOR THIS MODE" />
            <input type="text" className="su-input" aria-label="Target company" placeholder="Type a company, or pick one below" value={company} maxLength={80}
              onChange={(e) => onCompany(e.target.value)} style={{ ...sel, height: 48, fontSize: 14.5 }} />
            <p style={{ margin: '8px 0 12px', fontSize: 12.5, color: C.textMuted }}>Not on the list? Type it. Questions follow the company&apos;s general hiring style.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {companyChips.map((c) => {
                const on = company.trim().toLowerCase() === c.toLowerCase();
                return (
                  <button key={c} type="button" className="su-chip" aria-pressed={on} onClick={() => onCompany(c)}
                    style={{ padding: '8px 14px', borderRadius: 99, cursor: 'pointer', fontFamily: F.body, fontSize: 13, fontWeight: 700, border: `1.5px solid ${on ? C.brand500 : C.border}`, background: on ? C.brand500 : '#fff', color: on ? '#fff' : C.text }}>{c}</button>
                );
              })}
            </div>
          </div>
        )}

        {selectedMode === 'topic' && (
          <div className="su-fade">
            <div style={{ height: 1, background: C.border, margin: '22px 0' }} />
            <GroupHead title="Topics" tag={selectedTopics.length ? `${selectedTopics.length} SELECTED` : 'PICK AT LEAST ONE'} />
            {topicGroups.map((g) => (
              <div key={g.id} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', color: C.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>{g.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {g.topics.map((t) => {
                    const on = selectedTopics.includes(t);
                    return (
                      <button key={t} type="button" className="su-chip" aria-pressed={on} onClick={() => onToggleTopic(t)}
                        style={{ padding: '8px 14px', borderRadius: 99, cursor: 'pointer', fontFamily: F.body, fontSize: 13, fontWeight: 700, border: `1.5px solid ${on ? C.brand500 : C.border}`, background: on ? C.brand500 : '#fff', color: on ? '#fff' : C.text }}>
                        {on ? '✓ ' : ''}{t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: C.border, margin: '22px 0' }} />
        <GroupHead title="Your role and level" tag={fromProfile ? 'FROM YOUR PROFILE' : undefined} />
        <p style={{ margin: '-4px 0 12px', fontSize: 12.5, color: C.textMuted }}>This sets how deep the questions go, so a fresher gets fresher-level questions.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 12.5, fontWeight: 700, color: C.textSub }}>Target role
            <select className="su-input" style={sel} value={selectedRole} onChange={(e) => onRole(e.target.value)}>
              {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 12.5, fontWeight: 700, color: C.textSub }}>Experience
            <select className="su-input" style={sel} value={selectedExperience} onChange={(e) => onExperience(e.target.value)}>
              {experienceOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
        </div>

        {error && (
          <div role="alert" className="su-fade" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13.5 }}>
            <strong>Couldn&apos;t start the interview.</strong> {error}
          </div>
        )}
      </section>

      {/* Phone and tablet: Start stays reachable */}
      <div className="su-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${C.border}` }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', fontFamily: F.display, fontSize: 14.5, color: C.text }}>{EMOJI[selectedMode]} {mode.label}</strong>
          <span style={{ display: 'block', fontSize: 12, color: launchBlocker ? C.warning : C.textSub, fontWeight: launchBlocker ? 700 : 500 }}>{launchBlocker || `${questionCount} questions, up to ${minutes} min`}</span>
        </div>
        <button type="button" className="su-start" disabled={!canLaunch} onClick={onLaunch}
          style={{ height: 46, padding: '0 20px', borderRadius: 13, border: 'none', cursor: canLaunch ? 'pointer' : 'not-allowed', background: canLaunch ? `linear-gradient(135deg, ${accent}, ${C.brand700})` : C.border, color: '#fff', fontFamily: F.display, fontSize: 14.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {limitReached ? 'Go Pro' : access === 'trial' ? 'Try free' : 'Start'}<Arrow />
        </button>
      </div>
    </div>
  );
}

const optionShape = PropTypes.shape({ value: PropTypes.string, label: PropTypes.string });

SetupScreen.propTypes = {
  modes: PropTypes.array.isRequired,
  selectedMode: PropTypes.string.isRequired,
  onSelectMode: PropTypes.func.isRequired,
  getAccess: PropTypes.func.isRequired,
  countFor: PropTypes.func.isRequired,
  onLockedClick: PropTypes.func.isRequired,
  difficulties: PropTypes.array.isRequired,
  selectedDifficulty: PropTypes.string.isRequired,
  onSelectDifficulty: PropTypes.func.isRequired,
  company: PropTypes.string.isRequired,
  onCompany: PropTypes.func.isRequired,
  companyChips: PropTypes.array.isRequired,
  topicGroups: PropTypes.array.isRequired,
  selectedTopics: PropTypes.array.isRequired,
  onToggleTopic: PropTypes.func.isRequired,
  roleOptions: PropTypes.arrayOf(optionShape).isRequired,
  selectedRole: PropTypes.string,
  onRole: PropTypes.func.isRequired,
  experienceOptions: PropTypes.arrayOf(optionShape).isRequired,
  selectedExperience: PropTypes.string,
  onExperience: PropTypes.func.isRequired,
  fromProfile: PropTypes.bool,
  mode: PropTypes.object.isRequired,
  questionCount: PropTypes.number.isRequired,
  minutes: PropTypes.number.isRequired,
  difficultyLabel: PropTypes.string.isRequired,
  roleLabel: PropTypes.string,
  levelLabel: PropTypes.string,
  canLaunch: PropTypes.bool.isRequired,
  launchBlocker: PropTypes.string,
  onLaunch: PropTypes.func.isRequired,
  limitReached: PropTypes.bool,
  daily: PropTypes.object,
  access: PropTypes.string,
  onUpgrade: PropTypes.func,
  error: PropTypes.string,
  showKeys: PropTypes.bool,
  mounted: PropTypes.bool,
};
