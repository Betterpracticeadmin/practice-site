/* ============================================================================
   PracticeOS — POS Garage (registre de modèles + avatar véhicule du conducteur)
   ----------------------------------------------------------------------------
   Catalogue des modèles low-poly pour REPRÉSENTER le conducteur dans le hub 3D
   ET dans l'aperçu de la vue véhicule. Choix persisté PAR CONDUCTEUR.
   Les voitures du KIT sont chargées dynamiquement depuis
   /models/kit/_manifest.json (toutes les voitures propres extraites du pack).

   API (POS.registry.register('garage', api)) :
     list() · byId(id) · currentId() · resolved() · choose(id) · mountPicker(el)
   Émis : 'avatar:changed' {model,id}, 'garage:catalog' (kit chargé)
   ============================================================================ */
(function () {
  'use strict';
  if (!window.POS) return;

  /* catalogue de base (le kit s'insère juste après 'auto' une fois chargé) */
  var BASE = [
    { id: 'auto',           label: 'Auto (selon mon véhicule)', kind: 'auto',  class: 'car', tag: 'AUTO' },
    { id: 'moto',           label: 'Moto',     kind: 'fbx', src: '/models/moto.fbx', class: 'motorcycle', tag: 'RÉEL' },
    { id: 'bus',            label: 'Bus',      kind: 'fbx', src: '/models/bus.fbx',  class: 'bus',        tag: 'RÉEL' },
    { id: 'toybus',         label: 'Bus de ville', kind: 'fbx', src: '/models/toybus.fbx', class: 'bus',   tag: 'RÉEL' },
    { id: 'param-citadine', label: 'Citadine', kind: 'param', paramType: 'citadine', class: 'car', tag: 'GÉN.' },
    { id: 'param-berline',  label: 'Berline',  kind: 'param', paramType: 'berline',  class: 'car', tag: 'GÉN.' },
    { id: 'param-suv',      label: 'SUV',      kind: 'param', paramType: 'SUV',      class: 'suv', tag: 'GÉN.' },
    { id: 'param-sportive', label: 'Sportive', kind: 'param', paramType: 'sportive', class: 'car', tag: 'GÉN.' }
  ];
  var kit = [];                 // voitures du kit (chargées async)
  var CATALOG = BASE.slice();
  var MAP = {};
  function rebuild() { CATALOG = [BASE[0]].concat(kit, BASE.slice(1)); MAP = {}; CATALOG.forEach(function (m) { MAP[m.id] = m; }); }
  rebuild();

  function autoModel() {
    var seg = null; try { var v = window.__posLastVehicle; if (v && v.segment) seg = v.segment; } catch (e) {}
    var bySeg = { citadine: 'param-citadine', compacte: 'param-citadine', berline: 'param-berline',
      break: 'param-berline', SUV: 'param-suv', sportive: 'param-sportive', hypercar: 'param-sportive',
      utilitaire: 'bus' };
    return MAP[bySeg[seg]] || (kit[0] || MAP['param-berline']);
  }

  function injectStyle() {
    if (document.getElementById('posgarStyle')) return;
    var s = document.createElement('style'); s.id = 'posgarStyle';
    s.textContent =
      '.posgar-h{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint);margin:2px 0 9px;}' +
      '.posgar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-bottom:14px;}' +
      '.posgar-card{position:relative;background:var(--card);border:.5px solid var(--border);border-radius:12px;padding:11px 10px;cursor:pointer;transition:transform .14s,border-color .18s;text-align:left;}' +
      '.posgar-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--acc) 40%,var(--border));}' +
      '.posgar-card.on{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,var(--card));box-shadow:0 0 0 1px color-mix(in srgb,var(--acc) 40%,transparent);}' +
      '.posgar-thumb{width:100%;height:60px;object-fit:contain;display:block;margin-bottom:7px;}' +
      '.posgar-thumb-gen{display:flex;align-items:center;justify-content:center;height:60px;margin-bottom:7px;color:var(--faint);font-size:26px;}' +
      '.posgar-nm{font-size:12.5px;font-weight:600;color:var(--txt);letter-spacing:-.01em;}' +
      '.posgar-tag{display:inline-block;margin-top:5px;font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--dim);border:.5px solid var(--border);border-radius:6px;padding:2px 6px;}' +
      '.posgar-card.on .posgar-tag{color:var(--acc);border-color:color-mix(in srgb,var(--acc) 50%,var(--border));}' +
      '.posgar-ok{position:absolute;top:8px;right:9px;color:var(--acc);font-size:12px;display:none;}' +
      '.posgar-card.on .posgar-ok{display:block;}';
    document.head.appendChild(s);
  }

  function mountPicker(el) {
    if (!el) return function () {};
    injectStyle();
    function section(title, items, cur, root) {
      if (!items.length) return;
      var h = document.createElement('div'); h.className = 'posgar-h'; h.textContent = title; root.appendChild(h);
      var grid = document.createElement('div'); grid.className = 'posgar-grid';
      items.forEach(function (m) {
        var c = document.createElement('button'); c.type = 'button';
        c.className = 'posgar-card' + (m.id === cur ? ' on' : '');
        var hasThumb = (m.kind === 'glb' || m.kind === 'fbx');
        var thumb = hasThumb
          ? '<img class="posgar-thumb" src="/models/thumbs/' + m.id + '.png" alt="" loading="lazy">'
          : '<div class="posgar-thumb-gen">▦</div>';
        c.innerHTML = '<span class="posgar-ok">✓</span>' + thumb + '<div class="posgar-nm">' + m.label +
          '</div><span class="posgar-tag">' + (m.tag || '') + '</span>';
        c.addEventListener('click', function () { api.choose(m.id); render(); });
        grid.appendChild(c);
      });
      root.appendChild(grid);
    }
    function render() {
      var cur = api.currentId(); el.innerHTML = '';
      section('Voitures du kit', kit, cur, el);
      section('Autres véhicules', BASE.filter(function (m) { return m.kind === 'fbx'; }), cur, el);
      section('Générés / auto', BASE.filter(function (m) { return m.kind === 'param' || m.kind === 'auto'; }), cur, el);
    }
    var offs = [POS.bus.on('avatar:changed', render), POS.bus.on('driver:changed', render), POS.bus.on('garage:catalog', render)];
    render();
    return function () { offs.forEach(function (f) { f(); }); el.innerHTML = ''; };
  }

  var api = {
    list: function () { return CATALOG.slice(); },
    byId: function (id) { return MAP[id] || null; },
    mountPicker: mountPicker,
    currentId: function () { return POS.store.get('avatar:id', 'auto'); },
    resolved: function () {
      var m = MAP[api.currentId()] || MAP['auto'];
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
    /* charge toutes les voitures du kit */
    try {
      fetch('/models/kit/_manifest.json').then(function (r) { return r.json(); }).then(function (list) {
        kit = (list || []).map(function (e, i) {
          return { id: e.id, label: 'Voiture ' + String(i + 1).padStart(2, '0'), kind: 'glb', src: e.file, class: 'car', tag: 'KIT' };
        });
        rebuild();
        POS.bus.emit('garage:catalog', { count: kit.length });
        if (api.currentId() !== 'auto') POS.bus.emit('avatar:changed', { model: api.resolved(), id: api.currentId() });
      }).catch(function () {});
    } catch (e) {}
    POS.bus.on('vehicle:identified', function (d) {
      if (d && d.vehicle) window.__posLastVehicle = d.vehicle;
      if (api.currentId() === 'auto') POS.bus.emit('avatar:changed', { model: api.resolved(), id: 'auto' });
    });
    POS.bus.on('driver:changed', function () {
      POS.bus.emit('avatar:changed', { model: api.resolved(), id: api.currentId() });
    });
  });
})();
