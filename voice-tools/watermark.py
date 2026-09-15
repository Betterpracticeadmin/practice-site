"""Filigrane audio AudioSeal (Meta, MIT) pour la banque de la voix Practice — AI Act art. 50(2).

Le modèle travaille à 16 kHz : on calcule le filigrane sur la voix rééchantillonnée à 16 kHz, on le remet à 24 kHz
et on l'ajoute au signal d'origine. Le message 16 bits identifie Practice (0x5052, « PR »).
Les poids sont chargés depuis C:\\ai\\models\\audioseal (téléchargés et vérifiés), sans accès réseau.
"""
import os
from pathlib import Path

os.environ.setdefault("NO_TORCH_COMPILE", "1")  # pas de Triton sous Windows : AudioSeal tourne sans torch.compile

import torch
import torchaudio.functional as AF

import audioseal.loader as _L

_LOCAL = Path(r"C:\ai\models\audioseal")
_orig_load = _L.load_model_checkpoint


def _load_local(path, device="cpu"):
    name = str(path).rsplit("/", 1)[-1]
    if (_LOCAL / name).is_file():
        return _L._safe_load_checkpoint(_LOCAL / name, device=device)
    return _orig_load(path, device)


_L.load_model_checkpoint = _load_local
from audioseal import AudioSeal  # noqa: E402

MESSAGE_BITS = [int(b) for b in format(0x5052, "016b")]  # « PR » = Practice
_gen = _det = None


def _models(device):
    global _gen, _det
    if _gen is None:
        _gen = AudioSeal.load_generator("audioseal_wm_16bits").to(device).eval()
        _det = AudioSeal.load_detector("audioseal_detector_16bits").to(device).eval()
    return _gen, _det


@torch.no_grad()
def apply(wave, sr, device="cuda:0", alpha=1.0):
    """wave : tableau numpy mono float32 à sr Hz -> tableau numpy filigrané (même longueur, même sr)."""
    gen, _ = _models(device)
    x = torch.as_tensor(wave, dtype=torch.float32, device=device).reshape(1, 1, -1)
    x16 = AF.resample(x, sr, 16000) if sr != 16000 else x
    msg = torch.tensor(MESSAGE_BITS, device=device).unsqueeze(0)
    wm16 = gen.get_watermark(x16, message=msg)
    wm = AF.resample(wm16, 16000, sr) if sr != 16000 else wm16
    n = x.shape[-1]
    wm = wm[..., :n] if wm.shape[-1] >= n else torch.nn.functional.pad(wm, (0, n - wm.shape[-1]))
    return (x + alpha * wm).clamp(-1.0, 1.0).reshape(-1).cpu().numpy()


@torch.no_grad()
def detect(wave, sr, device="cuda:0"):
    """-> (probabilité de filigrane 0-1, message correct ?)"""
    _, det = _models(device)
    x = torch.as_tensor(wave, dtype=torch.float32, device=device).reshape(1, 1, -1)
    x16 = AF.resample(x, sr, 16000) if sr != 16000 else x
    prob, message = det.detect_watermark(x16)
    return float(prob[0]), message[0].tolist() == MESSAGE_BITS
