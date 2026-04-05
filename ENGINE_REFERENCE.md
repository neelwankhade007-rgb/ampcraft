# AmpCraft Engine — Technical Reference & Audit

## ✅ What's Working (Do Not Break)

### 1. Feature Extraction (`feature_extractor.py`)
- Silence trimming with `librosa.effects.trim(top_db=25)`
- Active frame masking (gate at 3% of peak RMS)
- Extracts: **MFCC (13)**, **Centroid**, **Rolloff**, **Flatness**, **ZCR**, **RMS**
- `extract_named()` returns a clean `dict` of named floats/ints

### 2. Classifier (`classifier.py`)
- Zero-shot KNN using **Euclidean distance** to ideal profiles
- 7 tone classes: `jazz, clean, blues, rock, high_gain, metal, bass`
- ZCR weighted **5x** (currently too aggressive — causes misclassification of clean leads)
- Works well for extreme cases (very clean vs very distorted)

### 3. Tone Engine (`tone_engine.py`)
- `generate_chain()` → full signal chain from `tone_class + features`
- Gear selection is **2-feature** (Centroid + RMS offset for variety)
- Knob mapping via `_map_feature_to_knob()` — reactive to audio features
- Metal/High Gain: delay=None, reverb=None, mod=None ✅
- Metal uses 4×12 only (RECT 412, DIE412, SLO412) ✅
- Metal EFX = T-Screamer boost only (no distortion stacking) ✅

### 4. API / Pipeline (`main.py`)
```
upload → extract_named() → classify_tone() → generate_chain() → JSON → UI
```
Clean, no hardcoding. Everything flows from audio features.

---

## 🚨 4 Structural Problems (Awaiting Fix Guidance)

### ❌ Problem 1 — Classification ≠ Real Tone
**What happens:** Engine picks ONE label from `[jazz, clean, blues, rock, high_gain, metal, bass]`

**Reality:** Songs are **mixed tones**
- Hotel California intro = clean + warmth + subtle breakup
- Linkin Park = metal + mid boost + tight controlled gain
- Blues rock = clean + crunch blend

**Effect:** A "rock" label vs "high_gain" label changes the entire gear chain even if the actual difference is subtle

---

### ❌ Problem 2 — Knob Mapping is Too Linear
**Current code:**
```python
gain = min(100, int(zcr * 450))
treble = min(100, int(centroid / 50))
```

**Problem:**
- Small ZCR changes → huge gain jumps (feels random)
- No smoothing, no curve, no saturation function
- Linear mapping doesn't match how amp knobs actually behave
  (real knobs are often logarithmic or have "sweet spot" zones)

---

### ❌ Problem 3 — No Context Awareness
**What the engine sees:** `centroid = 2100 → mid tone`

**What it doesn't know:**
- Is this rhythm (chunky chords) or lead (single notes)?
- Is it palm-muted (low energy bursts) or open strumming?
- Is it recorded clean or already distorted at source?

**Features that could help distinguish:**
- `rms variance` (rhythm = spiky, lead = sustained)
- `spectral flux` (how quickly the spectrum changes)
- `onset density` (note count per second)

---

### ❌ Problem 4 — Knobs React Independently (The Biggest One)
**Current behavior:** Each knob is calculated in isolation from others

**Reality — knobs have relationships:**

| If this goes UP... | Then this should... |
|---|---|
| Gain ↑ | Bass ↓ (avoid mud), Presence ↑ (restore clarity) |
| Treble ↑ | Master ↓ slightly (harshness control) |
| Mids ↑ | Presence ↓ slightly |
| Gain very high | Gate Sens ↑ (tighter gate needed) |

**A real amp is a compensation system, not a set of independent sliders.**

---

## Current Ideal Profiles (Classifier Reference)

```python
IDEAL_PROFILES = {
    "jazz":      centroid=800,  zcr=0.012, flatness=0.001, rms=0.08
    "clean":     centroid=1400, zcr=0.030, flatness=0.003, rms=0.10
    "bass":      centroid=500,  zcr=0.010, flatness=0.0005, rms=0.12
    "blues":     centroid=1800, zcr=0.045, flatness=0.006, rms=0.14
    "rock":      centroid=2200, zcr=0.070, flatness=0.010, rms=0.16
    "high_gain": centroid=2600, zcr=0.100, flatness=0.025, rms=0.18
    "metal":     centroid=2800, zcr=0.135, flatness=0.045, rms=0.20
}
```

**Known issue:** ZCR weight=5x is too dominant.
Clean guitar leads (Hotel California solo) have high ZCR from fast picking/vibrato →
fool the classifier into metal/high_gain territory.

---

## Diagnostic Results (Reference Tracks)

| Track | Centroid | ZCR | RMS | Flatness | Got | Expected |
|---|---|---|---|---|---|---|
| LP Qwerty | 2150 | 0.160 | ~0.22 | 0.003 | metal ✅ | metal |
| HC Intro Clean | 1808 | 0.130 | 0.009 | 0.004 | high_gain ❌ | clean |
| HC Outro Lead | 2241 | 0.153 | 0.050 | 0.007 | metal ❌ | rock/blues |

**Key insight:** RMS is the missing differentiator.
- LP Qwerty RMS = 0.22 (loud, compressed, wall of sound)
- HC Intro RMS = 0.009 (quiet, delicate, nylon strings)
- HC Lead RMS = 0.050 (moderate, controlled, clean lead)

High ZCR + Low RMS = **clean/lead playing** (not metal)
High ZCR + High RMS = **distorted metal** (correct)

---

## Next Steps (Awaiting User Guidance)
- [ ] Fix classifier weight balance (ZCR + RMS combined threshold)
- [ ] Fix knob relationships (compensation system)
- [ ] Add context awareness signals
- [ ] Smooth knob mapping curves
