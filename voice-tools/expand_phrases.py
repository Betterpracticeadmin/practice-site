"""Construit C:\\ai\\voice\\bank\\phrases.json : phrases listées par l'inventaire + familles générées par formule.

Passe 2 (13/09/2026) : heure à la minute, rappels de pause 30 -> 1 080 min par pas de 15, phrases manquantes
signalées par le contrôle, et champ « tts » pour prononcer « une heure », « vingt et une heures », « une minute ».
Le champ « text » reste la phrase exacte produite par os.html (c'est lui qui donne la clé de la banque).
"""
import importlib.util
import json
import re
from pathlib import Path

SRC = Path(r"C:\ai\voice\inventory\bank.json")
OUT = Path(r"C:\ai\voice\bank\phrases.json")

spec = importlib.util.spec_from_file_location("bg", r"C:\ai\voice\bank_gen.py")
bg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bg)

bank = json.loads(SRC.read_text(encoding="utf-8"))
phrases = [{"id": p["id"], "text": p["text"], "category": p["category"], "priority": p["priority"]} for p in bank["phrases"]]


def hours_fr(h):
    return "minuit" if h == 0 else "midi" if h == 12 else "1 heure" if h == 1 else f"{h} heures"


def duration_fr(m):
    if m < 60:
        return f"{m} minutes"
    h, mm = divmod(m, 60)
    return ("1 heure" if h == 1 else f"{h} heures") + (f" {mm}" if mm else "")


# A) heure à la minute près (décision d'Alessandro)
for h in range(24):
    for mm in range(60):
        phrases.append({"id": f"heure.{h:02d}.{mm:02d}", "text": f"Il est {hours_fr(h)}{' ' + str(mm) if mm else ''}.",
                        "category": "heure", "priority": "confort"})
# B) température
for t in range(-20, 46):
    ts = f"moins {-t}" if t < 0 else str(t)
    phrases.append({"id": f"meteo.t.{'m' + str(-t) if t < 0 else t}", "text": f"Il fait {ts} {'degré' if abs(t) < 2 else 'degrés'}.",
                    "category": "meteo", "priority": "confort"})
# C) vitesse
for v in range(5, 251, 5):
    phrases.append({"id": f"vit.{v}", "text": f"Tu roules à {v} kilomètres heure.", "category": "vitesse", "priority": "confort"})
# D) rappel de pause arrondi au quart d'heure (sécurité)
for m in range(30, 1081, 15):
    phrases.append({"id": f"alerte.pause.{m}", "text": f"Tu roules depuis {duration_fr(m)}.", "category": "alerte", "priority": "securite"})
# E) phrases manquantes relevées par le contrôle
phrases.append({"id": "err.stt.rien", "text": "Je n'ai rien entendu.", "category": "err", "priority": "confort"})
phrases.append({"id": "media.titre", "text": "Média.", "category": "media", "priority": "confort"})

FEM = [(re.compile(r"(?<!\d)21 heures"), "vingt et une heures"),
       (re.compile(r"(?<!\d)1 heure\b"), "une heure"),
       (re.compile(r"(?<!\d)1 minute\b"), "une minute")]

seen_ids, seen_keys, dup_ids, dup_keys, out = {}, {}, [], [], []
for p in phrases:
    k = bg.key(p["text"])
    if p["id"] in seen_ids:
        if seen_ids[p["id"]]["text"] != p["text"]:
            dup_ids.append(p["id"])
        continue
    if k in seen_keys:
        dup_keys.append((p["id"], seen_keys[k]))
        continue
    tts = p["text"]
    for rx, rep in FEM:
        tts = rx.sub(rep, tts)
    if tts != p["text"]:
        p["tts"] = tts
    seen_ids[p["id"]] = p
    seen_keys[k] = p["id"]
    out.append(p)

OUT.parent.mkdir(parents=True, exist_ok=True)
tmp = OUT.with_suffix(".json.tmp")
tmp.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
tmp.replace(OUT)
chars = sum(len(p["text"]) for p in out)
by = {}
for p in out:
    by[p["priority"]] = by.get(p["priority"], 0) + 1
print(f"{len(out)} phrases uniques -> {OUT}")
print(f"conflits d'id (même id, texte différent) : {len(dup_ids)} {dup_ids[:5]} | doublons de texte ignorés : {len(dup_keys)}")
print(f"par priorité : {by} | ~{chars / 13 / 60:.0f} min d'audio")
print(f"avec prononciation au féminin : {sum(1 for p in out if 'tts' in p)}")
for p in [x for x in out if "tts" in x][:6]:
    print(f"  {p['id']:<22} {p['text']}  ->  {p['tts']}")
