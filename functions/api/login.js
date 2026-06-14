import { verifyPassword, createSession, sessionCookie, json } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }
  const email = (body.email || '').trim().toLowerCase();
  const pwd = body.password || '';
  if (!email || !pwd) return json({ error: 'Credenziali mancanti' }, { status: 400 });

  const user = await env.DB.prepare('SELECT * FROM sin_utenti WHERE email = ?').bind(email).first();
  // Verifica sempre (anche se utente assente) per non rivelare quali email esistono.
  const ok = user ? await verifyPassword(pwd, user.password_hash) : false;
  if (!ok) return json({ error: 'Email o password non corrette' }, { status: 401 });

  const token = await createSession(env, user);
  return json(
    { uid: user.id, email: user.email, nome: user.nome, ruolo: user.ruolo, ini: user.ini },
    { headers: { 'Set-Cookie': sessionCookie(token) } }
  );
}
