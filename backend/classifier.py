import math

# Normalization constants to map diverse ranges to ~0.0-1.0
NORM_MAX = {
    "centroid": 6000.0,
    "rolloff": 10000.0,
    "flatness": 0.1,
    "zcr": 0.25,
    "rms": 0.5
}

# Ideal acoustic profiles for each tone style based on spectral footprint
IDEAL_PROFILES = {
    "jazz":      {"centroid": 1200, "rolloff": 2500, "flatness": 0.002, "zcr": 0.050, "rms": 0.01},
    "clean":     {"centroid": 1800, "rolloff": 3500, "flatness": 0.005, "zcr": 0.110, "rms": 0.03},
    "bass":      {"centroid": 500,  "rolloff": 1000, "flatness": 0.001, "zcr": 0.010, "rms": 0.03},
    "blues":     {"centroid": 2200, "rolloff": 4500, "flatness": 0.015, "zcr": 0.125, "rms": 0.05},
    "rock":      {"centroid": 2600, "rolloff": 5500, "flatness": 0.030, "zcr": 0.145, "rms": 0.08},
    "high_gain": {"centroid": 3500, "rolloff": 6500, "flatness": 0.060, "zcr": 0.160, "rms": 0.12},
    "metal":     {"centroid": 4500, "rolloff": 8000, "flatness": 0.100, "zcr": 0.180, "rms": 0.16},
}

def _normalize(features: dict) -> dict:
    """Normalize features to a 0.0 - 1.0 scale depending on standard max bounds."""
    norm = {}
    for key, val in features.items():
        if key in NORM_MAX:
            norm[key] = min(1.0, max(0.0, val / NORM_MAX[key]))
    return norm


def classify_tone(features: dict) -> dict:
    """
    Zero-Shot KNN Classifier.
    Returns a TONE INTENT dict — not just a label — so the engine
    has full context: style + tightness + brightness + energy.
    """
    rms = features.get("rms", 0.1)
    zcr = features.get("zcr", 0.05)

    # Run the KNN classifier normally
    input_norm = _normalize(features)
    best_class = "clean"
    min_dist = float('inf')
    
    for tone_name, profile in IDEAL_PROFILES.items():
        profile_norm = _normalize(profile)
        distance = 0.0
        for key in input_norm.keys():
            if key in profile_norm:
                diff = input_norm[key] - profile_norm[key]
                # ZCR balanced with RMS — both matter
                weight = 2.5 if key == "zcr" else (2.0 if key == "rms" else 1.0)
                distance += weight * (diff ** 2)
        distance = math.sqrt(distance)
        if distance < min_dist:
            min_dist = distance
            best_class = tone_name
    
    style = best_class

    return {
        "style":      style,
        "tightness":  zcr,
        "brightness": features.get("centroid", 2500),
        "energy":     rms,
    }
