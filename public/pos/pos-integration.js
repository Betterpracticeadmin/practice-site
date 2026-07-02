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
    var mounted = false;
    function tryMount() {
      if (mounted || !car3d) return;
      var host = document.getElementById('posCar3d');
      if (!host) return;
      var r = host.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return; /* pas encore visible */
      mounted = true;
      Promise.resolve(car3d.mount(host)).then(function (ok) {
        if (ok === false) return;
        /* véhicule déjà identifié ? sinon silhouette par défaut (hypercar Practice One) */
        try {
          if (lastVeh) car3d.buildFromVehicle(lastVeh);
          else if (vehdb && vehdb.estimate) car3d.buildFromVehicle(vehdb.estimate('hypercar'));
          if (car3d.showDims) car3d.showDims(true);
        } catch (e) { console.warn('[POS] car3d build', e); }
      });
    }
    /* la vue véhicule s'ouvre par interaction → on tente au clic + à l'observation */
    document.addEventListener('click', function () { setTimeout(tryMount, 450); }, true);
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
        f.contentWindow.postMessage({ type: 'avatar', url: m.src, len: lenByClass[m.class] || 4.8 }, '*');
      } catch (e) {}
    }
    window.__posPostAvatar = postAvatarToHub;        // appelé par openHud() dans os.html
    POS.bus.on('avatar:changed', function () { postAvatarToHub(); });
    /* sélecteur de véhicule (Réglages/vue véhicule) */
    if (garage && garage.mountPicker) {
      var gbox = document.getElementById('posGarageUI');
      if (gbox) { try { garage.mountPicker(gbox); } catch (e) { console.warn('[POS] picker', e); } }
    }

    console.info('[PracticeOS] modules actifs :', POS.registry.list().join(', '));
  });
})();
