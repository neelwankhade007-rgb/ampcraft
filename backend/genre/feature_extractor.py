import librosa
import numpy as np
import pandas as pd


def extract_features(file_path: str) -> pd.DataFrame:
    y, sr = librosa.load(file_path, mono=True)

    features = {}

    # Length
    features["length"] = len(y)

    # Chroma STFT
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    features["chroma_stft_mean"] = np.mean(chroma)
    features["chroma_stft_var"] = np.var(chroma)

    # RMS
    rms = librosa.feature.rms(y=y)
    features["rms_mean"] = np.mean(rms)
    features["rms_var"] = np.var(rms)

    # Spectral Centroid
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    features["spectral_centroid_mean"] = np.mean(centroid)
    features["spectral_centroid_var"] = np.var(centroid)

    # Spectral Bandwidth
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    features["spectral_bandwidth_mean"] = np.mean(bandwidth)
    features["spectral_bandwidth_var"] = np.var(bandwidth)

    # Rolloff
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
    features["rolloff_mean"] = np.mean(rolloff)
    features["rolloff_var"] = np.var(rolloff)

    # Zero Crossing Rate
    zcr = librosa.feature.zero_crossing_rate(y)
    features["zero_crossing_rate_mean"] = np.mean(zcr)
    features["zero_crossing_rate_var"] = np.var(zcr)

    # Harmonic & Percussive
    harmonic = librosa.effects.harmonic(y)
    percussive = librosa.effects.percussive(y)

    features["harmony_mean"] = np.mean(harmonic)
    features["harmony_var"] = np.var(harmonic)

    features["perceptr_mean"] = np.mean(percussive)
    features["perceptr_var"] = np.var(percussive)

    # Tempo
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    features["tempo"] = float(tempo[0]) if isinstance(tempo, np.ndarray) else float(tempo)

    # MFCC 1-20
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)

    for i in range(20):
        features[f"mfcc{i+1}_mean"] = np.mean(mfccs[i])
        features[f"mfcc{i+1}_var"] = np.var(mfccs[i])

    return pd.DataFrame([features])