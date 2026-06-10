// Fonction serverless Vercel : POST /api/chat (chatbot Practice AI, en streaming).
// Tant que la variable d'environnement ANTHROPIC_API_KEY n'est pas définie sur
// Vercel, le chatbot répond un message clair sans rien coûter (aucun appel à Claude).
import Anthropic from '@anthropic-ai/sdk'
import { MODEL, SYSTEM_PROMPT } from '../shared/practiceAI.js'

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic() : null

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }
  if (!client) {
    res.status(503).json({
      error:
        "Le chatbot n'est pas encore activé : ajoute la variable ANTHROPIC_API_KEY dans les réglages de l'hébergeur pour l'allumer.",
    })
    return
  }

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages manquants' })
    return
  }

  const history = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    })
    stream.on('text', (delta) => res.write(`data: ${JSON.stringify({ delta })}\n\n`))
    await stream.finalMessage()
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Erreur Claude:', err?.message || err)
    if (!res.headersSent) res.status(500).json({ error: 'Erreur du modèle' })
    else {
      res.write(`data: ${JSON.stringify({ error: 'Erreur du modèle. Réessaie.' })}\n\n`)
      res.end()
    }
  }
}
