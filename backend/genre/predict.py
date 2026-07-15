import os
import joblib

from feature_extractor import extract_features

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

model = joblib.load(os.path.join(BASE_DIR, "..", "models", "genre_model.pkl"))
scaler = joblib.load(os.path.join(BASE_DIR, "..", "models", "scaler.pkl"))
encoder = joblib.load(os.path.join(BASE_DIR, "..", "models", "label_encoder.pkl"))

features = extract_features(os.path.join(BASE_DIR, "linkin_park_qwerty_full.mp3"))

features_scaled = scaler.transform(features)

prediction = model.predict(features_scaled)
probabilities = model.predict_proba(features_scaled)

genre = encoder.inverse_transform(prediction)[0]
confidence = probabilities.max()

print(f"Genre: {genre}")
print(f"Confidence: {confidence:.2%}")