import { getUser, json, unauthorized } from '../_lib/auth.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_BASE64 = 14_000_000; // ~10 MB
const MAX_PROMPT = 8_000;

export async function onRequestPost(context) {
  const { request, env } = context;

  // Gate: solo utenti loggati (cookie sessione)
  const u = await getUser(context);
  if (!u) return unauthorized();

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido' }, { status: 400 }); }
  const { base64, mediaType, prompt } = body;
  if (!base64 || !prompt) return json({ error: 'Parametri mancanti' }, { status: 400 });
  if (typeof base64 !== 'string' || base64.length > MAX_BASE64) return json({ error: 'File troppo grande' }, { status: 413 });
  if (typeof prompt !== 'string' || prompt.length > MAX_PROMPT) return json({ error: 'Prompt non valido' }, { status: 400 });

  const mime = mediaType && mediaType.startsWith('image/') ? mediaType : 'application/pdf';

  const risposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime, data: base64 } }, { text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024 }
      })
    }
  );

  if (!risposta.ok) {
    const err = await risposta.text();
    return json({ error: err }, { status: risposta.status });
  }
  const data = await risposta.json();
  const testo = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  return json({ testo });
}
