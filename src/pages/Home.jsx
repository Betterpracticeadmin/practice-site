import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import heroVideo from '/hero.mp4'
import carFront from '../assets/car-front.jpg'
import carRear from '../assets/car-rear.jpg'
import carTop from '../assets/car-top.jpg'
import heroAction from '../assets/hero-action.jpg'
import interior from '../assets/interior.jpg'
import engineV10 from '../assets/engine-v10.jpg'
import enginePorsche from '../assets/engine-porsche.jpg'
import rimacMotor from '../assets/rimac-motor.png'
import porscheWhite from '../assets/porsche-911-white.jpg'

const budget = [
  ['×4 Rimac PMSM', '~€ 35k'],
  ['Audi V10 R8', '~€ 15k'],
  ['Kit carrosserie', '~€ 8k'],
  ['Suspension / freins', '~€ 7k'],
  ['Électronique / AI', '~€ 6k'],
  ['Intérieur / finition', '~€ 4k'],
  ['Fixations / divers', '~€ 5k'],
]

const chassis = [
  { ref: '997', yr: '2004 — 2012', ds: "Empattement 2 350 mm. Marché d'occasion dense, coût d'acquisition faible.", pill: 'Sweet spot', cls: 'best' },
  { ref: '991', yr: '2011 — 2019', ds: 'Empattement 2 450 mm. Suspension arrière multi-bras, disponibilité maximale.', pill: 'Top technique', cls: 'good' },
  { ref: '964 / 993', yr: 'Trop court, refroidi air, valeur collection trop élevée.', pill: 'À éviter', cls: 'no', muted: true },
  { ref: '992', yr: 'Trop récent — prix marché encore trop haut.', pill: 'À éviter', cls: 'no', muted: true },
]

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">/// Project 2026</p>
          <h1>PRACTICE</h1>
          <p className="hero-tagline">Build it <span>///</span> Drive it <span>///</span> Master it</p>
          <div className="hero-actions">
            <Link to="/contact" className="btn-wh">Demander un build slot</Link>
            <a href="#concept" className="btn-gh">Découvrir le projet</a>
          </div>

          <div className="hero-media">
            <video autoPlay muted loop playsInline poster={carFront}>
              <source src={heroVideo} type="video/mp4" />
            </video>
            <span className="hero-media-tag">/// Practice — prototype</span>
          </div>

          <div className="hero-specs">
            <div className="spec-cell"><span className="spec-label">Puissance combinée</span><span className="spec-val">2 320<span className="spec-unit"> hp</span></span></div>
            <div className="spec-cell"><span className="spec-label">0 — 100 km/h</span><span className="spec-val">&lt; 2<span className="spec-unit"> s</span></span></div>
            <div className="spec-cell"><span className="spec-label">Prix kit cible</span><span className="spec-val">€ 80k</span></div>
            <div className="spec-cell"><span className="spec-label">Base donor</span><span className="spec-val">911<span className="spec-unit"> 997/991</span></span></div>
          </div>
        </div>
      </section>

      {/* CONCEPT */}
      <section className="s-light" id="concept">
        <div className="container">
          <p className="eyebrow">/// Le concept</p>
          <h2 className="sh2">La première supercar<br />que vous <em>assemblez.</em></h2>
          <p className="slead">Kit complet, mécanique hybride V10 + quad électrique, coaching IA embarqué — construit sur un châssis Porsche 911 donor. Pas d'usine. Pas d'intermédiaire.</p>

          <div className="concept-grid">
            <div className="concept-img"><img src={carFront} alt="Practice — face avant" loading="lazy" /></div>
            <div className="concept-facts">
              <Fact k="Plateforme" v={<><strong>Porsche 911</strong> — 997 (2004–2012) ou 991 (2011–2019). Monocoque conservée, carrosserie remplacée par le kit Practice.</>} />
              <Fact k="Motorisation" v={<><strong>Audi V10 FSI</strong> 5.2L 620 ch + <strong>×4 Rimac PMSM</strong> 800V — couple vectoriel par roue. 2 320 ch combinés.</>} />
              <Fact k="Intelligence" v={<><strong>Practice AI</strong> embarquée — coaching temps réel, pace notes, santé véhicule, OTA.</>} />
              <Fact k="Modèle" v={<>Kit numéroté, livré complet, manuel pas à pas. <strong>Vous construisez. Vous conduisez.</strong></>} />
            </div>
          </div>
        </div>
      </section>

      {/* POWERTRAIN */}
      <section className="s-dark">
        <div className="container">
          <p className="eyebrow light">/// Groupe motopropulseur</p>
          <h2 className="sh2 dark">Une machine <em className="light-em">de guerre.</em></h2>
          <p className="slead dark">V10 atmosphérique, couple électrique instantané, vectorisation par roue. Aucun turbo. Aucun compromis.</p>

          <div className="pt-grid">
            <div className="pt-card">
              <img src={engineV10} alt="V10 Audi FSI" className="pt-img" loading="lazy" />
              <div className="pt-logo">Audi R8 FSI</div>
              <div className="pt-num">620<span>hp</span></div>
              <div className="pt-unit">5 204 cc — 560 Nm — 8 700 rpm</div>
              <div className="pt-desc">Central longitudinal. Atmosphérique, sans lag. La voix de la machine.</div>
            </div>
            <div className="pt-card">
              <img src={rimacMotor} alt="Moteur Rimac PMSM" className="pt-img contain" loading="lazy" />
              <div className="pt-logo">×4 Rimac PMSM</div>
              <div className="pt-num">1 700<span>hp</span></div>
              <div className="pt-unit">800V — couple vectoriel par roue</div>
              <div className="pt-desc">AR : 480 kW / 900 Nm × 2. AV : 220 kW / 280 Nm × 2. Refroidi liquide.</div>
            </div>
            <div className="pt-card highlight">
              <div className="pt-logo">Système complet</div>
              <div className="pt-num big">&lt; 2<span>s</span></div>
              <div className="pt-unit">0 — 100 km/h — vectorisation AWD</div>
              <div className="pt-desc">Couple électrique instantané + V10 en puissance. AWD torque vectoring, single-speed direct drive.</div>
            </div>
          </div>

          <div className="pt-total">
            <div>
              <div className="pt-total-num">2 320</div>
              <div className="pt-total-sub">Puissance combinée — hp</div>
            </div>
            <div className="pt-total-bar" />
            <div className="pt-total-right">
              <div>Couple vectorisé par roue</div>
              <div>Système 800V — refroidissement liquide</div>
            </div>
          </div>
        </div>
      </section>

      {/* ENGINE CHOICE */}
      <section className="s-light">
        <div className="container">
          <p className="eyebrow">/// Choix moteur</p>
          <h2 className="sh2">Deux philosophies,<br /><em>un seul châssis.</em></h2>
          <p className="slead">La version signature embarque le V10. Mais vous pouvez conserver le flat-six d'origine de votre Porsche pour un kit plus léger et nettement plus accessible.</p>

          <div className="options-2">
            <div className="opt-card">
              <div className="opt-media"><img src={engineV10} alt="V10 Audi FSI carbone" loading="lazy" /></div>
              <div className="opt-body">
                <span className="opt-flag signature">Version signature</span>
                <h3 className="opt-title">Audi V10 FSI 5.2</h3>
                <p className="opt-desc">620 ch atmosphériques en central longitudinal, couplés au quad électrique. L'expérience Practice complète, 2 320 ch combinés.</p>
                <div className="opt-price">Coût moteur <span>~€ 15 000</span></div>
              </div>
            </div>
            <div className="opt-card">
              <div className="opt-media"><img src={enginePorsche} alt="Flat-six Porsche d'origine" loading="lazy" /></div>
              <div className="opt-body">
                <span className="opt-flag value">Kit plus accessible</span>
                <h3 className="opt-title">Flat-six d'origine</h3>
                <p className="opt-desc">Gardez le moteur Porsche de votre donor. Moins de pièces, montage simplifié, budget réduit — tout en profitant de la carrosserie et de la Practice AI.</p>
                <div className="opt-price">Économie <span>jusqu'à ~€ 15 000</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CHASSIS (épuré) */}
      <section className="s-dark">
        <div className="container">
          <p className="eyebrow light">/// Base donor</p>
          <h2 className="sh2 dark">Porsche 911 —<br /><em className="light-em">la bonne base.</em></h2>

          <div className="chassis-layout">
            <div className="chassis-img"><img src={porscheWhite} alt="Porsche 911" loading="lazy" /></div>
            <div className="chassis-list">
              {chassis.map((c) => (
                <div className={c.muted ? 'chassis-row muted' : 'chassis-row'} key={c.ref}>
                  <div className="ref">{c.ref}</div>
                  <div className="info">
                    <div className="yr">{c.yr}</div>
                    {!c.muted && <div className="ds">{c.ds}</div>}
                  </div>
                  <span className={`chassis-pill ${c.cls}`}>{c.pill}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section className="s-light">
        <div className="container">
          <p className="eyebrow">/// Galerie</p>
          <h2 className="sh2">Le détail,<br /><em>partout.</em></h2>
          <div className="gallery-grid">
            <div className="gallery-item"><img src={heroAction} alt="Practice en mouvement" loading="lazy" /><span className="gallery-cap">Sur route</span></div>
            <div className="gallery-item"><img src={interior} alt="Intérieur cuir" loading="lazy" /><span className="gallery-cap">Habitacle</span></div>
            <div className="gallery-item"><img src={carRear} alt="Arrière Practice" loading="lazy" /><span className="gallery-cap">Signature arrière</span></div>
          </div>
        </div>
      </section>

      {/* BUILD TEASER */}
      <section className="s-dark">
        <div className="container">
          <div className="teaser">
            <div>
              <p className="eyebrow">/// Le processus</p>
              <h3>De la config au premier démarrage.</h3>
              <p>Sept étapes claires, à votre rythme, dans votre garage — du choix de la spec jusqu'à l'activation de la Practice AI.</p>
            </div>
            <Link to="/build" className="btn-wh">Voir les 7 étapes</Link>
          </div>
        </div>
      </section>

      {/* AI BANNER */}
      <section className="s-light">
        <div className="container">
          <div className="ai-banner">
            <div className="ai-grid-bg" />
            <div className="ai-banner-text">
              <p className="ai-eyebrow">/// Intelligence embarquée</p>
              <h3 className="ai-title">Practice AI —<br />votre co-pilote.</h3>
              <p className="ai-desc">Coaching en temps réel, pace notes dans l'oreille, santé véhicule complète, OTA. Entraîné sur 12 000+ tours. Calibré sur votre voiture.</p>
              <Link to="/practice-ai" className="ai-link">Explorer Practice AI →</Link>
            </div>
            <PaceBox />
          </div>
        </div>
      </section>

      {/* BUDGET */}
      <section className="s-dark">
        <div className="container">
          <p className="eyebrow light">/// Investissement</p>
          <h2 className="sh2 dark">Construit pour un budget<br /><em className="light-em">qui tient.</em></h2>
          <p className="slead dark">Objectif kit sous €80 000. Chaque euro justifié. Pas de marge usine — modèle direct builder.</p>

          <div className="budget-row">
            {budget.map(([label, val]) => (
              <div className="budget-item" key={label}>
                <div className="b-label">{label}</div>
                <div className="b-val">{val}</div>
              </div>
            ))}
            <div className="budget-item dark">
              <div className="b-label">+ Châssis donor</div>
              <div className="b-val">€ 15–30k</div>
              <div className="b-desc">Selon modèle et état</div>
            </div>
          </div>

          <div className="budget-total">
            <div className="bt-label">Total kit cible</div>
            <div className="bt-val">€ 80 000</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-final">
        <div className="cta-inner">
          <h2>Conçu par vous.<br /><em>Perfectionné par l'IA.</em></h2>
          <p>Project Practice — la première supercar kit avec intelligence embarquée. Les slots de la cohorte 1 sont limités.</p>
          <div className="cta-btns">
            <Link to="/contact" className="btn-wh">Demander un build slot</Link>
            <Link to="/practice-ai" className="btn-gh">Découvrir Practice AI</Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Fact({ k, v }) {
  return (
    <div className="fact-row">
      <div className="fact-key">{k}</div>
      <div className="fact-val">{v}</div>
    </div>
  )
}

function PaceBox() {
  const lines = ['› "Freinage 100m — 4ème"', '› "50 gauche, se resserre"', '› "Crête — demi-gaz"', '› "Delta : -0.4s — bon tour"']
  const [active, setActive] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % lines.length), 2200)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="ai-pace">
      <div className="ai-pace-head"><span className="chat-fab-dot" /><span>LIVE SESSION</span></div>
      {lines.map((l, i) => (
        <div key={i} className={i === active ? 'ai-pace-line active' : 'ai-pace-line'}>{l}</div>
      ))}
    </div>
  )
}
