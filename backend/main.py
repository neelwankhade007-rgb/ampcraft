from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from tone_engine import generate_chain
from feature_extractor import extract_named
import shutil, os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

from classifier import classify_tone
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

        named      = extract_named(file_path)
        tone_class = classify_tone(named)
        chain      = generate_chain(tone_class, named)

        return {"chain": chain, "features": named}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))