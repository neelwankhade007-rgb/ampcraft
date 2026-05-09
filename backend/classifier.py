import math

# ── Gain score thresholds → tone class ──────────────────────────────────────
# Ordered highest → lowest. First match wins.
# gain_score = zcr*0.6 + flatness*0.3 + rms*0.1
_GAIN_TIERS = [
    (0.135, "metal"),
    (0.110, "high_gain"),
    (0.080, "rock"),
    (0.050, "blues"),
    (0.022, "clean"),
    (0.000, "jazz"),
]

# ── Flux thresholds for clean-range disambiguation ───────────────────────────
# When gain_score < 0.050 (clean/jazz territory), use flux to pick between them.
# flux < 0.08  → jazz   (smooth, sustained, low transient density)
# flux < 0.18  → clean  (moderate strumming)
# flux >= 0.18 → blues  (picking attack, some grit)
_FLUX_CLEAN_TIERS = [
    (0.18, "blues"),
    (0.08, "clean"),
    (0.00, "jazz"),
]

def _gain_score(features: dict) -> float:
    zcr      = features.get("zcr", 0.05)
    flatness = features.get("flatness", 0.01)
    rms      = features.get("rms", 0.05)
    return zcr * 0.6 + flatness * 0.3 + rms * 0.1


def _gain_to_class(score: float) -> str:
    for threshold, cls in _GAIN_TIERS:
        if score >= threshold:
            return cls
    return "jazz"


def classify_tone(features: dict) -> dict:
    """
    Gain-score primary classifier with flux tiebreaker for clean/jazz range.
    Returns intent dict: style, tightness, brightness, energy, flux, gain_score.
    """
    zcr      = features.get("zcr", 0.05)
    rms      = features.get("rms", 0.1)
    centroid = features.get("centroid", 2500)
    flux     = features.get("flux", 0.1)

    score = _gain_score(features)
    style = _gain_to_class(score)

    # Tiebreaker: in the clean/jazz ambiguous zone use flux
    if score < 0.050:
        for threshold, cls in _FLUX_CLEAN_TIERS:
            if flux >= threshold:
                style = cls
                break

    # Hard guard: if both zcr AND flatness are very high, force metal/high_gain
    # regardless of score (catches full-mix tracks with heavy distortion)
    zcr_f    = features.get("zcr", 0.05)
    flatness = features.get("flatness", 0.01)
    if zcr_f > 0.17 and flatness > 0.06:
        style = "metal"
    elif zcr_f > 0.15 and flatness > 0.04:
        style = "high_gain"

    return {
        "style":      style,
        "tightness":  zcr,
        "brightness": centroid,
        "energy":     rms,
        "flux":       flux,
        "gain_score": round(score, 4),
    }
