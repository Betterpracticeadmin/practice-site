# Compte rendu de nuit — Practice OS (2026-06-28)

Boucle autonome : tests de **tout Practice OS** (pas que le hub) + corrections de bugs.
Règles : vérifier avant déploiement, 1 commit par correction, ne jamais déployer du cassé,
rester dans `practice-site`, rien de destructif/système, ne corriger que des bugs vérifiables.

Serveur de test : `node playwright/serve.js practice-site/public 8099`.

---

## Avant la boucle
- Hub carte (`hud3d-map.html`) repassé en **mode NUIT par défaut** (demande). Déployé, 0 erreur.

## Itération 1 — health check global (chargement + erreurs JS/console/4xx)
Pages testées via Playwright (viewport iPad 1194×834, géoloc Paris accordée) :
`os.html`, `hud.html`, `hud3d.html`, `hud3d-map.html`, `vision.html`, `obd.html`, `pulse.html`.

**Résultat : TOUTES saines au chargement.**
- 0 `pageerror` (aucune erreur JS fatale / de syntaxe)
- 0 erreur console corrigeable
- 0 ressource locale en 4xx

Note `os.html` : seul 404 = `/api/tts` (API neurale ElevenLabs **absente du serveur statique
local**, **présente sur Vercel** ; le code bascule proprement sur la voix navigateur en cas
d'échec). → **Pas un bug.**

**Aucun bug corrigeable trouvé à ce niveau.**

### À faire (prochaines itérations)
Vérifs plus profondes, page par page :
- débordements de layout par panneau (comme le bug `#ck-tele` corrigé hier) ;
- flux d'interaction clés (ouverture/fermeture vues, boutons, nav) ;
- responsive (portrait/paysage iPad).
