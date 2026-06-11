import { useState, useRef, useEffect } from 'react'

const WELCOME = {
  role: 'assistant',
  content:
    "Hi 👋 I'm Practice AI. Ask me anything about the kit, the V10, the Rimac motors, the Porsche chassis, the budget or booking a build slot.",
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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur réseau')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const obj = JSON.parse(payload)
            if (obj.delta) {
              setMessages((prev) => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: copy[copy.length - 1].content + obj.delta,
                }
                return copy
              })
            } else if (obj.error) {
              throw new Error(obj.error)
            }
          } catch {
            /* ligne partielle, on ignore */
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = {
          role: 'assistant',
          content:
            '⚠️ ' + (err.message || 'Something went wrong.') +
            (err.message?.includes('key') ? '' : ' Please try again in a moment.'),
        }
        return copy
      })
    } finally {
      setStreaming(false)
    }
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
              <div className="chat-head-sub">Embedded assistant — powered by Claude</div>
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
