"""Banque de phrases de la voix officielle Practice (Qwen3-TTS, voix figée M1).

Étapes (reprenables, état dans state.json) :
  gen      : génère les WAV manquants ou à refaire (voix figée, graine stable par phrase)
  qa       : Whisper large-v3-turbo réécoute chaque WAV -> taux d'erreur de caractères (CER)
  mp3      : coupe les silences, normalise, encode MP3 mono 24 kHz + métadonnées « voix IA »
  manifest : écrit manifest.json {clé normalisée -> fichier} pour os.html

Usage : python bank_gen.py <gen|qa|mp3|manifest|all> [--phrases C:\\ai\\voice\\bank\\phrases.json]
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import time
import unicodedata
from pathlib import Path

import sys
sys.path.insert(0, r"C:\ai\voice")
from numbers_fr import numbers_ok  # noqa: E402

BANK = Path(r"C:\ai\voice\bank")
VOICE = Path(r"C:\ai\voice\practice")
BASE = r"C:\ai\models\Qwen3-TTS-12Hz-0.6B-Base"
WHISPER = r"C:\ai\models\whisper-large-v3-turbo"
PUBLIC = Path(r"C:\Users\alesp\Documents\STAGE BETTERSTATE\site web claude code\practice-site-voix\public\voice\practice\fr")
CER_OK, CER_MAX, MAX_TRIES = 0.10, 0.25, 4
PRIO = {"securite": 0, "guidage": 1, "confort": 2}
ACCENTS = "àâäçéèêëîïôöùûüÿœæ"
APOS = "\u2019\u2018\u0060\u00b4"


def key(text):
    """Clé de recherche — DOIT rester identique à voiceKey() dans os.html."""
    s = unicodedata.normalize("NFC", text).lower()
    s = re.sub("[" + APOS + "]", "'", s)
    s = re.sub("[^0-9a-z" + ACCENTS + "']+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def log(msg):
    line = time.strftime("%H:%M:%S ") + msg
    print(line, flush=True)
    with (BANK / "bank.log").open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_state():
    p = BANK / "state.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def save_state(st):
    tmp = BANK / "state.json.tmp"
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(BANK / "state.json")


def load_phrases(path):
    items = json.loads(Path(path).read_text(encoding="utf-8"))
    return sorted(items, key=lambda x: (PRIO.get(x.get("priority"), 3), x["id"]))


def seed_for(pid, tries):
    return int(hashlib.sha1(f"{pid}#{tries}".encode()).hexdigest()[:8], 16)


def needs_gen(p, st):
    rec = st.get(p["id"])
    if rec is None:
        return True
    if rec.get("status") == "redo":
        return True
    if rec.get("text") != p["text"] or rec.get("tts") != p.get("tts"):  # texte ou prononciation modifiés
        return True
    return not (BANK / "wav" / f"{p['id']}.wav").exists() and rec.get("status") != "abandon"


def cmd_gen(a):
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    phrases, st = load_phrases(a.phrases), load_state()
    todo = [p for p in phrases if needs_gen(p, st)]
    log(f"gen : {len(todo)} phrases à générer sur {len(phrases)}")
    if not todo:
        return
    model = Qwen3TTSModel.from_pretrained(BASE, device_map="cuda:0", dtype=torch.bfloat16, attn_implementation="sdpa")
    prompt = torch.load(VOICE / "voice_clone_prompt.pt", weights_only=False)
    (BANK / "wav").mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    for n, p in enumerate(todo, 1):
        rec = st.setdefault(p["id"], {"tries": 0})
        if rec.get("text") != p["text"] or rec.get("tts") != p.get("tts"):
            rec["tries"] = 0
        rec["tries"] = rec.get("tries", 0) + 1
        torch.manual_seed(seed_for(p["id"], rec["tries"]))
        t = time.time()
        wavs, sr = model.generate_voice_clone(text=p.get("tts") or p["text"], language="French", voice_clone_prompt=prompt)
        sf.write(BANK / "wav" / f"{p['id']}.wav", wavs[0], sr)
        dur = len(wavs[0]) / sr
        rec.update(status="generated", text=p["text"], tts=p.get("tts"), key=key(p["text"]), category=p.get("category"),
                   priority=p.get("priority"), duration=round(dur, 2))
        if n % 5 == 0 or n == len(todo):
            save_state(st)
            eta = (time.time() - t0) / n * (len(todo) - n) / 60
            log(f"gen {n}/{len(todo)} ({p['id']} {dur:.1f}s en {time.time() - t:.0f}s) — reste ~{eta:.0f} min")
    save_state(st)


def _num_fr(s):
    try:
        from num2words import num2words
    except ImportError:
        return s
    s = re.sub(r"(\d+)[,.](\d+)",
               lambda m: f"{num2words(int(m.group(1)), lang='fr')} virgule {num2words(int(m.group(2)), lang='fr')}", s)
    return re.sub(r"\d+", lambda m: num2words(int(m.group(0)), lang="fr"), s)


def _norm_qa(s):
    s = unicodedata.normalize("NFC", s).lower()
    # Whisper abrège ce que la voix prononce en entier : on remet la forme longue des deux côtés
    s = re.sub(r"(\d+)\s*h\s*(\d{2})\b", r"\1 heures \2", s)
    s = re.sub(r"(\d+)\s*h\b", r"\1 heures", s)
    s = re.sub(r"\bkm\s*/\s*h\b", "kilomètres heure", s)
    s = re.sub(r"\bkm\b", "kilomètres", s)
    s = re.sub(r"(\d+)\s*m\b", r"\1 mètres", s)
    s = _num_fr(s).replace("-", " ")
    s = re.sub("[" + APOS + "']", " ", s)
    s = re.sub("[^a-z" + ACCENTS + " ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _cer(ref, hyp):
    if not ref:
        return 0.0 if not hyp else 1.0
    prev = list(range(len(hyp) + 1))
    for i, rc in enumerate(ref, 1):
        cur = [i] + [0] * len(hyp)
        for j, hc in enumerate(hyp, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (rc != hc))
        prev = cur
    return prev[-1] / len(ref)


def cmd_qa(a):
    import librosa
    import soundfile as sf
    import torch
    from transformers import pipeline

    st = load_state()
    todo = [pid for pid, r in st.items() if r.get("status") == "generated"]
    log(f"qa : {len(todo)} phrases à contrôler")
    if not todo:
        return
    asr = pipeline("automatic-speech-recognition", model=WHISPER, torch_dtype=torch.float16, device="cuda:0")
    counts = {"ok": 0, "warn": 0, "redo": 0, "abandon": 0}
    for n, pid in enumerate(todo, 1):
        rec = st[pid]
        w, sr = sf.read(BANK / "wav" / f"{pid}.wav", dtype="float32")
        w16 = librosa.resample(w, orig_sr=sr, target_sr=16000)
        hyp = asr({"raw": w16, "sampling_rate": 16000},
                  generate_kwargs={"language": "french", "task": "transcribe"})["text"]
        cer = _cer(_norm_qa(rec["text"]), _norm_qa(hyp))
        nums_ok = numbers_ok(rec["text"], hyp)
        rec.update(heard=hyp.strip(), cer=round(cer, 3), numbers_ok=nums_ok)
        if not nums_ok:  # un nombre faux (distance, vitesse, heure) n'est jamais accepté
            rec["status"] = "redo" if rec.get("tries", 1) < MAX_TRIES else "abandon"
        elif cer <= CER_OK:
            rec["status"] = "ok"
        elif cer <= (0.15 if rec.get("priority") in ("securite", "guidage") else CER_MAX):
            rec["status"] = "warn"
        elif rec.get("tries", 1) < MAX_TRIES:
            rec["status"] = "redo"
        else:
            rec["status"] = "abandon"
        counts[rec["status"]] += 1
        if rec["status"] in ("redo", "abandon"):
            log(f"  {rec['status']} {pid} CER {cer:.2f}{'' if nums_ok else ' NOMBRE FAUX'} | attendu « {rec['text']} » | entendu « {hyp.strip()} »")
        if n % 20 == 0 or n == len(todo):
            save_state(st)
            log(f"qa {n}/{len(todo)} {counts}")
    save_state(st)


def cmd_mp3(a):
    ff = shutil.which("ffmpeg")
    if not ff:
        raise SystemExit("ffmpeg introuvable dans le PATH")
    st = load_state()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    chain = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,"
             "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,"
             "apad=pad_dur=0.08,loudnorm=I=-18:TP=-1.5:LRA=11")
    n = 0
    for pid, r in st.items():
        if r.get("status") not in ("ok", "warn"):
            continue
        out, src = PUBLIC / f"{pid}.mp3", BANK / "wav" / f"{pid}.wav"
        if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            continue
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(src), "-af", chain, "-ar", "24000", "-ac", "1",
                        "-b:a", "56k", "-id3v2_version", "3",
                        "-metadata", "artist=Practice", "-metadata", "title=" + r["text"],
                        "-metadata", "comment=Voix de synthèse générée par IA (Qwen3-TTS, Apache-2.0) pour Practice",
                        "-metadata", "copyright=Practice", str(out)], check=True)
        n += 1
    log(f"mp3 : {n} fichiers encodés")


def cmd_manifest(a):
    st = load_state()
    entries = {r["key"]: f"{pid}.mp3" for pid, r in sorted(st.items())
               if r.get("status") in ("ok", "warn") and (PUBLIC / f"{pid}.mp3").exists()}
    man = {"version": time.strftime("%Y%m%d%H%M"), "voice": "practice-officielle", "lang": "fr",
           "normalization": "NFC, minuscules, apostrophes -> ', tout sauf [0-9 a-z accents français '] -> espace, espaces fusionnés",
           "count": len(entries), "entries": entries}
    (PUBLIC / "manifest.json").write_text(json.dumps(man, ensure_ascii=False, indent=0), encoding="utf-8")
    size = sum(f.stat().st_size for f in PUBLIC.glob("*.mp3"))
    counts = {}
    for r in st.values():
        counts[r.get("status")] = counts.get(r.get("status"), 0) + 1
    log(f"manifest : {len(entries)} phrases, {size / 2**20:.1f} Mo | états {counts}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["gen", "qa", "mp3", "manifest", "all"])
    ap.add_argument("--phrases", default=str(BANK / "phrases.json"))
    a = ap.parse_args()
    BANK.mkdir(parents=True, exist_ok=True)
    if a.step == "all":
        for _ in range(MAX_TRIES):
            cmd_gen(a)
            cmd_qa(a)
            if not any(r.get("status") in ("redo", "generated") for r in load_state().values()):
                break
        cmd_mp3(a)
        cmd_manifest(a)
    else:
        {"gen": cmd_gen, "qa": cmd_qa, "mp3": cmd_mp3, "manifest": cmd_manifest}[a.step](a)


if __name__ == "__main__":
    main()
