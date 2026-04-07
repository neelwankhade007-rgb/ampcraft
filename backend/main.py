from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from tone_engine import generate_chain_basic, validate_gear
from feature_extractor import extract_named
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