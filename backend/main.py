import sys
import os

# Add the backend directory to sys.path to resolve module imports
# when running from the root directory (e.g. uvicorn backend.main:app)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from tone_engine import generate_chain_basic, validate_gear
from feature_extractor import extract_named, extract_named_region
from classifier import classify_tone
import shutil, uuid
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from stem_separator import separate_stems, get_guitar_stem_path

app = FastAPI()

# 🚀 Fail fast if gear mappings are invalid
validate_gear()

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
    return {"message": "AmpCraft Backend Running 🎸"}

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


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    try:
        safe_name = os.path.basename(file.filename).replace(" ", "_") if file.filename else f"upload_{uuid.uuid4().hex}.wav"
        file_path = os.path.join(UPLOAD_DIR, safe_name)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Simple pipeline: extract → classify → generate chain
        features = extract_named(file_path)
        intent   = classify_tone(features)
        chain    = generate_chain_basic(intent, features)

        return {
            "chain":    chain,
            "features": features,
            "debug":    chain.get("debug_features", {})
        }

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


@app.post("/analyze-stem")
async def analyze_stem(job_id: str, stem: str = "guitar"):
    """
    Runs tone analysis on a previously separated stem.
    Uses job_id from /separate response + stem name.
    Falls back to 'other' if guitar not available.

    Request: POST /analyze-stem?job_id=abc123&stem=guitar
    Response: same shape as /analyze
    """
    try:
        stem_path = os.path.join(STEMS_DIR, job_id, f"{stem}.wav")

        # Fallback: if guitar.wav doesn't exist, try other.wav
        if not os.path.exists(stem_path):
            fallback_path = os.path.join(STEMS_DIR, job_id, "other.wav")
            if os.path.exists(fallback_path):
                stem_path = fallback_path
                print(f"[analyze-stem] guitar.wav not found, using other.wav")
            else:
                raise FileNotFoundError(
                    f"Stem file not found: {stem_path}. "
                    f"Run /separate first with job_id={job_id}"
                )

        features = extract_named(stem_path)
        intent   = classify_tone(features)
        chain    = generate_chain_basic(intent, features)

        return {
            "chain":    chain,
            "features": features,
            "debug":    chain.get("debug_features", {}),
            "stem_used": os.path.basename(stem_path),
        }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-stem-region")
async def analyze_stem_region(
    job_id:    str   = Form(...),
    stem:      str   = Form(default="guitar"),
    start_sec: float = Form(...),
    end_sec:   float = Form(...),
):
    """
    Analyze a specific time region of a previously separated stem.

    Form fields (multipart/form-data):
      job_id    — from /separate response (string, required)
      stem      — stem name, default "guitar" (string)
      start_sec — region start in seconds (float, required)
      end_sec   — region end in seconds (float, required)

    Returns same JSON shape as /analyze plus a "region" key:
    {
      "chain":    { ... },
      "features": { ..., "region": {"start": 12.5, "end": 47.0, "duration": 34.5} },
      "debug":    { ... },
      "region":   {"start": 12.5, "end": 47.0, "duration": 34.5},
      "stem_used": "guitar.wav"
    }

    Errors:
      404 — job_id not found / stem file missing
      422 — region invalid (end <= start, duration < 1s)
      500 — analysis pipeline failure
    """
    try:
        stem_path = os.path.join(STEMS_DIR, job_id, f"{stem}.wav")

        # Fallback: guitar -> other if guitar.wav absent (htdemucs 4-stem model)
        if not os.path.exists(stem_path):
            fallback = os.path.join(STEMS_DIR, job_id, "other.wav")
            if os.path.exists(fallback):
                stem_path = fallback
                print(f"[analyze-stem-region] guitar.wav absent, using other.wav")
            else:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"Stem '{stem}' not found for job_id={job_id}. "
                        "Run POST /separate first."
                    )
                )

        # Validate before loading any audio
        if start_sec < 0:
            start_sec = 0.0
        if end_sec <= start_sec:
            raise HTTPException(
                status_code=422,
                detail=f"end_sec ({end_sec:.2f}) must be greater than start_sec ({start_sec:.2f})"
            )
        if (end_sec - start_sec) < 1.0:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Region too short ({end_sec - start_sec:.2f}s). "
                    "Select at least 1.0 second."
                )
            )

        features = extract_named_region(stem_path, start_sec, end_sec)
        intent   = classify_tone(features)
        chain    = generate_chain_basic(intent, features)

        return {
            "chain":     chain,
            "features":  features,
            "debug":     chain.get("debug_features", {}),
            "region":    features.get("region", {}),
            "stem_used": os.path.basename(stem_path),
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-upload-region")
async def analyze_upload_region(
    file: UploadFile = File(...),
    start_sec: float = Form(...),
    end_sec:   float = Form(...),
):
    try:
        safe_name = os.path.basename(file.filename).replace(" ", "_") if file.filename else f"upload_{uuid.uuid4().hex}.wav"
        file_path = os.path.join(UPLOAD_DIR, safe_name)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Validate before loading any audio
        if start_sec < 0:
            start_sec = 0.0
        if end_sec <= start_sec:
            raise HTTPException(
                status_code=422,
                detail=f"end_sec ({end_sec:.2f}) must be greater than start_sec ({start_sec:.2f})"
            )
        if (end_sec - start_sec) < 1.0:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Region too short ({end_sec - start_sec:.2f}s). "
                    "Select at least 1.0 second."
                )
            )

        # Extract features just for this region
        features = extract_named_region(file_path, start_sec, end_sec)
        intent   = classify_tone(features)
        chain    = generate_chain_basic(intent, features)

        return {
            "chain":     chain,
            "features":  features,
            "debug":     chain.get("debug_features", {}),
            "region":    features.get("region", {})
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

