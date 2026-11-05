/* Общий код веб-пуша для edge-функций Мурендаря (RFC 8291 + VAPID, WebCrypto) */

export const te = new TextEncoder();

export function b64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDec(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

async function hmac(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource));
}

function vapidJwk(pubB64: string, privB64: string) {
  const pub = b64uDec(pubB64); // 65 байт: 0x04 || x || y
  return {
    kty: 'EC', crv: 'P-256',
    x: b64u(pub.slice(1, 33)),
    y: b64u(pub.slice(33, 65)),
    d: privB64,
    ext: true,
  };
}

async function vapidJwt(aud: string, subject: string, jwk: JsonWebKey): Promise<string> {
  const header = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u(te.encode(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));
  const data = te.encode(header + '.' + payload);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data as BufferSource);
  return header + '.' + payload + '.' + b64u(sig);
}

async function encryptPayload(subscription: { keys: { p256dh: string; auth: string } }, payloadStr: string): Promise<Uint8Array> {
  const uaPub = b64uDec(subscription.keys.p256dh);
  const auth = b64uDec(subscription.keys.auth);

  const uaKey = await crypto.subtle.importKey('raw', uaPub as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
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

  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt']);
  const plain = concat(te.encode(payloadStr), new Uint8Array([2])); // данные + разделитель последней записи
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aesKey, plain as BufferSource));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  return concat(salt, rs, new Uint8Array([serverPub.length]), serverPub, ct);
}

export interface PushSubscriptionLike {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function sendPush(
  env: { VAPID_PUBLIC: string; VAPID_PRIVATE: string; VAPID_SUBJECT: string },
  subscription: PushSubscriptionLike,
  payloadObj: unknown,
): Promise<number> {
  const body = await encryptPayload(subscription, JSON.stringify(payloadObj));
  const aud = new URL(subscription.endpoint).origin;
  const jwt = await vapidJwt(aud, env.VAPID_SUBJECT, vapidJwk(env.VAPID_PUBLIC, env.VAPID_PRIVATE) as JsonWebKey);
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'TTL': '86400',
      'Urgency': 'high',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC,
    },
    body: body as unknown as BodyInit,
  });
  return res.status;
}
