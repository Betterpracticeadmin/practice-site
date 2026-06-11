import { Link } from 'react-router-dom'

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
        <p>A clear journey, from the first config click to the first start. At your own pace, guided every step.</p>
      </section>

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

      <section className="cta-final">
        <div className="cta-inner">
          <h2>Ready to <em>build?</em></h2>
          <p>Cohort 1 slots are limited. Reserve yours and start step 01.</p>
          <div className="cta-btns">
            <Link to="/contact" className="btn-wh">Request a build slot</Link>
            <Link to="/practice-ai" className="btn-gh">Discover Practice AI</Link>
          </div>
        </div>
      </section>
    </>
  )
}
