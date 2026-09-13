"""Fige la voix officielle Practice (M1) et mesure le débit de génération selon la taille de lot."""
import hashlib
import json
import time
from pathlib import Path

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

SRC = Path(r"C:\ai\casting\round1\M1_t0")
OUT = Path(r"C:\ai\voice\practice")
BASE = r"C:\ai\models\Qwen3-TTS-12Hz-0.6B-Base"
meta = json.loads((SRC / "meta.json").read_text(encoding="utf-8"))
REF_TEXT = meta["ref_text"]

def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

OUT.mkdir(parents=True, exist_ok=True)
ref = OUT / "reference.wav"
ref.write_bytes((SRC / "ref.wav").read_bytes())

t = time.time()
model = Qwen3TTSModel.from_pretrained(BASE, device_map="cuda:0", dtype=torch.bfloat16, attn_implementation="sdpa")
print(f"modele charge en {time.time() - t:.1f}s", flush=True)
w, sr = sf.read(ref, dtype="float32")
prompt = model.create_voice_clone_prompt(ref_audio=(w, sr), ref_text=REF_TEXT)
torch.save(prompt, OUT / "voice_clone_prompt.pt")

acte = {
    "nom": "Voix officielle Practice",
    "description": "Voix entièrement synthétique, créée à partir d'une description textuelle, sans aucun enregistrement de personne réelle.",
    "brief": meta["instruct"],
    "texte_de_reference": REF_TEXT,
    "creation": {"date": "2026-09-13", "modele": "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
                 "revision": "5ecdb67327fd37bb2e042aab12ff7391903235d3", "seed": meta["seed"], "licence": "Apache-2.0"},
    "figeage": {"modele": "Qwen/Qwen3-TTS-12Hz-0.6B-Base", "revision": "5d83992436eae1d760afd27aff78a71d676296fc",
                "licence": "Apache-2.0", "mode": "voice_clone_prompt (ICL)"},
    "reference_wav_sha256": sha256(ref),
    "choisie_par": "Alessandro (casting à l'aveugle, lettre F), 13/09/2026",
}
(OUT / "acte_de_naissance.json").write_text(json.dumps(acte, ensure_ascii=False, indent=1), encoding="utf-8")
print("voix figee :", OUT, flush=True)

TEXTS = [
    "C’est parti. Je te guide.",
    "Itinéraire calculé. 12,4 kilomètres, environ 23 minutes.",
    "Dans 300 mètres, tourne à droite.",
    "Dans 200 mètres, au rond-point, prends la première sortie.",
    "Radar dans 400 mètres.",
    "Doucement, tu roules vite.",
    "Essaie d’anticiper un peu pour freiner plus en douceur.",
    "Mode grand tourisme. Profite de la route.",
]
bench = OUT / "bench"
bench.mkdir(exist_ok=True)
for bs in (1, 4, 8):
    torch.cuda.synchronize()
    t = time.time()
    audio_s = 0.0
    for i in range(0, len(TEXTS), bs):
        chunk = TEXTS[i:i + bs]
        torch.manual_seed(7)
        wavs, sr2 = model.generate_voice_clone(text=chunk, language=["French"] * len(chunk),
                                               voice_clone_prompt=prompt * len(chunk) if isinstance(prompt, list) else [prompt] * len(chunk))
        for j, wv in enumerate(wavs):
            audio_s += len(wv) / sr2
            if bs == 4:
                sf.write(bench / f"b4_{i + j}.wav", wv, sr2)
    torch.cuda.synchronize()
    dt = time.time() - t
    peak = torch.cuda.max_memory_allocated() / 2**30
    print(f"lot={bs}: {audio_s:.1f}s d'audio en {dt:.1f}s -> RTF {dt / audio_s:.2f} | pic VRAM {peak:.2f} Gio", flush=True)
    torch.cuda.reset_peak_memory_stats()
