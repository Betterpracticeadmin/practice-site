/* ============================================================================
   PracticeOS — POS Drivers (gestion des conducteurs)
   ----------------------------------------------------------------------------
   Gère les PROFILS conducteurs de PracticeOS. Chaque conducteur possède ses
   propres données (le namespacing est assuré par pos-core : store.get/set
   sont automatiquement préfixés par l'id du conducteur actif). Ce module ne
   fait QUE gérer la liste des profils, la sélection, la suppression et l'UI.

   API publique (POS.registry.get('drivers')) :
     • list()                — [{id,name,created,lastUsed}] (copie)
     • active()              — profil actif ou null
     • add(name)             — crée un profil, le retourne (sans le sélectionner)
     • select(id)            — bascule IMMÉDIATEMENT sur ce conducteur
     • remove(id)            — efface le profil ET TOUTES ses données
     • rename(id, name)      — renomme un profil
     • needsOnboarding()     — true si aucun profil n'existe encore
     • mountOnboarding()     — affiche l'overlay premier lancement si besoin
     • mountSettings(el)     — rend l'UI de gestion dans le conteneur donné ;
                               retourne une fonction de démontage (unmount)

   Événements bus :
     émis    : 'driver:changed' {driver:{id,name,created,lastUsed}}
     écoutés : 'driver:changed' (re-render de l'UI réglages)

   Stockage :
     global  : POS.store.gget('drivers', [])  — liste des profils
     le conducteur actif vit dans le core (POS.store.driverId/setDriver)

   Dépendance : pos-core.js chargé AVANT. IIFE ES2017, aucun build step.
   ============================================================================ */
(function () {
  'use strict';

  var DKEY = 'drivers'; // clé globale de la liste des profils

  /* ---------- accès à la liste des profils --------------------------------- */

  function load() {
    var l = POS.store.gget(DKEY, []);
    return Array.isArray(l) ? l : [];
  }
  function save(list) { POS.store.gset(DKEY, list); }
  function findIdx(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  /* ---------- API ----------------------------------------------------------- */

  var api = {
    /* liste des profils (copie superficielle : ne pas muter le store) */
    list: function () { return load().slice(); },

    /* profil actif (correspondant à POS.store.driverId()) ou null */
    active: function () {
      var list = load();
      var i = findIdx(list, POS.store.driverId());
      return i >= 0 ? list[i] : null;
    },

    /* crée un profil et le retourne (ne le sélectionne pas) */
    add: function (name) {
      name = String(name || '').trim();
      if (!name) return null;
      var list = load();
      var d = {
        id: POS.util.uid(),
        name: name,
        created: Date.now(),
        lastUsed: 0
      };
      list.push(d);
      save(list);
      return d;
    },

    /* bascule IMMÉDIATEMENT sur le conducteur donné */
    select: function (id) {
      var list = load();
      var i = findIdx(list, id);
      if (i < 0) return false;
      list[i].lastUsed = Date.now();
      save(list);
      POS.store.setDriver(id);
      POS.bus.emit('driver:changed', { driver: list[i] });
      return true;
    },

    /* supprime un profil ET TOUTES ses données (irréversible) */
    remove: function (id) {
      var list = load();
      var i = findIdx(list, id);
      if (i < 0) return false;
      var wasActive = (POS.store.driverId() === id);
      list.splice(i, 1);
      save(list);
      POS.store.wipeDriver(id); // efface toutes les clés 'pos:<id>:*'
      if (wasActive) {
        if (list.length) {
          api.select(list[0].id); // bascule sur le premier restant
        } else {
          // plus aucun profil : retour à l'onboarding
          POS.store.setDriver(null);
          api.mountOnboarding();
        }
      }
      return true;
    },

    /* renomme un profil */
    rename: function (id, name) {
      name = String(name || '').trim();
      if (!name) return false;
      var list = load();
      var i = findIdx(list, id);
      if (i < 0) return false;
      list[i].name = name;
      save(list);
      // si c'est l'actif, prévenir le reste du cockpit (nom affiché ailleurs)
      if (POS.store.driverId() === id) POS.bus.emit('driver:changed', { driver: list[i] });
      return true;
    },

    /* true si aucun profil n'existe (premier lancement) */
    needsOnboarding: function () { return load().length === 0; },

    mountOnboarding: mountOnboarding,
    mountSettings: mountSettings
  };

  /* ---------- utilitaires DOM ------------------------------------------------ */

  /* échappe une chaîne pour insertion sûre dans du HTML */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* « depuis 12 mars 2026 » — date de création lisible en français */
  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      var d = new Date(ts);
      return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
    }
  }

  /* petit shake visuel sur un champ invalide */
  function shake(el) {
    el.classList.remove('posdrv-shake');
    // reflow pour relancer l'animation si déjà jouée
    void el.offsetWidth;
    el.classList.add('posdrv-shake');
  }

  /* ---------- styles (injectés une seule fois) ------------------------------- */

  var styleDone = false;
  function injectStyle() {
    if (styleDone || document.getElementById('posdrv-style')) { styleDone = true; return; }
    styleDone = true;
    var st = document.createElement('style');
    st.id = 'posdrv-style';
    st.textContent = [
      /* ----- overlay onboarding ----- */
      '.posdrv-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;',
      '  background:rgba(0,0,0,.86);opacity:0;transition:opacity .35s ease;font-family:var(--mono,monospace);}',
      '.posdrv-overlay.posdrv-in{opacity:1;}',
      '.posdrv-overlay.posdrv-out{opacity:0;}',
      '.posdrv-card{background:var(--bg2,#0c0d10);border:1px solid var(--border,#222);border-radius:14px;',
      '  padding:36px 32px;max-width:340px;width:calc(100% - 48px);text-align:center;',
      '  transform:translateY(14px) scale(.97);opacity:0;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .45s ease;}',
      '.posdrv-overlay.posdrv-in .posdrv-card{transform:translateY(0) scale(1);opacity:1;}',
      '.posdrv-title{color:var(--txt,#eee);font-size:22px;letter-spacing:.02em;margin:0 0 10px;}',
      '.posdrv-sub{color:var(--dim,#999);font-size:14px;margin:0 0 22px;}',
      '.posdrv-input{width:100%;box-sizing:border-box;background:var(--card,#111);border:1px solid var(--border,#222);',
      '  border-radius:14px;color:var(--txt,#eee);font-family:inherit;font-size:16px;padding:12px 14px;outline:none;',
      '  text-align:center;transition:border-color .2s ease;}',
      '.posdrv-input:focus{border-color:var(--acc,#8ff);}',
      '.posdrv-btn{display:inline-block;margin-top:16px;width:100%;box-sizing:border-box;background:var(--acc,#8ff);',
      '  color:#000;border:none;border-radius:14px;font-family:inherit;font-size:15px;font-weight:600;',
      '  padding:12px 16px;cursor:pointer;transition:opacity .2s ease,transform .2s ease;}',
      '.posdrv-btn:active{transform:scale(.98);}',
      /* ----- shake champ vide ----- */
      '@keyframes posdrv-shake-kf{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}',
      '  40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}',
      '.posdrv-shake{animation:posdrv-shake-kf .35s ease;border-color:#e66 !important;}',
      /* ----- UI réglages ----- */
      '.posdrv-settings{font-family:var(--mono,monospace);color:var(--txt,#eee);}',
      '.posdrv-row{display:flex;align-items:center;gap:10px;background:var(--card,#111);border:1px solid var(--border,#222);',
      '  border-radius:14px;padding:12px 14px;margin-bottom:8px;cursor:pointer;transition:border-color .2s ease,background .2s ease;}',
      '.posdrv-row:hover{border-color:var(--faint,#333);}',
      '.posdrv-row.posdrv-active{border-color:var(--acc,#8ff);}',
      '.posdrv-info{flex:1;min-width:0;}',
      '.posdrv-name{font-size:15px;color:var(--txt,#eee);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.posdrv-row.posdrv-active .posdrv-name{color:var(--acc,#8ff);}',
      '.posdrv-since{font-size:11px;color:var(--faint,#666);margin-top:2px;}',
      '.posdrv-dot{width:8px;height:8px;border-radius:50%;background:var(--acc,#8ff);flex:none;}',
      '.posdrv-ico{flex:none;background:none;border:1px solid var(--border,#222);border-radius:10px;',
      '  color:var(--dim,#999);font-family:inherit;font-size:12px;padding:6px 9px;cursor:pointer;',
      '  transition:color .2s ease,border-color .2s ease;}',
      '.posdrv-ico:hover{color:var(--txt,#eee);border-color:var(--faint,#333);}',
      '.posdrv-ico.posdrv-danger:hover{color:#e66;border-color:#e66;}',
      '.posdrv-addbtn{display:block;width:100%;box-sizing:border-box;background:none;border:1px dashed var(--border,#222);',
      '  border-radius:14px;color:var(--dim,#999);font-family:inherit;font-size:14px;padding:12px 14px;cursor:pointer;',
      '  transition:color .2s ease,border-color .2s ease;}',
      '.posdrv-addbtn:hover{color:var(--acc,#8ff);border-color:var(--acc,#8ff);}',
      '.posdrv-inline{display:flex;gap:8px;align-items:center;flex:1;min-width:0;}',
      '.posdrv-inline .posdrv-input{text-align:left;padding:8px 12px;font-size:14px;}',
      '.posdrv-mini{flex:none;background:var(--acc,#8ff);color:#000;border:none;border-radius:10px;',
      '  font-family:inherit;font-size:12px;font-weight:600;padding:8px 12px;cursor:pointer;transition:opacity .2s ease;}',
      '.posdrv-mini.posdrv-ghost{background:none;color:var(--dim,#999);border:1px solid var(--border,#222);font-weight:400;}',
      '.posdrv-mini.posdrv-red{background:#e66;color:#000;}',
      '.posdrv-confirm{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--card,#111);',
      '  border:1px solid #e66;border-radius:14px;padding:12px 14px;margin-bottom:8px;}',
      '.posdrv-confirm-txt{flex:1;min-width:0;font-size:13px;color:var(--txt,#eee);}',
      '.posdrv-addwrap{margin-top:4px;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------- onboarding premier lancement ----------------------------------- */

  var overlayEl = null; // évite les doublons si appelé deux fois

  function mountOnboarding() {
    if (!api.needsOnboarding() || overlayEl) return;
    injectStyle();

    var ov = document.createElement('div');
    ov.className = 'posdrv-overlay';
    ov.innerHTML =
      '<div class="posdrv-card">' +
        '<h1 class="posdrv-title">Bienvenue sur PracticeOS.</h1>' +
        '<p class="posdrv-sub">Quel est votre prénom ?</p>' +
        '<input class="posdrv-input" type="text" autocomplete="off" autocapitalize="words" spellcheck="false">' +
        '<button class="posdrv-btn" type="button">Commencer</button>' +
      '</div>';
    document.body.appendChild(ov);
    overlayEl = ov;

    var input = ov.querySelector('.posdrv-input');
    var btn = ov.querySelector('.posdrv-btn');

    function validate() {
      var name = input.value.trim();
      if (!name) { shake(input); return; } // champ vide : refus + shake
      var d = api.add(name);
      if (!d) { shake(input); return; }
      api.select(d.id);
      // sortie en douceur puis retrait du DOM
      ov.classList.remove('posdrv-in');
      ov.classList.add('posdrv-out');
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        overlayEl = null;
      }, 400);
    }

    btn.addEventListener('click', validate);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); validate(); }
    });

    // apparition douce (frame suivante pour laisser la transition jouer)
    requestAnimationFrame(function () {
      ov.classList.add('posdrv-in');
      try { input.focus(); } catch (e) {}
    });
  }

  /* ---------- UI réglages ----------------------------------------------------- */

  /* Rend l'interface de gestion dans containerEl.
     Retourne une fonction unmount() qui retire listeners + contenu.            */
  function mountSettings(containerEl) {
    if (!containerEl) return function () {};
    injectStyle();

    // état d'édition local (survit au re-render tant qu'on ne valide pas)
    var ui = { adding: false, renamingId: null, confirmId: null };

    function render() {
      var list = load();
      var activeId = POS.store.driverId();
      containerEl.innerHTML = '';
      var root = document.createElement('div');
      root.className = 'posdrv-settings';

      list.forEach(function (d) {
        if (ui.confirmId === d.id) { root.appendChild(rowConfirm(d)); return; }
        root.appendChild(rowProfile(d, d.id === activeId));
      });

      // zone d'ajout
      var addWrap = document.createElement('div');
      addWrap.className = 'posdrv-addwrap';
      if (ui.adding) addWrap.appendChild(addForm());
      else {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'posdrv-addbtn';
        b.textContent = '+ Ajouter un conducteur';
        b.addEventListener('click', function () { ui.adding = true; render(); });
        addWrap.appendChild(b);
      }
      root.appendChild(addWrap);
      containerEl.appendChild(root);
    }

    /* ligne profil normale (ou en édition de nom) */
    function rowProfile(d, isActive) {
      var row = document.createElement('div');
      row.className = 'posdrv-row' + (isActive ? ' posdrv-active' : '');

      if (ui.renamingId === d.id) {
        row.style.cursor = 'default';
        row.appendChild(inlineEdit(d.name, function (name, input) {
          if (!name) { shake(input); return; }
          ui.renamingId = null;
          api.rename(d.id, name);
          render(); // rename n'émet pas toujours driver:changed
        }, function () { ui.renamingId = null; render(); }));
        return row;
      }

      var info = document.createElement('div');
      info.className = 'posdrv-info';
      info.innerHTML =
        '<div class="posdrv-name">' + esc(d.name) + '</div>' +
        '<div class="posdrv-since">depuis ' + esc(fmtDate(d.created)) + '</div>';
      row.appendChild(info);

      if (isActive) {
        var dot = document.createElement('div');
        dot.className = 'posdrv-dot';
        dot.title = 'Conducteur actif';
        row.appendChild(dot);
      }

      var ren = document.createElement('button');
      ren.type = 'button';
      ren.className = 'posdrv-ico';
      ren.textContent = 'Renommer';
      ren.addEventListener('click', function (e) {
        e.stopPropagation();
        ui.renamingId = d.id; ui.confirmId = null; ui.adding = false;
        render();
      });
      row.appendChild(ren);

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'posdrv-ico posdrv-danger';
      del.textContent = 'Supprimer';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        ui.confirmId = d.id; ui.renamingId = null; ui.adding = false;
        render();
      });
      row.appendChild(del);

      // toucher la ligne = sélection immédiate
      row.addEventListener('click', function () {
        if (!isActive) api.select(d.id); // 'driver:changed' re-render
      });
      return row;
    }

    /* mini-dialogue de confirmation de suppression (inline, pas confirm()) */
    function rowConfirm(d) {
      var box = document.createElement('div');
      box.className = 'posdrv-confirm';
      var txt = document.createElement('div');
      txt.className = 'posdrv-confirm-txt';
      txt.textContent = 'Supprimer ' + d.name + ' et toutes ses données ?';
      box.appendChild(txt);

      var yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'posdrv-mini posdrv-red';
      yes.textContent = 'Supprimer';
      yes.addEventListener('click', function () {
        ui.confirmId = null;
        api.remove(d.id); // peut émettre 'driver:changed' (re-render) sinon :
        render();
      });
      box.appendChild(yes);

      var no = document.createElement('button');
      no.type = 'button';
      no.className = 'posdrv-mini posdrv-ghost';
      no.textContent = 'Annuler';
      no.addEventListener('click', function () { ui.confirmId = null; render(); });
      box.appendChild(no);
      return box;
    }

    /* champ inline générique (renommage) : onOk(valeur, input) / onCancel() */
    function inlineEdit(initial, onOk, onCancel) {
      var wrap = document.createElement('div');
      wrap.className = 'posdrv-inline';
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'posdrv-input';
      input.value = initial || '';
      input.autocomplete = 'off';
      wrap.appendChild(input);

      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'posdrv-mini';
      ok.textContent = 'OK';
      ok.addEventListener('click', function () { onOk(input.value.trim(), input); });
      wrap.appendChild(ok);

      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'posdrv-mini posdrv-ghost';
      cancel.textContent = 'Annuler';
      cancel.addEventListener('click', onCancel);
      wrap.appendChild(cancel);

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); onOk(input.value.trim(), input); }
        else if (e.key === 'Escape') onCancel();
      });
      setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 0);
      return wrap;
    }

    /* formulaire d'ajout inline */
    function addForm() {
      var box = document.createElement('div');
      box.className = 'posdrv-row';
      box.style.cursor = 'default';
      box.appendChild(inlineEdit('', function (name, input) {
        if (!name) { shake(input); return; }
        ui.adding = false;
        var d = api.add(name);
        if (d && load().length === 1) api.select(d.id); // 1er profil → actif
        render();
      }, function () { ui.adding = false; render(); }));
      return box;
    }

    // re-render quand le conducteur change (sélection depuis ailleurs incluse)
    var offChanged = POS.bus.on('driver:changed', render);
    render();

    /* démontage propre : retire listener bus + contenu (pas de fuite mémoire) */
    return function unmount() {
      offChanged();
      containerEl.innerHTML = '';
    };
  }

  /* ---------- init ------------------------------------------------------------ */

  function boot() {
    POS.registry.register('drivers', api);
    // cohérence : si l'id actif mémorisé ne correspond à aucun profil existant
    // (ex : données effacées à la main), on rebascule sur le premier profil.
    var list = load();
    if (list.length && findIdx(list, POS.store.driverId()) < 0) {
      api.select(list[0].id);
    }
  }

  POS.ready(boot);
})();
