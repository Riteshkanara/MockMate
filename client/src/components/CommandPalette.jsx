/**
 * CommandPalette — Ctrl+K / Cmd+K quick navigation
 * ─────────────────────────────────────────────────────────────────────────
 * Opens a spotlight-style modal. Lets users navigate the app without
 * reaching for the navbar — extremely impressive in demos and interviews.
 *
 * Usage: Mount once inside BrowserRouter (needs useNavigate).
 *   <CommandPalette />
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const C = {
  bg: '#F0F4FF', card: '#FFFFFF', text: '#0A1628',
  sub: '#3D5280', muted: '#7A8BAF', border: '#DDE5F7',
  borderMd: '#B8CAF0', blue50: '#EBF2FF', blue500: '#1A6EFF',
  blue600: '#0057E8', cyan400: '#00C8F0',
};
const F = { display: "'Plus Jakarta Sans', sans-serif", body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" };

const COMMANDS = [
  { id: 'dashboard',   label: 'Go to Dashboard',  path: '/dashboard',   icon: '⊞', group: 'Navigate', shortcut: 'D' },
  { id: 'interview',   label: 'New Interview',     path: '/interview',   icon: '🎙', group: 'Action',   shortcut: 'N' },
  { id: 'history',     label: 'Interview History', path: '/history',     icon: '◷', group: 'Navigate', shortcut: 'H' },
  { id: 'analytics',   label: 'Analytics',         path: '/analytics',   icon: '◈', group: 'Navigate', shortcut: 'A' },
  { id: 'leaderboard', label: 'Leaderboard',       path: '/leaderboard', icon: '◆', group: 'Navigate', shortcut: 'L' },
  { id: 'coach',       label: 'AI Coach',          path: '/coach',       icon: '◐', group: 'Navigate', shortcut: 'C' },
  { id: 'home',        label: 'Home',              path: '/',            icon: '⌂', group: 'Navigate' },
];

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.group.toLowerCase().includes(query.toLowerCase())
  );

  const execute = useCallback((cmd) => {
    setOpen(false);
    setQuery('');
    setSelected(0);
    navigate(cmd.path);
  }, [navigate]);

  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') { e.preventDefault(); setOpen(v => !v); }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && filtered[selected]) execute(filtered[selected]);
  };

  if (!open) return (
    <>
      <style>{`
        .mm-cmd-trigger {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border: 1px solid ${C.border};
          border-radius: 8px; background: rgba(255,255,255,0.6);
          cursor: pointer; transition: all 0.15s;
          font: 500 11px ${F.mono}; color: ${C.muted};
          backdrop-filter: blur(8px);
        }
        .mm-cmd-trigger:hover { border-color: ${C.borderMd}; background: ${C.card}; color: ${C.sub}; }
        .mm-cmd-trigger kbd {
          padding: 1px 4px; border: 1px solid ${C.border};
          border-radius: 4px; font: inherit; font-size: 10px;
          background: rgba(255,255,255,0.8); color: ${C.muted};
        }
      `}</style>
      <button className="mm-cmd-trigger" onClick={() => setOpen(true)} title="Open command palette (Ctrl+K)">
        <kbd>⌘</kbd><kbd>K</kbd>
      </button>
    </>
  );

  return (
    <>
      <style>{`
        @keyframes mm-cmd-in { from { opacity:0; transform:scale(0.95) translateY(-8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .mm-cmd-overlay { position:fixed;inset:0;background:rgba(10,22,40,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:99997;display:flex;align-items:flex-start;justify-content:center;padding-top:15vh; }
        .mm-cmd-panel { width:min(560px,90vw);border-radius:18px;overflow:hidden;border:1.5px solid ${C.borderMd};box-shadow:0 32px 80px rgba(0,31,107,0.25),0 8px 24px rgba(0,31,107,0.1);animation:mm-cmd-in 0.18s cubic-bezier(0.22,1,0.36,1) forwards;background:${C.card}; }
        .mm-cmd-input-wrap { display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid ${C.border}; }
        .mm-cmd-icon { width:22px;height:22px;flex-shrink:0;color:${C.muted};font-size:18px;line-height:1; }
        .mm-cmd-input { flex:1;border:none;outline:none;font:600 15px ${F.display};color:${C.text};background:transparent;caret-color:${C.blue500}; }
        .mm-cmd-input::placeholder { color:${C.muted}; }
        .mm-cmd-list { max-height:360px;overflow-y:auto;padding:6px; }
        .mm-cmd-group { font:700 10px ${F.mono};letter-spacing:1px;color:${C.muted};padding:8px 10px 4px;text-transform:uppercase; }
        .mm-cmd-item { display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background 0.1s; }
        .mm-cmd-item.active { background:${C.blue50}; }
        .mm-cmd-item:hover { background:${C.blue50}; }
        .mm-cmd-item-icon { width:32px;height:32px;border-radius:8px;background:${C.bg};border:1px solid ${C.border};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0; }
        .mm-cmd-item.active .mm-cmd-item-icon { background:${C.blue500};border-color:${C.blue500};filter:grayscale(1) brightness(10); }
        .mm-cmd-item-label { flex:1;font:600 13.5px ${F.display};color:${C.text}; }
        .mm-cmd-item.active .mm-cmd-item-label { color:${C.blue600}; }
        .mm-cmd-shortcut { font:700 10px ${F.mono};color:${C.muted};background:${C.bg};border:1px solid ${C.border};border-radius:5px;padding:2px 6px; }
        .mm-cmd-footer { padding:8px 14px;border-top:1px solid ${C.border};display:flex;align-items:center;gap:16px; }
        .mm-cmd-hint { font:500 10px ${F.mono};color:${C.muted};display:flex;align-items:center;gap:5px; }
        .mm-cmd-hint kbd { padding:2px 5px;border:1px solid ${C.border};border-radius:4px;font:inherit;background:${C.bg}; }
      `}</style>
      <div className="mm-cmd-overlay" onClick={() => { setOpen(false); setQuery(''); }}>
        <div className="mm-cmd-panel" onClick={e => e.stopPropagation()}>
          {/* Input */}
          <div className="mm-cmd-input-wrap">
            <span className="mm-cmd-icon">⌕</span>
            <input
              ref={inputRef}
              className="mm-cmd-input"
              placeholder="Jump to…"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(0); }}
              onKeyDown={handleKeyDown}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.muted, fontSize: 16, padding: '2px 4px' }}>×</button>
            )}
          </div>

          {/* List */}
          <div className="mm-cmd-list">
            {filtered.length === 0 && (
              <div style={{ padding: '24px 12px', textAlign: 'center', fontFamily: F.body, fontSize: 13, color: C.muted }}>
                No results for "{query}"
              </div>
            )}
            {['Navigate', 'Action'].map(group => {
              const items = filtered.filter(c => c.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <div className="mm-cmd-group">{group}</div>
                  {items.map((cmd, i) => {
                    const idx = filtered.indexOf(cmd);
                    return (
                      <div
                        key={cmd.id}
                        className={`mm-cmd-item ${idx === selected ? 'active' : ''}`}
                        onClick={() => execute(cmd)}
                        onMouseEnter={() => setSelected(idx)}
                      >
                        <div className="mm-cmd-item-icon">{cmd.icon}</div>
                        <span className="mm-cmd-item-label">{cmd.label}</span>
                        {cmd.shortcut && <kbd className="mm-cmd-shortcut">{cmd.shortcut}</kbd>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mm-cmd-footer">
            <span className="mm-cmd-hint"><kbd>↑↓</kbd> navigate</span>
            <span className="mm-cmd-hint"><kbd>↵</kbd> open</span>
            <span className="mm-cmd-hint"><kbd>Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
