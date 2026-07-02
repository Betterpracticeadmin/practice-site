/* ═══════════════════════════════════════════════════════════════
   src/components/ThemeToggle.jsx
   Persistent, no-FOUC theme toggle. Reads the attribute the inline
   head script already set; writes localStorage + <html data-theme>.
   Dark is the product default (no attribute or data-theme="dark").
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react'

function getInitialTheme() {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme) {
  const el = document.documentElement
  if (theme === 'light') el.setAttribute('data-theme', 'light')
  else el.setAttribute('data-theme', 'dark')
  try { localStorage.setItem('theme', theme) } catch (e) {}
  // keep the browser UI chrome in step with the surface
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f7f6f3' : '#0a0c10')
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme)

  // sync in case the first-paint script chose a value before hydration
  useEffect(() => { setTheme(getInitialTheme()) }, [])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    setTheme(next)
  }

  const isLight = theme === 'light'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Dark' : 'Light'}
    >
      {isLight ? (
        /* currently light → click for dark: show MOON */
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        /* currently dark → click for light: show SUN */
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
        </svg>
      )}
    </button>
  )
}
