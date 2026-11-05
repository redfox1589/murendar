import { useState } from 'react';
import { playChime } from '../lib/sound';
import type { Settings, Task } from '../lib/store';
import {
  disablePush, enablePush, generateSyncCode, getSyncCode, getSyncMeta,
  pullTasks, registerCode, schedulePushTasks, setSyncCode, setSyncMeta,
} from '../lib/sync';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClearAll: () => void;
  tasks: Task[];
  onReplaceTasks: (t: Task[]) => void;
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`w-[52px] h-[30px] rounded-full p-[3px] transition-colors flex-none ${
        on ? 'bg-[var(--peri)]' : 'bg-[var(--ink-faint)]/40'
      } focus-visible:outline-[3px] focus-visible:outline-[var(--peri)]`}
    >
      <span
        className={`block w-[24px] h-[24px] rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-[22px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

const CODE_RE = /^mur-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/;

export function SettingsView({ settings, onChange, onClearAll, tasks, onReplaceTasks }: Props) {
  const permission = 'Notification' in window ? Notification.permission : 'unavailable';
  const [syncCode, setSyncCodeState] = useState<string | null>(() => getSyncCode());
  const [pushOn, setPushOn] = useState<boolean>(() => getSyncMeta().pushEnabled);
  const [linkCode, setLinkCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [copied, setCopied] = useState(false);

  const toggleNotifications = async () => {
    if (!settings.notifications) {
      if ('Notification' in window && Notification.permission === 'default') {
        const res = await Notification.requestPermission();
        if (res !== 'granted') {
          onChange({ ...settings, notifications: false });
          return;
        }
      }
      onChange({ ...settings, notifications: true });
    } else {
      onChange({ ...settings, notifications: false });
    }
  };

  const enableSync = async (code?: string) => {
    setBusy(true);
    setSyncError('');
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (code) setSyncCode(code);
      else if (!getSyncCode()) setSyncCode(generateSyncCode());

      await registerCode();
      const { tasks: remote, updatedAt } = await pullTasks();
      if (code || (updatedAt > 0 && remote.length > 0)) {
        // Сервер — источник правды: привязка устройства или там уже есть задачи
        onReplaceTasks(remote);
        setSyncMeta({ ...getSyncMeta(), lastServerUpdatedAt: updatedAt });
      } else {
        // Сервер пуст — выгружаем локальные задачи
        schedulePushTasks(tasks);
      }

      let pushOk = false;
      try {
        pushOk = await enablePush();
      } catch {
        pushOk = false;
      }
      setPushOn(pushOk);
      setSyncCodeState(getSyncCode());
      setLinkCode('');
      if (!pushOk) {
        setSyncError(
          'Синхронизация включена, но push-подписка не удалась. На iPhone нужно открыть Мурендарь ' +
          'с домашнего экрана (добавить через Safari → «На экран Домой») и включить заново там.'
        );
      }
    } catch {
      setSyncError('Не удалось подключиться к серверу. Проверь интернет и попробуй ещё раз.');
      setSyncCode(null);
      setSyncCodeState(null);
    } finally {
      setBusy(false);
    }
  };

  const disableSync = async () => {
    setBusy(true);
    try {
      await disablePush();
    } finally {
      setSyncCode(null);
      setSyncMeta({ lastServerUpdatedAt: 0, pushEnabled: false });
      setSyncCodeState(null);
      setPushOn(false);
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!syncCode) return;
    try {
      await navigator.clipboard.writeText(syncCode);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = syncCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="flex-1 min-w-0 max-w-[640px]">
      <h1 className="font-display text-[34px] sm:text-[44px] leading-none text-[var(--ink)] mb-8">НАСТРОЙКИ</h1>

      <div className="card p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[16px] font-bold text-[var(--ink)]">Синхронизация и push</div>
            <div className="text-[13px] text-[var(--ink-faint)] mt-1">
              Задачи на сервере, напоминания приходят, даже когда приложение закрыто.
            </div>
          </div>
          {!syncCode ? (
            <button className="btn-ghost !py-2 !px-4 text-[13px]" disabled={busy} onClick={() => enableSync()}>
              {busy ? 'Подключаю…' : 'Включить'}
            </button>
          ) : (
            <button
              className="btn-ghost !py-2 !px-4 text-[13px] !text-[#c25e78] hover:!bg-[rgba(194,94,120,0.08)]"
              disabled={busy}
              onClick={disableSync}
            >
              Отключить
            </button>
          )}
        </div>

        {syncCode && (
          <div className="rounded-2xl bg-[var(--peri)]/10 p-4 flex flex-col gap-2">
            <div className="text-[13px] text-[var(--ink-faint)]">
              Код синхронизации — сохрани его. По нему подключаются другие устройства и восстанавливаются задачи:
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <code className="text-[16px] font-bold tracking-wide text-[var(--ink)] select-all">{syncCode}</code>
              <button className="btn-ghost !py-1.5 !px-3 text-[12px]" onClick={copyCode}>
                {copied ? 'Скопировано ✓' : 'Скопировать'}
              </button>
            </div>
            <div className="text-[13px] text-[var(--ink-faint)]">
              Push-уведомления: {pushOn ? 'включены 🐾' : 'не активны — нажми «Включить» на этом устройстве ещё раз'}
            </div>
          </div>
        )}

        {!syncCode && (
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-[var(--ink-faint)]">
              Есть код с другого устройства? Введи его, чтобы привязать это устройство:
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className="field-input flex-1 min-w-[220px] !py-2 text-[14px]"
                placeholder="mur-xxxx-xxxx-xxxx"
                value={linkCode}
                onChange={(e) => setLinkCode(e.target.value.trim().toLowerCase())}
              />
              <button
                className="btn-ghost !py-2 !px-4 text-[13px]"
                disabled={busy || !CODE_RE.test(linkCode)}
                onClick={() => enableSync(linkCode)}
              >
                Привязать
              </button>
            </div>
          </div>
        )}

        {syncError && <div className="text-[13px] text-[#c25e78] leading-relaxed">{syncError}</div>}

        <div className="h-px bg-[var(--line)]" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[16px] font-bold text-[var(--ink)]">Уведомления в браузере</div>
            <div className="text-[13px] text-[var(--ink-faint)] mt-1">
              Системные всплывающие окна при напоминаниях, пока приложение открыто.
              {permission === 'denied' && (
                <span className="block text-[#c25e78] mt-1">
                  Доступ запрещён браузером — разрешите уведомления в настройках сайта.
                </span>
              )}
              {permission === 'unavailable' && (
                <span className="block text-[#c25e78] mt-1">Браузер не поддерживает уведомления.</span>
              )}
            </div>
          </div>
          <Toggle on={settings.notifications} onClick={toggleNotifications} label="Уведомления" />
        </div>

        <div className="h-px bg-[var(--line)]" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[16px] font-bold text-[var(--ink)]">Звуковой сигнал</div>
            <div className="text-[13px] text-[var(--ink-faint)] mt-1">Мягкое «мур» при каждом напоминании.</div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-ghost !py-2 !px-4 text-[13px]" onClick={playChime}>Проверить</button>
            <Toggle
              on={settings.sound}
              onClick={() => onChange({ ...settings, sound: !settings.sound })}
              label="Звук"
            />
          </div>
        </div>

        <div className="h-px bg-[var(--line)]" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[16px] font-bold text-[var(--ink)]">Данные</div>
            <div className="text-[13px] text-[var(--ink-faint)] mt-1">
              {syncCode
                ? 'Задачи синхронизируются с сервером и дублируются в этом браузере.'
                : 'Задачи хранятся локально в этом браузере (localStorage).'}
            </div>
          </div>
          <button className="btn-ghost !py-2 !px-4 text-[13px] !text-[#c25e78] hover:!bg-[rgba(194,94,120,0.08)]" onClick={onClearAll}>
            Удалить всё
          </button>
        </div>
      </div>

      <p className="mt-6 text-[13px] text-[var(--ink-faint)] leading-relaxed">
        Мурендарь — веб-приложение (PWA-ready): его можно «установить» из браузера на Windows, Linux, macOS,
        iOS и Android, а позже обернуть в нативную оболочку (Electron / Tauri / Capacitor) без переписывания интерфейса.
      </p>
    </section>
  );
}
