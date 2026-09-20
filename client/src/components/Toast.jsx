/* eslint-disable react-refresh/only-export-components */
/**
 * MockMate Toast System
 * ─────────────────────────────────────────────────────────────────────────
 * This file intentionally exports both a utility object (toast) and
 * components (ToastItem, ToastContainer). The eslint-disable above is
 * required because react-refresh/only-export-components would otherwise
 * flag the non-component exports — but splitting this into multiple files
 * would break the simple import pattern used across the app.
 *
 * Usage:
 *   import { toast } from './components/Toast';
 *   import { ToastContainer } from './components/Toast';
 *   toast.success('Interview saved!');
 */

// FIX: removed unused `useRef` from imports
import { useState, useEffect, useCallback } from 'react';

const C = {
  card: '#FFFFFF',
  text: '#0A1628',
  sub: '#3D5280',
  border: '#DDE5F7',
  green: '#059669',
  greenTint: '#ECFDF5',
  blue500: '#1A6EFF',
  blue50: '#EBF2FF',
  amber: '#D97706',
  amberTint: '#FFFBEB',
  red: '#DC2626',
  redTint: '#FEF2F2',
};
const F = { display: "'Plus Jakarta Sans', sans-serif", body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" };

const TOAST_CONFIGS = {
  success: { icon: '✓', color: C.green,   bg: C.greenTint, border: '#BBF7D0' },
  error:   { icon: '✕', color: C.red,     bg: C.redTint,   border: '#FECACA' },
  info:    { icon: 'i', color: C.blue500, bg: C.blue50,    border: '#C7DAFF' },
  warn:    { icon: '!', color: C.amber,   bg: C.amberTint, border: '#FDE68A' },
};

// Global event emitter
const listeners = new Set();
const emit = (toast) => listeners.forEach(fn => fn(toast));

let toastId = 0;
export const toast = {
  success: (msg, opts) => emit({ id: ++toastId, type: 'success', msg, ...opts }),
  error:   (msg, opts) => emit({ id: ++toastId, type: 'error',   msg, ...opts }),
  info:    (msg, opts) => emit({ id: ++toastId, type: 'info',    msg, ...opts }),
  warn:    (msg, opts) => emit({ id: ++toastId, type: 'warn',    msg, ...opts }),
};

const ToastItem = ({ id, type = 'info', msg, onDismiss, duration = 3800 }) => {
  const [state, setState] = useState('entering'); // entering | visible | exiting
  const cfg = TOAST_CONFIGS[type] || TOAST_CONFIGS.info;

  useEffect(() => {
    const t1 = setTimeout(() => setState('visible'), 10);
    const t2 = setTimeout(() => setState('exiting'), duration);
    const t3 = setTimeout(() => onDismiss(id), duration + 280);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [id, duration, onDismiss]);

  const dismiss = useCallback(() => {
    setState('exiting');
    setTimeout(() => onDismiss(id), 260);
  }, [id, onDismiss]);

  const styles = {
    entering: { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
    visible:  { opacity: 1, transform: 'translateY(0) scale(1)' },
    exiting:  { opacity: 0, transform: 'translateY(8px) scale(0.97)' },
  };

  return (
    <div
      onClick={dismiss}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 11,
        padding: '12px 14px',
        background: C.card,
        border: `1.5px solid ${cfg.border}`,
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,31,107,0.12), 0 2px 8px rgba(0,31,107,0.06)',
        cursor: 'pointer',
        minWidth: 260, maxWidth: 380,
        backdropFilter: 'blur(12px)',
        ...styles[state],
        transition: 'all 0.26s cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'transform, opacity',
        position: 'relative',
      }}
    >
      {/* Icon badge */}
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: cfg.color,
      }}>
        {cfg.icon}
      </div>

      {/* Message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: F.body, fontSize: 13, fontWeight: 600,
          color: C.text, lineHeight: 1.4,
        }}>
          {msg}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
        borderRadius: '0 0 14px 14px', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: cfg.color, opacity: 0.35,
          animation: state === 'visible' ? `toast-bar ${duration}ms linear forwards` : 'none',
          width: state === 'visible' ? '0%' : '100%',
        }} />
      </div>
    </div>
  );
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (t) => setToasts(prev => [...prev.slice(-4), t]);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <>
      <style>{`
        @keyframes toast-bar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 99998, alignItems: 'flex-end',
      }}>
        {toasts.map(t => (
          <ToastItem key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
};

export default toast;