import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import { MODEL, SYSTEM_PROMPT } from '../shared/practiceAI.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json({ limit: '1mb' }))

// Le client lit automatiquement ANTHROPIC_API_KEY depuis l'environnement (.env).
const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic() : null

app.post('/api/chat', async (req, res) => {
  if (!client) {
    return res.status(503).json({
      error:
        "The chatbot isn't configured: add your ANTHROPIC_API_KEY (Anthropic key) to the .env file, then restart the server.",
    })
  }

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'missing messages' })
  }

  const history = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

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
    else { res.write(`data: ${JSON.stringify({ error: 'Model error. Please try again.' })}\n\n`); res.end() }
  }
})

// En production locale (après `npm run build`), sert aussi le site compilé.
const distDir = path.join(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`\n  Practice — serveur chatbot sur http://localhost:${PORT}`)
  console.log(client ? '  ✅  Clé API détectée — Practice AI est en ligne.\n' : "  ⚠️  ANTHROPIC_API_KEY absente : le chatbot répondra une erreur tant que .env n'est pas rempli.\n")
})
