/* ============================================================================
   PracticeOS — POS Integration (chef d'orchestre)
   ----------------------------------------------------------------------------
   Relie les modules pos-*.js au cockpit os.html SANS modifier son comportement.
   Chargé EN DERNIER (après core + tous les modules).

   Points de liaison (côté os.html, déjà posés) :
     • window.posBridge — sayVA/toast/driverName/setDriverName/isDemo/lang
     • 'gps:fix' émis par onPos() ; 'pos:demo' émis par startDemo()
     • #posDriversUI      — conteneur UI Réglages > Conducteurs
     • #posVehId/#posCar3d — vue véhicule : identification VIN + 3D low-poly

   Câblages réalisés ici :
     1. Onboarding premier lancement (prénom) → profil conducteur
     2. driver:changed → nom dans le cockpit (Practice IA s'adresse au conducteur)
     3. coach:advice → voix de Practice IA (sayVA) + toast discret
     4. OBD auto-connexion silencieuse au boot
     5. vehicle:identified → fiche + reconstruction du modèle 3D
     6. Montage paresseux de la 3D (au premier affichage de la vue véhicule)
   ============================================================================ */
(function () {
  'use strict';
  if (!window.POS) { console.warn('[POS integration] core absent'); return; }

  POS.ready(function () {
    var bridge = window.posBridge || {};
    var drivers = POS.registry.get('drivers');
    var coach = POS.registry.get('coach');
    var obd = POS.registry.get('obd');
    var vehdb = POS.registry.get('vehdb');
    var car3d = POS.registry.get('car3d');

    /* ---- 1. Premier lancement : « Quel est votre prénom ? » ---------------- */
    if (drivers) {
      try { drivers.mountOnboarding(); } catch (e) { console.warn('[POS] onboarding', e); }
      /* UI Réglages > Conducteurs */
      var box = document.getElementById('posDriversUI');
      if (box) { try { drivers.mountSettings(box); } catch (e) { console.warn('[POS] settingsUI', e); } }
    }

    /* ---- 2. Changement de conducteur → cockpit ----------------------------- */
    POS.bus.on('driver:changed', function (d) {
      if (!d || !d.driver) return;
      if (bridge.setDriverName) bridge.setDriverName(d.driver.name);
      if (bridge.toast) bridge.toast('Conducteur : ' + d.driver.name);
    });
    /* au boot : si un profil actif existe déjà, synchronise le nom */
    if (drivers && drivers.active && drivers.active()) {
      var act = drivers.active();
      if (act && act.name && bridge.setDriverName) bridge.setDriverName(act.name);
    }

    /* ---- 3. Conseils de Practice IA → voix + toast ------------------------- */
    POS.bus.on('coach:advice', function (a) {
      if (!a || !a.text) return;
      if (bridge.sayVA) bridge.sayVA(a.text);
    });

    /* ---- 4. OBD : tentative de reconnexion silencieuse --------------------- */
    if (obd && obd.autoConnect) {
      setTimeout(function () { try { obd.autoConnect(); } catch (e) {} }, 2500);
    }
    /* si le cockpit est déjà en mode démo au chargement des modules */
    if (bridge.isDemo && bridge.isDemo()) POS.bus.emit('pos:demo', { on: true });

    /* ---- 5. Véhicule identifié → fiche dans la vue véhicule ---------------- */
    var lastVeh = null; /* dernier véhicule identifié (pour le montage 3D différé) */
    POS.bus.on('vehicle:identified', function (d) {
      var v = d && d.vehicle; if (!v) return;
      lastVeh = v;
      var el = document.getElementById('posVehId');
      if (el) {
        el.style.display = 'block';
        el.textContent = 'RECONNU VIA VIN — ' + (v.make || '?') + ' ' + (v.model || '') +
          (v.year ? ' (' + v.year + ')' : '') + (v.estimated ? ' · specs estimées' : '');
      }
    });

    /* ---- 6. 3D low-poly : montage paresseux --------------------------------
       On ne charge three.js qu'au premier affichage réel du conteneur
       (vue véhicule ouverte), jamais au boot → zéro coût sinon.              */
    var mounted = false, mounting = false, pendingTry = 0;
    function tryMount() {
      pendingTry = 0;
      if (mounted || mounting || !car3d) return;         // déjà monté ou montage en cours
      var host = document.getElementById('posCar3d');
      if (!host) return;
      var r = host.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return; /* pas encore visible */
      mounting = true;
      /* avatar choisi ? on le déclare AVANT le montage : mount() saute la silhouette paramétrique (plus de flash low-poly) et charge le GLB directement */
      var gm0 = null; try { var g0 = POS.registry.get('garage'); gm0 = g0 && g0.resolved && g0.resolved(); if (gm0 && gm0.src && car3d.loadAvatar) car3d.loadAvatar(gm0.src, { len: 4.8, tint: gm0.tint || null, wheels: gm0.wheels !== false }); } catch (e) {}
      Promise.resolve(car3d.mount(host)).then(function (ok) {
        mounting = false;
        if (ok === false) return;                        // échec (ex. three.js hors-ligne) -> mounted reste false, remontage possible plus tard
        mounted = true;
        try { document.removeEventListener('click', onClickTry, true); } catch (e) {}
        /* véhicule déjà identifié ? sinon silhouette par défaut (hypercar Practice One) */
        try {
          if (car3d.showDims) car3d.showDims(true);
          var gm = (POS.registry.get('garage') || {}).resolved && POS.registry.get('garage').resolved();
          if (gm && gm.src) { /* déjà demandé avant le montage : mount() l'a chargé, pas de 2e téléchargement */ }
          else if (lastVeh) car3d.buildFromVehicle(lastVeh);
          else if (vehdb && vehdb.estimate) car3d.buildFromVehicle(vehdb.estimate('hypercar'));
        } catch (e) { console.warn('[POS] car3d build', e); }
      }, function () { mounting = false; });      // échec du montage -> on autorise une nouvelle tentative
    }
    /* la vue véhicule s'ouvre par interaction → on tente au clic + à l'observation.
       Un seul essai différé à la fois : évite d'empiler des timers à chaque clic. */
    function onClickTry() {
      if (mounted || mounting || pendingTry) return;
      pendingTry = setTimeout(tryMount, 450);
    }
    document.addEventListener('click', onClickTry, true);
    if ('IntersectionObserver' in window) {
      var host = document.getElementById('posCar3d');
      if (host) new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) tryMount();
      }).observe(host);
    }

    /* ---- 7. Avatar véhicule -> hub 3D (hud3d-map) --------------------------
       Envoie le modèle choisi (pos-garage) au hub par postMessage. Le hub
       affiche l'écran de chargement dot-matrix puis instancie le modèle. */
    var garage = POS.registry.get('garage');
    function postAvatarToHub() {
      try {
        var f = document.getElementById('hudFrame');
        if (!f || !f.contentWindow || !garage) return;
        var m = garage.resolved();
        if (!m || !m.src) return; // param/auto sans fichier -> le hub garde son véhicule par défaut
        var lenByClass = { motorcycle: 2.2, bus: 11, van: 5.2, truck: 5.4, suv: 4.9, car: 4.8 };
        f.contentWindow.postMessage({ type: 'avatar', url: m.src, len: lenByClass[m.class] || 4.8, tint: m.tint || null, wheels: m.wheels !== false }, '*');   // tint/wheels : look « clay Practice » (manifest lpc)
      } catch (e) {}
    }
    window.__posPostAvatar = postAvatarToHub;        // appelé par openHud() dans os.html
    var LEN_BY_CLASS = { motorcycle: 2.2, bus: 11, van: 5.2, truck: 5.4, suv: 4.9, car: 4.8 };
    /* applique le modèle choisi à l'aperçu 3D de la vue véhicule (pos-car3d) */
    function applyAvatarToPreview() {
      if (!car3d) return;
      var m = garage && garage.resolved();
      try {
        if (m && m.src && car3d.loadAvatar) car3d.loadAvatar(m.src, { len: LEN_BY_CLASS[m.class] || 4.8, tint: m.tint || null, wheels: m.wheels !== false });
        else if (m && m.paramType) car3d.buildFromVehicle({ segment: m.paramType.toLowerCase(), dims: {}, wheels: {} });
      } catch (e) {}
    }
    POS.bus.on('avatar:changed', function () { postAvatarToHub(); applyAvatarToPreview(); });
    /* sélecteur d'avatar — uniquement dans Réglages › Avatar du hub (retiré du diagnostic) */
    if (garage && garage.mountPicker) {
      var box = document.getElementById('posGarageUI2');
      if (box) { try { garage.mountPicker(box); } catch (e) { console.warn('[POS] picker', e); } }
    }

    console.info('[PracticeOS] modules actifs :', POS.registry.list().join(', '));
  });
})();
