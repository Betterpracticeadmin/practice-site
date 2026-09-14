"""Nombres en français pour la banque de phrases Practice : lecture en toutes lettres et contrôle strict."""
import re
import unicodedata

from num2words import num2words

_FEM_NOUN = re.compile(r"^\s+(heure|heures|minute|minutes)\b")


def spell(text):
    """Remplace les nombres par leur forme écrite (accord féminin devant heure(s)/minute(s), décimales « virgule »)."""
    digits_fr = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"]
    text = re.sub(r"\b([A-Z])(\d{3,5})\b", lambda m: m.group(1) + " " + " ".join(digits_fr[int(c)] for c in m.group(2)), text)
    out = re.sub(r"(\d+)[,.](\d+)",
                 lambda m: f"{num2words(int(m.group(1)), lang='fr')} virgule {num2words(int(m.group(2)), lang='fr')}", text)

    def whole(m):
        words = num2words(int(m.group(0)), lang="fr")
        if _FEM_NOUN.match(out[m.end():]) and (words == "un" or words.endswith(" et un") or words.endswith("-et-un")):
            words = words[:-2] + "une"
        return words
    return re.sub(r"(?<![A-Za-z])\d+(?![A-Za-z])", whole, out)


def _norm(s):
    s = unicodedata.normalize("NFC", s or "").lower().replace("-", " ")
    return re.sub(r"\s+", " ", s)


def expected_numbers(text):
    return [int(x) for x in re.findall(r"\d+", re.sub(r"(\d+)[,.](\d+)", r"\1 \2", text or ""))]


def numbers_ok(text, heard):
    """Vrai si chaque nombre attendu est entendu exactement (en chiffres ou en lettres)."""
    exp = expected_numbers(text)
    if not exp:
        return True
    h = _norm(heard)
    h = re.sub(r"(\d+)\s*h\s*(\d{1,2})", r"\1 \2", h)
    h = re.sub(r"(\d+)\s*[,.]\s*(\d+)", r"\1 \2", h)
    digits = [int(x) for x in re.findall(r"\d+", h)]
    padded = " " + re.sub(r"[^a-zàâäçéèêëîïôöùûüÿœæ ]+", " ", h) + " "
    for n in exp:
        if n in digits:
            digits.remove(n)
            continue
        w = _norm(num2words(n, lang="fr"))
        variants = {w, w[:-2] + "une" if w.endswith("un") else w}
        if n == 0:
            variants.add("zéro")
        if any(f" {v} " in re.sub(r"\s+", " ", padded) for v in variants):
            continue
        return False
    return True
