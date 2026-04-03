# 🎸 AmpCraft

> Analyze your guitar tone and get a complete, intelligent amp + effects preset — powered by audio signal processing.

---

## What it does

Upload any guitar audio file (`.wav`, `.mp3`, etc.) and AmpCraft will:

1. **Extract audio features** — spectral centroid, ZCR, RMS, rolloff, flatness
2. **Classify the tone character** — Bright / Balanced / Warm / Dark
3. **Generate a full signal chain preset** — no randomness, every gear choice is feature-driven

---

## Signal Chain Output

Every analysis returns one item from each slot, chosen deterministically from `gear.json`:

```
Noise Gate → EFX (Drive/Boost/Comp) → Amp → Cabinet → Mod → Delay → Reverb
```

The amp and cabinet are always **historically paired** (e.g. `dual_rect` → `rect412`).  
The amp EQ (Treble / Mid / Bass) is set based on spectral centroid.

---

## Project Structure

```
ampcraft/
├── backend/
│   ├── main.py               # FastAPI routes
│   ├── tone_engine.py        # Deterministic gear selection engine
│   ├── feature_extractor.py  # Audio feature extraction (librosa)
│   ├── train_model.py        # Optional ML classifier trainer
│   ├── gear.json             # Full gear catalogue (flat lists)
│   ├── model/
│   │   └── tone_model.pkl    # Trained ML model (generated after training)
│   ├── requirements.txt
│   └── uploads/
└── frontend/
    ├── src/
    │   ├── App.jsx           # Main React component
    │   └── App.css           # Styles
    └── index.html
```

---

## Setup & Run

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api` → `http://localhost:8000`.

---

## API

| Method | Endpoint    | Description                               |
|--------|-------------|-------------------------------------------|
| GET    | `/`         | Health check                              |
| POST   | `/upload`   | Upload audio file (no analysis)           |
| POST   | `/analyze`  | Upload audio → returns full tone preset   |

### `/analyze` response shape

```json
{
  "chain": {
    "tone_character": "bright",
    "noise_gate": { "type": "noise_gate", "enabled": true, "threshold": -40 },
    "efx":        { "type": "distortion_pp", "gain": 9 },
    "amp":        { "type": "die_vh4", "gain": 9, "volume": 6, "treble": 8, "mid": 6, "bass": 4 },
    "cab":        { "type": "die412", "mic": "SM57" },
    "mod":        { "type": "flanger", "depth": 2 },
    "delay":      { "type": "digital", "time": 400, "feedback": 2 },
    "reverb":     { "type": "plate", "level": 5 }
  },
  "features": {
    "centroid": 4712.3,
    "rolloff":  8204.1,
    "flatness": 0.0031,
    "zcr":      0.1342,
    "rms":      0.0821
  }
}
```

---

## Optional: Train the ML Classifier

The tone engine works fully without ML. To optionally train a Random Forest classifier:

1. Create `backend/training_data/<class>/` folders — classes: `clean`, `crunch`, `high_gain`, `bass`
2. Add `.wav` files to each folder
3. Run:
```bash
cd backend
python train_model.py
```
The trained model is saved to `model/tone_model.pkl` and loaded automatically on server start.

---

## Tech Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Backend  | Python, FastAPI, librosa, sklearn |
| Frontend | React, Vite, Axios                |
| Gear DB  | `gear.json` (flat catalogue)      |