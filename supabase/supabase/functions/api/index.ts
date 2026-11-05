/* API Мурендаря: задачи и push-подписки. Доступ только по JWT пользователя Supabase Auth.
   Ключ записи в таблице = auth user id. */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,apikey',
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '') || '/';

    if (path === '/health') return json({ ok: true });

    const jwt = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'no token' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await db.auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'invalid token' }, 401);
    const id = user.id;

    if (path === '/register' && request.method === 'POST') {
      const { data: existing } = await db.from('murendar_users').select('*').eq('id', id).maybeSingle();
      if (!existing) {
        await db.from('murendar_users').insert({ id, tasks: [], subs: [], tz: null, updated_at: 0, fired: {} });
        return json({ created: true, state: { tasks: [], updatedAt: 0 } });
      }
      return json({ created: false, state: { tasks: existing.tasks, updatedAt: existing.updated_at } });
    }

    const { data: rec } = await db.from('murendar_users').select('*').eq('id', id).maybeSingle();
    if (!rec) return json({ error: 'not registered' }, 404);

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
