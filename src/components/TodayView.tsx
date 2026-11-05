import { useMemo } from 'react';
import { dateKey, isDone, occursOn, type Task } from '../lib/store';
import { declension } from './CalendarView';
import { DayPanel } from './DayPanel';

interface Props {
  tasks: Task[];
  onToggle: (id: string, key: string) => void;
  onEdit: (task: Task) => void;
  onAdd: () => void;
  goCalendar: () => void;
}

export function TodayView({ tasks, onToggle, onEdit, onAdd, goCalendar }: Props) {
  const todayKey = dateKey(new Date());

  const upcoming = useMemo(() => {
    const out: { key: string; list: Task[] }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const key = dateKey(d);
      const list = tasks
        .filter(t => occursOn(t, key) && !isDone(t, key))
        .sort((a, b) => a.time.localeCompare(b.time));
      if (list.length) out.push({ key, list });
    }
    return out;
  }, [tasks]);

  const todayCount = useMemo(
    () => tasks.filter(t => occursOn(t, todayKey)).length,
    [tasks, todayKey],
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
      <section className="flex-1 min-w-0">
        <header className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="font-display text-[34px] sm:text-[44px] leading-none text-[var(--ink)]">СЕГОДНЯ</h1>
            <div className="mt-2 text-[14px] text-[var(--ink-faint)]">
              {todayCount} {declension(todayCount, 'задача', 'задачи', 'задач')} на день
            </div>
          </div>
          <button className="btn-primary" onClick={onAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Задача
          </button>
        </header>

        <h2 className="text-[12px] font-bold tracking-[0.15em] uppercase text-[var(--ink-faint)] mb-3">
          Ближайшие 7 дней
        </h2>
        {upcoming.length === 0 && (
          <div className="card p-10 text-center">
            <img src="./assets/cats/cat-sleep.png" alt="" className="w-[110px] mx-auto mb-3 select-none" draggable={false} />
            <div className="text-[var(--ink-faint)]">Впереди свободная неделя — котик мурлычет.</div>
            <button className="btn-ghost mt-4" onClick={goCalendar}>Открыть календарь</button>
          </div>
        )}
        <div className="flex flex-col gap-4">
          {upcoming.map(g => {
            const d = new Date(g.key + 'T00:00:00');
            return (
              <div key={g.key} className="card p-5">
                <div className="text-[13px] font-bold text-[var(--ink-soft)] mb-3">
                  {d.getDate()} {['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][d.getMonth()]}
                </div>
                <div className="flex flex-col gap-2">
                  {g.list.map(t => (
                    <button key={t.id} className="flex items-center gap-3 text-left group" onClick={() => onEdit(t)}>
                      <span className="text-[13px] font-bold text-[var(--peri)] w-[44px] flex-none">{t.time}</span>
                      <span className="text-[15px] text-[var(--ink)] group-hover:underline underline-offset-4">{t.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <DayPanel tasks={tasks} dayKey={todayKey} onToggle={onToggle} onEdit={onEdit} />
    </div>
  );
}
