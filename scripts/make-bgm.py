"""Original background beds for AdSmile. Not copied from any existing recording."""
import subprocess
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path("/workspace/public/music")
OUT.mkdir(parents=True, exist_ok=True)

def adsr(n, a=0.01, d=0.08, s=0.65, r=0.12):
    env = np.zeros(n)
    na, nd, nr = int(a * n), int(d * n), max(1, int(r * n))
    ns = max(0, n - na - nd - nr)
    i = 0
    env[i:i + na] = np.linspace(0, 1, na, endpoint=False); i += na
    env[i:i + nd] = np.linspace(1, s, nd, endpoint=False); i += nd
    env[i:i + ns] = s; i += ns
    env[i:] = np.linspace(s, 0, n - i)
    return env

def tone(freq, dur, vol=0.2, kind="sine", attack=0.02, decay=0.2, sustain=0.5, release=0.2):
    n = int(SR * dur)
    if n <= 0 or freq <= 0:
        return np.zeros(1)
    t = np.arange(n) / SR
    if kind == "tri":
        w = 2 * np.abs(2 * ((freq * t) % 1) - 1) - 1
    elif kind == "soft":
        w = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t) + 0.12 * np.sin(2 * np.pi * freq * 3 * t)
    else:
        w = np.sin(2 * np.pi * freq * t) + 0.15 * np.sin(2 * np.pi * freq * 1.003 * t)
    return w * adsr(n, attack, decay, sustain, release) * vol

def place(buf, start, clip):
    i = int(start * SR)
    end = min(len(buf), i + len(clip))
    if i >= len(buf) or end <= i:
        return
    buf[i:end] += clip[: end - i]

def beat(bpm):
    return 60 / bpm

SCALES = {
    "Am": [220.00, 261.63, 329.63, 349.23, 440.00],
    "F": [174.61, 220.00, 261.63, 349.23, 440.00],
    "C": [261.63, 329.63, 392.00, 523.25, 659.25],
    "G": [196.00, 246.94, 293.66, 392.00, 493.88],
    "Em": [164.81, 196.00, 246.94, 329.63, 392.00],
    "D": [146.83, 220.00, 293.66, 369.99, 440.00],
    "Bb": [233.08, 293.66, 349.23, 466.16, 587.33],
    "Dm": [146.83, 174.61, 220.00, 293.66, 349.23],
}

def render(name, bpm, chords, seed, energy=0.4, mood="pad"):
    rng = np.random.default_rng(seed)
    bars = 8
    b = beat(bpm)
    dur = bars * 4 * b
    buf = np.zeros(int(SR * (dur + 0.2)))
    for bar, chord in enumerate(chords * (bars // len(chords) + 1)):
        if bar >= bars:
            break
        root, third, fifth = SCALES[chord][0], SCALES[chord][1], SCALES[chord][2]
        start = bar * 4 * b
        if mood != "sport":
            pad = tone(root / 2, 4 * b, 0.08, "soft", 0.2, 0.2, 0.8, 0.3)
            pad += tone(third / 2, 4 * b, 0.05, "soft", 0.25, 0.2, 0.7, 0.3)
            pad += tone(fifth / 2, 4 * b, 0.045, "sine", 0.2, 0.2, 0.7, 0.3)
            place(buf, start, pad)
        scale = SCALES[chord]
        steps = 8 if energy > 0.7 else 4
        for step in range(steps):
            if rng.random() > (0.85 if mood == "calm" else 0.55):
                continue
            freq = scale[int(rng.integers(0, len(scale)))]
            if rng.random() < 0.3:
                freq *= 2
            vol = 0.07 + energy * 0.06
            kind = "tri" if mood in ("bright", "cheerful") else "sine"
            place(buf, start + step * (4 * b / steps), tone(freq, 4 * b / steps * 0.9, vol, kind, 0.01, 0.12, 0.2, 0.15))
        if energy > 0.35:
            for kick_at in (0, 2) if energy < 0.8 else (0, 1, 2, 3):
                n = int(SR * 0.18)
                t = np.arange(n) / SR
                freq = 140 * np.exp(-t * 14) + 48
                kick = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 10) * (0.18 + energy * 0.2)
                place(buf, start + kick_at * b, kick)
        if energy > 0.55:
            for hat_at in range(8):
                n = int(SR * 0.04)
                hat = rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / SR * 40) * 0.05 * energy
                place(buf, start + hat_at * (b / 2), hat)
        if energy > 0.75:
            for snare_at in (1, 3):
                n = int(SR * 0.16)
                t = np.arange(n) / SR
                snare = rng.uniform(-1, 1, n) * np.exp(-t * 16) * 0.16
                snare += np.sin(2 * np.pi * 180 * t) * np.exp(-t * 12) * 0.08
                place(buf, start + snare_at * b, snare)
        if mood == "grand":
            place(buf, start, tone(root, 4 * b, 0.1, "soft", 0.4, 0.2, 0.85, 0.4))
            place(buf, start, tone(fifth, 4 * b, 0.07, "soft", 0.5, 0.2, 0.8, 0.4))
    fade = int(0.04 * SR)
    ramp = np.linspace(0, 1, fade)
    body = buf[:-fade]
    body[:fade] = body[:fade] * ramp + buf[-fade:] * (1 - ramp)
    peak = np.max(np.abs(body)) or 1
    body = body / peak * 0.9
    wav = OUT / f"{name}.wav"
    import wave
    with wave.open(str(wav), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes((np.clip(body, -1, 1) * 32767).astype(np.int16).tobytes())
    mp3 = OUT / f"{name}.mp3"
    subprocess.run(["ffmpeg", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "128k", str(mp3)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    wav.unlink()
    print(name, round(dur, 1))

TRACKS = [
    ("calm-a", 74, ["Am", "F", "C", "G"], 11, 0.25, "calm"),
    ("calm-b", 68, ["C", "Am", "F", "G"], 19, 0.22, "calm"),
    ("bright-a", 108, ["C", "G", "Am", "F"], 23, 0.62, "bright"),
    ("bright-b", 116, ["G", "C", "D", "Em"], 29, 0.66, "bright"),
    ("emotion-a", 70, ["Em", "C", "G", "D"], 31, 0.3, "pad"),
    ("emotion-b", 64, ["Am", "F", "C", "G"], 37, 0.28, "pad"),
    ("cheerful-a", 120, ["G", "D", "Em", "C"], 41, 0.72, "cheerful"),
    ("cheerful-b", 126, ["C", "F", "G", "Am"], 43, 0.74, "cheerful"),
    ("grand-a", 66, ["Dm", "Bb", "F", "C"], 47, 0.4, "grand"),
    ("grand-b", 60, ["Am", "F", "Dm", "G"], 53, 0.38, "grand"),
    ("sport-a", 128, ["Am", "F", "C", "G"], 59, 0.92, "sport"),
    ("sport-b", 132, ["Em", "C", "G", "D"], 61, 0.95, "sport"),
]

for item in TRACKS:
    render(*item)
