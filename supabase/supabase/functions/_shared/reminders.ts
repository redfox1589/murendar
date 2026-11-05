/* Логика напоминаний: какие задачи пора отправить прямо сейчас (зеркало клиентской) */

export interface TaskLike {
  id: string;
  title: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  remindMin: number;
}

function tzParts(tz: string, date: Date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24, min: +p.minute };
}

export function dateKeyLocal(tz: string, now: number): string {
  const p = tzParts(tz, new Date(now));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function zonedToUtc(tz: string, y: number, m: number, d: number, h: number, mi: number): number {
  let utc = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const p = tzParts(tz, new Date(utc));
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, 0);
    const diff = asUtc - utc;
    if (diff === 0) break;
    utc -= diff;
  }
  return utc;
}

function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

function utcWeekday(key: string): number {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function occursOn(task: TaskLike, key: string): boolean {
  if (key < task.date) return false;
  if (task.repeat === 'none') return key === task.date;
  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekly') return utcWeekday(task.date) === utcWeekday(key);
  if (task.repeat === 'monthly') return parseKey(task.date).d === parseKey(key).d;
  return false;
}

function occurrenceUtc(task: TaskLike, key: string, tz: string): number {
  const { y, m, d } = parseKey(key);
  const [h, mi] = task.time.split(':').map(Number);
  return zonedToUtc(tz, y, m, d, h, mi);
}

function remindLabel(remindMin: number): string {
  if (remindMin === 0) return 'Прямо сейчас';
  if (remindMin < 60) return `Через ${remindMin} минут`;
  return 'Через 1 час';
}

export interface DueReminder {
  task: TaskLike;
  fireKey: string;
  payload: { title: string; body: string; tag: string; url: string };
}

/* Какие напоминания нужно отправить для списка задач прямо сейчас */
export function dueReminders(tasks: TaskLike[], fired: Record<string, number>, tz: string, now: number): DueReminder[] {
  const today = dateKeyLocal(tz, now);
  const out: DueReminder[] = [];
  for (const task of tasks) {
    if (!occursOn(task, today)) continue;
    const ts = occurrenceUtc(task, today, tz);
    const fireAt = ts - (task.remindMin || 0) * 60000;
    if (now >= fireAt && now < ts + 2 * 3600000) {
      const fireKey = `${task.id}|${today}|${task.time}`;
      if (fired[fireKey]) continue;
      out.push({
        task,
        fireKey,
        payload: {
          title: 'Мур! Напоминание 🐾',
          body: `${remindLabel(task.remindMin || 0)} — ${task.title}`,
          tag: fireKey,
          url: './',
        },
      });
    }
  }
  return out;
}
