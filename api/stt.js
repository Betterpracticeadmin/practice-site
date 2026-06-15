// Vercel serverless — Speech-to-Text (ElevenLabs Scribe).
// Permet la reconnaissance vocale sur les navigateurs SANS Web Speech API (iPhone/Safari).
// Le front enregistre l'audio (MediaRecorder), l'envoie en base64 ; on le transcrit via Scribe.
// Réutilise la MÊME clé ELEVENLABS_API_KEY que la synthèse vocale — aucune nouvelle clé requise.

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { res.status(200).json({ error: 'no_key' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const b64 = (body.audio || '').toString();
  if (!b64) { res.status(200).json({ error: 'no_audio' }); return; }

  const model = (body.model === 'scribe_v2') ? 'scribe_v2' : 'scribe_v1';
  try {
    const buf = Buffer.from(b64, 'base64');
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: body.type || 'audio/webm' }), 'audio.webm');
    fd.append('model_id', model);
    // indice de langue (fr/en/ja) -> meilleure précision
    if (body.lang) fd.append('language_code', body.lang);

    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: fd
    });
    if (!r.ok) { const tx = await r.text(); res.status(200).json({ error: 'stt', status: r.status, detail: tx.slice(0, 250) }); return; }
    const j = await r.json();
    res.status(200).json({ text: (j && j.text) || '', lang: j && j.language_code });
  } catch (e) {
    res.status(200).json({ error: 'upstream', detail: String(e && e.message || e).slice(0, 150) });
  }
}
