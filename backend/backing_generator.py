import os
import json
import numpy as np
import soundfile as sf
from pydub import AudioSegment

BACKING_CONFIGS = {
    "guitar": {
        "guitar": 0.20,
        "bass": 1.0,
        "drums": 1.0,
        "piano": 1.0,
        "vocals": 1.0,
        "other": 1.0
    },
    "bass": {
        "guitar": 1.0,
        "bass": 0.20,
        "drums": 1.0,
        "piano": 1.0,
        "vocals": 1.0,
        "other": 1.0
    },
    "drums": {
        "guitar": 1.0,
        "bass": 1.0,
        "drums": 0.20,
        "piano": 1.0,
        "vocals": 1.0,
        "other": 1.0
    },
    "piano": {
        "guitar": 1.0,
        "bass": 1.0,
        "drums": 1.0,
        "piano": 0.20,
        "vocals": 1.0,
        "other": 1.0
    },
    "karaoke": {
        "guitar": 1.0,
        "bass": 1.0,
        "drums": 1.0,
        "piano": 1.0,
        "vocals": 0.0,
        "other": 1.0
    }
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STEMS_DIR = os.path.join(BASE_DIR, "stems")
BACKINGS_DIR = os.path.join(BASE_DIR, "backings")


from stem_separator import separate_stems
import shutil

def generate_backing(
    input_audio_path: str,
    backing_type: str,
    job_id: str,
    base_name: str
):
    """
    Generates a backing track by separating input_audio_path and mixing stems.
    Intermediate stems are saved under a temp folder inside backings/ and then deleted.
    """

    if backing_type not in BACKING_CONFIGS:
        raise ValueError(
            f"Unsupported backing type: {backing_type}"
        )

    # Create target directory for backing track
    backing_dir = os.path.join(
        BACKINGS_DIR,
        job_id
    )
    os.makedirs(
        backing_dir,
        exist_ok=True
    )

    # Temporary directory for stems within the backing output folder
    temp_stems_dir = os.path.join(
        backing_dir,
        "temp_stems"
    )
    os.makedirs(
        temp_stems_dir,
        exist_ok=True
    )

    try:
        # 1. Run stem separation
        separate_stems(input_audio_path, temp_stems_dir, normalize=False)

        # 2. Determine stems to mix and their scales
        active_stems = []
        config = BACKING_CONFIGS[backing_type]

        for filename in os.listdir(temp_stems_dir):
            if not filename.endswith(".wav"):
                continue

            # Identify the stem type by checking suffix
            matched_stem_type = None
            for stem_type in ["drums", "bass", "other", "vocals", "guitar", "piano"]:
                if filename.endswith(f"_{stem_type}.wav"):
                    matched_stem_type = stem_type
                    break

            if matched_stem_type is None:
                continue

            scale = config.get(matched_stem_type, 1.0)
            if scale == 0.0:
                print(f"Skipping (0% volume): {filename}")
                continue

            active_stems.append((filename, scale))

        if not active_stems:
            raise RuntimeError(
                "No stems available for mixing"
            )

        print("\nMixing:")
        for stem, scale in active_stems:
            print(f"  {stem} (scale={scale})")

        # 3. Mix stems
        mix = None
        sample_rate = None

        for stem, scale in active_stems:
            stem_path = os.path.join(
                temp_stems_dir,
                stem
            )
            audio, sr = sf.read(stem_path)

            scaled_audio = audio * scale

            if mix is None:
                mix = scaled_audio.copy()
                sample_rate = sr
            else:
                mix += scaled_audio

        # Normalize
        peak = np.max(np.abs(mix))
        if peak > 1.0:
            mix = mix / peak

        # Output paths
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

        # Save WAV
        sf.write(
            wav_path,
            mix,
            sample_rate
        )

        # Save MP3
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

    finally:
        # 4. Clean up temporary stems
        if os.path.exists(temp_stems_dir):
            try:
                shutil.rmtree(temp_stems_dir)
                print(f"Cleaned up intermediate backing stems in: {temp_stems_dir}")
            except Exception as e:
                print(f"Error cleaning up intermediate backing stems: {e}")



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