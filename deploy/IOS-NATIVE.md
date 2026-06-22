# Practice sur iPad / iPhone — 2 voies

## Voie 1 — PWA (maintenant, sans Mac ni compte) ✅

Practice est installable comme une **vraie app plein écran** directement depuis l'iPad.

1. Ouvre **Safari** sur l'iPad et va sur :
   - l'app complète : `https://practice-site-five.vercel.app/`
   - **ou** le cockpit directement : `https://practice-site-five.vercel.app/os.html`
2. Touche le bouton **Partager** (carré avec une flèche ↑).
3. **« Sur l'écran d'accueil »** → **Ajouter**.
4. Une icône **Practice** (le « P » dot-matrix) apparaît. Tu l'ouvres → plein écran, sans barre Safari.

> ⚠️ La géoloc, la caméra et l'OBD Bluetooth marchent car le site est en **HTTPS** (Vercel).
> Le chatbot et la carte ont besoin d'**internet**.

Ce n'est **pas** l'App Store, mais ça se comporte comme une app et c'est gratuit/immédiat.

---

## Voie 2 — Vraie app iOS (App Store) via un Mac

Pour une app native publiable, il faut **obligatoirement** :
- un **Mac** avec **Xcode** (gratuit, sur le Mac App Store) ;
- un compte **Apple Developer** (99 $/an) pour signer et publier ;
- on « emballe » l'app web existante avec **Capacitor** (le `dist/` devient une app native).

La config est déjà prête (`capacitor.config.json`). **Sur le Mac** :

```bash
# 1) récupérer le projet (git clone ou copie)
cd practice-site
npm install

# 2) ajouter Capacitor + la plateforme iOS
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap add ios

# 3) construire le web puis synchroniser vers le projet iOS
npm run build
npx cap sync ios

# 4) ouvrir dans Xcode
npx cap open ios
```

Dans **Xcode** : choisis ton équipe Apple Developer (Signing & Capabilities),
branche l'iPad, et **Run** ▶ pour l'installer dessus. Pour publier : *Product → Archive* → App Store Connect.

### Transférer depuis l'iPad vers le Mac
Le code n'a pas besoin d'être « sur » l'iPad. Le plus simple :
- mets le projet sur **GitHub** (déjà le cas) et fais `git clone` sur le Mac ; **ou**
- **AirDrop / iCloud Drive** le dossier `practice-site` de l'iPad vers le Mac.

> Note : on ne peut **pas** compiler/signer une app iOS depuis l'iPad seul.
> (Swift Playgrounds sur iPad sait publier de petites apps natives, mais pas emballer ce site web.)
