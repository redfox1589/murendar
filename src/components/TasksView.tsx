import { useMemo, useState } from 'react';
import {
  CATEGORY_LABEL, MONTHS_GEN, dateKey, isDone, occursOn, parseKey, type Category, type Task,
} from '../lib/store';
import { declension } from './CalendarView';

interface Props {
  tasks: Task[];
  onToggle: (id: string, key: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

type Filter = 'all' | Category;

export function TasksView({ tasks, onToggle, onEdit, onDelete, onAdd }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const todayKey = dateKey(new Date());

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    // show occurrences for the next 60 days + overdue non-repeating
    const days: string[] = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(dateKey(d));
    }
    for (const t of tasks) {
      if (filter !== 'all' && t.category !== filter) continue;
      if (t.repeat === 'none' && t.date < todayKey && !t.done) {
        map.set(t.date, [...(map.get(t.date) ?? []), t]);
        continue;
      }
      for (const key of days) {
        if (occursOn(t, key) && !isDone(t, key)) {
          map.set(key, [...(map.get(key) ?? []), t]);
        }
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => ({
        key,
        list: list.sort((a, b) => a.time.localeCompare(b.time)),
      }));
  }, [tasks, filter, todayKey]);

  const total = groups.reduce((n, g) => n + g.list.length, 0);

  return (
    <section className="flex-1 min-w-0 max-w-[860px]">
      <header className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-[34px] sm:text-[44px] leading-none text-[var(--ink)]">ЗАДАЧИ</h1>
          <div className="mt-2 text-[14px] text-[var(--ink-faint)]">
            {total} {declension(total, 'активная', 'активные', 'активных')} на ближайшие 60 дней
          </div>
        </div>
        <button className="btn-primary" onClick={onAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Задача
        </button>
      </header>

      <div className="flex gap-2 flex-wrap mb-6" role="tablist" aria-label="Фильтр по категориям">
        {(['all', 'personal', 'work', 'cats'] as Filter[]).map(f => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`tag-opt ${filter === f ? 'on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Все' : CATEGORY_LABEL[f]}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="card p-10 text-center">
          <img src="./assets/cats/cat-loaf.png" alt="" className="w-[130px] mx-auto mb-3 select-none" draggable={false} />
          <div className="text-[var(--ink-faint)]">Пусто. Котик уже разлёгся — добавьте задачу!</div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map(g => {
          const d = parseKey(g.key);
          const isToday = g.key === todayKey;
          const overdue = g.key < todayKey;
          return (
            <div key={g.key}>
              <div className="flex items-baseline gap-3 mb-2">
                <span className={`font-display text-[22px] ${overdue ? 'text-[#c25e78]' : 'text-[var(--ink)]'}`}>
                  {isToday ? 'Сегодня' : `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`}
                </span>
                {overdue && <span className="text-[12px] font-bold text-[#c25e78]">просрочено</span>}
                <span className="text-[12px] text-[var(--ink-faint)]">
                  {g.list.length} {declension(g.list.length, 'задача', 'задачи', 'задач')}
                </span>
              </div>
              <div className="card divide-line">
                {g.list.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                    <button
                      className="check"
                      onClick={() => onToggle(t.id, g.key)}
                      aria-label="Отметить выполненной"
                    />
                    <span className="text-[13px] font-bold text-[var(--peri)] w-[44px] flex-none">{t.time}</span>
                    <button className="flex-1 min-w-0 text-left" onClick={() => onEdit(t)}>
                      <span className="text-[15px] text-[var(--ink)]">{t.title}</span>
                      <span className={`chip chip-${t.category} ml-2`}>{CATEGORY_LABEL[t.category]}</span>
                    </button>
                    <button
                      onClick={() => onDelete(t.id)}
                      aria-label="Удалить задачу"
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--ink-faint)] hover:text-[#c25e78] hover:bg-[rgba(194,94,120,0.08)] transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--peri)]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
