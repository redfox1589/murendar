import { useState } from 'react';
import { sendPasswordReset, signIn, signUp, updatePassword } from '../lib/auth';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

interface Props {
  recoveryMode: boolean;
  onRecoveryDone: () => void;
}

export function AuthView({ recoveryMode, onRecoveryDone }: Props) {
  const [mode, setMode] = useState<Mode>(recoveryMode ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async () => {
    setError('');
    setInfo('');

    if (mode === 'forgot') {
      if (!email) return setError('Введи почту');
      setBusy(true);
      const res = await sendPasswordReset(email);
      setBusy(false);
      if (res.error) return setError(res.error);
      setInfo('Письмо со ссылкой для сброса отправлено — проверь почту (и спам).');
      return;
    }

    if (mode === 'reset') {
      if (password.length < 6) return setError('Пароль слишком короткий (минимум 6 символов)');
      if (password !== password2) return setError('Пароли не совпадают');
      setBusy(true);
      const res = await updatePassword(password);
      setBusy(false);
      if (res.error) return setError(res.error);
      setInfo('Пароль обновлён! Добро пожаловать обратно 🐾');
      onRecoveryDone();
      return;
    }

    if (!email || !password) return setError('Введи почту и пароль');
    if (mode === 'register' && password.length < 6) return setError('Пароль слишком короткий (минимум 6 символов)');

    setBusy(true);
    const res = mode === 'register' ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (res.error) return setError(res.error);
    // успех — onAuthStateChange в App переключит экран сам
  };

  const title =
    mode === 'login' ? 'ВХОД' :
    mode === 'register' ? 'РЕГИСТРАЦИЯ' :
    mode === 'forgot' ? 'СБРОС ПАРОЛЯ' : 'НОВЫЙ ПАРОЛЬ';

  return (
    <div className="min-h-100dvh flex items-center justify-center px-4">
      <section className="w-full max-w-[420px]">
        <div className="text-center mb-6">
          <img src="./assets/cats/cat-sit.png" alt="Котик" className="w-[110px] mx-auto mb-3 select-none" draggable={false} />
          <h1 className="font-display text-[34px] leading-none text-[var(--ink)]">МУРЕНДАРЬ</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-2">Календарь-напоминалка с котиками</p>
        </div>

        <div className="card p-6 flex flex-col gap-4">
          <h2 className="text-[18px] font-bold text-[var(--ink)]">{title}</h2>

          {mode !== 'reset' && (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] text-[var(--ink-faint)]">Почта</span>
              <input
                type="email"
                className="field-input"
                placeholder="fox@example.com"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value.trim())}
              />
            </label>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] text-[var(--ink-faint)]">{mode === 'reset' ? 'Новый пароль' : 'Пароль'}</span>
              <input
                type="password"
                className="field-input"
                placeholder="••••••••"
                value={password}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </label>
          )}

          {mode === 'reset' && (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] text-[var(--ink-faint)]">Ещё раз новый пароль</span>
              <input
                type="password"
                className="field-input"
                placeholder="••••••••"
                value={password2}
                autoComplete="new-password"
                onChange={(e) => setPassword2(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </label>
          )}

          {error && <div className="text-[13px] text-[#c25e78] leading-relaxed">{error}</div>}
          {info && <div className="text-[13px] text-[#4a7c59] leading-relaxed">{info}</div>}

          <button
            className="btn-ghost !py-2.5 !px-4 text-[14px] font-bold !bg-[var(--peri)] !text-white hover:!bg-[var(--peri)]/90"
            disabled={busy}
            onClick={submit}
          >
            {busy ? 'Подожди…' :
              mode === 'login' ? 'Войти' :
              mode === 'register' ? 'Создать аккаунт' :
              mode === 'forgot' ? 'Отправить письмо' : 'Сохранить пароль'}
          </button>

          <div className="flex flex-col gap-2 text-[13px]">
            {mode === 'login' && (
              <>
                <button className="text-[var(--peri)] text-left hover:underline" onClick={() => { setMode('register'); setError(''); setInfo(''); }}>
                  Нет аккаунта? Зарегистрироваться
                </button>
                <button className="text-[var(--ink-faint)] text-left hover:underline" onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}>
                  Забыла пароль?
                </button>
              </>
            )}
            {mode === 'register' && (
              <button className="text-[var(--peri)] text-left hover:underline" onClick={() => { setMode('login'); setError(''); setInfo(''); }}>
                Уже есть аккаунт? Войти
              </button>
            )}
            {(mode === 'forgot' || mode === 'reset') && !recoveryMode && (
              <button className="text-[var(--peri)] text-left hover:underline" onClick={() => { setMode('login'); setError(''); setInfo(''); }}>
                ← Назад ко входу
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-[var(--ink-faint)]">
          Без аккаунта котик никого не пустит 🐾
        </p>
      </section>
    </div>
  );
}
