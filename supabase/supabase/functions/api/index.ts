/* API Мурендаря: регистрация кода, чтение/запись задач, управление push-подписками.
   Доступ по коду синхронизации: ключ записи = sha256-hex(code). */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { te, b64u } from '../_shared/push.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Sync-Code,Authorization',
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

const CODE_RE = /^[A-Za-z0-9-]{8,64}$/;

async function userId(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', te.encode(code) as BufferSource);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(request.url);
    // путь вида /api/health или /health (в зависимости от того, как смонтирована функция)
    const path = url.pathname.replace(/^\/api/, '') || '/';

    if (path === '/health') return json({ ok: true });

    const code = request.headers.get('X-Sync-Code') || '';
    if (!CODE_RE.test(code)) return json({ error: 'bad code' }, 401);
    const id = await userId(code);

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (path === '/register' && request.method === 'POST') {
      const { data: existing } = await db.from('murendar_users').select('*').eq('id', id).maybeSingle();
      if (!existing) {
        const rec = { id, tasks: [], subs: [], tz: null, updated_at: 0, fired: {} };
        await db.from('murendar_users').insert(rec);
        return json({ created: true, state: { tasks: [], updatedAt: 0 } });
      }
      return json({ created: false, state: { tasks: existing.tasks, updatedAt: existing.updated_at } });
    }

    const { data: rec } = await db.from('murendar_users').select('*').eq('id', id).maybeSingle();
    if (!rec) return json({ error: 'unknown code' }, 404);

    if (path === '/state' && request.method === 'GET') {
      return json({ tasks: rec.tasks, updatedAt: rec.updated_at, tz: rec.tz });
    }

    if (path === '/state' && request.method === 'PUT') {
      const body = await request.json();
      if (!Array.isArray(body.tasks)) return json({ error: 'tasks must be array' }, 400);
      const updatedAt = Date.now();
      const patch: Record<string, unknown> = { tasks: body.tasks, updated_at: updatedAt };
      if (typeof body.tz === 'string') patch.tz = body.tz;
      await db.from('murendar_users').update(patch).eq('id', id);
      return json({ ok: true, updatedAt });
    }

    if (path === '/subscribe' && request.method === 'POST') {
      const body = await request.json();
      if (!body.subscription || !body.subscription.endpoint) return json({ error: 'bad subscription' }, 400);
      const subs = (rec.subs || []).filter((s: { endpoint: string }) => s.endpoint !== body.subscription.endpoint);
      subs.push(body.subscription);
      const patch: Record<string, unknown> = { subs };
      if (typeof body.tz === 'string') patch.tz = body.tz;
      await db.from('murendar_users').update(patch).eq('id', id);
      return json({ ok: true, subs: subs.length });
    }

    if (path === '/unsubscribe' && request.method === 'POST') {
      const body = await request.json();
      const subs = (rec.subs || []).filter((s: { endpoint: string }) => s.endpoint !== (body.endpoint || ''));
      await db.from('murendar_users').update({ subs }).eq('id', id);
      return json({ ok: true, subs: subs.length });
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: 'internal', detail: String(e) }, 500);
  }
});
