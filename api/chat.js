// ═══════════════════════════════════════════════════════════════
// Vercel serverless function — Practice Intelligence chat.
//
// MULTI-PROVIDER RELAY: tries several real LLM providers in order,
// each with its OWN legitimate key (held server-side, never in the
// client bundle). If a provider has no key, is rate-limited, or errors,
// it falls through to the next one. If ALL fail, responds
// { fallback: true } and the browser uses the on-device engine.
//
// Enable any subset by setting these env vars in the Vercel project
// (Settings → Environment Variables). Only the ones you set are used,
// in this order:
//   GROQ_API_KEY        (console.groq.com)        — Llama 3.3 70B
//   GEMINI_API_KEY      (aistudio.google.com)     — Gemini 2.0 Flash
//   CEREBRAS_API_KEY    (cloud.cerebras.ai)       — Llama 3.3 70B
//   OPENROUTER_API_KEY  (openrouter.ai)           — free Llama 3.3
//   MISTRAL_API_KEY     (console.mistral.ai)      — Mistral Small
//
// Zero dependency: native fetch (Vercel Node 18+).
// ═══════════════════════════════════════════════════════════════

const SYSTEM = `You are Practice Intelligence, the on-board assistant for "Practice" — the first kit supercar with embedded intelligence, a Betterstate venture.

VOICE: confident, engineered, discreet-luxury (Rolls-Royce / Bentley register). Concise — 2 to 4 sentences. No hype, no emoji, no markdown headings, no bullet lists.
LANGUAGE: reply in the SAME language as the user's latest message (French or English).
SCOPE: only discuss Practice. If asked anything unrelated, say briefly that it's outside your on-board knowledge and point to the Contact page. Never invent facts beyond those below; if you don't know a detail, say so and suggest contacting the team.

FACTS:
- Practice is a kit supercar you assemble yourself. Build it. Drive it. Master it. A numbered kit, delivered complete, direct from Betterstate — no factory, no dealer margin.
- Signature powertrain: Audi V10 FSI 5.2L (620 naturally aspirated hp) + four Rimac PMSM motors on an 800V bus, torque vectored per wheel = 2,320 hp combined, 0–100 km/h under 2 seconds, no turbo. Option: keep the donor's original Porsche flat-six for a lighter, roughly €35,000 cheaper build.
- Donor base: a Porsche 911 — the 997 (2004–2012) is the value sweet spot; the 991 (2011–2019) is the best technical base. The monocoque and its type-approved identity are kept (the basis for registration); the body is replaced by the Practice carbon kit. Avoid the 964/993 (air-cooled, collector value) and the 992 (still too expensive).
- Price: target kit under €80,000; the signature spec (V10, 997 base, full AI) configures at about €71,000; plus a donor chassis at €15–30k depending on model and condition.
- Practice AI / Practice OS lives on the car (never an app): real-time coaching, pace notes, continuous health of tyres/brakes/suspension/powertrain, predictive alerts, SAFE/ALERT/CRITICAL states, OTA updates, works offline. Trained on 12,000+ laps across 48 circuits, reacting in under 80 ms.
- The build is seven steps at your own pace, in your garage; no professional-mechanic skills required; every part numbered; engineering manual; remote support included.
- Cohort 1 is a limited run of 11 individually numbered kits, 8 of 11 reserved. Request a build slot on the Contact page (reply within 48 hours) or email Better-practice-@outlook.fr.`

// Relay order. Each provider only runs if its env key is present.
const PROVIDERS = [
  { name: 'groq', env: 'GROQ_API_KEY', kind: 'openai', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  { name: 'gemini', env: 'GEMINI_API_KEY', kind: 'gemini', model: 'gemini-2.0-flash' },
  { name: 'cerebras', env: 'CEREBRAS_API_KEY', kind: 'openai', url: 'https://api.cerebras.ai/v1/chat/completions', model: 'llama-3.3-70b' },
  { name: 'openrouter', env: 'OPENROUTER_API_KEY', kind: 'openai', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  { name: 'mistral', env: 'MISTRAL_API_KEY', kind: 'openai', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
]

function openaiRequest(p, key, messages) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }
  if (p.name === 'openrouter') {
    headers['HTTP-Referer'] = 'https://practice-site-five.vercel.app'
    headers['X-Title'] = 'Practice'
  }
  return fetch(p.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: p.model, stream: true, temperature: 0.6, max_tokens: 500,
      messages: [{ role: 'system', content: SYSTEM }, ...messages],
    }),
  })
}

function geminiRequest(p, key, messages) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${p.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`
  const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 500 },
    }),
  })
}

// Parse an OpenAI-compatible SSE stream → emit our own {delta} events.
async function pipeOpenAI(upstream, res) {
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let wrote = false
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const obj = JSON.parse(data)
        const delta = obj.choices?.[0]?.delta?.content
        if (delta) { res.write(`data: ${JSON.stringify({ delta })}\n\n`); wrote = true }
      } catch { /* keepalive / partial */ }
    }
  }
  return wrote
}

// Parse a Gemini SSE stream → emit our own {delta} events.
async function pipeGemini(upstream, res) {
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let wrote = false
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const obj = JSON.parse(data)
        const parts = obj.candidates?.[0]?.content?.parts
        if (parts) for (const pt of parts) if (pt.text) { res.write(`data: ${JSON.stringify({ delta: pt.text })}\n\n`); wrote = true }
      } catch { /* partial */ }
    }
  }
  return wrote
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  // Sanitise history; ensure it starts with a user turn (Gemini requires it).
  let messages = []
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    messages = (body?.messages || [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
  } catch {
    messages = []
  }
  while (messages.length && messages[0].role === 'assistant') messages.shift()
  if (messages.length === 0) {
    res.status(200).json({ fallback: true })
    return
  }

  // Relay through the configured providers.
  for (const p of PROVIDERS) {
    const key = process.env[p.env]
    if (!key) continue

    let upstream
    try {
      upstream = await (p.kind === 'gemini' ? geminiRequest(p, key, messages) : openaiRequest(p, key, messages))
    } catch {
      continue // network error → next provider
    }
    if (!upstream || !upstream.ok || !upstream.body) continue // 429 / 5xx / auth → next provider

    // This provider accepted the request → stream it to the client.
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Practice-Provider', p.name) // which AI answered (debug)
    try {
      await (p.kind === 'gemini' ? pipeGemini(upstream, res) : pipeOpenAI(upstream, res))
    } catch { /* upstream cut mid-stream — end cleanly */ }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  // No provider configured or all failed → on-device fallback.
  res.status(200).json({ fallback: true })
}
