import librosa
import numpy as np


def extract_features(file_path: str) -> np.ndarray:
    """
    Extract an 18-feature vector for tone classification:
        - 13 MFCCs (mean across time)
        - spectral centroid  (mean)
        - spectral rolloff   (mean)
        - spectral flatness  (mean)
        - zero crossing rate (mean)
        - RMS energy         (mean)
    """
    y, sr = librosa.load(file_path)

    features = []

    # MFCC (13)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    features.extend(np.mean(mfcc, axis=1))

    # Spectral features
    features.append(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    features.append(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
    features.append(np.mean(librosa.feature.spectral_flatness(y=y)))

    # ZCR + RMS
    features.append(np.mean(librosa.feature.zero_crossing_rate(y)))
    features.append(np.mean(librosa.feature.rms(y=y)))

    return np.array(features)


def extract_named(file_path: str) -> dict:
    """
    Same logic as extract_features but returns a human-readable dict.
    Used by the /analyze endpoint for debug output.
    """
    y, sr = librosa.load(file_path)
    return {
        "centroid": float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))),
        "rolloff":  float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))),
        "flatness": float(np.mean(librosa.feature.spectral_flatness(y=y))),
        "zcr":      float(np.mean(librosa.feature.zero_crossing_rate(y))),
        "rms":      float(np.mean(librosa.feature.rms(y=y))),
    }

