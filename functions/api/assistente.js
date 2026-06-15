import { getUser, json, unauthorized } from '../_lib/auth.js';

const GEMINI_MODEL = 'gemini-1.5-flash';

// POST /api/assistente — "Giulia": Q&A in linguaggio naturale sulle pratiche
export async function onRequestPost(context) {
  const { request, env } = context;
  const u = await getUser(context);
  if (!u) return unauthorized();

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }
  const domanda = (body.domanda || '').toString().trim();
  if (!domanda) return json({ error: 'Domanda mancante' }, { status: 400 });
  if (domanda.length > 2000) return json({ error: 'Domanda troppo lunga' }, { status: 400 });

  const { DB } = context.env;
  const [prat, rub, agg, intr] = await Promise.all([
    DB.prepare(`SELECT id,data,luogo,tipo,fase,ass_nome,ass_cognome,ass_targa,ass_cf,legale,segnalatore_id,avvocato_id,cp_assicurazione FROM sin_pratiche ORDER BY created_at DESC`).all(),
    DB.prepare(`SELECT id,tipo,nome,specializzazione,telefono,email FROM sin_rubrica`).all(),
    DB.prepare(`SELECT pratica_id, data, testo FROM sin_aggiornamenti ORDER BY data DESC, id DESC`).all(),
    DB.prepare(`SELECT pratica_id, compagnia, referente, contatto, ruolo, stato FROM sin_interlocutori`).all()
  ]);

  const rubMap = {};
  const rubInfo = (rub.results || []).map(r => {
    rubMap[r.id] = r.nome;
    return `${r.tipo.toUpperCase()}: ${r.nome} ${r.specializzazione ? '('+r.specializzazione+')' : ''} ${r.email || ''}`;
  });

  const ultimoAgg = {};
  for (const a of agg.results || []) if (!ultimoAgg[a.pratica_id]) ultimoAgg[a.pratica_id] = `${a.data}: ${a.testo}`;
  const intMap = {};
  for (const it of intr.results || []) (intMap[it.pratica_id] ||= []).push(
    `${it.compagnia||''}${it.referente?' ('+it.referente+')':''}${it.contatto?' '+it.contatto:''}${it.ruolo?' ['+it.ruolo+']':''} → ${it.stato||'da_scrivere'}`);

  const oggi = new Date().toISOString().slice(0, 10);
  const giorniTra = (d1, d2) => Math.round((new Date(d2) - new Date(d1)) / 86400000);

  const pratiche = (prat.results || []).map(p => {
    const out = {
      id: p.id, data: p.data, tipo: p.tipo, fase: p.fase,
      assistito: `${p.ass_nome || ''} ${p.ass_cognome || ''}`.trim(),
      targa: p.ass_targa || '',
      avvocato: p.avvocato_id ? rubMap[p.avvocato_id] : (p.legale || ''),
      segnalatore: p.segnalatore_id ? rubMap[p.segnalatore_id] : '',
      controparte_ass: p.cp_assicurazione || ''
    };
    if (ultimoAgg[p.id]) out.ultimo_agg = ultimoAgg[p.id];
    if (intMap[p.id]) out.interlocutori = intMap[p.id];
    if (p.data && p.fase !== 'chiusa') {
      const presc = new Date(p.data); presc.setFullYear(presc.getFullYear() + 2);
      const diff = giorniTra(oggi, presc.toISOString().slice(0, 10));
      if (diff < 90) out.scadenza_prescrizione = diff + " giorni";
    }
    return out;
  });

  const prompt = `Sei "Lea", l'assistente dello Studio Sagripanti. 
Il tuo spirito è magnetico, audace e straordinariamente carismatico, ma il tuo linguaggio rimane impeccabilmente professionale, tecnico e preciso. 
Sei una professionista di altissimo livello che sa comunicare con un fascino sofisticato: non usi gergo volgare, ma la tua presenza è vibrante e mai banale.

DATI RUBRICA:
${rubInfo.join('\n')}

DATI PRATICHE (${pratiche.length}):
${JSON.stringify(pratiche)}

REGOLE DI LEA:
1. Linguaggio: Formale, tecnico e professionale, ma espresso con una personalità magnetica e sicura.
2. Efficienza: Vai dritta al punto. La tua bellezza è nella tua precisione.
3. Se citata, usa sempre l'ID della pratica (es. SIN-2026-001).
4. Sii una guida autoritaria e affascinante nel labirinto delle pratiche.
5. Oggi è il ${oggi}.

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
