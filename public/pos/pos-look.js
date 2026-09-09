/* pos-look.js — look « clay Practice » commun au hub 3D (hud3d-map.html) et à l'aperçu
   Réglages (pos/pos-car3d.js). Script classique (ES5, window.PracticeLook) : chargé par
   <script src> dans le hub et injecté par pos-car3d.js ; les deux passent leur namespace
   three (T) en paramètre — aucune dépendance globale à THREE.

   Principe (DA Practice OS, sept. 2026) :
     - les atlas des voitures lpc sont MONOCHROMES (luminance, peinture à L≈0,80) ;
       la couleur vient du matériau : MeshPhysicalMaterial { map: atlas, color: tint }
       -> set cohérent, satiné, « clay premium » façon visualisation Tesla ;
     - une teinte sobre par avatar (champ "tint" de /models/lpc/_manifest.json) ;
     - pneus noir mat, jantes gris canon ;
     - au sol : ombre de contact douce + halo accent orange (var(--acc) #FF5000) en
       anneau fin, fusion normale sur fond clair / additive en nuit. */
(function () {
  'use strict';
  var ACC = '#FF5000';                          // accent Practice (unique couleur vive du cockpit)
  var LOOK = { roughness: 0.50, metalness: 0.15, clearcoat: 0.50, clearcoatRoughness: 0.35, envMapIntensity: 1.25 };
  var manifestP = null;                         // /models/lpc/_manifest.json (chargé une fois)

  /* --- teinte d'un avatar d'après son URL (repli quand le message/opts ne la porte pas) --- */
  function tintFor(url) {
    var key = ('' + (url || '')).split('/').pop().replace(/\.glb.*$/, '');
    if (!key) return Promise.resolve(null);
    if (!manifestP) {
      manifestP = (typeof fetch === 'function'
        ? fetch('/models/lpc/_manifest.json').then(function (r) { return r.ok ? r.json() : []; })
        : Promise.resolve([])).catch(function () { return []; });
    }
    return manifestP.then(function (list) {
      for (var i = 0; i < (list || []).length; i++) { var e = list[i]; if (e && (e.id === key || ('' + e.file).indexOf(key + '.glb') >= 0)) return e.tint || null; }
      return null;
    });
  }

  /* --- carrosserie : MeshPhysicalMaterial laqué satiné, map = atlas mono, color = tint ---
     Remplace chaque matériau de mesh du modèle (les GLB lpc n'en ont qu'un). Sans tint :
     garde la couleur déjà cuite dans le GLB (baseColorFactor = tint du manifest).
     Retourne la liste des matériaux créés (à tracker/disposer par l'appelant). */
  function apply(wrap, T, tint) {
    var made = [], cache = {};
    if (!wrap || !T) return made;
    var col = null;
    try { if (tint) col = new T.Color(tint); } catch (e) { col = null; }
    wrap.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var arr = Array.isArray(o.material) ? o.material : [o.material], out = [];
      for (var i = 0; i < arr.length; i++) {
        var src = arr[i], m = cache[src.uuid];
        if (!m) {
          if (src.isMeshPhysicalMaterial) { m = src; }                       // déjà physique (clearcoat cuit dans le GLB) -> on règle en place
          else {
            m = new T.MeshPhysicalMaterial({ map: src.map || null, color: src.color ? src.color.clone() : 0xffffff, side: src.side });
            if (src.map && 'colorSpace' in src.map && T.SRGBColorSpace) src.map.colorSpace = T.SRGBColorSpace;
            made.push(m);
          }
          if (col) m.color.copy(col);
          m.roughness = LOOK.roughness; m.metalness = LOOK.metalness;
          m.clearcoat = LOOK.clearcoat; m.clearcoatRoughness = LOOK.clearcoatRoughness;
          m.envMapIntensity = LOOK.envMapIntensity;
          m.needsUpdate = true;
          cache[src.uuid] = m;
        }
        out.push(m);
      }
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    return made;
  }

  /* --- roues : pneu noir mat + jante gris canon (alliage) --- */
  function tireMat(T) { return new T.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.92, metalness: 0.05, side: T.DoubleSide }); }
  function rimMat(T) { return new T.MeshStandardMaterial({ color: 0x70757d, roughness: 0.38, metalness: 0.85, envMapIntensity: 1.2, side: T.DoubleSide }); }

  /* --- textures sol (canvas) : ombre radiale + anneau accent fin ---
     Dessinées dans un carré ; l'ellipse vient de l'échelle non uniforme du plan. */
  function shadowTexture(T) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 256; var g = cv.getContext('2d');
    var gr = g.createRadialGradient(128, 128, 8, 128, 128, 126);
    gr.addColorStop(0.00, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.42)');
    gr.addColorStop(0.80, 'rgba(0,0,0,0.10)'); gr.addColorStop(1.00, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    var t = new T.CanvasTexture(cv); if ('colorSpace' in t && T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; return t;
  }
  function haloTexture(T) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 256; var g = cv.getContext('2d');
    var gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    /* masque BLANC (alpha) : la couleur vient de material.color = ACC (sinon texture × color = orange au carré -> rouge) */
    gr.addColorStop(0.00, 'rgba(255,255,255,0)'); gr.addColorStop(0.82, 'rgba(255,255,255,0)');
    gr.addColorStop(0.87, 'rgba(255,255,255,1)'); gr.addColorStop(0.90, 'rgba(255,255,255,1)');   // anneau FIN (≈3 % du rayon), bords doux
    gr.addColorStop(0.955, 'rgba(255,255,255,0)'); gr.addColorStop(1.00, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    var t = new T.CanvasTexture(cv); if ('colorSpace' in t && T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; return t;
  }

  /* --- groupe sol : ombre de contact + halo accent, sous la voiture (Y-up, sol y=0).
       L = longueur (axe Z), W = largeur (axe X), en unités scène. Le groupe est à poser
       dans un parent qui NE roule/tangue PAS (root du hub / root de l'aperçu).
       opts.gain : multiplicateur d'opacité du halo (vignettes sur fond sombre sans additif : 1.8).
       g.setNight(bool) : normale (clair) <-> additive (nuit) ; g.userData.look = infos debug. */
  function ground(T, L, W, opts) {
    opts = opts || {}; var gain = +opts.gain || 1;
    var g = new T.Group(); g.name = 'practice-ground';
    L = L || 4.6; W = W || 1.9;
    var sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shadowTexture(T), transparent: true, depthWrite: false, toneMapped: false }));
    sh.name = 'contact-shadow'; sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012;
    sh.scale.set(W * 1.45, L * 1.12, 1); sh.renderOrder = -2; g.add(sh);
    var halo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: haloTexture(T), color: ACC, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.27 }));
    halo.name = 'accent-halo'; halo.rotation.x = -Math.PI / 2; halo.position.y = 0.018;
    halo.scale.set(W * 1.62, L * 1.22, 1); halo.renderOrder = -1; g.add(halo);   // anneau juste hors de l'ombre (≈ 0,7 m autour d'une berline)
    g.userData.look = { shadow: sh, halo: halo, night: null };
    g.setNight = function (night) {
      night = !!night; if (g.userData.look.night === night) return;
      g.userData.look.night = night;
      halo.material.blending = night ? T.AdditiveBlending : T.NormalBlending;
      halo.material.opacity = Math.min(1, (night ? 0.32 : 0.27) * gain);
      halo.material.needsUpdate = true;
    };
    g.setNight(false);
    g.dispose = function () { try { sh.material.map.dispose(); sh.material.dispose(); sh.geometry.dispose(); halo.material.map.dispose(); halo.material.dispose(); halo.geometry.dispose(); } catch (e) {} };
    return g;
  }

  window.PracticeLook = { ACC: ACC, LOOK: LOOK, apply: apply, tintFor: tintFor, tireMat: tireMat, rimMat: rimMat, ground: ground };
})();
