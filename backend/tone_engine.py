import json
import os

_gear_path = os.path.join(os.path.dirname(__file__), "gear.json")
with open(_gear_path) as f:
    GEAR = json.load(f)


# Each group maps a tone class to the amps/cabs/efx/etc. that suit it.
# Selection within a group is deterministic: index = int(feature_value) % len(group)

AMP_GROUPS = {
    "jazz":      ["jazz_clean", "super_rvb", "stageman"],
    "clean":     ["deluxe_rvb", "hiwire", "optima_air", "stageman"],
    "blues":     ["tweedy", "class_a30", "deluxe_rvb"],
    "rock":      ["plexi_45", "plexi_100", "1987x_50", "brit_800"],
    "high_gain": ["brit_800", "cali_crunch", "dual_rect", "slo_100"],
    "metal":     ["slo_100", "fireman_hbe", "die_vh4", "dual_rect", "cali_crunch"],
    "bass":      ["bass_mate", "agl", "mld"],
}

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

EFX_GROUPS = {
    "jazz":      ["rose_comp", "rc_boost"],
    "clean":     ["rc_boost", "ac_boost"],
    "blues":     ["blues_drive", "morning_drive", "red_dirt", "t_screamer"],
    "rock":      ["crunch", "t_screamer", "morning_drive", "red_dirt", "katana"],
    "high_gain": ["dist_one", "red_dirt", "katana"],
    "metal":     ["distortion_pp", "eat_dist", "muff_fuzz", "dist_one"],
    "bass":      ["rose_comp", "katana"],
}

MOD_GROUPS = {
    "jazz":      ["ce_1", "ce_2", "sch_1"],
    "clean":     ["ce_2", "st_chorus", "u_vibe", "scf"],
    "blues":     ["vibrato", "u_vibe", "tremolo"],
    "rock":      ["phase_90", "phase_100", "tremolo"],
    "high_gain": ["flanger", "phase_100"],
    "metal":     ["flanger", "None"],
    "bass":      ["ce_1", "scf"],
}

# (delay_type, time_ms)
DELAY_GROUPS = {
    "jazz":      ("tape_echo", 350),
    "clean":     ("analog",    300),
    "blues":     ("tape_echo", 380),
    "rock":      ("mod_delay", 360),
    "high_gain": ("digital",   420),
    "metal":     ("phi_delay", 400),
    "bass":      ("None",        0),
}

# (reverb_type, level)
REVERB_GROUPS = {
    "jazz":      ("hall",   7),
    "clean":     ("spring", 6),
    "blues":     ("spring", 5),
    "rock":      ("room",   4),
    "high_gain": ("plate",  4),
    "metal":     ("plate",  3),
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


def _map_feature_to_index(value, min_val, max_val, num_items):
    norm = max(0.0, min(1.0, (value - min_val) / (max_val - min_val))) if max_val > min_val else 0.5
    idx = int(norm * num_items)
    return min(idx, num_items - 1)

def pick_amp(tone_class, centroid):
    amps = AMP_GROUPS.get(tone_class, AMP_GROUPS["clean"])
    # centroid ranges usually 500 to 5000
    idx = _map_feature_to_index(centroid, 500, 5000, len(amps))
    return amps[idx], tone_class

def pick_cab(group, zcr):
    cabs = CAB_GROUPS.get(group, CAB_GROUPS["clean"])
    # zcr ranges usually 0.01 to 0.15 for guitar
    idx = _map_feature_to_index(zcr, 0.01, 0.15, len(cabs))
    return cabs[idx]

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

def generate_chain(tone_class: str, features: dict) -> dict:
    centroid = features["centroid"]
    zcr      = features["zcr"]
    rms      = features["rms"]

    amp, group           = pick_amp(tone_class, centroid)
    cab                  = pick_cab(group, zcr)
    efx                  = pick_efx(group, centroid)
    mod                  = pick_mod(group, zcr)
    delay_type, delay_ms = DELAY_GROUPS.get(group, ("analog", 300))
    reverb_type, rev_lvl = REVERB_GROUPS.get(group, ("room", 4))
    char, treble, mid, bass_eq = tone_eq(centroid)

    return {
        "style":          STYLE_NAMES.get(tone_class, tone_class.title()),
        "tone_character": char,
        "noise_gate": {
            "type":      "noise_gate",
            "enabled":   True,
            "threshold": GATE_THR.get(group, -45),
        },
        "efx": {
            "type": format_name(efx),
            "gain": EFX_GAIN.get(group, 5),
        },
        "amp": {
            "type":   format_name(amp),
            "gain":   AMP_GAIN.get(group, 5),
            "volume": min(10, int(rms * 20) + 3),  # volume derived from track loudness
            "treble": treble,
            "mid":    mid,
            "bass":   bass_eq,
        },
        "cab": {
            "type": format_name(cab),
            "mic":  "D112" if tone_class == "bass" else "SM57",
        },
        "mod": {
            "type":  format_name(mod),
            "depth": 3 if tone_class in ("metal", "high_gain") else 5,
        },
        "reverb": {
            "type":  format_name(reverb_type),
            "level": rev_lvl,
        },
        "delay": {
            "type":     format_name(delay_type),
            "time":     delay_ms,
            "feedback": 2 if tone_class in ("metal", "high_gain") else 4,
        },
    }
