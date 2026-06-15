// Vercel serverless — Neural TTS (ElevenLabs) pour une voix vraiment humaine / cinéma.
// Donne à Practice une voix de type "Joi (Blade Runner 2049)" — chaude, expressive, sensuelle.
// Nécessite la variable d'env ELEVENLABS_API_KEY sur Vercel (Settings -> Environment Variables).
// Sans clé : renvoie {error:'no_key'} et le front bascule sur la voix du navigateur.

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { res.status(200).json({ error: 'no_key' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const text = (body.text || '').toString().slice(0, 800);
  if (!text) { res.status(200).json({ error: 'no_text' }); return; }

  // Voix par défaut : "Sarah" (féminine, douce et chaleureuse) — voix par défaut ElevenLabs (gratuite).
  const voice = body.voice || 'EXAVITQu4vr4xnSDxMaL';

  try {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice + '?optimize_streaming_latency=2', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', 'accept': 'audio/mpeg' },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        // réglages d'aperçu de l'utilisateur (Roger) : s50 / sb75 / se0 -> posé, naturel, résonant.
        voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true }
      })
    });
    if (!r.ok) { const tx = await r.text(); res.status(200).json({ error: 'tts', status: r.status, detail: tx.slice(0, 200) }); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    res.status(200).send(buf);
  } catch (e) {
    res.status(200).json({ error: 'upstream' });
  }
}
