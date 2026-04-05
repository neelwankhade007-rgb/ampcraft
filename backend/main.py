from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from tone_engine import generate_chain, detect_micro_style, validate_gear
from feature_extractor import extract_named, extract_hybrid
from classifier import classify_tone
import shutil, os

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
        file_path = os.path.join(UPLOAD_DIR, os.path.basename(file.filename))
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Split track into rhythm and lead feature sets using the hybrid extractor
        hybrid  = extract_hybrid(file_path)
        named   = extract_named(file_path)  # Full-track features for UI display

        # Classify and generate a chain for each playing mode
        intent_rhythm = classify_tone(hybrid["rhythm"])
        intent_lead   = classify_tone(hybrid["lead"])

        chain_rhythm = generate_chain(intent_rhythm, hybrid["rhythm"], "rhythm")
        chain_lead   = generate_chain(intent_lead,   hybrid["lead"], "lead")

        return {
            "chain":      chain_rhythm,   # Primary chain (rhythm) — default view
            "chain_lead": chain_lead,     # Lead chain — for switching in UI
            "features":   named,          # Full-track features for display
            # 🎯 Inject the new analytical data layer
            "hybrid": {
                "dominant": hybrid["dominant"],
                "ratio_rhythm": hybrid["rhythm_ratio"],
                "ratio_lead": hybrid["lead_ratio"],
                "hybrid_ratio": hybrid["hybrid_ratio"],
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))