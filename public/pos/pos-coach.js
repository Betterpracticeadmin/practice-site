/* ============================================================================
   PracticeOS — POS Coach (« Practice IA »)
   ----------------------------------------------------------------------------
   PHILOSOPHIE (inspirée Comma AI / OpenPilot) : PracticeOS NE CONDUIT PAS.
   Practice IA est un COACH : il observe la télémétrie en temps réel, analyse le
   style de conduite sur des fenêtres glissantes (~3-8 s) et donne des
   conseils bienveillants en français. Jamais de malus, ton toujours positif.

   ANALYSE :
     • accélération longitudinale (dérivée de spd) + jerk (dérivée de l'accel)
     • freinages brusques (< -3,5 m/s²) vs progressifs
     • accélérations brutales (> 3 m/s²)
     • virages : accel latérale ≈ v (m/s) × vitesse de lacet (dérivée du cap)
     • anticipation : gros freinage juste après du plein gaz
     • rapport tardif : rpm > 3000 soutenu en accélération douce (boîte manuelle)
     • éco-conduite : régime élevé stabilisé, débit carburant si dispo
     • fluidité : variance du jerk et du volant sur la fenêtre

   APPRENTISSAGE PAR CONDUCTEUR (via POS.store → namespacé par profil) :
     • compteurs d'événements, distance/temps, historique 30 sessions
     • niveau de conduite 0-100 en EMA (monte quand les fenêtres sont propres)
     • adaptation : niveau haut → seuils plus fins, conseils plus rares et
       plus pointus, plus de félicitations ; niveau bas → l'inverse
     • habitudes : heures de conduite, profil moyen d'accélération/freinage

   API PUBLIQUE (POS.registry.get('coach')) :
     setEnabled(bool)  — active/désactive le coach (persisté 'coach:on')
     enabled()         — état courant
     level()           — niveau de conduite 0-100 du conducteur actif
     stats()           — copie des statistiques d'apprentissage + session
     tripSummary()     — texte français de bilan du trajet en cours
     resetLearning()   — remise à zéro de l'apprentissage du conducteur
     destroy()         — retire listeners + tâche de boucle (anti-fuite)

   ÉVÉNEMENTS :
     écoute : 'telemetry', 'vehicle:identified', 'driver:changed',
              'obd:pid', 'pos:demo'
     émet   : 'coach:advice' {text, kind, severity}
              kind ∈ 'brake'|'accel'|'corner'|'gear'|'eco'|'anticipation'|'praise'
              severity ∈ 0..2 (2 = le plus important)

   ANTI-SPAM : cooldown ≥ 45 s par type, ≥ 20 s global, max ~2 conseils/min,
   priorité aux sévérités hautes (un candidat plus grave remplace l'attente).

   Dépend uniquement de pos-core.js (chargé avant). IIFE ES2017, sans build.
   ============================================================================ */
(function () {
  'use strict';

  /* ---------- constantes d'analyse ---------------------------------------- */
  var BUF_MS        = 10000;   // fenêtre glissante conservée (10 s)
  var WIN_MS        = 30000;   // fenêtre d'évaluation « propre » (30 s)
  var SESSION_GAP   = 20 * 60000; // trou > 20 min ⇒ nouvelle session
  var HIST_MAX      = 30;      // historique de sessions conservé
  var CAND_TTL      = 12000;   // durée de vie d'un conseil candidat (ms)
  var PRAISE_GAP    = 240000;  // ≥ 4 min entre deux félicitations

  /* ---------- phrases (les 1res de chaque liste = EXACTES de la spec) ----- */
  var PHRASES = {
    brake: [
      'Tu peux freiner un peu plus progressivement.',
      'Essaie d’anticiper un peu pour freiner plus en douceur.',
      'Freinage un peu appuyé — commence à ralentir légèrement plus tôt.'
    ],
    corner: [
      'Tu peux entrer un peu plus large dans ce virage.',
      'Ralentis un peu plus avant le virage, tu ressortiras plus fluide.',
      'Entrée de virage un peu rapide — lisse ta trajectoire, freine avant, pas dedans.'
    ],
    accel: [
      'Tu peux accélérer légèrement plus tôt.',
      'Vas-y un peu plus en douceur sur l’accélérateur.',
      'Accélération un peu vive — dose progressivement, c’est plus efficace.'
    ],
    anticipation: [
      'Tu peux accélérer légèrement plus tôt.',
      'Essaie de lever le pied un peu plus tôt plutôt que de freiner fort.',
      'Plein gaz puis gros freinage — anticipe un peu plus loin devant.'
    ],
    gear: [
      'Ton changement de vitesse est un peu tardif.',
      'Tu peux passer le rapport supérieur un peu plus tôt.',
      'Le moteur monte un peu haut — passe la vitesse suivante dès que tu peux.'
    ],
    eco: [
      'Tu pourrais économiser du carburant.',
      'Régime un peu élevé pour une allure stable — un rapport au-dessus consommerait moins.',
      'Lève légèrement le pied, la consommation te dira merci.'
    ],
    praise: [
      'Très fluide depuis quelques minutes. Continue comme ça.',
      'Belle conduite, souple et régulière.',
      'Super anticipation depuis tout à l’heure, ça se sent.'
    ]
  };

  var U = null; // POS.util (rempli au boot)

  /* ---------- état runtime ------------------------------------------------- */
  var isOn = true;
  var demoOn = false;
  var vehicle = null;     // dernier véhicule identifié (pour la boîte manuelle)
  var fuelRate = null;    // débit carburant L/h si un PID le fournit
  var offFns = [];        // désabonnements bus (anti-fuite)
  var removeLoop = null;  // retrait de la tâche POS.loop

  var buf = [];           // échantillons dérivés {t,v,a,j,lat,rpm,thr,steer}
  var prev = null;        // échantillon précédent (pour les dérivées)

  /* épisodes en cours (une détection = un événement par épisode) */
  var epBrake = 0, epAccel = 0, epCorner = 0, epGear = 0, epEco = 0;
  var lastFullThrottle = 0;

  /* anti-spam + félicitations */
  var kindLast = {};      // kind -> dernier conseil émis (ms)
  var lastAdviceAt = 0;
  var recentAdvices = []; // timestamps < 60 s
  var pending = null;     // meilleur candidat {kind, sev, at}
  var lastEventAt = 0;    // dernier « défaut » détecté
  var lastPraiseAt = 0;

  /* fenêtre « propre » de 30 s (fluidité + progression du niveau) */
  var winStart = 0, winEvents = 0, winMoveS = 0;
  var winJerkN = 0, winJerkSum = 0, winJerkSq = 0;
  var winSteerN = 0, winSteerSum = 0, winSteerSq = 0;

  /* apprentissage + session */
  var learn = null;
  var sess = null;
  var lastTeleAt = 0;
  var lastHourMark = 0;

  /* ---------- petits utilitaires ------------------------------------------- */
  function num(v) { var n = +v; return isFinite(n) ? n : 0; }
  function wrap180(d) { return ((d + 180) % 360 + 360) % 360 - 180; }
  function variance(sum, sq, n) {
    if (n < 2) return 0;
    var m = sum / n; return Math.max(0, sq / n - m * m);
  }

  /* ---------- apprentissage (POS.store = déjà par conducteur) -------------- */
  function freshLearn() {
    var hours = []; for (var i = 0; i < 24; i++) hours.push(0);
    return {
      level: 50, // niveau de départ neutre
      counts: { brake: 0, accel: 0, corner: 0, gear: 0, eco: 0, anticipation: 0, praise: 0 },
      sessions: [], // 30 dernières : {start,end,distM,durS,advices,clean}
      habits: { hours: hours, accelAvg: 0, brakeAvg: 0, n: 0 }
    };
  }

  function loadLearn() {
    var l = POS.store.get('coach:learn', null);
    if (!l || typeof l !== 'object' || !l.counts || !l.habits) l = freshLearn();
    l.level = U.clamp(num(l.level), 0, 100);
    if (!Array.isArray(l.sessions)) l.sessions = [];
    if (!Array.isArray(l.habits.hours) || l.habits.hours.length !== 24) {
      l.habits.hours = freshLearn().habits.hours;
    }
    learn = l;
    isOn = POS.store.get('coach:on', true) !== false;
  }

  function saveLearn() { if (learn) POS.store.set('coach:learn', learn); }
  var saveLearnSlow = null; // throttlé au boot (écriture localStorage espacée)

  /* ---------- adaptation au niveau -----------------------------------------
     k = niveau/100. Niveau haut → seuils plus fins (détecte plus subtil) mais
     conseils plus rares (cooldowns longs, 1/min) et félicitations plus
     fréquentes. Niveau bas → seuils larges, conseils plus fréquents.        */
  function tune() {
    var k = U.clamp(learn ? learn.level : 50, 0, 100) / 100;
    return {
      brake:    U.lerp(4.0, 3.1, k),   // m/s² (base spec 3,5)
      accel:    U.lerp(3.4, 2.6, k),   // m/s² (base spec 3,0)
      lat:      U.lerp(3.9, 3.1, k),   // m/s² (base spec 3,5)
      kindCd:   U.lerp(45000, 90000, k), // ≥ 45 s par type
      globalCd: U.lerp(20000, 32000, k), // ≥ 20 s global
      perMin:   k > 0.7 ? 1 : 2,         // max ~2/min
      praiseWin: U.lerp(180000, 120000, k) // fenêtre propre avant félicitation
    };
  }

  /* choisit une phrase : niveau bas → phrases simples (début de liste),
     niveau haut → tout le répertoire (variantes plus pointues)             */
  function pickText(kind) {
    var pool = PHRASES[kind] || PHRASES.accel;
    var n = (learn && learn.level < 40) ? Math.min(2, pool.length) : pool.length;
    return pool[Math.floor(Math.random() * n)];
  }

  /* ---------- émission des conseils (anti-spam + priorité) ----------------- */
  function suggest(kind, sev, now) {
    if (kind !== 'praise') {
      lastEventAt = now;
      winEvents++;
      if (!demoOn && learn) {
        learn.counts[kind] = (learn.counts[kind] || 0) + 1;
        if (sess) sess.events[kind] = (sess.events[kind] || 0) + 1;
        /* EMA vers le bas, douce et proportionnelle à la sévérité */
        learn.level = U.clamp(learn.level + 0.05 * (1 + sev) * (0 - learn.level) * 0.5, 0, 100);
        saveLearnSlow();
      }
    }
    if (!isOn) return;
    /* le candidat le plus sévère gagne la place d'attente */
    if (!pending || sev > pending.sev) pending = { kind: kind, sev: sev, at: now };
  }

  function tryEmit(now) {
    if (!pending) return;
    if (now - pending.at > CAND_TTL) { pending = null; return; } // périmé
    var T = tune();
    if (now - lastAdviceAt < T.globalCd) return;                 // ≥ 20 s global
    if (now - (kindLast[pending.kind] || 0) < T.kindCd) return;  // ≥ 45 s / type
    recentAdvices = recentAdvices.filter(function (ts) { return now - ts < 60000; });
    if (recentAdvices.length >= T.perMin) return;                // max ~2/min

    var adv = { text: pickText(pending.kind), kind: pending.kind, severity: pending.sev };
    kindLast[pending.kind] = now;
    lastAdviceAt = now;
    recentAdvices.push(now);
    if (sess) sess.advices++;
    if (pending.kind === 'praise') {
      lastPraiseAt = now;
      if (!demoOn && learn) { learn.counts.praise++; saveLearnSlow(); }
    }
    pending = null;
    POS.bus.emit('coach:advice', adv);
  }

  /* ---------- sessions ------------------------------------------------------ */
  function startSession(now) {
    sess = { start: now, end: now, distM: 0, durS: 0, moveS: 0, advices: 0, clean: 0, events: {} };
    winStart = now; winEvents = 0; winMoveS = 0;
    winJerkN = winJerkSum = winJerkSq = 0;
    winSteerN = winSteerSum = winSteerSq = 0;
  }

  function endSession(now) {
    if (!sess || !learn) { sess = null; return; }
    sess.end = now;
    if (!demoOn && sess.durS > 60) { // on n'archive pas les micro-sessions ni la démo
      learn.sessions.push({
        start: sess.start, end: sess.end,
        distM: Math.round(sess.distM), durS: Math.round(sess.durS),
        advices: sess.advices, clean: sess.clean, events: sess.events,
        level: Math.round(learn.level)
      });
      while (learn.sessions.length > HIST_MAX) learn.sessions.shift();
      saveLearn();
    }
    sess = null;
    prev = null; buf = []; pending = null;
  }

  /* ---------- télémétrie ----------------------------------------------------
     NB : on horodate avec Date.now() (source unique et sûre pour cooldowns,
     sessions ET dérivées) ; le champ d.t du bus n'est pas garanti epoch.   */
  function onTelemetry(d) {
    if (!d) return;
    var now = Date.now();
    if (lastTeleAt && now - lastTeleAt > SESSION_GAP) endSession(lastTeleAt);
    if (!sess) startSession(now);
    lastTeleAt = now;

    var v = Math.max(0, num(d.spd)) / 3.6; // km/h → m/s
    var s = {
      t: now, v: v, rpm: num(d.rpm), thr: num(d.throttle),
      steer: num(d.steer), heading: (d.heading == null ? null : num(d.heading)),
      a: 0, j: 0, lat: 0
    };

    if (prev) {
      var dt = (now - prev.t) / 1000;
      if (dt <= 0.02 || dt > 3) { prev = s; return; } // trou ou doublon : on repart
      /* accel lissée (EMA ~250 ms) puis jerk sur l'accel lissée */
      var rawA = (v - prev.v) / dt;
      var kA = Math.min(1, dt * 4);
      s.a = prev.a + (rawA - prev.a) * kA;
      s.j = (s.a - prev.a) / dt;
      /* accel latérale ≈ v × vitesse de lacet (cap en degrés → rad/s) */
      if (s.heading != null && prev.heading != null) {
        var yaw = wrap180(s.heading - prev.heading) * Math.PI / 180 / dt;
        var rawLat = Math.abs(v * yaw);
        s.lat = prev.lat + (rawLat - prev.lat) * kA; // même lissage
      }

      /* --- cumuls session + habitudes ---------------------------------- */
      sess.durS += dt;
      sess.distM += v * dt;
      if (v > 1) {
        sess.moveS += dt; winMoveS += dt;
        if (!demoOn && learn) {
          if (now - lastHourMark > 60000) { // 1 tick d'habitude horaire / min
            lastHourMark = now;
            learn.habits.hours[new Date().getHours()]++;
          }
          /* profil moyen accélération / freinage (EMA très lente) */
          if (s.a > 0.3) learn.habits.accelAvg += 0.002 * (s.a - learn.habits.accelAvg);
          if (s.a < -0.3) learn.habits.brakeAvg += 0.002 * (-s.a - learn.habits.brakeAvg);
          learn.habits.n++;
        }
      }
      /* accumulateurs de fluidité (fenêtre 30 s) */
      winJerkN++; winJerkSum += s.j; winJerkSq += s.j * s.j;
      winSteerN++; winSteerSum += s.steer; winSteerSq += s.steer * s.steer;

      detect(s, now);
    }

    prev = s;
    buf.push(s);
    while (buf.length && now - buf[0].t > BUF_MS) buf.shift();
    if (!demoOn) saveLearnSlow();
  }

  /* ---------- détection des événements (par épisode, avec durée mini) ------ */
  function detect(s, now) {
    var T = tune();

    /* mémoire plein gaz (pour l'anticipation) */
    if (s.thr > 85) lastFullThrottle = now;

    /* freinage brusque : décélération soutenue ≥ 0,25 s en roulant */
    if (s.a < -T.brake && s.v > 3) {
      if (!epBrake) epBrake = now;
      else if (now - epBrake > 250 && epBrake > 0) {
        var sev = s.a < -(T.brake + 1.5) ? 2 : 1;
        /* anticipation tardive : gros freinage < 4 s après du plein gaz */
        if (now - lastFullThrottle < 4000) suggest('anticipation', 2, now);
        else suggest('brake', sev, now);
        epBrake = -1; // épisode consommé (relâché quand l'accel remonte)
      }
    } else if (s.a > -2) epBrake = 0;

    /* accélération brutale soutenue ≥ 0,25 s */
    if (s.a > T.accel && s.v > 1) {
      if (!epAccel) epAccel = now;
      else if (now - epAccel > 250 && epAccel > 0) {
        suggest('accel', s.a > T.accel + 1.5 ? 2 : 1, now);
        epAccel = -1;
      }
    } else if (s.a < 1.5) epAccel = 0;

    /* entrée de virage trop rapide : accel latérale soutenue ≥ 0,3 s */
    if (s.lat > T.lat && s.v > 8) {
      if (!epCorner) epCorner = now;
      else if (now - epCorner > 300 && epCorner > 0) {
        suggest('corner', s.lat > T.lat + 1.2 ? 2 : 1, now);
        epCorner = -1;
      }
    } else if (s.lat < T.lat * 0.7) epCorner = 0;

    /* rapport tardif : boîte manuelle, rpm > 3000 soutenu ≥ 3 s en
       accélération douce (on tire le rapport sans raison sportive)        */
    var manual = vehicle && vehicle.transmission && vehicle.transmission.type === 'manuelle';
    if (manual && s.rpm > 3000 && s.a > 0 && s.a < 1.5 && s.thr < 45 && s.v > 2) {
      if (!epGear) epGear = now;
      else if (now - epGear > 3000 && epGear > 0) { suggest('gear', 1, now); epGear = -1; }
    } else if (!manual || s.rpm < 2800 || s.a >= 1.5) epGear = 0;

    /* éco-conduite : régime élevé STABILISÉ ≥ 8 s (croisière qui consomme),
       renforcé par un débit carburant élevé si un PID le fournit          */
    var rpmHi = s.rpm > 2600 && Math.abs(s.a) < 0.8 && s.v > 8;
    if (rpmHi || (fuelRate != null && fuelRate > 12 && s.v > 12 && Math.abs(s.a) < 0.8)) {
      if (!epEco) epEco = now;
      else if (now - epEco > 8000 && epEco > 0) { suggest('eco', 0, now); epEco = -1; }
    } else epEco = 0;
  }

  /* ---------- tâche périodique (POS.loop, 2 Hz, prio confort) -------------- */
  function tick() {
    var now = Date.now();
    tryEmit(now);
    if (!sess) return;

    /* clôture d'une fenêtre de 30 s : fluide et sans défaut = « propre »   */
    if (now - winStart >= WIN_MS) {
      var jerkVar = variance(winJerkSum, winJerkSq, winJerkN);
      var steerVar = variance(winSteerSum, winSteerSq, winSteerN);
      var driving = winMoveS > WIN_MS / 2000; // a roulé plus de la moitié du temps
      if (driving && winEvents === 0 && jerkVar < 2.25 && steerVar < 900) {
        sess.clean++;
        if (!demoOn && learn) { // EMA vers 100 quand la fenêtre est propre
          learn.level = U.clamp(learn.level + 0.05 * (100 - learn.level), 0, 100);
          saveLearnSlow();
        }
      }
      winStart = now; winEvents = 0; winMoveS = 0;
      winJerkN = winJerkSum = winJerkSq = 0;
      winSteerN = winSteerSum = winSteerSq = 0;
    }

    /* félicitations : 2-3 min de conduite sans défaut, en roulant           */
    var T = tune();
    var since = Math.max(lastEventAt, sess.start);
    var moving = prev && prev.v > 5 && now - lastTeleAt < 3000;
    if (moving && sess.moveS > 90 && now - since > T.praiseWin && now - lastPraiseAt > PRAISE_GAP) {
      suggest('praise', 0, now);
      lastPraiseAt = now; // évite de re-proposer en boucle si l'émission attend
    }
  }

  /* ---------- API publique --------------------------------------------------- */
  var api = {
    setEnabled: function (b) {
      isOn = !!b;
      POS.store.set('coach:on', isOn);
      if (!isOn) pending = null;
      return isOn;
    },
    enabled: function () { return isOn; },
    level: function () { return learn ? Math.round(learn.level) : 50; },
    stats: function () {
      return {
        level: learn ? Math.round(learn.level) : 50,
        counts: learn ? JSON.parse(JSON.stringify(learn.counts)) : {},
        habits: learn ? JSON.parse(JSON.stringify(learn.habits)) : {},
        sessions: learn ? learn.sessions.slice() : [],
        session: sess ? {
          distM: Math.round(sess.distM), durS: Math.round(sess.durS),
          advices: sess.advices, clean: sess.clean,
          events: JSON.parse(JSON.stringify(sess.events))
        } : null
      };
    },
    /* bilan de trajet en français, toujours positif */
    tripSummary: function () {
      if (!sess || sess.durS < 5) return 'Pas encore de trajet à analyser. En route quand tu veux !';
      var km = sess.distM / 1000;
      var min = Math.max(1, Math.round(sess.durS / 60));
      var nEv = 0, kMax = null, vMax = 0, k;
      for (k in sess.events) {
        nEv += sess.events[k];
        if (sess.events[k] > vMax) { vMax = sess.events[k]; kMax = k; }
      }
      var names = { brake: 'le freinage', accel: 'l’accélération', corner: 'les virages', gear: 'les rapports', eco: 'l’éco-conduite', anticipation: 'l’anticipation' };
      var txt = 'Bilan du trajet : ' + U.num(km, km < 10 ? 1 : 0) + ' km en ' + min + ' min. ';
      if (nEv === 0) txt += 'Conduite très fluide du début à la fin, bravo !';
      else {
        txt += nEv + ' point' + (nEv > 1 ? 's' : '') + ' d’attention, surtout sur ' + (names[kMax] || kMax) + '. Rien de grave : ça se travaille, et tu progresses.';
      }
      txt += ' Niveau de conduite : ' + api.level() + '/100.';
      return txt;
    },
    resetLearning: function () {
      learn = freshLearn();
      saveLearn();
      if (sess) { sess.events = {}; sess.advices = 0; sess.clean = 0; }
      return true;
    },
    destroy: function () {
      offFns.forEach(function (f) { try { f(); } catch (e) {} });
      offFns = [];
      if (removeLoop) { removeLoop(); removeLoop = null; }
      saveLearn();
    }
  };

  /* ---------- boot ------------------------------------------------------------ */
  function boot() {
    U = POS.util;
    saveLearnSlow = U.throttle(saveLearn, 15000);
    loadLearn();

    offFns.push(POS.bus.on('telemetry', onTelemetry));
    offFns.push(POS.bus.on('vehicle:identified', function (d) {
      vehicle = d && d.vehicle ? d.vehicle : null;
    }));
    offFns.push(POS.bus.on('obd:pid', function (d) {
      /* on ne retient que les PID de débit carburant (L/h) */
      if (d && d.name && /fuel/i.test(d.name) && /rate|flow|conso/i.test(d.name)) {
        fuelRate = num(d.value);
      }
    }));
    offFns.push(POS.bus.on('pos:demo', function (d) { demoOn = !!(d && d.on); }));
    offFns.push(POS.bus.on('driver:changed', function () {
      /* le store est déjà re-namespacé : on recharge SANS sauver l'ancien
         (une sauvegarde ici écrirait dans le profil du nouveau conducteur) */
      sess = null; prev = null; buf = []; pending = null;
      lastTeleAt = 0; lastEventAt = 0; lastPraiseAt = 0;
      kindLast = {}; recentAdvices = []; lastAdviceAt = 0;
      loadLearn();
    }));

    /* analyse périodique : 2 Hz suffit, priorité confort (0)               */
    removeLoop = POS.loop.add(tick, 2, 0);

    /* sauvegarde de secours quand la page se cache (iOS/WKWebView)         */
    window.addEventListener('pagehide', saveLearn);
    offFns.push(function () { window.removeEventListener('pagehide', saveLearn); });

    POS.registry.register('coach', api);
  }

  POS.ready(boot);
})();
