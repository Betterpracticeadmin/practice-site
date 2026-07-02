/* ============================================================================
   PracticeOS — POS Garage (registre de modèles + avatar véhicule du conducteur)
   ----------------------------------------------------------------------------
   Catalogue des modèles low-poly disponibles pour REPRÉSENTER le conducteur
   dans le hub 3D. Le choix est persisté PAR CONDUCTEUR (POS.store).
   Aucun modèle n'est chargé ici : le registre ne fait que décrire quoi charger
   (le hud3d s'en charge à la demande, cf. pos-integration/hud).

   API publique (POS.registry.register('garage', api)) :
     • list()             -> catalogue [{id,label,kind,src?,paramType?,class,tag}]
     • byId(id)           -> une entrée
     • currentId()        -> id choisi par le conducteur actif (défaut 'auto')
     • resolved()         -> entrée concrète à afficher (résout 'auto' via VIN)
     • choose(id)         -> persiste + émet 'avatar:changed' {model}
   Événements émis   : 'avatar:changed' {model}
   Événements écoutés: 'driver:changed' (recharge le choix), 'vehicle:identified'
                       (si 'auto', réévalue le modèle selon le segment)
   ============================================================================ */
(function () {
  'use strict';
  if (!window.POS) return;

  /* Catalogue. kind: 'glb' | 'fbx' (chargés par le hub) | 'param' (généré par
     pos-car3d, roues propres) | 'auto' (choisit selon le véhicule identifié). */
  var CATALOG = [
    { id: 'auto',         label: 'Auto (selon mon véhicule)', kind: 'auto',  class: 'car',        tag: 'AUTO' },
    /* vraies voitures low-poly extraites du pack fourni */
    { id: 'berline-nuit', label: 'Berline noire', kind: 'glb', src: '/models/berline-nuit.glb', class: 'car',        tag: 'RÉEL' },
    { id: 'suv-olive',    label: 'SUV vert',      kind: 'glb', src: '/models/suv-olive.glb',    class: 'suv',        tag: 'RÉEL' },
    { id: 'van-argent',   label: 'Van gris',      kind: 'glb', src: '/models/van-argent.glb',   class: 'van',        tag: 'RÉEL' },
    { id: 'pickup-teal',  label: 'Pickup teal',   kind: 'glb', src: '/models/pickup-teal.glb',  class: 'truck',      tag: 'RÉEL' },
    /* deux-roues / bus (FBX chargés via FBXLoader) */
    { id: 'moto',         label: 'Moto',          kind: 'fbx', src: '/models/moto.fbx',         class: 'motorcycle', tag: 'RÉEL' },
    { id: 'bus',          label: 'Bus',           kind: 'fbx', src: '/models/bus.fbx',          class: 'bus',        tag: 'RÉEL' },
    /* modèles paramétriques (générés, couleur = accent du mode) */
    { id: 'param-citadine', label: 'Citadine',    kind: 'param', paramType: 'citadine', class: 'car', tag: 'GÉN.' },
    { id: 'param-berline',  label: 'Berline',     kind: 'param', paramType: 'berline',  class: 'car', tag: 'GÉN.' },
    { id: 'param-suv',      label: 'SUV',         kind: 'param', paramType: 'SUV',      class: 'suv', tag: 'GÉN.' },
    { id: 'param-sportive', label: 'Sportive',    kind: 'param', paramType: 'sportive', class: 'car', tag: 'GÉN.' }
  ];
  var MAP = {}; CATALOG.forEach(function (m) { MAP[m.id] = m; });

  /* segment de véhicule identifié -> modèle paramétrique par défaut pour 'auto' */
  function autoModel() {
    var vdb = POS.registry.get('vehdb');
    var seg = null;
    try { var v = window.__posLastVehicle; if (v && v.segment) seg = v.segment; } catch (e) {}
    var bySeg = {
      citadine: 'param-citadine', compacte: 'param-citadine', berline: 'param-berline',
      break: 'param-berline', SUV: 'param-suv', sportive: 'param-sportive',
      hypercar: 'param-sportive', utilitaire: 'van-argent'
    };
    return MAP[bySeg[seg]] || MAP['param-berline'];
  }

  /* --- UI sélecteur (Réglages → Véhicule) : vignettes de modèles ----------- */
  function injectStyle() {
    if (document.getElementById('posgarStyle')) return;
    var s = document.createElement('style'); s.id = 'posgarStyle';
    s.textContent =
      '.posgar-h{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint);margin:2px 0 10px;}' +
      '.posgar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:9px;}' +
      '.posgar-card{position:relative;background:var(--card);border:.5px solid var(--border);border-radius:13px;padding:12px 11px;cursor:pointer;transition:transform .14s,border-color .18s;text-align:left;}' +
      '.posgar-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--acc) 40%,var(--border));}' +
      '.posgar-card.on{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,var(--card));box-shadow:0 0 0 1px color-mix(in srgb,var(--acc) 40%,transparent);}' +
      '.posgar-nm{font-size:13px;font-weight:600;color:var(--txt);letter-spacing:-.01em;}' +
      '.posgar-tag{display:inline-block;margin-top:6px;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--dim);border:.5px solid var(--border);border-radius:6px;padding:2px 6px;}' +
      '.posgar-card.on .posgar-tag{color:var(--acc);border-color:color-mix(in srgb,var(--acc) 50%,var(--border));}' +
      '.posgar-ok{position:absolute;top:9px;right:10px;color:var(--acc);font-size:13px;display:none;}' +
      '.posgar-card.on .posgar-ok{display:block;}';
    document.head.appendChild(s);
  }

  function mountPicker(el) {
    if (!el) return function () {};
    injectStyle();
    function render() {
      var cur = api.currentId();
      el.innerHTML = '<div class="posgar-h">Ma voiture dans le hub</div>';
      var grid = document.createElement('div'); grid.className = 'posgar-grid';
      CATALOG.forEach(function (m) {
        var c = document.createElement('button'); c.type = 'button';
        c.className = 'posgar-card' + (m.id === cur ? ' on' : '');
        c.innerHTML = '<span class="posgar-ok">✓</span><div class="posgar-nm">' + m.label +
          '</div><span class="posgar-tag">' + (m.tag || '') + '</span>';
        c.addEventListener('click', function () { api.choose(m.id); render(); });
        grid.appendChild(c);
      });
      el.appendChild(grid);
    }
    var off = POS.bus.on('avatar:changed', render);
    var off2 = POS.bus.on('driver:changed', render);
    render();
    return function () { off(); off2(); el.innerHTML = ''; };
  }

  var api = {
    list: function () { return CATALOG.slice(); },
    byId: function (id) { return MAP[id] || null; },
    mountPicker: mountPicker,
    currentId: function () { return POS.store.get('avatar:id', 'auto'); },
    resolved: function () {
      var id = api.currentId();
      var m = MAP[id] || MAP['auto'];
      return (m && m.kind === 'auto') ? autoModel() : m;
    },
    choose: function (id) {
      if (!MAP[id]) return null;
      POS.store.set('avatar:id', id);
      var m = api.resolved();
      POS.bus.emit('avatar:changed', { model: m, id: id });
      return m;
    }
  };

  POS.ready(function () {
    POS.registry.register('garage', api);
    /* mémorise le dernier véhicule identifié (pour le mode 'auto') */
    POS.bus.on('vehicle:identified', function (d) {
      if (d && d.vehicle) window.__posLastVehicle = d.vehicle;
      if (api.currentId() === 'auto') POS.bus.emit('avatar:changed', { model: api.resolved(), id: 'auto' });
    });
    /* changement de conducteur -> son propre choix d'avatar */
    POS.bus.on('driver:changed', function () {
      POS.bus.emit('avatar:changed', { model: api.resolved(), id: api.currentId() });
    });
  });
})();
