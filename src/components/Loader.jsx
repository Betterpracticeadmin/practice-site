// ═══════════════════════════════════════════════════════════════
// src/components/Loader.jsx — first-visit premium loader.
// Decorative overlay only: the hero is NEVER gated behind it, so a
// loader failure can never blank the fold. Hard safety timeout force-
// completes AND force-releases the scroll lock. Skipped entirely under
// reduced-motion (CSS display:none) and on repeat visits (sessionStorage).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'

let SHOWN = false  // module flag: only the very first mount ever runs it

export default function Loader() {
  const reduce = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let seen = SHOWN
  try { seen = seen || sessionStorage.getItem('lux_seen') === '1' } catch { /* private mode */ }

  const [gone, setGone] = useState(seen || reduce)
  const [done, setDone] = useState(false)
  const barRef = useRef(null)

  useEffect(() => {
    if (seen || reduce) return
    SHOWN = true
    try { sessionStorage.setItem('lux_seen', '1') } catch { /* ignore */ }
    document.documentElement.classList.add('lenis-stopped')  // lock scroll under loader

    let raf = 0, p = 0, finished = false
    const release = () => {
      document.documentElement.classList.remove('lenis-stopped')
      setGone(true)
    }
    const finish = () => {
      if (finished) return; finished = true
      cancelAnimationFrame(raf)
      setDone(true)                         // trigger clip-path curtain-up
      setTimeout(release, 900)              // after the .82s curtain
    }
    // rAF-eased fill (buttery, not random stepping)
    const tick = () => {
      p += (100 - p) * 0.06 + 0.5
      if (p > 99.5) p = 100
      if (barRef.current) barRef.current.style.transform = `scaleX(${(p / 100).toFixed(3)})`
      if (p < 100) raf = requestAnimationFrame(tick)
      else setTimeout(finish, 220)
    }
    raf = requestAnimationFrame(tick)

    // HARD SAFETY NET: whatever happens, never trap scroll or the overlay.
    const safety = setTimeout(() => { finish(); release() }, 4000)

    return () => { cancelAnimationFrame(raf); clearTimeout(safety)
      document.documentElement.classList.remove('lenis-stopped') }
  }, [seen, reduce])

  if (gone) return null
  return (
    <div className={`lux-loader${done ? ' done' : ''}`} aria-hidden="true">
      <div className="ll-mark">PRACTICE</div>
      <div className="ll-bar" ref={barRef}><i /></div>
    </div>
  )
}
