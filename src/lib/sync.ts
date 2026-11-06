/* Синхронизация задач и push-подписка через Supabase edge-функции.
   Доступ — по JWT текущего пользователя (см. auth.ts). */

import type { Task } from './store';
import { API_URL, getAccessToken } from './auth';

export const VAPID_PUBLIC = 'BFaRFw0A7ycW_QXoZv24EL8lcXr0zDBUg8JkoZ5LtNWbvRnxtWaqJNTpLOnk8vca-DEJc9yXVIjSwpMVP-6mAb4';

const META_KEY = 'murendar.sync.meta.v1';

export interface SyncMeta {
  lastServerUpdatedAt: number;
  pushEnabled: boolean;
}

export function getSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return { lastServerUpdatedAt: 0, pushEnabled: false, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { lastServerUpdatedAt: 0, pushEnabled: false };
}

export function setSyncMeta(meta: SyncMeta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function currentTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
  } catch {
    return 'Europe/Moscow';
  }
}

async function api(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error('not authenticated');
  return fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

/* Создаёт запись пользователя на сервере, если её ещё нет */
export async function registerUser(): Promise<{ tasks: Task[]; updatedAt: number }> {
  const res = await api('/register', { method: 'POST', body: '{}' });
  if (!res.ok) throw new Error('register failed: ' + res.status);
  const data = await res.json();
  return { tasks: data.state.tasks || [], updatedAt: data.state.updatedAt || 0 };
}

export async function pullTasks(): Promise<{ tasks: Task[]; updatedAt: number }> {
  const res = await api('/state');
  if (!res.ok) throw new Error('pull failed: ' + res.status);
  const data = await res.json();
  return { tasks: data.tasks || [], updatedAt: data.updatedAt || 0 };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncReady = false;          // true после первой сверки с сервером
let skipPushJson: string | null = null; // задачи, пришедшие с сервера — их не пушим обратно

export function markSyncReady() {
  syncReady = true;
}

/* Отправка задач на сервер с небольшим debounce */
export function schedulePushTasks(tasks: Task[], delayMs = 400) {
  if (!syncReady) return; // до первой сверки с сервером ничего не отправляем
  if (skipPushJson !== null && JSON.stringify(tasks) === skipPushJson) {
    skipPushJson = null;
    return; // это эхо серверных задач, обратно не шлём
  }
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const res = await api('/state', {
        method: 'PUT',
        body: JSON.stringify({ tasks, tz: currentTz() }),
      });
      if (res.ok) {
        const data = await res.json();
        setSyncMeta({ ...getSyncMeta(), lastServerUpdatedAt: data.updatedAt || Date.now() });
      }
    } catch { /* офлайн или нет сессии — задачи остались локально */ }
  }, delayMs);
}

/* Полный цикл синхронизации: если на сервере новее — забираем, иначе отправляем локальные.
   onRemote вызывается, когда локальные задачи заменены серверными. */
export async function syncNow(localTasks: Task[], onRemote: (tasks: Task[]) => void): Promise<void> {
  try {
    const { tasks: remote, updatedAt } = await pullTasks();
    syncReady = true;
    if (updatedAt > getSyncMeta().lastServerUpdatedAt && remote.length > 0) {
      skipPushJson = JSON.stringify(remote); // не пушим это обратно
      onRemote(remote);
      setSyncMeta({ ...getSyncMeta(), lastServerUpdatedAt: updatedAt });
    } else {
      // сервер пуст или старше — отправляем локальные, но только если они отличаются
      if (JSON.stringify(localTasks) !== JSON.stringify(remote)) {
        schedulePushTasks(localTasks, 0);
      }
    }
  } catch {
    syncReady = true; // офлайн — изменения всё равно будут пытаться уйти
  }
}

function b64uToUint8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/* Подписка на web-push. Требует: установленное PWA на iOS, разрешение на уведомления. */
export async function enablePush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64uToUint8(VAPID_PUBLIC) as BufferSource,
    });
  }
  const res = await api('/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription: sub.toJSON(), tz: currentTz() }),
  });
  if (res.ok) setSyncMeta({ ...getSyncMeta(), pushEnabled: true });
  return res.ok;
}

export async function disablePush(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api('/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    }
  } finally {
    setSyncMeta({ ...getSyncMeta(), pushEnabled: false });
  }
}
