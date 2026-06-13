export const config = { maxDuration: 30 };

// --- Config (i valori Supabase sono pubblici: stessi del client) ---
const SB_URL = process.env.SUPABASE_URL || 'https://odacsbteoptwajgpstgo.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kYWNzYnRlb3B0d2FqZ3BzdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDk2NjYsImV4cCI6MjA5MDc4NTY2Nn0.mNGEytWVQCCqVl5zcb11MxqZXydtCcZjr-8xrP9GwO8';

// Origin esterne autorizzate (CSV). Le richieste same-origin (senza header Origin) sono sempre ammesse.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Modello Gemini (immagini + PDF via inline_data)
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Limiti anti-abuso
const MAX_BASE64 = 14_000_000; // ~10 MB di file
const MAX_PROMPT = 8_000;

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin: nessun header CORS necessario
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return true;
  }
  return false; // origin esterna non autorizzata
}

// Verifica il JWT di sessione Supabase: solo utenti loggati passano.
async function utenteAutorizzato(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return false;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` }
    });
    return r.ok;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const corsOk = applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(corsOk ? 200 : 403).end();
  if (!corsOk) return res.status(403).json({ error: 'Origin non autorizzata' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Cancello di autenticazione: solo sessioni Supabase valide
  if (!(await utenteAutorizzato(req))) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  try {
    const { base64, mediaType, prompt } = req.body || {};
    if (!base64 || !prompt) return res.status(400).json({ error: 'Parametri mancanti' });
    if (typeof base64 !== 'string' || base64.length > MAX_BASE64) {
      return res.status(413).json({ error: 'File troppo grande' });
    }
    if (typeof prompt !== 'string' || prompt.length > MAX_PROMPT) {
      return res.status(400).json({ error: 'Prompt non valido' });
    }

    const mime = mediaType && mediaType.startsWith('image/') ? mediaType : 'application/pdf';

    const risposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mime, data: base64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { maxOutputTokens: 1024 }
        })
      }
    );

    if (!risposta.ok) {
      const err = await risposta.text();
      return res.status(risposta.status).json({ error: err });
    }

    const data = await risposta.json();
    const testo = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    return res.status(200).json({ testo });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
