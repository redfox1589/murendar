import { playChime } from '../lib/sound';
import type { Settings } from '../lib/store';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClearAll: () => void;
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

export function SettingsView({ settings, onChange, onClearAll }: Props) {
  const permission = 'Notification' in window ? Notification.permission : 'unavailable';

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

  return (
    <section className="flex-1 min-w-0 max-w-[640px]">
      <h1 className="font-display text-[34px] sm:text-[44px] leading-none text-[var(--ink)] mb-8">НАСТРОЙКИ</h1>

      <div className="card p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[16px] font-bold text-[var(--ink)]">Уведомления в браузере</div>
            <div className="text-[13px] text-[var(--ink-faint)] mt-1">
              Системные всплывающие окна при напоминаниях.
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
              Задачи хранятся локально в этом браузере (localStorage).
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
