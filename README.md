# 🎸 AmpCraft

> Upload any guitar audio and get a complete amp + effects signal chain preset — powered by audio signal processing.

---

## How It Works

```
audio file
   ↓
feature_extractor.py  →  centroid, ZCR, RMS, rolloff, flatness
   ↓
_get_tone_class()     →  jazz | clean | blues | rock | high_gain | metal | bass
   ↓
tone_engine.py        →  amp + cab + efx + mod + delay + reverb (all from gear.json)
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
    "style":          "Rock",
    "tone_character": "balanced",
    "noise_gate": { "type": "noise_gate", "enabled": true, "threshold": -45 },
    "efx":        { "type": "t_screamer", "gain": 6 },
    "amp":        { "type": "plexi_100",  "gain": 6, "volume": 7, "treble": 6, "mid": 6, "bass": 6 },
    "cab":        { "type": "m1960av",    "mic": "SM57" },
    "mod":        { "type": "phase_90",   "depth": 5 },
    "delay":      { "type": "mod_delay",  "time": 360, "feedback": 4 },
    "reverb":     { "type": "room",       "level": 4 }
  },
  "features": {
    "centroid": 2107.9,
    "rolloff":  4446.7,
    "flatness": 0.0031,
    "zcr":      0.0879,
    "rms":      0.2067
  }
}
```

---

## Tone Classification

| Class      | Triggered when                              |
|------------|---------------------------------------------|
| `bass`     | RMS < 0.015                                 |
| `metal`    | ZCR > 0.13                                  |
| `high_gain`| ZCR > 0.09 + centroid > 3500               |
| `rock`     | ZCR > 0.09 OR (ZCR > 0.07 + centroid > 2500) OR (ZCR > 0.06 + rolloff > 4000) |
| `blues`    | ZCR > 0.04 + centroid > 2000, or ZCR > 0.06 |
| `jazz`     | centroid < 1800 + ZCR < 0.04              |
| `clean`    | everything else                             |

> **Note:** Full-band mixes (drums + bass + vocals) pull spectral centroid down. For best accuracy, upload an isolated guitar track or DI signal.

---

## Tech Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Backend  | Python, FastAPI, librosa      |
| Frontend | React, Vite, Axios            |
| Gear DB  | `gear.json` (flat catalogue)  |