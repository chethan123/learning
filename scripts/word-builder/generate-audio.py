#!/usr/bin/env python
"""Generate the Word Builder voice clips with Kokoro-82M (local, CPU, Apache 2.0).

Environment (Python 3.12: kokoro 0.9.4 needs < 3.13; no ffmpeg needed, soundfile writes MP3):

    python3 -m pip install --target "$D/uvpkg" uv
    export UV_PYTHON_INSTALL_DIR="$D/pythons" UV_CACHE_DIR="$D/uvcache"
    "$D/uvpkg/bin/uv" venv --python 3.12 "$D/venv"
    "$D/uvpkg/bin/uv" pip install --python "$D/venv/bin/python" torch \
        --index-url https://download.pytorch.org/whl/cpu
    "$D/uvpkg/bin/uv" pip install --python "$D/venv/bin/python" \
        kokoro==0.9.4 misaki==0.9.4 soundfile numpy

    (D is any scratch folder. The first run downloads hexgrad/Kokoro-82M, about 315 MB,
    into $HF_HOME, and misaki installs spaCy en_core_web_sm, 13 MB.)

Run from the repository root:

    npx tsx scripts/word-builder/audio-manifest.ts > /tmp/audio-manifest.json
    HF_HOME="$D/hf" "$D/venv/bin/python" scripts/word-builder/generate-audio.py \
        --manifest /tmp/audio-manifest.json --out src/pages/word-builder/assets/audio

Writes <out>/words/<word>.mp3 and <out>/sounds/<id>.mp3 (mono, 24 kHz, 64 kbps constant)
and skips files that already exist, so a hand-recorded replacement is never overwritten.
--force regenerates everything; --only a,b,... limits the run to those words or sound ids.

Words are spoken from misaki's phonemes for the plain word read as a sentence ("cup."), with the
overrides in WORD_PHONEMES and WORD_ENDING; a vowel-like release after a final stop is cut off
(strip_final_release). Sounds cannot be
spoken bare by this model (a lone phoneme gives a weak noise and a vowel blip), so each sound is
synthesised inside a short carrier syllable and cut out; SOUNDS below holds one entry per id.
The cut points come from the audio itself (voicing, high-band noise, spectral change), searched
inside the window the model's own predicted token durations give for the target phoneme.
Synthesis is seeded, so a run is repeatable.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import warnings
from dataclasses import dataclass, field

warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402

SR = 24000
FRAME = 600  # samples per predicted-duration unit (25 ms)
HOP = 120  # analysis hop, 5 ms
WIN = 600  # analysis window, 25 ms
VOICE = "af_heart"
SPEED = 1.0  # below ~0.95 Kokoro prepends a short voiced blip to every clip
EDGE_SILENCE = 0.020  # seconds of silence kept at each end of every clip
SEED = 1234

# Words are spoken from misaki's phonemes for the plain word, read as a sentence: "cup." The full
# stop gives the falling, finished intonation and, for most words, a cleaner final consonant.

# Words whose default pronunciation does not match the sound clips. misaki says dog/fog/log/frog
# with /ɔ/; the "o" sound clip is /ɑ/, so these use /ɑ/ to match the sounding-out (plan 6.2).
# Further entries are overrides chosen with a speech recogniser (see the WP6 report).
WORD_PHONEMES: dict[str, str] = {
    "dog": "dˈɑɡ",
    "fog": "fˈɑɡ",
    "log": "lˈɑɡ",
    "frog": "fɹˈɑɡ",
    # misaki /ɪ/ came out as "sheb", "beb"; Kokoro's /ᵻ/ is heard as ship, bib
    "ship": "ʃˈᵻp",
    "bib": "bˈᵻb",
}

# Sentence ending per word where the full stop was not the clearest (recogniser check with
# whisper-tiny.en): "" = none, "!" = exclamation (stops "tubby", "pub").
WORD_ENDING: dict[str, str] = {
    **dict.fromkeys(["cat", "cap", "bun", "pen", "zip", "hand", "tent", "kick", "chest", "cup", "pump", "lock"], ""),
    "tub": "!",
    "pup": "!",
}


@dataclass(frozen=True)
class Sound:
    """One isolated sound: where it comes from and how it is cut out.

    carrier: Kokoro phoneme string the sound is synthesised in.
    target:  index (in the carrier's phoneme tokens) of the phoneme to keep.
    kind:    plan table row; sets the target peak level.
    method:  cut method, see cut_sound().
    dur:     predicted-duration overrides {token index: frames of 25 ms}; lengthens a phoneme
             natively instead of looping it.
    length:  target clip length in ms (looped or trimmed to it), 0 = as cut.
    pre_ms:  release method: how much to keep before the burst (voice bar of a voiced stop).
    post_ms: release method: how much to keep after the burst; 0 = up to the onset of voicing,
             -1 = to the end of the carrier.
    keep_ms: steady method: keep at most this much from the onset. A lengthened consonant drifts
             towards a vowel after about 200 ms, so only its first part is kept and looped.
    """

    carrier: str
    target: int
    kind: str
    method: str
    dur: dict[int, int] = field(default_factory=dict)
    length: int = 0
    pre_ms: int = 0
    post_ms: int = 0
    keep_ms: int = 0


PEAK_DB = {
    "vowel": -3.0,
    "stop": -10.0,
    "fricative": -8.0,
    "affricate": -8.0,
    "nasal": -3.0,
    "liquid": -3.0,
    "coda-nasal": -3.0,
    "glide": -6.0,
    "cluster": -8.0,
}

# fmt: off
SOUNDS: dict[str, Sound] = {
    # vowels: the short vowel alone (model's own durations), its voiced run, 220-280 ms
    "a":  Sound("ˈæ", 1, "vowel", "vowel", length=250),
    "e":  Sound("ˈɛ", 1, "vowel", "vowel", length=250),
    "i":  Sound("ˈɪ", 1, "vowel", "vowel", length=250),
    "o":  Sound("ˈɑ", 1, "vowel", "vowel", length=250),
    "u":  Sound("ˈʌ", 1, "vowel", "vowel", length=250),
    # voiceless stops: burst and aspiration, cut where the vowel's voicing starts
    "p":  Sound("pˈɑ", 0, "stop", "release", post_ms=0),
    "t":  Sound("tˈɑ", 0, "stop", "release", post_ms=0),
    "k":  Sound("kˈɑ", 0, "stop", "release", post_ms=0),
    # voiced stops: 20 ms of voice bar, the burst, and the shortest release still heard as the
    # stop (recogniser check: 30 ms lost d, 40 ms lost b and g in some contexts)
    "b":  Sound("bˈɑ", 0, "stop", "release", pre_ms=20, post_ms=50),
    "d":  Sound("dˈɑ", 0, "stop", "release", pre_ms=20, post_ms=40),
    "g":  Sound("ɡˈɑ", 0, "stop", "release", pre_ms=20, post_ms=50),
    # voiceless fricatives: the noise run, lengthened with random noise grains. s f th sound
    # cleaner at the end of a syllable (no voicing creeps in), sh at the start.
    "s":  Sound("ˈʌs", 2, "fricative", "noise", length=250),
    "f":  Sound("ˈʌf", 2, "fricative", "noise", length=250),
    "sh": Sound("ʃˈɑ", 0, "fricative", "noise", length=250),
    "th": Sound("ˈʌθ", 2, "fricative", "noise", length=200),
    "h":  Sound("hˈɑ", 0, "fricative", "noise", length=160),
    # voiced fricatives: z is voiced only at the start of a syllable (final z is devoiced);
    # v has almost no noise, so it is cut like a sonorant
    "z":  Sound("zˈɑ", 0, "fricative", "voiced-noise", {0: 4}, 250),
    "v":  Sound("vˈɑ", 0, "fricative", "steady", {0: 6}, 250, keep_ms=140),
    # affricates: burst plus frication. ch from the end of a syllable (long frication), j from
    # the start (voiced) with a short voiced release
    "ch": Sound("ˈʌʧ", 2, "affricate", "release", length=200, post_ms=-1),
    "j":  Sound("ʤˈɑ", 0, "affricate", "release", pre_ms=20, post_ms=70),
    # nasals: the murmur only (energy below 500 Hz, 12 dB above 500-1500 Hz), looped to 350 ms
    "m":  Sound("ˈʌm", 2, "nasal", "nasal", length=350),
    "n":  Sound("nˈɑ", 0, "nasal", "nasal", {0: 8}, 350),
    "ng": Sound("ˈɪŋ", 2, "coda-nasal", "nasal", length=350),
    # liquids: lengthened natively, first 180 ms kept (later it drifts to a vowel), looped
    "l":  Sound("lˈɑ", 0, "liquid", "steady", {0: 14}, 350, keep_ms=180),
    "r":  Sound("ɹˈɑ", 0, "liquid", "steady", {0: 12}, 350, keep_ms=180),
    # glides: the glide up to the vowel onset
    "w":  Sound("wˈɑ", 0, "glide", "steady", {0: 6}, keep_ms=160),
    "y":  Sound("jˈʌ", 0, "glide", "steady", {0: 6}, keep_ms=160),
    # cluster: from the k burst after the closure to the end of the s
    "x":  Sound("ˈɑks", 2, "cluster", "release", post_ms=-1),
}
# fmt: on


# --------------------------------------------------------------------------- synthesis
def _patch_espeak() -> None:
    """The espeak-ng bundled with misaki truncates data paths longer than about 160 characters;
    hand it a relative path instead (cwd becomes its parent). Harmless for short paths."""
    from phonemizer.backend.espeak import api

    orig = api.EspeakAPI.__init__

    def init(self, library, data_path):  # type: ignore[no-untyped-def]
        if data_path is not None and len(str(data_path)) > 150:
            os.chdir(os.path.dirname(str(data_path)))
            data_path = os.path.basename(str(data_path))
        orig(self, library, data_path)

    api.EspeakAPI.__init__ = init


class Voice:
    def __init__(self, voice: str = VOICE, speed: float = SPEED) -> None:
        _patch_espeak()
        import torch
        from kokoro import KPipeline

        self.torch = torch
        self.pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
        self.model = self.pipe.model
        self.voice = voice
        self.speed = speed

    def word_phonemes(self, word: str) -> str:
        if word in WORD_PHONEMES:
            return WORD_PHONEMES[word]
        _, toks = self.pipe.g2p(word)
        return "".join(t.phonemes or "" for t in toks)

    def tokens(self, ps: str) -> list[str]:
        return [c for c in ps if c in self.model.vocab]

    def phonemes(self, ps: str, dur: dict[int, int] | None = None) -> tuple[np.ndarray, np.ndarray]:
        """Synthesise a phoneme string; returns (audio, token edges in samples).

        Same computation as KModel.forward_with_tokens (kokoro 0.9.4), plus optional overrides of
        the predicted duration of single tokens. Edges has len(tokens) + 3 entries: the leading
        pad, each token, the trailing pad.
        """
        torch, m = self.torch, self.model
        ids = [m.vocab[c] for c in self.tokens(ps)]
        x = torch.LongTensor([[0, *ids, 0]])
        ref = self.pipe.load_voice(self.voice)[len(ids) - 1]
        torch.manual_seed(SEED)
        with torch.no_grad():
            lengths = torch.full((1,), x.shape[-1], dtype=torch.long)
            mask = torch.zeros_like(x, dtype=torch.bool)
            bert = m.bert(x, attention_mask=(~mask).int())
            d_en = m.bert_encoder(bert).transpose(-1, -2)
            s = ref[:, 128:]
            d = m.predictor.text_encoder(d_en, s, lengths, mask)
            h, _ = m.predictor.lstm(d)
            frames = torch.sigmoid(m.predictor.duration_proj(h)).sum(-1) / self.speed
            pred = torch.round(frames).clamp(min=1).long().squeeze(0)
            for k, v in (dur or {}).items():
                pred[k + 1] = v
            idx = torch.repeat_interleave(torch.arange(x.shape[1]), pred)
            aln = torch.zeros((x.shape[1], idx.shape[0]))
            aln[idx, torch.arange(idx.shape[0])] = 1
            aln = aln.unsqueeze(0)
            f0, n = m.predictor.F0Ntrain(d.transpose(-1, -2) @ aln, s)
            t_en = m.text_encoder(x, lengths, mask)
            audio = m.decoder(t_en @ aln, f0, n, ref[:, :128]).squeeze().numpy()
        edges = np.concatenate([[0], np.cumsum(pred.tolist())]) * FRAME
        return audio.astype(np.float32), edges


# --------------------------------------------------------------------------- analysis
def _butter_lowpass():
    from scipy.signal import butter

    return butter(6, 900, "low", fs=SR, output="sos")


def features(a: np.ndarray) -> dict[str, np.ndarray]:
    """Per 5 ms frame: level (dB re peak frame), low-band periodicity, low/high band energy, and a
    20-band log spectrum."""
    from scipy.signal import sosfiltfilt

    lp = sosfiltfilt(_butter_lowpass(), a)
    n = max(0, (len(a) - WIN) // HOP)
    fq = np.fft.rfftfreq(WIN, 1 / SR)
    win = np.hanning(WIN)
    edges = np.geomspace(100, 11000, 21)
    bands = [(fq >= edges[k]) & (fq < edges[k + 1]) for k in range(20)]
    rms, hv, lf, hf, nas = (np.zeros(n) for _ in range(5))
    spec = np.zeros((n, 20))
    for i in range(n):
        f = a[i * HOP : i * HOP + WIN]
        rms[i] = np.sqrt(np.mean(f * f)) + 1e-9
        g = lp[i * HOP : i * HOP + WIN]
        g = g - g.mean()
        ac = np.correlate(g, g, "full")[WIN - 1 :]
        hv[i] = ac[60:320].max() / ac[0] if ac[0] > 1e-10 else 0.0
        sp = np.abs(np.fft.rfft(f * win)) ** 2 + 1e-12
        lf[i] = 10 * np.log10(sp[fq < 900].sum())
        hf[i] = 10 * np.log10(sp[fq >= 3000].sum())
        nas[i] = 10 * np.log10(sp[(fq >= 500) & (fq < 1500)].sum() / sp[fq < 500].sum())
        spec[i] = [10 * np.log10(sp[b].mean()) for b in bands]
    db = 20 * np.log10(rms / rms.max())
    voiced = (hv > 0.6) & (db > -30) & (lf > lf.max() - 30)
    return dict(db=db, hv=hv, lf=lf, hf=hf, nas=nas, spec=spec, voiced=voiced)


def frame_of(sample: float) -> int:
    return int(max(0, (sample - WIN // 2) / HOP))


def sample_of(frame: int) -> int:
    return frame * HOP + WIN // 2


def runs(mask: np.ndarray, gap: int = 1) -> list[tuple[int, int]]:
    """Runs of True frames as [start, end), bridging gaps of up to `gap` frames."""
    out: list[tuple[int, int]] = []
    i, n = 0, len(mask)
    while i < n:
        if not mask[i]:
            i += 1
            continue
        j = i
        while j < n and (mask[j] or (j + gap < n and mask[j : j + gap + 1].any() and mask[j + 1 : j + gap + 1].any())):
            j += 1
        out.append((i, j))
        i = j
    return out


def first_run(mask: np.ndarray, start: int, need: int = 3) -> int:
    for i in range(start, len(mask) - need + 1):
        if mask[i : i + need].all():
            return i
    return len(mask)


def spectral_distance(F: dict[str, np.ndarray], i0: int, i1: int) -> np.ndarray:
    tmpl = np.median(F["spec"][i0:i1], axis=0)
    sel = tmpl > tmpl.max() - 45
    return np.abs(F["spec"][:, sel] - tmpl[sel]).mean(axis=1)


# --------------------------------------------------------------------------- shaping
def fade(x: np.ndarray, in_ms: float = 6, out_ms: float = 6) -> np.ndarray:
    x = x.copy()
    fi, fo = int(in_ms / 1000 * SR), int(out_ms / 1000 * SR)
    if fi:
        x[:fi] *= np.linspace(0, 1, fi) ** 0.5 if in_ms > 8 else np.linspace(0, 1, fi)
    if fo:
        x[-fo:] *= np.linspace(1, 0, fo)
    return x


def loop_voiced(seg: np.ndarray, target: int, xf_ms: float = 12) -> np.ndarray:
    """Lengthen a steady voiced sound to `target` samples by looping part of its middle.

    Like a sampler loop: the loop start and end are chosen where the waveform matches best
    (normalised cross-correlation of 20 ms windows, plus equal level), so the seam is a near
    continuation; the seam is also crossfaded. The loop is at least 60 ms long, since short loops
    are heard as a flutter."""
    n = len(seg)
    if n >= target:
        return seg
    w = min(int(0.020 * SR), int(n * 0.15))
    xf = min(int(xf_ms / 1000 * SR), w)
    min_len = min(int(0.060 * SR), int(n * 0.35))  # short sounds: the longest loop that fits
    lo, hi = int(n * 0.15), int(n * 0.5)
    best = (-np.inf, 0, 0)
    for i in range(lo, hi, 24):
        ref = seg[i : i + w]
        r_e = float(np.sqrt(np.sum(ref * ref))) + 1e-9
        j0, j1 = i + min_len, int(n * 0.92) - w
        if j1 <= j0:
            continue
        span = seg[j0 : j1 + w]
        num = np.correlate(span, ref, "valid")
        energy = np.sqrt(np.convolve(span * span, np.ones(w), "valid")) + 1e-9
        ncc = num / (energy * r_e)
        level = -np.abs(20 * np.log10(energy / r_e)) * 0.05  # penalise level jumps
        score = ncc + level
        k = int(np.argmax(score))
        if score[k] > best[0]:
            best = (float(score[k]), i, j0 + k)
    _, st, en = best
    if en <= st or en + xf > n:
        return seg
    ramp = np.linspace(0, 1, xf, dtype=np.float32)
    parts = [seg[:en]]
    total = en + (n - en)
    while total < target:
        # after seg[en - 1] the natural next sample is seg[en]; jump back to seg[st] instead,
        # crossfading from the natural continuation into the loop start
        chunk = seg[st:en].copy()
        chunk[:xf] = seg[en : en + xf] * (1 - ramp) + seg[st : st + xf] * ramp
        parts.append(chunk)
        total += en - st
    parts.append(seg[en:])  # the loop ends at en, so the original ending follows seamlessly
    return np.concatenate(parts).astype(np.float32)


def extend_noise(seg: np.ndarray, target: int, grain_ms: float = 30) -> np.ndarray:
    """Lengthen an aperiodic (noise) sound: keep its start and end, and fill the middle by
    overlap-adding randomly chosen grains of its steady part. The grains are uncorrelated, so
    they use sine windows at 50 % overlap (constant power) and equal-power crossfades at the
    two joins."""
    n = len(seg)
    if n >= target:
        return seg
    g = int(grain_ms / 1000 * SR)
    hop = g // 2
    head, tail = int(n * 0.3), int(n * 0.3)
    lo, hi = int(n * 0.2), int(n * 0.8) - g
    if hi <= lo:
        return seg
    rng = np.random.default_rng(SEED)
    w = np.sin(np.linspace(0, np.pi, g, endpoint=False)).astype(np.float32)
    xf = hop
    body_len = max(2 * xf + 1, target - head - tail)
    nb = int(np.ceil(body_len / hop)) + 2
    body = np.zeros(nb * hop + g, dtype=np.float32)
    for k in range(nb):
        s = int(rng.integers(lo, hi))
        body[k * hop : k * hop + g] += seg[s : s + g] * w
    body = body[hop : hop + body_len]
    up = np.sin(np.linspace(0, np.pi / 2, xf)).astype(np.float32)
    down = np.cos(np.linspace(0, np.pi / 2, xf)).astype(np.float32)
    first = seg[: head + xf].copy()
    first[head:] = first[head:] * down + body[:xf] * up
    last = seg[n - tail - xf :].copy()
    last[:xf] = body[-xf:] * down + last[:xf] * up
    return np.concatenate([first, body[xf:-xf], last]).astype(np.float32)


def peak(a: np.ndarray, db: float) -> np.ndarray:
    m = float(np.abs(a).max()) or 1.0
    return (a * (10 ** (db / 20) / m)).astype(np.float32)


def pad(a: np.ndarray) -> np.ndarray:
    z = np.zeros(int(EDGE_SILENCE * SR), dtype=np.float32)
    return np.concatenate([z, a, z])


def trim_silence(a: np.ndarray, thr_db: float = -45) -> np.ndarray:
    """Cut leading and trailing silence (frames more than thr_db below the loudest frame), leaving
    EDGE_SILENCE at each end, with short fades."""
    hop = 120
    n = len(a) // hop
    env = np.sqrt(np.mean(a[: n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9
    idx = np.where(env > env.max() * 10 ** (thr_db / 20))[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] * hop - int(EDGE_SILENCE * SR))
    e = min(len(a), (idx[-1] + 1) * hop + int(EDGE_SILENCE * SR))
    return fade(a[s:e], 4, 8)


# --------------------------------------------------------------------------- sound cutting
def cut_sound(audio: np.ndarray, edges: np.ndarray, spec: Sound) -> tuple[np.ndarray, str]:
    """Cut the target phoneme out of its carrier. Returns (clip without edge padding, note)."""
    F = features(audio)
    n = len(F["db"])
    k = spec.target + 1  # +1 for the leading pad token
    # Kokoro's audio runs ahead of its predicted durations by about 40-100 ms; widen the window.
    w0 = frame_of(edges[k] - 0.15 * SR)
    w1 = min(n, frame_of(edges[k + 1] + 0.05 * SR))
    loud = F["db"] > -35
    onset = first_run(loud, 0, 2)
    voiced = F["voiced"]
    m = spec.method
    fi, fo = 6.0, 6.0

    if m == "vowel":
        best = max(runs(voiced & loud, gap=2), key=lambda r: r[1] - r[0])
        s0, e0 = sample_of(best[0]) - WIN // 2, sample_of(best[1]) + WIN // 4
        fi, fo = 10, 40

    elif m == "release":
        # a stop or affricate release: the sharpest rise of high-band energy out of a closure
        hf = F["hf"]
        lo_, hi_ = max(2, w0), min(n - 1, w1)
        rise = np.array([hf[i] - hf[max(0, i - 8) : i].min() if F["db"][i] > -30 else -99 for i in range(lo_, hi_)])
        burst = lo_ + int(np.argmax(rise))
        while burst > lo_ and F["db"][burst - 1] > -35 and hf[burst - 1] > hf[burst] - 8:
            burst -= 1  # back up to the first frame of the transient (a voice bar has no high band)
        b_s = sample_of(burst) - WIN // 2
        s0 = b_s - int(spec.pre_ms / 1000 * SR)
        if spec.post_ms > 0:
            e0 = b_s + int(spec.post_ms / 1000 * SR)
        elif spec.post_ms == 0:
            e0 = sample_of(first_run(voiced, burst + 2, 3)) - WIN // 2 + int(0.004 * SR)
        else:
            e0 = sample_of(len(loud) - 1 - first_run(loud[::-1], 0, 2)) + WIN // 2
        fi = 8 if spec.pre_ms else 2
        fo = 15 if spec.post_ms > 0 else 25 if spec.post_ms < 0 else 6

    elif m == "nasal":
        # nasal murmur: strong energy below 500 Hz, at least 12 dB more than 500-1500 Hz
        mask = loud & (F["nas"] < -12) & (F["hv"] > 0.5)
        rs = [r for r in runs(mask, gap=3) if r[1] > w0 and r[0] < w1] or runs(mask, gap=3)
        best = max(rs, key=lambda r: r[1] - r[0])
        s0 = sample_of(best[0]) - WIN // 4
        e0 = sample_of(best[1]) - WIN // 4
        fi, fo = 15, 30

    elif m in ("noise", "voiced-noise"):
        if m == "noise":
            mask = loud & ~voiced & (F["hf"] - F["lf"] > -10)
        else:
            mask = loud & voiced & (F["hf"] - F["lf"] > -8)
        rs = [r for r in runs(mask, gap=2) if r[1] > w0 and r[0] < w1] or runs(mask, gap=2)
        best = max(rs, key=lambda r: r[1] - r[0])
        s0 = sample_of(best[0]) - WIN // 2
        e0 = sample_of(best[1]) - int(0.010 * SR)
        fi, fo = 12, 25

    elif m == "steady":
        # lengthened onset consonant: template from its middle, end where the spectrum moves away
        t0, t1 = frame_of(edges[k] - 0.06 * SR), frame_of(edges[k + 1] - 0.06 * SR)
        m0, m1 = t0 + (t1 - t0) // 4, t0 + (t1 - t0) // 2
        dist = spectral_distance(F, m0, m1)
        far = dist > 9.0
        end = first_run(far, m1, 3)
        s0 = sample_of(onset) - WIN // 2
        e0 = sample_of(end) - WIN // 2 - int(0.010 * SR)
        if spec.keep_ms:
            e0 = min(e0, s0 + int(spec.keep_ms / 1000 * SR))
        fi, fo = 15, 30

    else:
        raise ValueError(f"unknown cut method {m}")

    s0, e0 = max(0, int(s0)), min(len(audio), int(e0))
    seg = audio[s0:e0].astype(np.float32)
    note = f"cut {s0 / SR * 1000:.0f}-{e0 / SR * 1000:.0f} ms"
    target = int(spec.length / 1000 * SR)
    if target:
        if len(seg) < target * 0.88:
            seg = extend_noise(seg, target) if m == "noise" else loop_voiced(seg, target)
            note += f", lengthened to {spec.length} ms"
        elif len(seg) > target * 1.15:
            if m == "vowel":  # keep the steady middle, not the onset glide
                st = (len(seg) - target) // 3
                seg = seg[st : st + target]
            else:
                seg = seg[:target]
            note += f", trimmed to {spec.length} ms"
    return fade(seg, fi, fo), note


def make_sound(v: Voice, spec: Sound) -> tuple[np.ndarray, str]:
    audio, edges = v.phonemes(spec.carrier, spec.dur)
    clip, note = cut_sound(audio, edges, spec)
    return pad(peak(clip, PEAK_DB[spec.kind])), note


STOPS = set("ptkbdɡ")


def strip_final_release(a: np.ndarray, voiced_stop: bool) -> tuple[np.ndarray, str]:
    """Kokoro often voices the closure of a word-final stop and releases it into a short voiced
    "uh" (cup -> "cub-uh"). Find the final burst (the last sharp rise of high-band energy); cut
    the voicing that follows it (a voiced stop keeps 30 ms of it), and for p t k also silence the
    voiced closure before it, so the stop is not heard as b d g."""
    F = features(a)
    n = len(F["db"])
    loud = F["db"] > -35
    last = n - 1 - first_run(loud[::-1], 0, 2)
    hf = F["hf"]
    peak_i = int(np.argmax(F["db"]))
    vowel = [r for r in runs(F["voiced"], gap=2) if r[0] <= peak_i < r[1]]
    if not vowel:
        return a, ""
    vowel_end = vowel[0][1]  # the loudest voiced run (vowel, with a following nasal or l)
    onsets = [
        i
        for i in range(max(9, vowel_end - 2), last + 1)
        if F["db"][i] > -35
        and F["db"][i - 8 : i].min() < -18  # comes out of a closure
        and hf[i] - hf[i - 8 : i].min() >= 12
        and not (hf[i - 1] - hf[i - 9 : i - 1].min() >= 12)
    ]
    if not onsets:
        return a, ""
    burst = onsets[-1]  # the last release: t in "nest", k in "desk"
    b_s = sample_of(burst) - WIN // 2
    notes = []
    out = a.copy()
    if not voiced_stop:
        # closure: from where the vowel/nasal level falls away to the burst
        c = burst  # stop at the vowel (level) or at a fricative (high band), as in "nest"
        while c > 0 and F["db"][c - 1] < -12 and hf[c - 1] < hf[burst] - 15:
            c -= 1
        c_s = sample_of(c) + int(0.005 * SR)
        if b_s - c_s > int(0.02 * SR):
            r = int(0.008 * SR)
            g = np.ones(b_s - c_s, dtype=np.float32) * 0.03
            g[:r] = np.linspace(1, 0.03, r)
            g[-r // 2 :] = np.linspace(0.03, 1, len(g[-r // 2 :]))
            out[c_s:b_s] *= g
            notes.append(f"closure {(b_s - c_s) / SR * 1000:.0f} ms silenced")
    v_on = first_run(F["voiced"], burst + 2, 2)
    cut = len(out)
    if v_on < last:
        cut = sample_of(v_on) - WIN // 2
        if voiced_stop:
            cut = b_s + int(0.030 * SR)
        else:  # keep the burst audible, but no more than its aspiration
            cut = min(max(cut, b_s + int(0.025 * SR)), b_s + int(0.080 * SR))
    if cut < len(out) - int(0.025 * SR):
        notes.append(f"release cut ({(len(out) - cut) / SR * 1000:.0f} ms)")
        out = fade(out[:cut], 0, 20)
    return out, ", ".join(notes)


def make_word(v: Voice, word: str) -> tuple[np.ndarray, str]:
    ps = v.word_phonemes(word)
    end = WORD_ENDING.get(word, ".")
    a = trim_silence(v.phonemes(ps + end)[0])
    note = ps + end
    if ps and ps[-1] in STOPS:
        core = a[int(EDGE_SILENCE * SR) :]
        core, cut = strip_final_release(core, ps[-1] in "bdɡ")
        if cut:
            a = np.concatenate([a[: int(EDGE_SILENCE * SR)], core, np.zeros(int(EDGE_SILENCE * SR), np.float32)])
            note = f"{note} {cut}".strip()
    return peak(a, -1.0), note


# --------------------------------------------------------------------------- output
def write_mp3(path: str, a: np.ndarray) -> None:
    tmp = path + ".part"
    # libsndfile's MPEG Layer III encoder: compression_level 0.62 at 24 kHz mono = 64 kbps CBR
    sf.write(tmp, a, SR, format="MP3", bitrate_mode="CONSTANT", compression_level=0.62)
    os.replace(tmp, path)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", required=True, help='JSON {"words": [...], "sounds": [...]}')
    ap.add_argument("--out", required=True, help="audio folder (gets words/ and sounds/)")
    ap.add_argument("--force", action="store_true", help="regenerate files that already exist")
    ap.add_argument("--only", default="", help="comma-separated words or sound ids to (re)make")
    o = ap.parse_args()

    with open(o.manifest, encoding="utf-8") as fh:
        manifest = json.load(fh)
    out = os.path.abspath(o.out)  # absolute: the espeak workaround may change the cwd
    only = {s for s in o.only.split(",") if s}
    missing = [s for s in manifest["sounds"] if s not in SOUNDS]
    if missing:
        print(f"no SOUNDS entry for: {', '.join(missing)}", file=sys.stderr)
        return 1

    jobs: list[tuple[str, str]] = [("words", w) for w in manifest["words"]]
    jobs += [("sounds", s) for s in manifest["sounds"]]
    todo = []
    for folder, name in jobs:
        if only and name not in only:
            continue
        path = os.path.join(out, folder, f"{name}.mp3")
        if os.path.exists(path) and not o.force:
            continue
        todo.append((folder, name, path))
    print(f"{len(jobs)} clips in manifest, {len(todo)} to make")
    if not todo:
        return 0

    v = Voice()
    for folder, name, path in todo:
        t0 = time.time()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if folder == "words":
            a, note = make_word(v, name)
        else:
            a, note = make_sound(v, SOUNDS[name])
        write_mp3(path, a)
        print(f"wrote {folder}/{name}.mp3  {len(a) / SR * 1000:4.0f} ms  {time.time() - t0:4.1f} s  {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
