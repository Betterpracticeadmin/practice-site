"""Téléchargeur par segments pour connexions instables.

Chaque segment (32 Mo) est demandé avec un en-tête Range, contrôlé (code 206, Content-Range exact,
nombre d'octets exact), écrit dans son propre fichier puis renommé atomiquement. Un segment raté est
retéléchargé seul. Les segments valides survivent aux redémarrages. Assemblage final + SHA256.

Usage : python segdl.py <repo_id> <fichier> <chemin_sortie>
"""
import hashlib
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
import socket

# L'IPv6 ne répond pas sur ce réseau (connexion impossible) : on ne garde que les adresses IPv4.
_getaddrinfo = socket.getaddrinfo


def _ipv4_only(*args, **kwargs):
    return [r for r in _getaddrinfo(*args, **kwargs) if r[0] == socket.AF_INET]


socket.getaddrinfo = _ipv4_only

SEG = 32 * 1024 * 1024
WORKERS = 6
TIMEOUT = 30


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


NOREDIR = urllib.request.build_opener(NoRedirect)


def meta(repo, fname):
    with urllib.request.urlopen(f"https://huggingface.co/api/models/{repo}?blobs=true", timeout=TIMEOUT) as r:
        j = json.load(r)
    for x in j["siblings"]:
        if x["rfilename"] == fname:
            lfs = x.get("lfs") or {}
            return int(x["size"]), (lfs.get("oid") or lfs.get("sha256"))
    raise SystemExit(f"{fname} introuvable dans {repo}")


def cdn_url(repo, fname):
    url = f"https://huggingface.co/{repo}/resolve/main/{urllib.parse.quote(fname)}"
    try:
        NOREDIR.open(urllib.request.Request(url, method="HEAD"), timeout=TIMEOUT)
        return url
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
            return urllib.parse.urljoin(url, e.headers["Location"])
        raise


def fetch_seg(repo, fname, idx, start, end, partdir):
    path = os.path.join(partdir, f"{idx:05d}.part")
    want = end - start + 1
    if os.path.exists(path) and os.path.getsize(path) == want:
        return idx
    last = None
    for attempt in range(1, 31):
        tmp = path + ".tmp"
        try:
            req = urllib.request.Request(cdn_url(repo, fname), headers={"Range": f"bytes={start}-{end}"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                if r.status != 206:
                    raise IOError(f"code {r.status} au lieu de 206")
                cr = r.headers.get("Content-Range", "")
                if not cr.startswith(f"bytes {start}-{end}/"):
                    raise IOError(f"Content-Range inattendu : {cr}")
                got = 0
                with open(tmp, "wb") as f:
                    while True:
                        b = r.read(1 << 20)
                        if not b:
                            break
                        f.write(b)
                        got += len(b)
            if got != want:
                raise IOError(f"segment court {got}/{want}")
            os.replace(tmp, path)
            return idx
        except Exception as e:  # coupure, délai dépassé, URL signée expirée…
            last = e
            try:
                os.remove(tmp)
            except OSError:
                pass
            time.sleep(min(30, 2 * attempt))
    raise IOError(f"segment {idx} abandonné après 30 essais : {last}")


def main():
    repo, fname, out = sys.argv[1], sys.argv[2], sys.argv[3]
    size, oid = meta(repo, fname)
    name = repo.split("/")[1]
    log(f"{name}/{fname} : {size / 2**20:.0f} Mo, empreinte {oid[:12]}…")
    partdir = out + ".parts"
    os.makedirs(partdir, exist_ok=True)
    segs = [(i, s, min(s + SEG, size) - 1) for i, s in enumerate(range(0, size, SEG))]
    already = sum(1 for i, s, e in segs
                  if os.path.exists(os.path.join(partdir, f"{i:05d}.part"))
                  and os.path.getsize(os.path.join(partdir, f"{i:05d}.part")) == e - s + 1)
    log(f"{len(segs)} segments, {already} déjà valides")
    done, t0 = already, time.time()
    with ThreadPoolExecutor(WORKERS) as ex:
        futs = [ex.submit(fetch_seg, repo, fname, i, s, e, partdir) for i, s, e in segs]
        for f in as_completed(futs):
            f.result()
            done += 1
            if done % 6 == 0 or done == len(segs):
                log(f"{name} : {done}/{len(segs)} segments ({done * SEG / 2**30:.2f} Go)")
    log("assemblage et vérification de l'empreinte…")
    h, tmp = hashlib.sha256(), out + ".assembling"
    with open(tmp, "wb") as w:
        for i, s, e in segs:
            with open(os.path.join(partdir, f"{i:05d}.part"), "rb") as p:
                while True:
                    b = p.read(8 << 20)
                    if not b:
                        break
                    h.update(b)
                    w.write(b)
    if h.hexdigest() != oid:
        os.remove(tmp)
        shutil.rmtree(partdir, ignore_errors=True)
        log("EMPREINTE KO : segments supprimés, relancer le script")
        sys.exit(2)
    os.replace(tmp, out)
    shutil.rmtree(partdir, ignore_errors=True)
    log(f"OK : {name}/{fname} vérifié ({(time.time() - t0) / 60:.1f} min)")


if __name__ == "__main__":
    main()
