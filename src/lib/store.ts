export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly';
export type Category = 'personal' | 'work' | 'cats';

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  repeat: RepeatRule;
  remindMin: number; // minutes before
  category: Category;
  done: boolean; // for non-repeating
  doneDates: string[]; // for repeating occurrences
  createdAt: number;
}

export interface Settings {
  notifications: boolean;
  sound: boolean;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  personal: 'Личное',
  work: 'Работа',
  cats: 'Котики',
};

export const REPEAT_LABEL: Record<RepeatRule, string> = {
  none: 'Не повторять',
  daily: 'Каждый день',
  weekly: 'Каждую неделю',
  monthly: 'Каждый месяц',
};

export const REMIND_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'В момент начала' },
  { value: 5, label: 'За 5 минут' },
  { value: 15, label: 'За 15 минут' },
  { value: 30, label: 'За 30 минут' },
  { value: 60, label: 'За 1 час' },
];

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function occursOn(task: Task, key: string): boolean {
  if (key < task.date) return false;
  if (task.repeat === 'none') return key === task.date;
  const start = parseKey(task.date);
  const cur = parseKey(key);
  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekly') return start.getDay() === cur.getDay();
  if (task.repeat === 'monthly') {
    if (start.getDate() !== cur.getDate()) return false;
    return true;
  }
  return false;
}

export function isDone(task: Task, key: string): boolean {
  if (task.repeat === 'none') return task.done;
  return task.doneDates.includes(key);
}

export function occurrenceTimestamp(task: Task, key: string): number {
  const [h, m] = task.time.split(':').map(Number);
  const d = parseKey(key);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const TASKS_KEY = 'murendar.tasks.v1';
const SETTINGS_KEY = 'murendar.settings.v1';
const FIRED_KEY = 'murendar.fired.v1';

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Task[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { notifications: false, sound: true, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { notifications: false, sound: true };
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadFired(): Record<string, number> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function saveFired(f: Record<string, number>) {
  // keep last 500 entries
  const entries = Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 500);
  localStorage.setItem(FIRED_KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const WEEKDAYS_FULL = [
  'воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота',
];
