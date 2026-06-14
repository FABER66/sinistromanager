import { getUser, json, unauthorized } from '../../_lib/auth.js';

export async function onRequestPatch(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  const { DB } = context.env;
  const id = context.params.id;

  let dati;
  try { dati = await context.request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }

  // Aggiorna fase + perizia + medico
  const set = { updated_at: new Date().toISOString() };
  if (dati.fase) set.fase = dati.fase;
  if (dati.perizia) {
    set.perizia_perito = dati.perizia.perito || null;
    set.perizia_data_nomina = dati.perizia.data_nomina || null;
    set.perizia_data_sopralluogo = dati.perizia.data_sopralluogo || null;
    set.perizia_importo = dati.perizia.importo_stimato || 0;
    set.perizia_note = dati.perizia.note || null;
  }
  if (dati.medico) {
    set.ml_medico = dati.medico.medico || null;
    set.ml_data_nomina = dati.medico.data_nomina || null;
    set.ml_data_visita = dati.medico.data_visita || null;
    set.ml_invalidita = dati.medico.invalidita || null;
    set.ml_lesioni = dati.medico.lesioni || null;
    set.ml_note = dati.medico.note || null;
  }
  const cols = Object.keys(set);
  await DB.prepare(`UPDATE sin_pratiche SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=?`)
    .bind(...cols.map(c => set[c]), id).run();

  // Timeline
  if (dati.timeline) {
    await DB.prepare('DELETE FROM sin_timeline WHERE pratica_id=?').bind(id).run();
    if (dati.timeline.length) await DB.batch(dati.timeline.map(t =>
      DB.prepare('INSERT INTO sin_timeline (pratica_id,data,titolo,descrizione) VALUES (?,?,?,?)')
        .bind(id, t.data || null, t.titolo || null, t.desc || null)));
  }

  // Corrispondenza
  if (dati.corrispondenza) {
    await DB.prepare('DELETE FROM sin_corrispondenza WHERE pratica_id=?').bind(id).run();
    if (dati.corrispondenza.length) await DB.batch(dati.corrispondenza.map(c =>
      DB.prepare('INSERT INTO sin_corrispondenza (pratica_id,data,direzione,oggetto,importo,protocollo,note) VALUES (?,?,?,?,?,?,?)')
        .bind(id, c.data || null, c.dir || null, c.oggetto || null, c.importo || 0, c.proto || null, c.note || null)));
  }

  // Documenti
  if (dati.documenti) {
    await DB.prepare('DELETE FROM sin_documenti WHERE pratica_id=?').bind(id).run();
    if (dati.documenti.length) await DB.batch(dati.documenti.map(d =>
      DB.prepare(`INSERT INTO sin_documenti
        (id,pratica_id,tipo,nome,data,note,has_file,file_url,file_nome,
         med_struttura,med_reparto,med_medico,med_specializ,med_parte,med_esito,med_prognosi,med_num_referto)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(d.id, id, d.tipo || null, d.nome || null, d.data || null, d.note || null,
          d.hasFile ? 1 : 0, d.fileUrl || null, d.file || null,
          d.medico?.struttura || null, d.medico?.reparto || null, d.medico?.nome || null,
          d.medico?.specializ || null, d.medico?.parte || null, d.medico?.esito || null,
          d.medico?.prognosi || null, d.medico?.num_referto || null)));
  }

  return json({ ok: true });
}
