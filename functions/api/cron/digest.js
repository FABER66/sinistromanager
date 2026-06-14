// Digest giornaliero scadenze → email (chiamato dal cron del box).
// Auth: ?key=CRON_SECRET (header x-cron-key). NON usa la sessione utente.

const GIORNI_SCADENZA = 90;
const GIORNI_FERMA = 60;
const giorniTra = (daISO, aISO) => Math.round((new Date(aISO) - new Date(daISO)) / 86400000);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('x-cron-key');
  if (!env.CRON_SECRET || key !== env.CRON_SECRET) return new Response('Non autorizzato', { status: 401 });

  const oggi = new Date().toISOString().slice(0, 10);
  const [prat, tl] = await Promise.all([
    env.DB.prepare("SELECT id,data,fase,ass_nome,ass_cognome FROM sin_pratiche WHERE fase != 'chiusa'").all(),
    env.DB.prepare("SELECT pratica_id, MAX(data) AS ultimo FROM sin_timeline GROUP BY pratica_id").all()
  ]);
  const ultimo = {};
  for (const r of tl.results || []) ultimo[r.pratica_id] = r.ultimo;

  const scadute = [], imminenti = [], ferme = [];
  for (const p of prat.results || []) {
    if (!p.data) continue;
    const presc = new Date(p.data); presc.setFullYear(presc.getFullYear() + 2);
    const prescISO = presc.toISOString().slice(0, 10);
    const gg = giorniTra(oggi, prescISO);
    const nome = `${p.ass_cognome || ''} ${p.ass_nome || ''}`.trim();
    if (gg < 0) scadute.push({ id: p.id, nome, prescISO, gg });
    else if (gg <= GIORNI_SCADENZA) imminenti.push({ id: p.id, nome, prescISO, gg });
    const inattiva = giorniTra(ultimo[p.id] || p.data, oggi);
    if (inattiva > GIORNI_FERMA) ferme.push({ id: p.id, nome, inattiva });
  }
  imminenti.sort((a, b) => a.gg - b.gg);

  const totale = scadute.length + imminenti.length + ferme.length;
  if (totale === 0) return Response.json({ ok: true, inviata: false, motivo: 'nessun avviso' });

  const sez = (titolo, items, fmt) => items.length
    ? `<h3 style="color:#1B3A5C;margin:18px 0 6px;font-size:15px">${titolo}</h3><ul style="margin:0;padding-left:18px;line-height:1.7">${items.map(fmt).join('')}</ul>` : '';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:600px">
    <h2 style="color:#1B3A5C;border-bottom:2px solid #B08D57;padding-bottom:8px">Promemoria SinistroManager</h2>
    <p style="color:#555">${oggi} — <b>${totale}</b> pratiche richiedono attenzione.</p>
    ${sez('⛔ Prescrizioni SCADUTE', scadute, p => `<li><b>${p.id}</b> ${p.nome} — termine ${p.prescISO}</li>`)}
    ${sez('⚠️ Prescrizioni in scadenza (entro 90 giorni)', imminenti, p => `<li><b>${p.id}</b> ${p.nome} — tra ${p.gg} giorni (${p.prescISO})</li>`)}
    ${sez('⏸ Pratiche ferme', ferme, p => `<li><b>${p.id}</b> ${p.nome} — nessun evento da ${p.inattiva} giorni</li>`)}
    <p style="margin-top:22px;color:#999;font-size:12px">SinistroManager · <a href="https://sinistromanager.pages.dev">apri il gestionale</a></p>
  </div>`;

  if (!env.RESEND_API_KEY || !env.MAIL_TO) {
    return Response.json({ ok: true, inviata: false, motivo: 'mail non configurata', totale, scadute: scadute.length, imminenti: imminenti.length, ferme: ferme.length });
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'SinistroManager <noreply@faberai.it>',
      to: env.MAIL_TO.split(',').map(s => s.trim()),
      subject: `⚖️ ${totale} scadenze/avvisi — SinistroManager (${oggi})`,
      html
    })
  });
  return Response.json({ ok: r.ok, inviata: r.ok, totale, scadute: scadute.length, imminenti: imminenti.length, ferme: ferme.length });
}
