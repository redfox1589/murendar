import { useMemo, useState } from 'react';
import {
  MONTHS, WEEKDAYS, dateKey, isDone, occursOn,
  pad, type Task,
} from '../lib/store';

interface Props {
  tasks: Task[];
  onAddTask: (dateKey?: string) => void;
  onOpenDay: (key: string) => void;
  selectedDay: string;
}

export function CalendarView({ tasks, onAddTask, onOpenDay, selectedDay }: Props) {
  const todayKey = dateKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday first
    const start = new Date(cursor.y, cursor.m, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { key: dateKey(d), day: d.getDate(), dim: d.getMonth() !== cursor.m };
    });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const c of cells) {
      const list = tasks.filter(t => occursOn(t, c.key));
      if (list.length) map.set(c.key, list);
    }
    return map;
  }, [cells, tasks]);

  const monthCount = useMemo(
    () => cells.reduce((acc, c) => acc + (c.dim ? 0 : (byDay.get(c.key)?.length ?? 0)), 0),
    [cells, byDay],
  );

  const shift = (dir: number) =>
    setCursor(c => {
      const d = new Date(c.y, c.m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
      <section className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <h1 className="font-display text-[34px] sm:text-[44px] leading-none text-[var(--ink)]">
            {MONTHS[cursor.m].toUpperCase()}{' '}
            <span className="text-[var(--peri)]">{cursor.y}</span>
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => shift(-1)}
              aria-label="Предыдущий месяц"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--ink-soft)] hover:bg-[rgba(31,42,77,0.06)] transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--peri)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
            </button>
            <button
              onClick={() => shift(1)}
              aria-label="Следующий месяц"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--ink-soft)] hover:bg-[rgba(31,42,77,0.06)] transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--peri)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
            </button>
            <button className="btn-primary" onClick={() => onAddTask(selectedDay)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Задача
            </button>
          </div>
        </header>

        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-7 px-2 pt-4 pb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[11px] font-bold tracking-[0.15em] text-[var(--ink-faint)]">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1 px-2 pb-2 overflow-y-auto scrollbar-thin">
            {cells.map(c => {
              const list = byDay.get(c.key) ?? [];
              return (
                <div
                  key={c.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${c.day} ${MONTHS[cursor.m]}, задач: ${list.length}`}
                  className={`day-cell ${c.dim ? 'dim' : ''} ${c.key === todayKey ? 'today' : ''} ${
                    c.key === selectedDay ? '!bg-[var(--peri-ghost)]' : ''
                  }`}
                  onClick={() => onOpenDay(c.key)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDay(c.key); } }}
                  onDoubleClick={() => onAddTask(c.key)}
                >
                  <span className="day-num">{c.day}</span>
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {list.slice(0, 3).map(t => (
                      <span
                        key={t.id}
                        className={`chip chip-${t.category} ${isDone(t, c.key) ? 'opacity-50 line-through' : ''}`}
                      >
                        {t.time} {t.title}
                      </span>
                    ))}
                    {list.length > 3 && (
                      <span className="text-[10px] font-bold text-[var(--ink-faint)] pl-1">+{list.length - 3} ещё</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 text-[13px] text-[var(--ink-faint)]">
          <span className="font-display text-[20px] text-[var(--ink)]">{monthCount}</span>
          {declension(monthCount, 'задача', 'задачи', 'задач')} на месяц · двойной клик по дню — новая задача
        </div>
      </section>
    </div>
  );
}

export function declension(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export { pad };
