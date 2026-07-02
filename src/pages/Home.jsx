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
          <p className="hero-eyebrow">/// Cohort 1 — 2026</p>
          <h1>PRACTICE</h1>
          <p className="hero-tagline">Build it <span>///</span> Drive it <span>///</span> Master it</p>
          <p className="hero-lede">The first kit supercar with an intelligence of its own. 2,320&nbsp;hp across four driven wheels, a naturally aspirated V10 at its heart, and a co-pilot trained on twelve thousand laps — assembled by your hands, in your garage.</p>
          <div className="hero-actions">
            <Link to="/contact" className="btn-wh">Request a build slot</Link>
            <a href="#concept" className="btn-gh">Explore the project</a>
          </div>

          <div className="hero-specs">
            <div className="spec-cell"><span className="spec-label">Combined power</span><span className="spec-val"><span data-count="2320" data-fmt="thousands">2,320</span><span className="spec-unit"> hp</span></span></div>
            <div className="spec-cell"><span className="spec-label">0 — 100 km/h</span><span className="spec-val">&lt; <span data-count="2">2</span><span className="spec-unit"> s</span></span></div>
            <div className="spec-cell"><span className="spec-label">Target kit price</span><span className="spec-val">€<span data-count="80">80</span>k</span></div>
            <div className="spec-cell"><span className="spec-label">Donor base</span><span className="spec-val">911<span className="spec-unit"> 997/991</span></span></div>
          </div>
        </div>
        <span className="scroll-cue">Scroll ↓</span>
      </section>

      {/* MANIFESTO — the why, off the numbered spine */}
      <section className="s-dark" id="manifesto">
        <div className="container narrow">
          <p className="eyebrow light"><span className="idx">—</span>Manifesto</p>
          <h2 className="sh2 dark">The factory took the last<br />decision <em className="light-em">away from you.</em></h2>
          <p className="slead dark">A modern supercar is delivered finished, sealed, and updated without you. You sign, you wait, you receive. The relationship ends at the key.</p>
          <p className="slead dark">Practice begins where that ends. A complete kit, a real Porsche donor chassis, an engineered manual, and an intelligence that learns your hands. You are not a customer of the machine — you are its author.</p>
          <p className="slead dark"><strong>Build it. Drive it. Master it</strong> — in that order, and it means exactly what it says.</p>
          <div className="hero-actions" style={{ marginTop: '2rem' }}>
            <Link to="/build" className="btn-gh">Read the process →</Link>
          </div>
        </div>
      </section>

      {/* CONCEPT */}
      <section className="s-light" id="concept">
        <div className="container">
          <p className="eyebrow"><span className="idx">01</span>The concept</p>
          <h2 className="sh2">The first supercar<br />you <em>assemble.</em></h2>
          <p className="slead">A complete kit — carbon body, hybrid V10-plus-electric-quad powertrain, and embedded intelligence — built onto a Porsche 911 donor you already trust. No factory. No dealer margin. No one between you and the machine.</p>

          <div className="concept-grid">
            <div className="concept-img"><img src={carFront} alt="Practice — front" loading="lazy" /></div>
            <div className="concept-facts">
              <Fact k="Platform" v={<><strong>Porsche 911</strong> — 997 (2004–2012) or 991 (2011–2019). The monocoque and its type-approved identity are kept; every body panel is replaced by the Practice carbon kit.</>} />
              <Fact k="Powertrain" v={<><strong>Audi V10 FSI</strong> 5.2L, 620 naturally aspirated hp, joined by <strong>×4 Rimac PMSM</strong> motors on an 800V bus — torque vectored at each wheel. 2,320 hp combined, without a single turbo.</>} />
              <Fact k="Intelligence" v={<><strong>Practice AI</strong>, resident on the car — real-time coaching, pace notes, continuous health of tyres, brakes, suspension and powertrain, and OTA updates.</>} />
              <Fact k="Model" v={<>A numbered kit, delivered complete, with an engineering manual written to be followed. <strong>You build it. You drive it.</strong></>} />
            </div>
          </div>
        </div>
      </section>

      {/* POWERTRAIN */}
      <section className="s-dark">
        <div className="container">
          <p className="eyebrow light"><span className="idx">02</span>Powertrain</p>
          <h2 className="sh2 dark">A weapon <em className="light-em">of a machine.</em></h2>
          <p className="slead dark">Naturally aspirated V10, instant electric torque, torque vectoring per wheel. No turbo. No compromise.</p>

          <div className="pt-grid">
            <div className="pt-card">
              <img src={engineV10} alt="Audi V10 FSI" className="pt-img" loading="lazy" />
              <div className="pt-logo">Audi R8 FSI</div>
              <div className="pt-num"><span data-count="620">620</span><span>hp</span></div>
              <div className="pt-unit">5,204 cc — 560 Nm — 8,700 rpm</div>
              <div className="pt-desc">Central longitudinal. Naturally aspirated, no lag. The voice of the machine.</div>
            </div>
            <div className="pt-card">
              <img src={rimacMotor} alt="Rimac PMSM motor" className="pt-img contain" loading="lazy" />
              <div className="pt-logo">×4 Rimac PMSM</div>
              <div className="pt-num"><span data-count="1700" data-fmt="thousands">1,700</span><span>hp</span></div>
              <div className="pt-unit">800V — torque vectoring per wheel</div>
              <div className="pt-desc">Rear: 480 kW / 900 Nm × 2. Front: 220 kW / 280 Nm × 2. Liquid-cooled.</div>
            </div>
            <div className="pt-card highlight">
              <div className="pt-logo">Full system</div>
              <div className="pt-num big">&lt; <span data-count="2">2</span><span>s</span></div>
              <div className="pt-unit">0 — 100 km/h — AWD vectoring</div>
              <div className="pt-desc">Instant electric torque + V10 on top. AWD torque vectoring, single-speed direct drive.</div>
            </div>
          </div>

          <div className="pt-total">
            <div>
              <div className="pt-total-num" data-count="2320" data-fmt="thousands">2,320</div>
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
          <p className="eyebrow"><span className="idx">03</span>Engine choice</p>
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
          <p className="eyebrow light"><span className="idx">04</span>Donor base</p>
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
          <p className="eyebrow"><span className="idx">05</span>Gallery</p>
          <h2 className="sh2">The detail,<br /><em>everywhere.</em></h2>
          <div className="gallery-grid">
            <div className="gallery-item"><img src={heroAction} alt="Practice on the move" loading="lazy" /><span className="gallery-cap">On the road</span></div>
            <div className="gallery-item"><img src={interior} alt="Leather cabin" loading="lazy" /><span className="gallery-cap">Cabin</span></div>
            <div className="gallery-item"><img src={carRear} alt="Practice rear" loading="lazy" /><span className="gallery-cap">Rear signature</span></div>
          </div>
        </div>
      </section>

      {/* FULL-BLEED PUNCTUATION — one cinematic breath, edge-to-edge */}
      <section className="fullbleed">
        <img className="fullbleed-img" src={heroAction} alt="" loading="lazy" />
        <div className="fullbleed-scrim" />
        <div className="fullbleed-inner">
          <p className="eyebrow"><span className="idx">—</span>The object</p>
          <h2 className="fullbleed-line">Not a replica.<br /><em>A machine you author.</em></h2>
        </div>
      </section>

      {/* BUILD TEASER */}
      <section className="s-dark">
        <div className="container">
          <div className="teaser">
            <div>
              <p className="eyebrow"><span className="idx">06</span>The process</p>
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
              <Link to="/practice-ai" className="ai-link">Explore Practice OS →</Link>
            </div>
            <PaceBox />
          </div>
        </div>
      </section>

      {/* BUDGET */}
      <section className="s-dark">
        <div className="container">
          <p className="eyebrow light"><span className="idx">07</span>Investment</p>
          <h2 className="sh2 dark">Built for a budget<br /><em className="light-em">that holds.</em></h2>
          <p className="slead dark">Target kit under €80,000 — every line justified, nothing hidden. Direct-builder pricing means no factory overhead and no dealer margin between the parts and your garage. You pay for the machine, not the building it was assembled in.</p>

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
            <div className="bt-val" data-count="80000" data-fmt="euro">€80,000</div>
          </div>
        </div>
      </section>

      {/* THE COHORT — provenance + scarcity, before the final CTA */}
      <section className="s-dark">
        <div className="container narrow">
          <p className="eyebrow light"><span className="idx">—</span>The Cohort</p>
          <h2 className="sh2 dark">Numbered.<br /><em className="light-em">Not mass-produced.</em></h2>
          <p className="slead dark">Practice is a Betterstate venture, built on an unfashionable belief: that the people who own machines should understand them. Cohort 1 is a limited run of individually numbered kits, built directly with Betterstate — no factory, no dealer markup, no waitlist theatre. Every build is tracked from donor validation to first start.</p>
          <div className="features-grid">
            <div className="feat-cell"><p className="feat-num">01</p><h3 className="feat-title">Numbered, not mass-produced</h3><p className="feat-desc">Every Cohort 1 kit carries a number. When they're allocated, the cohort closes. There is no second batch of the first cars.</p><span className="feat-tag tag-live">Open</span></div>
            <div className="feat-cell"><p className="feat-num">02</p><h3 className="feat-title">Direct, not through a counter</h3><p className="feat-desc">You deal with the people who designed the kit and trained the AI. No dealer network, no configurator hiding a phone number, no margin stacked between you and the machine.</p><span className="feat-tag tag-live">Direct</span></div>
            <div className="feat-cell"><p className="feat-num">03</p><h3 className="feat-title">A car that keeps its word</h3><p className="feat-desc">What we promise about health monitoring, coaching and OTA is what the OS already does — you can watch it run before you commit. The demo on this site is the product, not a rendering of one.</p><span className="feat-tag tag-ota">OTA</span></div>
          </div>
          <div className="slot-counter" style={{ marginTop: '2.5rem' }}>
            <div className="slot-bar-wrap"><div className="slot-bar" /></div>
            <span className="slot-label">Cohort 1 — <strong>8 / 11 slots reserved</strong></span>
          </div>
          <p className="slead dark" style={{ marginTop: '1.6rem', opacity: .85 }}>When the eleventh is spoken for, the first Practices exist. After that, they can only be built again — never first.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-final">
        <div className="cta-inner">
          <h2>Designed by you.<br /><em>Perfected by AI.</em></h2>
          <p>Project Practice — the first kit supercar with an intelligence of its own. Cohort 1 is numbered and closing. The first cars are built once; after that, they are only rebuilt.</p>
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
