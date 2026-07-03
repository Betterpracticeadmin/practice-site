#!/bin/zsh
# =============================================================================
#  Practice Vision — lancer l'app sur l'iPad via Xcode (À EXÉCUTER SUR UN MAC)
# -----------------------------------------------------------------------------
#  Double-clique ce fichier dans le Finder (ou : ./run-ipad.command dans le
#  Terminal). Il ouvre l'app Swift (PracticeVision.swiftpm) dans Xcode, prête à
#  être signée avec ton compte Apple Developer et lancée sur l'iPad branché.
#
#  Rappel : Xcode n'existe QUE sur macOS. Ce script ne marche pas sous Windows.
#  L'app charge le site déployé (os.html) — l'iPad doit donc être connecté à
#  Internet (Wi-Fi). Aucune compilation web / npm / CocoaPods nécessaire.
# =============================================================================
set -e
cd "$(dirname "$0")"

echo "▶ Practice Vision — préparation Xcode"
echo

# 1) Xcode installé ?
if ! xcode-select -p >/dev/null 2>&1; then
  echo "✗ Xcode / Command Line Tools introuvables."
  echo "  Installe Xcode depuis l'App Store, puis relance ce script."
  echo "  (au besoin : xcode-select --install)"
  exit 1
fi
echo "✓ Xcode détecté : $(xcode-select -p)"

# 2) Le package app est bien là ?
if [ ! -d "PracticeVision.swiftpm" ]; then
  echo "✗ Dossier PracticeVision.swiftpm introuvable à côté de ce script."
  exit 1
fi
echo "✓ App trouvée : PracticeVision.swiftpm"

# 3) Ouvre dans Xcode
echo
echo "▶ Ouverture dans Xcode…"
open -a Xcode "PracticeVision.swiftpm"

cat <<'STEPS'

──────────────────────────────────────────────────────────────────────────────
 ÉTAPES DANS XCODE (une fois ouvert)
──────────────────────────────────────────────────────────────────────────────
 1. Branche l'iPad en USB-C, déverrouille-le, tape « Se fier à cet ordinateur ».
 2. Navigateur de gauche → clique le projet « Practice Vision » → onglet
    « Signing & Capabilities ».
 3. Coche « Automatically manage signing », puis dans « Team » choisis ton
    compte (clique « Add an Account… » si vide et connecte ton Apple ID).
      • Apple ID GRATUIT  → « (Personal Team) », app valide ~7 jours, 3 appareils.
      • Apple Developer PAYANT → signature ~1 an.
 4. Erreur rouge « Failed to register bundle identifier » ? Change le
    Bundle Identifier en un truc unique, ex :  fm.betterstate.practicevision.alessandro
 5. En haut, dans le sélecteur d'appareil (à droite de ▶), choisis TON IPAD
    sous « iOS Device » — surtout pas un simulateur.
 6. Appuie sur ▶ (ou Cmd+R). Xcode compile, signe, installe et lance sur l'iPad.

──────────────────────────────────────────────────────────────────────────────
 CÔTÉ IPAD (1re fois seulement)
──────────────────────────────────────────────────────────────────────────────
 • Mode développeur : Réglages › Confidentialité et sécurité › Mode développeur
   → activer → Redémarrer.  (la ligne n'apparaît qu'après un 1er build Xcode)
 • Faire confiance au certif : Réglages › Général › VPN et gestion de l'appareil
   → sous « App du développeur » → touche ton Apple ID → « Se fier »
   (iPadOS 18 : « Autoriser et redémarrer »).
 • Relance l'app depuis l'écran d'accueil (ou re-appuie ▶ dans Xcode).

 Compte gratuit : l'app cesse de se lancer après ~7 jours → rebranche l'iPad et
 ré-appuie ▶ dans Xcode pour re-signer 7 jours de plus.
──────────────────────────────────────────────────────────────────────────────
STEPS

echo
echo "✓ Terminé. Suis les étapes ci-dessus dans Xcode."
