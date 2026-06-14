import { getUser, json, unauthorized } from '../_lib/auth.js';
import { praticaRowToApp, corrRowToApp, docRowToApp, tlRowToApp } from '../_lib/mappers.js';

export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { DB } = context.env;

  const [prat, corr, doc, tl] = await Promise.all([
    DB.prepare('SELECT * FROM sin_pratiche ORDER BY created_at DESC').all(),
    DB.prepare('SELECT * FROM sin_corrispondenza').all(),
    DB.prepare('SELECT * FROM sin_documenti').all(),
    DB.prepare('SELECT * FROM sin_timeline ORDER BY data ASC').all()
  ]);

  const corrMap = {}, docMap = {}, tlMap = {};
  for (const r of corr.results || []) (corrMap[r.pratica_id] ||= []).push(corrRowToApp(r));
  for (const r of doc.results || []) (docMap[r.pratica_id] ||= []).push(docRowToApp(r));
  for (const r of tl.results || []) (tlMap[r.pratica_id] ||= []).push(tlRowToApp(r));

  const pratiche = (prat.results || []).map(p =>
    praticaRowToApp(p, corrMap[p.id] || [], docMap[p.id] || [], tlMap[p.id] || [])
  );
  return json({ pratiche });
}
