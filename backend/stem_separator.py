"""
stem_separator.py
Wraps Demucs htdemucs_6s for guitar stem extraction.
Uses the Python API (not subprocess) for proper error handling.

htdemucs_6s separates into 6 stems:
  Index 0: drums
  Index 1: bass
  Index 2: other
  Index 3: vocals
  Index 4: guitar   ← what we want
  Index 5: piano

Model is loaded once at module level (singleton) to avoid
re-loading on every request — Demucs model is ~300MB in memory.
"""

import os
import torch
import torchaudio
import soundfile as sf
import numpy as np

# ── Lazy singleton — loaded on first call, not at import time ─────────────────
_model = None
_model_sources = None   # ordered list of stem names for htdemucs_6s

def _get_model():
    global _model, _model_sources
    if _model is None:
        from demucs.pretrained import get_model
        print("[stem_separator] Loading htdemucs_6s model…")
        _model = get_model("htdemucs_6s")
        _model.eval()
        # htdemucs_6s source order: drums, bass, other, vocals, guitar, piano
        _model_sources = list(_model.sources)
        print(f"[stem_separator] Model loaded. Sources: {_model_sources}")
    return _model, _model_sources


def separate_stems(input_path: str, output_dir: str) -> dict:
    """
    Run htdemucs_6s on input_path. Saves all 6 stems as WAV files
    into output_dir. Returns a dict mapping stem name → absolute file path.

    Args:
        input_path:  Absolute path to input audio file (wav, mp3, flac, etc.)
        output_dir:  Directory to write stem WAV files into. Created if needed.

    Returns:
        {
          "drums":  "/abs/path/to/drums.wav",
          "bass":   "/abs/path/to/bass.wav",
          "other":  "/abs/path/to/other.wav",
          "vocals": "/abs/path/to/vocals.wav",
          "guitar": "/abs/path/to/guitar.wav",
          "piano":  "/abs/path/to/piano.wav",
        }

    Raises:
        RuntimeError if separation fails.
        FileNotFoundError if input_path does not exist.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    os.makedirs(output_dir, exist_ok=True)

    model, sources = _get_model()

    # ── Load audio ────────────────────────────────────────────────────────────
    # Workaround for torchaudio/torchcodec FFmpeg loading issues on Windows.
    # Convert input to 44.1kHz stereo WAV via subprocess, then load with soundfile.
    import subprocess
    import tempfile
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
        temp_wav_path = tmp_wav.name
        
    try:
        # Convert any input format to 44.1kHz stereo WAV directly
        subprocess.run([
            "ffmpeg", "-y", "-i", input_path, 
            "-ar", "44100", "-ac", "2", 
            temp_wav_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Load using soundfile to completely bypass torchaudio backends
        waveform_np, sr = sf.read(temp_wav_path, dtype="float32", always_2d=True)
        waveform = torch.from_numpy(waveform_np.T)  # shape: [channels, samples]
    finally:
        if os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
            except:
                pass

    # Demucs expects stereo. If mono, duplicate channel.
    if waveform.shape[0] == 1:
        waveform = waveform.repeat(2, 1)
    # If more than 2 channels, take first two
    elif waveform.shape[0] > 2:
        waveform = waveform[:2, :]

    # ── Run separation ────────────────────────────────────────────────────────
    # apply_model expects shape [batch, channels, samples]
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    waveform = waveform.to(device)

    from demucs.apply import apply_model
    with torch.no_grad():
        # returns shape [batch=1, num_sources, channels, samples]
        separated = apply_model(
            model,
            waveform.unsqueeze(0),
            split=True,       # process in segments to save memory
            overlap=0.25,     # 25% overlap between segments
            progress=False,
        )[0]                  # remove batch dim → [num_sources, channels, samples]

    # ── Save stems ────────────────────────────────────────────────────────────
    stem_paths = {}
    for i, name in enumerate(sources):
        stem_waveform = separated[i].cpu()   # [channels, samples]
        out_path = os.path.join(output_dir, f"{name}.wav")

        # soundfile expects [samples, channels] — transpose
        audio_np = stem_waveform.numpy().T   # [samples, channels]

        # Clamp to [-1, 1] to prevent clipping artifacts
        audio_np = np.clip(audio_np, -1.0, 1.0)

        sf.write(out_path, audio_np, sr, subtype="PCM_16")
        stem_paths[name] = os.path.abspath(out_path)
        print(f"[stem_separator] Saved {name}: {out_path}")

    return stem_paths


def get_guitar_stem_path(stem_paths: dict) -> str:
    """
    Returns the guitar stem path from a stem_paths dict.
    Falls back to 'other' if guitar is not present (htdemucs has no guitar stem).
    Raises KeyError if neither exists.
    """
    if "guitar" in stem_paths:
        return stem_paths["guitar"]
    if "other" in stem_paths:
        print("[stem_separator] WARNING: No guitar stem found, falling back to 'other'")
        return stem_paths["other"]
    raise KeyError(f"No guitar or other stem in: {list(stem_paths.keys())}")
