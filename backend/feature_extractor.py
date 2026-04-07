import librosa
import numpy as np


def extract_features(file_path: str) -> np.ndarray:
    """
    Extract a feature vector for tone classification, ignoring silence.
    """
    y_raw, sr = librosa.load(file_path)
    y, _ = librosa.effects.trim(y_raw, top_db=25)  # Trim leading/trailing silence

    # Calculate frame-level energy
    rms = librosa.feature.rms(y=y)[0]
    # Create mask for 'active' frames (above -30dB)
    active_mask = rms > (np.max(rms) * 0.03) 
    
    if not np.any(active_mask):
        active_mask = np.ones_like(rms, dtype=bool)

    features = []

    # MFCC (13) - only on active frames
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    features.extend(np.mean(mfcc[:, active_mask], axis=1))

    # Spectral features - only on active frames
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rolloff  = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    flatness = librosa.feature.spectral_flatness(y=y)[0]
    
    features.append(np.mean(centroid[active_mask]))
    features.append(np.mean(rolloff[active_mask]))
    features.append(np.mean(flatness[active_mask]))

    # ZCR + RMS
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    features.append(np.mean(zcr[active_mask]))
    features.append(np.mean(rms[active_mask]))

    return np.array(features)


def extract_named(file_path: str) -> dict:
    """
    Same logic as extract_features but returns a human-readable dict with integers.
    """
    y_raw, sr = librosa.load(file_path)
    y, _ = librosa.effects.trim(y_raw, top_db=25)

    rms = librosa.feature.rms(y=y)[0]
    # Gate threshold: 3% of peak energy
    active_mask = rms > (np.max(rms) * 0.03)
    
    if not np.any(active_mask):
        active_mask = np.ones_like(rms, dtype=bool)
    
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rolloff  = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    flatness = librosa.feature.spectral_flatness(y=y)[0]
    zcr      = librosa.feature.zero_crossing_rate(y)[0]

    return {
        "centroid": int(np.mean(centroid[active_mask])),
        "rolloff":  int(np.mean(rolloff[active_mask])),
        "flatness": float(np.mean(flatness[active_mask])),
        "zcr":      float(np.mean(zcr[active_mask])),
        "rms":      float(np.mean(rms[active_mask])),
    }


def extract_hybrid(file_path: str) -> dict:
    import librosa
    import numpy as np

    y_raw, sr = librosa.load(file_path)
    y, _ = librosa.effects.trim(y_raw, top_db=25)

    # --- FRAME FEATURES ---
    rms = librosa.feature.rms(y=y)[0]
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    flatness = librosa.feature.spectral_flatness(y=y)[0]

    # --- SPECTRAL FLUX ---
    S = np.abs(librosa.stft(y))
    flux = np.sqrt(np.sum(np.diff(S, axis=1)**2, axis=0))
    flux = np.concatenate([[0], flux])

    # --- ONSET DETECTION ---
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)

    onset_vector = np.zeros_like(rms)
    onset_vector[onset_frames] = 1

    # --- PITCH TRACKING ---
    f0 = librosa.yin(y, sr=sr, fmin=80, fmax=1000)
    pitch_diff = np.concatenate([[0], np.abs(np.diff(f0))])
    pitch_diff_norm = pitch_diff / (np.max(pitch_diff) + 1e-6)
    pitch_stability = 1.0 - pitch_diff_norm

    # --- VIBRATO & PITCH STABILITY (global) ---
    pitch_clean = f0[~np.isnan(f0)]
    if len(pitch_clean) > 1:
        pitch_std = float(np.std(pitch_clean))
        vibrato_strength = float(np.std(np.diff(pitch_clean)))
    else:
        pitch_std = 0.0
        vibrato_strength = 0.0

    # Thresholds (tunable)
    pitch_stable = pitch_std < 20       # low std → stable note → lead
    has_vibrato = vibrato_strength > 2   # periodic oscillation → vibrato → lead

    # --- ACTIVE MASK ---
    active_mask = rms > (np.max(rms) * 0.03)
    if not np.any(active_mask):
        active_mask = np.ones_like(rms, dtype=bool)

    # --- NORMALIZATION ---
    flux_norm = flux / (np.max(flux) + 1e-6)
    rms_norm = rms / (np.max(rms) + 1e-6)

    # --- FRAME CLASSIFICATION ---
    lead_idx = []
    rhythm_idx = []

    for i in range(len(rms)):
        if not active_mask[i]:
            continue

        # 🎯 BASE SCORES
        attack = flux_norm[i] + onset_vector[i]
        sustain = rms_norm[i] * (1 - flux_norm[i])

        lead_score = sustain
        rhythm_score = attack

        # 🔥 ADD PITCH INTELLIGENCE
        if pitch_stable:
            lead_score += 0.25

        if has_vibrato:
            lead_score += 0.35

        # penalize rhythm if expressive
        if has_vibrato:
            rhythm_score -= 0.1

        # 🎯 DECISION
        if lead_score > rhythm_score:
            lead_idx.append(i)
        else:
            rhythm_idx.append(i)

    total = len(lead_idx) + len(rhythm_idx)
    lead_ratio = len(lead_idx) / total if total else 0
    rhythm_ratio = len(rhythm_idx) / total if total else 0

    # Hybrid detection computation expected by API
    hybrid_ratio = min(lead_ratio, rhythm_ratio)

    # --- FINAL CLASS ---
    if hybrid_ratio > 0.25:
        dominant = "hybrid"
    elif lead_ratio > 0.6:
        dominant = "lead"
    elif rhythm_ratio > 0.6:
        dominant = "rhythm"
    else:
        dominant = "hybrid"

    def _feat(indices):
        if not indices:
            indices = np.where(active_mask)[0]

        return {
            "centroid": int(np.mean(centroid[indices])),
            "rolloff": int(np.mean(rolloff[indices])),
            "flatness": float(np.mean(flatness[indices])),
            "zcr": float(np.mean(zcr[indices])),
            "rms": float(np.mean(rms[indices])),
            "flux": float(np.mean(flux[indices])),
            # 🔥 NEW — pitch intelligence
            "pitch_std": pitch_std,
            "vibrato": vibrato_strength,
        }

    # 🔥 DEBUG PRINT
    print("pitch_std:", pitch_std)
    print("vibrato:", vibrato_strength)
    print("dominant:", dominant)
    print("lead_ratio:", lead_ratio, "rhythm_ratio:", rhythm_ratio)

    return {
        "lead": _feat(lead_idx),
        "rhythm": _feat(rhythm_idx),
        "lead_ratio": lead_ratio,
        "rhythm_ratio": rhythm_ratio,
        "hybrid_ratio": hybrid_ratio,
        "dominant": dominant,
        # 🎸 Pitch / vibrato analytics
        "pitch_std": pitch_std,
        "vibrato_strength": vibrato_strength,
        "pitch_stable": pitch_stable,
        "has_vibrato": has_vibrato,
    }

