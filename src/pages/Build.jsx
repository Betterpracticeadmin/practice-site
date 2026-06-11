import { Link } from 'react-router-dom'

const steps = [
  ['01', 'Configurer', "Choisissez la spec, les options et la finition en ligne : châssis donor, motorisation (V10 signature ou flat-six d'origine), niveau Practice AI, options carbone."],
  ['02', 'Châssis', 'Porsche 911 fourni par vos soins ou sourcé via Practice. Contrôle technique et validation de la base avant la livraison du kit.'],
  ['03', 'Livraison du kit', "Kit complet, chaque pièce numérotée, accompagné d'un plan d'assemblage détaillé : carrosserie carbone, groupe motopropulseur, électronique."],
  ['04', 'Assemblage', 'Manuel d\'ingénierie étape par étape, support technique disponible. Vous construisez à votre rythme, dans votre garage.'],
  ['05', 'Mise en service', 'Chaque système est vérifié aux spécifications. Première mise en route assistée par Practice.'],
  ['06', 'Practice AI', "Installation et calibration de l'IA embarquée sur votre véhicule. Profil chargé, co-pilote activé."],
  ['07', 'Premier démarrage', 'Votre voiture. Construite de vos mains. Guidée par votre intelligence.'],
]

export default function Build() {
  return (
    <>
      <section className="build-hero">
        <p className="eyebrow">/// Le processus de build</p>
        <h1>Sept étapes vers<br /><em>votre machine.</em></h1>
        <p>Un parcours clair, du premier clic de configuration jusqu'au premier démarrage. À votre rythme, accompagné à chaque étape.</p>
      </section>

      <section className="build-section">
        <div className="build-list">
          {steps.map(([num, title, desc]) => (
            <div className="build-step" key={num}>
              <div className="build-step-num">{num}</div>
              <div>
                <div className="build-step-k">Étape {num}</div>
                <div className="build-step-t">{title}</div>
                <div className="build-step-d">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-final">
        <div className="cta-inner">
          <h2>Prêt à <em>construire ?</em></h2>
          <p>Les slots de la cohorte 1 sont limités. Réservez le vôtre et démarrez l'étape 01.</p>
          <div className="cta-btns">
            <Link to="/contact" className="btn-wh">Demander un build slot</Link>
            <Link to="/practice-ai" className="btn-gh">Découvrir Practice AI</Link>
          </div>
        </div>
      </section>
    </>
  )
}
