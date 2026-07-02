import { useState, useRef, useEffect } from 'react'
import { createBrain } from '../practiceBrain.js'

const WELCOME = {
  role: 'assistant',
  content:
    "Hi — I'm Practice Intelligence, running right here on this page. Ask me anything about the kit, the V10, the Rimac motors, the Porsche chassis, the budget or booking a build slot. (Je parle français aussi.)",
}

const SUGGESTIONS = [
  'What exactly is Practice?',
  'Which Porsche base should I choose?',
  'How much does the kit cost?',
  'How do I book a slot?',
]

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const brainRef = useRef(null)
  if (!brainRef.current) brainRef.current = createBrain()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    const next = [...messages, { role: 'user', content }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    // Practice Intelligence: try the real LLM (Groq) through our secure
    // serverless function first. If the key is unset, rate-limited, or the
    // API is down, fall back seamlessly to the on-device engine. Either way
    // the chat never breaks and never costs anything.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const setLast = (t) =>
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: t }
        return copy
      })

    try {
      const served = await streamFromServer(next, setLast)
      if (served) return

      // Fallback — on-device engine, always available, offline-safe.
      // (tab hidden → timers throttle, so flush instantly instead of streaming.)
      const reply = brainRef.current.reply(content)
      if (reduce || document.hidden) { setLast(reply); return }
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 450))
      let acc = ''
      for (const w of reply.split(/(\s+)/)) {
        if (document.hidden) break
        acc += w
        setLast(acc)
        if (w.trim()) await new Promise((r) => setTimeout(r, 18 + Math.random() * 26))
      }
      setLast(reply)
    } finally {
      setStreaming(false)
    }
  }

  // Stream a real-LLM reply from /api/chat (Groq, key held server-side).
  // Returns true if it produced content; false if the endpoint signalled
  // fallback / errored — the caller then uses the on-device engine.
  async function streamFromServer(history, setLast) {
    let res
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      })
    } catch {
      return false
    }
    if (!res.ok || !res.body) return false
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let acc = ''
    let got = false
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const obj = JSON.parse(payload)
          if (obj.fallback) return false
          if (obj.delta) { acc += obj.delta; got = true; setLast(acc) }
        } catch { /* partial line */ }
      }
    }
    return got
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      <button
        className={open ? 'chat-fab open' : 'chat-fab'}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Practice AI"
      >
        {open ? '✕' : <><span className="chat-fab-dot" /> Practice AI</>}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div>
              <div className="chat-head-title">
                <span className="chat-fab-dot" /> Practice AI
              </div>
              <div className="chat-head-sub">Practice Intelligence — on-board, runs in your browser</div>
            </div>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          <div className="chat-body" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.content || (streaming && i === messages.length - 1 ? <span className="chat-typing"><i /><i /><i /></span> : '')}
              </div>
            ))}

            {messages.length === 1 && (
              <div className="chat-suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={streaming}>{s}</button>
                ))}
              </div>
            )}
          </div>

          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Write your message…"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="chat-send" onClick={() => send()} disabled={streaming || !input.trim()}>
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  )
}
