# Tester Practice Vision sur ton iPad — en vrai, en mode dev

Deux façons. La **#1 (PWA)** marche en 30 s sans rien installer. La **#2 (Swift Playgrounds)**
te donne une **vraie app** avec icône sur l'écran d'accueil, déployée en **mode développeur**.

---

## ✅ Option 1 — PWA plein écran (le plus rapide)

1. Sur l'iPad, ouvre Safari → `https://practice-site-five.vercel.app/os.html`
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. Lance l'icône **Practice OS** → plein écran, sans barre Safari, safe-areas respectées.

GPS réel : OK. Voix : OK. **OBD (Bluetooth) : NON** sur iOS Safari → voir option 2 / Bluefy.

---

## ✅ Option 2 — Vraie app via Swift Playgrounds (mode dev, sans Mac)

Le dossier **`PracticeVision.swiftpm`** est une app prête à compiler **sur l'iPad lui-même**.

1. Installe **Swift Playgrounds** (gratuit, App Store) sur l'iPad.
2. Récupère le dossier `practice-native/PracticeVision.swiftpm` sur l'iPad :
   - via **AirDrop** depuis un Mac/iPhone, ou
   - dépose-le dans **iCloud Drive / Fichiers**, ou
   - clone le repo et exporte le dossier.
3. Dans **Fichiers**, touche `PracticeVision.swiftpm` → il s'ouvre dans Swift Playgrounds.
4. Appuie sur **▶ Exécuter** : l'app se lance en plein écran sur l'iPad et charge le cockpit.
5. Pour l'**installer sur l'écran d'accueil** (déploiement dev) : dans Swift Playgrounds,
   menu de l'app (•••) → **« Ajouter à l'écran d'accueil »**. L'app reste installée tant que
   tu es connecté avec ton Apple ID (re-signer si elle expire — c'est le mode dev gratuit).

> La 1re fois, autorise **Développeur** : Réglages › Confidentialité et sécurité › **Mode développeur** → activé, puis redémarre l'iPad.

### Ce qui marche dans cette app
- ✅ Cockpit complet, carte live, **GPS réel** (la localisation native est demandée au lancement).
- ✅ Voix, télémétrie, HUD, météo, trafic TomTom.
- ❌ **OBD Web Bluetooth** : indisponible dans un WKWebView. Pour l'OBD réel sur iOS il faut la
  brique **CoreBluetooth** native (à ajouter — voir `README.md`), ou le navigateur **Bluefy**.

### Personnaliser
- Ouvrir le **HUD** au lieu du cockpit : dans `PracticeVisionApp.swift`, remplace
  `"/os.html"` par `"/hud.html"`.
- Pointer vers ta **preview locale** : remplace l'URL par `http://<ip-de-ton-mac>:4181/os.html`
  (ajoute alors la capability `.localNetwork` dans `Package.swift`).

---

## ✅ Option 3 — Xcode sur Mac + compte Apple Developer (ce que tu veux)

Même app (`PracticeVision.swiftpm`), mais compilée et déployée depuis **Xcode** sur
le Mac. Xcode n'existe **que sur macOS** — impossible depuis le PC Windows.

**Pré-requis Mac** : Xcode 16+ (App Store), un Apple ID (gratuit suffit), l'iPad en USB-C.
> Rien d'autre : cette app charge le site déployé, donc **pas de npm / build / CocoaPods**.

### Le faire

```bash
# 1. Récupère le projet sur le Mac
git clone https://github.com/Betterpracticeadmin/practice-site.git
cd practice-site/practice-native

# 2. Ouvre l'app dans Xcode (le script affiche aussi toutes les étapes)
./run-ipad.command
#   … ou directement :  open -a Xcode PracticeVision.swiftpm
```

### Dans Xcode
1. Branche l'iPad en USB-C, déverrouille-le, **« Se fier à cet ordinateur »**.
2. Projet **Practice Vision** → onglet **Signing & Capabilities** → coche
   **Automatically manage signing** → **Team** = ton Apple ID.
   - Gratuit → *(Personal Team)*, app valide **~7 jours**, 3 appareils.
   - Apple Developer payant → **~1 an**.
3. Erreur `Failed to register bundle identifier` ? Mets un Bundle ID unique, ex
   `fm.betterstate.practicevision.alessandro`.
4. Sélecteur d'appareil (à droite de ▶) → choisis **ton iPad** (pas un simulateur).
5. **▶ Run** (Cmd+R) : Xcode compile, signe, installe et lance sur l'iPad.

### Côté iPad (1re fois)
- **Mode développeur** : Réglages › Confidentialité et sécurité › **Mode développeur**
  → activer → **Redémarrer** (la ligne n'apparaît qu'après un 1er build Xcode).
- **Faire confiance** : Réglages › Général › **VPN et gestion de l'appareil** →
  *App du développeur* → ton Apple ID → **Se fier** (iPadOS 18 : *Autoriser et redémarrer*).
- Relance l'app → le cockpit (os.html) s'affiche en plein écran.

> Compte gratuit : après ~7 jours l'app refuse de démarrer → rebranche l'iPad,
> ré-appuie **▶** dans Xcode pour re-signer.

**Et Capacitor ?** Le projet a aussi une config **Capacitor 7** (`capacitor.config.json`,
scripts `ios:add/sync/open`). Elle sert quand tu voudras des **plugins natifs**
(ex. OBD en Bluetooth via CoreBluetooth). Pour juste voir le cockpit sur l'iPad,
la `.swiftpm` ci-dessus est plus rapide (aucun CocoaPods, aucun build web).

---

## Et le vrai CarPlay / Android Auto ?
Toujours pareil, sans détour : ça exige une **app native publiée** (catégorie Navigation, entitlement
Apple). Le squelette est dans `practice-native/ios` et `practice-native/android`. Cette app
Swift Playgrounds est le point de départ iOS — on peut y greffer la scène CarPlay ensuite.
