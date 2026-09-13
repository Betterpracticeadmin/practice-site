// Vercel serverless — ancienne route de synthèse vocale, RETIRÉE.
// La voix officielle de Practice est une banque de MP3 pré-générés (public/voice/practice/fr) : aucun service de voix à crédits, aucune clé.
// Cette route ne sert plus qu'aux anciennes pages expérimentales (os-bw.html) : elle répond tout de suite par une erreur
// que ces pages savent traiter ('no_text' -> neuralOff), pour qu'elles passent en voix du navigateur dès la 1re phrase
// au lieu de refaire un POST en échec (404) à chaque phrase.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(410).json({ error: 'no_text', detail: 'tts_retired' });
}
