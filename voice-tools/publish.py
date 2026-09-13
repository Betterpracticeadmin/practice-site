"""Prépare le tour d'écoute à l'aveugle : mélange les voix et copie leurs MP3 sous des lettres A-H.

La correspondance lettre -> brief reste dans C:\\ai\\casting\\round1\\mapping.json (jamais publiée).
"""
import json
import random
import shutil
from pathlib import Path

SRC = Path(r"C:\ai\casting\round1")
DST = Path(r"C:\Users\alesp\Documents\STAGE BETTERSTATE\site web claude code\voice-lab\casting\audio")
KEYS = ["ref", "go", "calc", "guidage", "rondpoint", "alerte", "coach", "conversation", "mode"]
TAKE = "_t0"

voices = sorted(d for d in SRC.iterdir() if d.is_dir() and d.name.endswith(TAKE))
order = voices[:]
random.Random(20260911).shuffle(order)

if DST.exists():
    shutil.rmtree(DST)
mapping, counts = {}, {}
for letter, d in zip("ABCDEFGH", order):
    mapping[letter] = d.name
    out = DST / letter
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for k in KEYS:
        f = d / f"{k}.mp3"
        if f.exists():
            shutil.copy2(f, out / f"{k}.mp3")
            n += 1
    counts[letter] = n

(SRC / "mapping.json").write_text(json.dumps(mapping, indent=1), encoding="utf-8")
print("fichiers par lettre :", counts, "| total", sum(counts.values()))
