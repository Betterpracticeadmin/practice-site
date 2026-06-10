# Practice — site web + Practice AI

Site vitrine du projet **Practice** (supercar kit sur base Porsche 911) avec un vrai
**chatbot Claude** embarqué qui répond aux visiteurs.

- **Front** : React + Vite + React Router (3 pages : Accueil, Practice AI, Contact)
- **Chatbot** : serveur Express + `@anthropic-ai/sdk` (streaming), modèle `claude-opus-4-8`
- La clé API reste **côté serveur** (jamais exposée dans le navigateur)

## Démarrage rapide

### 1. Installer les dépendances (une seule fois)
```bash
npm install
```

### 2. Configurer la clé API du chatbot
- Récupère une clé sur https://console.anthropic.com/ (Settings → API Keys)
- Copie `.env.example` en `.env` et colle ta clé :
```
ANTHROPIC_API_KEY=sk-ant-ta-vraie-cle
```
> Le site s'affiche même sans clé ; seul le chatbot affichera un message d'erreur tant que `.env` n'est pas rempli.

### 3. Lancer en développement
```bash
npm run dev
```
- Site : http://localhost:5173
- Le serveur chatbot tourne en parallèle sur le port 3001 (Vite y redirige `/api`)

## Mise en production
```bash
npm run build   # compile le site dans /dist
npm start       # un seul serveur Node sert le site + l'API sur le port 3001
```
Puis ouvre http://localhost:3001

## Personnalisation rapide
- **Persona / connaissances du chatbot** : `server/index.js` → constante `SYSTEM_PROMPT`
- **Modèle** : `server/index.js` → constante `MODEL` (`claude-opus-4-8`, ou `claude-sonnet-4-6` pour réduire les coûts)
- **Images** : `src/assets/` · **Vidéo hero** : `public/hero.mp4`
- **Contenu des pages** : `src/pages/`

## Formulaire Contact → email (Formspree)
Le formulaire peut envoyer les demandes dans ta boîte mail via [Formspree](https://formspree.io) :
1. Crée un compte gratuit, puis un nouveau formulaire → tu obtiens un endpoint `https://formspree.io/f/XXXXXXXX`.
2. Mets l'ID (`XXXXXXXX`) dans `.env` :
   ```
   VITE_FORMSPREE_ID=XXXXXXXX
   ```
3. Relance (`npm run dev`). La 1re soumission déclenche un email de confirmation Formspree à valider.

> Si `VITE_FORMSPREE_ID` est vide, le formulaire reste en **mode démo** (confirmation affichée, sans envoi).

Alessandro Pascal — Betterstate — 2026
