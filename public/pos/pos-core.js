/* ============================================================================
   PracticeOS — POS Core
   ----------------------------------------------------------------------------
   Clé de voûte de l'architecture modulaire. Fournit à tous les modules :
     • POS.bus       — event bus pub/sub découplé (on/off/emit)
     • POS.registry  — registre de modules indépendants (register/get/list)
     • POS.store     — stockage local NAMESPACÉ PAR CONDUCTEUR (jamais mélangé)
     • POS.loop      — planificateur temps réel (budget < 16 ms / frame)
     • POS.util      — utilitaires partagés (clamp, throttle, uid…)
     • POS.ready(fn) — exécution différée quand le core est prêt
   Aucune dépendance. Chargé AVANT tous les autres modules pos-*.js.
   Style : IIFE ES2017 sans build step (compatible WKWebView / Safari iOS).
   ----------------------------------------------------------------------------
   Événements standard du bus (contrat inter-modules) :
     'telemetry'          {t,spd,rpm,throttle,brake,steer,gear,fuel,coolant,
                           batt,wheels:[fl,fr,rl,rr],lat,lon,heading,src}
     'obd:status'         {state:'off'|'connecting'|'on'|'demo', adapter, detail}
     'obd:pid'            {pid, name, value, unit}
     'vehicle:identified' {vehicle}   (schéma : voir pos-vehdb.js)
     'driver:changed'     {driver}    (profil actif : {id,name,created,...})
     'coach:advice'       {text, kind:'brake'|'accel'|'corner'|'gear'|'eco'|
                           'anticipation'|'praise', severity:0..2}
     'pos:ready'          {}          (tous les modules enregistrés)
   ============================================================================ */
(function () {
  'use strict';
  if (window.POS) return; // idempotent

  /* ---------- event bus ---------------------------------------------------- */
  var listeners = {}; // evt -> [fn]
  var bus = {
    on: function (evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return function () { bus.off(evt, fn); };
    },
    off: function (evt, fn) {
      var l = listeners[evt]; if (!l) return;
      var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
    },
    emit: function (evt, data) {
      var l = listeners[evt]; if (!l) return;
      // copie : un listener peut se désabonner pendant l'émission
      l = l.slice();
      for (var i = 0; i < l.length; i++) {
        try { l[i](data); } catch (e) { console.warn('[POS bus]', evt, e); }
      }
    }
  };

  /* ---------- registre de modules ------------------------------------------ */
  var modules = {};
  var registry = {
    register: function (name, api) {
      modules[name] = api || {};
      bus.emit('module:registered', { name: name });
      return api;
    },
    get: function (name) { return modules[name] || null; },
    list: function () { return Object.keys(modules); }
  };

  /* ---------- stockage par conducteur --------------------------------------
     Chaque conducteur possède sa propre sauvegarde. Les clés sont préfixées
     'pos:<driverId>:<clé>'. Le conducteur actif est mémorisé globalement.
     Les données ne sont JAMAIS mélangées entre conducteurs.                  */
  var GLOBAL_KEY = 'pos:activeDriver';
  var activeDriver = null;
  try { activeDriver = localStorage.getItem(GLOBAL_KEY) || null; } catch (e) {}

  function nsKey(key) { return 'pos:' + (activeDriver || 'default') + ':' + key; }

  var store = {
    driverId: function () { return activeDriver || 'default'; },
    /* change le conducteur actif (appelé par pos-drivers) */
    setDriver: function (id) {
      activeDriver = id || 'default';
      try { localStorage.setItem(GLOBAL_KEY, activeDriver); } catch (e) {}
    },
    get: function (key, def) {
      try {
        var raw = localStorage.getItem(nsKey(key));
        return raw === null ? (def === undefined ? null : def) : JSON.parse(raw);
      } catch (e) { return def === undefined ? null : def; }
    },
    set: function (key, val) {
      try { localStorage.setItem(nsKey(key), JSON.stringify(val)); } catch (e) {}
    },
    del: function (key) { try { localStorage.removeItem(nsKey(key)); } catch (e) {} },
    /* accès global (hors conducteur) — réservé aux modules système */
    gget: function (key, def) {
      try {
        var raw = localStorage.getItem('pos:g:' + key);
        return raw === null ? (def === undefined ? null : def) : JSON.parse(raw);
      } catch (e) { return def === undefined ? null : def; }
    },
    gset: function (key, val) {
      try { localStorage.setItem('pos:g:' + key, JSON.stringify(val)); } catch (e) {}
    },
    /* supprime TOUTES les clés d'un conducteur (suppression de profil) */
    wipeDriver: function (id) {
      var pre = 'pos:' + id + ':';
      var kill = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(pre) === 0) kill.push(k);
        }
        kill.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
      return kill.length;
    }
  };

  /* ---------- boucle temps réel --------------------------------------------
     Un seul requestAnimationFrame partagé. Chaque tâche déclare sa cadence
     (hz). Le budget est surveillé : si une frame dépasse ~12 ms de travail,
     les tâches basse priorité sont sautées à la frame suivante.             */
  var tasks = []; // {fn, hz, last, prio}
  var rafOn = false;
  function frame(now) {
    var start = performance.now();
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      if (now - t.last >= 1000 / t.hz) {
        if (t.prio < 1 && performance.now() - start > 12) continue; // budget
        t.last = now;
        try { t.fn(now); } catch (e) { console.warn('[POS loop]', e); }
      }
    }
    if (tasks.length) requestAnimationFrame(frame); else rafOn = false;
  }
  var loop = {
    /* prio 1 = critique (télémétrie), 0 = confort (3D, anim) */
    add: function (fn, hz, prio) {
      var t = { fn: fn, hz: hz || 10, last: 0, prio: prio === undefined ? 0 : prio };
      tasks.push(t);
      if (!rafOn) { rafOn = true; requestAnimationFrame(frame); }
      return function () { var i = tasks.indexOf(t); if (i >= 0) tasks.splice(i, 1); };
    }
  };

  /* ---------- utilitaires --------------------------------------------------- */
  var util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, k) { return a + (b - a) * k; },
    uid: function () { return 'd' + Math.random().toString(36).slice(2, 9); },
    throttle: function (fn, ms) {
      var last = 0;
      return function () {
        var n = Date.now();
        if (n - last >= ms) { last = n; return fn.apply(this, arguments); }
      };
    },
    /* format sûr d'un nombre pour l'UI */
    num: function (v, dec) { v = +v || 0; return dec ? v.toFixed(dec) : Math.round(v); }
  };

  /* ---------- ready --------------------------------------------------------- */
  var readyFns = [], isReady = false;
  function ready(fn) { if (isReady) { try { fn(); } catch (e) {} } else readyFns.push(fn); }

  window.POS = {
    bus: bus, registry: registry, store: store, loop: loop, util: util,
    ready: ready, version: '1.0.0'
  };

  /* le core est prêt dès la fin de parse ; les modules s'enregistrent ensuite */
  setTimeout(function () {
    isReady = true;
    readyFns.forEach(function (fn) { try { fn(); } catch (e) { console.warn('[POS ready]', e); } });
    readyFns = [];
    bus.emit('pos:ready', {});
  }, 0);
})();
