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
    "jazz":      {"centroid": 1200, "rolloff": 2500, "flatness": 0.001, "zcr": 0.02, "rms": 0.05},
    "clean":     {"centroid": 2200, "rolloff": 4500, "flatness": 0.005, "zcr": 0.04, "rms": 0.06},
    "blues":     {"centroid": 2400, "rolloff": 5000, "flatness": 0.010, "zcr": 0.06, "rms": 0.08},
    "rock":      {"centroid": 3200, "rolloff": 6500, "flatness": 0.020, "zcr": 0.08, "rms": 0.12},
    "high_gain": {"centroid": 3800, "rolloff": 7500, "flatness": 0.040, "zcr": 0.11, "rms": 0.15},
    "metal":     {"centroid": 4500, "rolloff": 8500, "flatness": 0.060, "zcr": 0.15, "rms": 0.18},
    "bass":      {"centroid":  800, "rolloff": 1500, "flatness": 0.0005, "zcr": 0.01, "rms": 0.10},
}

def _normalize(features: dict) -> dict:
    """Normalize features to a 0.0 - 1.0 scale depending on standard max bounds."""
    norm = {}
    for key, val in features.items():
        if key in NORM_MAX:
            norm[key] = min(1.0, max(0.0, val / NORM_MAX[key]))
    return norm


def classify_tone(features: dict) -> str:
    """
    Zero-Shot KNN Classifier:
    Calculates the Euclidean distance to pre-defined 'ideal' tone vectors.
    """
    input_norm = _normalize(features)
    
    best_class = "clean"
    min_dist = float('inf')
    
    for tone_name, profile in IDEAL_PROFILES.items():
        profile_norm = _normalize(profile)
        
        # Calculate Euclidean distance
        distance = 0.0
        for key in input_norm.keys():
            if key in profile_norm:
                diff = input_norm[key] - profile_norm[key]
                
                # Weighting: ZCR strongly determines distortion vs clean
                weight = 2.0 if key == "zcr" else 1.0
                distance += weight * (diff ** 2)
                
        distance = math.sqrt(distance)
        
        if distance < min_dist:
            min_dist = distance
            best_class = tone_name
            
    return best_class
