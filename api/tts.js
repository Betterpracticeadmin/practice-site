// Vercel serverless — Neural TTS (ElevenLabs) pour une voix vraiment humaine / cinéma.
// Donne à Practice une voix de type "Joi (Blade Runner 2049)" — chaude, expressive, sensuelle.
// Nécessite la variable d'env ELEVENLABS_API_KEY sur Vercel (Settings -> Environment Variables).
// Sans clé : renvoie {error:'no_key'} et le front bascule sur la voix du navigateur.

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { res.status(200).json({ error: 'no_key' }); return; }

  // diagnostic SÛR pour retrouver le nom de la variable où l'utilisateur a déposé son Voice ID
  if (req.query && req.query.debug) {
    const names = Object.keys(process.env).filter(function (k) { return !/^(VERCEL|AWS|NODE|PATH|HOME|LAMBDA|_|TZ|LANG|NX|PWD|SHLVL|HOSTNAME|TERM|NOW_|VC_|TURBO|LD_)/i.test(k); });
    const voiceVars = {};
    names.forEach(function (k) { if (/voice|eleven|tts|11labs/i.test(k) && !/key|secret|api_key|token/i.test(k)) voiceVars[k] = (process.env[k] || '').slice(0, 40); });
    res.status(200).json({ custom_names: names, voice_vars: voiceVars }); return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const text = (body.text || '').toString().slice(0, 800);
  if (!text) { res.status(200).json({ error: 'no_text' }); return; }

  // Voix : 1) celle demandée par le front, 2) celle déposée en variable d'env (plusieurs noms possibles), 3) Sarah par défaut.
  const ENV_VOICE = process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE || process.env.ELEVEN_VOICE_ID || process.env.VOICE_ID || process.env.TTS_VOICE || process.env.ELEVEN_VOICE || '';
  const voice = body.voice || ENV_VOICE || 'cgSgspJ2msm6clMCkdW9';

  try {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice + '?optimize_streaming_latency=3&output_format=mp3_44100_64', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', 'accept': 'audio/mpeg' },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        // ton « Scarlett Johansson / Samantha (Her) » : chaud, intime, un peu soufflé. stability basse = plus expressif/feutré, style haut = émotion, débit lent = sensuel.
        voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.45, use_speaker_boost: true, speed: 0.86 }
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
