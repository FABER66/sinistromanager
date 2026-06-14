import { getUser, json, unauthorized } from '../_lib/auth.js';

// GET /api/impostazioni — tutte le impostazioni studio come oggetto
export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { results } = await context.env.DB.prepare('SELECT chiave, valore FROM sin_impostazioni').all();
  const out = {};
  for (const r of results || []) out[r.chiave] = r.valore;
  return json({ impostazioni: out });
}

// POST /api/impostazioni — upsert chiavi fornite (admin)
export async function onRequestPost(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  if (u.ruolo !== 'admin') return json({ error: 'Permesso negato' }, { status: 403 });
  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }
  const keys = Object.keys(body || {});
  if (keys.length) {
    await context.env.DB.batch(keys.map(k =>
      context.env.DB.prepare('INSERT INTO sin_impostazioni (chiave,valore) VALUES (?,?) ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore')
        .bind(k, body[k] == null ? null : String(body[k]))));
  }
  return json({ ok: true });
}
