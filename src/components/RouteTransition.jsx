// ═══════════════════════════════════════════════════════════════
// src/components/RouteTransition.jsx — clip-path curtain veil (NO blur)
// on every pathname change. Composes with the existing
// <div className="route" key={pathname}> routeIn entrance underneath.
// Clears on FIXED timeouts (robust — never sticks). No veil on first paint
// (the Loader owns the initial arrival).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getLenis } from '../lenis.js'

export default function RouteTransition() {
  const { pathname } = useLocation()
  const veil = useRef(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !veil.current) return
    const v = veil.current

    v.classList.remove('reveal'); v.classList.add('cover')     // wipe up to cover
    const l = getLenis(); if (l) l.scrollTo(0, { immediate: true }) // reset under veil
    const t1 = setTimeout(() => {                               // then wipe away
      v.classList.remove('cover'); v.classList.add('reveal')
    }, 460)                                                     // = veilCover duration
    const t2 = setTimeout(() => { v.classList.remove('reveal') }, 460 + 580)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [pathname])

  return <div className="route-veil" ref={veil} aria-hidden="true" />
}
