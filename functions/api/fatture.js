import { getUser, json, unauthorized } from '../_lib/auth.js';

// GET /api/fatture — registro fatture emesse
export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { results } = await context.env.DB.prepare('SELECT * FROM sin_fatture ORDER BY id DESC').all();
  return json({ fatture: results || [] });
}

// POST /api/fatture — emette una fattura con numerazione automatica (admin)
export async function onRequestPost(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  if (u.ruolo !== 'admin') return json({ error: 'Permesso negato' }, { status: 403 });
  const { DB } = context.env;

  let f;
  try { f = await context.request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }
  const data = f.data || new Date().toISOString().slice(0, 10);
  const anno = data.slice(0, 4);

  // progressivo dell'anno
  const cnt = await DB.prepare("SELECT COUNT(*) as n FROM sin_fatture WHERE numero LIKE ?").bind(anno + '/%').first();
  const numero = `${anno}/${(cnt?.n || 0) + 1}`;

  const num = v => Math.round((Number(v) || 0) * 100) / 100;
  const r = await DB.prepare(
    `INSERT INTO sin_fatture (numero,data,pratica_id,cliente,imponibile,cassa,iva,ritenuta,totale,netto,voci_json,dati_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    numero, data, f.pratica_id || null, f.cliente || null,
    num(f.imponibile), num(f.cassa), num(f.iva), num(f.ritenuta), num(f.totale), num(f.netto),
    JSON.stringify(f.voci || []), JSON.stringify(f.dati || {})
  ).run();

  return json({ ok: true, id: r.meta?.last_row_id, numero });
}
