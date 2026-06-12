# Practice Vision — coquille native CarPlay / Android Auto

## La vérité, sans détour

**CarPlay et Android Auto ne peuvent PAS afficher une page web.** Ni `os.html`, ni `hud.html`,
ni aucune PWA n'apparaîtra sur l'écran de la voiture. Les deux systèmes n'exécutent que des
**apps natives** qui utilisent des **templates imposés** et appartiennent à une **catégorie approuvée** :

- **CarPlay (iOS)** : app native + entitlement Apple `com.apple.developer.carplay-maps`
  (catégorie Navigation) — demandé via le portail développeur, soumis à validation Apple.
- **Android Auto** : app native + `androidx.car.app` (Car App Library), catégorie Navigation,
  validée par Google Play.

> Donc ceci n'est PAS livrable depuis le site. C'est un **projet natif séparé** (Swift + Kotlin)
> que tu (ou un dev) compiles avec **Xcode** et **Android Studio**. Ce dossier en est le squelette réel.

## Architecture choisie : coquille mince + cœur web réutilisé

Plutôt que tout réécrire en natif, l'app native :
1. affiche sur l'**écran voiture** un template **Navigation** natif (carte + guidage + alertes Safety) ;
2. affiche sur le **téléphone** le cockpit web complet (`os.html`) dans un WebView ;
3. partage la logique via le backend `agent-os/` (risk/twin/itinéraire) servi en local ou en cloud.

```
practice-native/
├── ios/        CarPlay (Swift) — CPMapTemplate + CPNavigationSession + WKWebView
└── android/    Android Auto (Kotlin) — CarAppService + NavigationTemplate + WebView
```

## Build

**iOS (CarPlay)**
1. Ouvre `ios/` dans Xcode, crée une cible App.
2. Demande l'entitlement CarPlay à Apple (Navigation). Ajoute `com.apple.developer.carplay-maps`.
3. Ajoute la scene CarPlay (voir `ios/Info-CarPlay.plist`) et `CarPlaySceneDelegate.swift`.
4. Teste dans le **simulateur CarPlay** (Xcode ▸ I/O ▸ External Displays ▸ CarPlay).

**Android (Android Auto)**
1. Ouvre `android/` dans Android Studio.
2. Dépendance `androidx.car.app:app:1.4.0` (voir `android/build.gradle.snippet`).
3. Déclare le `CarAppService` (voir `android/AndroidManifest.snippet.xml`).
4. Teste avec **Desktop Head Unit (DHU)** : `adb forward tcp:5277 tcp:5277` puis lance le DHU.

## Catégorie & délais

PRACTICE rentre en **Navigation**. Apple = demande d'entitlement justifiée (compte quelques semaines).
Google = app de navigation publiée et revue sur Play. Tant que ce n'est pas approuvé, le test se fait
en **simulateur CarPlay** / **DHU Android** — pas besoin d'attendre l'approbation pour développer.

## En attendant (testable AUJOURD'HUI dans la voiture)

- PWA plein écran (`/os.html` → écran d'accueil) + support téléphone.
- HUD réel (`/hud.html`) avec vitesse GPS + OBD2 réels.
- Recopie d'écran (iOS) pour projeter sur un écran compatible.
