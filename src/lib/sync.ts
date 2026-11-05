/* Синхронизация задач и push-подписка через Cloudflare Worker.
   Код синхронизации — единственный «ключ»: кто его знает, тот владеет данными. */

import type { Task } from './store';

export const WORKER_URL = 'https://murendar-push.PLACEHOLDER.workers.dev';
export const VAPID_PUBLIC = 'BFaRFw0A7ycW_QXoZv24EL8lcXr0zDBUg8JkoZ5LtNWbvRnxtWaqJNTpLOnk8vca-DEJc9yXVIjSwpMVP-6mAb4';

const CODE_KEY = 'murendar.sync.code.v1';
const META_KEY = 'murendar.sync.meta.v1';

export interface SyncMeta {
  lastServerUpdatedAt: number;
  pushEnabled: boolean;
}

export function getSyncCode(): string | null {
  try {
    return localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}

export function setSyncCode(code: string | null) {
  if (code) localStorage.setItem(CODE_KEY, code);
  else localStorage.removeItem(CODE_KEY);
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

/* Код вида mur-XXXX-XXXX-XXXX, без похожих символов — удобно перепечатать на другом устройстве */
export function generateSyncCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `mur-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function currentTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
  } catch {
    return 'Europe/Moscow';
  }
}

async function api(path: string, options: RequestInit = {}): Promise<Response> {
  const code = getSyncCode();
  if (!code) throw new Error('no sync code');
  return fetch(WORKER_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Code': code,
      ...(options.headers || {}),
    },
  });
}

/* Регистрация кода на сервере (создаёт запись, если её ещё нет) */
export async function registerCode(): Promise<{ tasks: Task[]; updatedAt: number }> {
  const res = await api('/api/register', { method: 'POST', body: '{}' });
  if (!res.ok) throw new Error('register failed: ' + res.status);
  const data = await res.json();
  return { tasks: data.state.tasks || [], updatedAt: data.state.updatedAt || 0 };
}

export async function pullTasks(): Promise<{ tasks: Task[]; updatedAt: number }> {
  const res = await api('/api/state');
  if (!res.ok) throw new Error('pull failed: ' + res.status);
  const data = await res.json();
  return { tasks: data.tasks || [], updatedAt: data.updatedAt || 0 };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/* Отправка задач на сервер с debounce, чтобы не слать на каждое нажатие */
export function schedulePushTasks(tasks: Task[]) {
  if (!getSyncCode()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const res = await api('/api/state', {
        method: 'PUT',
        body: JSON.stringify({ tasks, tz: currentTz() }),
      });
      if (res.ok) {
        const data = await res.json();
        setSyncMeta({ ...getSyncMeta(), lastServerUpdatedAt: data.updatedAt || Date.now() });
      }
    } catch { /* офлайн — задачи остались локально, уйдут при следующем изменении */ }
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
  const res = await api('/api/subscribe', {
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
        await api('/api/unsubscribe', {
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
