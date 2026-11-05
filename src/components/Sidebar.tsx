import type { ReactNode } from 'react';

export type View = 'today' | 'calendar' | 'tasks' | 'settings';

const NAV: { id: View; num: string; label: string; icon: ReactNode }[] = [
  {
    id: 'today', num: '01', label: 'Сегодня',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  },
  {
    id: 'calendar', num: '02', label: 'Календарь',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  },
  {
    id: 'tasks', num: '03', label: 'Задачи',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h9"/></svg>,
  },
  {
    id: 'settings', num: '04', label: 'Настройки',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12z"/></svg>,
  },
];

export function PawIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <ellipse cx="12" cy="15.5" rx="4.6" ry="4"/>
      <circle cx="5.6" cy="10.4" r="2.2"/>
      <circle cx="9.6" cy="7.2" r="2.3"/>
      <circle cx="14.4" cy="7.2" r="2.3"/>
      <circle cx="18.4" cy="10.4" r="2.2"/>
    </svg>
  );
}

export function Sidebar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[240px] flex-none px-5 py-8 relative">
        <div className="flex items-center gap-2 text-[var(--ink)]">
          <PawIcon size={24} />
          <span className="font-display text-[22px]">Мурендарь</span>
        </div>
        <div className="mt-1 text-[12px] text-[var(--ink-faint)] tracking-wide">календарь · напоминалка</div>

        <nav className="mt-12 flex flex-col gap-1" aria-label="Основная навигация">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => onNavigate(n.id)}
            >
              <span className="nav-num">{n.num}</span>
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-8 flex flex-col items-center gap-3">
          <img
            src="/assets/cats/cat-sit.png"
            alt="Котик-помощник"
            className="w-[150px] h-auto select-none pointer-events-none"
            draggable={false}
          />
          <p className="text-[13px] leading-snug text-[var(--ink-soft)] italic text-center">
            «Мур-мур! Не забудь<br />про задачки»
          </p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around card !rounded-none border-t px-2 pt-2"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        aria-label="Основная навигация"
      >
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => onNavigate(n.id)}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold min-w-[56px] min-h-[44px] justify-center transition-colors ${
              view === n.id ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'
            }`}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>
    </>
  );
}
