#!/usr/bin/env bash
# ============================================================
#  Practice -> app iOS testable sur iPad.
#  À LANCER SUR UN MAC qui a Xcode installé (gratuit, Mac App Store).
#       bash deploy/ios-setup.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/4  Dépendances…"
npm install

echo "==> 2/4  Build du site (dist/)…"
npm run build

echo "==> 3/4  Plateforme iOS…"
[ -d ios ] || npx cap add ios
npx cap sync ios

echo "==> 4/4  Ouverture dans Xcode…"
npx cap open ios

cat <<'EOT'

✅ Xcode va s'ouvrir sur le projet "App".
   1. Branche ton iPad au Mac (et "Faire confiance" sur l'iPad).
   2. Dans Xcode : onglet "Signing & Capabilities" -> choisis ton compte
      (un Apple ID gratuit suffit pour tester sur TON iPad pendant 7 jours ;
       le compte Apple Developer 99 $/an sert pour TestFlight / App Store).
   3. En haut, choisis ton iPad comme cible, puis clique Run (▶).
   L'app Practice s'installe et se lance sur l'iPad.
EOT
