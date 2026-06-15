import { getUser, json, unauthorized } from '../_lib/auth.js';
import { praticaRowToApp, corrRowToApp, docRowToApp, tlRowToApp, prevRowToApp, aggRowToApp, intRowToApp } from '../_lib/mappers.js';

export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { DB } = context.env;

  const [prat, corr, doc, tl, prev, agg, med, int] = await Promise.all([
    DB.prepare('SELECT * FROM sin_pratiche ORDER BY created_at DESC').all(),
    DB.prepare('SELECT * FROM sin_corrispondenza').all(),
    DB.prepare('SELECT * FROM sin_documenti').all(),
    DB.prepare('SELECT * FROM sin_timeline ORDER BY data ASC').all(),
    DB.prepare('SELECT * FROM sin_preventivo_voci ORDER BY ordine ASC').all(),
    DB.prepare('SELECT * FROM sin_aggiornamenti ORDER BY data DESC, id DESC').all(),
    DB.prepare('SELECT * FROM sin_pratica_medici').all(),
    DB.prepare('SELECT * FROM sin_interlocutori ORDER BY id ASC').all()
  ]);

  const corrMap = {}, docMap = {}, tlMap = {}, prevMap = {}, aggMap = {}, medMap = {}, intMap = {};
  for (const r of corr.results || []) (corrMap[r.pratica_id] ||= []).push(corrRowToApp(r));
  for (const r of doc.results || []) (docMap[r.pratica_id] ||= []).push(docRowToApp(r));
  for (const r of tl.results || []) (tlMap[r.pratica_id] ||= []).push(tlRowToApp(r));
  for (const r of prev.results || []) (prevMap[r.pratica_id] ||= []).push(prevRowToApp(r));
  for (const r of agg.results || []) (aggMap[r.pratica_id] ||= []).push(aggRowToApp(r));
  for (const r of med.results || []) (medMap[r.pratica_id] ||= []).push(r.medico_id);
  for (const r of int.results || []) (intMap[r.pratica_id] ||= []).push(intRowToApp(r));

  const pratiche = (prat.results || []).map(p =>
    praticaRowToApp(p, corrMap[p.id] || [], docMap[p.id] || [], tlMap[p.id] || [], prevMap[p.id] || [], aggMap[p.id] || [], medMap[p.id] || [], intMap[p.id] || [])
  );
  return json({ pratiche });
}
