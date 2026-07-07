/* ============================================================================
   PracticeOS — POS Car3D
   ----------------------------------------------------------------------------
   Rendu 3D LOW-POLY du véhicule reconnu. Représentation volontairement légère
   (pas réaliste) : carrosserie paramétrique (soubassement, capot, cabine,
   coffre selon le segment), 4 roues, 2 rétroviseurs. Les proportions sont
   dérivées des VRAIES dimensions du schéma véhicule (dims, wheelbase,
   wheels.diamIN). Échelle : 1 unité three.js = 1 mètre.

   three.js est chargé À LA DEMANDE (injection <script>, une seule fois) au
   premier mount(). En cas d'échec réseau, mount() résout false et le module
   reste inerte (dégradation propre, rien ne casse).

   API publique (POS.registry.get('car3d')) :
     • mount(containerEl)      -> Promise<boolean>  crée canvas + scène dans
                                  le conteneur (fond transparent, cockpit
                                  visible derrière). false si three.js absent.
     • buildFromVehicle(v)     -> reconstruit le modèle depuis un schéma
                                  véhicule (cf. pos-vehdb.js).
     • showDims(bool)          -> overlay texte L × l × H en mètres.
     • followHeading(bool)     -> oriente le modèle selon le cap GPS reçu
                                  dans 'telemetry'.
     • destroy()               -> libère TOUT (géométries, matériaux,
                                  renderer, listeners, observers, DOM).
     • isMounted()             -> état courant.

   Bus — écoute : 'telemetry'          (rotation roues, braquage, roulis,
                                        tangage amorti, cap)
                  'vehicle:identified' (rebuild automatique du modèle)
   Bus — n'émet rien.

   Performance (spec n°11) : rendu via POS.loop.add(fn, 30 Hz, prio 0)
   UNIQUEMENT quand le conteneur est visible (IntersectionObserver) ;
   hors écran = 0 rendu, 0 travail.

   Style : IIFE ES2017 sans build step (compatible WKWebView / Safari iOS).
   Chargé APRÈS pos-core.js.
   ============================================================================ */
(function () {
  'use strict';

  /* ---------- chargement paresseux de three.js ----------------------------
     Une seule Promise partagée. URL principale (r160) + repli (r149, dernière
     version garantissant le build UMD three.min.js) si le script se charge
     mais n'expose pas window.THREE.                                          */
  var THREE_URLS = [
    'https://unpkg.com/three@0.160.0/build/three.min.js',
    'https://unpkg.com/three@0.149.0/build/three.min.js'
  ];
  var threePromise = null;

  function injectScript(url) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { s.parentNode && s.parentNode.removeChild(s); resolve(false); };
      document.head.appendChild(s);
    });
  }

  /* essaie chaque URL dans l'ordre ; résout window.THREE ou null */
  function loadThree() {
    if (threePromise) return threePromise;
    threePromise = new Promise(function (resolve) {
      if (window.THREE) { resolve(window.THREE); return; }
      var i = 0;
      function next() {
        if (i >= THREE_URLS.length) { resolve(null); return; }
        injectScript(THREE_URLS[i++]).then(function (ok) {
          if (ok && window.THREE) resolve(window.THREE); else next();
        });
      }
      next();
    });
    return threePromise;
  }

  /* ---------- constantes réglage -------------------------------------------- */
  var STEER_RATIO = 14;      // rapport volant -> roues (deg volant / deg roue)
  var MAX_WHEEL_DEG = 40;    // braquage maxi des roues avant (degrés)
  var ROLL_MAX = 0.10;       // roulis maxi (rad)
  var PITCH_MAX = 0.08;      // tangage maxi (rad)
  var RENDER_HZ = 30;        // cadence de rendu (prio 0 = confort)

  /* véhicule générique si rien d'identifié (berline moyenne) */
  var DEFAULT_VEHICLE = {
    segment: 'berline',
    dims: { lengthMM: 4500, widthMM: 1820, heightMM: 1450, wheelbaseMM: 2700, trackMM: 1580 },
    wheels: { diamIN: 17, widthMM: 225 }
  };

  /* silhouettes par segment : fractions de la hauteur/longueur réelles.
     sill    = haut du soubassement, hoodTop/trunkTop = haut capot/coffre,
     hoodLen/trunkLen = part de la longueur, taperL/taperW = rétrécissement
     du toit (longueur/largeur), shift = recul du toit (pare-brise incliné). */
  var SILHOUETTES = {
    berline: { sill: 0.42, hoodTop: 0.60, trunkTop: 0.62, hoodLen: 0.28, trunkLen: 0.24, taperL: 0.62, taperW: 0.84, shift: 0.05 },
    sport:   { sill: 0.45, hoodTop: 0.54, trunkTop: 0.58, hoodLen: 0.33, trunkLen: 0.22, taperL: 0.50, taperW: 0.80, shift: 0.08 },
    suv:     { sill: 0.40, hoodTop: 0.64, trunkTop: 0.94, hoodLen: 0.24, trunkLen: 0.20, taperL: 0.80, taperW: 0.88, shift: 0.03 },
    break_:  { sill: 0.42, hoodTop: 0.58, trunkTop: 0.90, hoodLen: 0.26, trunkLen: 0.24, taperL: 0.78, taperW: 0.86, shift: 0.04 },
    hatch:   { sill: 0.42, hoodTop: 0.58, trunkTop: 0.86, hoodLen: 0.24, trunkLen: 0.12, taperL: 0.72, taperW: 0.85, shift: 0.04 }
  };

  /* devine la silhouette depuis le libellé de segment (texte libre) */
  function pickSilhouette(segment) {
    var s = String(segment || '').toLowerCase();
    if (/suv|4x4|crossover|tout.terrain|pick|monospace|van|utilitaire/.test(s)) return SILHOUETTES.suv;
    if (/sport|coup|super|hyper|\bgt\b|roadster|cabrio/.test(s)) return SILHOUETTES.sport;
    if (/break|wagon|estate|touring/.test(s)) return SILHOUETTES.break_;
    if (/citadine|compact|hatch|polyvalente/.test(s)) return SILHOUETTES.hatch;
    return SILHOUETTES.berline;
  }

  /* environnement studio (PMREM depuis un dégradé) -> reflets métalliques premium sur
     les matériaux PBR, sans dépendance externe (tout window.THREE / UMD). */
  function studioEnv(THREE, renderer) {
    var cv = document.createElement('canvas'); cv.width = 16; cv.height = 128;
    var g = cv.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.00, '#eef3ff');  // ciel clair
    grad.addColorStop(0.48, '#8b95a8');
    grad.addColorStop(0.50, '#3a4150');  // ligne d'horizon
    grad.addColorStop(1.00, '#14171d');  // sol sombre
    g.fillStyle = grad; g.fillRect(0, 0, 16, 128);
    var tex = new THREE.CanvasTexture(cv); tex.mapping = THREE.EquirectangularReflectionMapping;
    var pmrem = new THREE.PMREMGenerator(renderer);
    var env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose(); pmrem.dispose();
    return env;
  }

  /* couleur carrosserie depuis la variable CSS --acc (thème PracticeOS) */
  function accColor() {
    var c = '';
    try { c = getComputedStyle(document.body).getPropertyValue('--acc').trim(); } catch (e) {}
    return c || '#FF5000';
  }

  /* ==========================================================================
     Module
     ========================================================================== */
  function boot() {
    var THREE = null;          // namespace three.js (après chargement)
    var container = null;      // conteneur DOM fourni à mount()
    var canvas = null;
    var renderer = null, scene = null, camera = null;
    var root = null;           // groupe cap (heading)
    var carGroup = null;       // groupe roulis/tangage
    var wheels = [];           // meshes roues (rotation.x = roulement)
    var frontPivots = [];      // pivots braquage roues avant (rotation.y)
    var disposables = [];      // géométries + matériaux à libérer au rebuild
    var dimsDiv = null;        // overlay dimensions
    var removeLoop = null;     // fonction de retrait POS.loop
    var io = null;             // IntersectionObserver
    var ro = null;             // ResizeObserver
    var offBusFns = [];        // désabonnements bus
    var mounted = false;
    var visible = false;
    var wantDims = false;
    var wantHeading = false;
    var lastVehicle = null;    // dernier schéma reçu
    var wheelRadius = 0.32;    // rayon roue courant (m)
    var wheelbaseM = 2.7;

    /* état d'animation amorti */
    var tel = { spd: 0, steer: 0, heading: 0, throttle: 0, brake: 0 };
    var spin = 0, steerCur = 0, rollCur = 0, pitchCur = 0, headingCur = 0;
    var prevSpd = 0, lastFrameT = 0;

    /* ---------- écoute bus (dès le boot : on mémorise même sans montage) --- */
    offBusFns.push(POS.bus.on('telemetry', function (d) {
      if (!d) return;
      tel.spd = POS.util.num(d.spd, 1) * 1 || 0;
      tel.steer = +d.steer || 0;
      if (d.heading !== undefined && d.heading !== null) tel.heading = +d.heading || 0;
      tel.throttle = +d.throttle || 0;
      tel.brake = +d.brake || 0;
    }));
    offBusFns.push(POS.bus.on('vehicle:identified', function (d) {
      if (!d || !d.vehicle) return;
      lastVehicle = d.vehicle;
      if (mounted && THREE) buildFromVehicle(lastVehicle); // rebuild auto
    }));

    /* ---------- boucle de rendu (ajoutée UNIQUEMENT si visible) ------------ */
    function tick(now) {
      if (!renderer || !scene) return;
      var dt = lastFrameT ? Math.min((now - lastFrameT) / 1000, 0.1) : 0.033;
      lastFrameT = now;
      var k = 1 - Math.exp(-dt * 8); // coefficient d'amortissement

      /* roulement des roues : v (m/s) / rayon = vitesse angulaire (rad/s) */
      var v = tel.spd / 3.6;
      spin += (v / Math.max(wheelRadius, 0.05)) * dt;
      for (var i = 0; i < wheels.length; i++) wheels[i].rotation.x = spin;

      /* braquage roues avant (deg volant -> rad roue, amorti) */
      var target = POS.util.clamp(tel.steer / STEER_RATIO, -MAX_WHEEL_DEG, MAX_WHEEL_DEG) * Math.PI / 180;
      steerCur = POS.util.lerp(steerCur, target, k);
      for (var j = 0; j < frontPivots.length; j++) frontPivots[j].rotation.y = steerCur;

      /* roulis : accélération latérale ~ v² · tan(braquage) / empattement */
      var latAcc = v * v * Math.tan(steerCur) / Math.max(wheelbaseM, 1);
      rollCur = POS.util.lerp(rollCur, POS.util.clamp(-latAcc * 0.012, -ROLL_MAX, ROLL_MAX), k);

      /* tangage : accélération longitudinale (dérivée de la vitesse, amortie) */
      var longAcc = dt > 0 ? ((tel.spd - prevSpd) / 3.6) / dt : 0;
      prevSpd = tel.spd;
      pitchCur = POS.util.lerp(pitchCur, POS.util.clamp(longAcc * 0.015, -PITCH_MAX, PITCH_MAX), k * 0.6);

      if (carGroup) { carGroup.rotation.z = rollCur; carGroup.rotation.x = pitchCur; }

      /* orientation par le cap GPS (arc le plus court, amorti) */
      if (root) {
        if (wantHeading) {
          var th = -tel.heading * Math.PI / 180;
          var dh = Math.atan2(Math.sin(th - headingCur), Math.cos(th - headingCur));
          headingCur += dh * k;
        } else if (headingCur !== 0) {
          headingCur += Math.atan2(Math.sin(-headingCur), Math.cos(-headingCur)) * k;
        }
        root.rotation.y = headingCur;
      }

      renderer.render(scene, camera);
    }

    function startLoop() {
      if (!removeLoop && mounted) { lastFrameT = 0; removeLoop = POS.loop.add(tick, RENDER_HZ, 0); }
    }
    function stopLoop() {
      if (removeLoop) { removeLoop(); removeLoop = null; }
    }

    /* ---------- dimensionnement du canvas ----------------------------------- */
    function resize() {
      if (!renderer || !container) return;
      var w = container.clientWidth || 300;
      var h = container.clientHeight || 200;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    /* ---------- libération du modèle courant (pas de fuite mémoire) --------- */
    function disposeModel() {
      for (var i = 0; i < disposables.length; i++) {
        try { disposables[i].dispose(); } catch (e) {}
      }
      disposables = [];
      wheels = [];
      frontPivots = [];
      if (root && scene) { scene.remove(root); }
      root = null; carGroup = null;
    }

    /* mémorise géométrie/matériau pour libération ultérieure */
    function track(obj) { disposables.push(obj); return obj; }

    /* ---------- construction paramétrique low-poly -------------------------- */
    function buildFromVehicle(vehicle) {
      if (!THREE || !scene) { lastVehicle = vehicle || lastVehicle; return; }
      lastVehicle = vehicle || lastVehicle || DEFAULT_VEHICLE;
      var v = lastVehicle;
      var d = (v && v.dims) || {};
      var wh = (v && v.wheels) || {};

      /* dimensions réelles en mètres (repli sur la berline générique) */
      var L = (POS.util.num(d.lengthMM) || DEFAULT_VEHICLE.dims.lengthMM) / 1000;
      var W = (POS.util.num(d.widthMM) || DEFAULT_VEHICLE.dims.widthMM) / 1000;
      var H = (POS.util.num(d.heightMM) || DEFAULT_VEHICLE.dims.heightMM) / 1000;
      var WB = (POS.util.num(d.wheelbaseMM) || DEFAULT_VEHICLE.dims.wheelbaseMM) / 1000;
      var TR = (POS.util.num(d.trackMM) || DEFAULT_VEHICLE.dims.trackMM) / 1000;
      var rimIN = POS.util.num(wh.diamIN) || DEFAULT_VEHICLE.wheels.diamIN;
      var tyreW = (POS.util.num(wh.widthMM) || DEFAULT_VEHICLE.wheels.widthMM) / 1000;
      /* rayon roue = jante + flanc de pneu forfaitaire (~10 cm) */
      wheelRadius = (rimIN * 0.0254) / 2 + 0.10;
      wheelbaseM = WB;

      var sil = pickSilhouette(v.segment);
      disposeModel();

      /* matériaux plats (relâchés au prochain build) */
      var matBody = track(new THREE.MeshLambertMaterial({ color: new THREE.Color(accColor()), flatShading: true }));
      var matWheel = track(new THREE.MeshLambertMaterial({ color: 0x16181c, flatShading: true }));
      var matGlass = track(new THREE.MeshLambertMaterial({ color: 0x0a0c10, flatShading: true }));

      root = new THREE.Group();      // cap (heading)
      carGroup = new THREE.Group();  // roulis / tangage
      root.add(carGroup);
      scene.add(root);

      var clearance = wheelRadius * 0.55;         // garde au sol visuelle
      var sillY = Math.max(H * sil.sill, clearance + 0.12);

      /* 1) soubassement : box pleine longueur */
      var gBase = track(new THREE.BoxGeometry(W, sillY - clearance, L));
      var base = new THREE.Mesh(gBase, matBody);
      base.position.y = clearance + (sillY - clearance) / 2;
      carGroup.add(base);

      /* 2) capot (avant = +Z), plus bas que la cabine */
      var hoodLen = L * sil.hoodLen;
      var hoodH = Math.max(H * sil.hoodTop - sillY, 0.04);
      var gHood = track(new THREE.BoxGeometry(W * 0.96, hoodH, hoodLen));
      var hood = new THREE.Mesh(gHood, matBody);
      hood.position.set(0, sillY + hoodH / 2, L / 2 - hoodLen / 2);
      carGroup.add(hood);

      /* 3) coffre (arrière) : haut pour SUV/break, bas pour berline/sportive */
      var trunkLen = L * sil.trunkLen;
      var trunkH = Math.max(H * sil.trunkTop - sillY, 0.04);
      var gTrunk = track(new THREE.BoxGeometry(W * 0.96, trunkH, trunkLen));
      var trunk = new THREE.Mesh(gTrunk, matBody);
      trunk.position.set(0, sillY + trunkH / 2, -L / 2 + trunkLen / 2);
      carGroup.add(trunk);

      /* 4) cabine : box trapézoïdale (sommets du haut resserrés + reculés) */
      var cabLen = L - hoodLen - trunkLen;
      var cabH = Math.max(H - sillY, 0.2);
      var gCab = track(new THREE.BoxGeometry(W * 0.92, cabH, cabLen));
      var pos = gCab.attributes && gCab.attributes.position;
      if (pos) {
        for (var i = 0; i < pos.count; i++) {
          if (pos.getY(i) > 0) { // sommets du toit : taper + recul (pare-brise)
            pos.setX(i, pos.getX(i) * sil.taperW);
            pos.setZ(i, pos.getZ(i) * sil.taperL - cabLen * sil.shift);
          }
        }
        pos.needsUpdate = true;
        gCab.computeVertexNormals();
      }
      var cab = new THREE.Mesh(gCab, matGlass);
      cab.position.set(0, sillY + cabH / 2, L / 2 - hoodLen - cabLen / 2);
      carGroup.add(cab);

      /* 5) rétroviseurs : 2 petites boxes aux montants avant de la cabine */
      var gMir = track(new THREE.BoxGeometry(0.18, 0.09, 0.06));
      var mirY = sillY + cabH * 0.35;
      var mirZ = L / 2 - hoodLen - cabLen * 0.08;
      var mirL = new THREE.Mesh(gMir, matBody);
      mirL.position.set(-(W / 2 + 0.08), mirY, mirZ);
      var mirR = new THREE.Mesh(gMir, matBody);
      mirR.position.set(W / 2 + 0.08, mirY, mirZ);
      carGroup.add(mirL); carGroup.add(mirR);

      /* 6) roues : cylindres 12 faces, axe latéral (X), positions réelles */
      var gWheel = track(new THREE.CylinderGeometry(wheelRadius, wheelRadius, Math.max(tyreW, 0.12), 12));
      gWheel.rotateZ(Math.PI / 2); // axe du cylindre -> X (latéral)
      var slots = [
        { x: -TR / 2, z: WB / 2, front: true },   // avant gauche
        { x: TR / 2, z: WB / 2, front: true },    // avant droit
        { x: -TR / 2, z: -WB / 2, front: false }, // arrière gauche
        { x: TR / 2, z: -WB / 2, front: false }   // arrière droit
      ];
      for (var s = 0; s < slots.length; s++) {
        var wm = new THREE.Mesh(gWheel, matWheel);
        wheels.push(wm);
        if (slots[s].front) { // pivot de braquage autour de Y
          var piv = new THREE.Group();
          piv.position.set(slots[s].x, wheelRadius, slots[s].z);
          piv.add(wm);
          frontPivots.push(piv);
          carGroup.add(piv);
        } else {
          wm.position.set(slots[s].x, wheelRadius, slots[s].z);
          carGroup.add(wm);
        }
      }

      /* cadrage caméra adapté à la taille réelle du véhicule (3/4 avant) */
      if (camera) {
        var dist = L * 1.35;
        camera.position.set(dist * 0.85, H * 1.5, dist * 0.95);
        camera.lookAt(0, H * 0.35, 0);
      }

      updateDims(L, W, H);
      /* rendu immédiat si visible (sinon la boucle s'en charge) */
      if (visible && renderer) renderer.render(scene, camera);
    }

    /* ---------- avatar : charge le modèle low-poly CHOISI (GLB/FBX) ----------
       Remplace la voiture paramétrique par le modèle sélectionné dans le garage.
       Se ré-applique au montage si choisi avant que la 3D soit prête. */
    var pendingAvatar = null, pendingAvatarOpts = null;
    /* normalise un modèle véhicule en Y-up : plus courte dim -> Y, plus longue -> Z */
    function uprightCar(model) {
      model.updateMatrixWorld(true);
      var s = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      var mn = Math.min(s.x, s.y, s.z);
      if (mn === s.z) model.rotation.x = -Math.PI / 2; else if (mn === s.x) model.rotation.z = Math.PI / 2;
      var g = new THREE.Group(); g.add(model); g.updateMatrixWorld(true);
      var s2 = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
      if (Math.max(s2.x, s2.y, s2.z) === s2.x) g.rotation.y = -Math.PI / 2;
      g.updateMatrixWorld(true);
      return g;
    }
    /* roue alliage réelle (GLB issu du STL), chargée une fois puis clonée ×4 (les voitures du kit n'ont que la carrosserie) */
    var wheelProtoP = null;
    function loadWheelProto() {
      if (wheelProtoP) return wheelProtoP;
      wheelProtoP = import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js')
        .then(function (m) { return new Promise(function (res, rej) { new m.GLTFLoader().load('/models/wheel.glb', function (g) { res(g.scene); }, undefined, rej); }); });
      return wheelProtoP;
    }
    /* addWheels(model, target) : dimensionne les roues d'après la bbox de `model`
       (carrosserie normalisée) mais les AJOUTE à `target` (par défaut model). Pour
       les GLB normalisés qui portent une rotation (uprightCar), on passe un wrapper
       SANS rotation comme target -> sinon les positions calculées en repère monde
       sont décalées par la rotation et les roues « flottent » à côté. */
    /* sépare la roue (un seul mesh) en 2 groupes : pneu (rayon élevé) + jante (rayon
       faible), pour appliquer 2 matériaux (pneu noir mat / jante gris métallique). */
    function splitWheelGeom(geom) {
      geom = geom.index ? geom : geom.toNonIndexed();
      var pos = geom.attributes.position, idx = geom.index;
      if (!idx) { var ai = []; for (var i0 = 0; i0 < pos.count; i0++) ai.push(i0); geom.setIndex(ai); idx = geom.index; }
      var maxR = 0; for (var i = 0; i < pos.count; i++) { var y = pos.getY(i), z = pos.getZ(i); var rr = Math.sqrt(y * y + z * z); if (rr > maxR) maxR = rr; }
      var thr = maxR * 0.74, arr = idx.array, tire = [], rim = [];
      for (var t = 0; t < arr.length; t += 3) {
        var A = arr[t], B = arr[t + 1], C = arr[t + 2];
        var my = (pos.getY(A) + pos.getY(B) + pos.getY(C)) / 3, mz = (pos.getZ(A) + pos.getZ(B) + pos.getZ(C)) / 3;
        if (Math.sqrt(my * my + mz * mz) >= thr) tire.push(A, B, C); else rim.push(A, B, C);
      }
      geom.setIndex(tire.concat(rim)); geom.clearGroups();
      geom.addGroup(0, tire.length, 0); geom.addGroup(tire.length, rim.length, 1);
      return geom;
    }
    function addWheels(model, target) {
      target = target || model;
      model.updateMatrixWorld(true);
      var b = new THREE.Box3().setFromObject(model), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      var r = Math.min(s.y * 0.42, s.z * 0.072), wx = s.x * 0.42, IN = 0.19;         // rayon ~7% de la longueur
      var fz = b.max.z - IN * s.z, rz = b.min.z + IN * s.z;                          // roues calées depuis les EXTRÉMITÉS (porte-à-faux asymétriques)
      var tireMat = track(new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.85, metalness: 0.2, side: THREE.DoubleSide }));
      var rimMat = track(new THREE.MeshStandardMaterial({ color: 0xb9bfc9, roughness: 0.35, metalness: 0.9, envMapIntensity: 1.2, side: THREE.DoubleSide })); // jante gris métallique
      var slots = [[-wx, fz], [wx, fz], [-wx, rz], [wx, rz]];
      loadWheelProto().then(function (proto) {
        slots.forEach(function (p) {
          var w = proto.clone(true);
          w.traverse(function (o) { if (o.isMesh) { o.geometry = splitWheelGeom(o.geometry.clone()); track(o.geometry); o.material = [tireMat, rimMat]; } });
          w.scale.setScalar(2 * r);                    // GLB diamètre 1 -> diamètre 2r ; axe déjà sur X
          w.rotation.y = p[0] < 0 ? Math.PI : 0;        // jante vers l'extérieur des deux côtés
          w.position.set(c.x + p[0], b.min.y + r, p[1]); target.add(w);   // p[1] = z absolu (repère bbox)
        });
        if (visible && renderer && scene && camera) renderer.render(scene, camera);
      }).catch(function () {                            // repli : cylindres
        var geo = track(new THREE.CylinderGeometry(r, r, s.x * 0.16, 18));
        slots.forEach(function (p) { var w = new THREE.Mesh(geo, rimMat); w.rotation.z = Math.PI / 2; w.position.set(c.x + p[0], b.min.y + r, p[1]); target.add(w); });
      });
    }
    function loadAvatar(url, opts) {
      opts = opts || {};
      pendingAvatar = url; pendingAvatarOpts = opts;
      if (!url || !THREE || !scene) return;
      var isFbx = /\.fbx($|\?)/i.test(url), target = +opts.len || 4.6;
      var lp = isFbx
        ? import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/FBXLoader.js').then(function (m) { return new m.FBXLoader(); })
        : import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js').then(function (m) { return new m.GLTFLoader(); });
      lp.then(function (loader) {
        loader.load(url, function (res) {
          if (!THREE || !scene) return;
          var _inner = res.scene || res; if (isFbx) _inner.traverse(function (o) { if (o.isLine || o.isLineSegments) o.visible = false; }); // retire les courbes parasites (NURBS FBX)
          var upr = uprightCar(_inner);                  // normalise -> Y-up (hauteur Y, longueur Z)
          disposeModel();                                // libère l'ancien AVANT de tracker le matériau des roues (évite un dispose prématuré)
          root = new THREE.Group(); carGroup = new THREE.Group(); root.add(carGroup); scene.add(root);
          if (!isFbx && url.indexOf('/kenney/') < 0 && url.indexOf('/lpc/') < 0) {   // ancien kit body-only -> couleur + roues
            var _pal = [0xC62828, 0x1565C0, 0xE8EAED, 0x1A1A1A, 0x9AA0A6, 0x2E7D32, 0xEF6C00, 0x6A1B9A, 0x00838F, 0xF9A825, 0x37474F, 0x8D6E63];
            var _n = parseInt(('' + url).replace(/[^0-9]/g, ''), 10) || 0, _c = _pal[_n % _pal.length];
            upr.traverse(function (o) { if (o.isMesh) o.material = track(new THREE.MeshStandardMaterial({ color: _c, roughness: 0.4, metalness: 0.5 })); }); // peinture métallisée par voiture
            addWheels(upr);
          } else {                                        // GLB texturé -> rehausse le PBR pour capter l'environnement studio
            upr.traverse(function (o) { if (o.isMesh && o.material) { var m = o.material; m.metalness = 0.35; if (m.roughness === undefined || m.roughness > 0.7) m.roughness = 0.5; m.envMapIntensity = 1.15; m.needsUpdate = true; } });
            if (url.indexOf('/lpc/') >= 0) {              // lpc : carrosserie SANS roues -> ajoute 4 roues alliage (wrapper sans rotation)
              var _cw = new THREE.Group(); _cw.add(upr); addWheels(upr, _cw); upr = _cw;
            }
          }
          upr.updateMatrixWorld(true);
          var box = new THREE.Box3().setFromObject(upr);
          var size = box.getSize(new THREE.Vector3());
          var k = target / (Math.max(size.x, size.y, size.z) || 1);
          upr.scale.setScalar(k); upr.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(upr); var ctr = box.getCenter(new THREE.Vector3());
          upr.position.set(-ctr.x, -box.min.y, -ctr.z);
          carGroup.add(upr);
          var _s2 = new THREE.Box3().setFromObject(upr).getSize(new THREE.Vector3());
          carGroup.rotation.y = (_s2.x > _s2.z ? Math.PI / 2 : 0) - 0.5;   // oriente longueur->Z (comme les vignettes) + présentation 3/4
          try {                                            // ombre de contact douce au sol (DA premium)
            var _cv = document.createElement('canvas'); _cv.width = _cv.height = 128; var _cx = _cv.getContext('2d');
            var _gr = _cx.createRadialGradient(64, 64, 3, 64, 64, 60); _gr.addColorStop(0, 'rgba(0,0,0,0.45)'); _gr.addColorStop(1, 'rgba(0,0,0,0)');
            _cx.fillStyle = _gr; _cx.fillRect(0, 0, 128, 128);
            var _shTex = track(new THREE.CanvasTexture(_cv));
            var _b3 = new THREE.Box3().setFromObject(upr), _s3 = _b3.getSize(new THREE.Vector3());
            var _sh = new THREE.Mesh(track(new THREE.PlaneGeometry(_s3.x * 2.3, _s3.z * 2.1)), track(new THREE.MeshBasicMaterial({ map: _shTex, transparent: true, depthWrite: false })));
            _sh.rotation.x = -Math.PI / 2; _sh.position.y = 0.012; carGroup.add(_sh);
          } catch (e) {}
          wheelRadius = 0.34; wheelbaseM = 2.6;
          if (camera) { var dist = target * 1.5; camera.position.set(dist * 0.7, target * 0.62, dist * 1.0); camera.lookAt(0, target * 0.14, 0); }
          updateDims(target, size.x * k, size.y * k);
          if (renderer && scene && camera) { renderer.render(scene, camera); setTimeout(function () { try { renderer.render(scene, camera); } catch (e) {} }, 220); setTimeout(function () { try { renderer.render(scene, camera); } catch (e) {} }, 550); } // re-render (nouvel avatar + textures chargées)
        }, undefined, function () { /* échec -> on garde le paramétrique */ });
      }).catch(function () {});
    }

    /* ---------- overlay dimensions ------------------------------------------ */
    function updateDims(L, W, H) {
      if (!dimsDiv) return;
      dimsDiv.textContent = L.toFixed(2) + ' × ' + W.toFixed(2) + ' × ' + H.toFixed(2) + ' m';
      dimsDiv.style.display = wantDims ? 'block' : 'none';
    }

    /* ---------- montage ------------------------------------------------------ */
    function mount(containerEl) {
      if (!containerEl) return Promise.resolve(false);
      if (mounted) destroyView(); // remonter ailleurs = on nettoie l'ancien
      return loadThree().then(function (T) {
        if (!T) return false; // échec réseau -> module inerte
        THREE = T;
        container = containerEl;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0); // fond TRANSPARENT (cockpit derrière)
        try { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace; } catch (e) {} // rendu filmique premium
        canvas = renderer.domElement;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
        container.appendChild(canvas);

        scene = new THREE.Scene();
        try { scene.environment = studioEnv(THREE, renderer); } catch (e) {} // reflets PBR premium
        camera = new THREE.PerspectiveCamera(35, 1.5, 0.1, 100);

        /* lumières : directionnelle + ambiante (suffisant en flat shading) */
        /* éclairage studio premium : key + fill bleuté + rim chaud + ambiante */
        var key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(4, 7, 5); scene.add(key);
        var fill = new THREE.DirectionalLight(0x9db4ff, 0.7); fill.position.set(-5, 2, -3); scene.add(fill);
        var rim = new THREE.DirectionalLight(0xfff0d8, 0.95); rim.position.set(-2, 4, -6); scene.add(rim);
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2f3a, 0.55)); // ambiance ciel/sol premium

        /* sol : grille discrète semi-transparente */
        var grid = new THREE.GridHelper(12, 12, 0x3a3f46, 0x22262c);
        if (grid.material) {
          grid.material.transparent = true;
          grid.material.opacity = 0.25;
          track(grid.material);
        }
        if (grid.geometry) track(grid.geometry);
        scene.add(grid);

        /* overlay dimensions (masqué par défaut) */
        dimsDiv = document.createElement('div');
        dimsDiv.style.cssText = 'position:absolute;top:6px;left:8px;font:11px/1.4 monospace;' +
          'color:rgba(255,255,255,.65);pointer-events:none;display:none;z-index:2;';
        container.appendChild(dimsDiv);

        mounted = true;
        resize();
        buildFromVehicle(lastVehicle || DEFAULT_VEHICLE);
        if (pendingAvatar) loadAvatar(pendingAvatar, pendingAvatarOpts);   // avatar choisi avant le montage

        /* rendu seulement si visible à l'écran */
        if (typeof IntersectionObserver === 'function') {
          io = new IntersectionObserver(function (entries) {
            visible = entries.length ? entries[entries.length - 1].isIntersecting : false;
            if (visible) startLoop(); else stopLoop();
          }, { threshold: 0.05 });
          io.observe(container);
        } else {
          visible = true; startLoop(); // pas d'IO : on rend en continu
        }

        /* suivi de la taille du conteneur */
        if (typeof ResizeObserver === 'function') {
          ro = new ResizeObserver(function () { resize(); });
          ro.observe(container);
        } else {
          window.addEventListener('resize', resize);
        }
        return true;
      });
    }

    /* ---------- démontage de la vue (garde les abonnements bus) ------------- */
    function destroyView() {
      stopLoop();
      if (io) { try { io.disconnect(); } catch (e) {} io = null; }
      if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
      window.removeEventListener('resize', resize);
      disposeModel();
      if (renderer) { try { renderer.dispose(); } catch (e) {} }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (dimsDiv && dimsDiv.parentNode) dimsDiv.parentNode.removeChild(dimsDiv);
      renderer = null; scene = null; camera = null; canvas = null; dimsDiv = null;
      container = null; mounted = false; visible = false;
    }

    /* ---------- destruction complète ----------------------------------------- */
    function destroy() {
      destroyView();
      for (var i = 0; i < offBusFns.length; i++) { try { offBusFns[i](); } catch (e) {} }
      offBusFns = [];
    }

    /* ---------- API publique --------------------------------------------------*/
    var api = {
      mount: mount,
      buildFromVehicle: function (vehicle) { pendingAvatar = null; buildFromVehicle(vehicle); },
      loadAvatar: function (url, opts) { loadAvatar(url, opts); },
      showDims: function (on) {
        wantDims = !!on;
        if (dimsDiv) dimsDiv.style.display = wantDims ? 'block' : 'none';
      },
      followHeading: function (on) { wantHeading = !!on; },
      isMounted: function () { return mounted; },
      destroy: destroy
    };
    POS.registry.register('car3d', api);
  }

  POS.ready(boot);
})();
