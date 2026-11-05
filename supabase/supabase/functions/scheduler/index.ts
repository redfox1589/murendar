/* Планировщик Мурендаря: вызывается pg_cron каждую минуту, рассылает push-напоминания. */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendPush, type PushSubscriptionLike } from '../_shared/push.ts';
import { dueReminders, type TaskLike } from '../_shared/reminders.ts';

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get('CRON_SECRET') || '';
  if (!secret || request.headers.get('X-Cron-Secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const env = {
    VAPID_PUBLIC: Deno.env.get('VAPID_PUBLIC')!,
    VAPID_PRIVATE: Deno.env.get('VAPID_PRIVATE')!,
    VAPID_SUBJECT: Deno.env.get('VAPID_SUBJECT') || 'mailto:murendar@redfox1589.github.io',
  };

  const { data: rows, error } = await db.from('murendar_users').select('*');
  if (error) return new Response('db error', { status: 500 });

  const now = Date.now();
  let sent = 0;

  for (const rec of rows || []) {
    const subs = (rec.subs || []) as PushSubscriptionLike[];
    if (subs.length === 0) continue;
    const tz = rec.tz || 'Europe/Moscow';
    const fired: Record<string, number> = rec.fired || {};
    const due = dueReminders((rec.tasks || []) as TaskLike[], fired, tz, now);
    let changed = false;

    for (const r of due) {
      fired[r.fireKey] = now;
      changed = true;
      const dead: string[] = [];
      for (const sub of subs) {
        try {
          const status = await sendPush(env, sub, r.payload);
          sent++;
          if (status === 404 || status === 410) dead.push(sub.endpoint);
        } catch { /* временная ошибка — повторим в следующую минуту */ }
      }
      if (dead.length) {
        rec.subs = subs.filter((s) => !dead.includes(s.endpoint));
        changed = true;
      }
    }

    // чистим старые отметки (старше 48 часов)
    for (const [fk, t] of Object.entries(fired)) {
      if (now - t > 48 * 3600000) { delete fired[fk]; changed = true; }
    }

    if (changed) {
      await db.from('murendar_users').update({ fired, subs: rec.subs }).eq('id', rec.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
