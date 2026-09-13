"""Construit C:\\ai\\voice\\bank\\phrases.json : phrases listées par l'inventaire + familles générées par formule."""
import importlib.util
import json
from pathlib import Path

SRC = Path(r"C:\ai\voice\inventory\bank.json")
OUT = Path(r"C:\ai\voice\bank\phrases.json")

spec = importlib.util.spec_from_file_location("bg", r"C:\ai\voice\bank_gen.py")
bg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bg)

bank = json.loads(SRC.read_text(encoding="utf-8"))
phrases = [{"id": p["id"], "text": p["text"], "category": p["category"], "priority": p["priority"]} for p in bank["phrases"]]

# A) heure arrondie à 5 min
for h in range(24):
    for mm in range(0, 60, 5):
        hs = "minuit" if h == 0 else "midi" if h == 12 else "1 heure" if h == 1 else f"{h} heures"
        phrases.append({"id": f"heure.{h:02d}.{mm:02d}", "text": f"Il est {hs}{' ' + str(mm) if mm else ''}.",
                        "category": "heure", "priority": "confort"})
# B) température
for t in range(-20, 46):
    ts = f"moins {-t}" if t < 0 else str(t)
    unit = "degré" if abs(t) < 2 else "degrés"
    phrases.append({"id": f"meteo.t.{'m' + str(-t) if t < 0 else t}", "text": f"Il fait {ts} {unit}.",
                    "category": "meteo", "priority": "confort"})
# C) vitesse
for v in range(5, 251, 5):
    phrases.append({"id": f"vit.{v}", "text": f"Tu roules à {v} kilomètres heure.", "category": "vitesse", "priority": "confort"})

seen_ids, seen_keys, dup_ids, dup_keys, out = set(), {}, [], [], []
for p in phrases:
    k = bg.key(p["text"])
    if p["id"] in seen_ids:
        dup_ids.append(p["id"])
        continue
    if k in seen_keys:
        dup_keys.append((p["id"], seen_keys[k]))
        continue
    seen_ids.add(p["id"])
    seen_keys[k] = p["id"]
    out.append(p)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
chars = sum(len(p["text"]) for p in out)
by = {}
for p in out:
    by[p["priority"]] = by.get(p["priority"], 0) + 1
print(f"{len(out)} phrases uniques -> {OUT}")
print(f"doublons d'id ignorés : {len(dup_ids)} | doublons de texte ignorés : {len(dup_keys)}")
print(f"par priorité : {by} | {chars} caractères, ~{chars / 13 / 60:.0f} min d'audio, ~{chars / 13 * 5.8 / 3600:.1f} h de génération")
for p in out[:6] + out[300:304] + out[-4:]:
    print(f"  {p['priority']:>8} {p['id']:<28} {p['text']}")
