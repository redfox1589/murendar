import { useEffect, useRef, useState } from 'react';
import {
  CATEGORY_LABEL, REMIND_OPTIONS, REPEAT_LABEL, dateKey,
  type Category, type RepeatRule, type Task,
} from '../lib/store';

export interface TaskDraft {
  title: string;
  date: string;
  time: string;
  repeat: RepeatRule;
  remindMin: number;
  category: Category;
}

interface Props {
  open: boolean;
  initial: Task | null;
  defaultDate?: string;
  onClose: () => void;
  onSave: (draft: TaskDraft, id?: string) => void;
  onDelete?: (id: string) => void;
}

const CATS: Category[] = ['personal', 'work', 'cats'];

export function TaskModal({ open, initial, defaultDate, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateKey(new Date()));
  const [time, setTime] = useState('12:00');
  const [repeat, setRepeat] = useState<RepeatRule>('none');
  const [remindMin, setRemindMin] = useState(15);
  const [category, setCategory] = useState<Category>('personal');
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDate(initial.date);
      setTime(initial.time);
      setRepeat(initial.repeat);
      setRemindMin(initial.remindMin);
      setCategory(initial.category);
    } else {
      setTitle('');
      setDate(defaultDate ?? dateKey(new Date()));
      setTime('12:00');
      setRepeat('none');
      setRemindMin(15);
      setCategory('personal');
    }
    setError('');
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [open, initial, defaultDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Котик просит название задачи 🐾');
      titleRef.current?.focus();
      return;
    }
    if (!date || !time) {
      setError('Укажите дату и время');
      return;
    }
    onSave({ title: trimmed, date, time, repeat, remindMin, category }, initial?.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade"
      style={{ background: 'rgba(31,42,77,0.28)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
      role="presentation"
    >
      <form
        className="card !bg-[rgba(255,255,255,0.92)] w-full max-w-[520px] p-7 sm:p-9 anim-modal relative"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? 'Редактировать задачу' : 'Новая задача'}
      >
        <img
          src="./assets/cats/cat-sleep.png"
          alt=""
          aria-hidden
          className="absolute -top-[64px] right-[56px] w-[110px] select-none pointer-events-none hidden sm:block"
          draggable={false}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[rgba(31,42,77,0.06)] transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--peri)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>

        <div className="text-[11px] font-bold tracking-[0.15em] text-[var(--ink-faint)]">01</div>
        <h2 className="font-display text-[26px] text-[var(--ink)] mt-1 mb-6">
          {initial ? 'Редактировать задачу' : 'Новая задача'}
        </h2>

        <label className="block mb-5">
          <span className="field-label">Название</span>
          <input
            ref={titleRef}
            className="field-input"
            value={title}
            onChange={e => { setTitle(e.target.value); setError(''); }}
            placeholder="Погладить кота Барсика"
            maxLength={120}
          />
        </label>

        <div className="grid grid-cols-2 gap-5 mb-5">
          <label>
            <span className="field-label">Дата</span>
            <input type="date" className="field-input" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label>
            <span className="field-label">Время</span>
            <input type="time" className="field-input" value={time} onChange={e => setTime(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-6">
          <label>
            <span className="field-label">Повтор</span>
            <select className="field-input" value={repeat} onChange={e => setRepeat(e.target.value as RepeatRule)}>
              {(Object.keys(REPEAT_LABEL) as RepeatRule[]).map(r => (
                <option key={r} value={r}>{REPEAT_LABEL[r]}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Напомнить</span>
            <select className="field-input" value={remindMin} onChange={e => setRemindMin(Number(e.target.value))}>
              {REMIND_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-2 flex-wrap mb-2" role="radiogroup" aria-label="Категория">
          {CATS.map(c => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              className={`tag-opt ${category === c ? 'on' : ''}`}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {error && <div className="text-[13px] font-semibold text-[#c25e78] mt-2">{error}</div>}

        <div className="flex items-center gap-3 mt-7">
          {initial && onDelete && (
            <button
              type="button"
              className="btn-ghost !text-[#c25e78] hover:!bg-[rgba(194,94,120,0.08)]"
              onClick={() => { onDelete(initial.id); onClose(); }}
            >
              Удалить
            </button>
          )}
          <button type="button" className="btn-ghost ml-auto" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary">Сохранить</button>
        </div>
      </form>
    </div>
  );
}
