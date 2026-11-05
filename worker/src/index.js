/* Мурендарь push-сервер: хранение задач, синхронизация и web-push по расписанию.
   Данные привязаны к коду синхронизации: ключ в KV = sha256(code). Кто знает код — тот владелец. */

const te = new TextEncoder();

/* ---------- base64url ---------- */
function b64u(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDec(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function concat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

/* ---------- ключ пользователя ---------- */
async function userKey(code) {
  const digest = await crypto.subtle.digest('SHA-256', te.encode(code));
  return 'u:' + b64u(digest);
}

/* ---------- Web Push (RFC 8291 + VAPID) ---------- */
async function hmac(keyBytes, data) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

function vapidJwk(pubB64, privB64) {
  const pub = b64uDec(pubB64); // 65 байт: 0x04 || x || y
  return {
    kty: 'EC', crv: 'P-256',
    x: b64u(pub.slice(1, 33)),
    y: b64u(pub.slice(33, 65)),
    d: privB64,
    ext: true,
  };
}

async function vapidJwt(aud, subject, jwk) {
  const header = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u(te.encode(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));
  const data = te.encode(header + '.' + payload);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data);
  return header + '.' + payload + '.' + b64u(sig);
}

async function encryptPayload(subscription, payloadStr) {
  const uaPub = b64uDec(subscription.keys.p256dh);
  const auth = b64uDec(subscription.keys.auth);

  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const serverPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPub = new Uint8Array(await crypto.subtle.exportKey('raw', serverPair.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, serverPair.privateKey, 256));

  // RFC 8291 §3.3
  const keyInfo = concat(te.encode('WebPush: info'), new Uint8Array([0]), uaPub, serverPub);
  const prkKey = await hmac(auth, shared);
  const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));

  // RFC 8188 (aes128gcm)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(te.encode('Content-Encoding: aes128gcm'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(te.encode('Content-Encoding: nonce'), new Uint8Array([1])))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const plain = concat(te.encode(payloadStr), new Uint8Array([2])); // данные + разделитель последней записи
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plain));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  return concat(salt, rs, new Uint8Array([serverPub.length]), serverPub, ct);
}

async function sendPush(env, subscription, payloadObj) {
  const body = await encryptPayload(subscription, JSON.stringify(payloadObj));
  const aud = new URL(subscription.endpoint).origin;
  const jwt = await vapidJwt(aud, env.VAPID_SUBJECT, vapidJwk(env.VAPID_PUBLIC, env.VAPID_PRIVATE));
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'TTL': '86400',
      'Urgency': 'high',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC,
    },
    body,
  });
  return res.status;
}

/* ---------- логика напоминаний (зеркало клиентской) ---------- */
function tzParts(tz, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24, min: +p.minute };
}
function dateKeyLocal(tz, now) {
  const p = tzParts(tz, now);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}
function zonedToUtc(tz, y, m, d, h, mi) {
  let utc = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const p = tzParts(tz, new Date(utc));
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, 0);
    const diff = asUtc - utc;
    if (diff === 0) break;
    utc -= diff;
  }
  return utc;
}
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}
function utcWeekday(key) {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function occursOn(task, key) {
  if (key < task.date) return false;
  if (task.repeat === 'none') return key === task.date;
  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekly') return utcWeekday(task.date) === utcWeekday(key);
  if (task.repeat === 'monthly') return parseKey(task.date).d === parseKey(key).d;
  return false;
}
function occurrenceUtc(task, key, tz) {
  const { y, m, d } = parseKey(key);
  const [h, mi] = task.time.split(':').map(Number);
  return zonedToUtc(tz, y, m, d, h, mi);
}
function remindLabel(remindMin) {
  if (remindMin === 0) return 'Прямо сейчас';
  if (remindMin < 60) return `Через ${remindMin} минут`;
  return 'Через 1 час';
}

/* ---------- HTTP ---------- */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Sync-Code',
};
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}
const CODE_RE = /^[A-Za-z0-9-]{8,64}$/;

async function handleApi(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/health') return json({ ok: true });

  const code = request.headers.get('X-Sync-Code') || '';
  if (!CODE_RE.test(code)) return json({ error: 'bad code' }, 401);
  const key = await userKey(code);

  if (url.pathname === '/api/register' && request.method === 'POST') {
    const existing = await env.MURENDAR_KV.get(key);
    if (!existing) {
      const rec = { tasks: [], subs: [], tz: null, updatedAt: 0, fired: {} };
      await env.MURENDAR_KV.put(key, JSON.stringify(rec));
      return json({ created: true, state: rec });
    }
    return json({ created: false, state: JSON.parse(existing) });
  }

  const raw = await env.MURENDAR_KV.get(key);
  if (!raw) return json({ error: 'unknown code' }, 404);
  const rec = JSON.parse(raw);

  if (url.pathname === '/api/state' && request.method === 'GET') {
    return json({ tasks: rec.tasks, updatedAt: rec.updatedAt, tz: rec.tz });
  }

  if (url.pathname === '/api/state' && request.method === 'PUT') {
    const body = await request.json();
    if (!Array.isArray(body.tasks)) return json({ error: 'tasks must be array' }, 400);
    rec.tasks = body.tasks;
    if (typeof body.tz === 'string') rec.tz = body.tz;
    rec.updatedAt = Date.now();
    await env.MURENDAR_KV.put(key, JSON.stringify(rec));
    return json({ ok: true, updatedAt: rec.updatedAt });
  }

  if (url.pathname === '/api/subscribe' && request.method === 'POST') {
    const body = await request.json();
    if (!body.subscription || !body.subscription.endpoint) return json({ error: 'bad subscription' }, 400);
    if (typeof body.tz === 'string') rec.tz = body.tz;
    rec.subs = rec.subs.filter((s) => s.endpoint !== body.subscription.endpoint);
    rec.subs.push(body.subscription);
    await env.MURENDAR_KV.put(key, JSON.stringify(rec));
    return json({ ok: true, subs: rec.subs.length });
  }

  if (url.pathname === '/api/unsubscribe' && request.method === 'POST') {
    const body = await request.json();
    rec.subs = rec.subs.filter((s) => s.endpoint !== (body.endpoint || ''));
    await env.MURENDAR_KV.put(key, JSON.stringify(rec));
    return json({ ok: true, subs: rec.subs.length });
  }

  return json({ error: 'not found' }, 404);
}

/* ---------- cron: каждую минуту ---------- */
async function runScheduler(env) {
  const list = await env.MURENDAR_KV.list({ prefix: 'u:' });
  const now = Date.now();
  for (const k of list.keys) {
    try {
      const raw = await env.MURENDAR_KV.get(k.name);
      if (!raw) continue;
      const rec = JSON.parse(raw);
      if (!rec.subs || rec.subs.length === 0) continue;
      const tz = rec.tz || 'Europe/Moscow';
      const today = dateKeyLocal(tz, new Date(now));
      let changed = false;
      const fired = rec.fired || {};
      for (const task of rec.tasks || []) {
        if (!occursOn(task, today)) continue;
        const ts = occurrenceUtc(task, today, tz);
        const fireAt = ts - (task.remindMin || 0) * 60000;
        if (now >= fireAt && now < ts + 2 * 3600000) {
          const fKey = `${task.id}|${today}|${task.time}`;
          if (fired[fKey]) continue;
          fired[fKey] = now;
          changed = true;
          const payload = {
            title: 'Мур! Напоминание 🐾',
            body: `${remindLabel(task.remindMin || 0)} — ${task.title}`,
            tag: fKey,
            url: './',
          };
          const dead = [];
          for (const sub of rec.subs) {
            try {
              const status = await sendPush(env, sub, payload);
              if (status === 404 || status === 410) dead.push(sub.endpoint);
            } catch (e) { /* временная ошибка — попробуем в следующую минуту */ }
          }
          if (dead.length) rec.subs = rec.subs.filter((s) => !dead.includes(s.endpoint));
        }
      }
      // чистим старые отметки (старше 48 часов)
      for (const [fk, t] of Object.entries(fired)) {
        if (now - t > 48 * 3600000) { delete fired[fk]; changed = true; }
      }
      rec.fired = fired;
      if (changed) await env.MURENDAR_KV.put(k.name, JSON.stringify(rec));
    } catch (e) { /* не роняем весь проход из-за одной записи */ }
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      return await handleApi(request, env);
    } catch (e) {
      return json({ error: 'internal' }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduler(env));
  },
};
