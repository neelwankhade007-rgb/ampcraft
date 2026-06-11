import sys
import os

# Add the backend directory to sys.path to resolve module imports
# when running from the root directory (e.g. uvicorn backend.main:app)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil, uuid
from fastapi.staticfiles import StaticFiles
from stem_separator import separate_stems

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

STEMS_DIR = "stems"
os.makedirs(STEMS_DIR, exist_ok=True)


@app.get("/")
def home():
    return {"message": "AmpCraft Stem Splitter Backend Running ✂️"}

app.mount("/stems", StaticFiles(directory=STEMS_DIR), name="stems")


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    try:
        safe_name = file.filename.replace(" ", "_") if file.filename else f"upload_{uuid.uuid4().hex}.wav"
        file_path = os.path.join(UPLOAD_DIR, safe_name)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"filename": safe_name, "message": "File uploaded successfully ✅"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/separate")
async def separate(
    file: UploadFile = File(...),
    start_sec: float = Form(-1.0),
    end_sec:   float = Form(-1.0),
):
    """
    Accepts any audio file. Runs Demucs htdemucs_6s separation.
    Returns paths/URLs for all 6 stems + a job_id for tracking.

    Response shape:
    {
      "job_id": "abc123",
      "stems": {
        "drums":  "/stems/abc123/drums.wav",
        "bass":   "/stems/abc123/bass.wav",
        "other":  "/stems/abc123/other.wav",
        "vocals": "/stems/abc123/vocals.wav",
        "guitar": "/stems/abc123/guitar.wav",
        "piano":  "/stems/abc123/piano.wav"
      },
      "guitar_stem": "/stems/abc123/guitar.wav",
      "original_filename": "my_song.mp3"
    }
    """
    try:
        # Save uploaded file
        job_id = uuid.uuid4().hex[:12]
        safe_name = os.path.basename(file.filename or f"upload_{job_id}.wav").replace(" ", "_")
        upload_path = os.path.join(UPLOAD_DIR, f"{job_id}_{safe_name}")

        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Trim before separating if bounds are valid
        if start_sec >= 0 and end_sec > start_sec:
            import librosa
            import soundfile as sf
            y, sr = librosa.load(upload_path, offset=start_sec, duration=end_sec - start_sec, sr=None)
            sf.write(upload_path, y, sr)

        # Run separation — this takes 30s–3min depending on song length and hardware
        job_stems_dir = os.path.join(STEMS_DIR, job_id)
        stem_paths = separate_stems(upload_path, job_stems_dir)

        # Build URL paths for frontend (relative to server root)
        stem_urls = {
            name: f"/stems/{job_id}/{name}.wav"
            for name in stem_paths.keys()
        }

        guitar_url = f"/stems/{job_id}/guitar.wav" if "guitar" in stem_paths \
                     else f"/stems/{job_id}/other.wav"

        return {
            "job_id":            job_id,
            "stems":             stem_urls,
            "guitar_stem":       guitar_url,
            "original_filename": safe_name,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stem separation failed: {str(e)}")