import {
  CATEGORY_LABEL, MONTHS_GEN, REPEAT_LABEL, WEEKDAYS_FULL, dateKey,
  isDone, occursOn, parseKey, type Task,
} from '../lib/store';
import { declension } from './CalendarView';

interface Props {
  tasks: Task[];
  dayKey: string;
  onToggle: (id: string, key: string) => void;
  onEdit: (task: Task) => void;
}

export function DayPanel({ tasks, dayKey, onToggle, onEdit }: Props) {
  const d = parseKey(dayKey);
  const list = tasks
    .filter(t => occursOn(t, dayKey))
    .sort((a, b) => a.time.localeCompare(b.time));
  const doneCount = list.filter(t => isDone(t, dayKey)).length;
  const isToday = dayKey === dateKey(new Date());

  return (
    <aside className="w-full lg:w-[300px] flex-none flex flex-col gap-5">
      <div className="card p-6">
        <div className="text-[11px] font-bold tracking-[0.15em] text-[var(--ink-faint)] uppercase">
          {isToday ? 'Сегодня' : 'День'}
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-display text-[52px] leading-none text-[var(--ink)]">{d.getDate()}</span>
          <span className="text-[15px] text-[var(--ink-soft)]">
            {WEEKDAYS_FULL[d.getDay()]}
            <br />
            {MONTHS_GEN[d.getMonth()]} {d.getFullYear()}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {list.length === 0 && (
            <div className="text-[14px] text-[var(--ink-faint)] py-4 text-center">
              Задач нет — котик доволен 😽
            </div>
          )}
          {list.map(t => {
            const done = isDone(t, dayKey);
            return (
              <div key={t.id} className="flex items-start gap-3 group">
                <button
                  className={`check mt-1 ${done ? 'done' : ''}`}
                  onClick={() => onToggle(t.id, dayKey)}
                  aria-label={done ? 'Снять отметку' : 'Отметить выполненной'}
                >
                  {done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                  )}
                </button>
                <button
                  className="text-left flex-1 min-w-0"
                  onClick={() => onEdit(t)}
                  title="Редактировать"
                >
                  <div className="text-[12px] font-bold text-[var(--peri)]">{t.time}</div>
                  <div className={`text-[15px] leading-snug text-[var(--ink)] ${done ? 'line-through opacity-50' : ''}`}>
                    {t.title}
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className={`chip chip-${t.category}`}>{CATEGORY_LABEL[t.category]}</span>
                    {t.repeat !== 'none' && (
                      <span className="text-[11px] text-[var(--ink-faint)]">{REPEAT_LABEL[t.repeat]}</span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-6 flex items-center gap-4">
        <div>
          <div className="font-display text-[40px] leading-none text-[var(--ink)]">
            {doneCount}<span className="text-[var(--ink-faint)] text-[24px]">/{list.length}</span>
          </div>
          <div className="mt-1 text-[12px] text-[var(--ink-faint)]">
            {declension(doneCount, 'выполнена', 'выполнено', 'выполнено')}
          </div>
          <div className="mt-2 text-[12px] italic text-[var(--ink-soft)]">
            {list.length === 0
              ? 'Мур! Свободный день'
              : doneCount === list.length
                ? 'Мур! Ты справляешься!'
                : 'Мур! Продолжай!'}
          </div>
        </div>
        <img
          src="/assets/cats/cat-sleep.png"
          alt="Спящий котик"
          className="w-[86px] h-auto ml-auto select-none pointer-events-none"
          draggable={false}
        />
      </div>
    </aside>
  );
}
