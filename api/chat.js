// Fonction serverless Vercel : POST /api/chat (chatbot Practice AI, en streaming).
// Tant que la variable d'environnement ANTHROPIC_API_KEY n'est pas définie sur
// Vercel, le chatbot répond un message clair sans rien coûter (aucun appel à Claude).
import Anthropic from '@anthropic-ai/sdk'
import { MODEL, SYSTEM_PROMPT } from '../shared/practiceAI.js'

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic() : null

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!client) {
    res.status(503).json({
      error:
        "The chatbot isn't enabled yet: add your ANTHROPIC_API_KEY (Anthropic key) in your host settings to switch it on.",
    })
    return
  }

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'missing messages' })
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
    if (!res.headersSent) res.status(500).json({ error: 'Model error' })
    else {
      res.write(`data: ${JSON.stringify({ error: 'Model error. Please try again.' })}\n\n`)
      res.end()
    }
  }
}
