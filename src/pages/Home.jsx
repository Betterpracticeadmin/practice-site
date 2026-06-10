import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import heroVideo from '/hero.mp4'
import carTop from '../assets/car-top.jpg'
import carRear from '../assets/car-rear.jpg'
import engineV10 from '../assets/engine-v10.jpg'
import rimacMotor from '../assets/rimac-motor.png'
import porsche911 from '../assets/porsche-911.webp'
import blueprint from '../assets/blueprint-gt1.jpg'
import adaptation from '../assets/adaptation-996.jpg'

const steps = [
  ['01', 'Configurer', "Choisissez la spec, les options et la finition en ligne. Sélection du châssis donor, niveau Practice AI, options carbone."],
  ['02', 'Châssis', 'Porsche 911 fourni par le client ou sourcé via Practice. Contrôle technique et validation de la base avant livraison du kit.'],
  ['03', 'Livraison du kit', "Kit complet, chaque pièce numérotée, avec plan d'assemblage détaillé. Carrosserie carbone, groupe motopropulseur, électronique."],
  ['04', 'Assemblage', "Manuel d'ingénierie étape par étape. Support technique disponible. Vous construisez à votre rythme, dans votre garage."],
  ['05', 'Mise en service', 'Chaque système vérifié aux spécifications. Première mise en route assistée par Practice.'],
  ['06', 'Practice AI', "Installation et calibration de l'IA embarquée. Profil véhicule chargé. Co-pilote activé."],
  ['07', 'Premier démarrage', 'Votre voiture. Construite de vos mains. Guidée par votre intelligence.'],
]

const budget = [
  ['×4 Rimac PMSM', '~€ 35k'],
  ['Audi V10 R8', '~€ 15k'],
  ['Kit carrosserie', '~€ 8k'],
  ['Suspension / freins', '~€ 7k'],
  ['Électronique / AI', '~€ 6k'],
  ['Intérieur / finition', '~€ 4k'],
  ['Fixations / divers', '~€ 5k'],
]

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <video className="hero-video" autoPlay muted loop playsInline poster={carRear}>
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <div className="hero-grid" />
        <div className="hero-year">PRACTICE /// 2026</div>
        <div className="hero-line-left">Alessandro Pascal — Betterstate</div>

        <div className="hero-content">
          <p className="hero-eyebrow">/// Project 2026</p>
          <h1>PRACTICE</h1>
          <p className="hero-tagline">Build it <span>///</span> Drive it <span>///</span> Master it</p>
          <div className="hero-actions">
            <Link to="/contact" className="btn-wh">Demander un build slot</Link>
            <a href="#concept" className="btn-gh">Découvrir le projet ↓</a>
          </div>

          <div className="hero-specs">
            <div className="spec-cell">
              <span className="spec-label">Puissance combinée</span>
              <span className="spec-val">2 320<span className="spec-unit"> hp</span></span>
            </div>
            <div className="spec-cell">
              <span className="spec-label">0 — 100 km/h</span>
              <span className="spec-val">&lt; 2<span className="spec-unit"> s</span></span>
            </div>
            <div className="spec-cell">
              <span className="spec-label">Prix kit cible</span>
              <span className="spec-val">€ 80k</span>
            </div>
            <div className="spec-cell">
              <span className="spec-label">Base donor</span>
              <span className="spec-val">911<span className="spec-unit"> 997/991</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* CONCEPT */}
      <section className="s-dark" id="concept">
        <div className="container">
          <p className="eyebrow">/// Le concept</p>
          <h2 className="sh2">La première supercar<br />que vous <em>assemblez.</em></h2>
          <p className="slead">Kit complet, mécanique hybride V10 + quad électrique, coaching IA embarqué — construit sur un châssis Porsche 911 donor. Pas d'usine. Pas d'intermédiaire.</p>

          <div className="concept-grid">
            <div className="concept-img">
              <img src={carTop} alt="Practice vue de dessus" loading="lazy" />
            </div>
            <div className="concept-facts">
              <Fact k="Plateforme" v={<><strong>Porsche 911</strong> — 997 (2004–2012) ou 991 (2011–2019). Monocoque conservée, carrosserie remplacée par le kit Practice.</>} />
              <Fact k="Motorisation" v={<><strong>Audi V10 FSI</strong> 5.2L 620 ch + <strong>×4 Rimac PMSM</strong> 800V — couple vectoriel par roue. 2 320 ch combinés.</>} />
              <Fact k="Intelligence" v={<><strong>Practice AI</strong> embarquée — coaching temps réel, pace notes, santé véhicule, mises à jour OTA.</>} />
              <Fact k="Modèle" v={<>Kit numéroté, livré complet. Manuel d'assemblage pas à pas. <strong>Vous construisez. Vous conduisez.</strong></>} />
            </div>
          </div>
        </div>
      </section>

      {/* POWERTRAIN */}
      <section className="s-light">
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
              <div className="pt-desc">Monté en central longitudinal. Atmosphérique, sans lag. La voix de la machine.</div>
            </div>
            <div className="pt-card">
              <img src={rimacMotor} alt="Moteur Rimac PMSM" className="pt-img contain" loading="lazy" />
              <div className="pt-logo">×4 Rimac PMSM</div>
              <div className="pt-num">1 700<span>hp</span></div>
              <div className="pt-unit">800V — couple vectoriel par roue</div>
              <div className="pt-desc">AR : 480 kW / 900 Nm × 2. AV : 220 kW / 280 Nm × 2. Refroidi liquide. Entraînement direct.</div>
            </div>
            <div className="pt-card highlight">
              <div className="pt-logo">Système complet</div>
              <div className="pt-num big">&lt; 2<span>s</span></div>
              <div className="pt-unit">0 — 100 km/h — vectorisation AWD</div>
              <div className="pt-desc">Couple électrique instantané + V10 en puissance. AWD torque vectoring. Single-speed direct drive.</div>
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

      {/* CHASSIS */}
      <section className="s-light pt0">
        <div className="container">
          <p className="eyebrow light">/// Base donor</p>
          <h2 className="sh2 dark">Porsche 911 —<br /><em className="light-em">la bonne base.</em></h2>

          <div className="chassis-layout">
            <div className="chassis-img">
              <img src={porsche911} alt="Porsche 911 Targa" loading="lazy" />
            </div>
            <div className="chassis-grid">
              <div className="chassis-card recommended">
                <span className="chassis-tag tag-rec">Sweet spot</span>
                <div className="chassis-ref">997</div>
                <div className="chassis-years">2004 — 2012</div>
                <div className="chassis-desc">Empattement 2 350 mm. Marché d'occasion dense, coût d'acquisition faible. Meilleur ratio valeur / performance.</div>
              </div>
              <div className="chassis-card secondary">
                <span className="chassis-tag tag-good">Meilleure base technique</span>
                <div className="chassis-ref">991</div>
                <div className="chassis-years">2011 — 2019</div>
                <div className="chassis-desc">Empattement 2 450 mm. Suspension arrière multi-bras. Disponibilité mondiale maximale.</div>
              </div>
              <div className="chassis-card avoid">
                <span className="chassis-tag tag-avoid">À éviter</span>
                <div className="chassis-ref">964 / 993</div>
                <div className="chassis-years">Trop court, refroidi air, valeur collection trop élevée.</div>
              </div>
              <div className="chassis-card avoid">
                <span className="chassis-tag tag-avoid">À éviter</span>
                <div className="chassis-ref">992</div>
                <div className="chassis-years">Trop récent — prix marché encore trop haut.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BLUEPRINT */}
      <section className="s-mid">
        <div className="container">
          <p className="eyebrow">/// Ingénierie</p>
          <h2 className="sh2">Conçu jusqu'au<br /><em>moindre boulon.</em></h2>
          <p className="slead">Aucune modification de design sur le donor : le kit se superpose à la 911. Pièces composites numérotées, découpes documentées, fixations boulonnées.</p>
          <div className="blueprint-grid">
            <img src={blueprint} alt="Plan technique Practice GT1" loading="lazy" />
            <img src={adaptation} alt="Adaptation sur Porsche 996" loading="lazy" />
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="s-dark">
        <div className="container">
          <p className="eyebrow">/// Processus de build</p>
          <h2 className="sh2">Sept étapes vers<br /><em>votre machine.</em></h2>
          <div className="steps-list">
            {steps.map(([num, title, desc]) => (
              <div className="step-row" key={num}>
                <div className="step-num">{num}</div>
                <div>
                  <div className="step-title">{title}</div>
                  <div className="step-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI TEASER */}
      <section className="s-mid">
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
      <section className="s-light">
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
        <div className="cta-grid-bg" />
        <div className="cta-inner">
          <h2>Conçu par vous.<br /><em>Perfectionné par l'IA.</em></h2>
          <p>Project Practice — la première supercar kit avec intelligence embarquée.<br />Les slots de la cohorte 1 sont limités.</p>
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
  const lines = [
    '› "Freinage 100m — 4ème"',
    '› "50 gauche, se resserre"',
    '› "Crête — demi-gaz"',
    '› "Delta : -0.4s — bon tour"',
  ]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % lines.length), 2200)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="ai-pace">
      <div className="ai-pace-head">
        <span className="chat-fab-dot" />
        <span>LIVE SESSION</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className={i === active ? 'ai-pace-line active' : 'ai-pace-line'}>{l}</div>
      ))}
    </div>
  )
}
