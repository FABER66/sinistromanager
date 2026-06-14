import { getUser, json, unauthorized } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  return json({ uid: u.uid, email: u.email, nome: u.nome, ruolo: u.ruolo, ini: u.ini });
}
