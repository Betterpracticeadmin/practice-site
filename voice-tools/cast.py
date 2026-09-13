"""Casting de voix inventées pour Practice IA — Qwen3-TTS (Apache-2.0), 100 % local.

Étapes :
  design : le modèle VoiceDesign 1.7B invente une voix par brief et lit la phrase de référence.
  clone  : le modèle Base 0.6B fige chaque voix (voice_clone_prompt) et lit les phrases de test.
  mp3    : normalisation -18 LUFS + MP3 pour la page d'écoute.

Exemples :
  python cast.py design --device cuda --takes 1
  python cast.py clone --device cuda
  python cast.py mp3
"""
import argparse
import json
import shutil
import subprocess
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

ROOT = Path(r"C:\ai")
MODELS = ROOT / "models"
OUT = ROOT / "casting" / "round1"
LOG = ROOT / "logs" / "casting.log"

REF_TEXT = (
    "Bonjour, je suis Practice, ton copilote. Je surveille la route avec toi : "
    "dans huit cents mètres, prends la deuxième sortie au rond-point, "
    "puis on continue tranquillement vers le centre-ville."
)

# Voix décrites uniquement par des traits : aucune personne réelle, aucune célébrité.
BRIEFS = {
    "F1": "Female voice, around 30 years old, warm and composed mid-low pitch, soft but very clear diction, "
          "native metropolitan French accent, calm reassuring pace, a gentle smile in the voice.",
    "F2": "Female voice, late twenties, bright and friendly timbre, lively but never rushed, crisp articulation, "
          "native metropolitan French accent, confident and positive.",
    "F3": "Female voice, around 40 years old, deep velvety low pitch, relaxed and intimate delivery, slow measured pace, "
          "very smooth, native French accent, elegant and serene.",
    "M1": "Male voice, early thirties, calm warm baritone, grounded and clear, precise diction, "
          "native metropolitan French accent, reassuring measured pace.",
    "M2": "Male voice, around 45 years old, deep low pitch with a slight natural texture, composed and kind, "
          "slow deliberate pace, native French accent.",
    "M3": "Male voice, mid twenties, light tenor, friendly and relaxed, modern natural conversational tone, "
          "native French accent, moderate pace.",
    "N1": "Androgynous voice, neither clearly male nor female, mid pitch, soft and slightly airy, very calm, "
          "precise and human delivery, native French accent.",
    "N2": "Gender-neutral voice, mid-low pitch, smooth and warm, little breathiness, poised and elegant, "
          "clear diction, native French accent, steady pace.",
}

TESTS = [
    ("go", "C’est parti. Je te guide."),
    ("calc", "Itinéraire calculé. 12.4 kilomètres, environ 23 minutes."),
    ("guidage", "Dans 300 mètres, tourne à droite sur rue Espariat."),
    ("rondpoint", "Dans 200 mètres, au rond-point, prends la 1e sortie."),
    ("alerte", "Radar dans 400 mètres. Doucement, tu roules vite."),
    ("coach", "Essaie d’anticiper un peu pour freiner plus en douceur."),
    ("conversation", "Il fait 24 degrés, ciel dégagé. Il est 14 heures 05. Tu roules à 87 kilomètres heure."),
    ("mode", "Mode grand tourisme. Profite de la route. Arrivée prévue vers 18 heures 40."),
]


def log(msg):
    line = time.strftime("%H:%M:%S ") + msg
    print(line, flush=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def pick_dtype(a):
    if a.dtype:
        return getattr(torch, a.dtype)
    return torch.bfloat16 if a.device.startswith("cuda") else torch.float32


def load(name, a):
    t = time.time()
    model = Qwen3TTSModel.from_pretrained(
        str(MODELS / name), device_map=a.device, dtype=pick_dtype(a), attn_implementation="sdpa"
    )
    vram = torch.cuda.memory_allocated() / 2**30 if torch.cuda.is_available() else 0
    log(f"{name} chargé sur {a.device} en {time.time() - t:.1f}s (VRAM allouée {vram:.2f} Gio)")
    return model


def to_np(w):
    if hasattr(w, "detach"):
        w = w.detach().float().cpu().numpy()
    return np.asarray(w, dtype=np.float32).squeeze()


def cmd_design(a):
    OUT.mkdir(parents=True, exist_ok=True)
    model = load("Qwen3-TTS-12Hz-1.7B-VoiceDesign", a)
    ids = a.only.split(",") if a.only else list(BRIEFS)
    for vid in ids:
        for take in range(a.takes):
            d = OUT / f"{vid}_t{take}"
            if (d / "ref.wav").exists() and not a.force:
                continue
            d.mkdir(parents=True, exist_ok=True)
            seed = 1000 + take
            torch.manual_seed(seed)
            t = time.time()
            wavs, sr = model.generate_voice_design(text=REF_TEXT, language="French", instruct=BRIEFS[vid])
            dt = time.time() - t
            w = to_np(wavs[0])
            sf.write(d / "ref.wav", w, sr)
            dur = len(w) / sr
            meta = {"voice": vid, "take": take, "seed": seed, "instruct": BRIEFS[vid], "ref_text": REF_TEXT,
                    "model": "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", "sr": sr, "duration_s": round(dur, 2),
                    "gen_s": round(dt, 1), "device": a.device}
            (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
            log(f"design {vid} prise {take} : {dur:.1f}s d'audio en {dt:.1f}s (RTF {dt / max(dur, 0.1):.2f})")


def cmd_clone(a):
    model = load("Qwen3-TTS-12Hz-0.6B-Base", a)
    only = set(a.only.split(",")) if a.only else None
    for d in sorted(p for p in OUT.iterdir() if (p / "ref.wav").exists()):
        if only and d.name.split("_")[0] not in only:
            continue
        w, sr = sf.read(d / "ref.wav", dtype="float32")
        prompt = model.create_voice_clone_prompt(ref_audio=(w, sr), ref_text=REF_TEXT)
        for key, text in TESTS:
            f = d / f"{key}.wav"
            if f.exists() and not a.force:
                continue
            torch.manual_seed(7)
            t = time.time()
            wavs, sr2 = model.generate_voice_clone(text=text, language="French", voice_clone_prompt=prompt)
            dt = time.time() - t
            out = to_np(wavs[0])
            sf.write(f, out, sr2)
            dur = len(out) / sr2
            log(f"clone {d.name} {key} : {dur:.1f}s en {dt:.1f}s (RTF {dt / max(dur, 0.1):.2f})")


def cmd_mp3(a):
    ff = shutil.which("ffmpeg")
    if not ff:
        raise SystemExit("ffmpeg introuvable dans le PATH")
    for wav in sorted(OUT.rglob("*.wav")):
        mp3 = wav.with_suffix(".mp3")
        if mp3.exists() and not a.force:
            continue
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(wav),
                        "-af", "loudnorm=I=-18:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-b:a", "96k", str(mp3)],
                       check=True)
    log("mp3 : conversion terminée")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("step", choices=["design", "clone", "mp3"])
    p.add_argument("--device", default="cuda:0")
    p.add_argument("--dtype", default="", help="bfloat16 / float16 / float32")
    p.add_argument("--takes", type=int, default=1)
    p.add_argument("--only", default="", help="ex. F1,M2")
    p.add_argument("--force", action="store_true")
    a = p.parse_args()
    {"design": cmd_design, "clone": cmd_clone, "mp3": cmd_mp3}[a.step](a)


if __name__ == "__main__":
    main()
