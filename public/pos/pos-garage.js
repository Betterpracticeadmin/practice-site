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

  var api = {
    list: function () { return CATALOG.slice(); },
    byId: function (id) { return MAP[id] || null; },
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
