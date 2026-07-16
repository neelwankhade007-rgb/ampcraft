# 🎸 AmpCraft

> Separate audio stems, build custom backing tracks, and prepare for ultimate tone modeling. Powered by Meta's Demucs AI model (`htdemucs_6s`) and FastAPI.

🌐 **Live Demo (Frontend):** [https://ampcraft.netlify.app/](https://ampcraft.netlify.app/)

---

## 🚀 Key Features

*   **✂️ AI Stem Separator**: Splits any song into 6 isolated stems: **Drums**, **Bass**, **Vocals**, **Guitar**, **Piano**, and **Other** using deep learning stem separation.
*   **⏱️ Custom Trimming**: Select start and end times to trim and process only a specific portion of your track.
*   **🎚️ Interactive Mixer & Player**: Multi-track stem player on the frontend with individual volume faders, solo/mute buttons, and a global master fader.
*   **🎹 Backing Maker**: Generate custom backing tracks on demand by muting a specific instrument (Guitar, Bass, Drums, Piano, or Vocals) and automatically mixing the remaining stems.
*   **📦 ZIP & Individual Downloads**: Fast, on-the-fly packaging of separated stems as a ZIP file (MP3/WAV format) or downloading single stems directly.

---

## 🛠️ Tech Stack

| Layer | Technologies / Packages |
| :--- | :--- |
| **Backend** | Python, FastAPI, Demucs AI (`htdemucs_6s`), PyTorch, Librosa, SoundFile, PyDub, Uvicorn |
| **Frontend** | React, Vite, Axios, WaveSurfer.js / custom audio mixing nodes, Vanilla CSS |
| **System Deps** | FFmpeg |

---

## 📂 Project Structure

```
ampcraft/
├── backend/
│   ├── main.py               # FastAPI router, endpoints & CORS configuration
│   ├── stem_separator.py     # Demucs model wrapper & MP3/WAV output writers
│   ├── backing_generator.py  # Stem-muting mixer & audio normalizer logic
│   ├── requirements.txt      # Python package list (FastAPI, Torchaudio, Demucs)
│   ├── genre/
│   │   ├── feature_extractor.py # Audio feature extractor (Librosa)
│   │   └── predict.py        # Genre predictor script
│   ├── models/               # Pre-trained models (scaler, encoder, classifiers)
│   ├── uploads/              # Temporary audio uploads (auto-generated)
│   ├── stems/                # Separated stems output folder (auto-generated)
│   └── backings/             # Mixed backing tracks folder (auto-generated)
└── frontend/
    ├── package.json          # React app configurations
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx           # Tab navigator & UI state container
        ├── index.css         # Styling system & UI tokens
        └── components/       # UI Components
            ├── StemSeparator.jsx  # File uploader, trimmer & separator trigger
            ├── BackingGenerator.jsx # Backing track selection & generation
            ├── GlobalMixer.jsx    # Master volume control & mute/solo actions
            ├── StemRow.jsx        # Waveform visualizer & slider for individual stems
            └── WaveformPlayer.jsx # Audio playback container
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites (FFmpeg)
AmpCraft requires **FFmpeg** to encode and decode MP3/WAV files.
*   **Windows**: Run `winget install ffmpeg` or `choco install ffmpeg`
*   **macOS**: Run `brew install ffmpeg`
*   **Linux**: Run `sudo apt install ffmpeg`

### 2. Backend Setup
1. Create and activate a Python virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```
2. Install PyTorch matching your hardware (CPU or GPU). For CPU-only:
   ```bash
   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
   ```
3. Install the remaining requirements:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

### 3. Frontend Setup
1. Install dependencies and start the local development server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Open your browser and navigate to `http://localhost:5173`.

---

## 🔌 API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/` | Health check route |
| **POST** | `/upload` | Uploads an audio file and returns its safe filename |
| **POST** | `/separate` | Separates a track into 6 stems with optional `start_sec` and `end_sec` trimming. Returns MP3 stem URLs. |
| **GET** | `/download-stems/{job_id}` | Packs and downloads all stems as a ZIP archive (Supports query parameter `?format=mp3` or `?format=wav`). |
| **GET** | `/download-stem/{job_id}/{filename}` | Downloads a single isolated stem file directly |
| **POST** | `/generate-backing` | Generates a backing track muting one instrument (`guitar`, `bass`, `drums`, `piano`, `karaoke`) and mixes the rest. |
| **GET** | `/download-backing/{job_id}/{filename}` | Downloads the generated backing track file |

---

## 🔮 Roadmap / Future Work
- **🎸 Tone Matcher**: Complete the integration of the DSP neural network tone matching and digital twin parameter estimation (see [future.md](file:///d:/Projects/ampcraft/future.md)).
- **📱 Responsive Layout & Mobile Support**: Optimize multi-track waveforms for smaller screen widths.