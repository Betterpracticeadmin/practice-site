// ═══════════════════════════════════════════════════════════════
// src/useLuxeMotion.js  — v3 (DROP-IN REPLACEMENT, same call-site:
// useLuxeMotion() once in <App/>). Keeps all 4 original blocks and
// adds: Lenis smooth-scroll (lazy, desktop-only), mask reveal,
// word-level split-text (line-masked, innerHTML-restore), progressive
// image zoom, tilt cards, magnetic CTAs, two-speed custom cursor,
// button sheen injection — ALL on the ONE raf.js ticker. Per-route
// cleanup, reduced-motion HARD early-return, IO failsafe.
// ═══════════════════════════════════════════════════════════════
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { addFrame } from './raf.js'
import { setLenis } from './lenis.js'

const lerp = (a, b, n) => a + (b - a) * n

export function useLuxeMotion() {
  const { pathname } = useLocation()

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // HARD early-return: nothing subscribed, no Lenis, no listeners, no rAF.
    // The CSS kill switch guarantees everything is visible/static.
    if (reduce) return

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const html = document.documentElement
    const cleanups = []

    // ── 0) SMOOTH SCROLL (Lenis) — desktop/fine-pointer only, LAZY ──
    // Dynamic import: touch/reduced-motion never downloads it; a load
    // failure degrades to native scroll instead of crashing the hook.
    let lenis = null
    let offLenisFrame = null
    if (fine) {
      import('lenis').then(({ default: Lenis }) => {
        // guard: effect may have been cleaned up before the import resolved
        if (cleanups.__dead) return
        lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true })
        setLenis(lenis)
        html.classList.add('lenis')
        offLenisFrame = addFrame((t) => lenis.raf(t))
        // route in-page anchor clicks (#concept) through Lenis
        const onAnchor = (e) => {
          const a = e.target.closest('a[href^="#"]'); if (!a) return
          const id = a.getAttribute('href'); if (id.length < 2) return
          const el = document.querySelector(id)
          if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -72 }) }
        }
        document.addEventListener('click', onAnchor)
        cleanups.push(() => {
          document.removeEventListener('click', onAnchor)
          offLenisFrame && offLenisFrame()
          lenis && lenis.destroy(); setLenis(null); lenis = null
          html.classList.remove('lenis')
        })
      }).catch(() => { /* native scroll fallback — silent */ })
    }
    const scrollY = () => (lenis ? lenis.scroll : window.scrollY)

    // ── 1) HERO WORDMARK LOCK-IN (unchanged) ──
    const hero = document.querySelector('.hero')
    if (hero) requestAnimationFrame(() => hero.classList.add('hero-lock'))

    // ── 2) PROGRESSIVE REVEALS (unchanged fade+rise via --i) ──
    const SEL = '.eyebrow, .sh2, .slead, .concept-img, .fact-row, .pt-card, ' +
      '.pt-total, .opt-card, .chassis-img, .chassis-row, .gallery-item, .teaser, ' +
      '.ai-banner, .budget-item, .budget-total, .cta-inner > *, .stat-card, ' +
      '.feat-cell, .build-step, .hud, .plate-wrapper, .info-card, .left-content > *'
    const revealNodes = Array.from(document.querySelectorAll(SEL))
      .filter((n) => !n.closest('.hero'))
    const perParent = new Map()
    revealNodes.forEach((n) => {
      n.classList.add('reveal')
      const k = n.parentElement, i = perParent.get(k) || 0
      n.style.setProperty('--i', Math.min(i, 6)); perParent.set(k, i + 1)
    })

    // ── 3) MASK REVEAL — media & framed blocks (skip anything .hero) ──
    const maskNodes = Array.from(document.querySelectorAll(
      '.concept-img, .gallery-item, .opt-media, .chassis-img'))
      .filter((n) => !n.closest('.hero'))
    maskNodes.forEach((n, idx) => {
      n.classList.add('mask')
      n.style.setProperty('--i', Math.min(idx % 4, 3))
    })

    // ── 4) SPLIT TEXT — curated, line-masked, innerHTML cached & restored ──
    // VERIFIED selectors: .sh2 / .ai-title / .cta-final h2 use text+<br>+<em>.
    // EXCLUDED on purpose: .left-h1 (state-bound on Contact) & .build-hero h1.
    const SPLIT = '.sh2, .ai-title, .cta-final h2, .fullbleed-line'
    const splitNodes = Array.from(document.querySelectorAll(SPLIT))
      .filter((n) => !n.closest('.hero') && n.dataset.split == null)
    splitNodes.forEach((h) => {
      h.dataset.split = h.innerHTML          // cache for clean restore
      h.classList.add('split')
      // Rebuild into line-masks (.ln) split at <br>; wrap words in .wd,
      // preserving <em> as a single word span so italics ride in intact.
      const src = Array.from(h.childNodes)
      h.innerHTML = ''
      let line = document.createElement('span'); line.className = 'ln'
      h.appendChild(line)
      let wi = 0
      const pushWord = (frag) => { line.appendChild(frag) }
      src.forEach((node) => {
        if (node.nodeName === 'BR') {
          line = document.createElement('span'); line.className = 'ln'; h.appendChild(line)
        } else if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach((tok) => {
            if (tok === '') return
            if (!tok.trim()) { pushWord(document.createTextNode(tok)); return }
            const w = document.createElement('span'); w.className = 'wd'
            w.style.setProperty('--si', wi++); w.textContent = tok; pushWord(w)
          })
        } else if (node.nodeType === 1) {  // <em> etc. → one word span
          const w = node.cloneNode(true); w.classList.add('wd')
          w.style.setProperty('--si', wi++); pushWord(w)
        }
      })
    })
    cleanups.push(() => splitNodes.forEach((h) => {
      if (h.dataset.split != null) {
        h.innerHTML = h.dataset.split
        delete h.dataset.split
        h.classList.remove('split', 'in-view')
      }
    }))

    // ── 5) IntersectionObserver → .in-view (fire-once, cheap) ──
    const observed = [...revealNodes, ...maskNodes, ...splitNodes]
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target) }
      })
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.14 })
    observed.forEach((n) => io.observe(n))
    cleanups.push(() => io.disconnect())

    // ── 5b) IO FAILSAFE — if IO/rAF hiccups, never trap text invisible ──
    const failsafe = setTimeout(() => {
      observed.forEach((n) => n.classList.add('in-view'))
    }, 1400)
    cleanups.push(() => clearTimeout(failsafe))

    // ── 5c) FRAME-TICK — hairline corner registration marks (restraint: 2 clusters) ──
    document.querySelectorAll('.gallery-grid, .hud').forEach((n) => {
      n.classList.add('frame-tick'); io.observe(n)
    })

    // ── 5d) COUNT-UP — big serif numerals tween 0→value on first in-view ──
    // Only [data-count] nodes animate; prefixes/suffixes (€, <, hp, s) stay static.
    // Reduced-motion never reaches here (hard early-return) → literal text shown.
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
    const fmtCount = (v, kind) => {
      const n = Math.round(v)
      if (kind === 'euro') return '€' + n.toLocaleString('en-US')
      if (kind === 'thousands') return n.toLocaleString('en-US')
      return String(n)
    }
    const runCount = (el) => {
      const target = parseFloat(el.dataset.count); if (isNaN(target)) return
      const kind = el.dataset.fmt, dur = target < 10 ? 700 : 1100, t0 = performance.now()
      const step = (now) => {
        const p = Math.min((now - t0) / dur, 1)
        el.textContent = fmtCount(target * easeOutCubic(p), kind)
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    const countIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { runCount(e.target); countIO.unobserve(e.target) }
      })
    }, { threshold: 0.6 })
    document.querySelectorAll('[data-count]').forEach((n) => countIO.observe(n))
    cleanups.push(() => countIO.disconnect())

    // ── 6) IMAGE PARALLAX (±14px) + PROGRESSIVE ZOOM (1.06→1.14) ──
    const imgs = Array.from(document.querySelectorAll(
      '.concept-img img, .gallery-item img, .opt-media img, .chassis-img img, .fullbleed-img'))
      .filter((im) => !im.classList.contains('contain') &&
                      getComputedStyle(im).objectFit !== 'contain')
    imgs.forEach((im) => { im.classList.add('px-img')
      im.style.transform = 'translate3d(0,0,0) scale(1.06)' })

    // ── 7) TILT CARDS (fine only; rect cached on enter = 0 per-frame reads) ──
    const tiltEls = fine ? Array.from(document.querySelectorAll(
      '.pt-card, .opt-card, .stat-card, .info-card, .feat-cell')) : []
    tiltEls.forEach((el) => {
      el.classList.add('tilt-card'); let rect = null
      const enter = () => { rect = el.getBoundingClientRect(); el.classList.add('tilting') }
      const move = (e) => {
        if (!rect) rect = el.getBoundingClientRect()
        const gx = (e.clientX - rect.left) / rect.width
        const gy = (e.clientY - rect.top) / rect.height
        el.style.setProperty('--ry', ((gx - 0.5) * 8).toFixed(2) + 'deg')  // ±4°
        el.style.setProperty('--rx', ((0.5 - gy) * 8).toFixed(2) + 'deg')
        el.style.setProperty('--gx', (gx * 100).toFixed(1) + '%')
        el.style.setProperty('--gy', (gy * 100).toFixed(1) + '%')
      }
      const leave = () => { el.classList.remove('tilting'); rect = null
        el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg') }
      el.addEventListener('pointerenter', enter)
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerleave', leave)
      cleanups.push(() => { el.classList.remove('tilt-card', 'tilting')
        el.removeEventListener('pointerenter', enter)
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerleave', leave) })
    })

    // ── 8) MAGNETIC — primary CTAs ONLY (scoped tight, not every link) ──
    const magEls = fine ? Array.from(document.querySelectorAll('.nav-cta, .btn-wh')) : []
    magEls.forEach((el) => {
      el.classList.add('mag')
      const enter = () => el.classList.remove('snap')
      const move = (e) => {
        const r = el.getBoundingClientRect()
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.28
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.4
        el.style.setProperty('--mx', dx.toFixed(1) + 'px')
        el.style.setProperty('--my', dy.toFixed(1) + 'px')
      }
      const leave = () => { el.classList.add('snap')
        el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px') }
      el.addEventListener('pointerenter', enter)
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerleave', leave)
      cleanups.push(() => { el.classList.remove('mag', 'snap')
        el.removeEventListener('pointerenter', enter)
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerleave', leave) })
    })

    // ── 9) BUTTON SHEEN — inject one .swp span per control (once) ──
    document.querySelectorAll('.btn-wh, .nav-cta, .submit-btn, .plate-btn')
      .forEach((b) => {
        if (b.querySelector(':scope > .swp')) return
        b.classList.add('mi-sweep')
        const s = document.createElement('span'); s.className = 'swp'; b.appendChild(s)
      })

    // ── 10) CUSTOM CURSOR (fine only) — mount, THEN enable cursor:none ──
    let cursor = null, dotEl = null, ringEl = null
    let rawX = innerWidth / 2, rawY = innerHeight / 2
    let px = rawX, py = rawY, rx = rawX, ry = rawY
    if (fine) {
      cursor = document.createElement('div'); cursor.className = 'lux-cursor'
      cursor.innerHTML = '<span class="dot"></span><span class="ring"></span>'
      document.body.appendChild(cursor)
      dotEl = cursor.querySelector('.dot'); ringEl = cursor.querySelector('.ring')
      html.classList.add('lux-cursor-on')       // only AFTER the element exists
      const hot = () => cursor.classList.add('hot')
      const cold = () => cursor.classList.remove('hot')
      const hotSel = 'a, button, .tilt-card, input, textarea, label'
      const hotEls = Array.from(document.querySelectorAll(hotSel))
      hotEls.forEach((el) => { el.addEventListener('pointerenter', hot)
        el.addEventListener('pointerleave', cold) })
      cleanups.push(() => {
        cursor.remove(); html.classList.remove('lux-cursor-on')
        hotEls.forEach((el) => { el.removeEventListener('pointerenter', hot)
          el.removeEventListener('pointerleave', cold) })
      })
    }

    // ── 11) INPUT LISTENERS (all passive) ──
    const onMouse = (e) => { rawX = e.clientX; rawY = e.clientY; kick() }
    const onDown = () => cursor && cursor.classList.add('down')
    const onUp = () => cursor && cursor.classList.remove('down')
    if (fine) {
      window.addEventListener('pointermove', onMouse, { passive: true })
      window.addEventListener('pointerdown', onDown, { passive: true })
      window.addEventListener('pointerup', onUp, { passive: true })
      cleanups.push(() => {
        window.removeEventListener('pointermove', onMouse)
        window.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointerup', onUp)
      })
    }

    // ── 12) NAV CONDENSE ──
    const nav = document.querySelector('.nav')
    const onNav = () => nav && nav.classList.toggle('scrolled', scrollY() > 40)
    onNav()

    // ── 13) SCROLL-COUPLED WORK (parallax + zoom + nav) on the ONE ticker ──
    let lastScroll = -1
    const scrollWork = () => {
      const y0 = scrollY()
      if (Math.abs(y0 - lastScroll) < 0.5) return
      lastScroll = y0
      const vh = innerHeight
      for (const im of imgs) {
        const r = im.getBoundingClientRect()
        if (r.bottom < -140 || r.top > vh + 140) continue
        const p = (r.top + r.height / 2 - vh / 2) / vh              // -0.5..0.5
        const y = (-p * 14).toFixed(2)                              // ±14px drift
        const prog = 1 - Math.min(Math.max((r.top + r.height) / (vh + r.height), 0), 1)
        const sc = (1.06 + prog * 0.08).toFixed(4)                 // 1.06 → 1.14
        im.style.transform = `translate3d(0, ${y}px, 0) scale(${sc})`
      }
      onNav()
    }

    // Two consumers on ONE subscriber: scroll work + cursor lerp.
    // Because fine-only cursor state exists, we keep the frame alive while
    // the cursor is still catching up; otherwise it parks with the ticker.
    let off = null
    const frame = () => {
      scrollWork()
      if (fine) {
        px = lerp(px, rawX, 0.35); py = lerp(py, rawY, 0.35)
        rx = lerp(rx, rawX, 0.16); ry = lerp(ry, rawY, 0.16)
        if (dotEl) dotEl.style.transform = `translate3d(${px}px,${py}px,0)`
        if (ringEl) ringEl.style.transform = `translate3d(${rx}px,${ry}px,0)`
      }
    }
    off = addFrame(frame)
    cleanups.push(() => off && off())

    // kick() exists so pointer moves can re-prime work if you ever gate the
    // frame; with the shared ticker it's a no-op keep-alive. Defined last so
    // earlier listeners can reference it via closure hoisting.
    function kick() {}

    // ── TEARDOWN (per route) ──
    return () => { cleanups.__dead = true; cleanups.forEach((fn) => fn()) }
  }, [pathname])
}
