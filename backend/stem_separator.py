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


def separate_stems(input_path: str, output_dir: str, normalize: bool = True) -> dict:
    """
    Run htdemucs_6s on input_path. Saves all 6 stems as WAV files
    into output_dir. Returns a dict mapping stem name → absolute file path.

    Args:
        input_path:  Absolute path to input audio file (wav, mp3, flac, etc.)
        output_dir:  Directory to write stem WAV files into. Created if needed.
        normalize:   If True, normalizes present stems to 0.95 peak volume.

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

    base_name = os.path.splitext(
        os.path.basename(input_path)
    )[0]

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
    # Compute the original mix RMS as a reference level.
    # We use this to decide whether each stem has real content or is just
    # the low-level residual noise Demucs produces for absent instruments.
    mix_rms = float(torch.sqrt(torch.mean(waveform.float() ** 2)).item())
    print(f"[stem_separator] Mix RMS: {mix_rms:.5f}")

    # Thresholds (relative to mix RMS):
    #   > 3%  → stem has real content, normalize to a comfortable listening level
    #   1–3%  → weak presence, keep the raw Demucs output without any boost
    #   < 1%  → instrument is absent, silence it to eliminate hiss
    PRESENT_THRESHOLD = 0.03   # 3 % of mix RMS
    ABSENT_THRESHOLD  = 0.01   # 1 % of mix RMS

    stem_paths = {}
    for i, name in enumerate(sources):
        stem_waveform = separated[i].cpu()   # [channels, samples]
        wav_path = os.path.join(
            output_dir,
            f"{base_name}_{name}.wav"
        )

        mp3_path = os.path.join(
            output_dir,
            f"{base_name}_{name}.mp3"
        )

        # soundfile expects [samples, channels] — transpose
        audio_np = stem_waveform.numpy().T   # [samples, channels]

        stem_rms = float(np.sqrt(np.mean(audio_np ** 2)))
        max_val  = float(np.max(np.abs(audio_np)))

        print(f"[stem_separator] {name}: stem_rms={stem_rms:.5f}  mix_rms={mix_rms:.5f}  ratio={stem_rms/max(mix_rms,1e-9):.3f}")

        if normalize and stem_rms > PRESENT_THRESHOLD * mix_rms and max_val > 1e-4:
            # Instrument is present — normalize to a clear listening level
            audio_np = (audio_np / max_val) * 0.95
        elif stem_rms < ABSENT_THRESHOLD * mix_rms:
            # Instrument is absent — zero out to prevent hiss
            # (Demucs residual noise amplified by normalization was the cause)
            audio_np = np.zeros_like(audio_np)
            print(f"[stem_separator] {name}: silenced (absent instrument)")
        # else: weak presence — keep at natural Demucs output level, no boost

        # Clamp to [-1, 1] to prevent clipping artifacts
        audio_np = np.clip(audio_np, -1.0, 1.0)

        # Write temporary WAV first (lossless intermediate for ffmpeg)
        sf.write(wav_path, audio_np, sr, subtype="PCM_16")

        # Transcode to 320 kbps MP3 — ~10x smaller than WAV, no audible quality loss
        subprocess.run([
            "ffmpeg", "-y", "-i", wav_path,
            "-codec:a", "libmp3lame", "-qscale:a", "0",  # VBR V0 ≈ 320kbps
            "-ar", str(sr),
            mp3_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Keep both WAV and MP3 on disk so callers can choose the format
        stem_paths[name] = {"wav": os.path.abspath(wav_path), "mp3": os.path.abspath(mp3_path)}
        print(f"[stem_separator] Saved {name}: wav + mp3")

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
