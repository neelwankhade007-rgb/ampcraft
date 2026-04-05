# 🎸 AmpCraft

> Upload any guitar audio and get a complete amp + effects signal chain preset — powered by audio signal processing.

---

## How It Works

```
audio file
   ↓
feature_extractor.py  →  trim silence, onset detection, pitch tracking, flux
   ↓
hybrid playing engine →  analyzes rhythm vs. lead ratio
   ↓
classifier.py         →  zero-shot KNN matches features to ideal tone profiles
   ↓
tone_engine.py        →  builds smart gear chain (amp, cab, efx, mod, delay, reverb)
   ↓
JSON response
```

No randomness. Same audio always gives the same preset.

---

## Project Structure

```
ampcraft/
├── backend/
│   ├── main.py               # FastAPI routes + tone classification heuristic
│   ├── tone_engine.py        # Gear selection engine (all logic lives here)
│   ├── feature_extractor.py  # Audio feature extraction via librosa
│   ├── gear.json             # Full gear catalogue (amps, cabs, efx, mod, delay, reverb)
│   ├── requirements.txt
│   └── uploads/              # Uploaded audio files (auto-created)
└── frontend/
    ├── src/
    │   ├── App.jsx           # React UI
    │   └── App.css
    └── index.html
```

---

## Setup & Run

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

- Frontend → `http://localhost:5173`
- Backend  → `http://localhost:8000`

---

## API

| Method | Endpoint   | Description                       |
|--------|------------|-----------------------------------|
| GET    | `/`        | Health check                      |
| POST   | `/upload`  | Save file without analyzing       |
| POST   | `/analyze` | Upload audio → return tone preset |

### `/analyze` response

```json
{
  "chain": {
    "style": "rock",
    "tone_character": "balanced",
    "noise_gate": { "type": "noise_gate", "enabled": true, "threshold": -45 },
    "efx": { "type": "t_screamer", "gain": 6 },
    "amp": { "type": "plexi_100", "gain": 6, "volume": 7, "treble": 6, "mid": 6, "bass": 6 },
    "cab": { "type": "m1960av", "mic": "SM57" }
  },
  "chain_lead": {
    "style": "high_gain",
    "amp": { "type": "slo_100", "gain": 7, "volume": 6, "treble": 7, "mid": 5, "bass": 5 }
  },
  "features": {
    "centroid": 2107,
    "rolloff": 4446,
    "flatness": 0.0031,
    "zcr": 0.0879,
    "rms": 0.2067
  },
  "hybrid": {
    "dominant": "hybrid",
    "ratio_rhythm": 0.45,
    "ratio_lead": 0.55,
    "hybrid_ratio": 0.45
  }
}
```

---

## Playing-Style & Tone Classification

AmpCraft now utilizes **Intelligent Playing-Style Detection**:
1. **Hybrid Extractions:** Uses onset detection, pitch tracking, and spectral flux to segment frames into **lead** vs. **rhythm** playing styles.
2. **Zero-Shot KNN:** Compares the extracted features (ZCR, RMS, Centroid, Flatness, Rolloff) against pre-defined "Ideal Acoustic Profiles" using Euclidean distance. ZCR and RMS are heavily weighted to distinguish tightness and energy.
3. **Multi-Chain Generation:** The backend provides specialized gear configurations for both rhythm playing and lead playing based on the track's dynamics.

> **Note:** Full-band mixes (drums + bass + vocals) pull spectral centroid down. For best accuracy, upload an isolated guitar track or DI signal.

---

## Tech Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Backend  | Python, FastAPI, librosa      |
| Frontend | React, Vite, Axios            |
| Gear DB  | `gear.json` (hierarchical DB) |