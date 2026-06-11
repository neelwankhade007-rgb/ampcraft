import sys
import os
import io
import json
import zipfile

# Add the backend directory to sys.path to resolve module imports
# when running from the root directory (e.g. uvicorn backend.main:app)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
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
    Saves both WAV and MP3 for each stem.
    Returns MP3 URLs for in-browser playback (smaller/faster) plus job_id
    which the frontend uses to request /download-stems/{job_id}?format=mp3|wav.

    Response shape:
    {
      "job_id": "abc123",
      "stems": {
        "drums":  "/stems/abc123/drums.mp3",
        ...
      },
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
        # stem_paths is now: { name: { "wav": "/abs/path/name.wav", "mp3": "/abs/path/name.mp3" } }
        job_stems_dir = os.path.join(STEMS_DIR, job_id)
        stem_paths = separate_stems(upload_path, job_stems_dir)

        # Derive base name (without extension) for use in ZIP filenames
        base_name_no_ext, _ = os.path.splitext(safe_name)

        # Persist job metadata so the download endpoint can build proper filenames
        meta = {"base_name": base_name_no_ext, "original_filename": safe_name}
        with open(os.path.join(job_stems_dir, "meta.json"), "w") as f:
            json.dump(meta, f)

        # Serve MP3 URLs for browser playback (smaller, faster to stream)
        stem_urls = {
            name: f"/stems/{job_id}/{name}.mp3"
            for name in stem_paths.keys()
        }

        guitar_url = f"/stems/{job_id}/guitar.mp3" if "guitar" in stem_paths \
                     else f"/stems/{job_id}/other.mp3"

        return {
            "job_id":            job_id,
            "stems":             stem_urls,
            "guitar_stem":       guitar_url,
            "original_filename": safe_name,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stem separation failed: {str(e)}")


@app.get("/download-stems/{job_id}")
def download_stems(
    job_id: str,
    format: str = Query(default="mp3", pattern="^(mp3|wav)$"),
):
    """
    Builds a ZIP of all stems in the requested format (mp3 or wav) on demand
    and streams it to the browser with proper Content-Length so the download
    bar shows real progress immediately.

    Query params:
      format  "mp3" (default) | "wav"
    """
    job_dir = os.path.join(STEMS_DIR, job_id)
    if not os.path.isdir(job_dir):
        raise HTTPException(status_code=404, detail="Job not found")

    # Read metadata to get the original song name for archive filenames
    meta_path = os.path.join(job_dir, "meta.json")
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)
        base_name = meta.get("base_name", job_id)
    else:
        base_name = job_id

    # Collect all stem files of the requested format
    ext = f".{format}"
    stem_files = sorted([
        f for f in os.listdir(job_dir)
        if f.endswith(ext) and not f.startswith("meta")
    ])
    if not stem_files:
        raise HTTPException(
            status_code=404,
            detail=f"No .{format} stem files found. The separation may have used a different format."
        )

    # Build ZIP in memory — avoids a second disk write and is fast for ≤~200 MB
    # MP3 is already compressed, WAV doesn't compress — ZIP_STORED is correct for both
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zipf:
        for fname in stem_files:
            stem_name = os.path.splitext(fname)[0]          # e.g. "guitar"
            archive_name = f"{base_name}_{stem_name}{ext}"  # e.g. "mysong_guitar.mp3"
            zipf.write(os.path.join(job_dir, fname), arcname=archive_name)

    zip_bytes = buf.getvalue()
    zip_filename = f"{base_name}_stems_{format}.zip"

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_filename}"',
            "Content-Length":      str(len(zip_bytes)),
            "Cache-Control":       "no-cache",
        },
    )