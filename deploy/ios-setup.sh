#!/usr/bin/env bash
# ============================================================
#  Practice OS -> app iOS NATIVE et AUTONOME (cockpit os.html, sans Safari).
#  A LANCER SUR UN MAC avec Xcode installe.
#       bash deploy/ios-setup.sh
# ============================================================
set -eu
cd "$(dirname "$0")/.."

echo "==> 1/5  Dependances..."
npm install

echo "==> 2/5  Build du site..."
npm run build
printf '%s' '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=os.html"><title>Practice OS</title>' > dist/index.html

echo "==> 3/5  Plateforme iOS..."
[ -d ios ] || npx cap add ios

echo "==> 4/5  Autorisations (camera / position) dans Info.plist..."
node deploy/ios-permissions.cjs || echo "   (permissions: a ajouter dans Xcode si besoin)"

echo "==> 5/5  Synchronisation + ouverture Xcode..."
npx cap sync ios
npx cap open ios

echo ""
echo "Dans Xcode : App -> Signing & Capabilities -> choisis ton equipe."
echo "Branche l'iPad -> choisis-le en cible -> Run (triangle)."
echo "La camera (vision) marche dans l'app grace a la permission ajoutee."
echo "Pour l'App Store : Product -> Archive -> Distribute App."
