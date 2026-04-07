# 🎸 AmpCraft

> Upload any guitar audio and get a complete amp + effects signal chain preset — powered by professional audio signal processing.

---

## How It Works

```
audio file
   ↓
feature_extractor.py  →  extracts ZCR, RMS, flatness, centroid, and rolloff
   ↓
tone_engine.py        →  Dominant Distortion Rule (ZCR-based) + Lead/Palm-Mute Detection
   ↓
tone_engine.py        →  builds smart gear chain (amp, cab, efx, mod, delay, reverb)
   ↓
JSON response
```

No randomness. No complex ML latency. Just fast, deterministic heuristics that match the physics of guitar tone.

---

## Project Structure

```
ampcraft/
├── backend/
│   ├── main.py               # FastAPI routes + response orchestration
│   ├── tone_engine.py        # Core logic: Classification, style detection, and chain generation
│   ├── feature_extractor.py  # Audio feature extraction via librosa
│   ├── gear.json             # Gear database (amps, cabs, effects parameters)
│   ├── requirements.txt
│   └── uploads/              # Uploaded audio files (auto-created)
└── frontend/
    ├── src/
    │   ├── App.jsx           # React UI with real-time debug visualization
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
| POST   | `/analyze` | Upload audio → return tone preset |

### `/analyze` response example

```json
{
  "chain": {
    "style": "Metal",
    "gain_score": 0.1567,
    "play_style": "rhythm",
    "palm_muted": true,
    "tone_character": "balanced",
    "amp": { "type": "CALI IV", "enabled": true, "settings": [...] },
    "cab": {
      "type": "CALI 112",
      "enabled": true,
      "settings": [
        { "label": "Model", "value": "CALI 112" },
        { "label": "Low Cut (Hz)", "value": 80 },
        { "label": "High Cut (Hz)", "value": 6500 },
        { "label": "Level (dB)", "value": 0.0 }
      ]
    },
    "delay": { "type": "None", "enabled": false, "settings": [] }
  },
  "debug": {
    "centroid": 2107,
    "rolloff": 4446,
    "flatness": 0.0031,
    "zcr": 0.1589,
    "rms": 0.2067,
    "gain_score": 0.1567
  }
}
```

---

## Tone Classification & Intelligence

AmpCraft uses a professional-grade **Dominant Distortion Heuristic** to map audio features to gear:

### 1. Dominant Distortion Rule (ZCR-based)
Categorizes tones into **Metal**, **High Gain**, **Rock**, **Blues**, and **Clean** based on harmonic energy and "fizz." 
- **High-Attack Sensitivity**: Prioritizes ZCR (Zero Crossing Rate) to ensure heavily distorted parts are identified even at lower volumes.

### 2. Intelligent Playing-Style Detection
- **Lead vs Rhythm**: Automatically distinguishes between singing solos and dry rhythm parts using hybrid RMS and spectral feature analysis.
- **Palm Mute Detection**: Identifies tight, percussive riffage. When detected, the engine forces the signal into a "dry" state (disabling delay/reverb) to maintain maximum clarity and punch.

### 3. Style-Aware Effects Routing
- Dynamically adjusts ambience (Delay, Reverb, Modulation) based on the genre. Metal rhythm stays tight and dry, while Rock and Blues leads receive warm, analog-style ambience.

### 4. Real-World Audio Units
- **Cabinet (IR) Parameters** are expressed in professional mixing units:
    - **Frequency cuts in Hz** (20–20,000 Hz).
    - **Output levels in dB** (-12.0 to +12.0 dB).

---

## Tech Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Backend  | Python, FastAPI, librosa      |
| Frontend | React, Vite, Axios            |
| Gear DB  | `gear.json` (hierarchical DB) |