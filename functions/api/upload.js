import { getUser, json, unauthorized } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { DOCS } = context.env;

  let form;
  try { form = await context.request.formData(); } catch { return json({ error: 'Form non valido' }, { status: 400 }); }
  const file = form.get('file');
  const praticaId = (form.get('praticaId') || '').toString();
  const docId = (form.get('docId') || '').toString();
  if (!file || typeof file === 'string') return json({ error: 'File mancante' }, { status: 400 });
  if (!praticaId || !docId) return json({ error: 'Parametri mancanti' }, { status: 400 });

  // chiave: praticaId/docId_nomefile (nome sanificato)
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const key = `${praticaId}/${docId}_${safeName}`;
  await DOCS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  });

  return json({ url: `/api/file/${key}`, percorso: key, nome: file.name, tipo: file.type });
}
