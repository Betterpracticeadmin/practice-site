// ═══════════════════════════════════════════════════════════════
// PRACTICE INTELLIGENCE — on-device conversational engine.
// No API, no network, no key: the same philosophy as the car —
// the intelligence lives on board. Intent scoring over a fact
// graph + compositional generation (openers × facts × follow-ups),
// bilingual FR/EN, with conversation context memory.
// ═══════════════════════════════════════════════════════════════

const strip = (s) =>
  s.toLowerCase()
   .normalize('NFD').replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9\s€$£<>+-]/g, ' ')
   .replace(/\s+/g, ' ')
   .trim()

// ── language detection (per message, sticky per conversation) ──
const FR_MARKERS = ['bonjour','salut','le','la','les','est','quoi','quel','quelle','combien','prix','pourquoi','comment','peux','peut','avec','pour','moteur','voiture','chassis','oui','non','merci','vous','tu','je','acheter','faut','francais','une','un','des','ca','cette']
const EN_MARKERS = ['the','is','are','what','which','how','much','hello','hi','can','could','do','does','you','it','with','for','and','buy','need','want','fast','my','your','i','a','of','to']
function detectLang(msg, fallback) {
  const t = ' ' + strip(msg) + ' '
  let fr = 0, en = 0
  for (const m of FR_MARKERS) if (t.includes(' ' + m + ' ')) fr++
  for (const m of EN_MARKERS) if (t.includes(' ' + m + ' ')) en++
  if (fr > en) return 'fr'
  if (en > fr) return 'en'
  return fallback || 'en'
}

// ── the fact graph ──────────────────────────────────────────────
// Each topic: keywords (stripped, FR+EN), weight boost, and reply
// fragments per language. Fragments are composed, not replayed.
const TOPICS = [
  {
    id: 'greeting',
    kw: ['hello','hi','hey','bonjour','salut','bonsoir','yo','coucou'],
    social: true,
    en: [["Good to see you here.", "Welcome to Practice."], ["Ask me anything — the kit, the V10, the chassis, the price, or how to reserve a build slot."]],
    fr: [["Bienvenue chez Practice.", "Ravi de vous voir ici."], ["Posez-moi vos questions — le kit, le V10, le châssis, le prix, ou comment réserver un slot."]],
  },
  {
    id: 'identity',
    kw: ['who are you','what are you','qui es tu','qui est tu','tu es qui','tes qui','chatbot','claude','gpt','robot','humain','human','ia','ai you'],
    social: true,
    en: [["I'm Practice Intelligence — the same on-board philosophy that runs in the car, running right here in your browser.", "I'm the site's resident intelligence, built by the Practice team."], ["No cloud, no server: your questions never leave this page. Ask me about the machine."]],
    fr: [["Je suis Practice Intelligence — la même philosophie embarquée que dans la voiture, mais dans votre navigateur.", "Je suis l'intelligence résidente du site, construite par l'équipe Practice."], ["Pas de cloud, pas de serveur : vos questions ne quittent jamais cette page. Parlez-moi de la machine."]],
  },
  {
    id: 'price',
    kw: ['price','cost','how much','budget','expensive','cheap','euro','money','prix','coute','cout','combien','cher','tarif','80k','80000','€'],
    en: [
      ["The target kit is under €80,000 — every line of it justified.", "Count on a kit under €80,000, direct-builder pricing."],
      ["Add a donor chassis at €15–30k depending on model and condition. The signature spec (V10, 997 base, full AI) configures at about €71,000. No factory overhead, no dealer margin — you pay for the machine, not the building it was assembled in."],
    ],
    fr: [
      ["Le kit cible est sous les 80 000 € — chaque ligne justifiée.", "Comptez un kit sous 80 000 €, en prix direct-constructeur."],
      ["Ajoutez un châssis donneur à 15–30 k€ selon le modèle et l'état. La spec signature (V10, base 997, IA complète) se configure autour de 71 000 €. Pas d'usine, pas de marge concessionnaire — vous payez la machine, pas le bâtiment où elle a été assemblée."],
    ],
    followup: { en: "Try the live configurator on The Build page — the estimate settles as you choose.", fr: "Essayez le configurateur en direct sur la page The Build — l'estimation se calcule pendant que vous choisissez." },
  },
  {
    id: 'chassis',
    kw: ['chassis','donor','porsche','911','997','991','964','993','992','base','donneur','quelle base','which base','carrera'],
    en: [
      ["Two right answers: the 997 or the 991.", "The base is a Porsche 911 — and the sweet spot is the 997."],
      ["The 997 (2004–2012) is the value pick: dense used market, low acquisition cost. The 991 (2011–2019) is the best technical base — multi-link rear suspension, maximum availability. We deliberately avoid the 964/993 (air-cooled, collector value) and the 992 (still too expensive)."],
    ],
    fr: [
      ["Deux bonnes réponses : la 997 ou la 991.", "La base est une Porsche 911 — et le sweet spot, c'est la 997."],
      ["La 997 (2004–2012) est le meilleur rapport : marché de l'occasion dense, coût d'acquisition bas. La 991 (2011–2019) est la meilleure base technique — suspension arrière multibras, disponibilité maximale. On évite volontairement les 964/993 (refroidissement à air, cote collection) et la 992 (encore trop chère)."],
    ],
    followup: { en: "The monocoque and its type-approved identity are kept — that's the basis for registration.", fr: "La monocoque et son identité homologuée sont conservées — c'est la base de l'immatriculation." },
  },
  {
    id: 'powertrain',
    kw: ['engine','v10','power','hp','horsepower','rimac','motor','electric','torque','moteur','puissance','chevaux','2320','2 320','620','800v','hybrid','hybride','turbo'],
    en: [
      ["2,320 hp combined — without a single turbo.", "The signature powertrain is a weapon: 2,320 hp, all four wheels driven."],
      ["An Audi V10 FSI 5.2L — 620 naturally aspirated hp, the voice of the machine — joined by four Rimac PMSM motors on an 800V bus, torque vectored at each wheel. 0–100 km/h in under 2 seconds."],
    ],
    fr: [
      ["2 320 ch combinés — sans le moindre turbo.", "Le powertrain signature est une arme : 2 320 ch, quatre roues motrices."],
      ["Un V10 Audi FSI 5.2L — 620 ch atmosphériques, la voix de la machine — épaulé par quatre moteurs Rimac PMSM sur un bus 800V, avec vectorisation du couple à chaque roue. 0–100 km/h en moins de 2 secondes."],
    ],
    followup: { en: "Prefer it lighter and cheaper? You can keep the donor's original flat-six.", fr: "Vous le préférez plus léger et moins cher ? Vous pouvez garder le flat-six d'origine du donneur." },
  },
  {
    id: 'flatsix',
    kw: ['flat six','flat-six','flatsix','six cylinder','original engine','keep engine','moteur origine','garder le moteur','moins cher','cheaper option','sans v10'],
    en: [
      ["Yes — the V10 is the signature, not the toll gate.", "You don't have to take the V10."],
      ["Keep your donor's original Porsche flat-six: fewer parts, a simpler build, and roughly €35,000 less — while still receiving the full carbon body and Practice AI."],
    ],
    fr: [
      ["Oui — le V10 est la signature, pas un péage.", "Le V10 n'est pas obligatoire."],
      ["Gardez le flat-six Porsche d'origine de votre donneur : moins de pièces, un montage plus simple, et environ 35 000 € de moins — tout en recevant la carrosserie carbone complète et Practice AI."],
    ],
  },
  {
    id: 'ai',
    kw: ['practice ai','practice os','coach','coaching','pace notes','intelligence','telemetry','health','ota','update','copilot','co-pilot','assistant','apprend','laps','tracks','circuits','capteurs','sensors','safe','alert','critical'],
    en: [
      ["Practice AI is the voice; Practice OS is everything beneath it.", "The intelligence is resident on the car — never an app."],
      ["Real-time coaching, pace notes in your ear, and continuous health of tyres, brakes, suspension and powertrain — trained on 12,000+ laps across 48 circuits, reacting in under 80 ms. SAFE, ALERT and CRITICAL states make consequences legible without taking your authority away. It works offline, and OTA updates are part of ownership — not a subscription."],
    ],
    fr: [
      ["Practice AI est la voix ; Practice OS est tout ce qu'il y a dessous.", "L'intelligence réside dans la voiture — jamais une app."],
      ["Coaching en temps réel, pace notes dans l'oreille, et santé continue des pneus, freins, suspensions et powertrain — entraînée sur plus de 12 000 tours sur 48 circuits, avec une réaction sous les 80 ms. Les états SAFE, ALERT et CRITICAL rendent les conséquences lisibles sans jamais retirer l'autorité au pilote. Ça marche hors-ligne, et les mises à jour OTA font partie de la propriété — pas d'un abonnement."],
    ],
    followup: { en: "You can boot the real OS live on the Practice AI page — it's the product, not a rendering of one.", fr: "Vous pouvez booter le vrai OS en direct sur la page Practice AI — c'est le produit, pas un rendu." },
  },
  {
    id: 'build',
    kw: ['build','assembly','assemble','steps','manual','mechanic','garage','difficult','hard','skills','montage','monter','etapes','mecanicien','difficile','competence','outils','tools','construire'],
    en: [
      ["Seven steps, at your own pace, in your garage.", "The build is demanding by design — not by accident."],
      ["Configure, chassis, kit delivery, assembly, commissioning, Practice AI calibration, first start. You don't need to be a professional mechanic — every part is numbered, the engineering manual is written to be followed, and remote technical support is included. No workshop owns your timeline."],
    ],
    fr: [
      ["Sept étapes, à votre rythme, dans votre garage.", "Le montage est exigeant par conception — pas par accident."],
      ["Configuration, châssis, livraison du kit, assemblage, mise en service, calibration de Practice AI, premier démarrage. Pas besoin d'être mécanicien professionnel — chaque pièce est numérotée, le manuel d'ingénierie est écrit pour être suivi, et le support technique à distance est inclus. Aucun atelier ne possède votre calendrier."],
    ],
  },
  {
    id: 'cohort',
    kw: ['cohort','slot','reserve','book','order','buy','waiting list','achete','acheter','reserver','commander','slots','cohorte','numero','numbered','disponible','available','quand','when available','delivery','livraison'],
    en: [
      ["Cohort 1 is numbered and closing — 8 of 11 slots are reserved.", "There are 11 numbered kits in Cohort 1. Eight are already spoken for."],
      ["Every kit carries a number; when they're allocated, the cohort closes. You deal directly with the Betterstate team — request a build slot on the Contact page and we reply within 48 hours."],
    ],
    fr: [
      ["La Cohorte 1 est numérotée et se referme — 8 slots sur 11 sont réservés.", "Il y a 11 kits numérotés dans la Cohorte 1. Huit sont déjà pris."],
      ["Chaque kit porte un numéro ; une fois alloués, la cohorte ferme. Vous traitez directement avec l'équipe Betterstate — demandez un slot sur la page Contact, réponse sous 48 h."],
    ],
    followup: { en: "The first cars are built once. After that, they are only rebuilt.", fr: "Les premières voitures ne se construisent qu'une fois. Ensuite, elles ne peuvent qu'être re-construites." },
  },
  {
    id: 'legal',
    kw: ['legal','road','homologation','register','registration','law','street','immatriculation','homologuer','legale','legal en france','route','carte grise','tuv'],
    en: [
      ["That's exactly the right question — and it's why we keep the donor's identity.", "Road legality rests on the donor."],
      ["The 911's monocoque and its type-approved identity are retained, which is the basis for registration. Final homologation depends on your country's kit-car and individual-approval rules — we guide you through the paperwork as part of the build."],
    ],
    fr: [
      ["C'est exactement la bonne question — et c'est pour ça qu'on garde l'identité du donneur.", "La légalité route repose sur le donneur."],
      ["La monocoque de la 911 et son identité homologuée sont conservées : c'est la base de l'immatriculation. L'homologation finale dépend des règles kit-car de votre pays (réception à titre isolé en France) — on vous guide dans les démarches pendant le build."],
    ],
  },
  {
    id: 'company',
    kw: ['betterstate','company','team','who makes','societe','entreprise','equipe','qui fabrique','derriere','behind'],
    en: [
      ["Practice is a Betterstate venture.", "Behind Practice is Betterstate."],
      ["It's built on an unfashionable belief: that the people who own machines should understand them. You deal with the people who designed the kit and trained the AI — no dealer network in between."],
    ],
    fr: [
      ["Practice est un projet Betterstate.", "Derrière Practice, il y a Betterstate."],
      ["Construit sur une conviction démodée : ceux qui possèdent des machines devraient les comprendre. Vous traitez avec ceux qui ont conçu le kit et entraîné l'IA — aucun réseau de concessionnaires entre vous et nous."],
    ],
  },
  {
    id: 'contact',
    kw: ['contact','email','mail','phone','reach','write','joindre','ecrire','contacter','adresse','courriel'],
    en: [
      ["Two doors, both direct.", "Easy."],
      ["The Contact page reserves a build slot (we reply within 48 hours), or write to Better-practice-@outlook.fr. Your details are never shared."],
    ],
    fr: [
      ["Deux portes, toutes les deux directes.", "Facile."],
      ["La page Contact réserve un slot de build (réponse sous 48 h), ou écrivez à Better-practice-@outlook.fr. Vos données ne sont jamais partagées."],
    ],
  },
  {
    id: 'performance',
    kw: ['fast','speed','0-100','acceleration','top speed','vmax','vitesse','rapide','accelere','performance','sprint','quick'],
    en: [
      ["Under 2 seconds to 100 km/h.", "Quick enough that the co-pilot matters."],
      ["Instant electric torque from the four Rimac motors, the V10 on top, AWD torque vectoring and single-speed direct drive. The full system makes 2,320 hp — and Practice AI keeps every one of them legible."],
    ],
    fr: [
      ["Moins de 2 secondes au 0–100 km/h.", "Assez rapide pour que le co-pilote compte."],
      ["Couple électrique instantané des quatre moteurs Rimac, le V10 par-dessus, vectorisation AWD et transmission directe. Le système complet développe 2 320 ch — et Practice AI les garde tous lisibles."],
    ],
  },
  {
    id: 'thanks',
    kw: ['thanks','thank you','merci','super','parfait','great','cool','genial','top','nice'],
    social: true,
    en: [["My pleasure.", "Anytime."], ["If you want to go further, the configurator on The Build page is the best next step."]],
    fr: [["Avec plaisir.", "Quand vous voulez."], ["Pour aller plus loin, le configurateur sur la page The Build est la meilleure étape suivante."]],
  },
  {
    id: 'bye',
    kw: ['bye','goodbye','see you','au revoir','a plus','ciao','bonne journee'],
    social: true,
    en: [["Until next time.", "See you on the road."], ["The machine will be here when you come back."]],
    fr: [["À la prochaine.", "On se retrouve sur la route."], ["La machine sera là quand vous reviendrez."]],
  },
]

const FALLBACK = {
  en: [
    ["Good question — let me be straight: that's beyond what I hold on board.", "That one is outside my on-board knowledge."],
    ["I can tell you everything about the kit, the V10 and Rimac powertrain, the 997/991 donor, the price, Practice AI, the seven build steps, or Cohort 1. For anything else, the team answers directly via the Contact page — within 48 hours."],
  ],
  fr: [
    ["Bonne question — je préfère être direct : ça dépasse ce que j'ai à bord.", "Celle-là sort de ma connaissance embarquée."],
    ["Je peux tout vous dire sur le kit, le powertrain V10 + Rimac, le donneur 997/991, le prix, Practice AI, les sept étapes du build, ou la Cohorte 1. Pour le reste, l'équipe répond en direct via la page Contact — sous 48 h."],
  ],
}

// ── scoring ─────────────────────────────────────────────────────
function scoreTopics(msg) {
  const t = ' ' + strip(msg) + ' '
  const scores = []
  for (const topic of TOPICS) {
    let s = 0
    for (const kw of topic.kw) {
      if (t.includes(' ' + kw + ' ') || (kw.length > 5 && t.includes(kw))) s += kw.includes(' ') ? 3 : 2
    }
    if (s > 0) scores.push({ topic, s })
  }
  scores.sort((a, b) => b.s - a.s)
  return scores
}

// ── generation ──────────────────────────────────────────────────
let turn = 0
export function createBrain() {
  let lang = 'en'
  let lastTopicId = null

  const pick = (arr) => arr[(turn + arr.length) % arr.length]

  function compose(topic, l, { withFollowup = true } = {}) {
    const frags = topic[l]
    const opener = pick(frags[0])
    const body = frags[1] ? pick([frags[1]].flat()) : ''
    let out = opener + (body ? ' ' + body : '')
    if (withFollowup && topic.followup && turn % 2 === 0) out += '\n\n' + topic.followup[l]
    return out
  }

  function reply(message) {
    turn++
    lang = detectLang(message, lang)
    const scored = scoreTopics(message)

    // contextual short follow-up ("and the price?", "combien ?")
    if (scored.length === 0 && lastTopicId) {
      const t = strip(message)
      if (t.split(' ').length <= 3 && /(price|much|combien|prix|why|pourquoi|how|comment)/.test(t)) {
        const priceTopic = TOPICS.find((x) => x.id === 'price')
        lastTopicId = 'price'
        return compose(priceTopic, lang)
      }
    }

    if (scored.length === 0) {
      lastTopicId = null
      return pick(FALLBACK[lang][0]) + ' ' + pick([FALLBACK[lang][1]].flat())
    }

    const primary = scored[0].topic
    lastTopicId = primary.id

    // combine a second topic when it scored a solid keyword hit
    // (real questions often span two subjects: "legal AND fast?")
    const second = scored[1] && !scored[1].topic.social && !primary.social && scored[1].topic.id !== primary.id && scored[1].s >= 2
      ? scored[1].topic : null

    let out = compose(primary, lang, { withFollowup: !second })
    if (second) {
      lastTopicId = second.id
      out += '\n\n' + compose(second, lang, { withFollowup: false })
    }
    return out
  }

  return { reply, getLang: () => lang }
}
