import { getUser, json, unauthorized } from '../_lib/auth.js';
import { appToPraticaRow } from '../_lib/mappers.js';

export async function onRequestPost(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { DB } = context.env;

  let p;
  try { p = await context.request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }
  if (!p.id) return json({ error: 'id pratica mancante' }, { status: 400 });

  const row = appToPraticaRow(p);
  row.updated_at = new Date().toISOString();
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(',');
  const updates = cols.filter(c => c !== 'id').map(c => `${c}=excluded.${c}`).join(',');
  const sql = `INSERT INTO sin_pratiche (${cols.join(',')}) VALUES (${placeholders})
               ON CONFLICT(id) DO UPDATE SET ${updates}`;
  await DB.prepare(sql).bind(...cols.map(c => row[c])).run();

  // Timeline: replace
  await DB.prepare('DELETE FROM sin_timeline WHERE pratica_id = ?').bind(p.id).run();
  if (Array.isArray(p.timeline) && p.timeline.length) {
    await DB.batch(p.timeline.map(t =>
      DB.prepare('INSERT INTO sin_timeline (pratica_id, data, titolo, descrizione) VALUES (?,?,?,?)')
        .bind(p.id, t.data || null, t.titolo || null, t.desc || null)
    ));
  }
  return json({ ok: true, id: p.id });
}
