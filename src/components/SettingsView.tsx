import { useState } from 'react';
import { playChime } from '../lib/sound';
import type { Settings } from '../lib/store';
import { disablePush, enablePush, getSyncMeta, pullTasks } from '../lib/sync';
import { signOut } from '../lib/auth';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClearAll: () => void;
  email: string;
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

export function SettingsView({ settings, onChange, onClearAll, email }: Props) {
  const permission = 'Notification' in window ? Notification.permission : 'unavailable';
  const [pushOn, setPushOn] = useState<boolean>(() => getSyncMeta().pushEnabled);
  const [busy, setBusy] = useState(false);
  const [pushHint, setPushHint] = useState('');
  const [syncStatus, setSyncStatus] = useState<string>(() => {
    const t = getSyncMeta().lastServerUpdatedAt;
    return t ? `Последняя синхронизация: ${new Date(t).toLocaleString('ru-RU')}` : 'Синхронизация ещё не выполнялась';
  });
  const [syncChecking, setSyncChecking] = useState(false);

  const checkSync = async () => {
    setSyncChecking(true);
    try {
      const { tasks, updatedAt } = await pullTasks();
      const when = updatedAt ? new Date(updatedAt).toLocaleString('ru-RU') : 'никогда';
      setSyncStatus(`На сервере: ${tasks.length} задач, обновлено ${when}`);
    } catch {
      setSyncStatus('Не удалось связаться с сервером — проверь интернет');
    } finally {
      setSyncChecking(false);
    }
  };

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

  const togglePush = async () => {
    setPushHint('');
    setBusy(true);
    try {
      if (!pushOn) {
        if ('Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        let ok = false;
        try {
          ok = await enablePush();
        } catch {
          ok = false;
        }
        setPushOn(ok);
        if (!ok) {
          setPushHint(
            'Не удалось включить push. На iPhone нужно открыть Мурендарь с домашнего экрана ' +
            '(добавить через Safari → «На экран Домой») и включить там.'
          );
        }
      } else {
        await disablePush();
        setPushOn(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex-1 min-w-0 max-w-[640px]">
      <h1 className="font-display text-[34px] sm:text-[44px] leading-none text-[var(--ink)] mb-8">НАСТРОЙКИ</h1>

      <div className="card p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[16px] font-bold text-[var(--ink)]">Аккаунт</div>
            <div className="text-[13px] text-[var(--ink-faint)] mt-1">
              {email} — задачи синхронизируются между всеми устройствами с этим аккаунтом.
            </div>
            <div className="text-[12px] text-[var(--ink-faint)] mt-1">
              {syncStatus}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-none">
            <button
              className="btn-ghost !py-2 !px-4 text-[13px]"
              disabled={syncChecking}
              onClick={checkSync}
            >
              {syncChecking ? 'Проверяю…' : 'Проверить синхронизацию'}
            </button>
            <button
              className="btn-ghost !py-2 !px-4 text-[13px]"
              onClick={() => signOut()}
            >
              Выйти
            </button>
          </div>
        </div>

        <div className="h-px bg-[var(--line)]" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[16px] font-bold text-[var(--ink)]">Push-уведомления</div>
            <div className="text-[13px] text-[var(--ink-faint)] mt-1">
              Напоминания приходят, даже когда приложение закрыто. Включается на каждом устройстве отдельно.
              {pushHint && <span className="block text-[#c25e78] mt-1">{pushHint}</span>}
            </div>
          </div>
          <Toggle on={pushOn} onClick={() => { if (!busy) togglePush(); }} label="Push-уведомления" />
        </div>

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
              Задачи хранятся на сервере и дублируются в этом браузере.
            </div>
          </div>
          <button className="btn-ghost !py-2 !px-4 text-[13px] !text-[#c25e78] hover:!bg-[rgba(194,94,120,0.08)]" onClick={onClearAll}>
            Удалить всё
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-end gap-4">
        <p className="flex-1 text-[13px] text-[var(--ink-faint)] leading-relaxed">
          Мурендарь — веб-приложение (PWA-ready): его можно «установить» из браузера на Windows, Linux, macOS,
          iOS и Android, а позже обернуть в нативную оболочку (Electron / Tauri / Capacitor) без переписывания интерфейса.
        </p>
        <img
          src="./assets/cats/cat-peach.png"
          alt=""
          aria-hidden
          className="w-[100px] h-auto flex-none select-none pointer-events-none"
          draggable={false}
        />
      </div>
    </section>
  );
}
