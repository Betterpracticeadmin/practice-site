import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import ChatWidget from './components/ChatWidget.jsx'
import Home from './pages/Home.jsx'
import PracticeAI from './pages/PracticeAI.jsx'
import Build from './pages/Build.jsx'
import Contact from './pages/Contact.jsx'
import Privacy from './pages/Privacy.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const location = useLocation()
  return (
    <>
      <ScrollToTop />
      <Nav />
      <main>
        {/* La clé sur le pathname relance l'animation d'entrée à chaque changement d'onglet */}
        <div className="route" key={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/practice-ai" element={<PracticeAI />} />
            <Route path="/build" element={<Build />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/confidentialite" element={<Privacy />} />
          </Routes>
        </div>
      </main>
      <Footer />
      <ChatWidget />
    </>
  )
}
