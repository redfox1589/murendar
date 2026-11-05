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

/* Отправка задач на сервер с debounce, чтобы не слать на каждое нажатие */
export function schedulePushTasks(tasks: Task[]) {
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
  }, 1200);
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
