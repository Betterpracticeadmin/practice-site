import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const PACE_NOTES = [
  'Freinage 100m — 4ème, plein gaz sur l\'apex',
  '50 gauche, se resserre — ne coupez pas',
  'Crête, demi-gaz, puis plein régime',
  'Long droit — 6ème, freins à 380°C',
  'Chicane droite-gauche — restez à droite',
  'Épingle — 2ème, sortie tardive, pleine puissance',
]
const SPEEDS = [128, 134, 142, 155, 162, 156, 148, 142, 135, 128]
const GEARS = [3, 4, 4, 5, 5, 4, 4, 4, 3, 3]
const TYRES = [83, 85, 87, 89, 91, 90, 88, 87, 86, 84]
const DELTAS = [-0.1, -0.2, -0.3, -0.4, -0.3, -0.2, -0.3, -0.4, -0.5, -0.4]

const LOG = [
  { ts: '00:00.412', tag: 'GEAR', msg: 'Passage 3ème → 4ème recommandé' },
  { ts: '00:01.220', tag: 'LINE', msg: 'Trajectoire : apex + 0.4m, corrigez' },
  { ts: '00:02.008', tag: 'PACE', msg: '"Freinage 100m — 4ème, plein gaz"' },
  { ts: '00:03.640', tag: 'TYRE', msg: 'Pneu AVG 89°C — fenêtre optimale' },
  { ts: '00:05.112', tag: 'PACE', msg: '"50 gauche, se resserre"' },
  { ts: '00:06.380', tag: 'DELTA', msg: 'Secteur 1 : -0.3s vs meilleur tour' },
  { ts: '00:08.205', tag: 'BRAKE', msg: 'Freins AVG : 390°C — limite approche' },
  { ts: '00:09.810', tag: 'PACE', msg: '"Épingle — sortie tardive, pleine puissance"' },
]

const VEHICLES = [
  { model: 'Porsche 911 Carrera (997)', year: '2008', km: '62 400 km', service: 'Mars 2024', mods: 'Ligne sport, jantes BBS 18"' },
  { model: 'Porsche 911 Turbo (991)', year: '2015', km: '41 800 km', service: 'Nov. 2024', mods: 'ECU stage 2, freins Brembo' },
  { model: 'Porsche 997 GT3 RS', year: '2010', km: '29 500 km', service: 'Fév. 2025', mods: 'Cage FIA, harnais 6 pts' },
  { model: 'Audi R8 V10 Gen.1', year: '2011', km: '78 200 km', service: 'Janv. 2025', mods: 'Aucune déclarée' },
]

const FEATURES = [
  ['01', 'Coaching en temps réel', 'Recommandations de rapport, trajectoire optimale, grip adapté à la météo. Rapport secteur par secteur après chaque session.', 'Live'],
  ['02', "Pace notes dans l'oreille", 'Adapté à circuit, rally, hillclimb, track day. Profils switchables : agressif, équilibré, sécurisé. La voix parle uniquement quand c\'est utile.', 'Live'],
  ['03', 'Santé véhicule complète', 'Pneus, freins, suspension et groupe motopropulseur analysés en continu. Alertes prédictives avant la panne.', 'Live'],
  ['04', 'Toujours en apprentissage', 'Nouveaux circuits, nouveaux algorithmes de coaching — livrés via mise à jour OTA. Un téléchargement. Chaque lap, plus vite.', 'OTA'],
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
        <div className="hero-grid" />
        <div className="ai-hero-glow" />
        <p className="eyebrow">/// Intelligence embarquée</p>
        <h1 className="ai-hero-h1">Practice <em>AI.</em></h1>
        <p className="ai-hero-sub">Un co-pilote embarqué entraîné sur des milliers de tours. Il écoute la voiture, lit la route, et murmure le bon geste — chaque virage, chaque session.</p>
        <div className="hero-actions center">
          <Link to="/contact" className="btn-wh">Demander un accès early</Link>
          <a href="#demo" className="btn-gh">Voir la démo ↓</a>
        </div>

        {/* HUD */}
        <div className="hud">
          <div className="hud-bar">
            <div className="hud-item"><label>Vitesse</label><span className="hud-val">{SPEEDS[hud]}</span><span className="hud-unit">km/h</span></div>
            <div className="hud-item"><label>Rapport</label><span className="hud-val green">{GEARS[hud]}</span></div>
            <div className="hud-item"><label>Temp. pneus</label><span className="hud-val amber">{TYRES[hud]}</span><span className="hud-unit">°C</span></div>
            <div className="hud-item"><label>Delta / ref</label><span className={delta < 0 ? 'hud-val green' : 'hud-val red'}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}</span><span className="hud-unit">s</span></div>
          </div>
          <div className="pace-strip">
            <span className="chat-fab-dot" />
            <span className="pace-label">Co-pilote</span>
            <span className="pace-text" key={pace}>› <strong>"{PACE_NOTES[pace]}"</strong></span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="s-light">
        <div className="container narrow">
          <p className="eyebrow light">/// Performance</p>
          <h2 className="sh2 dark">Intelligence en temps réel,<br />pour chaque lap.</h2>
          <p className="slead dark">Practice AI n'est pas une application. C'est un système embarqué qui vit dans la voiture — formé sur les données de milliers de pilotes, adapté à votre style.</p>

          <div className="stats-row">
            <Stat n="12 000+" d="Tours analysés dans la base de données" />
            <Stat n="48" d="Circuits intégrés au système" />
            <Stat n="< 80ms" d="Latence des pace notes en direct" />
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
          <h2 className="sh2 dark">Entrez votre plaque.<br />Practice sait tout.</h2>
          <p className="slead dark">Spécifications usine, historique de service, modifications enregistrées — Practice AI charge le profil complet de votre véhicule au premier démarrage.</p>

          <div className="plate-wrapper">
            <div className="plate-header">
              <h3>Simuler un chargement de profil véhicule</h3>
              <p>Entrez n'importe quelle immatriculation pour voir ce que Practice tire automatiquement.</p>
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
                <button className="plate-btn" onClick={analyze}>Analyser →</button>
              </div>
              {vehicle && (
                <div className="plate-result show">
                  <PR k="Véhicule détecté" v={vehicle.model} />
                  <PR k="Millésime" v={vehicle.year} />
                  <PR k="Kilométrage enregistré" v={vehicle.km} />
                  <PR k="Dernière révision" v={vehicle.service} />
                  <PR k="Modifications déclarées" v={vehicle.mods} />
                  <PR k="Profil Practice AI" v="✓ Calibré automatiquement" ok />
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
          <h2 className="sh2">Pace notes,<br /><em>dans votre oreille.</em></h2>
          <p className="slead">Le système parle uniquement quand c'est utile. Calibré sur la trajectoire, la météo, la température des pneus.</p>

          <div className="demo-grid">
            <div className="demo-notes">
              <div className="demo-notes-header">
                <div className="dot-r" /><div className="dot-a" /><div className="dot-g" />
                <span>practice_ai — session live</span>
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
              <Metric label="Vitesse courante" val={`${SPEEDS[hud]} km/h`} pct={(SPEEDS[hud] / 200) * 100} color="var(--teal)" />
              <Metric label="Temp. pneus" val={`${TYRES[hud]} °C`} pct={(TYRES[hud] / 120) * 100} color="var(--amber)" />
              <Metric label="Rapport engagé" val={`${GEARS[hud]}e`} pct={(GEARS[hud] / 7) * 100} color="var(--teal)" />
              <Metric label="Delta / meilleur" val={`${delta > 0 ? '+' : ''}${delta.toFixed(1)} s`} pct={Math.abs(delta) / 0.6 * 100} color="var(--teal)" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-final">
        <div className="cta-grid-bg" />
        <div className="cta-inner">
          <h2>Réservez votre<br />accès <em>Practice AI.</em></h2>
          <p>Limité aux premiers builders. Priorité aux demandes de build slot confirmées.</p>
          <div className="cta-btns">
            <Link to="/contact" className="btn-wh">Demander un build slot</Link>
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
