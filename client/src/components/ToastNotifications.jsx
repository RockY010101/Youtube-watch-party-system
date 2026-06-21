// ToastNotifications.jsx
// Self-contained toast stack rendered fixed to the top-right of the viewport.
// Each toast auto-dismisses after `duration` ms and can also be closed manually.

import { useEffect, useState } from 'react';
import './ToastNotifications.css';

// ── Individual Toast ─────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  // Start in 'entering' state; flip to 'exiting' before removal so CSS can animate out.
  const [phase, setPhase] = useState('entering');

  const dismiss = () => {
    setPhase('exiting');
    setTimeout(() => onDismiss(toast.id), 320); // match CSS transition duration
  };

  // Auto-dismiss timer
  useEffect(() => {
    const timer = setTimeout(dismiss, toast.duration ?? 3800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`toast toast--${toast.type} toast--${phase}`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast__icon">{toast.icon}</span>
      <span className="toast__message">{toast.message}</span>
      <button className="toast__close" onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
      {/* Progress bar that drains over the duration */}
      <div
        className="toast__progress"
        style={{ animationDuration: `${toast.duration ?? 3800}ms` }}
      />
    </div>
  );
}

// ── Toast Container ──────────────────────────────────────────────────────────
export default function ToastNotifications({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
