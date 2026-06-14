// Conversioni tra righe D1 e formato app (lo stesso che il frontend già usa).

export function corrRowToApp(r) {
  return { data: r.data, dir: r.direzione, oggetto: r.oggetto, importo: r.importo || 0, proto: r.protocollo, note: r.note };
}

export function docRowToApp(r) {
  return {
    id: r.id, tipo: r.tipo, nome: r.nome, data: r.data, note: r.note,
    hasFile: !!r.has_file, fileUrl: r.file_url, file: r.file_nome,
    medico: r.med_struttura ? {
      struttura: r.med_struttura, reparto: r.med_reparto, nome: r.med_medico,
      specializ: r.med_specializ, parte: r.med_parte, esito: r.med_esito,
      prognosi: r.med_prognosi, num_referto: r.med_num_referto
    } : null
  };
}

export function tlRowToApp(r) {
  return { data: r.data, titolo: r.titolo, desc: r.descrizione };
}

export function praticaRowToApp(p, corr, doc, tl) {
  return {
    id: p.id, data: p.data, ora: p.ora, luogo: p.luogo,
    tipo: p.tipo, forze: p.forze, fase: p.fase, note: p.note,
    assistito: {
      nome: p.ass_nome, cognome: p.ass_cognome, cf: p.ass_cf,
      tel: p.ass_tel, email: p.ass_email, ruolo: p.ass_ruolo,
      targa: p.ass_targa, assicurazione: p.ass_assicurazione, polizza: p.ass_polizza
    },
    controparte: {
      nome: p.cp_nome || '', cognome: p.cp_cognome || '', cf: p.cp_cf || '',
      targa: p.cp_targa || '', assicurazione: p.cp_assicurazione || '', sinistro: p.cp_sinistro || ''
    },
    danno: { fisico: !!p.danno_fisico, materiale: !!p.danno_materiale, morale: !!p.danno_morale },
    collab: p.collab_id || '',
    perizia: {
      perito: p.perizia_perito || '', data_nomina: p.perizia_data_nomina || '',
      data_sopralluogo: p.perizia_data_sopralluogo || '',
      importo_stimato: p.perizia_importo || 0, note: p.perizia_note || ''
    },
    medico: {
      medico: p.ml_medico || '', data_nomina: p.ml_data_nomina || '',
      data_visita: p.ml_data_visita || '', invalidita: p.ml_invalidita || '',
      lesioni: p.ml_lesioni || '', note: p.ml_note || ''
    },
    corrispondenza: corr || [],
    documenti: doc || [],
    timeline: tl || []
  };
}

// Colonne sin_pratiche per upsert dal formato app.
export function appToPraticaRow(p) {
  const a = p.assistito || {}, c = p.controparte || {}, d = p.danno || {};
  return {
    id: p.id, data: p.data || null, ora: p.ora || null, luogo: p.luogo || null,
    tipo: p.tipo || null, forze: p.forze || null, fase: p.fase || 'apertura', note: p.note || null,
    ass_nome: a.nome || null, ass_cognome: a.cognome || null, ass_cf: a.cf || null,
    ass_tel: a.tel || null, ass_email: a.email || null, ass_ruolo: a.ruolo || null,
    ass_targa: a.targa || null, ass_assicurazione: a.assicurazione || null, ass_polizza: a.polizza || null,
    cp_nome: c.nome || null, cp_cognome: c.cognome || null, cp_cf: c.cf || null,
    cp_targa: c.targa || null, cp_assicurazione: c.assicurazione || null, cp_sinistro: c.sinistro || null,
    danno_fisico: d.fisico ? 1 : 0, danno_materiale: d.materiale ? 1 : 0, danno_morale: d.morale ? 1 : 0,
    collab_id: p.collab || null
  };
}
