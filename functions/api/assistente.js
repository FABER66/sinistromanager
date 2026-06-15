import { getUser, json, unauthorized } from '../_lib/auth.js';

const GEMINI_MODEL = 'gemini-2.5-flash';

// POST /api/assistente — "Doc": Q&A in linguaggio naturale sulle pratiche
export async function onRequestPost(context) {
  const { request, env } = context;
  const u = await getUser(context);
  if (!u) return unauthorized();

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }
  const domanda = (body.domanda || '').toString().trim();
  if (!domanda) return json({ error: 'Domanda mancante' }, { status: 400 });
  if (domanda.length > 1000) return json({ error: 'Domanda troppo lunga' }, { status: 400 });

  const { DB } = context.env;
  const [prat, rub, agg] = await Promise.all([
    DB.prepare(`SELECT id,data,luogo,tipo,fase,ass_nome,ass_cognome,ass_targa,ass_cf,legale,segnalatore_id,avvocato_id FROM sin_pratiche ORDER BY created_at DESC`).all(),
    DB.prepare(`SELECT id,tipo,nome,specializzazione FROM sin_rubrica`).all(),
    DB.prepare(`SELECT pratica_id, data, testo FROM sin_aggiornamenti ORDER BY data DESC, id DESC`).all()
  ]);

  const rubMap = {};
  for (const r of rub.results || []) rubMap[r.id] = r.nome;
  const ultimoAgg = {};
  for (const a of agg.results || []) if (!ultimoAgg[a.pratica_id]) ultimoAgg[a.pratica_id] = `${a.data}: ${a.testo}`;

  const oggi = new Date().toISOString().slice(0, 10);
  const giorniTra = (d1, d2) => Math.round((new Date(d2) - new Date(d1)) / 86400000);

  const pratiche = (prat.results || []).map(p => {
    const out = {
      id: p.id, data: p.data, luogo: p.luogo, tipo: p.tipo, fase: p.fase,
      assistito: `${p.ass_nome || ''} ${p.ass_cognome || ''}`.trim(),
      targa: p.ass_targa || '', cf: p.ass_cf || '',
      avvocato: p.avvocato_id ? rubMap[p.avvocato_id] : (p.legale || ''),
      segnalatore: p.segnalatore_id ? rubMap[p.segnalatore_id] : ''
    };
    if (ultimoAgg[p.id]) out.ultimo_aggiornamento = ultimoAgg[p.id];
    if (p.data && p.fase !== 'chiusa') {
      const presc = new Date(p.data); presc.setFullYear(presc.getFullYear() + 2);
      out.giorni_a_prescrizione = giorniTra(oggi, presc.toISOString().slice(0, 10));
    }
    return out;
  });

  const prompt = `Sei "Giulia", la segretaria virtuale dello Studio Sagripanti (consulenza infortunistica stradale): cortese, precisa e professionale, con un tono cordiale ma sobrio.
Rispondi alla domanda dell'operatore basandoti SOLO sui dati qui sotto. In italiano, concisa e concreta.
Regole:
- Quando citi una pratica usa SEMPRE il suo codice esatto (es. SIN-2026-001).
- Le fasi sono: apertura, cid, perizia, medico, offerta, chiusa.
- "giorni_a_prescrizione" negativo = prescrizione già scaduta; piccolo e positivo = in scadenza.
- Se la domanda chiede un elenco, elenca i codici pratica con una riga di sintesi ciascuno.
- Se non trovi nulla di pertinente, dillo chiaramente. Non inventare dati.

OGGI: ${oggi}
DATI (${pratiche.length} pratiche): ${JSON.stringify(pratiche)}

DOMANDA: ${domanda}`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.2 }
      })
    }
  );
  if (!r.ok) return json({ error: await r.text() }, { status: r.status });
  const data = await r.json();
  const risposta = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'Non ho trovato una risposta.';
  return json({ risposta });
}
