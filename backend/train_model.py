"""
train_model.py — Train a Random Forest tone classifier for AmpCraft.

Usage:
    python train_model.py

Dataset layout expected:
    backend/
    └── training_data/
        ├── clean/       ← .wav files of clean guitar tones
        ├── crunch/      ← .wav files of crunch tones
        ├── high_gain/   ← .wav files of high-gain / metal tones
        └── bass/        ← .wav files of bass tones

The trained model is saved to model/tone_model.pkl
"""

import os
import glob
import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from feature_extractor import extract_features

# ── Config ────────────────────────────────────────────────────────────────────
TRAINING_DIR = os.path.join(os.path.dirname(__file__), "training_data")
MODEL_PATH   = os.path.join(os.path.dirname(__file__), "model", "tone_model.pkl")
CLASSES      = ["clean", "crunch", "high_gain", "bass"]
# ──────────────────────────────────────────────────────────────────────────────


def load_dataset():
    X, y = [], []
    for label, cls in enumerate(CLASSES):
        folder = os.path.join(TRAINING_DIR, cls)
        wav_files = glob.glob(os.path.join(folder, "*.wav"))
        if not wav_files:
            print(f"  ⚠️  No .wav files found in {folder!r} — skipping class '{cls}'")
            continue
        for wav in wav_files:
            try:
                features = extract_features(wav)
                X.append(features)
                y.append(label)
                print(f"  ✅ {cls}/{os.path.basename(wav)}")
            except Exception as e:
                print(f"  ❌ Failed {wav}: {e}")
    return np.array(X), np.array(y)


def train():
    print("📂 Loading training data...")
    X, y = load_dataset()

    if len(X) == 0:
        print("\n❌ No training data found. Add .wav files to training_data/<class>/ and re-run.")
        return

    print(f"\n🔢 Loaded {len(X)} samples across {len(set(y))} classes")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if len(X) > 10 else None
    )

    clf = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    print("\n📊 Evaluation on test split:")
    print(classification_report(y_test, y_pred, target_names=CLASSES, zero_division=0))

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": clf, "classes": CLASSES}, f)

    print(f"💾 Model saved → {MODEL_PATH}")


if __name__ == "__main__":
    train()
