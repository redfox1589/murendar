import { useEffect, useRef } from 'react';
import {
  dateKey, loadFired, occursOn, occurrenceTimestamp, saveFired,
  type Settings, type Task,
} from '../lib/store';
import { playChime } from '../lib/sound';

export interface ReminderEvent {
  task: Task;
  whenLabel: string;
}

export function useReminders(
  tasks: Task[],
  settings: Settings,
  onFire: (e: ReminderEvent) => void,
) {
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const today = dateKey(new Date());
      const fired = loadFired();
      let changed = false;
      for (const task of tasks) {
        if (!occursOn(task, today)) continue;
        const ts = occurrenceTimestamp(task, today);
        const fireAt = ts - task.remindMin * 60_000;
        // fire window: from fireAt until 2 hours after start
        if (now >= fireAt && now < ts + 2 * 3_600_000) {
          const key = `${task.id}|${today}|${task.time}`;
          if (!fired[key]) {
            fired[key] = now;
            changed = true;
            const label =
              task.remindMin === 0
                ? 'Прямо сейчас'
                : task.remindMin < 60
                  ? `Через ${task.remindMin} минут`
                  : 'Через 1 час';
            if (settingsRef.current.sound) playChime();
            if (settingsRef.current.notifications && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('Мур! Напоминание 🐾', {
                  body: `${label} — ${task.title}`,
                  icon: '/assets/cats/cat-sit.png',
                  tag: key,
                });
              } catch { /* some browsers require SW; in-app toast still shows */ }
            }
            onFireRef.current({ task, whenLabel: label });
          }
        }
      }
      if (changed) saveFired(fired);
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [tasks]);
}
