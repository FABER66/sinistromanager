import { getUser, json, unauthorized } from '../_lib/auth.js';

// GET /api/rubrica — tutte le anagrafiche (segnalatori, collaboratori, avvocati, medici)
export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { results } = await context.env.DB.prepare('SELECT * FROM sin_rubrica ORDER BY tipo, nome').all();
  return json({ rubrica: results || [] });
}

// POST /api/rubrica — crea o aggiorna (se presente id)
export async function onRequestPost(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  if (u.ruolo !== 'admin') return json({ error: 'Permesso negato' }, { status: 403 });
  let r;
  try { r = await context.request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }
  if (!r.tipo || !r.nome) return json({ error: 'Tipo e nome obbligatori' }, { status: 400 });
  const { DB } = context.env;
  const args = [r.tipo, r.nome, r.specializzazione || null, r.struttura || null, r.telefono || null,
    r.email || null, r.note || null, r.provv_tipo || null, r.provv_valore != null ? Number(r.provv_valore) : null];

  if (r.id) {
    await DB.prepare(`UPDATE sin_rubrica SET tipo=?,nome=?,specializzazione=?,struttura=?,telefono=?,email=?,note=?,provv_tipo=?,provv_valore=? WHERE id=?`)
      .bind(...args, r.id).run();
    return json({ ok: true, id: r.id });
  }
  const res = await DB.prepare(`INSERT INTO sin_rubrica (tipo,nome,specializzazione,struttura,telefono,email,note,provv_tipo,provv_valore) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(...args).run();
  return json({ ok: true, id: res.meta?.last_row_id });
}
