import sys
import os
import io
import json
import zipfile
import asyncio
import time
import hashlib

# Add the backend directory to sys.path to resolve module imports
# when running from the root directory (e.g. uvicorn backend.main:app)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import shutil, uuid
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from stem_separator import separate_stems
from backing_generator import generate_backing, generate_backing_from_existing_stems
from feature_extractor import GuitarToneFeatureExtractor

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

BACKINGS_DIR = "backings"
os.makedirs(BACKINGS_DIR, exist_ok=True)


TEMP_DIR = "temp_conversions"
os.makedirs(TEMP_DIR, exist_ok=True)

import concurrent.futures
# Thread pool for concurrent audio conversion without blocking FastAPI event loop
_conversion_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=min(4, os.cpu_count() or 2),
    thread_name_prefix="ampcraft_mp3_worker"
)

# In-memory tracking for active conversion and separation jobs
_stem_mp3_events = {}
_backing_mp3_events = {}
_active_separations = {}  # fingerprint -> asyncio.Event()
_separation_progress = {}  # job_id or client_job_id -> {"progress": int, "stage": str}
_jobs_lock = asyncio.Lock()


def compute_file_hash(file_path: str) -> str:
    """Computes SHA-256 hash of a file efficiently using 64KB chunks."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


async def cleanup_old_files():
    while True:
        try:
            now = time.time()
            # Canonical WAV stems & backings retained for 48 hours (48 * 3600 seconds)
            long_cutoff = now - 48 * 3600
            # Temp converted MP3s expire after 15 minutes
            temp_cutoff = now - 15 * 60
            # Upload files expire after 30 minutes
            upload_cutoff = now - 30 * 60

            # 1. Clean temp conversions (MP3s)
            if os.path.exists(TEMP_DIR):
                for item in os.listdir(TEMP_DIR):
                    item_path = os.path.join(TEMP_DIR, item)
                    try:
                        if os.path.getmtime(item_path) < temp_cutoff:
                            if os.path.isdir(item_path):
                                shutil.rmtree(item_path)
                            else:
                                os.remove(item_path)
                            # Clean up memory tracker if present
                            async with _jobs_lock:
                                _stem_mp3_events.pop(item, None)
                                _backing_mp3_events.pop(item, None)
                    except Exception:
                        pass

            # 2. Clean temporary uploads
            if os.path.exists(UPLOAD_DIR):
                for item in os.listdir(UPLOAD_DIR):
                    item_path = os.path.join(UPLOAD_DIR, item)
                    try:
                        if os.path.getmtime(item_path) < upload_cutoff:
                            if os.path.isdir(item_path):
                                shutil.rmtree(item_path)
                            else:
                                os.remove(item_path)
                    except Exception:
                        pass

            # 3. Clean stems and backings (48-hour retention)
            for directory in [STEMS_DIR, BACKINGS_DIR]:
                if not os.path.exists(directory):
                    continue
                for item in os.listdir(directory):
                    item_path = os.path.join(directory, item)
                    try:
                        mtime = os.path.getmtime(item_path)
                        if mtime < long_cutoff:
                            if os.path.isdir(item_path):
                                shutil.rmtree(item_path)
                                print(f"Cleaned up expired directory (48h retention): {item_path}")
                            else:
                                os.remove(item_path)
                                print(f"Cleaned up expired file (48h retention): {item_path}")
                    except Exception:
                        pass
        except Exception as e:
            print(f"Error during file cleanup: {e}")
        await asyncio.sleep(60)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_old_files())


def convert_wav_to_mp3(wav_path: str, output_path: str):
    """Transcodes a WAV file to 320kbps MP3 on demand."""
    import subprocess
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y", "-i", wav_path,
        "-codec:a", "libmp3lame", "-qscale:a", "0",
        output_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


async def background_convert_stems_to_mp3(job_id: str, wav_files: list):
    """
    Converts all WAV stems of a job to MP3 concurrently in the thread pool.
    Saves MP3 files to temp_conversions/{job_id}/.
    Sets the completion event once all stems are converted.
    """
    loop = asyncio.get_running_loop()
    job_dir = os.path.join(STEMS_DIR, job_id)
    temp_job_dir = os.path.join(TEMP_DIR, job_id)
    os.makedirs(temp_job_dir, exist_ok=True)

    def convert_single(fname):
        stem_base = os.path.splitext(fname)[0]
        mp3_fname = f"{stem_base}.mp3"
        mp3_path = os.path.join(temp_job_dir, mp3_fname)
        wav_path = os.path.join(job_dir, fname)
        if not os.path.exists(mp3_path) and os.path.exists(wav_path):
            convert_wav_to_mp3(wav_path, mp3_path)

    try:
        tasks = [
            loop.run_in_executor(_conversion_executor, convert_single, fname)
            for fname in wav_files
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        print(f"[background_convert_stems_to_mp3] Error for job {job_id}: {e}")
    finally:
        event = _stem_mp3_events.get(job_id)
        if event:
            event.set()


async def background_convert_backing_to_mp3(job_id: str, wav_path: str, mp3_path: str):
    """
    Converts a single backing track WAV to MP3 in the background.
    Sets the completion event when finished.
    """
    loop = asyncio.get_running_loop()
    try:
        if not os.path.exists(mp3_path) and os.path.exists(wav_path):
            await loop.run_in_executor(_conversion_executor, convert_wav_to_mp3, wav_path, mp3_path)
    except Exception as e:
        print(f"[background_convert_backing_to_mp3] Error for backing {job_id}: {e}")
    finally:
        event = _backing_mp3_events.get(job_id)
        if event:
            event.set()


async def ensure_stems_mp3_ready(job_id: str, wav_files: list, timeout: float = 60.0):
    """
    Ensures MP3 stems for job_id are available in temp_conversions.
    If already ready, returns immediately.
    If background conversion is active, awaits its completion without creating duplicate tasks.
    If no task is running, triggers conversion and waits.
    """
    temp_job_dir = os.path.join(TEMP_DIR, job_id)
    all_ready = (
        os.path.exists(temp_job_dir) and
        all(os.path.exists(os.path.join(temp_job_dir, f"{os.path.splitext(f)[0]}.mp3")) for f in wav_files)
    )
    if all_ready:
        return

    async with _jobs_lock:
        if job_id not in _stem_mp3_events:
            _stem_mp3_events[job_id] = asyncio.Event()
            asyncio.create_task(background_convert_stems_to_mp3(job_id, wav_files))
        event = _stem_mp3_events[job_id]

    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
    except asyncio.TimeoutError:
        print(f"Timed out waiting for MP3 conversion for job {job_id}")


async def ensure_backing_mp3_ready(job_id: str, wav_path: str, mp3_path: str, timeout: float = 60.0):
    """
    Ensures backing MP3 is ready in temp_conversions.
    If already ready, returns immediately.
    If conversion is active, waits for completion.
    Otherwise initiates conversion safely.
    """
    if os.path.exists(mp3_path):
        return

    async with _jobs_lock:
        if job_id not in _backing_mp3_events:
            _backing_mp3_events[job_id] = asyncio.Event()
            asyncio.create_task(background_convert_backing_to_mp3(job_id, wav_path, mp3_path))
        event = _backing_mp3_events[job_id]

    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
    except asyncio.TimeoutError:
        print(f"Timed out waiting for backing MP3 conversion for job {job_id}")


class BackingRequest(BaseModel):
    job_id: str
    backing_type: str


@app.get("/")
def home():
    return {"message": "AmpCraft Stem Splitter Backend Running ✂️"}

app.mount("/stems", StaticFiles(directory=STEMS_DIR), name="stems")
app.mount("/backings", StaticFiles(directory=BACKINGS_DIR), name="backings")


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
    client_job_id: str = Form(None),
):
    """
    Accepts any audio file. Runs Demucs htdemucs_6s separation.
    Deduplicates based on audio fingerprint (SHA-256 + trim parameters).
    Reuses existing WAV stems if already separated within the 48-hour retention window.
    Coordinates concurrent requests for the same audio using an asyncio event to prevent duplicate Demucs runs.
    Saves only WAV files on disk to save space.
    Returns WAV stem URLs and triggers non-blocking background MP3 conversion.
    """
    upload_path = None
    try:
        # 1. Save uploaded file to a temporary location
        temp_upload_id = uuid.uuid4().hex[:12]
        safe_name = os.path.basename(file.filename or f"upload_{temp_upload_id}.wav").replace(" ", "_")
        upload_path = os.path.join(UPLOAD_DIR, f"{temp_upload_id}_{safe_name}")

        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Trim before separating if bounds are valid
        is_trimmed = (start_sec >= 0 and end_sec > start_sec)
        if is_trimmed:
            import librosa
            import soundfile as sf
            y, sr = librosa.load(upload_path, offset=start_sec, duration=end_sec - start_sec, sr=None)
            sf.write(upload_path, y, sr)

        # 2. Compute stable audio fingerprint of the audio bytes + trim parameters
        content_hash = compute_file_hash(upload_path)
        trim_suffix = f"{start_sec:.3f}_{end_sec:.3f}" if is_trimmed else "full"
        fingerprint = hashlib.sha256(f"{content_hash}_{trim_suffix}".encode()).hexdigest()[:16]
        job_id = f"sep_{fingerprint}"

        job_stems_dir = os.path.join(STEMS_DIR, job_id)
        base_name_no_ext, _ = os.path.splitext(safe_name)

        # Helper to format stem URLs from an existing or newly created job directory
        def build_stem_result_from_dir(dir_path: str):
            wav_files = sorted([f for f in os.listdir(dir_path) if f.endswith(".wav") and not f.startswith("meta")])
            stem_urls = {}
            for fname in wav_files:
                # Extract stem name from filename e.g. <base>_guitar.wav -> guitar
                stem_name = None
                for candidate in ["drums", "bass", "other", "vocals", "guitar", "piano"]:
                    if fname.endswith(f"_{candidate}.wav"):
                        stem_name = candidate
                        break
                if not stem_name:
                    stem_name = os.path.splitext(fname)[0]
                stem_urls[stem_name] = f"/stems/{job_id}/{fname}"

            guitar_url = stem_urls.get("guitar") or stem_urls.get("other")
            return {
                "job_id":            job_id,
                "stems":             stem_urls,
                "guitar_stem":       guitar_url,
                "original_filename": safe_name,
            }

        # 3. Check if matching stems already exist and are valid within retention (48 hours)
        is_cached = False
        if os.path.isdir(job_stems_dir):
            wav_stems = [f for f in os.listdir(job_stems_dir) if f.endswith(".wav")]
            # Standard htdemucs_6s produces 6 stems
            if len(wav_stems) >= 6:
                age = time.time() - os.path.getmtime(job_stems_dir)
                if age < 48 * 3600:
                    is_cached = True

        if is_cached:
            # Touch mtime to refresh retention for active usage
            try:
                os.utime(job_stems_dir, None)
            except Exception:
                pass

            # Clean up uploaded audio immediately
            if os.path.exists(upload_path):
                try:
                    os.remove(upload_path)
                except Exception:
                    pass

            # Ensure background MP3 conversion is triggered if temp MP3s have expired
            wav_stems = [f for f in os.listdir(job_stems_dir) if f.endswith(".wav") and not f.startswith("meta")]
            temp_job_dir = os.path.join(TEMP_DIR, job_id)
            mp3s_ready = (
                os.path.exists(temp_job_dir) and
                all(os.path.exists(os.path.join(temp_job_dir, f"{os.path.splitext(f)[0]}.mp3")) for f in wav_stems)
            )
            if not mp3s_ready:
                async with _jobs_lock:
                    if job_id not in _stem_mp3_events:
                        _stem_mp3_events[job_id] = asyncio.Event()
                        asyncio.create_task(background_convert_stems_to_mp3(job_id, wav_stems))

            print(f"Reusing cached stems for fingerprint: {fingerprint} (job_id={job_id})")
            return build_stem_result_from_dir(job_stems_dir)

        # 4. Concurrency control: prevent duplicate Demucs runs for the same audio
        async with _jobs_lock:
            if fingerprint in _active_separations:
                event = _active_separations[fingerprint]
                is_primary_worker = False
            else:
                event = asyncio.Event()
                _active_separations[fingerprint] = event
                is_primary_worker = True

        if not is_primary_worker:
            # Another request is already running Demucs for this exact audio. Wait for it.
            print(f"Waiting for in-progress separation for fingerprint: {fingerprint}")
            await event.wait()
            # Clean up our duplicate upload
            if os.path.exists(upload_path):
                try:
                    os.remove(upload_path)
                except Exception:
                    pass
            if not os.path.isdir(job_stems_dir):
                raise HTTPException(status_code=500, detail="Separation failed in primary task")
            return build_stem_result_from_dir(job_stems_dir)

        # 5. Primary worker: Run Demucs separation in a thread without blocking the event loop
        def on_separation_progress(progress_pct: int, stage_desc: str):
            status_data = {"progress": progress_pct, "stage": stage_desc}
            _separation_progress[job_id] = status_data
            if client_job_id:
                _separation_progress[client_job_id] = status_data

        try:
            on_separation_progress(0, "Starting separation")
            stem_paths = await asyncio.to_thread(
                separate_stems,
                upload_path,
                job_stems_dir,
                normalize=True,
                base_name=base_name_no_ext,
                progress_callback=on_separation_progress,
            )

            # Persist job metadata so the download endpoint can build proper filenames
            meta = {"base_name": base_name_no_ext, "original_filename": safe_name, "fingerprint": fingerprint}
            with open(os.path.join(job_stems_dir, "meta.json"), "w") as f:
                json.dump(meta, f)

            # Collect wav filenames for MP3 background pre-conversion
            wav_stems = [
                os.path.basename(paths["wav"]) for paths in stem_paths.values()
                if os.path.exists(paths.get("wav", ""))
            ]

            # Automatically start MP3 conversion in the background without blocking the response
            async with _jobs_lock:
                _stem_mp3_events[job_id] = asyncio.Event()
                asyncio.create_task(background_convert_stems_to_mp3(job_id, wav_stems))

            # Clean up uploaded audio file
            if os.path.exists(upload_path):
                try:
                    os.remove(upload_path)
                except Exception:
                    pass

            result = build_stem_result_from_dir(job_stems_dir)
            return result
        finally:
            # Clean up active separation progress entry
            _separation_progress.pop(job_id, None)
            if client_job_id:
                _separation_progress.pop(client_job_id, None)

            # Always notify any awaiting concurrent requests and cleanup active separations
            async with _jobs_lock:
                ev = _active_separations.pop(fingerprint, None)
                if ev:
                    ev.set()

    except Exception as e:
        if upload_path and os.path.exists(upload_path):
            try:
                os.remove(upload_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Stem separation failed: {str(e)}")


@app.get("/separate/status/{job_id}")
async def get_separation_status(job_id: str):
    """
    Returns current in-memory separation progress for an active job.
    Returns 404 if the job is not currently active.
    """
    progress = _separation_progress.get(job_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Separation job not active or not found")
    return progress


@app.get("/download-stems/{job_id}")
async def download_stems(
    job_id: str,
    format: str = Query(default="wav", pattern="^(mp3|wav)$"),
):
    """
    Builds a ZIP of all stems in the requested format (mp3 or wav).
    WAV downloads immediately.
    If MP3 is requested:
      - If already ready in temp_conversions, downloads immediately.
      - If background conversion is in progress, waits on existing conversion (no duplicate jobs).
      - If no conversion exists (e.g. server restarted), triggers conversion and streams.
    Streams ZIP archive directly with proper Content-Length.
    """
    job_dir = os.path.join(STEMS_DIR, job_id)
    if not os.path.isdir(job_dir):
        raise HTTPException(status_code=404, detail="Job not found")

    meta_path = os.path.join(job_dir, "meta.json")
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)
        base_name = meta.get("base_name", job_id)
    else:
        base_name = job_id

    # Collect all WAV files
    wav_files = sorted([
        f for f in os.listdir(job_dir)
        if f.endswith(".wav") and not f.startswith("meta")
    ])
    if not wav_files:
        raise HTTPException(
            status_code=404,
            detail="No stem files found for this job."
        )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zipf:
        if format == "wav":
            for fname in wav_files:
                zipf.write(os.path.join(job_dir, fname), arcname=fname)
        else:
            # MP3 requested: wait for background conversion or run safely
            await ensure_stems_mp3_ready(job_id, wav_files)

            temp_job_dir = os.path.join(TEMP_DIR, job_id)
            for fname in wav_files:
                stem_base = os.path.splitext(fname)[0]
                mp3_fname = f"{stem_base}.mp3"
                mp3_temp_path = os.path.join(temp_job_dir, mp3_fname)
                if not os.path.exists(mp3_temp_path):
                    # Fallback single conversion if missed
                    wav_source = os.path.join(job_dir, fname)
                    convert_wav_to_mp3(wav_source, mp3_temp_path)
                zipf.write(mp3_temp_path, arcname=mp3_fname)

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


@app.post("/generate-backing")
async def generate_backing_endpoint(
    file: UploadFile = File(...),
    backing_type: str = Form(...),
    start_sec: float = Form(-1.0),
    end_sec:   float = Form(-1.0),
):
    try:
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

        base_name_no_ext, _ = os.path.splitext(safe_name)

        res = generate_backing(
            input_audio_path=upload_path,
            backing_type=backing_type,
            job_id=job_id,
            base_name=base_name_no_ext
        )

        # Clean up the original uploaded file
        if os.path.exists(upload_path):
            try:
                os.remove(upload_path)
            except Exception as e:
                print(f"Error removing uploaded/trimmed file: {e}")

        # Start background MP3 conversion for backing track
        wav_path = res["wav_path"]
        backing_filename = os.path.basename(wav_path)
        backing_base_no_ext = os.path.splitext(backing_filename)[0]
        temp_backing_dir = os.path.join(TEMP_DIR, job_id)
        os.makedirs(temp_backing_dir, exist_ok=True)
        mp3_path = os.path.join(temp_backing_dir, f"{backing_base_no_ext}.mp3")

        async with _jobs_lock:
            _backing_mp3_events[job_id] = asyncio.Event()
            asyncio.create_task(background_convert_backing_to_mp3(job_id, wav_path, mp3_path))

        wav_url = f"/backings/{job_id}/{backing_filename}"
        return {
            "success": True,
            "job_id": job_id,
            "backing_type": backing_type,
            "wav_url": wav_url,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.post("/generate-backing-from-stems")
async def generate_backing_from_stems_endpoint(
    job_id: str = Form(...),
    backing_type: str = Form(...),
    volumes: str = Form(None),
):
    """
    Generates a backing track by reusing already-separated stems.
    Requires a valid stems job_id from a previous /separate call.
    Skips Demucs entirely — only mixes existing WAV stems.
    """
    try:
        stems_dir = os.path.join(STEMS_DIR, job_id)
        if not os.path.isdir(stems_dir):
            raise HTTPException(status_code=404, detail="Stems not found. Run separation first.")

        # Read metadata for the base name
        meta_path = os.path.join(stems_dir, "meta.json")
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                meta = json.load(f)
            base_name = meta.get("base_name", job_id)
        else:
            base_name = job_id

        # Parse custom volumes and generate a hash for deterministic caching
        custom_volumes = None
        vol_hash = ""
        if volumes:
            try:
                custom_volumes = json.loads(volumes)
                # Sort keys to ensure consistent hashing for the same values
                sorted_vols = sorted(custom_volumes.items())
                vol_str = json.dumps(sorted_vols)
                import hashlib
                vol_hash = "_" + hashlib.md5(vol_str.encode()).hexdigest()[:8]
            except Exception as e:
                print(f"Error parsing volumes JSON: {e}")

        # Deterministic backing job ID
        backing_job_id = f"backing_{job_id}_{backing_type}{vol_hash}"
        backing_dir = os.path.join(BACKINGS_DIR, backing_job_id)
        wav_filename = f"{base_name}_{backing_type}_backing.wav"
        wav_path = os.path.join(backing_dir, wav_filename)

        # Check if backing track already exists and is within 48-hour retention
        is_cached = False
        if os.path.isfile(wav_path):
            age = time.time() - os.path.getmtime(wav_path)
            if age < 48 * 3600:
                is_cached = True

        if is_cached:
            # Refresh mtime
            try:
                os.utime(wav_path, None)
            except Exception:
                pass
            print(f"Reusing cached backing track: {wav_path}")
        else:
            res = generate_backing_from_existing_stems(
                stems_job_id=job_id,
                backing_type=backing_type,
                backing_job_id=backing_job_id,
                base_name=base_name,
                custom_volumes=custom_volumes,
            )
            wav_path = res["wav_path"]

        # Background MP3 conversion for backing track if not already in temp
        backing_base_no_ext = os.path.splitext(wav_filename)[0]
        temp_backing_dir = os.path.join(TEMP_DIR, backing_job_id)
        os.makedirs(temp_backing_dir, exist_ok=True)
        mp3_path = os.path.join(temp_backing_dir, f"{backing_base_no_ext}.mp3")

        if not os.path.exists(mp3_path):
            async with _jobs_lock:
                if backing_job_id not in _backing_mp3_events:
                    _backing_mp3_events[backing_job_id] = asyncio.Event()
                    asyncio.create_task(background_convert_backing_to_mp3(backing_job_id, wav_path, mp3_path))

        wav_url = f"/backings/{backing_job_id}/{wav_filename}"
        return {
            "success": True,
            "job_id": backing_job_id,
            "backing_type": backing_type,
            "wav_url": wav_url,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/download-backing/{job_id}/{filename}")
async def download_backing(job_id: str, filename: str):
    """
    Force-download a generated backing track.
    If an MP3 is requested and only WAV exists, checks/waits for background conversion
    in temp_conversions.
    """
    base, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext == ".wav":
        file_path = os.path.join(BACKINGS_DIR, job_id, filename)
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="Backing file not found.")
        return FileResponse(
            file_path,
            filename=filename,
            media_type="audio/wav",
        )
    elif ext == ".mp3":
        temp_mp3_path = os.path.join(TEMP_DIR, job_id, filename)
        if not os.path.isfile(temp_mp3_path):
            wav_path = os.path.join(BACKINGS_DIR, job_id, f"{base}.wav")
            if not os.path.isfile(wav_path):
                job_dir = os.path.join(BACKINGS_DIR, job_id)
                if os.path.isdir(job_dir):
                    wavs = [f for f in os.listdir(job_dir) if f.endswith(".wav")]
                    if wavs:
                        wav_path = os.path.join(job_dir, wavs[0])
            if not os.path.isfile(wav_path):
                raise HTTPException(status_code=404, detail="Source WAV backing not found to convert.")
            await ensure_backing_mp3_ready(job_id, wav_path, temp_mp3_path)

        if not os.path.isfile(temp_mp3_path):
            raise HTTPException(status_code=500, detail="MP3 conversion failed.")

        return FileResponse(
            temp_mp3_path,
            filename=filename,
            media_type="audio/mpeg",
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")


@app.get("/download-stem/{job_id}/{filename}")
async def download_stem(job_id: str, filename: str):
    """
    Force-download a single stem file.
    If MP3 is requested, checks/waits for background conversion in temp_conversions.
    """
    base, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext == ".wav":
        file_path = os.path.join(STEMS_DIR, job_id, filename)
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="Stem file not found.")
        return FileResponse(
            file_path,
            filename=filename,
            media_type="audio/wav",
        )
    elif ext == ".mp3":
        temp_mp3_path = os.path.join(TEMP_DIR, job_id, filename)
        if not os.path.isfile(temp_mp3_path):
            # Check if stems conversion is running for this job
            job_dir = os.path.join(STEMS_DIR, job_id)
            wav_files = [f for f in os.listdir(job_dir) if f.endswith(".wav")] if os.path.isdir(job_dir) else []
            wav_path = os.path.join(STEMS_DIR, job_id, f"{base}.wav")
            if not os.path.isfile(wav_path):
                raise HTTPException(status_code=404, detail="Source WAV stem not found.")
            await ensure_stems_mp3_ready(job_id, wav_files)

        if not os.path.isfile(temp_mp3_path):
            # Fallback direct conversion if not already generated
            wav_path = os.path.join(STEMS_DIR, job_id, f"{base}.wav")
            if os.path.isfile(wav_path):
                convert_wav_to_mp3(wav_path, temp_mp3_path)
            else:
                raise HTTPException(status_code=404, detail="Source WAV stem not found.")

        return FileResponse(
            temp_mp3_path,
            filename=filename,
            media_type="audio/mpeg",
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")


@app.post("/extract-features")
async def extract_features_endpoint(
    file: UploadFile = File(None),
    job_id: str = Form(None),
    stem_type: str = Form("guitar"),
    start_sec: float = Form(-1.0),
    end_sec: float = Form(-1.0),
):
    try:
        extractor = GuitarToneFeatureExtractor()
        
        # Scenario A: extract from existing separated stem
        if job_id:
            job_dir = os.path.join(STEMS_DIR, job_id)
            if not os.path.isdir(job_dir):
                raise HTTPException(status_code=404, detail="Job stems not found")
            
            # Find the specific stem file
            target_file = None
            for f in os.listdir(job_dir):
                if f.endswith(f"_{stem_type}.wav"):
                    target_file = os.path.join(job_dir, f)
                    break
            
            # Fallback to .mp3 if wav not found
            if not target_file:
                for f in os.listdir(job_dir):
                    if f.endswith(f"_{stem_type}.mp3"):
                        target_file = os.path.join(job_dir, f)
                        break
            
            # Fallback to 'other' stem if guitar is requested but not found
            if not target_file and stem_type == "guitar":
                for f in os.listdir(job_dir):
                    if f.endswith("_other.wav") or f.endswith("_other.mp3"):
                        target_file = os.path.join(job_dir, f)
                        break
            
            if not target_file:
                raise HTTPException(status_code=404, detail=f"Stem '{stem_type}' not found for job {job_id}")
            
            duration = end_sec - start_sec if (start_sec >= 0 and end_sec > start_sec) else None
            offset = max(0.0, start_sec) if start_sec >= 0 else 0.0
            
            features = extractor.extract_from_file(target_file, duration=duration, offset=offset)
            return features
            
        # Scenario B: extract from uploaded file directly
        elif file:
            temp_id = uuid.uuid4().hex[:12]
            safe_name = os.path.basename(file.filename or f"upload_{temp_id}.wav").replace(" ", "_")
            temp_path = os.path.join(UPLOAD_DIR, f"temp_{temp_id}_{safe_name}")
            
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            try:
                duration = end_sec - start_sec if (start_sec >= 0 and end_sec > start_sec) else None
                offset = max(0.0, start_sec) if start_sec >= 0 else 0.0
                
                features = extractor.extract_from_file(temp_path, duration=duration, offset=offset)
                return features
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        else:
            raise HTTPException(status_code=400, detail="Provide either a file or a job_id")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {str(e)}")
