import os
import json
import numpy as np
import soundfile as sf
from pydub import AudioSegment

PRESETS = {
    "guitar": "guitar",
    "bass": "bass",
    "drums": "drums",
    "piano": "piano",
    "karaoke": "vocals",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STEMS_DIR = os.path.join(BASE_DIR, "stems")
BACKINGS_DIR = os.path.join(BASE_DIR, "backings")


def generate_backing(
    job_id: str,
    backing_type: str
):
    """
    Generates a backing track from existing stems.

    Requires:
        stems/<job_id>/

    Produces:
        backings/<job_id>/
    """

    if backing_type not in PRESETS:
        raise ValueError(
            f"Unsupported backing type: {backing_type}"
        )

    muted_stem = PRESETS[backing_type]

    # --------------------------------------------------
    # Verify stems exist
    # --------------------------------------------------

    stems_dir = os.path.join(
        STEMS_DIR,
        job_id
    )

    if not os.path.exists(stems_dir):
        raise FileNotFoundError(
            f"Stems not found for job {job_id}. "
            f"Separate stems first."
        )

    # --------------------------------------------------
    # Read metadata
    # --------------------------------------------------

    meta_path = os.path.join(
        stems_dir,
        "meta.json"
    )

    if not os.path.exists(meta_path):
        raise FileNotFoundError(
            f"meta.json missing for job {job_id}"
        )

    with open(meta_path, "r") as f:
        meta = json.load(f)

    base_name = meta["base_name"]

    # --------------------------------------------------
    # Determine stems to mix
    # --------------------------------------------------

    active_stems = []

    for filename in os.listdir(stems_dir):

        if not filename.endswith(".wav"):
            continue

        stem_name = filename.replace(".wav", "")

        # Supports:
        # guitar.wav
        # Song_guitar.wav

        if (
            stem_name == muted_stem
            or stem_name.endswith(f"_{muted_stem}")
        ):
            print(f"Skipping: {filename}")
            continue

        active_stems.append(filename)

    if not active_stems:
        raise RuntimeError(
            "No stems available for mixing"
        )

    print("\nMixing:")
    for stem in active_stems:
        print(f"  {stem}")

    # --------------------------------------------------
    # Mix stems
    # --------------------------------------------------

    mix = None
    sample_rate = None

    for stem in active_stems:

        stem_path = os.path.join(
            stems_dir,
            stem
        )

        audio, sr = sf.read(stem_path)

        if mix is None:
            mix = audio.copy()
            sample_rate = sr
        else:
            mix += audio

    # --------------------------------------------------
    # Normalize
    # --------------------------------------------------

    peak = np.max(np.abs(mix))

    if peak > 1.0:
        mix = mix / peak

    # --------------------------------------------------
    # Create output folder
    # --------------------------------------------------

    backing_dir = os.path.join(
        BACKINGS_DIR,
        job_id
    )

    os.makedirs(
        backing_dir,
        exist_ok=True
    )

    # --------------------------------------------------
    # Output paths
    # --------------------------------------------------

    wav_filename = (
        f"{base_name}_{backing_type}_backing.wav"
    )

    mp3_filename = (
        f"{base_name}_{backing_type}_backing.mp3"
    )

    wav_path = os.path.join(
        backing_dir,
        wav_filename
    )

    mp3_path = os.path.join(
        backing_dir,
        mp3_filename
    )

    if os.path.exists(wav_path) and os.path.exists(mp3_path):
        print("\nBacking track already exists. Returning cached files:")
        print(wav_path)
        print(mp3_path)
        return {
            "job_id": job_id,
            "backing_type": backing_type,
            "wav_path": wav_path,
            "mp3_path": mp3_path,
        }

    # --------------------------------------------------
    # Save WAV
    # --------------------------------------------------

    sf.write(
        wav_path,
        mix,
        sample_rate
    )

    # --------------------------------------------------
    # Save MP3
    # --------------------------------------------------

    AudioSegment.from_wav(wav_path).export(
        mp3_path,
        format="mp3",
        bitrate="320k"
    )

    print("\nGenerated:")
    print(wav_path)
    print(mp3_path)

    return {
        "job_id": job_id,
        "backing_type": backing_type,
        "wav_path": wav_path,
        "mp3_path": mp3_path,
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python backing_generator.py <job_id> <backing_type>")
        sys.exit(1)

    result = generate_backing(
        job_id=sys.argv[1],
        backing_type=sys.argv[2]
    )

    print(result)