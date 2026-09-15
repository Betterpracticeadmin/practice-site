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
- `os.html` cherche la phrase dans la banque **avant** tout réseau, sinon repli sur la voix du navigateur (≈ 10 % des phrases en trajet guidé : destinations, réponses de Claude, musique). Il n'y a plus de service de voix distant ni de `neuralOff` dans `os.html` ; `api/tts.js` n'est plus qu'un bouchon (410) pour l'ancienne page `os-bw.html`.
- Clé : NFC, minuscules, apostrophes → `'`, tout sauf `[0-9 a-z accents français ']` → espace, espaces fusionnés (`key()` dans `bank_gen.py` = `voiceKey()` dans `os.html`, à garder identiques).
- Manifeste rechargé automatiquement en cas d'échec réseau (5 s, 30 s, puis toutes les 2 min, et au retour du réseau). MP3 servis avec `Cache-Control: public, max-age=31536000, immutable` (`vercel.json`), URL versionnée par `?v=<version du manifeste>`. Les consignes de virage (200 m) et les radars du trajet sont préchargés au calcul d'itinéraire ; une consigne urgente attend 0,9 s max le MP3 avant la voix du navigateur (2,5 s pour les réponses).
- Voix de repli du navigateur : masculine par défaut, comme la voix officielle.

## Où en est la génération (PC d'Alessandro, `C:\ai`)

- Banque complète : 2 233 phrases (`phrases.json`, copie de `C:\ai\voice\bank\phrases.json`) — heure à la minute (1 440), rappels de pause 30 → 1 080 min par pas de 15, « Je n'ai rien entendu. », « Média. », prononciation au féminin (« une heure », « vingt et une heures », « une minute ») via le champ `tts`.
- Génération en cours sur RTX 3050 (~6 s de calcul par seconde de voix), contrôle Whisper large-v3-turbo + régénération automatique. `bank_gen.py` écrit dans `practice-site-voix/public/voice/practice/fr`.
- Phrases à ajouter (nouveaux textes d'`os.html`) : météo dangereuse (bruine/pluie verglaçante, fortes chutes de neige, fortes averses, averses de neige, orage avec grêle), « Trafic inconnu. », « Climatisation coupée. », « Il reste plus de 1000 kilomètres. », « Tu gagneras plus d’une heure. », ETA 9 à 12 heures. Après ajout : relancer `bank_gen.py all` (reprenable) puis recopier `phrases.json` ici.

## Prochaines étapes

1. ~~Intégrer dans `os.html` (+ `pos/pos-coach.js`)~~ fait : module banque, corrections de textes, points du contrôle, relecture adversariale corrigée.
2. ~~Supprimer les voix ElevenLabs nommées, `scarlett1`, « Voix Jessica »~~ fait (`os.html`).
3. ~~Déverrouillage audio iOS~~ fait (WAV valide non muet, amorçage du micro sur un vrai geste).
4. AI Act art. 50 : mention « Practice est une IA » faite dans les réglages ; métadonnées « voix de synthèse » dans les MP3 ; filigrane AudioSeal à ajouter.
5. Test local (Playwright), aperçu Vercel de la branche, puis fusion dans `main` quand la banque est complète.

## Points à corriger relevés par le contrôle

- Banque cherchée avant tout réseau : fait (`neuralOff` supprimé d'`os.html`).
- Heure à la minute exacte, `durVoix` arrondit `remMin` : fait ; `kmVoix` > 1 050 km → « plus de 1000 kilomètres » ; ETA > 8 h arrondie à l'heure.
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

## État au 14/09/2026 (soir) : banque complète

- 2 247 phrases générées et contrôlées par Whisper : 2 225 validées, 22 validées avec réserve, 0 écartée (voir qa_report.json). 25,5 Mo de MP3 dans public/voice/practice/fr + manifest.json (version 202609142053).
- Lecture des nombres : la voix lisait mal certains nombres en chiffres (« 150 mètres » entendu « 50 mètres », « 190 » entendu « 1900 »). Correction : les 124 phrases concernées sont prononcées avec les nombres en toutes lettres (numbers_fr.spell, champ tts ; la clé ne change pas) et le contrôle est devenu strict sur les nombres (numbers_ok : un nombre faux n'est jamais accepté).
- Phrase d'urgence : prononciation réglée à la main (tts_overrides.json) : « appelle le 112. Police, le 17. SAMU, le 15. »
- Test de bout en bout avec la vraie banque (Playwright) : banque chargée, lecture réelle des MP3, libération de la parole, repli navigateur hors banque, 0 erreur JavaScript.
- Reste : test sur iPhone via l'aperçu Vercel de la branche, puis fusion dans main.

## 15/09/2026 : filigrane AudioSeal + correctif prénom

- En production depuis le 15/09 16 h 40 (main 32bd045).
- Filigrane audio AudioSeal (Meta, licence MIT, generator_base + detector_base) intégré à l'encodage (watermark.py, bank_gen.py mp3) : filigrane calculé à 16 kHz puis remis à 24 kHz, message 16 bits « PR » (Practice). Rapport signal/filigrane ≈ 30 dB. Robustesse vérifiée : détecté à 100 % après MP3 56k, message correct, 0 faux positif sans filigrane. Les 2 247 MP3 finaux sont tous vérifiés (probabilité min 0,954). Manifeste 202609151842 (cache des MP3 invalidé par ?v=).
- AI Act art. 50 : mention « Practice est une IA » (réglages) + métadonnées ID3 « voix de synthèse » + filigrane lisible par machine.
- api/ask.js : plus de prénom par défaut « Aldo » ; sans prénom, consigne de n'en inventer aucun.
