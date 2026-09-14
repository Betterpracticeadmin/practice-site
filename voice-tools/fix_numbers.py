"""Corrige la lecture des nombres de la banque Practice.

- Détecte, à partir des transcriptions Whisper déjà stockées, les phrases dont un nombre attendu n'a pas été entendu.
- Ajoute toutes les phrases contenant un nombre >= 100 (lecture des chiffres peu fiable au-delà).
- Écrit leurs ids dans numspell_ids.json : expand_phrases.py leur donne un champ « tts » en toutes lettres.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, r"C:\ai\voice")
from numbers_fr import expected_numbers, numbers_ok, spell  # noqa: E402

BANK = Path(r"C:\ai\voice\bank")
st = json.loads((BANK / "state.json").read_text(encoding="utf-8"))

big, wrong = [], []
for pid, r in st.items():
    exp = expected_numbers(r.get("text", ""))
    if not exp:
        continue
    if any(n >= 100 for n in exp):
        big.append(pid)
    if r.get("status") in ("ok", "warn", "abandon") and not numbers_ok(r["text"], r.get("heard")):
        wrong.append((pid, r.get("priority"), r["text"], r.get("heard")))

ids = sorted(set(big) | {w[0] for w in wrong})
(BANK / "numspell_ids.json").write_text(json.dumps(ids, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"nombre >= 100 : {len(big)} | nombre mal entendu : {len(wrong)} | à régénérer en toutes lettres : {len(ids)}")
for pid, prio, text, heard in sorted(wrong, key=lambda x: (x[1] or "", x[0])):
    print(f"  {prio:>8} {pid:<22} « {text} » -> « {heard} »  ==> tts « {spell(text)} »")
