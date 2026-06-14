import { getUser, json, unauthorized } from '../_lib/auth.js';
import { praticaRowToApp, corrRowToApp, docRowToApp, tlRowToApp, prevRowToApp, aggRowToApp } from '../_lib/mappers.js';

export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { DB } = context.env;

  const [prat, corr, doc, tl, prev, agg] = await Promise.all([
    DB.prepare('SELECT * FROM sin_pratiche ORDER BY created_at DESC').all(),
    DB.prepare('SELECT * FROM sin_corrispondenza').all(),
    DB.prepare('SELECT * FROM sin_documenti').all(),
    DB.prepare('SELECT * FROM sin_timeline ORDER BY data ASC').all(),
    DB.prepare('SELECT * FROM sin_preventivo_voci ORDER BY ordine ASC').all(),
    DB.prepare('SELECT * FROM sin_aggiornamenti ORDER BY data DESC, id DESC').all()
  ]);

  const corrMap = {}, docMap = {}, tlMap = {}, prevMap = {}, aggMap = {};
  for (const r of corr.results || []) (corrMap[r.pratica_id] ||= []).push(corrRowToApp(r));
  for (const r of doc.results || []) (docMap[r.pratica_id] ||= []).push(docRowToApp(r));
  for (const r of tl.results || []) (tlMap[r.pratica_id] ||= []).push(tlRowToApp(r));
  for (const r of prev.results || []) (prevMap[r.pratica_id] ||= []).push(prevRowToApp(r));
  for (const r of agg.results || []) (aggMap[r.pratica_id] ||= []).push(aggRowToApp(r));

  const pratiche = (prat.results || []).map(p =>
    praticaRowToApp(p, corrMap[p.id] || [], docMap[p.id] || [], tlMap[p.id] || [], prevMap[p.id] || [], aggMap[p.id] || [])
  );
  return json({ pratiche });
}
