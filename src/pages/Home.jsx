import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import heroVideo from '/hero.mp4'
import carFront from '../assets/car-front.jpg'
import carRear from '../assets/car-rear.jpg'
import heroAction from '../assets/hero-action.jpg'
import interior from '../assets/interior.jpg'
import engineV10 from '../assets/engine-v10.jpg'
import enginePorsche from '../assets/engine-porsche.jpg'
import rimacMotor from '../assets/rimac-motor.png'
import porscheWhite from '../assets/porsche-911-white.jpg'

const budget = [
  ['×4 Rimac PMSM', '~€35k'],
  ['Audi V10 R8', '~€15k'],
  ['Body kit', '~€8k'],
  ['Suspension / brakes', '~€7k'],
  ['Electronics / AI', '~€6k'],
  ['Interior / finish', '~€4k'],
  ['Fasteners / misc', '~€5k'],
]

const chassis = [
  { ref: '997', yr: '2004 — 2012', ds: 'Wheelbase 2,350 mm. Dense used market, low acquisition cost.', pill: 'Sweet spot', cls: 'best' },
  { ref: '991', yr: '2011 — 2019', ds: 'Wheelbase 2,450 mm. Multi-link rear suspension, maximum availability.', pill: 'Best technical', cls: 'good' },
  { ref: '964 / 993', yr: 'Too short, air-cooled, collector value too high.', pill: 'Avoid', cls: 'no', muted: true },
  { ref: '992', yr: 'Too recent — market price still too high.', pill: 'Avoid', cls: 'no', muted: true },
]

export default function Home() {
  return (
    <>
      {/* HERO — fullscreen video */}
      <section className="hero">
        <video className="hero-bg" autoPlay muted loop playsInline poster={carFront}>
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="hero-scrim" />
        <div className="hero-content">
          <p className="hero-eyebrow">/// Project 2026</p>
          <h1>PRACTICE</h1>
          <p className="hero-tagline">Build it <span>///</span> Drive it <span>///</span> Master it</p>
          <div className="hero-actions">
            <Link to="/contact" className="btn-wh">Request a build slot</Link>
            <a href="#concept" className="btn-gh">Explore the project</a>
          </div>

          <div className="hero-specs">
            <div className="spec-cell"><span className="spec-label">Combined power</span><span className="spec-val">2,320<span className="spec-unit"> hp</span></span></div>
            <div className="spec-cell"><span className="spec-label">0 — 100 km/h</span><span className="spec-val">&lt; 2<span className="spec-unit"> s</span></span></div>
            <div className="spec-cell"><span className="spec-label">Target kit price</span><span className="spec-val">€80k</span></div>
            <div className="spec-cell"><span className="spec-label">Donor base</span><span className="spec-val">911<span className="spec-unit"> 997/991</span></span></div>
          </div>
        </div>
        <span className="scroll-cue">Scroll ↓</span>
      </section>

      {/* CONCEPT */}
      <section className="s-light" id="concept">
        <div className="container">
          <p className="eyebrow">/// The concept</p>
          <h2 className="sh2">The first supercar<br />you <em>assemble.</em></h2>
          <p className="slead">Complete kit, hybrid V10 + electric quad powertrain, embedded AI coaching — built on a Porsche 911 donor chassis. No factory. No middleman.</p>

          <div className="concept-grid">
            <div className="concept-img"><img src={carFront} alt="Practice — front" loading="lazy" /></div>
            <div className="concept-facts">
              <Fact k="Platform" v={<><strong>Porsche 911</strong> — 997 (2004–2012) or 991 (2011–2019). Monocoque kept, body fully replaced by the Practice kit.</>} />
              <Fact k="Powertrain" v={<><strong>Audi V10 FSI</strong> 5.2L 620 hp + <strong>×4 Rimac PMSM</strong> 800V — torque vectoring per wheel. 2,320 hp combined.</>} />
              <Fact k="Intelligence" v={<><strong>Practice AI</strong> on board — real-time coaching, pace notes, vehicle health, OTA updates.</>} />
              <Fact k="Model" v={<>Numbered kit, delivered complete, step-by-step manual. <strong>You build it. You drive it.</strong></>} />
            </div>
          </div>
        </div>
      </section>

      {/* POWERTRAIN */}
      <section className="s-dark">
        <div className="container">
          <p className="eyebrow light">/// Powertrain</p>
          <h2 className="sh2 dark">A weapon <em className="light-em">of a machine.</em></h2>
          <p className="slead dark">Naturally aspirated V10, instant electric torque, torque vectoring per wheel. No turbo. No compromise.</p>

          <div className="pt-grid">
            <div className="pt-card">
              <img src={engineV10} alt="Audi V10 FSI" className="pt-img" loading="lazy" />
              <div className="pt-logo">Audi R8 FSI</div>
              <div className="pt-num">620<span>hp</span></div>
              <div className="pt-unit">5,204 cc — 560 Nm — 8,700 rpm</div>
              <div className="pt-desc">Central longitudinal. Naturally aspirated, no lag. The voice of the machine.</div>
            </div>
            <div className="pt-card">
              <img src={rimacMotor} alt="Rimac PMSM motor" className="pt-img contain" loading="lazy" />
              <div className="pt-logo">×4 Rimac PMSM</div>
              <div className="pt-num">1,700<span>hp</span></div>
              <div className="pt-unit">800V — torque vectoring per wheel</div>
              <div className="pt-desc">Rear: 480 kW / 900 Nm × 2. Front: 220 kW / 280 Nm × 2. Liquid-cooled.</div>
            </div>
            <div className="pt-card highlight">
              <div className="pt-logo">Full system</div>
              <div className="pt-num big">&lt; 2<span>s</span></div>
              <div className="pt-unit">0 — 100 km/h — AWD vectoring</div>
              <div className="pt-desc">Instant electric torque + V10 on top. AWD torque vectoring, single-speed direct drive.</div>
            </div>
          </div>

          <div className="pt-total">
            <div>
              <div className="pt-total-num">2,320</div>
              <div className="pt-total-sub">Combined power — hp</div>
            </div>
            <div className="pt-total-bar" />
            <div className="pt-total-right">
              <div>Torque vectored per wheel</div>
              <div>800V system — liquid cooling</div>
            </div>
          </div>
        </div>
      </section>

      {/* ENGINE CHOICE */}
      <section className="s-light">
        <div className="container">
          <p className="eyebrow">/// Engine choice</p>
          <h2 className="sh2">Two philosophies,<br /><em>one chassis.</em></h2>
          <p className="slead">The signature version carries the V10. But you can keep your Porsche's original flat-six for a lighter, far more affordable kit.</p>

          <div className="options-2">
            <div className="opt-card">
              <div className="opt-media"><img src={engineV10} alt="Audi V10 FSI carbon" loading="lazy" /></div>
              <div className="opt-body">
                <span className="opt-flag signature">Signature version</span>
                <h3 className="opt-title">Audi V10 FSI 5.2</h3>
                <p className="opt-desc">620 naturally aspirated hp, central longitudinal, paired with the electric quad. The full Practice experience, 2,320 hp combined.</p>
                <div className="opt-price">Engine cost <span>~€15,000</span></div>
              </div>
            </div>
            <div className="opt-card">
              <div className="opt-media"><img src={enginePorsche} alt="Original Porsche flat-six" loading="lazy" /></div>
              <div className="opt-body">
                <span className="opt-flag value">More affordable kit</span>
                <h3 className="opt-title">Original flat-six</h3>
                <p className="opt-desc">Keep your donor's Porsche engine. Fewer parts, simpler build, lower budget — while still enjoying the body and Practice AI.</p>
                <div className="opt-price">Save <span>up to ~€15,000</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CHASSIS */}
      <section className="s-dark">
        <div className="container">
          <p className="eyebrow light">/// Donor base</p>
          <h2 className="sh2 dark">Porsche 911 —<br /><em className="light-em">the right base.</em></h2>

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
          <p className="eyebrow">/// Gallery</p>
          <h2 className="sh2">The detail,<br /><em>everywhere.</em></h2>
          <div className="gallery-grid">
            <div className="gallery-item"><img src={heroAction} alt="Practice on the move" loading="lazy" /><span className="gallery-cap">On the road</span></div>
            <div className="gallery-item"><img src={interior} alt="Leather cabin" loading="lazy" /><span className="gallery-cap">Cabin</span></div>
            <div className="gallery-item"><img src={carRear} alt="Practice rear" loading="lazy" /><span className="gallery-cap">Rear signature</span></div>
          </div>
        </div>
      </section>

      {/* BUILD TEASER */}
      <section className="s-dark">
        <div className="container">
          <div className="teaser">
            <div>
              <p className="eyebrow">/// The process</p>
              <h3>From config to first start.</h3>
              <p>Seven clear steps, at your own pace, in your garage — from choosing the spec to activating Practice AI.</p>
            </div>
            <Link to="/build" className="btn-wh">See the 7 steps</Link>
          </div>
        </div>
      </section>

      {/* AI BANNER */}
      <section className="s-light">
        <div className="container">
          <div className="ai-banner">
            <div className="ai-grid-bg" />
            <div className="ai-banner-text">
              <p className="ai-eyebrow">/// Embedded intelligence</p>
              <h3 className="ai-title">Practice AI —<br />your co-pilot.</h3>
              <p className="ai-desc">Real-time coaching, pace notes in your ear, full vehicle health, OTA. Trained on 12,000+ laps. Calibrated to your car.</p>
              <Link to="/practice-ai" className="ai-link">Explore Practice AI →</Link>
            </div>
            <PaceBox />
          </div>
        </div>
      </section>

      {/* BUDGET */}
      <section className="s-dark">
        <div className="container">
          <p className="eyebrow light">/// Investment</p>
          <h2 className="sh2 dark">Built for a budget<br /><em className="light-em">that holds.</em></h2>
          <p className="slead dark">Target kit under €80,000. Every euro justified. No factory markup — direct builder model.</p>

          <div className="budget-row">
            {budget.map(([label, val]) => (
              <div className="budget-item" key={label}>
                <div className="b-label">{label}</div>
                <div className="b-val">{val}</div>
              </div>
            ))}
            <div className="budget-item dark">
              <div className="b-label">+ Donor chassis</div>
              <div className="b-val">€15–30k</div>
              <div className="b-desc">Depending on model and condition</div>
            </div>
          </div>

          <div className="budget-total">
            <div className="bt-label">Target kit total</div>
            <div className="bt-val">€80,000</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-final">
        <div className="cta-inner">
          <h2>Designed by you.<br /><em>Perfected by AI.</em></h2>
          <p>Project Practice — the first kit supercar with embedded intelligence. Cohort 1 slots are limited.</p>
          <div className="cta-btns">
            <Link to="/contact" className="btn-wh">Request a build slot</Link>
            <Link to="/practice-ai" className="btn-gh">Discover Practice AI</Link>
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
  const lines = ['› "Braking 100m — 4th"', '› "50 left, tightens"', '› "Crest — half throttle"', '› "Delta: -0.4s — good lap"']
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
