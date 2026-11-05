import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sidebar, type View } from './components/Sidebar';
import { CalendarView } from './components/CalendarView';
import { TodayView } from './components/TodayView';
import { TasksView } from './components/TasksView';
import { SettingsView } from './components/SettingsView';
import { TaskModal, type TaskDraft } from './components/TaskModal';
import { DayPanel } from './components/DayPanel';
import { ReminderToast } from './components/ReminderToast';
import { AuthView } from './components/AuthView';
import { useTasks } from './hooks/useTasks';
import { useReminders, type ReminderEvent } from './hooks/useReminders';
import {
  dateKey, loadSettings, loadTasks, saveSettings, type Settings, type Task,
} from './lib/store';
import { registerUser, syncNow } from './lib/sync';
import { onAuthChange, supabase } from './lib/auth';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = onAuthChange((s, event) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-100dvh flex items-center justify-center">
        <img src="./assets/cats/cat-sleep.png" alt="" className="w-[90px] opacity-70 animate-pulse select-none" draggable={false} />
      </div>
    );
  }

  if (!session || recoveryMode) {
    return <AuthView recoveryMode={recoveryMode} onRecoveryDone={() => setRecoveryMode(false)} />;
  }

  return <MainApp session={session} />;
}

function MainApp({ session }: { session: Session }) {
  const { tasks, addTask, updateTask, deleteTask, toggleDone, replaceTasks } = useTasks();
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [view, setView] = useState<View>('calendar');
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [draftDate, setDraftDate] = useState<string | undefined>();
  const [reminder, setReminder] = useState<ReminderEvent | null>(null);

  useEffect(() => saveSettings(settings), [settings]);

  // При входе: регистрируемся на сервере, дальше синхронизируемся каждую минуту,
  // при возврате во вкладку/приложение и после каждого изменения задач
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) syncNow(loadTasks(), replaceTasks);
    };
    (async () => {
      try { await registerUser(); } catch { /* офлайн */ }
      tick();
    })();
    const id = setInterval(tick, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  useReminders(tasks, settings, useCallback(e => setReminder(e), []));

  const openAdd = (key?: string) => {
    setEditing(null);
    setDraftDate(key);
    setModalOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setDraftDate(undefined);
    setModalOpen(true);
  };

  const handleSave = (draft: TaskDraft, id?: string) => {
    if (id) updateTask(id, draft);
    else addTask(draft);
  };

  const openDay = (key: string) => {
    setSelectedDay(key);
  };

  const clearAll = () => {
    if (window.confirm('Удалить все задачи? Котик будет скучать.')) {
      tasks.forEach(t => deleteTask(t.id));
    }
  };

  return (
    <div className="flex min-h-100dvh">
      <Sidebar view={view} onNavigate={setView} />

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-24 md:pb-10 flex flex-col">
        {view === 'today' && (
          <TodayView
            tasks={tasks}
            onToggle={toggleDone}
            onEdit={openEdit}
            onAdd={() => openAdd(dateKey(new Date()))}
            goCalendar={() => setView('calendar')}
          />
        )}

        {view === 'calendar' && (
          <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
            <CalendarView
              tasks={tasks}
              onAddTask={openAdd}
              onOpenDay={openDay}
              selectedDay={selectedDay}
            />
            <DayPanel tasks={tasks} dayKey={selectedDay} onToggle={toggleDone} onEdit={openEdit} />
          </div>
        )}

        {view === 'tasks' && (
          <TasksView
            tasks={tasks}
            onToggle={toggleDone}
            onEdit={openEdit}
            onDelete={deleteTask}
            onAdd={() => openAdd()}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            settings={settings}
            onChange={setSettings}
            onClearAll={clearAll}
            email={session.user.email || ''}
          />
        )}
      </main>

      <TaskModal
        open={modalOpen}
        initial={editing}
        defaultDate={draftDate}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={deleteTask}
      />

      <ReminderToast event={reminder} onClose={() => setReminder(null)} />
    </div>
  );
}
