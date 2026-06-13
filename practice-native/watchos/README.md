# Practice — Apple Watch (heart rate & vitals)

## La vérité

L'Apple Watch **ne diffuse pas** son rythme cardiaque à une page web. Pas de Web Bluetooth sur
iOS, et HealthKit n'est accessible qu'aux **apps natives**. Donc l'Apple Watch dans Practice =
une petite **app watchOS + app iPhone**, pas du web.

## Ce qui marche AUJOURD'HUI dans le web (sans Apple Watch)

`os.html` → Jumeau du conducteur → **Connecter ♥** : lit le rythme cardiaque en **Web Bluetooth**
(Heart Rate Service `0x180D`) depuis **n'importe quelle ceinture / capteur cardio BLE** (Polar H10,
Wahoo Tickr…) ou une montre **Wear OS** qui diffuse. Marche sur Android Chrome / Bluefy (iOS).
La FC nourrit alors le jumeau : zone (calme/élevé/stress), indice de stress, et l'agent Emotion
apaise le cockpit quand le cœur s'emballe.

## Le chemin Apple Watch natif (ce dossier)

```
watchos/PracticeWatchHR.swift   # watchOS: HKWorkoutSession + HKLiveWorkoutBuilder → BPM live + HRV
                                 # → envoie à l'iPhone via WatchConnectivity
```

Pipeline :
1. **watchOS app** démarre une *workout session* (garde le capteur cardio actif) et lit la FC + HRV live (HealthKit).
2. Elle envoie les valeurs à l'**app iPhone** (WatchConnectivity / `sendMessage`).
3. L'app iPhone (le WKWebView qui héberge le cockpit, cf. `ios/`) **injecte** dans la page :
   `webView.evaluateJavaScript("window.postMessage({type:'hr',bpm:NN},'*')")`.
4. Le **jumeau du conducteur** consomme cette FC exactement comme un capteur BLE.

### Build
- Xcode → cible **watchOS App** + **iOS App** companion.
- Capability **HealthKit** ; Info.plist : `NSHealthShareUsageDescription` ; background mode *Workout Processing*.
- Données lues : `heartRate`, `heartRateVariabilitySDNN` (stress), `respiratoryRate`.

## Données pertinentes (au-delà de la FC)

- **HRV (SDNN)** : baisse = stress/fatigue → meilleur signal que la FC seule.
- **Fréquence respiratoire** : montée = stress.
- **Zones de FC** vs repos : calme / élevé / stress.
- **Somnolence** : FC basse + HRV en hausse + trajet long + heure tardive → suggérer une pause.
- (watchOS peut aussi vibrer au poignet pour une alerte Safety silencieuse — *haptic* via `WKInterfaceDevice`.)

> Ce dossier est le squelette à compiler dans Xcode — pas exécutable depuis le repo web.
