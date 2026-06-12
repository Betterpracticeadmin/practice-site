# CarPlay & Android Auto — la vérité technique + le chemin réel

## Pourquoi une page web ne peut PAS s'afficher sur l'écran voiture

CarPlay et Android Auto **n'exécutent pas de sites web**. Ils n'affichent que des **apps natives**
qui utilisent des templates imposés et appartiennent à une **catégorie approuvée** :

| Plateforme | Ce qu'il faut | Catégories autorisées |
|---|---|---|
| **CarPlay** (iOS) | App native + **entitlement** demandé à Apple (`com.apple.developer.carplay-*`) | Audio, Navigation, Communication, EV charging, Parking, Quick Food, Driving Task |
| **Android Auto** | App native + **Android for Cars App Library** + validation Google Play | Navigation, Point of Interest, Internet of Things, Media, Messaging |

Conséquences pour PRACTICE OS :
- Une PWA / un site (même `os.html` parfait) **ne peut pas** apparaître sur la tête de console.
- Le mirroring d'app arbitraire est **mort** : *Android Auto for phone screens* a été retiré (Android 12+),
  et CarPlay n'a jamais permis d'afficher un navigateur arbitraire.

## Tester DANS la voiture **aujourd'hui** (sans natif)

1. **PWA plein écran sur le téléphone** : ouvre `https://practice-site-five.vercel.app/os.html`
   → *Partager → Sur l'écran d'accueil*. L'icône lance l'app en plein écran (manifest `standalone`).
2. **Mets le téléphone sur un support** au tableau de bord. C'est la façon de "rouler avec" maintenant.
3. **Lecteur OBD réel** : `/obd.html` (Web Bluetooth, ELM327 BLE) — données moteur live.

## Le vrai chemin natif (quand tu voudras l'écran voiture)

PRACTICE rentrerait le plus naturellement en **"Navigation" (CarPlay) / "Navigation" (Android Auto)**.

```
practice-native/                     # coquille native mince, réutilise la logique web/agent-os
├── ios/        CPMapTemplate / CPNavigationSession (CarPlay, Swift)
│              + WKWebView pour le cockpit complet sur le téléphone
└── android/    CarAppService + NavigationTemplate (Android for Cars, Kotlin)
               + WebView pour le cockpit complet
```

- CarPlay : `CPMapTemplate` (carte plein écran), `CPNavigationSession` (guidage virage par virage),
  panneaux d'alerte pour les overrides Safety. La logique de risque/twin/itinéraire vient de `agent-os/`
  (servie en local par le téléphone ou embarquée).
- Android Auto : `NavigationTemplate` + `RoutingInfo` + `Maneuver`, mêmes données.
- Délais : entitlement CarPlay Apple = demande + justification (quelques semaines) ;
  Android Auto = validation Play Store de l'app de navigation.

> Honnêteté : ce dépôt **ne contient pas** la coquille native (c'est un projet Swift/Kotlin séparé,
> pas une page web). Ce document est le plan d'attaque. Le web + l'OBD réel + la PWA plein écran te
> permettent déjà de **tester dans la voiture maintenant**.
