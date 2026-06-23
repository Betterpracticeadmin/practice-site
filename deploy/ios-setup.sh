#!/usr/bin/env bash
# ============================================================
#  Practice OS -> app iOS (le cockpit os.html UNIQUEMENT, pas le site).
#  À LANCER SUR UN MAC qui a Xcode installé (gratuit, Mac App Store).
#       bash deploy/ios-setup.sh
#  (lignes une par une si besoin : npm install / npm run build / etc.)
# ============================================================
set -eu
cd "$(dirname "$0")/.."

echo "==> 1/5  Dependances..."
npm install

echo "==> 2/5  Build du site..."
npm run build

echo "==> 3/5  L'app ouvrira Practice OS (os.html) directement, pas la page d'accueil..."
printf '%s' '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=os.html"><title>Practice OS</title>' > dist/index.html

echo "==> 4/5  Plateforme iOS + synchronisation..."
[ -d ios ] || npx cap add ios
npx cap sync ios

echo "==> 5/5  Ouverture dans Xcode..."
npx cap open ios

echo ""
echo "Dans Xcode : App -> Signing & Capabilities -> choisis ton equipe."
echo "Branche l'iPad -> choisis-le en cible -> Run (triangle)."
echo "Pour l'App Store : Product -> Archive -> Distribute App."
