/* ============================================================================
   PracticeOS — OBD MANAGER (pos-obd.js)
   ----------------------------------------------------------------------------
   Gestionnaire OBD-II multi-adaptateurs. Parle le protocole ELM327 au-dessus
   d'une couche d'abstraction d'adaptateurs : il est FACILE d'ajouter un
   nouveau calculateur / transport plus tard via api.registerAdapter().

   Interface d'un adaptateur :
     {
       id:'ble',                    // identifiant unique
       label:'Bluetooth LE',        // libellé UI
       available():bool,            // le transport existe-t-il ici ?
       detail():string|null,        // raison si indisponible (null sinon)
       connect():Promise,           // ouverture (peut afficher un chooser)
       silentConnect():Promise<bool>// optionnel — tentative SANS popup
       reconnect():Promise,         // optionnel — re-attache le même appareil
       disconnect():Promise,
       send(cmd):Promise<string>,   // envoie une commande ELM, résout la
                                    // réponse complète (jusqu'au prompt '>')
       onData(fn):off,              // flux brut (debug / traces)
       onDrop(fn),                  // liaison perdue (déclenche la reco auto)
       info():string|null           // nom de l'appareil connecté
     }

   Adaptateurs fournis :
     • 'ble'  — Web Bluetooth ELM327 (logique PORTÉE d'obd.html, qui marche)
     • 'usb'  — Web Serial ELM327 USB (38400 puis 115200)
     • 'wifi' — stub honnête : socket TCP impossible en navigateur ;
                interface complète prête pour l'app native Capacitor
     • 'demo' — simulateur : répond comme un vrai ELM327 (masques 0100/0120/
                0140, VIN multi-trame, PID encodés) — exerce TOUT le pipeline

   API publique (POS.registry.register('obd', api)) :
     connect(adapterId?)   — connecte (dernier utilisé sinon meilleur dispo)
     disconnect()          — coupe proprement
     autoConnect()         — tentative silencieuse au boot (jamais de popup)
     state()               — {state, adapter, vin, supported, values}
     adapters()            — [{id,label,available,detail}]
     readVIN()             — relit le VIN (mode 09 PID 02, multi-trame)
     registerAdapter(a)    — ajoute un adaptateur externe
     destroy()             — libère boucles + listeners

   Événements émis sur POS.bus :
     'obd:status' {state:'off'|'connecting'|'on'|'demo', adapter, detail}
     'obd:pid'    {pid, name, value, unit [, src]}
     'obd:vin'    {vin}
     'telemetry'  {t,spd,rpm,throttle,brake,steer,gear,fuel,coolant,batt,
                   wheels,lat,lon,heading,src}   (~10 Hz quand connecté)
     'pos:demo'   {on:boolean}
   Événements écoutés : 'gps:fix' (fusionné dans 'telemetry').

   LIMITES DOCUMENTÉES :
     • Angle volant, pression de frein, vitesses de roues individuelles et
       rapport engagé ne sont PAS des PID OBD-II standard : ils passent par
       des requêtes UDS propriétaires (mode 22, DID constructeur) qui varient
       par marque. Ici : le RAPPORT est ESTIMÉ (ratio régime/vitesse, champ
       gearSrc:'estimé'), le frein est estimé par décélération, volant/roues
       sont null hors démo. Un adaptateur UDS pourra les fournir plus tard.
     • Wi-Fi OBD (192.168.0.10:35000) exige un socket TCP → app native.
     • POS.loop repose sur requestAnimationFrame : onglet masqué = polling
       en pause (comportement navigateur normal).
   Style : IIFE ES2017, aucun build step, compatible Safari iOS / WKWebView.
   ============================================================================ */
(function () {
  'use strict';

  var bus, store, loop, util; // raccourcis POS.* (résolus dans boot)

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hex2(n) { return ('0' + (n & 255).toString(16)).slice(-2).toUpperCase(); }

  /* ==========================================================================
     TABLE DES PID (mode 01 sauf mention) — formules SAE J1979
     b = tableau d'octets de données (après '41 <pid>')
     ========================================================================== */
  var PID_DEFS = {
    '0104': { name: 'engine_load', unit: '%',      n: 1, calc: function (b) { return b[0] * 100 / 255; } },
    '0105': { name: 'coolant',     unit: '°C',     n: 1, calc: function (b) { return b[0] - 40; } },
    '010A': { name: 'fuel_press',  unit: 'kPa',    n: 1, calc: function (b) { return b[0] * 3; } },
    '010C': { name: 'rpm',         unit: 'tr/min', n: 2, calc: function (b) { return (b[0] * 256 + b[1]) / 4; } },
    '010D': { name: 'speed',       unit: 'km/h',   n: 1, calc: function (b) { return b[0]; } },
    '0110': { name: 'maf',         unit: 'g/s',    n: 2, calc: function (b) { return (b[0] * 256 + b[1]) / 100; } },
    '0111': { name: 'throttle',    unit: '%',      n: 1, calc: function (b) { return b[0] * 100 / 255; } },
    '012F': { name: 'fuel_level',  unit: '%',      n: 1, calc: function (b) { return b[0] * 100 / 255; } },
    '0142': { name: 'batt',        unit: 'V',      n: 2, calc: function (b) { return (b[0] * 256 + b[1]) / 1000; } },
    '0149': { name: 'accel_pedal', unit: '%',      n: 1, calc: function (b) { return b[0] * 100 / 255; } },
    '015C': { name: 'oil_temp',    unit: '°C',     n: 1, calc: function (b) { return b[0] - 40; } },
    '015E': { name: 'fuel_rate',   unit: 'L/h',    n: 2, calc: function (b) { return (b[0] * 256 + b[1]) / 20; } }
  };
  // PID critiques (~10 Hz) et lents (~1 Hz) — voir planificateur de polling
  var FAST_PIDS = ['010C', '010D', '0111'];
  var SLOW_PIDS = ['0104', '0105', '010A', '0110', '012F', '0142', '0149', '015C', '015E'];

  /* Parse une réponse mode 01 : "41 0C 1A F8" ou "410C1AF8" (adaptateurs qui
     suppriment les espaces), avec éventuel préfixe SEARCHING... — porté
     d'obd.html et généralisé. Retourne un tableau d'octets ou null. */
  function parseBytes(resp, pid) {
    resp = String(resp || '').replace(/SEARCHING\.*/gi, ' ');
    var hex = resp.replace(/[^0-9A-Fa-f ]/g, ' ').trim().split(/\s+/);
    var i = -1, k;
    for (k = 0; k < hex.length; k++) {
      if (hex[k] === '41' && hex[k + 1] && ('01' + hex[k + 1]).toUpperCase() === pid) { i = k; break; }
    }
    if (i < 0) { // certains adaptateurs collent tout
      var flat = resp.replace(/[^0-9A-Fa-f]/g, '');
      var key = '41' + pid.slice(2);
      var p = flat.toUpperCase().indexOf(key);
      if (p < 0) return null;
      var bytes = [];
      for (var q = p + 4; q < flat.length; q += 2) bytes.push(parseInt(flat.substr(q, 2), 16));
      return bytes;
    }
    var b = [];
    for (var j = i + 2; j < hex.length; j++) { var v = parseInt(hex[j], 16); if (!isNaN(v)) b.push(v); }
    return b;
  }

  /* Parse le VIN (mode 09 PID 02) — réponse MULTI-TRAME. Deux formats vus :
       CAN ISO-TP (ELM) :   "014"  puis lignes "0:490201..." "1:..." "2:..."
       ISO/KWP anciennes :  lignes répétées "49 02 01 ..." "49 02 02 ..."
     Stratégie robuste : on retire indices de trame et longueur, on décode
     TOUTES les paires hex après le premier '4902' en ASCII, puis on ne garde
     que les caractères légaux d'un VIN [A-HJ-NPR-Z0-9] (les compteurs de
     trame 0x01/0x02, le padding 0x00 et les en-têtes 0x49='I'/0x02 sont
     naturellement filtrés puisque I, O, Q n'existent pas dans un VIN).     */
  function parseVIN(resp) {
    var flat = String(resp || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\b[0-9A-Fa-f]{1,2}:\s*/g, '') // indices ISO-TP "0:", "1:"…
      .replace(/[^0-9A-Fa-f]/g, '')
      .toUpperCase();
    var p = flat.indexOf('4902');
    if (p < 0) return null;
    var chars = '';
    for (var i = p + 4; i + 2 <= flat.length; i += 2) {
      var c = String.fromCharCode(parseInt(flat.substr(i, 2), 16));
      if (/[A-HJ-NPR-Z0-9]/.test(c)) chars += c;
    }
    return chars.length >= 17 ? chars.slice(0, 17) : null;
  }

  /* ==========================================================================
     FILE DE COMMANDES ELM — partagée BLE / USB (portée d'obd.html)
     Une commande à la fois ; la réponse s'accumule jusqu'au prompt '>' ;
     timeout de sécurité si l'adaptateur ne renvoie jamais le prompt.
     ========================================================================== */
  function makeElmQueue(writeRaw) {
    var queue = [], pending = null, buf = '';
    function pump() {
      if (pending || !queue.length) return;
      pending = queue.shift(); buf = '';
      writeRaw(pending.cmd + '\r').catch(function (e) {
        if (pending) { pending.rej(e); pending = null; }
        pump();
      });
      pending._to = setTimeout(function () {
        if (pending) { var p = pending; pending = null; p.res(buf); pump(); }
      }, pending.tmo || 1400);
    }
    return {
      send: function (cmd, tmo) {
        return new Promise(function (res, rej) {
          queue.push({ cmd: cmd, res: res, rej: rej, tmo: tmo }); pump();
        });
      },
      feed: function (s) { // octets reçus du transport
        buf += s;
        if (buf.indexOf('>') >= 0 && pending) {
          clearTimeout(pending._to);
          var p = pending; pending = null;
          p.res(buf.replace(/>/g, '').trim());
          pump();
        }
      },
      reset: function () {
        if (pending) { clearTimeout(pending._to); try { pending.rej(new Error('reset')); } catch (e) {} }
        queue = []; pending = null; buf = '';
      }
    };
  }

  /* Séquence d'init ELM327 (identique à obd.html) : reset, écho off, saut de
     ligne off, espaces off, en-têtes off, protocole auto, puis un 0100 pour
     forcer la recherche du protocole véhicule. */
  function initELM(send) {
    var seq = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];
    var p = Promise.resolve();
    seq.forEach(function (cmd) {
      p = p.then(function () {
        return send(cmd).catch(function () {}).then(function () {
          return sleep(cmd === 'ATZ' ? 420 : 90);
        });
      });
    });
    return p.then(function () { return send('0100', 4000).catch(function () {}); });
  }

  /* ==========================================================================
     ADAPTATEUR 1 : 'ble' — Web Bluetooth ELM327 (porté d'obd.html)
     ========================================================================== */
  function makeBleAdapter() {
    // Services série BLE connus des adaptateurs classe ELM327
    // (Vgate, Veepeak, OBDLink, V-Link, Konnwei…) — liste d'obd.html
    var UART = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';  // Nordic UART
    var ISSC = '49535343-fe7d-4ae5-8fa9-9fafd205e455';  // Microchip/ISSC
    var SERVICES = [
      0xFFE0, 0xFFF0, 0xFFE5, 0xFFC0, 0xFEE7, 0x18F0, 0xFFB0, 0xFD00,
      UART, ISSC,
      '0000ffe0-0000-1000-8000-00805f9b34fb',
      '0000fff0-0000-1000-8000-00805f9b34fb',
      '0000ffe5-0000-1000-8000-00805f9b34fb',
      '0000ffc0-0000-1000-8000-00805f9b34fb',
      '0000fee7-0000-1000-8000-00805f9b34fb'
    ];
    var dev = null, gatt = null, wCh = null, nCh = null;
    var dataFns = [], dropFn = null, closing = false;
    var q = makeElmQueue(function (str) {
      if (!wCh) return Promise.reject(new Error('BLE non connecté'));
      var data = new TextEncoder().encode(str);
      return wCh.writeValueWithoutResponse
        ? wCh.writeValueWithoutResponse(data)
        : wCh.writeValue(data);
    });

    function onNotify(ev) {
      var v = ev.target.value, s = '';
      for (var i = 0; i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(i));
      q.feed(s);
      for (var j = 0; j < dataFns.length; j++) { try { dataFns[j](s); } catch (e) {} }
    }
    function onGattDrop() {
      wCh = null; nCh = null; q.reset();
      if (!closing && dropFn) dropFn();
    }

    /* Choisit un couple écriture/notification DANS LE MÊME service
       (privilégie une caractéristique mixte) — porté tel quel d'obd.html */
    function pickChars(svcs) {
      var idx = 0, gW = null, gN = null;
      function next() {
        if (idx >= svcs.length) return Promise.resolve((gW && gN) ? { w: gW, n: gN } : null);
        var svc = svcs[idx++];
        return svc.getCharacteristics().then(function (chs) {
          var w = null, n = null, both = null;
          for (var j = 0; j < chs.length; j++) {
            var c = chs[j], p = c.properties;
            if ((p.write || p.writeWithoutResponse) && (p.notify || p.indicate)) both = both || c;
            if (p.notify || p.indicate) n = n || c;
            if (p.write || p.writeWithoutResponse) w = w || c;
          }
          if (both) return { w: both, n: both };
          if (w && n) return { w: w, n: n };
          gW = gW || w; gN = gN || n;
          return next();
        }, function () { return next(); });
      }
      return next();
    }

    function setupGatt() {
      return dev.gatt.connect().then(function (g) {
        gatt = g;
        return gatt.getPrimaryServices();
      }).then(function (svcs) {
        return pickChars(svcs);
      }).then(function (ch) {
        if (!ch) { var e = new Error('NO_SERIAL'); e.code = 'NO_SERIAL'; throw e; }
        wCh = ch.w; nCh = ch.n; q.reset();
        return nCh.startNotifications();
      }).then(function () {
        nCh.addEventListener('characteristicvaluechanged', onNotify);
      });
    }

    function attach(device) {
      dev = device; closing = false;
      dev.addEventListener('gattserverdisconnected', onGattDrop);
      return setupGatt().then(function () {
        // mémorise l'appareil pour la reconnexion silencieuse au prochain boot
        try { store.gset('obd:lastDeviceId', dev.id); store.gset('obd:lastDeviceName', dev.name || ''); } catch (e) {}
      });
    }

    return {
      id: 'ble',
      label: 'Bluetooth LE (ELM327)',
      available: function () { return !!navigator.bluetooth; },
      detail: function () {
        if (navigator.bluetooth) return null;
        var isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        return isApple
          ? 'Safari iOS ne gère pas le Bluetooth web — utiliser l\'app native Practice (ou Bluefy)'
          : 'Bluetooth web indisponible — utiliser Chrome ou Edge';
      },
      connect: function () { // popup de sélection (geste utilisateur requis)
        return navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES })
          .then(attach);
      },
      silentConnect: function () { // SANS popup — uniquement si permission gardée
        if (!navigator.bluetooth || !navigator.bluetooth.getDevices) return Promise.resolve(false);
        var wantId = store.gget('obd:lastDeviceId');
        return navigator.bluetooth.getDevices().then(function (devs) {
          if (!devs || !devs.length) return false;
          var d = null;
          for (var i = 0; i < devs.length; i++) if (devs[i].id === wantId) d = devs[i];
          d = d || devs[0];
          // gatt.connect() ne timeout jamais tout seul : on borne à 8 s
          return Promise.race([
            attach(d).then(function () { return true; }),
            sleep(8000).then(function () { throw new Error('timeout BLE silencieux'); })
          ]);
        }).catch(function () { return false; });
      },
      reconnect: function () { // re-attache le MÊME appareil (liaison perdue)
        if (!dev) return Promise.reject(new Error('aucun appareil mémorisé'));
        return setupGatt();
      },
      disconnect: function () {
        closing = true; q.reset();
        if (nCh) { try { nCh.removeEventListener('characteristicvaluechanged', onNotify); } catch (e) {} }
        if (dev) { try { dev.removeEventListener('gattserverdisconnected', onGattDrop); } catch (e) {} }
        if (gatt && gatt.connected) { try { gatt.disconnect(); } catch (e) {} }
        wCh = null; nCh = null; gatt = null; dev = null;
        return Promise.resolve();
      },
      send: function (cmd, tmo) { return q.send(cmd, tmo); },
      onData: function (fn) { dataFns.push(fn); return function () { var i = dataFns.indexOf(fn); if (i >= 0) dataFns.splice(i, 1); }; },
      onDrop: function (fn) { dropFn = fn; },
      info: function () { return dev ? (dev.name || 'OBD BLE') : null; }
    };
  }

  /* ==========================================================================
     ADAPTATEUR 2 : 'usb' — Web Serial ELM327 USB
     Ouvre à 38400 bauds (défaut ELM327), retente à 115200 (clones récents).
     ========================================================================== */
  function makeUsbAdapter() {
    var port = null, reader = null, writer = null;
    var dataFns = [], dropFn = null, closing = false;
    var q = makeElmQueue(function (str) {
      if (!writer) return Promise.reject(new Error('USB non connecté'));
      return writer.write(new TextEncoder().encode(str));
    });

    function startReader() { // pompe de lecture continue → file ELM
      reader = port.readable.getReader();
      (function loopRead() {
        reader.read().then(function (r) {
          if (r.done) { if (!closing && dropFn) dropFn(); return; }
          var s = '';
          for (var i = 0; i < r.value.length; i++) s += String.fromCharCode(r.value[i]);
          q.feed(s);
          for (var j = 0; j < dataFns.length; j++) { try { dataFns[j](s); } catch (e) {} }
          loopRead();
        }).catch(function () { if (!closing && dropFn) dropFn(); });
      })();
    }

    function closeStreams() {
      var p = Promise.resolve();
      if (reader) { try { p = reader.cancel().catch(function () {}); } catch (e) {} reader = null; }
      if (writer) { try { writer.releaseLock(); } catch (e) {} writer = null; }
      return p.then(function () {
        if (port) { return port.close().catch(function () {}); }
      });
    }

    /* Essaie chaque vitesse ; valide en sondant l'ELM (ATZ doit répondre
       quelque chose de lisible — 'ELM327', 'OK' ou au moins un prompt). */
    function openPort(p) {
      port = p;
      var bauds = [38400, 115200], i = 0;
      function tryBaud() {
        if (i >= bauds.length) {
          port = null;
          return Promise.reject(new Error('Aucune réponse ELM327 (essayé 38400 et 115200 bauds)'));
        }
        var baud = bauds[i++];
        return port.open({ baudRate: baud }).then(function () {
          q.reset(); closing = false;
          writer = port.writable.getWriter();
          startReader();
          return q.send('ATZ', 1600);
        }).then(function (r) {
          if (/ELM|OK|V[0-9]/i.test(r) || r.indexOf('>') >= 0 || r.length > 2) return true; // ELM détecté
          closing = true;
          return closeStreams().then(function () { return tryBaud(); });
        }).catch(function () {
          closing = true;
          return closeStreams().then(function () { return tryBaud(); });
        });
      }
      return tryBaud();
    }

    return {
      id: 'usb',
      label: 'USB série (ELM327)',
      available: function () { return !!navigator.serial; },
      detail: function () {
        return navigator.serial ? null
          : 'Web Serial indisponible — Chrome/Edge sur ordinateur uniquement (pas mobile, pas Safari)';
      },
      connect: function () {
        return navigator.serial.requestPort().then(openPort);
      },
      silentConnect: function () { // ports déjà autorisés → pas de popup
        if (!navigator.serial || !navigator.serial.getPorts) return Promise.resolve(false);
        return navigator.serial.getPorts().then(function (ports) {
          if (!ports || !ports.length) return false;
          return openPort(ports[0]).then(function () { return true; });
        }).catch(function () { return false; });
      },
      reconnect: function () {
        if (!port) return Promise.reject(new Error('aucun port mémorisé'));
        var p = port; port = null;
        return openPort(p);
      },
      disconnect: function () {
        closing = true; q.reset();
        return closeStreams().then(function () { port = null; });
      },
      send: function (cmd, tmo) { return q.send(cmd, tmo); },
      onData: function (fn) { dataFns.push(fn); return function () { var i = dataFns.indexOf(fn); if (i >= 0) dataFns.splice(i, 1); }; },
      onDrop: function (fn) { dropFn = fn; },
      info: function () { return port ? 'ELM327 USB' : null; }
    };
  }

  /* ==========================================================================
     ADAPTATEUR 3 : 'wifi' — STUB honnête
     Les adaptateurs Wi-Fi ELM327 exposent un socket TCP brut (généralement
     192.168.0.10:35000) : IMPOSSIBLE depuis un navigateur (pas d'API TCP).
     L'interface est complète et prête : dans l'app native Capacitor, il
     suffira de brancher un plugin socket (ex. capacitor-tcp-socket) dans
     connect()/send() sans toucher au reste du manager.
     ========================================================================== */
  function makeWifiAdapter() {
    var ERR = 'Wi-Fi OBD nécessite l\'app native (socket TCP impossible en navigateur)';
    return {
      id: 'wifi',
      label: 'Wi-Fi (ELM327)',
      available: function () { return false; }, // deviendra vrai sous Capacitor
      detail: function () { return ERR; },
      connect: function () { return Promise.reject(new Error(ERR)); },
      silentConnect: function () { return Promise.resolve(false); },
      disconnect: function () { return Promise.resolve(); },
      send: function () { return Promise.reject(new Error(ERR)); },
      onData: function () { return function () {}; },
      onDrop: function () {},
      info: function () { return null; }
    };
  }

  /* ==========================================================================
     ADAPTATEUR 4 : 'demo' — simulateur ELM327 complet
     Répond aux commandes AT, aux masques 0100/0120/0140, au VIN multi-trame
     et aux PID de la table avec un cycle de conduite urbain/route réaliste
     (arrêts, accélérations, croisière, freinages, virages, rapports).
     Le manager le traite EXACTEMENT comme un vrai adaptateur : la démo
     exerce donc tout le pipeline (init, découverte, VIN, polling, parsing).
     ========================================================================== */
  function makeDemoAdapter() {
    var running = false, stopSim = null, dataFns = [];
    var DEMO_VIN = 'WP0ZZZ99ZTS392124'; // 17 caractères VIN-légaux (sans I/O/Q)
    // tr/min par km/h pour chaque rapport (boîte 6 typique) — sert aussi
    // de référence à l'ESTIMATION de rapport côté manager
    var RATIOS = [0, 135, 78, 54, 41, 33, 27];

    // état simulé (unités physiques)
    var s = {
      spd: 0, rpm: 850, thr: 0, brk: 0, steer: 0, steerT: 0, gearN: 0,
      fuel: 64, cool: 19, oil: 16, batt: 14.2, load: 14, maf: 2.5,
      fuelPress: 348, pedal: 0, fuelRate: 0.8, heading: 137,
      phase: 'stop', phT: 0, phDur: 3, target: 0
    };

    function pickGear(spd) {
      if (spd < 2) return 1;
      var thr = [0, 18, 38, 62, 88, 118]; // seuils de passage (km/h)
      var g = 1;
      for (var i = 1; i < thr.length; i++) if (spd > thr[i]) g = i + 1;
      return Math.min(g, 6);
    }
    function nextPhase() {
      s.phT = 0;
      if (s.phase === 'stop') { s.phase = 'accel'; s.target = 30 + Math.random() * 80; s.phDur = 30; }
      else if (s.phase === 'accel') { s.phase = 'cruise'; s.target = s.spd; s.phDur = 5 + Math.random() * 12; }
      else if (s.phase === 'cruise') {
        if (Math.random() < 0.35) { s.phase = 'accel'; s.target = Math.min(125, s.spd + 15 + Math.random() * 30); s.phDur = 25; }
        else { s.phase = 'brake'; s.target = Math.random() < 0.5 ? 0 : Math.max(15, s.spd - 30 - Math.random() * 30); s.phDur = 20; }
      } else { // fin de freinage
        if (s.spd < 3) { s.phase = 'stop'; s.phDur = 2 + Math.random() * 6; s.spd = 0; }
        else { s.phase = 'cruise'; s.target = s.spd; s.phDur = 4 + Math.random() * 8; }
      }
    }
    function update(dt) {
      s.phT += dt;
      if (s.phT > s.phDur) nextPhase();
      if (s.phase === 'accel') {
        s.thr = util.lerp(s.thr, 55 + Math.random() * 25, 0.12);
        s.brk = 0;
        var a = util.clamp((s.thr / 100) * 3.4 * (1 - s.spd / 170), 0.4, 3.4); // m/s²
        s.spd += a * 3.6 * dt;
        if (s.spd >= s.target) nextPhase();
      } else if (s.phase === 'cruise') {
        s.thr = util.lerp(s.thr, 13 + Math.sin(s.phT * 0.7) * 4, 0.1);
        s.brk = 0;
        s.spd = util.lerp(s.spd, s.target + Math.sin(s.phT * 0.5) * 2, 0.03);
      } else if (s.phase === 'brake') {
        s.thr = util.lerp(s.thr, 0, 0.3);
        s.brk = util.lerp(s.brk, 35 + Math.random() * 25, 0.15);
        s.spd -= (2 + s.brk / 30) * 3.6 * dt;
        if (s.spd <= s.target + 1) { s.spd = Math.max(s.target, 0); nextPhase(); }
      } else { // stop
        s.thr = 0; s.brk = s.spd > 0.5 ? 30 : 8;
        s.spd = Math.max(0, s.spd - 5 * 3.6 * dt);
      }
      // virages : plus fréquents et plus marqués à basse vitesse (urbain)
      if (Math.random() < 0.02) s.steerT = (Math.random() - 0.5) * (s.spd < 55 ? 220 : 40);
      if (Math.random() < 0.03) s.steerT = 0;
      s.steer = util.lerp(s.steer, s.spd > 1 ? s.steerT : 0, 0.06);
      s.heading = (s.heading + s.steer * 0.0015 * s.spd * dt * 60 + 360) % 360;
      // moteur
      s.gearN = s.spd < 2 ? 0 : pickGear(s.spd);
      var rpmT = s.spd < 2 ? 850 + s.thr * 12 : util.clamp(s.spd * RATIOS[Math.max(s.gearN, 1)] + s.thr * 6, 800, 6500);
      s.rpm = util.lerp(s.rpm, rpmT, 0.25);
      s.load = util.clamp(14 + s.thr * 0.75 + s.spd * 0.08, 5, 98);
      s.pedal = util.clamp(s.thr * 0.92, 0, 100);
      s.maf = util.clamp((s.rpm / 1000) * (1.6 + s.load / 22), 1.5, 180);
      s.fuelRate = util.clamp(s.maf / 14.7 / 745 * 3600, 0.5, 45); // L/h essence
      s.fuel = Math.max(2, s.fuel - (s.fuelRate / 3600 * dt) / 50 * 100); // réservoir 50 L
      s.cool = util.lerp(s.cool, 91, dt / 55);
      s.oil = util.lerp(s.oil, 96, dt / 90);
      s.batt = 14.1 + Math.sin(s.phT * 2) * 0.12;
      s.fuelPress = 340 + s.load * 0.6;
    }

    /* -------- encodage ELM inverse (valeur physique → octets hex) -------- */
    function b1(v) { return hex2(Math.round(util.clamp(v, 0, 255))); }
    function b2(v) { v = Math.round(util.clamp(v, 0, 65535)); return hex2(v >> 8) + hex2(v & 255); }
    var ENC = {
      '0104': function () { return b1(s.load * 255 / 100); },
      '0105': function () { return b1(s.cool + 40); },
      '010A': function () { return b1(s.fuelPress / 3); },
      '010C': function () { return b2(s.rpm * 4); },
      '010D': function () { return b1(s.spd); },
      '0110': function () { return b2(s.maf * 100); },
      '0111': function () { return b1(s.thr * 255 / 100); },
      '012F': function () { return b1(s.fuel * 255 / 100); },
      '0142': function () { return b2(s.batt * 1000); },
      '0149': function () { return b1(s.pedal * 255 / 100); },
      '015C': function () { return b1(s.oil + 40); },
      '015E': function () { return b2(s.fuelRate * 20); }
    };
    /* masque "PID supportés" : bit (p-1) du mot de 32 bits de la plage */
    function mask(base, list) {
      var by = [0, 0, 0, 0];
      list.forEach(function (n) {
        var p = n - base;
        if (p >= 1 && p <= 32) by[(p - 1) >> 3] |= 0x80 >> ((p - 1) & 7);
      });
      return hex2(by[0]) + hex2(by[1]) + hex2(by[2]) + hex2(by[3]);
    }
    var MASK_1 = mask(0x00, [0x04, 0x05, 0x0A, 0x0C, 0x0D, 0x10, 0x11, 0x20]); // +0x20 = plage suivante
    var MASK_2 = mask(0x20, [0x2F, 0x40]);
    var MASK_3 = mask(0x40, [0x42, 0x49, 0x5C, 0x5E]);
    function vinFrames() { // trames ISO-TP telles qu'imprimées par un ELM (ATS0)
      var hex = '490201';
      for (var i = 0; i < DEMO_VIN.length; i++) hex += hex2(DEMO_VIN.charCodeAt(i));
      return '014\r0:' + hex.slice(0, 12) + '\r1:' + hex.slice(12, 26) + '\r2:' + hex.slice(26, 40);
    }
    function reply(cmd) {
      cmd = String(cmd).toUpperCase().replace(/\s/g, '');
      if (cmd === 'ATZ') return 'ELM327 v1.5 (simulateur Practice)';
      if (cmd === 'ATRV') return s.batt.toFixed(1) + 'V';
      if (cmd.indexOf('AT') === 0) return 'OK';
      if (cmd === '0100') return '4100' + MASK_1;
      if (cmd === '0120') return '4120' + MASK_2;
      if (cmd === '0140') return '4140' + MASK_3;
      if (cmd === '0902') return vinFrames();
      if (ENC[cmd]) return '41' + cmd.slice(2) + ENC[cmd]();
      return 'NO DATA';
    }

    return {
      id: 'demo',
      label: 'Simulation (démo)',
      available: function () { return true; }, // connecte toujours
      detail: function () { return null; },
      connect: function () {
        running = true;
        var last = 0;
        // cycle de conduite mis à jour à 10 Hz via la boucle partagée POS.loop
        stopSim = loop.add(function (now) {
          var dt = last ? Math.min((now - last) / 1000, 0.25) : 0.1;
          last = now;
          update(dt);
        }, 10, 1);
        return Promise.resolve();
      },
      silentConnect: function () { return Promise.resolve(false); }, // jamais en auto
      reconnect: function () { return this.connect(); },
      disconnect: function () {
        running = false;
        if (stopSim) { stopSim(); stopSim = null; }
        return Promise.resolve();
      },
      send: function (cmd) { // latence série simulée (~25 ms)
        return new Promise(function (res, rej) {
          if (!running) { rej(new Error('démo déconnectée')); return; }
          setTimeout(function () {
            var r = reply(cmd);
            for (var j = 0; j < dataFns.length; j++) { try { dataFns[j](r + '\r>'); } catch (e) {} }
            res(r);
          }, 25);
        });
      },
      onData: function (fn) { dataFns.push(fn); return function () { var i = dataFns.indexOf(fn); if (i >= 0) dataFns.splice(i, 1); }; },
      onDrop: function () {}, // la démo ne se coupe jamais
      info: function () { return 'Simulateur ELM327'; },
      /* extension démo : le manager y lit frein/volant/roues (données UDS
         constructeur impossibles à obtenir en OBD-II standard) */
      simState: function () {
        var w = s.spd, d = s.steer * 0.0006 * s.spd; // différentiel en virage
        return {
          brk: Math.round(s.brk), steer: Math.round(s.steer),
          heading: Math.round(s.heading), gearN: s.gearN,
          wheels: [
            Math.round((w - d) * 10) / 10, Math.round((w + d) * 10) / 10,
            Math.round((w - d * 0.7) * 10) / 10, Math.round((w + d * 0.7) * 10) / 10
          ]
        };
      }
    };
  }

  /* ==========================================================================
     MANAGER — orchestration : connexion, init, découverte, polling, télémétrie
     ========================================================================== */
  var ADAPTERS = {};      // id -> adaptateur
  var ORDER = [];         // ordre de préférence pour bestAvailable()
  function registerAdapter(a) {
    if (!a || !a.id) return;
    if (!ADAPTERS[a.id]) ORDER.push(a.id);
    ADAPTERS[a.id] = a;
  }

  var st = {
    state: 'off', adapter: null, adapterId: null, vin: null,
    supported: null,      // {pid:true} ou null si découverte impossible
    vals: {},             // pid -> {name,value,unit,t}
    reconnectTries: 0, userDisconnect: false,
    stopPoll: null, stopTel: null,
    fastList: [], slowList: [],
    gps: null,            // dernier 'gps:fix'
    prevSpd: null, prevSpdT: 0, brakeEst: 0
  };
  var offGps = null;      // désabonnement bus (destroy)

  function emitStatus(state, adapterId, detail) {
    st.state = state;
    bus.emit('obd:status', { state: state, adapter: adapterId || null, detail: detail || '' });
  }
  function isOn() { return st.state === 'on' || st.state === 'demo'; }

  function bestAvailable() { // premier adaptateur réel dispo, sinon démo
    for (var i = 0; i < ORDER.length; i++) {
      var a = ADAPTERS[ORDER[i]];
      if (a.id !== 'demo' && a.available()) return a.id;
    }
    return 'demo';
  }

  function humanErr(e) { // messages d'erreur lisibles (porté d'obd.html)
    var msg = (e && e.message) || String(e), name = (e && e.name) || '';
    if (name === 'NotFoundError' || /cancel|chooser|User cancelled|No port selected/i.test(msg))
      return 'Aucun appareil sélectionné. Réessaie et choisis ton adaptateur dans la liste.';
    if ((e && e.code === 'NO_SERIAL') || /NO_SERIAL/.test(msg))
      return 'Canal série introuvable — adaptateur chiffré (type Carly) ou non-ELM327. Utilise un ELM327 générique (Vgate iCar Pro BLE, Veepeak, OBDLink CX).';
    if (name === 'SecurityError')
      return 'Accès bloqué — autorise le Bluetooth/port série pour ce site (HTTPS requis).';
    if (name === 'NetworkError' || /GATT|connection|connect/i.test(msg))
      return 'Connexion échouée — rapproche-toi du lecteur, coupe puis remets le contact, réessaie.';
    return 'Échec : ' + msg;
  }

  /* ---- découverte des PID supportés (0100 / 0120 / 0140) ------------------
     Chaque réponse est un mot de 32 bits : bit (p-1) = PID p supporté.
     Le bit 32 (PID x20/x40) indique qu'une plage suivante existe.          */
  function discoverPids(ad) {
    var ranges = ['0100', '0120', '0140'];
    var sup = {}, idx = 0, base = 0;
    function step() {
      if (idx >= ranges.length) return Promise.resolve();
      var range = ranges[idx++];
      return ad.send(range, 4000).then(function (r) {
        var b = parseBytes(r, range);
        if (!b || b.length < 4) return; // arrêt : plage illisible
        for (var bit = 0; bit < 32; bit++) {
          if (b[bit >> 3] & (0x80 >> (bit & 7))) sup['01' + hex2(base + bit + 1)] = true;
        }
        var more = !!(b[3] & 1);
        base += 32;
        if (more) return step();
      }).catch(function () {});
    }
    return step().then(function () {
      st.supported = Object.keys(sup).length ? sup : null; // null = inconnu → tout tenter
    });
  }
  function supports(pid) { return !st.supported || !!st.supported[pid]; }

  function buildPollLists() {
    st.fastList = FAST_PIDS.filter(supports);
    if (!st.fastList.length) st.fastList = FAST_PIDS.slice(); // toujours tenter le trio vital
    st.slowList = SLOW_PIDS.filter(supports);
    // tension : si le PID 0142 n'existe pas, on lit la tension de l'ELM (ATRV)
    if (!supports('0142')) st.slowList.push('ATRV');
  }

  /* ---- lecture d'un PID + émission 'obd:pid' ------------------------------ */
  function queryPid(pid) {
    var ad = st.adapter;
    if (!ad) return Promise.resolve();
    if (pid === 'ATRV') { // pseudo-PID : tension lue par l'adaptateur ELM
      return ad.send('ATRV').then(function (v) {
        var m = String(v).match(/([0-9]+\.?[0-9]*)/);
        if (!m) return;
        putVal('0142', parseFloat(m[1]), 'ATRV');
      }).catch(function () {});
    }
    var def = PID_DEFS[pid];
    if (!def) return Promise.resolve();
    return ad.send(pid).then(function (resp) {
      if (/NO DATA|ERROR|UNABLE|STOPPED|\?/i.test(resp)) return;
      var b = parseBytes(resp, pid);
      if (!b || b.length < def.n) return;
      putVal(pid, def.calc(b), null);
      // conso instantanée CALCULÉE depuis le MAF si le PID débit (015E)
      // n'est pas supporté : L/h ≈ MAF(g/s) / AFR 14.7 / 745 g/L × 3600
      if (pid === '0110' && st.supported && !st.supported['015E']) {
        var lh = def.calc(b) / 14.7 / 745 * 3600;
        putVal('015E', Math.round(lh * 10) / 10, 'calculé (MAF)');
      }
    }).catch(function () {});
  }
  function putVal(pid, value, src) {
    var def = PID_DEFS[pid];
    value = Math.round(value * 100) / 100;
    st.vals[pid] = { name: def.name, value: value, unit: def.unit, t: Date.now() };
    var ev = { pid: pid, name: def.name, value: value, unit: def.unit };
    if (src) ev.src = src;
    bus.emit('obd:pid', ev);
  }

  /* ---- planificateur de polling -------------------------------------------
     Une seule commande en vol à la fois (le lien série ELM est half-duplex) :
     la cadence réelle s'auto-régule sur la latence de l'adaptateur.
     Motif : F F F S (3 critiques pour 1 lent) → sur la démo (~25 ms/cmd) les
     critiques (010C/010D/0111) tournent à ~10 Hz, les lents ~1 Hz. Sur un
     vrai ELM BLE (plus lent) le même motif garde la priorité aux critiques. */
  function startPolling() {
    var busy = false, fi = 0, si = 0, tick = 0;
    if (st.stopPoll) st.stopPoll();
    st.stopPoll = loop.add(function () {
      if (busy || !isOn() || !st.adapter) return;
      busy = true;
      var pid;
      tick++;
      if (tick % 4 === 0 && st.slowList.length) pid = st.slowList[si++ % st.slowList.length];
      else pid = st.fastList[fi++ % st.fastList.length];
      queryPid(pid).then(function () { busy = false; }, function () { busy = false; });
    }, 40, 1); // 40 Hz de tentatives, gaté par busy → jamais 2 commandes en vol
  }

  /* ---- estimation du rapport engagé ----------------------------------------
     Le rapport n'est PAS un PID OBD-II standard (c'est de l'UDS constructeur,
     mode 22 + DID propriétaire). On l'ESTIME par le ratio régime/vitesse
     comparé à une échelle de boîte typique → champ gearSrc:'estimé'.        */
  var GEAR_RATIOS = [135, 78, 54, 41, 33, 27]; // tr/min par km/h, rapports 1..6
  function estimateGear(rpm, spd) {
    if (!rpm || !spd || spd < 4 || rpm < 500) return 0; // arrêt / point mort
    var r = rpm / spd, best = 1, dMin = 1e9;
    for (var g = 0; g < GEAR_RATIOS.length; g++) {
      var d = Math.abs(r - GEAR_RATIOS[g]);
      if (d < dMin) { dMin = d; best = g + 1; }
    }
    return best;
  }

  /* ---- émetteur 'telemetry' (~10 Hz) --------------------------------------
     Fusionne PID OBD + dernier fix GPS + (démo) frein/volant/roues simulés.
     Hors démo : frein ESTIMÉ par décélération, volant/roues null (UDS).    */
  function startTelemetry() {
    if (st.stopTel) st.stopTel();
    st.stopTel = loop.add(function () {
      if (!isOn()) return;
      function v(pid) { var e = st.vals[pid]; return e ? e.value : null; }
      var spd = v('010D'), rpm = v('010C'), now = Date.now();
      // frein estimé : décélération sans gaz ≈ freinage (indicatif seulement)
      if (spd !== null) {
        if (st.prevSpd !== null && now > st.prevSpdT) {
          var dec = (st.prevSpd - spd) / 3.6 / ((now - st.prevSpdT) / 1000); // m/s²
          var thr = v('0111') || 0;
          st.brakeEst = (dec > 0.6 && thr < 8) ? util.clamp(Math.round(dec * 22), 0, 100) : 0;
        }
        st.prevSpd = spd; st.prevSpdT = now;
      }
      var sim = st.adapter && st.adapter.simState ? st.adapter.simState() : null;
      var g = st.gps;
      bus.emit('telemetry', {
        t: now,
        spd: spd, rpm: rpm,
        throttle: v('0111'),
        brake: sim ? sim.brk : st.brakeEst,
        steer: sim ? sim.steer : null,                     // UDS constructeur — null en réel
        gear: sim ? sim.gearN : estimateGear(rpm, spd),
        gearSrc: 'estimé',                                 // jamais lu, toujours déduit
        fuel: v('012F'), coolant: v('0105'), batt: v('0142'),
        wheels: sim ? sim.wheels : null,                   // UDS constructeur — null en réel
        lat: g ? g.lat : null, lon: g ? g.lon : null,
        heading: sim ? sim.heading : (g ? g.heading : null),
        src: st.state === 'demo' ? 'demo' : 'obd'
      });
    }, 10, 1);
  }

  function stopLoops() {
    if (st.stopPoll) { st.stopPoll(); st.stopPoll = null; }
    if (st.stopTel) { st.stopTel(); st.stopTel = null; }
  }

  /* ---- lecture du VIN (mode 09 PID 02, multi-trame) ------------------------ */
  function readVIN() {
    if (!st.adapter) return Promise.resolve(null);
    return st.adapter.send('0902', 2500).then(function (r) {
      var vin = parseVIN(r);
      if (vin) {
        st.vin = vin;
        store.gset('obd:lastVIN', vin);
        bus.emit('obd:vin', { vin: vin });
      }
      return vin;
    }).catch(function () { return null; });
  }

  /* ---- séquence post-connexion --------------------------------------------
     init ELM → découverte PID → VIN → polling + télémétrie                 */
  function afterConnect(ad, isReconnect) {
    var send = function (c, t) { return ad.send(c, t); };
    emitStatus('connecting', ad.id, 'Initialisation ELM327…');
    return initELM(send).then(function () {
      if (isReconnect) return; // déjà découvert / VIN déjà lu
      emitStatus('connecting', ad.id, 'Découverte des PID supportés…');
      return discoverPids(ad).then(function () { return readVIN(); });
    }).then(function () {
      buildPollLists();
      ad.onDrop(handleDrop);
      startPolling();
      startTelemetry();
      st.reconnectTries = 0;
    });
  }

  /* ---- reconnexion automatique (comme obd.html), max 5 essais espacés ---- */
  function handleDrop() {
    stopLoops();
    if (st.userDisconnect || !st.adapter) return;
    if (st.reconnectTries >= 5) {
      emitStatus('off', st.adapterId, 'Reconnexion abandonnée après 5 tentatives');
      st.adapter = null; st.adapterId = null;
      return;
    }
    st.reconnectTries++;
    var n = st.reconnectTries;
    emitStatus('connecting', st.adapterId, 'Liaison perdue — reconnexion (' + n + '/5)…');
    setTimeout(function () {
      if (st.userDisconnect || !st.adapter) return;
      var ad = st.adapter;
      var p = ad.reconnect ? ad.reconnect() : ad.connect();
      p.then(function () { return afterConnect(ad, true); })
        .then(function () {
          emitStatus(ad.id === 'demo' ? 'demo' : 'on', ad.id, 'Reconnecté — ' + (ad.info() || ''));
        })
        .catch(function () { handleDrop(); });
    }, 800 * n); // espacement croissant : 0.8s, 1.6s, 2.4s, 3.2s, 4s
  }

  /* ---- API : connect / disconnect / autoConnect --------------------------- */
  function connect(adapterId) {
    if (st.state === 'connecting') return Promise.reject(new Error('connexion déjà en cours'));
    return disconnect().then(function () {
      // adaptateur demandé, sinon dernier utilisé, sinon meilleur disponible
      var id = adapterId || store.gget('obd:lastAdapter') || bestAvailable();
      var ad = ADAPTERS[id];
      if (!ad) return Promise.reject(new Error('adaptateur inconnu : ' + id));
      if (!ad.available()) {
        var why = ad.detail() || 'adaptateur indisponible';
        emitStatus('off', id, why);
        return Promise.reject(new Error(why));
      }
      st.userDisconnect = false;
      st.vals = {}; st.vin = null; st.supported = null;
      emitStatus('connecting', id, 'Recherche de l\'adaptateur…');
      return ad.connect().then(function () {
        st.adapter = ad; st.adapterId = id;
        return afterConnect(ad, false);
      }).then(function () {
        store.gset('obd:lastAdapter', id);
        if (id === 'demo') bus.emit('pos:demo', { on: true });
        emitStatus(id === 'demo' ? 'demo' : 'on', id, ad.info() || '');
        return true;
      }).catch(function (e) {
        var msg = humanErr(e);
        st.adapter = null; st.adapterId = null;
        stopLoops();
        try { ad.disconnect(); } catch (e2) {}
        emitStatus('off', id, msg);
        throw new Error(msg);
      });
    });
  }

  function disconnect() {
    st.userDisconnect = true;
    stopLoops();
    var ad = st.adapter, wasDemo = st.adapterId === 'demo';
    st.adapter = null; st.adapterId = null;
    st.prevSpd = null; st.brakeEst = 0;
    if (!ad) { if (st.state !== 'off') emitStatus('off', null, ''); return Promise.resolve(); }
    return ad.disconnect().catch(function () {}).then(function () {
      if (wasDemo) bus.emit('pos:demo', { on: false });
      emitStatus('off', ad.id, 'Déconnecté');
    });
  }

  /* Auto-connexion au boot (appelée par l'intégration os.html) : tentative
     SILENCIEUSE uniquement — jamais de popup non sollicitée. Conditions :
     un adaptateur RÉEL a déjà servi ET le navigateur garde la permission
     (BLE : getDevices() ; USB : getPorts()). Sinon ne fait rien.           */
  function autoConnect() {
    var last = store.gget('obd:lastAdapter');
    if (!last || last === 'demo' || last === 'wifi') return Promise.resolve(false);
    var ad = ADAPTERS[last];
    if (!ad || !ad.available() || !ad.silentConnect) return Promise.resolve(false);
    st.userDisconnect = false;
    emitStatus('connecting', last, 'Reconnexion automatique…');
    return ad.silentConnect().then(function (ok) {
      if (!ok) { emitStatus('off', last, ''); return false; }
      st.adapter = ad; st.adapterId = last;
      st.vals = {}; st.vin = null; st.supported = null;
      return afterConnect(ad, false).then(function () {
        emitStatus('on', last, ad.info() || '');
        return true;
      });
    }).catch(function () {
      st.adapter = null; st.adapterId = null;
      stopLoops();
      emitStatus('off', last, '');
      return false;
    });
  }

  /* ---- introspection ------------------------------------------------------- */
  function state() {
    return {
      state: st.state,
      adapter: st.adapterId,
      vin: st.vin,
      supported: st.supported ? Object.keys(st.supported) : null,
      values: st.vals
    };
  }
  function listAdapters() {
    return ORDER.map(function (id) {
      var a = ADAPTERS[id];
      return { id: a.id, label: a.label, available: a.available(), detail: a.detail() };
    });
  }

  function destroy() { // libère tout (tests / rechargement de module)
    if (offGps) { offGps(); offGps = null; }
    return disconnect();
  }

  /* ==========================================================================
     BOOT
     ========================================================================== */
  var api = {
    connect: connect,
    disconnect: disconnect,
    autoConnect: autoConnect,
    state: state,
    adapters: listAdapters,
    readVIN: readVIN,
    registerAdapter: registerAdapter,
    destroy: destroy
  };

  function boot() {
    bus = POS.bus; store = POS.store; loop = POS.loop; util = POS.util;
    // ordre de préférence : BLE > USB > Wi-Fi > démo
    registerAdapter(makeBleAdapter());
    registerAdapter(makeUsbAdapter());
    registerAdapter(makeWifiAdapter());
    registerAdapter(makeDemoAdapter());
    // dernier fix GPS (émis par l'intégration os.html) fusionné en télémétrie
    offGps = bus.on('gps:fix', function (fix) { st.gps = fix; });
    POS.registry.register('obd', api);
  }

  POS.ready(boot);
})();
