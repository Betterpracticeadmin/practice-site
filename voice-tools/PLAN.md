# Voix officielle Practice — état du chantier

Branche de sauvegarde `wip/voix-officielle` (rien n'est déployé tant que ce n'est pas fusionné dans `main`).

## Décisions validées par Alessandro

- **Voix officielle = voix F du casting** (brief M1) : masculine, début trentaine, baryton calme et chaleureux, diction précise, accent métropolitain, débit posé. Voix 100 % synthétique, créée à partir d'une description textuelle (voir `acte_de_naissance.json`).
- Modèles Qwen3-TTS **Apache-2.0** (licence vérifiée à la source le 13/09/2026) : usage commercial et créatif autorisé.
- **Guidage** : voix officielle seule, le nom de la rue n'est plus prononcé mais affiché en grand à l'écran.
- **Heure** : à la minute près (famille de 1 440 phrases).
- Pas de service à crédits (ElevenLabs abandonné).

## Architecture

- Vercel n'a pas de GPU et le téléphone ne peut pas générer la voix en direct : les phrases connues à l'avance sont **pré-générées en MP3** (`public/voice/practice/fr/*.mp3` + `manifest.json` clé normalisée → fichier).
- `os.html` cherche la phrase dans la banque **avant** tout réseau (et avant le test `neuralOff`), sinon repli sur la voix du navigateur (≈ 10 % des phrases en trajet guidé : destinations, réponses de Claude, musique).
- Clé : NFC, minuscules, apostrophes → `'`, tout sauf `[0-9 a-z accents français ']` → espace, espaces fusionnés (`key()` dans `bank_gen.py`, à reproduire à l'identique en JS).

## Où en est la génération (PC d'Alessandro, `C:\ai`)

- Passe 1 : 1 046 phrases (`phrases.json`) en cours, RTX 3050 (~6 s de calcul par seconde de voix), contrôle Whisper large-v3-turbo + régénération automatique.
- Passe 2 à lancer ensuite : heure à la minute (1 440), rappels de pause 30 → 1 080 min par pas de 15, « Je n'ai rien entendu. », « Média. », phrases ajoutées par l'intégration, prononciation au féminin (« une heure », « vingt et une heures », « une minute ») via un champ `tts`.

## Prochaines étapes

1. Intégrer dans `os.html` (+ `pos/pos-coach.js`) : module banque, 33 corrections de textes (`inventory/bank.json` → `text_fixes`), points signalés par le contrôle (`inventory/control.json`).
2. Supprimer le sélecteur des 8 voix ElevenLabs nommées, la migration `scarlett1`, le toast « Voix Jessica », les commentaires « Joi / Scarlett » et la fuite `?debug` d'`api/tts.js`.
3. Corriger le déverrouillage audio iOS (WAV vide + `muted`).
4. AI Act art. 50 : mention « Practice est une IA » + métadonnées « voix de synthèse » dans les MP3 (filigrane AudioSeal à ajouter).
5. Relecture adversariale, test local (Playwright), aperçu Vercel de la branche, puis fusion dans `main` quand la banque est complète.

## Points à corriger relevés par le contrôle

- Chercher la banque avant `if(neuralOff||Voice.neural===false) webSpeak(t)`.
- Heure : plus d'arrondi (minute exacte) ; `durVoix` doit arrondir `remMin` (flottant) ; règle `kmVoix` > 1 050 km à définir.
- Prénom fantôme « Aldo » : aussi l. 3868, l. 4299 et `posBridge.driverName`.
- Priorités : `sayDestination` (prio 3) coupe « On y va… » ; « Itinéraire calculé. » en prio 1 ; « recalcule » coupe « Recalcul… ».
- Météo : codes WMO 53/55/56/57/66/67/73/75/77/81/82/85/86/96/99 absents de `WX` (neige forte, pluie verglaçante, grêle jamais annoncées).
- `chitchat.json` (~7 000 réponses FR, contenu parfois daté) : laissé à la voix navigateur.
- `os-bw.html` et `drive.html` contiennent les mêmes chaînes : non modifiés (expériences).

## Reprendre

```bash
cd /c/ai/voice && HF_HUB_OFFLINE=1 PYTHONIOENCODING=utf-8 /c/ai/venvs/qwen3tts/Scripts/python.exe bank_gen.py all
```

Leçons réseau : IPv6 cassé sur ce poste (forcer IPv4, `segdl.py`), vérifier les SHA256.
