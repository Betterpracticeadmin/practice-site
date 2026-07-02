// ═══════════════════════════════════════════════════════════════
// Vercel serverless function — real-LLM chat via Groq (free tier).
//
// The API key lives ONLY here, server-side (process.env.GROQ_API_KEY) —
// it is NEVER shipped in the client bundle. If no key is configured, or
// Groq is rate-limited / down, this responds { fallback: true } and the
// browser transparently uses the on-device Practice Intelligence engine.
// Zero dependency: native fetch (Vercel Node 18+).
//
// SETUP (once): create a FREE key at console.groq.com → in the Vercel
// project, Settings → Environment Variables → add GROQ_API_KEY → redeploy.
// ═══════════════════════════════════════════════════════════════

const MODEL = 'llama-3.3-70b-versatile'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    // No key configured → tell the client to use its on-device engine.
    res.status(200).json({ fallback: true })
    return
  }

  // Sanitise the incoming history.
  let history = []
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    history = (body?.messages || [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
  } catch {
    history = []
  }

  let upstream
  try {
    upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        temperature: 0.6,
        max_tokens: 500,
        messages: [{ role: 'system', content: SYSTEM }, ...history],
      }),
    })
  } catch {
    res.status(200).json({ fallback: true })
    return
  }

  // Rate-limited (429), auth error, 5xx, etc. → graceful fallback.
  if (!upstream.ok || !upstream.body) {
    res.status(200).json({ fallback: true })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
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
          if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`)
        } catch {
          /* partial / keepalive line — ignore */
        }
      }
    }
  } catch {
    /* upstream cut — end cleanly */
  }
  res.write('data: [DONE]\n\n')
  res.end()
}
