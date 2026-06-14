// Auth condivisa per le Pages Functions (Web Crypto, runtime Workers).
// - Password: PBKDF2-SHA256 salt per-utente.
// - Sessione: token firmato HMAC-SHA256 in cookie httpOnly.

const PBKDF2_ITER = 100000;
const SESSION_DAYS = 7;
const COOKIE = 'sm_session';
const enc = new TextEncoder();

// ---------- base64 / base64url ----------
function bufToB64(buf) {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const b64url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => s.replace(/-/g, '+').replace(/_/g, '/');

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- password ----------
export async function hashPassword(password, salt) {
  const saltBuf = salt ? b64ToBuf(salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256
  );
  return `pbkdf2$${PBKDF2_ITER}$${bufToB64(saltBuf)}$${bufToB64(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, iterStr, saltStr, hashStr] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64ToBuf(saltStr), iterations: parseInt(iterStr, 10), hash: 'SHA-256' }, key, 256
  );
  return timingSafeEqual(bufToB64(bits), hashStr);
}

// ---------- sessione HMAC ----------
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return b64url(bufToB64(sig));
}

export async function createSession(env, user) {
  const payload = {
    uid: user.id, email: user.email, nome: user.nome,
    ruolo: user.ruolo, ini: user.ini,
    exp: Date.now() + SESSION_DAYS * 864e5
  };
  const body = b64url(bufToB64(enc.encode(JSON.stringify(payload))));
  const sig = await hmac(env.SESSION_SECRET, body);
  return `${body}.${sig}`;
}

export async function verifySession(env, token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = await hmac(env.SESSION_SECRET, body);
  if (!timingSafeEqual(sig, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64ToBuf(unb64url(body))));
  } catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

// ---------- cookie ----------
export function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 86400;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
export function readCookie(request) {
  const h = request.headers.get('Cookie') || '';
  const m = h.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

// ---------- helper richiesta ----------
export async function getUser(context) {
  return verifySession(context.env, readCookie(context.request));
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
}

export const unauthorized = () => json({ error: 'Non autorizzato' }, { status: 401 });
