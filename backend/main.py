from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from tone_engine import generate_chain
from feature_extractor import extract_features, extract_named
import shutil, os, pickle
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "tone_model.pkl")

# ML model is now optional — tone_engine works without it
_ml = None
if os.path.exists(MODEL_PATH):
    with open(MODEL_PATH, "rb") as f:
        _ml = pickle.load(f)
    print(f"✅ ML model loaded from {MODEL_PATH}")
else:
    print("ℹ️  No ML model found — using heuristic tone classification.")


def _get_tone_class(named: dict) -> str:
    """
    Classify tone into one of 7 classes:
    jazz | clean | blues | rock | high_gain | metal | bass

    NOTE: Full-band mixes (drums + bass + vocals) pull centroid DOWN,
    so we lean on ZCR as the primary distortion indicator for rock/metal.
    """
    centroid = named["centroid"]
    zcr      = named["zcr"]
    rms      = named["rms"]
    rolloff  = named.get("rolloff", centroid * 2)

    if rms < 0.015:                             return "bass"
    if zcr > 0.13:                              return "metal"
    if zcr > 0.09 and centroid > 3500:          return "high_gain"
    if zcr > 0.09:                              return "rock"
    if zcr > 0.07 and centroid > 2500:          return "rock"
    if zcr > 0.06 and rolloff > 4000:           return "rock"
    if zcr > 0.04 and centroid > 2000:          return "blues"
    if zcr > 0.06:                              return "blues"   # dark gritty tone — low centroid but ZCR confirms drive
    if centroid < 1800 and zcr < 0.04:          return "jazz"
    return "clean"


@app.get("/")
def home():
    return {"message": "AmpCraft Backend Running 🎸"}


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"filename": file.filename, "message": "File uploaded successfully ✅"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    try:
        # Save file
        file_path = os.path.join(UPLOAD_DIR, os.path.basename(file.filename))
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract features
        named    = extract_named(file_path)
        features = extract_features(file_path)

        # Classify tone
        if _ml is not None:
            tone_class = _ml["model"].predict([features])[0]
            if isinstance(tone_class, (int, np.integer)):
                tone_class = _ml["classes"][tone_class]
        else:
            tone_class = _get_tone_class(named)

        # Build signal chain
        chain = generate_chain(tone_class, named)

        return {
            "chain":    chain,
            "features": named,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))