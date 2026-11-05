import { useCallback, useEffect, useState } from 'react';
import { loadTasks, saveTasks, type Task } from '../lib/store';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = useCallback((t: Omit<Task, 'id' | 'createdAt' | 'done' | 'doneDates'>) => {
    setTasks(prev => [...prev, { ...t, id: crypto.randomUUID(), createdAt: Date.now(), done: false, doneDates: [] }]);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const toggleDone = useCallback((id: string, dateKey: string) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        if (t.repeat === 'none') return { ...t, done: !t.done };
        const has = t.doneDates.includes(dateKey);
        return { ...t, doneDates: has ? t.doneDates.filter(d => d !== dateKey) : [...t.doneDates, dateKey] };
      }),
    );
  }, []);

  return { tasks, addTask, updateTask, deleteTask, toggleDone };
}
