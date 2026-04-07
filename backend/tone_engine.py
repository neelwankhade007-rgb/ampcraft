import json
import os

_gear_path = os.path.join(os.path.dirname(__file__), "gear.json")
with open(_gear_path) as f:
    GEAR = json.load(f)


# Each group maps a tone class to the amps/cabs/efx/etc. that suit it.
# Selection within a group is deterministic: index = int(feature_value) % len(group)

def validate_gear():
    """
    Validates integrity of gear.json and mappings.
    Runs at startup — fails fast if anything is broken.
    """

    errors = []

    amp_cab_map = GEAR.get("amp_cab_map", {})
    amps_defined = set(GEAR.get("amp", {}).keys())

    # ✅ Check 1: All AMP_GROUPS amps exist in gear.json
    for group, amps in AMP_GROUPS.items():
        for amp in amps:
            if amp not in amps_defined:
                errors.append(f"[AMP_GROUPS] Amp '{amp}' not found in gear.json")

    # ✅ Check 2: Every amp has a cab mapping
    for amp in AMP_GROUPS.values():
        for a in amp:
            if a not in amp_cab_map:
                errors.append(f"[CAB_MAP] No cab mapping for amp '{a}'")
            elif not amp_cab_map[a]:
                errors.append(f"[CAB_MAP] Empty cab list for amp '{a}'")

    # ✅ Check 3: All mapped cabs exist
    all_cabs = set(GEAR.get("cab", {}).get("list", []))
    for amp, cabs in amp_cab_map.items():
        for cab in cabs:
            if cab not in all_cabs:
                errors.append(f"[CAB_MAP] Cab '{cab}' for amp '{amp}' not found in cab list")

    # 🚨 FAIL FAST
    if errors:
        print("\n❌ GEAR VALIDATION FAILED:\n")
        for e in errors:
            print(" -", e)
        raise ValueError("Invalid gear configuration. Fix gear.json before running.")

    print("✅ Gear validation passed.")

AMP_GROUPS = {
    "jazz":      ["jazz_clean", "stageman"],
    "clean":     ["deluxe_rvb", "optima_air", "hiwire", "super_rvb"],
    "blues":     ["class_a30", "tweedy", "deluxe_rvb"],
    "rock":      ["cali_crunch", "1987_x_50", "brit_800", "plexi_45", "class_a30"],
    "high_gain": ["slo_100", "brit_800", "dual_rect", "cali_crunch", "fireman_hbe", "die_vh4"],
    "metal":     ["die_vh4", "fireman_hbe", "slo_100", "dual_rect", "cali_crunch", "brit_800"],
    "bass":      ["bass_mate", "agl", "mld"],
}



EFX_GROUPS = {
    "jazz":      ["rose_comp"],
    "clean":     ["rose_comp", "rc_boost", "ac_boost"],
    "blues":     ["blues_drive", "morning_drive", "t_screamer"],
    "rock":      ["crunch", "t_screamer", "morning_drive", "red_dirt"],
    "high_gain": ["t_screamer", "dist_one", "red_dirt", "katana"],  # T-Scream as boost
    "metal":     ["t_screamer", "katana"],  # Boost only — no distortion stacking
    "bass":      ["rose_comp", "katana"],
}

MOD_GROUPS = {
    "jazz":      ["ce_1", "ce_2", "sch_1"],
    "clean":     ["ce_2", "st_chorus", "u_vibe", "scf"],
    "blues":     ["vibrato", "u_vibe", "tremolo"],
    "rock":      ["phase_90", "phase_100", "tremolo"],
    "high_gain": ["None"],  # No mod for high gain — tight and clean
    "metal":     ["None"],  # No mod for metal — dry and controlled
    "bass":      ["ce_1", "scf"],
}

# (delay_type, time_ms)
DELAY_GROUPS = {
    "jazz":      ("tape_echo", 350),
    "clean":     ("analog",    300),
    "blues":     ("tape_echo", 380),
    "rock":      ("mod_delay", 360),
    "high_gain": ("digital",   420),
    "metal":     ("None",        0),  # Metal is typically dry - no delay
    "bass":      ("None",        0),
}

# (reverb_type, level)
REVERB_GROUPS = {
    "jazz":      ("hall",   7),
    "clean":     ("spring", 6),
    "blues":     ("spring", 5),
    "rock":      ("room",   4),
    "high_gain": ("None",   0),  # High gain is tight - no reverb
    "metal":     ("None",   0),  # Metal is dry - no reverb
    "bass":      ("damp",   3),
}

STYLE_NAMES = {
    "jazz": "Jazz", "clean": "Clean", "blues": "Blues", "rock": "Rock",
    "high_gain": "High Gain", "metal": "Metal", "bass": "Bass",
}

AMP_GAIN  = {"jazz": 2, "clean": 3, "blues": 4, "rock": 6, "high_gain": 8, "metal": 9, "bass": 4}
EFX_GAIN  = {"jazz": 0, "clean": 2, "blues": 5, "rock": 6, "high_gain": 7, "metal": 9, "bass": 3}
GATE_THR  = {"jazz": -55, "clean": -50, "blues": -48, "rock": -45,
             "high_gain": -42, "metal": -38, "bass": -48}
def detect_micro_style(features: dict) -> str:
    """
    Universal feel detection (genre-independent)
    """
    rms = features.get("rms", 0.1)
    zcr = features.get("zcr", 0.05)

    # Tight / palm-muted (any genre)
    if zcr > 0.14 and rms < 0.16:
        return "tight"

    # Sustained notes (any genre, including clean/blues leads)
    if rms > 0.18 and zcr < 0.10:
        return "sustain"

    return "normal"


def _map_feature_to_index(value, min_val, max_val, num_items):
    norm = max(0.0, min(1.0, (value - min_val) / (max_val - min_val))) if max_val > min_val else 0.5
    idx = int(norm * num_items)
    return min(idx, num_items - 1)

def pick_amp(tone_class, features):
    amps = AMP_GROUPS.get(tone_class, AMP_GROUPS["clean"])
    centroid = features.get("centroid", 2500)
    
    # Fix 5: Stable, predictable index — no floating point instability
    # Same centroid always → same amp. Integer-safe.
    idx = int((centroid // 500) % len(amps))
    return amps[idx], tone_class


def pick_cab_for_amp(amp_id: str) -> str:
    """
    Strict amp → cab mapping.
    No fallback. Fail if mapping is missing.
    """
    amp_cab_map = GEAR.get("amp_cab_map", {})

    if amp_id in amp_cab_map and amp_cab_map[amp_id]:
        return amp_cab_map[amp_id][0]

    raise ValueError(f"No cab mapping found for amp: {amp_id}")

def pick_efx(group, centroid):
    efx_list = EFX_GROUPS.get(group, EFX_GROUPS["clean"])
    idx = _map_feature_to_index(centroid, 500, 5000, len(efx_list))
    return efx_list[idx]

def pick_mod(group, zcr):
    mod_list = MOD_GROUPS.get(group, MOD_GROUPS["clean"])
    idx = _map_feature_to_index(zcr, 0.01, 0.15, len(mod_list))
    return mod_list[idx]


def tone_eq(centroid):
    """Maps spectral centroid to EQ character + treble/mid/bass values."""
    if centroid > 4500: return "bright",   9, 6, 3
    if centroid > 3500: return "bright",   8, 6, 4
    if centroid > 2500: return "balanced", 6, 6, 6
    if centroid > 1500: return "warm",     5, 6, 7
    return               "dark",           3, 5, 8


def format_name(name_key: str) -> str:
    if name_key == "None" or not name_key:
        return "None"
    return name_key.replace('_', ' ').title()


# Gain scaling per genre: how aggressive should distortion be?
_GAIN_SCALE = {
    "jazz":      0.15,   # Very light overdrive
    "clean":     0.10,   # Nearly no gain
    "blues":     0.25,   # Light crunch
    "rock":      0.45,   # Classic crunch
    "high_gain": 0.60,   # High gain
    "metal":     0.55,   # Tight gain (not maxed — fizz prevention)
    "bass":      0.20,
}

# Hard caps per genre
_GAIN_CAP = {
    "jazz": 50, "clean": 40, "blues": 65,
    "rock": 85, "high_gain": 80, "metal": 72, "bass": 55,
}


def _clamp(val: float, lo: int = 0, hi: int = 100) -> int:
    """Ensure all knob values are within [lo, hi]."""
    return int(min(hi, max(lo, val)))


def _map_feature_to_knob(knob: str, features: dict, tone_class: str, defaults: dict) -> any:
    """
    Universal reactive knob mapper — 0 to 100 for EVERY parameter.
    Applies to ALL genres. Dependencies are baked in globally.
    No Hz values. No negative values. No exceptions.
    """
    centroid = features.get("centroid", 2500)
    zcr      = features.get("zcr", 0.05)
    rms      = features.get("rms", 0.1)
    rolloff  = features.get("rolloff", 5000)

    k = knob.lower()

    # ─────────────────────────────────────────────────────────────────────
    # 1. GAIN / DRIVE — genre-scaled, always clamped
    # ─────────────────────────────────────────────────────────────────────
    if any(x in k for x in ["gain", "drive", "distortion", "overdrive", "crunch", "sustain", "sensitivity"]):
        scale = _GAIN_SCALE.get(tone_class, 0.35)
        cap   = _GAIN_CAP.get(tone_class, 80)
        raw   = scale * 100 + zcr * 150   # Base from genre + ZCR energy
        return _clamp(raw, 20, cap)

    # ─────────────────────────────────────────────────────────────────────
    # 2. PRESENCE / TREBLE — brightness from centroid
    # DEPENDENCY: higher gain → more presence (universal)
    # ─────────────────────────────────────────────────────────────────────
    if any(x in k for x in ["presence", "treble", "top boost"]):
        base = centroid / 55       # Higher centroid → more treble
        gain_scale = _GAIN_SCALE.get(tone_class, 0.35)
        correction = gain_scale * 20  # Higher gain genre → more presence compensation
        return _clamp(base + correction, 25, 90)

    # ─────────────────────────────────────────────────────────────────────
    # 3. TONE (general brightness sweep, e.g. Tweedy, 1-knob amps)
    # ─────────────────────────────────────────────────────────────────────
    if "tone" in k:
        return _clamp(centroid / 50, 20, 80)

    # ─────────────────────────────────────────────────────────────────────
    # 4. CUT (Vox-style cut knob — inverse high-cut, not same as treble)
    # ─────────────────────────────────────────────────────────────────────
    if k == "cut":
        return _clamp(100 - centroid / 50, 20, 75)  # Brighter track = less cut

    # ─────────────────────────────────────────────────────────────────────
    # 5. MID / MIDDLE
    # DEPENDENCY: higher gain → slightly more mids for articulation
    # ─────────────────────────────────────────────────────────────────────
    if any(x in k for x in ["mid", "middle"]):
        base = centroid / 48
        if tone_class in ["metal", "high_gain"]:
            return _clamp(base + 15, 50, 70)   # Metal needs mids for bite
        if tone_class in ["rock", "blues"]:
            return _clamp(base + 8, 35, 75)
        return _clamp(base, 20, 80)

    # ─────────────────────────────────────────────────────────────────────
    # 6. BASS — invert centroid; DEPENDENCY: higher gain = tighter bass
    # ─────────────────────────────────────────────────────────────────────
    if any(x in k for x in ["bass", "deep"]):
        raw = 100 - centroid / 40
        cap = {"metal": 55, "high_gain": 58, "rock": 70, "blues": 70}.get(tone_class, 80)
        return _clamp(raw, 20, cap)

    # ─────────────────────────────────────────────────────────────────────
    # 7. MASTER / VOLUME / OUTPUT — based on RMS energy (all genres)
    # ─────────────────────────────────────────────────────────────────────
    if any(x in k for x in ["master", "volume", "output", "level"]):
        return _clamp(30 + rms * 200, 30, 85)

    # ─────────────────────────────────────────────────────────────────────
    # 8. NOISE GATE: Sens = tighter gate for dirtier/louder playing
    #                Decay = harder cutoff for metal
    # ─────────────────────────────────────────────────────────────────────
    if "sens" in k:
        # Louder + dirtier playing = tighter gate = higher Sens
        return _clamp(20 + rms * 200 + zcr * 100, 20, 80)

    # ─────────────────────────────────────────────────────────────────────
    # 9. DECAY (gate + reverb) — all on 0-100
    # ─────────────────────────────────────────────────────────────────────
    if "decay" in k:
        # Gate decay: metal/hg wants fast (high value = short gate tail)
        # Reverb decay: ambient styles want longer decay
        if tone_class in ["metal", "high_gain"]:
            return _clamp(75 - rms * 50, 50, 80)
        if tone_class in ["jazz", "clean"]:
            return _clamp(30 + rms * 80, 20, 60)
        return _clamp(int(defaults.get(knob, 50)), 0, 100)

    # ─────────────────────────────────────────────────────────────────────
    # 10. MIX (delay + reverb wet amount) — lighter for dry genres
    # ─────────────────────────────────────────────────────────────────────
    if "mix" in k:
        mix_base = {"jazz": 35, "clean": 30, "blues": 28, "rock": 22, "high_gain": 15, "bass": 20}
        return _clamp(mix_base.get(tone_class, 25), 0, 100)

    # ─────────────────────────────────────────────────────────────────────
    # 11. REPEAT / FEEDBACK / F.BACK (delay repeats)
    # ─────────────────────────────────────────────────────────────────────
    if any(x in k for x in ["repeat", "feedback", "f.back"]):
        return _clamp(int(defaults.get(knob, 30)), 0, 100)

    # ─────────────────────────────────────────────────────────────────────
    # 12. TIME / RATE / SPEED (modulation + delay timings)
    # ─────────────────────────────────────────────────────────────────────
    if any(x in k for x in ["time", "rate", "speed"]):
        return _clamp(int(defaults.get(knob, 40)), 0, 100)

    # ─────────────────────────────────────────────────────────────────────
    # 13. INTENSITY / DEPTH / WIDTH (modulation depth)
    # ─────────────────────────────────────────────────────────────────────
    if any(x in k for x in ["intensity", "depth", "width", "wow"]):
        return _clamp(int(defaults.get(knob, 40)), 0, 100)

    # ─────────────────────────────────────────────────────────────────────
    # 14. TOGGLES / STRINGS (Mode, Bright, Deep, Boost, Clipping)
    # ─────────────────────────────────────────────────────────────────────
    if k == "bright":
        return "On" if centroid > 4000 else "Off"
    if k == "deep":
        return "On" if centroid < 1500 else "Off"
    if k == "boost":
        return "On" if tone_class in ["metal", "high_gain", "rock"] else "Off"
    if k == "mode":
        # String enum — use default directly from gear.json options
        return str(defaults.get(knob, "Chorus"))
    if k == "type":
        return str(defaults.get(knob, "TALK"))
    if k == "clipping":
        return _clamp(int(defaults.get(knob, 50)), 0, 100)

    # ─────────────────────────────────────────────────────────────────────
    # 15. MID FREQ (parametric mid EQ center freq) — 0-100
    # ─────────────────────────────────────────────────────────────────────
    if "mid freq" in k or "freq" in k:
        return _clamp(centroid / 50, 20, 80)

    # ─────────────────────────────────────────────────────────────────────
    # FALLBACK: use JSON default, always clamped 0-100
    # ─────────────────────────────────────────────────────────────────────
    fallback = defaults.get(knob, 50)
    if isinstance(fallback, (int, float)):
        return _clamp(fallback, 0, 100)
    return fallback  # String enum values pass through as-is


def get_gear_settings(category: str, gear_id: str, features: dict, tone_class: str) -> list:
    """Returns a list of {label, value} for the given gear."""
    if gear_id == "None":
        return []
    
    item = GEAR.get(category, {}).get(gear_id)
    if not item or not isinstance(item, dict):
        return []
    
    settings = []
    knobs = item.get("knobs", [])
    defaults = item.get("defaults", {})

    for k in knobs:
        val = _map_feature_to_knob(k, features, tone_class, defaults)
        settings.append({"label": k, "value": val})
    
    return settings


def generate_chain(intent: dict, features: dict, play_style: str) -> dict:
    """
    Generate the full signal chain from a TONE INTENT dict.
    intent = { style, tightness, brightness, energy }
    """
    tone_class = intent["style"]
    centroid   = intent["brightness"]
    rms        = intent["energy"]
    zcr        = intent["tightness"]

    amp_id, group  = pick_amp(tone_class, features)
    cab_id         = pick_cab_for_amp(amp_id)   # Strict matching required
    efx_id         = pick_efx(group, centroid)
    mod_id         = pick_mod(group, zcr)
    delay_id, _    = DELAY_GROUPS.get(group, ("analog", 300))
    reverb_id, _   = REVERB_GROUPS.get(group, ("room", 4))
    char, _, _, _  = tone_eq(centroid)

    # 🎯 Independent FEEL detection
    micro = detect_micro_style(features)

    # 🎛️ APPLY PLAY STYLE + FEEL (GENRE-AGNOSTIC)

    # -------------------------
    # 🎸 RHYTHM (any genre)
    # -------------------------
    if play_style == "rhythm":

        if micro == "tight":
            # Tight rhythm (funk, metal, muted chords)
            delay_id = "None"
            reverb_id = "None"

        elif micro == "normal":
            # Slight ambience allowed (clean/blues rhythm)
            if tone_class in ["clean", "jazz", "blues"]:
                reverb_id = reverb_id  # keep natural reverb
            else:
                delay_id = "None"      # rock/metal rhythm tighter

        elif micro == "sustain":
            # Rare case: open ringing chords
            reverb_id = "room"


    # -------------------------
    # 🎸 LEAD (any genre)
    # -------------------------
    elif play_style == "lead":

        # Always allow space for leads
        if delay_id == "None":
            delay_id = "analog"
        if reverb_id == "None":
            reverb_id = "room"

        if micro == "sustain":
            # Singing lead (David Gilmour, Slash, etc.)
            delay_id = "digital"
            reverb_id = "hall"

        elif micro == "tight":
            # Fast alternate picking leads
            delay_id = "analog"
            reverb_id = "plate"

    # Resolve names from GEAR
    def get_name(cat, gid):
        if gid == "None": return "None"
        if cat == "cab": return gid
        return GEAR.get(cat, {}).get(gid, {}).get("name", format_name(gid))

    chain = {
        "style":          STYLE_NAMES.get(tone_class, tone_class.title()),
        "play_style":     play_style,   # Surfaced for UI display
        "tone_character": char,
        "noise_gate": {
            "type":      get_name("noise_gate", "noise_gate"),
            "enabled":   True,
            "settings":  get_gear_settings("noise_gate", "noise_gate", features, tone_class)
        },
        "efx": {
            "type":      get_name("efx", efx_id),
            "enabled":   efx_id != "None",
            "settings":  get_gear_settings("efx", efx_id, features, tone_class)
        },
        "amp": {
            "type":      get_name("amp", amp_id),
            "enabled":   True,
            "settings":  get_gear_settings("amp", amp_id, features, tone_class)
        },
        "cab": {
            "type":      get_name("cab", cab_id),
            "enabled":   True,
            "settings":  [
                {"label": "Model",    "value": get_name("cab", cab_id)},
                {"label": "Low Cut",  "value": _clamp(centroid / 60, 0, 80)},
                {"label": "High Cut", "value": _clamp(features.get("rolloff", 5000) / 100, 30, 100)},
                {"label": "Level",    "value": _clamp(30 + rms * 200, 30, 85)},
            ]
        },
        "mod": {
            "type":      get_name("mod", mod_id),
            "enabled":   mod_id != "None",
            "settings":  get_gear_settings("mod", mod_id, features, tone_class)
        },
        "reverb": {
            "type":      get_name("reverb", reverb_id),
            "enabled":   reverb_id != "None",
            "settings":  get_gear_settings("reverb", reverb_id, features, tone_class)
        },
        "delay": {
            "type":      get_name("delay", delay_id),
            "enabled":   delay_id != "None",
            "settings":  get_gear_settings("delay", delay_id, features, tone_class)
        },
    }

    return chain


# ═══════════════════════════════════════════════════════════════════════════════
# SIMPLIFIED CHAIN GENERATOR — distortion-based, no lead/rhythm
# ═══════════════════════════════════════════════════════════════════════════════

# Gain score thresholds → tone class override
_GAIN_TIERS = [
    (0.135, "metal"),
    (0.115, "high_gain"),
    (0.085, "rock"),
    (0.055, "blues"),
    (0.025, "clean"),
    (0.00, "jazz"),
]


def _gain_score(features: dict) -> float:
    """Distortion-based score: higher = more distorted."""
    zcr      = features.get("zcr", 0.05)
    flatness = features.get("flatness", 0.01)
    rms      = features.get("rms", 0.05)
    return zcr * 0.6 + flatness * 0.3 + rms * 0.1


def _gain_to_class(score: float) -> str:
    """Map gain_score to a tone class using tier thresholds."""
    for threshold, cls in _GAIN_TIERS:
        if score >= threshold:
            return cls
    return "jazz"


def detect_lead_simple(features: dict) -> str:
    """Detects lead vs rhythm based on sustained energy and noise."""
    rms = features.get("rms", 0.1)
    zcr = features.get("zcr", 0.05)

    # Lead = sustained + less noisy
    if rms > 0.12 and zcr < 0.16:
        return "lead"

    return "rhythm"


def detect_lead_type(features: dict) -> str:
    """Differentiates between tight/distorted leads and expressive leads."""
    zcr = features.get("zcr", 0.05)
    flatness = features.get("flatness", 0.01)

    # High distortion/fizz → tight metal lead
    if zcr > 0.13 or flatness > 0.04:
        return "tight_lead"

    return "expressive_lead"


def detect_palm_mute(features: dict) -> bool:
    """Detects palm-muted playing based on high attack and low sustain."""
    zcr = features.get("zcr", 0.05)
    rms = features.get("rms", 0.1)

    # Tight, percussive, low sustain
    if zcr > 0.13 and rms < 0.15:
        return True

    return False


def generate_chain_basic(intent: dict, features: dict) -> dict:
    """
    Simplified chain generator.
    Pipeline: extract_named → classify_tone → generate_chain_basic

    Uses gain_score to override tone_class for accurate amp selection.
    No lead/rhythm, no hybrid, no play_style.
    """
    # ── Gain-based tone class override ────────────────────────────────────
    zcr = features.get("zcr", 0.05)
    flatness = features.get("flatness", 0.01)
    rms = features.get("rms", 0.1)
    score = _gain_score(features)
    palm_muted = detect_palm_mute(features)

    # 🔥 DOMINANT DISTORTION RULE
    if zcr > 0.14:
        tone_class = "metal"
    elif zcr > 0.11:
        tone_class = "high_gain"
    else:
        tone_class = _gain_to_class(score)

    play_style = detect_lead_simple(features)
    lead_type = detect_lead_type(features)

    # DEBUG LOGGING (BACKEND)
    print("DEBUG → zcr:", zcr)
    print("DEBUG → rms:", features.get("rms"))
    print("DEBUG → palm_muted:", palm_muted)
    print("DEBUG → tone_class:", tone_class)

    print(f"[chain_basic] gain_score={score:.4f} → tone_class={tone_class} | style={play_style} | mute={palm_muted} | type={lead_type}")

    # ── Amp: first amp in the group for this class ────────────────────────
    amps = AMP_GROUPS.get(tone_class, AMP_GROUPS["clean"])
    amp_id = amps[0]

    # ── Cab: strict amp→cab mapping ───────────────────────────────────────
    cab_id = pick_cab_for_amp(amp_id)

    # ── EFX: pick from group ──────────────────────────────────────────────
    efx_list = EFX_GROUPS.get(tone_class, EFX_GROUPS["clean"])
    efx_id = efx_list[0]

    # ── Delay / Reverb: style-aware rules ──────────────────────────────

    # Palm mute priority: always dry
    if palm_muted:
        delay_id = "None"
        reverb_id = "None"

    elif tone_class == "metal":
        if play_style == "lead":
            if lead_type == "tight_lead":
                delay_id = "None"
                reverb_id = "None"
            else:
                delay_id = "analog"
                reverb_id = "plate"
        else:
            delay_id = "None"
            reverb_id = "None"

    elif tone_class == "high_gain":
        if palm_muted:
            delay_id = "None"
            reverb_id = "None"
        elif play_style == "lead":
            delay_id = "analog"
            reverb_id = "plate"
        else:
            delay_id = "None"
            reverb_id = "None"

    elif tone_class == "rock":
        if play_style == "lead":
            delay_id = "analog"
            reverb_id = "room"
        else:
            delay_id = "None"
            reverb_id = "room"

    else:  # clean, blues, jazz, bass
        if play_style == "lead":
            delay_id = "tape_echo"
            reverb_id = "spring"
        else:
            delay_id, _ = DELAY_GROUPS.get(tone_class, ("analog", 300))
            reverb_id, _ = REVERB_GROUPS.get(tone_class, ("spring", 5))

    # ── EQ character ──────────────────────────────────────────────────────
    centroid = features.get("centroid", 2500)
    rolloff  = features.get("rolloff", 5000)
    rms      = features.get("rms", 0.1)
    char, _, _, _ = tone_eq(centroid)

    # ── Resolve real-world Cab units ──────────────────────────────────────
    low_cut  = int(min(300, max(20, centroid * 0.08)))
    high_cut = int(min(20000, max(2000, rolloff * 1.5)))
    level_db = 0.0

    # ── Resolve display names ─────────────────────────────────────────────
    def get_name(cat, gid):
        if gid == "None": return "None"
        if cat == "cab": return gid
        return GEAR.get(cat, {}).get(gid, {}).get("name", format_name(gid))

    # ── Build chain ───────────────────────────────────────────────────────
    chain = {
        "style":          STYLE_NAMES.get(tone_class, tone_class.title()),
        "gain_score":     round(score, 4),
        "play_style":     play_style,
        "lead_type":      lead_type,
        "palm_muted":     palm_muted,
        "tone_character": char,
        "noise_gate": {
            "type":     get_name("noise_gate", "noise_gate"),
            "enabled":  True,
            "settings": get_gear_settings("noise_gate", "noise_gate", features, tone_class),
        },
        "efx": {
            "type":     get_name("efx", efx_id),
            "enabled":  efx_id != "None",
            "settings": get_gear_settings("efx", efx_id, features, tone_class),
        },
        "amp": {
            "type":     get_name("amp", amp_id),
            "enabled":  True,
            "settings": get_gear_settings("amp", amp_id, features, tone_class),
        },
        "cab": {
            "type":     get_name("cab", cab_id),
            "enabled":  True,
            "settings": [
                {"label": "Model",         "value": get_name("cab", cab_id)},
                {"label": "Low Cut (Hz)",  "value": low_cut},
                {"label": "High Cut (Hz)", "value": high_cut},
                {"label": "Level (dB)",    "value": level_db}
            ],
        },
        "mod": {
            "type":     "None",
            "enabled":  False,
            "settings": [],
        },
        "delay": {
            "type":     get_name("delay", delay_id),
            "enabled":  delay_id != "None",
            "settings": get_gear_settings("delay", delay_id, features, tone_class) if delay_id != "None" else [],
        },
        "reverb": {
            "type":     get_name("reverb", reverb_id),
            "enabled":  reverb_id != "None",
            "settings": get_gear_settings("reverb", reverb_id, features, tone_class) if reverb_id != "None" else [],
        },
        "debug_features": {
            "zcr": features.get("zcr"),
            "flatness": features.get("flatness"),
            "rms": features.get("rms"),
            "centroid": features.get("centroid"),
            "gain_score": round(score, 4)
        }
    }

    return chain
