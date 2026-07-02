#!/usr/bin/env bash
# ============================================================
#  Déploie Practice OS en prod (Vercel) en une commande.
#  Usage :  ./deploy.sh "mon message de commit"
#  (sans message -> "maj practice os")
# ============================================================
set -e
cd "$(dirname "$0")"

MSG="${1:-maj practice os}"

echo ""
echo "== 1/5  Régénération de la version bitmap N&B (os-bw.html) =="
node _bw_inject.cjs

echo ""
echo "== 2/5  Récupération des derniers changements =="
git pull origin main

echo ""
echo "== 3/5  Ajout des fichiers du site =="
git add public/

echo ""
echo "== 4/5  Commit : \"$MSG\" =="
git commit -m "$MSG" || echo "(rien à committer)"

echo ""
echo "== 5/5  Publication (Vercel déploie automatiquement) =="
git push origin main

echo ""
echo "============================================================"
echo " OK ! Attends ~1 min puis rafraîchis :"
echo " https://practice-site-five.vercel.app"
echo "============================================================"
