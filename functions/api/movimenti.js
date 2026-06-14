import { getUser, json, unauthorized } from '../_lib/auth.js';

// GET /api/movimenti — elenco movimenti (Prima Nota)
export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { results } = await context.env.DB
    .prepare('SELECT * FROM sin_movimenti ORDER BY data DESC, id DESC').all();
  return json({ movimenti: results || [] });
}

// POST /api/movimenti — nuovo movimento
export async function onRequestPost(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  let m;
  try { m = await context.request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }

  const tipo = m.tipo === 'uscita' ? 'uscita' : 'entrata';
  const importo = Math.abs(parseFloat(m.importo) || 0);
  if (!m.data || !importo) return json({ error: 'Data e importo obbligatori' }, { status: 400 });

  const r = await context.env.DB.prepare(
    `INSERT INTO sin_movimenti (data,tipo,categoria,descrizione,importo,metodo,pratica_id,note)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(
    m.data, tipo, m.categoria || null, m.descrizione || null,
    importo, m.metodo || null, m.pratica_id || null, m.note || null
  ).run();

  return json({ ok: true, id: r.meta?.last_row_id });
}
