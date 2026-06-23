#!/usr/bin/env bash
# ============================================================
#  Practice OS -> app iOS NATIVE et AUTONOME (cockpit os.html, sans Safari).
#  A LANCER SUR UN MAC avec Xcode installe.
#       bash deploy/ios-setup.sh
# ============================================================
set -eu
cd "$(dirname "$0")/.."

echo "==> 1/6  Dependances..."
npm install

echo "==> 2/6  Plugin Bluetooth natif (pour l'OBD sans navigateur)..."
npm install @capacitor-community/bluetooth-le || echo "   (plugin BLE : si echec, lance: npm i @capacitor-community/bluetooth-le)"

echo "==> 3/6  Build du site..."
npm run build
# l'app ouvre Practice OS (os.html) directement, pas la page d'accueil
printf '%s' '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=os.html"><title>Practice OS</title>' > dist/index.html

echo "==> 4/6  Plateforme iOS..."
[ -d ios ] || npx cap add ios

echo "==> 5/6  Autorisations (camera / Bluetooth / position)..."
node deploy/ios-permissions.cjs || echo "   (permissions : ajoute-les a la main dans Xcode si besoin)"

echo "==> 6/6  Synchronisation + ouverture Xcode..."
npx cap sync ios
npx cap open ios

echo ""
echo "Dans Xcode : App -> Signing & Capabilities -> choisis ton equipe."
echo "Branche l'iPad -> choisis-le en cible -> Run (triangle)."
echo "Camera (vision) : marche dans l'app native grace a la permission ajoutee."
echo "OBD Bluetooth : le plugin natif est installe ; le code OBD natif est la prochaine etape."
echo "Pour l'App Store : Product -> Archive -> Distribute App."
