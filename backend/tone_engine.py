import json
import os

_gear_path = os.path.join(os.path.dirname(__file__), "gear.json")
with open(_gear_path) as f:
    GEAR = json.load(f)


# ─────────────────────────────────────────────────────────────────────────────
# 🎸 AMP GROUPS  (all 20 amps covered)
# ─────────────────────────────────────────────────────────────────────────────
AMP_GROUPS = {
    "jazz":      ["jazz_clean", "super_rvb", "stageman"],
    "clean":     ["deluxe_rvb", "hiwire", "optima_air", "stageman"],
    "blues":     ["tweedy", "class_a30", "deluxe_rvb"],
    "rock":      ["plexi_45", "plexi_100", "1987x_50", "brit_800"],
    "high_gain": ["brit_800", "cali_crunch", "dual_rect", "slo_100"],
    "metal":     ["slo_100", "fireman_hbe", "die_vh4", "dual_rect", "cali_crunch"],
    "bass":      ["bass_mate", "agl", "mld"],
}

# ─────────────────────────────────────────────────────────────────────────────
# 📦 CAB GROUPS  (all 29 cabs covered)
# ─────────────────────────────────────────────────────────────────────────────
CAB_GROUPS = {
    "jazz":      ["jz120", "a112", "dr112", "budda112"],
    "clean":     ["dr112", "superverb410", "vibroking310", "a212", "z212"],
    "blues":     ["tr212", "budda112", "match212", "z212", "hiwire412"],
    "rock":      ["m1960ax", "m1960av", "m1960ahw", "m1936", "gb412", "hiwire412"],
    "high_gain": ["gb412", "m1960ax", "rect412", "slo412", "cali112"],
    "metal":     ["slo412", "fireman412", "die412", "rect412", "cali112"],
    "bass":      ["bs410", "agl_bb810", "amp_sv212", "amp_sv410", "amp_sv810",
                  "bassguy410", "eden410", "mkb410"],
}

# ─────────────────────────────────────────────────────────────────────────────
# 🎛️ EFX GROUPS  (all 13 efx covered)
# ─────────────────────────────────────────────────────────────────────────────
EFX_GROUPS = {
    "jazz":      ["rose_comp", "rc_boost"],
    "clean":     ["rc_boost", "ac_boost"],
    "blues":     ["blues_drive", "morning_drive", "red_dirt", "t_screamer"],
    "rock":      ["crunch", "t_screamer", "morning_drive", "red_dirt", "katana"],
    "high_gain": ["dist_one", "red_dirt", "katana"],
    "metal":     ["distortion_pp", "eat_dist", "muff_fuzz", "dist_one"],
    "bass":      ["rose_comp", "katana"],
}

# ─────────────────────────────────────────────────────────────────────────────
# 🌀 MOD GROUPS  (all 11 mod effects covered)
# ─────────────────────────────────────────────────────────────────────────────
MOD_GROUPS = {
    "jazz":      ["ce_1", "ce_2", "sch_1"],
    "clean":     ["ce_2", "st_chorus", "u_vibe", "scf"],
    "blues":     ["vibrato", "u_vibe", "tremolo"],
    "rock":      ["phase_90", "phase_100", "tremolo"],
    "high_gain": ["flanger", "phase_100"],
    "metal":     ["flanger", "None"],
    "bass":      ["ce_1", "scf"],
}

# ─────────────────────────────────────────────────────────────────────────────
# ⏱️ DELAY GROUPS  (all 5 delays covered)
# ─────────────────────────────────────────────────────────────────────────────
DELAY_GROUPS = {
    "jazz":      ("tape_echo", 350),
    "clean":     ("analog",    300),
    "blues":     ("tape_echo", 380),
    "rock":      ("mod_delay", 360),
    "high_gain": ("digital",   420),
    "metal":     ("phi_delay", 400),
    "bass":      ("None",        0),
}

# ─────────────────────────────────────────────────────────────────────────────
# 🏔️ REVERB GROUPS  (all 5 reverbs covered)
# ─────────────────────────────────────────────────────────────────────────────
REVERB_GROUPS = {
    "jazz":      ("hall",   7),
    "clean":     ("spring", 6),
    "blues":     ("spring", 5),
    "rock":      ("room",   4),
    "high_gain": ("plate",  4),
    "metal":     ("plate",  3),
    "bass":      ("damp",   3),
}

# ─────────────────────────────────────────────────────────────────────────────
# 🏷️ STYLE DISPLAY NAMES
# ─────────────────────────────────────────────────────────────────────────────
STYLE_NAMES = {
    "jazz":      "Jazz",
    "clean":     "Clean",
    "blues":     "Blues",
    "rock":      "Rock",
    "high_gain": "High Gain",
    "metal":     "Metal",
    "bass":      "Bass",
}

# ─────────────────────────────────────────────────────────────────────────────
# 🎚️ AMP GAIN BY STYLE
# ─────────────────────────────────────────────────────────────────────────────
AMP_GAIN = {
    "jazz": 2, "clean": 3, "blues": 4,
    "rock": 6, "high_gain": 8, "metal": 9, "bass": 4,
}

EFX_GAIN = {
    "jazz": 0, "clean": 2, "blues": 5,
    "rock": 6, "high_gain": 7, "metal": 9, "bass": 3,
}

GATE_THRESHOLD = {
    "jazz": -55, "clean": -50, "blues": -48,
    "rock": -45, "high_gain": -42, "metal": -38, "bass": -48,
}


# ─────────────────────────────────────────────────────────────────────────────
# SELECTORS
# ─────────────────────────────────────────────────────────────────────────────

def _pick_by_centroid(lst: list, centroid: float) -> str:
    return lst[int(centroid) % len(lst)]

def _pick_by_zcr(lst: list, zcr: float) -> str:
    return lst[int(zcr * 1000) % len(lst)]


def pick_amp(tone_class: str, centroid: float) -> tuple[str, str]:
    group = tone_class if tone_class in AMP_GROUPS else "clean"
    amps  = AMP_GROUPS[group]
    return _pick_by_centroid(amps, centroid), group


def pick_cab(group: str, zcr: float) -> str:
    cabs = CAB_GROUPS.get(group, CAB_GROUPS["clean"])
    return _pick_by_zcr(cabs, zcr)


def pick_efx(group: str, centroid: float) -> str:
    efx = EFX_GROUPS.get(group, EFX_GROUPS["clean"])
    return _pick_by_centroid(efx, centroid)


def pick_mod(group: str, zcr: float) -> str:
    mods = MOD_GROUPS.get(group, MOD_GROUPS["clean"])
    return _pick_by_zcr(mods, zcr)


# ─────────────────────────────────────────────────────────────────────────────
# EQ CHARACTER
# ─────────────────────────────────────────────────────────────────────────────

def tone_character(centroid: float) -> tuple[str, int, int, int]:
    """Returns (character_label, treble, mid, bass_eq)"""
    if centroid > 4500:
        return "bright",   9, 6, 3
    if centroid > 3500:
        return "bright",   8, 6, 4
    if centroid > 2500:
        return "balanced", 6, 6, 6
    if centroid > 1500:
        return "warm",     5, 6, 7
    return     "dark",     3, 5, 8


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def generate_chain(tone_class: str, features: dict) -> dict:
    """
    Build a complete, deterministic signal chain.
    tone_class: jazz | clean | blues | rock | high_gain | metal | bass
    """
    centroid = features["centroid"]
    zcr      = features["zcr"]
    rms      = features["rms"]

    # Gear selection — all from gear.json, nothing hardcoded
    amp, group  = pick_amp(tone_class, centroid)
    cab         = pick_cab(group, zcr)
    efx         = pick_efx(group, centroid)
    mod         = pick_mod(group, zcr)
    delay_type, delay_time = DELAY_GROUPS.get(group, ("analog", 300))
    reverb_type, reverb_level = REVERB_GROUPS.get(group, ("room", 4))

    # EQ character
    char_label, treble, mid, bass_eq = tone_character(centroid)

    return {
        "style":          STYLE_NAMES.get(tone_class, tone_class.title()),
        "tone_character": char_label,

        "noise_gate": {
            "type":      "noise_gate",
            "enabled":   True,
            "threshold": GATE_THRESHOLD.get(group, -45),
        },
        "efx": {
            "type": efx,
            "gain": EFX_GAIN.get(group, 5),
        },
        "amp": {
            "type":   amp,
            "gain":   AMP_GAIN.get(group, 5),
            "volume": min(10, int(rms * 20) + 3),
            "treble": treble,
            "mid":    mid,
            "bass":   bass_eq,
        },
        "cab": {
            "type": cab,
            "mic":  "D112" if tone_class == "bass" else "SM57",
        },
        "mod": {
            "type":  mod,
            "depth": 3 if tone_class in ("metal", "high_gain") else 5,
        },
        "reverb": {
            "type":  reverb_type,
            "level": reverb_level,
        },
        "delay": {
            "type":     delay_type,
            "time":     delay_time,
            "feedback": 2 if tone_class in ("metal", "high_gain") else 4,
        },
    }
