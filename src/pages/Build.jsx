import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

// Deltas re-derived from Home's budget so the V10 / 997 / Full default totals < €80,000.
// Baseline (flat-six / 997 / Core) = body 8 + susp/brakes 7 + electronics 6 + interior 4 + misc 5 = €30,000.
const BASE_KIT = 30000
const DONOR = { '997': 0, '991': 4000 }
const POWER = { v10: { add: 35000, hp: 2320, sprint: '< 2.0' }, six: { add: 0, hp: 620, sprint: null } }
const AI = { core: 0, full: 6000 }
// Default v10 / 997 / full = 30000 + 0 + 35000 + 6000 = €71,000 (< €80k target).
function Configurator() {
  const [donor, setDonor] = useState('997')
  const [power, setPower] = useState('v10')
  const [ai, setAi] = useState('full')
  const total = BASE_KIT + DONOR[donor] + POWER[power].add + AI[ai]
  const hp = POWER[power].hp
  const sprint = POWER[power].sprint
  const outRef = useRef(null)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = outRef.current; if (!root) return
    root.querySelectorAll('[data-count]').forEach((n) => {
      const to = Number(n.dataset.count); const fmt = n.dataset.fmt
      const render = (v) => { n.textContent = fmt === 'euro' ? '€' + Math.round(v).toLocaleString('en-US') : Math.round(v).toLocaleString('en-US') }
      if (reduce) { render(to); return }
      const from = Number(n.dataset.prev || 0); const t0 = performance.now(); const dur = 650
      const tick = (now) => { const p = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - p, 3); render(from + (to - from) * e); if (p < 1) requestAnimationFrame(tick) }
      requestAnimationFrame(tick); n.dataset.prev = String(to)
    })
  }, [total, hp])
  const Opt = ({ val, cur, set, k, s }) => (
    <button type="button" className={cur === val ? 'cfg-opt on' : 'cfg-opt'} onClick={() => set(val)} aria-pressed={cur === val}>
      <span className="cfg-opt-k">{k}</span><span className="cfg-opt-s">{s}</span>
    </button>
  )
  return (
    <section className="s-light">
      <div className="container narrow">
        <p className="eyebrow light"><span className="idx">—</span>Configure — Step 01, live</p>
        <h2 className="sh2 dark">Spec it now.<br />Watch the number settle.</h2>
        <p className="slead dark">Pick your base, your powertrain and your intelligence tier. The running estimate and the combined output update as you choose.</p>
        <div className="cfg-grid">
          <div className="cfg-controls">
            <div className="cfg-group"><span className="cfg-label">Donor base</span><div className="cfg-opts">
              <Opt val="997" cur={donor} set={setDonor} k="911 · 997" s="2004–2012 · sweet spot" />
              <Opt val="991" cur={donor} set={setDonor} k="911 · 991" s="2011–2019 · best technical" />
            </div></div>
            <div className="cfg-group"><span className="cfg-label">Powertrain</span><div className="cfg-opts">
              <Opt val="v10" cur={power} set={setPower} k="Signature V10" s="V10 FSI + ×4 Rimac · 2,320 hp" />
              <Opt val="six" cur={power} set={setPower} k="Original flat-six" s="Keep the Porsche engine · lighter" />
            </div></div>
            <div className="cfg-group"><span className="cfg-label">Practice AI</span><div className="cfg-opts">
              <Opt val="core" cur={ai} set={setAi} k="Core" s="Coaching + vehicle health" />
              <Opt val="full" cur={ai} set={setAi} k="Full" s="Pace notes · predictive · OTA" />
            </div></div>
          </div>
          <div className="cfg-readout pt-card" ref={outRef}>
            <div className="cfg-total-k">Estimated kit total</div>
            <div className="cfg-total"><span data-count={total} data-fmt="euro">€{total.toLocaleString('en-US')}</span></div>
            <div className="cfg-metrics">
              <div><span className="cfg-m-v"><span data-count={hp} data-fmt="thousands">{hp.toLocaleString('en-US')}</span></span><span className="cfg-m-k">Combined hp</span></div>
              <div><span className="cfg-m-v">{sprint || '—'}{sprint && <small>s</small>}</span><span className="cfg-m-k">0–100 km/h</span></div>
            </div>
            <p className="cfg-fine">Excludes donor chassis (€15–30k). Target kit under €80,000. Direct-builder model — no factory markup.</p>
            <Link to={`/contact?donor=${donor}&power=${power}&ai=${ai}`} className="btn-wh cfg-lock">Lock this spec →</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

const steps = [
  ['01', 'Configure', 'Choose the spec, options and finish online: donor chassis, powertrain (signature V10 or original flat-six), Practice AI level, carbon options.'],
  ['02', 'Chassis', 'Porsche 911 supplied by you or sourced via Practice. Technical inspection and validation of the base before the kit ships.'],
  ['03', 'Kit delivery', 'Complete kit, every part numbered, with a detailed assembly plan: carbon body, powertrain, electronics.'],
  ['04', 'Assembly', 'Step-by-step engineering manual, technical support available. You build at your own pace, in your garage.'],
  ['05', 'Commissioning', 'Every system checked to spec. First start-up assisted by Practice.'],
  ['06', 'Practice AI', 'Install and calibrate the embedded AI on your vehicle. Profile loaded, co-pilot activated.'],
  ['07', 'First start', 'Your car. Built by your hands. Guided by your intelligence.'],
]

export default function Build() {
  return (
    <>
      <section className="build-hero">
        <p className="eyebrow">/// The build process</p>
        <h1>Seven steps to<br /><em>your machine.</em></h1>
        <p>A clear journey from the first configuration click to the first start — deliberate, documented, and entirely at your pace. No workshop owns your timeline. You do.</p>
      </section>

      <Configurator />

      <section className="build-section">
        <div className="build-list">
          {steps.map(([num, title, desc]) => (
            <div className="build-step" key={num}>
              <div className="build-step-num">{num}</div>
              <div>
                <div className="build-step-k">Step {num}</div>
                <div className="build-step-t">{title}</div>
                <div className="build-step-d">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="s-light">
        <div className="container narrow">
          <p className="eyebrow light"><span className="idx">—</span>Questions</p>
          <h2 className="sh2 dark">The things you're<br />right to ask.</h2>
          <div className="features-grid">
            <div className="feat-cell"><h3 className="feat-title">Do I need to be a professional mechanic?</h3><p className="feat-desc">No — but you should be comfortable with tools and patient. Every part is numbered, the manual is written to be followed, and remote technical support is included. Practice is demanding by design, not by accident.</p></div>
            <div className="feat-cell"><h3 className="feat-title">Is the finished car road-legal?</h3><p className="feat-desc">The donor's monocoque and type-approved identity are retained, which is the basis for registration. Final homologation depends on your country's kit-car and individual-approval rules; we guide you through the paperwork.</p></div>
            <div className="feat-cell"><h3 className="feat-title">What if I don't want the full V10?</h3><p className="feat-desc">Keep your donor's original Porsche flat-six. Fewer parts, a simpler build and a lower budget — while still receiving the carbon body and Practice AI. The V10 is the signature, not the toll gate.</p></div>
            <div className="feat-cell"><h3 className="feat-title">How much, all in?</h3><p className="feat-desc">Target kit under €80,000, plus a donor chassis at roughly €15–30k by model and condition. Direct-builder pricing — no factory, no dealer margin. Every euro is on the investment breakdown.</p></div>
            <div className="feat-cell"><h3 className="feat-title">Does Practice AI need a subscription?</h3><p className="feat-desc">The intelligence lives on the car and works offline. OTA updates are part of ownership, not a paywall. If that ever changes, Cohort 1 terms are protected.</p></div>
            <div className="feat-cell"><h3 className="feat-title">What am I buying into with Cohort 1?</h3><p className="feat-desc">A numbered kit from the first, limited run — direct access to the Betterstate team, priority on updates, and a place in the founding owners' network. Slots go in order of confirmed requests.</p></div>
          </div>
        </div>
      </section>

      <section className="cta-final">
        <div className="cta-inner">
          <h2>Ready to <em>build?</em></h2>
          <p>Cohort 1 is limited and numbered. Reserve your slot, lock your specification, and begin at step 01. Everything after that is in your hands — exactly as it should be.</p>
          <div className="cta-btns">
            <Link to="/contact" className="btn-wh">Request a build slot</Link>
            <Link to="/practice-ai" className="btn-gh">See Practice OS running</Link>
          </div>
        </div>
      </section>
    </>
  )
}
