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

    // On-device generation: Practice Intelligence runs in the browser.
    // A short "thinking" beat, then the reply streams word by word —
    // same feel as the in-car OS resolving a request.
    // Robustness: if the tab is hidden (timers throttled), flush instantly;
    // finally-block guarantees the widget never stays locked.
    const reply = brainRef.current.reply(content)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const setLast = (text) =>
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: text }
        return copy
      })

    try {
      if (reduce || document.hidden) {
        setLast(reply)
        return
      }
      await new Promise((r) => setTimeout(r, 550 + Math.random() * 500))
      const words = reply.split(/(\s+)/)
      let acc = ''
      for (let i = 0; i < words.length; i++) {
        if (document.hidden) break                      // tab hidden → flush below
        acc += words[i]
        setLast(acc)
        if (words[i].trim()) await new Promise((r) => setTimeout(r, 18 + Math.random() * 26))
      }
      setLast(reply)                                    // always end complete
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
