/* Авторизация Мурендаря через Supabase Auth (почта + пароль). */

import { createClient, type Session } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://hvesduszevnjtygnrqhh.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZXNkdXN6ZXZuanR5Z25ycWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MTEyNDIsImV4cCI6MjEwOTQ4NzI0Mn0.XGjm_upQBtGmKKlVerOho_4D8mfZeReBHfjmQnHPUTc';
export const API_URL = `${SUPABASE_URL}/functions/v1/api`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export function getRedirectUrl(): string {
  // На GitHub Pages приложение живёт в /murendar/, локально — в корне
  return window.location.origin + window.location.pathname;
}

export async function signUp(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getRedirectUrl() },
  });
  if (error) return { error: translateAuthError(error.message) };
  return {};
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error.message) };
  return {};
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function sendPasswordReset(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getRedirectUrl(),
  });
  if (error) return { error: translateAuthError(error.message) };
  return {};
}

export async function updatePassword(newPassword: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: translateAuthError(error.message) };
  return {};
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function onAuthChange(cb: (session: Session | null, event: string) => void) {
  return supabase.auth.onAuthStateChange((event, session) => cb(session, event));
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Неверная почта или пароль';
  if (m.includes('user already registered')) return 'Эта почта уже зарегистрирована — попробуй войти';
  if (m.includes('password') && (m.includes('at least') || m.includes('short'))) return 'Пароль слишком короткий (минимум 6 символов)';
  if (m.includes('invalid') && m.includes('email')) return 'Некорректный адрес почты';
  if (m.includes('rate limit')) return 'Слишком много попыток — подожди минуту';
  if (m.includes('email not confirmed')) return 'Почта не подтверждена — проверь письмо';
  return `Ошибка: ${msg}`;
}
