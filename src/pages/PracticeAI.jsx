import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const PACE_NOTES = [
  'Braking 100m — 4th, full throttle at the apex',
  '50 left, tightens — don\'t lift',
  'Crest, half throttle, then full',
  'Long straight — 6th, brakes at 380°C',
  'Right-left chicane — stay right',
  'Hairpin — 2nd, late exit, full power',
]
const SPEEDS = [128, 134, 142, 155, 162, 156, 148, 142, 135, 128]
const GEARS = [3, 4, 4, 5, 5, 4, 4, 4, 3, 3]
const TYRES = [83, 85, 87, 89, 91, 90, 88, 87, 86, 84]
const DELTAS = [-0.1, -0.2, -0.3, -0.4, -0.3, -0.2, -0.3, -0.4, -0.5, -0.4]

const LOG = [
  { ts: '00:00.412', tag: 'GEAR', msg: '3rd → 4th shift recommended' },
  { ts: '00:01.220', tag: 'LINE', msg: 'Line: apex +0.4m, correct' },
  { ts: '00:02.008', tag: 'PACE', msg: '"Braking 100m — 4th, full throttle"' },
  { ts: '00:03.640', tag: 'TYRE', msg: 'Front tyre 89°C — optimal window' },
  { ts: '00:05.112', tag: 'PACE', msg: '"50 left, tightens"' },
  { ts: '00:06.380', tag: 'DELTA', msg: 'Sector 1: -0.3s vs best lap' },
  { ts: '00:08.205', tag: 'BRAKE', msg: 'Front brakes: 390°C — limit approaching' },
  { ts: '00:09.810', tag: 'PACE', msg: '"Hairpin — late exit, full power"' },
]

const VEHICLES = [
  { model: 'Porsche 911 Carrera (997)', year: '2008', km: '62,400 km', service: 'March 2024', mods: 'Sport exhaust, 18" BBS wheels' },
  { model: 'Porsche 911 Turbo (991)', year: '2015', km: '41,800 km', service: 'Nov. 2024', mods: 'Stage 2 ECU, Brembo brakes' },
  { model: 'Porsche 997 GT3 RS', year: '2010', km: '29,500 km', service: 'Feb. 2025', mods: 'FIA cage, 6-pt harness' },
  { model: 'Audi R8 V10 Gen.1', year: '2011', km: '78,200 km', service: 'Jan. 2025', mods: 'None declared' },
]

const FEATURES = [
  ['01', 'Real-time coaching', 'Gear recommendations, optimal line, weather-adapted grip. Sector-by-sector report after every session.', 'Live'],
  ['02', 'Pace notes in your ear', 'Adapted to circuit, rally, hillclimb, track day. Switchable profiles: aggressive, balanced, safe. The voice speaks only when useful.', 'Live'],
  ['03', 'Full vehicle health', 'Tyres, brakes, suspension and powertrain analysed continuously. Predictive alerts before failure.', 'Live'],
  ['04', 'Always learning', 'New tracks, new coaching algorithms — delivered via OTA update. One download. Every lap, faster.', 'OTA'],
]

export default function PracticeAI() {
  const [hud, setHud] = useState(0)
  const [pace, setPace] = useState(0)
  const [logVisible, setLogVisible] = useState(1)
  const [plate, setPlate] = useState('')
  const [vehicle, setVehicle] = useState(null)
  const logRef = useRef(null)

  useEffect(() => {
    const a = setInterval(() => setHud((i) => (i + 1) % SPEEDS.length), 1100)
    const b = setInterval(() => setPace((i) => (i + 1) % PACE_NOTES.length), 3800)
    const c = setInterval(() => setLogVisible((n) => (n >= LOG.length ? 1 : n + 1)), 1600)
    return () => { clearInterval(a); clearInterval(b); clearInterval(c) }
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logVisible])

  const delta = DELTAS[hud]

  function analyze() {
    const v = plate.trim()
    if (!v) return
    setVehicle(VEHICLES[v.length % VEHICLES.length])
  }

  return (
    <>
      {/* HERO */}
      <section className="ai-hero">
        <div className="ai-hero-glow" />
        <p className="eyebrow">/// Embedded intelligence</p>
        <h1 className="ai-hero-h1">Practice <em>AI.</em></h1>
        <p className="ai-hero-sub">An embedded co-pilot trained on thousands of laps. It listens to the car, reads the road, and whispers the right move — every corner, every session.</p>
        <div className="hero-actions center">
          <Link to="/contact" className="btn-wh">Request early access</Link>
          <a href="#demo" className="btn-gh">Watch the demo ↓</a>
        </div>

        {/* HUD */}
        <div className="hud">
          <div className="hud-bar">
            <div className="hud-item"><label>Speed</label><span className="hud-val">{SPEEDS[hud]}</span><span className="hud-unit">km/h</span></div>
            <div className="hud-item"><label>Gear</label><span className="hud-val green">{GEARS[hud]}</span></div>
            <div className="hud-item"><label>Tyre temp</label><span className="hud-val amber">{TYRES[hud]}</span><span className="hud-unit">°C</span></div>
            <div className="hud-item"><label>Delta / ref</label><span className={delta < 0 ? 'hud-val green' : 'hud-val red'}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}</span><span className="hud-unit">s</span></div>
          </div>
          <div className="pace-strip">
            <span className="chat-fab-dot" />
            <span className="pace-label">Co-pilot</span>
            <span className="pace-text" key={pace}>› <strong>"{PACE_NOTES[pace]}"</strong></span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="s-light">
        <div className="container narrow">
          <p className="eyebrow light">/// Performance</p>
          <h2 className="sh2 dark">Real-time intelligence,<br />every lap.</h2>
          <p className="slead dark">Practice AI isn't an app. It's an embedded system that lives in the car — trained on thousands of drivers' data, adapted to your style.</p>

          <div className="stats-row">
            <Stat n="12,000+" d="Laps analysed in the database" />
            <Stat n="48" d="Tracks integrated into the system" />
            <Stat n="< 80ms" d="Live pace-note latency" />
          </div>

          <div className="features-grid">
            {FEATURES.map(([num, title, desc, tag]) => (
              <div className="feat-cell" key={num}>
                <p className="feat-num">{num}</p>
                <h3 className="feat-title">{title}</h3>
                <p className="feat-desc">{desc}</p>
                <span className={tag === 'OTA' ? 'feat-tag tag-ota' : 'feat-tag tag-live'}>{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATE */}
      <section className="s-light pt0">
        <div className="container narrow">
          <p className="eyebrow light">/// Vehicle intelligence</p>
          <h2 className="sh2 dark">Enter your plate.<br />Practice knows everything.</h2>
          <p className="slead dark">Factory specs, service history, registered modifications — Practice AI loads your vehicle's full profile at first start.</p>

          <div className="plate-wrapper">
            <div className="plate-header">
              <h3>Simulate a vehicle profile load</h3>
              <p>Enter any registration to see what Practice pulls automatically.</p>
            </div>
            <div className="plate-body">
              <div className="plate-row-input">
                <input
                  className="plate-input"
                  placeholder="AB-123-CD"
                  maxLength={9}
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && analyze()}
                />
                <button className="plate-btn" onClick={analyze}>Analyse →</button>
              </div>
              {vehicle && (
                <div className="plate-result show">
                  <PR k="Vehicle detected" v={vehicle.model} />
                  <PR k="Model year" v={vehicle.year} />
                  <PR k="Recorded mileage" v={vehicle.km} />
                  <PR k="Last service" v={vehicle.service} />
                  <PR k="Declared modifications" v={vehicle.mods} />
                  <PR k="Practice AI profile" v="✓ Auto-calibrated" ok />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="demo-section" id="demo">
        <div className="container narrow">
          <p className="eyebrow">/// Live</p>
          <h2 className="sh2">Pace notes,<br /><em>in your ear.</em></h2>
          <p className="slead">The system speaks only when useful. Calibrated to the line, weather, tyre temperature.</p>

          <div className="demo-grid">
            <div className="demo-notes">
              <div className="demo-notes-header">
                <div className="dot-r" /><div className="dot-a" /><div className="dot-g" />
                <span>practice_ai — live session</span>
              </div>
              <div className="demo-log" ref={logRef}>
                {LOG.slice(0, logVisible).map((l, i) => (
                  <div key={i} className={l.tag === 'PACE' ? 'log-line active' : 'log-line'}>
                    <span className="ts">{l.ts}</span><span className="tag">[{l.tag}]</span>{l.msg}
                  </div>
                ))}
              </div>
            </div>
            <div className="demo-metrics">
              <Metric label="Current speed" val={`${SPEEDS[hud]} km/h`} pct={(SPEEDS[hud] / 200) * 100} color="var(--accent-live)" />
              <Metric label="Tyre temp" val={`${TYRES[hud]} °C`} pct={(TYRES[hud] / 120) * 100} color="#EF9F27" />
              <Metric label="Gear engaged" val={`${GEARS[hud]}`} pct={(GEARS[hud] / 7) * 100} color="var(--accent-live)" />
              <Metric label="Delta / best" val={`${delta > 0 ? '+' : ''}${delta.toFixed(1)} s`} pct={Math.abs(delta) / 0.6 * 100} color="var(--accent-live)" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-final">
        <div className="cta-inner">
          <h2>Reserve your<br /><em>Practice AI</em> access.</h2>
          <p>Limited to the first builders. Priority to confirmed build-slot requests.</p>
          <div className="cta-btns">
            <Link to="/contact" className="btn-wh">Request a build slot</Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Stat({ n, d }) {
  return <div className="stat-card"><span className="stat-num">{n}</span><span className="stat-desc">{d}</span></div>
}
function PR({ k, v, ok }) {
  return <div className="pr-row"><span className="pr-key">{k}</span><span className={ok ? 'pr-val ok' : 'pr-val'}>{v}</span></div>
}
function Metric({ label, val, pct, color }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-val">{val}</div>
      <div className="metric-bar-wrap"><div className="metric-bar" style={{ width: `${Math.min(100, pct)}%`, background: color }} /></div>
    </div>
  )
}
