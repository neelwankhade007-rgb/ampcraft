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
├── docker-compose.yml        # Orchestration for frontend & backend services
├── backend/
│   ├── Dockerfile            # Python 3.10 slim, FFmpeg, PyTorch & FastAPI image
│   ├── .dockerignore
│   ├── main.py               # FastAPI router, endpoints & CORS configuration
│   ├── stem_separator.py     # Demucs model wrapper & MP3/WAV output writers
│   ├── backing_generator.py  # Stem-muting mixer & audio normalizer logic
│   ├── requirements.txt      # Python package list (FastAPI, Torchaudio, Demucs)
│   ├── uploads/              # Temporary audio uploads (persisted via Docker volume)
│   ├── stems/                # Separated stems output folder (persisted via volume)
│   └── backings/             # Mixed backing tracks folder (persisted via volume)
└── frontend/
    ├── Dockerfile            # Multi-stage build (Node 20 -> Nginx Alpine)
    ├── nginx.conf            # Reverse proxy for React routing & backend API calls
    ├── .dockerignore
    ├── package.json          # React app configurations
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx           # Main application & tone analyzer
        ├── index.css         # Styling system & UI tokens
        └── components/       # UI Components
```

---

## ⚙️ Setup & Running

You can run AmpCraft either **locally** (recommended for rapid development) or with **Docker & Docker Compose**.

---

### Option A: Local Setup (Native Development)

#### 1. Prerequisites (FFmpeg)
AmpCraft requires **FFmpeg** to encode and decode MP3/WAV files.
* **Windows**: Run `winget install ffmpeg` or `choco install ffmpeg`
* **macOS**: Run `brew install ffmpeg`
* **Linux**: Run `sudo apt install ffmpeg`

#### 2. Backend Setup
1. Open a terminal in the `backend/` folder and activate a virtual environment:
   ```bash
   cd backend
   python -m venv .venv

   # Windows
   .venv\Scripts\activate

   # macOS/Linux
   source .venv/bin/activate
   ```

2. Install PyTorch with CPU support:
   ```bash
   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
   ```

3. Install project dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI backend with hot-reload:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *Backend will run at:* `http://localhost:8000` (API Docs at `http://localhost:8000/docs`)

#### 3. Frontend Setup
1. Open a new terminal in the `frontend/` folder:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   *Frontend dev server will run at:* `http://localhost:5173`

---

### Option B: Docker Backend Setup (Development)

Run the FastAPI backend in an isolated container with live reloading (`--reload`) and volume mounts:

1. **Build the backend image:**
   ```bash
   # Using Docker Compose
   docker compose build

   # Or using Docker directly
   docker build -t ampcraft-backend ./backend
   ```

2. **Run the backend container:**
   ```bash
   # Using Docker Compose (runs on port 8000 with volume mounts and live reload)
   docker compose up

   # Or run in detached mode (in the background)
   docker compose up -d

   # Or using Docker directly
   docker run -p 8000:8000 -v ./backend:/app ampcraft-backend
   ```

3. **Access Backend:**
   * **Backend API & Swagger Docs:** `http://localhost:8000/docs`

4. **Stop the backend:**
   ```bash
   docker compose down
   ```

5. **Start Frontend (Local):**
   Run the local frontend server to connect to the Dockerized backend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Frontend dev server will run at:* `http://localhost:5173` (Frontend is also deployed live on Netlify).

---

## 🔌 API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/` | Health check route |
| **POST** | `/upload` | Uploads an audio file and returns its safe filename |
| **POST** | `/separate` | Separates a track into 6 stems (saved strictly as WAV). Returns WAV stem URLs. |
| **GET** | `/download-stems/{job_id}` | Packs and downloads all stems as a ZIP archive (`?format=wav` or `?format=mp3` with on-demand conversion). |
| **GET** | `/download-stem/{job_id}/{filename}` | Downloads a single stem file (WAV directly, or MP3 converted on-demand). |
| **POST** | `/generate-backing` | Generates a backing track muting one instrument and mixes the rest (saved strictly as WAV). |
| **POST** | `/generate-backing-from-stems` | Reuses existing separated WAV stems to generate backing track without re-running separation. |
| **GET** | `/download-backing/{job_id}/{filename}` | Downloads the generated backing track file (WAV directly, or MP3 converted on-demand). |

---

## 🔮 Roadmap / Future Work
- **🎸 Tone Matcher**: Complete the integration of the DSP neural network tone matching and digital twin parameter estimation (see [future.md](file:///d:/Projects/ampcraft/future.md)).
- **📱 Responsive Layout & Mobile Support**: Optimize multi-track waveforms for smaller screen widths.