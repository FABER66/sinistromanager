import { getUser, json, unauthorized } from '../_lib/auth.js';

// GET /api/pagamenti — pagamenti provvigioni
export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { results } = await context.env.DB.prepare('SELECT * FROM sin_provv_pagamenti ORDER BY data DESC, id DESC').all();
  return json({ pagamenti: results || [] });
}

// POST /api/pagamenti — registra un pagamento provvigione (admin)
export async function onRequestPost(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  if (u.ruolo !== 'admin') return json({ error: 'Permesso negato' }, { status: 403 });
  let p;
  try { p = await context.request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }
  if (!p.beneficiario_id || !(Number(p.importo) > 0)) return json({ error: 'Beneficiario e importo obbligatori' }, { status: 400 });
  const res = await context.env.DB.prepare('INSERT INTO sin_provv_pagamenti (beneficiario_id,data,importo,note) VALUES (?,?,?,?)')
    .bind(p.beneficiario_id, p.data || new Date().toISOString().slice(0,10), Number(p.importo), p.note || null).run();
  return json({ ok: true, id: res.meta?.last_row_id });
}
