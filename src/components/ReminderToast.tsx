import { useEffect } from 'react';
import type { ReminderEvent } from '../hooks/useReminders';

interface Props {
  event: ReminderEvent | null;
  onClose: () => void;
}

export function ReminderToast({ event, onClose }: Props) {
  useEffect(() => {
    if (!event) return;
    const id = setTimeout(onClose, 12_000);
    return () => clearTimeout(id);
  }, [event, onClose]);

  if (!event) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[min(480px,calc(100vw-24px))] anim-toast"
      role="alert"
      aria-live="assertive"
    >
      <div className="card !bg-[rgba(255,255,255,0.95)] flex items-center gap-4 px-5 py-4 shadow-2xl">
        <img
          src="./assets/cats/cat-bell.png"
          alt=""
          className="w-12 h-12 object-contain flex-none select-none"
          draggable={false}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-[var(--ink)]">Мур! Напоминание</div>
          <div className="text-[13px] text-[var(--ink-soft)] truncate">
            {event.whenLabel} — {event.task.title}
          </div>
        </div>
        <div className="text-[13px] font-bold text-[var(--peri)] flex-none">{event.task.time}</div>
        <button
          onClick={onClose}
          aria-label="Закрыть напоминание"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[rgba(31,42,77,0.06)] transition-colors flex-none focus-visible:outline-[3px] focus-visible:outline-[var(--peri)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
    </div>
  );
}
