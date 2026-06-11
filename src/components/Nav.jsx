import { useState, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  // Pages dont le haut est sombre (hero foncé) : la nav passe en texte clair.
  // Les autres pages affichent une barre claire en permanence (lisible partout).
  const overDark = pathname === '/' || pathname === '/build'
  const solid = !overDark

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}${overDark ? ' over-dark' : ''}${solid ? ' solid' : ''}`}>
      <Link to="/" className="nav-logo" onClick={() => setOpen(false)}>
        Practice
      </Link>

      <ul className={open ? 'nav-links open' : 'nav-links'}>
        <li><NavLink to="/" end onClick={() => setOpen(false)}>Home</NavLink></li>
        <li><NavLink to="/practice-ai" onClick={() => setOpen(false)}>Practice AI</NavLink></li>
        <li><NavLink to="/build" onClick={() => setOpen(false)}>The Build</NavLink></li>
        <li><NavLink to="/contact" onClick={() => setOpen(false)}>Contact</NavLink></li>
      </ul>

      <div className="nav-right">
        <Link to="/contact" className="nav-cta">Request a slot</Link>
        <button className="nav-burger" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
          <span /><span /><span />
        </button>
      </div>
    </nav>
  )
}
