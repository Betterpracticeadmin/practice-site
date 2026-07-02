/* ============================================================================
   PracticeOS — POS Telemetry (HUB TÉLÉMÉTRIE)
   ----------------------------------------------------------------------------
   Fusionne TOUTES les sources de données (OBD réel, GPS, simulateur de démo)
   en UN seul flux 'telemetry' unifié, lissé et régulier (20 Hz).
   C'est la SEULE source de vérité pour le coach, la 3D et l'UI.

   Priorité des sources (par champ, la plus fraîche et la plus fiable gagne) :
     1. OBD  — écoute 'obd:pid'   (spd, rpm, throttle, coolant, fuel, batt…)
     2. GPS  — écoute 'gps:fix'   (lat, lon, heading, vitesse de secours)
     3. DÉMO — simulateur physique interne (cycle de conduite ~4 min bouclé)

   Champs manquants ESTIMÉS (marqués 'est' dans frame.src) :
     • brake  — décélération > 1.2 m/s² sans papillon
     • steer  — dérivée du heading GPS × empattement (modèle bicyclette)
     • gear   — ratio rpm/vitesse comparé aux rapports plausibles du véhicule
     • wheels — vitesse commune ± différentiel en virage (steer + voie)

   Émission : frame complète à 20 Hz via POS.loop.add(fn, 20, 1),
   UNIQUEMENT si au moins une source est active (sinon la tâche est retirée
   de la boucle : zéro coût). Lissage léger (lerp) pour éviter les sauts.

   frame = { t, spd, rpm, throttle, brake, steer, gear, fuel, coolant, batt,
             wheels:[fl,fr,rl,rr], lat, lon, heading,
             src:{ spd:'obd'|'gps'|'demo'|'est'|null, ... } }
   (spd km/h, rpm tr/min, throttle/brake 0..100, steer ° volant, batt V)

   API publique (POS.registry.register('telemetry', api)) :
     • last()      — dernière frame émise (ou null)
     • active()    — bool : au moins une source active ?
     • demo(on)    — active/coupe le simulateur (émet 'pos:demo' si changement)
     • sources()   — état de chaque source {obd,gps,demo:{active,...}}
     • destroy()   — retire listeners + tâche de boucle (aucune fuite)

   Événements écoutés : 'obd:pid', 'obd:status', 'gps:fix',
                        'vehicle:identified', 'pos:demo'
   Événements émis    : 'telemetry', 'pos:demo' (si demo() change l'état)
   Dépend uniquement de pos-core.js (chargé avant). IIFE ES2017, zéro build.
   ============================================================================ */
(function () {
  'use strict';

  var U = null; // POS.util (résolu au boot)

  /* ---------- constantes ---------------------------------------------------- */
  var HZ = 20;                 // cadence d'émission
  var STALE_MS = 2500;         // âge max d'une valeur brute avant péremption
  var OBD_LIVE_MS = 3000;      // OBD considéré vivant si donnée < 3 s
  var GPS_LIVE_MS = 4000;      // GPS considéré vivant si fix < 4 s
  var STEER_RATIO = 15;        // démultiplication direction (volant/roues)
  var PRIO = { obd: 3, gps: 2, demo: 1, est: 0 }; // priorité par source

  /* valeurs par défaut du véhicule (utilisées si non identifié) */
  var DEF_WHEELBASE_M = 2.7;   // empattement
  var DEF_TRACK_M = 1.55;      // voie
  /* km/h par 1000 tr/min pour chaque rapport (boîte 6 générique) */
  var DEF_KMH_PER_1000 = [7.5, 13.5, 20, 27, 34, 41, 48, 55];

  /* ---------- état interne --------------------------------------------------- */
  var raw = {};        // champ -> {v, src, t} (dernière valeur brute reçue)
  var smooth = {       // valeurs lissées (état continu de la frame)
    spd: 0, rpm: 0, throttle: 0, brake: 0, steer: 0, fuel: 0,
    coolant: 0, batt: 0, heading: 0
  };
  var lastFrame = null;
  var vehicle = null;          // schéma véhicule (vehicle:identified)
  var obdState = 'off';        // dernier 'obd:status'.state
  var lastObdData = 0;         // timestamp de la dernière donnée OBD
  var lastGpsFix = 0;          // timestamp du dernier fix GPS
  var demoOn = false;

  var removeLoop = null;       // fn de retrait de la tâche POS.loop
  var offFns = [];             // désabonnements bus (anti-fuite)
  var lastTick = 0;            // horodatage du tick précédent (ms)
  var prevSpd = 0;             // vitesse lissée précédente (pour décélération)
  var prevHeading = 0;         // heading précédent (pour yaw rate)
  var yawRate = 0;             // vitesse de lacet lissée (°/s)
  var estGear = 0;             // dernier rapport estimé (hystérésis)
  var primed = false;          // 1er tick d'une (re)connexion : on amorce sans dériver

  /* ============================ HELPERS ===================================== */

  /* dépose une valeur brute : une source de priorité inférieure ne peut pas
     écraser une valeur fraîche d'une source supérieure */
  function setRaw(field, value, src, now) {
    if (value === null || value === undefined || isNaN(value)) return;
    var cur = raw[field];
    if (cur && PRIO[cur.src] > PRIO[src] && (now - cur.t) < STALE_MS) return;
    raw[field] = { v: +value, src: src, t: now };
  }

  /* lit une valeur brute fraîche (sinon null) */
  function getRaw(field, now) {
    var r = raw[field];
    return (r && (now - r.t) < STALE_MS) ? r : null;
  }

  /* différence angulaire normalisée dans [-180, 180] */
  function angDiff(a, b) {
    var d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  /* lerp angulaire (heading) qui gère le passage 359° -> 1° */
  function lerpAngle(a, b, k) {
    var r = a + angDiff(b, a) * k;
    return (r % 360 + 360) % 360;
  }

  /* dimensions véhicule (avec valeurs de secours) */
  function wheelbaseM() {
    return (vehicle && vehicle.dims && vehicle.dims.wheelbaseMM)
      ? vehicle.dims.wheelbaseMM / 1000 : DEF_WHEELBASE_M;
  }
  function trackM() {
    return (vehicle && vehicle.dims && vehicle.dims.trackMM)
      ? vehicle.dims.trackMM / 1000 : DEF_TRACK_M;
  }
  /* table km/h par 1000 tr/min limitée au nombre de rapports du véhicule */
  function gearTable() {
    var n = (vehicle && vehicle.transmission && vehicle.transmission.gears)
      ? vehicle.transmission.gears : 6;
    return DEF_KMH_PER_1000.slice(0, U.clamp(n, 3, DEF_KMH_PER_1000.length));
  }

  /* ============================ SOURCES ====================================== */

  /* --- OBD : mappage pid/nom -> champ télémétrie ---------------------------- */
  var PID_MAP = { '0D': 'spd', '0C': 'rpm', '11': 'throttle', '05': 'coolant', '2F': 'fuel', '42': 'batt' };
  var NAME_MAP = [
    [/speed|vitesse/i, 'spd'],
    [/rpm|r[ée]gime/i, 'rpm'],
    [/throttle|papillon|acc[ée]l/i, 'throttle'],
    [/coolant|refroid/i, 'coolant'],
    [/fuel|carburant|jauge/i, 'fuel'],
    [/batt|voltage|tension/i, 'batt'],
    [/brake|frein/i, 'brake'],
    [/steer|volant|direction/i, 'steer'],
    [/gear|rapport/i, 'gear']
  ];

  function onObdPid(d) {
    if (!d) return;
    var field = PID_MAP[String(d.pid || '').toUpperCase()] || null;
    if (!field && d.name) {
      for (var i = 0; i < NAME_MAP.length; i++) {
        if (NAME_MAP[i][0].test(d.name)) { field = NAME_MAP[i][1]; break; }
      }
    }
    if (!field) return;
    var now = Date.now();
    lastObdData = now;
    setRaw(field, d.value, 'obd', now);
    ensureLoop();
  }

  function onObdStatus(d) {
    if (!d) return;
    obdState = d.state || 'off';
    /* un OBD RÉEL connecté coupe la démo (la vraie donnée prime) */
    if (obdState === 'on' && demoOn) setDemo(false, false);
    if (obdState === 'on') ensureLoop();
  }

  /* --- GPS ------------------------------------------------------------------ */
  function onGpsFix(d) {
    if (!d || typeof d.lat !== 'number' || typeof d.lon !== 'number') return;
    var now = Date.now();
    lastGpsFix = now;
    setRaw('lat', d.lat, 'gps', now);
    setRaw('lon', d.lon, 'gps', now);
    if (typeof d.heading === 'number') setRaw('heading', d.heading, 'gps', now);
    /* vitesse GPS = secours si pas d'OBD (setRaw gère la priorité) */
    if (typeof d.spd === 'number') setRaw('spd', d.spd, 'gps', now);
    ensureLoop();
  }

  /* --- véhicule -------------------------------------------------------------- */
  function onVehicle(d) { if (d && d.vehicle) vehicle = d.vehicle; }

  /* ============================ SIMULATEUR DÉMO ============================== */
  /* Cycle de conduite réaliste ~4 min bouclé : démarrage, ville 50, feux et
     arrêts, route 80-110, virages avec ralentissement, montées en rapports.
     Modèle simple : accélération bornée, rpm dérivé du rapport engagé,
     heading qui évolue dans les virages, conso corrélée au papillon.        */
  var demo = {
    t: 0,                      // temps dans le cycle (s)
    v: 0,                      // vitesse (m/s)
    gear: 0,
    rpm: 850,
    heading: 40,
    lat: 46.2044, lon: 6.1432, // départ : Genève
    fuel: 61, coolant: 35, throttle: 0, brake: 0
  };
  /* phases : d = durée (s), v = vitesse cible (km/h), turn = ° de cap au total */
  var CYCLE = [
    { d: 8, v: 0 },              // démarrage moteur, au ralenti
    { d: 12, v: 50 },            // accélération en ville
    { d: 18, v: 50 },            // croisière ville
    { d: 6, v: 0 },              // freinage au feu
    { d: 8, v: 0 },              // arrêt au feu rouge
    { d: 12, v: 50 },            // redémarrage
    { d: 14, v: 45, turn: 70 },  // virage serré en ville
    { d: 14, v: 80 },            // sortie de ville
    { d: 24, v: 110 },           // route, montée en rapports
    { d: 12, v: 70, turn: -60 }, // virage avec ralentissement
    { d: 20, v: 110 },           // reprise
    { d: 14, v: 90, turn: 45 },  // courbe rapide
    { d: 20, v: 110 },           // ligne droite
    { d: 12, v: 50 },            // retour en ville
    { d: 14, v: 50 },
    { d: 8, v: 0 },              // freinage final
    { d: 14, v: 0 }              // arrêt, moteur au ralenti
  ];
  var CYCLE_LEN = (function () {
    var s = 0; for (var i = 0; i < CYCLE.length; i++) s += CYCLE[i].d; return s;
  })();

  /* phase courante pour un temps t du cycle */
  function demoPhase(t) {
    var acc = 0;
    for (var i = 0; i < CYCLE.length; i++) {
      if (t < acc + CYCLE[i].d) return { p: CYCLE[i], into: t - acc };
      acc += CYCLE[i].d;
    }
    return { p: CYCLE[CYCLE.length - 1], into: 0 };
  }

  /* un pas de simulation (dt en secondes) — écrit les valeurs brutes 'demo' */
  function demoStep(dt, now) {
    demo.t = (demo.t + dt) % CYCLE_LEN;
    var ph = demoPhase(demo.t);
    var targetV = ph.p.v / 3.6;                       // cible en m/s

    /* accélération bornée : +2.2 m/s² en accélération, -3.5 au freinage */
    var dv = targetV - demo.v;
    var a = U.clamp(dv * 0.8, -3.5, 2.2);
    demo.v = Math.max(0, demo.v + a * dt);

    /* papillon / frein dérivés de la demande d'accélération */
    if (a > 0.05) {
      demo.throttle = U.clamp(a / 2.2 * 70 + (demo.v * 3.6 / 130) * 25, 5, 100);
      demo.brake = 0;
    } else if (a < -0.3) {
      demo.throttle = 0;
      demo.brake = U.clamp((-a - 0.3) / 3.2 * 100, 0, 100);
    } else {
      demo.throttle = demo.v > 0.5 ? 12 : 0;          // maintien de vitesse
      demo.brake = 0;
    }

    /* boîte de vitesses : passage selon rpm cible (2600 up / 1300 down) */
    var table = gearTable();
    var kmh = demo.v * 3.6;
    if (kmh < 2) { demo.gear = 0; demo.rpm = 850; }
    else {
      if (demo.gear < 1) demo.gear = 1;
      /* garde : si un véhicule à moins de rapports est identifié en cours de démo,
         demo.gear (état persistant) peut dépasser table.length -> évite table[undefined]=NaN */
      if (demo.gear > table.length) demo.gear = table.length;
      var r = kmh / table[demo.gear - 1] * 1000;
      if (r > 2600 && demo.gear < table.length) { demo.gear++; }
      else if (r < 1300 && demo.gear > 1) { demo.gear--; }
      r = kmh / table[demo.gear - 1] * 1000;
      demo.rpm = Math.max(850, r);
    }

    /* cap : évolue pendant les phases de virage (répartition uniforme) */
    if (ph.p.turn) {
      demo.heading = (demo.heading + (ph.p.turn / ph.p.d) * dt + 360) % 360;
    }

    /* position : intégration lat/lon depuis cap + vitesse */
    var hRad = demo.heading * Math.PI / 180;
    demo.lat += (demo.v * Math.cos(hRad)) / 111320 * dt;
    demo.lon += (demo.v * Math.sin(hRad)) / (111320 * Math.cos(demo.lat * Math.PI / 180)) * dt;

    /* conso corrélée au papillon ; température moteur qui monte vers 92 °C */
    demo.fuel = Math.max(0, demo.fuel - (0.00006 + demo.throttle * 0.000012) * dt);
    demo.coolant = U.lerp(demo.coolant, 92, U.clamp(dt / 60, 0, 1));
    var batt = demo.rpm > 1000 ? 14.2 : 13.6;         // alternateur en charge

    /* dépôt dans le brut (priorité 'demo' : jamais au-dessus d'OBD/GPS) */
    setRaw('spd', kmh, 'demo', now);
    setRaw('rpm', demo.rpm, 'demo', now);
    setRaw('throttle', demo.throttle, 'demo', now);
    setRaw('brake', demo.brake, 'demo', now);
    setRaw('gear', demo.gear, 'demo', now);
    setRaw('fuel', demo.fuel, 'demo', now);
    setRaw('coolant', demo.coolant, 'demo', now);
    setRaw('batt', batt, 'demo', now);
    setRaw('heading', demo.heading, 'demo', now);
    setRaw('lat', demo.lat, 'demo', now);
    setRaw('lon', demo.lon, 'demo', now);
  }

  /* active/coupe la démo. emit=true -> informe le bus ('pos:demo') */
  function setDemo(on, emit) {
    on = !!on;
    if (on === demoOn) return;
    /* refus : un OBD réel est connecté, la démo n'a pas lieu d'être */
    if (on && obdState === 'on') return;
    demoOn = on;
    if (on) { demo.t = 0; demo.v = 0; demo.gear = 0; ensureLoop(); }
    if (emit) POS.bus.emit('pos:demo', { on: demoOn });
  }

  /* ============================ ACTIVITÉ DES SOURCES ========================= */
  function srcStates(now) {
    return {
      obd: { active: obdState === 'on' || (now - lastObdData) < OBD_LIVE_MS, state: obdState, lastData: lastObdData || null },
      gps: { active: (now - lastGpsFix) < GPS_LIVE_MS, lastFix: lastGpsFix || null },
      demo: { active: demoOn }
    };
  }
  function anyActive(now) {
    var s = srcStates(now);
    return s.obd.active || s.gps.active || s.demo.active;
  }

  /* ============================ BOUCLE 20 Hz ================================= */

  /* installe la tâche dans POS.loop si une source vient de s'activer */
  function ensureLoop() {
    if (removeLoop) return;
    lastTick = 0;
    primed = false; // la source peut déjà rouler : on amorce l'état au 1er tick
    removeLoop = POS.loop.add(tick, HZ, 1); // prio 1 = critique
  }
  /* retire la tâche quand plus AUCUNE source n'est active (zéro coût) */
  function stopLoop() {
    if (removeLoop) { removeLoop(); removeLoop = null; }
  }

  function tick(nowRaf) {
    var now = Date.now();
    if (!anyActive(now)) { stopLoop(); return; } // plus de source -> silence
    var dt = lastTick ? Math.min((nowRaf - lastTick) / 1000, 0.25) : 1 / HZ;
    lastTick = nowRaf;

    /* 1) simulation démo (si active) — alimente le brut */
    if (demoOn) demoStep(dt, now);

    /* 2) fusion : pour chaque champ, valeur brute fraîche ou état conservé */
    var src = { spd: null, rpm: null, throttle: null, brake: null, steer: null,
                gear: null, fuel: null, coolant: null, batt: null, wheels: null,
                lat: null, lon: null, heading: null };
    var fields = ['spd', 'rpm', 'throttle', 'brake', 'steer', 'fuel', 'coolant', 'batt'];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i], r = getRaw(f, now);
      if (r) {
        var k = (f === 'fuel' || f === 'coolant') ? 0.06 : (f === 'batt' ? 0.1 : 0.3);
        smooth[f] = primed ? U.lerp(smooth[f], r.v, k) : r.v; // 1er tick : snap (pas de rampe depuis 0)
        src[f] = r.src;
      }
    }
    /* heading : lissage angulaire (gère le passage 359 -> 1) */
    var rh = getRaw('heading', now);
    if (rh) { smooth.heading = primed ? lerpAngle(smooth.heading, rh.v, 0.3) : rh.v; src.heading = rh.src; }
    /* position : pas de lissage (les sauts GPS sont gérés en amont) */
    var rlat = getRaw('lat', now), rlon = getRaw('lon', now);
    var lat = rlat ? rlat.v : null, lon = rlon ? rlon.v : null;
    if (rlat) src.lat = rlat.src;
    if (rlon) src.lon = rlon.src;
    /* gear : entier, pas de lerp */
    var rg = getRaw('gear', now);
    var gear = rg ? Math.round(rg.v) : null;
    if (rg) src.gear = rg.src;

    var spd = smooth.spd;                             // km/h
    var vMs = spd / 3.6;

    /* 3) dérivées : décélération et vitesse de lacet (lissées).
       Au 1er tick d'une (re)connexion, l'état précédent (prevSpd/prevHeading)
       n'est pas synchronisé -> on amorce sans dériver pour éviter un pic aberrant
       (ex. source déjà en mouvement : heading 0 -> réel donnerait un yaw énorme). */
    var accel = 0;
    if (primed) {
      accel = (spd - prevSpd) / 3.6 / dt;             // m/s²
      var instYaw = angDiff(smooth.heading, prevHeading) / dt; // °/s
      yawRate = U.lerp(yawRate, U.clamp(instYaw, -90, 90), 0.2);
    } else {
      yawRate = 0; primed = true;                     // état amorcé, dérivées à partir du prochain tick
    }
    prevSpd = spd;
    prevHeading = smooth.heading;

    /* 4) ESTIMATIONS des champs manquants (marquées 'est' dans src) */

    /* frein estimé : décélération > 1.2 m/s² sans papillon */
    if (src.brake === null) {
      var b = 0;
      if (accel < -1.2 && smooth.throttle < 8) b = U.clamp((-accel - 1.2) / 3.5 * 100, 0, 100);
      smooth.brake = U.lerp(smooth.brake, b, 0.3);
      src.brake = 'est';
    }

    /* volant estimé : modèle bicyclette — angle roues = atan(L·ω/v), × ratio */
    if (src.steer === null) {
      var st = 0;
      if (vMs > 1.5) {
        var wheelRad = Math.atan(wheelbaseM() * (yawRate * Math.PI / 180) / vMs);
        st = U.clamp(wheelRad * 180 / Math.PI * STEER_RATIO, -540, 540);
      }
      smooth.steer = U.lerp(smooth.steer, st, 0.25);
      src.steer = 'est';
    }

    /* rapport estimé : km/h par 1000 tr/min comparé à la table plausible */
    if (gear === null) {
      var rpm = smooth.rpm;
      if (spd < 2 || rpm < 600) estGear = 0;
      else {
        var table = gearTable(), ratio = spd / (rpm / 1000);
        var best = 1, err = Infinity;
        for (var g = 0; g < table.length; g++) {
          var e = Math.abs(ratio - table[g]);
          if (e < err) { err = e; best = g + 1; }
        }
        /* VRAIE hystérésis (anti-clignotement 3/4/3/4 aux frontières) :
           on ne bascule vers 'best' que si son erreur est inférieure à celle du
           rapport courant d'au moins 30 % de l'écart local entre rapports voisins. */
        if (estGear < 1 || estGear > table.length) {
          estGear = best;                              // amorçage / véhicule changé
        } else if (best !== estGear) {
          var errCur = Math.abs(ratio - table[estGear - 1]);
          var span = Math.abs(table[best - 1] - table[estGear - 1]) || 1;
          if (err < errCur - 0.30 * span) estGear = best;
        }
      }
      gear = estGear;
      src.gear = 'est';
    }

    /* roues [fl,fr,rl,rr] : vitesse commune ± différentiel en virage.
       Δv (m/s) = ω(rad/s) × demi-voie. ω > 0 = cap qui augmente = virage à
       droite -> côté GAUCHE extérieur, donc plus rapide (et inversement).  */
    var half = trackM() / 2;
    var dAbs = Math.abs((yawRate * Math.PI / 180) * half * 3.6); // km/h
    var left = spd + (yawRate > 0 ? dAbs : -dAbs);
    var right = spd + (yawRate > 0 ? -dAbs : dAbs);
    var wheels = [Math.max(0, left), Math.max(0, right), Math.max(0, left), Math.max(0, right)];
    src.wheels = src.spd === 'obd' ? 'est' : (src.spd || 'est');

    /* 5) frame finale, lissée et complète */
    lastFrame = {
      t: now,
      spd: +spd.toFixed(1),
      rpm: Math.round(smooth.rpm),
      throttle: +smooth.throttle.toFixed(1),
      brake: +smooth.brake.toFixed(1),
      steer: +smooth.steer.toFixed(1),
      gear: gear,
      fuel: +smooth.fuel.toFixed(1),
      coolant: +smooth.coolant.toFixed(1),
      batt: +smooth.batt.toFixed(2),
      wheels: [+wheels[0].toFixed(1), +wheels[1].toFixed(1), +wheels[2].toFixed(1), +wheels[3].toFixed(1)],
      lat: lat, lon: lon,
      heading: +smooth.heading.toFixed(1),
      src: src
    };
    POS.bus.emit('telemetry', lastFrame);
  }

  /* ============================ API PUBLIQUE ================================= */
  var api = {
    /* dernière frame émise (null si jamais émis) */
    last: function () { return lastFrame; },
    /* au moins une source active ? */
    active: function () { return anyActive(Date.now()); },
    /* active / coupe la démo (informe le bus si l'état change) */
    demo: function (on) { setDemo(on, true); return demoOn; },
    /* état détaillé de chaque source */
    sources: function () { return srcStates(Date.now()); },
    /* démontage propre : retire listeners + boucle (aucune fuite mémoire) */
    destroy: function () {
      stopLoop();
      for (var i = 0; i < offFns.length; i++) { try { offFns[i](); } catch (e) {} }
      offFns = [];
      demoOn = false;
    }
  };

  /* ============================ BOOT ========================================= */
  function boot() {
    U = POS.util;
    offFns.push(POS.bus.on('obd:pid', onObdPid));
    offFns.push(POS.bus.on('obd:status', onObdStatus));
    offFns.push(POS.bus.on('gps:fix', onGpsFix));
    offFns.push(POS.bus.on('vehicle:identified', onVehicle));
    /* commande de démo venue de l'UI ('pos:demo' {on}) — sans ré-émission */
    offFns.push(POS.bus.on('pos:demo', function (d) { setDemo(d && d.on, false); }));
    POS.registry.register('telemetry', api);
  }

  POS.ready(boot);
})();
