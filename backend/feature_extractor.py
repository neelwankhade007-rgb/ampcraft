import os
import json
import numpy as np
import librosa
import soundfile as sf
from scipy.stats import skew, kurtosis

class GuitarToneFeatureExtractor:
    """
    A comprehensive audio feature extractor designed specifically for guitar tone analysis.
    Extracts features across three distinct layers:
    1. Raw librosa features (Time, Spectral, Cepstral, Chroma, Pitch, Harmony, Rhythm)
    2. Custom DSP features (Band energies, crest factor, clipping, spectral slope)
    3. Music-aware features (Brightness, Warmth, Gain, Presence, Fizz, Sustain, Compression)
    """

    def __init__(self, sample_rate=22050):
        self.sr = sample_rate

    def load_audio(self, audio_path, duration=None, offset=0.0):
        """Loads an audio file and returns the time-series y and sample rate sr."""
        y, sr = librosa.load(audio_path, sr=self.sr, duration=duration, offset=offset)
        return y, sr

    def extract_features(self, y, sr=None):
        """
        Extracts all layers of features from the audio signal.
        Returns a structured dictionary containing all metrics.
        """
        if sr is None:
            sr = self.sr

        # Precompute short-time Fourier transform (STFT) and magnitude
        stft_matrix = librosa.stft(y)
        stft_mag = np.abs(stft_matrix)
        stft_phase = np.angle(stft_matrix)

        # -------------------------------------------------------------
        # LAYER 1: Raw Librosa Features
        # -------------------------------------------------------------
        
        # --- Time Domain ---
        rms = librosa.feature.rms(y=y)[0]
        zcr = librosa.feature.zero_crossing_rate(y=y)[0]
        
        # --- Spectral Features ---
        centroid = librosa.feature.spectral_centroid(S=stft_mag, sr=sr)[0]
        centroid_var = float(np.var(centroid))
        
        bandwidth = librosa.feature.spectral_bandwidth(S=stft_mag, sr=sr)[0]
        contrast = librosa.feature.spectral_contrast(S=stft_mag, sr=sr)
        flatness = librosa.feature.spectral_flatness(S=stft_mag)[0]
        
        rolloff_85 = librosa.feature.spectral_rolloff(S=stft_mag, sr=sr, roll_percent=0.85)[0]
        rolloff_95 = librosa.feature.spectral_rolloff(S=stft_mag, sr=sr, roll_percent=0.95)[0]
        
        # Spectral Flux (manual computation is more direct than onset strength for exact flux)
        # Flux is the frame-to-frame difference in magnitude spectrum
        spectral_flux = np.zeros(stft_mag.shape[1])
        if stft_mag.shape[1] > 1:
            diff = np.diff(stft_mag, axis=1)
            # Only keep positive changes (half-wave rectification)
            diff = np.maximum(0, diff)
            spectral_flux[1:] = np.sum(diff, axis=0)

        # --- Cepstral Features (MFCCs) ---
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        delta_mfccs = librosa.feature.delta(mfccs)
        delta2_mfccs = librosa.feature.delta(mfccs, order=2)

        # --- Chroma Features ---
        chroma_stft = librosa.feature.chroma_stft(S=stft_mag, sr=sr)
        
        # CQT and CENS can fail on very short audio or raise warnings if parameters don't fit.
        # We wrap them with a fallback or safeguard.
        try:
            chroma_cqt = librosa.feature.chroma_cqt(y=y, sr=sr)
        except Exception:
            # Fallback to STFT chroma if CQT fails (e.g., input too short)
            chroma_cqt = chroma_stft
            
        try:
            chroma_cens = librosa.feature.chroma_cens(y=y, sr=sr)
        except Exception:
            chroma_cens = chroma_stft

        # --- Tonnetz ---
        try:
            tonnetz = librosa.feature.tonnetz(y=y, sr=sr)
        except Exception:
            tonnetz = np.zeros((6, stft_mag.shape[1]))

        # --- Tempogram & Rhythm ---
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        try:
            tempogram = librosa.feature.tempogram(onset_envelope=onset_env, sr=sr)
            fourier_temp = librosa.feature.fourier_tempogram(onset_envelope=onset_env, sr=sr)
            # Find tempo
            tempo_result = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
            # In librosa v0.10.x, beat_track returns (tempo, beats) or a numpy array depending on version
            if isinstance(tempo_result, tuple):
                tempo = float(tempo_result[0])
            else:
                tempo = float(tempo_result)
        except Exception:
            tempogram = np.zeros((384, stft_mag.shape[1]))
            fourier_temp = np.zeros((193, stft_mag.shape[1]))
            tempo = 120.0

        # --- Harmonic/Percussive Separation ---
        y_harmonic, y_percussive = librosa.effects.hpss(y)
        rms_harmonic = librosa.feature.rms(y=y_harmonic)[0]
        rms_percussive = librosa.feature.rms(y=y_percussive)[0]

        # --- Pitch (YIN / pYIN) ---
        # pyin is excellent but slow/sensitive to noise. Yin is faster and reliable for guitar.
        # We will try pyin first, fallback to yin, fallback to a zero array.
        f0 = None
        voiced_flag = None
        voiced_prob = None
        
        try:
            # Estimate pitch using YIN (fast and stable)
            f0 = librosa.yin(y, fmin=librosa.note_to_hz('E2'), fmax=librosa.note_to_hz('E6'), sr=sr)
            # Replace NaNs or infinite values if any
            f0 = np.nan_to_num(f0, nan=0.0)
        except Exception:
            f0 = np.zeros(stft_mag.shape[1])

        # --- Constant-Q Transform stats ---
        try:
            cqt_mag = np.abs(librosa.cqt(y, sr=sr))
            cqt_mean = np.mean(cqt_mag, axis=1)
            cqt_std = np.std(cqt_mag, axis=1)
        except Exception:
            cqt_mean = np.zeros(84)
            cqt_std = np.zeros(84)

        # --- STFT / Spectrogram Statistics ---
        # Mean, Std, Max, Min across frequency bins for each time frame
        stft_bin_means = np.mean(stft_mag, axis=1)
        stft_bin_stds = np.std(stft_mag, axis=1)
        stft_bin_maxs = np.max(stft_mag, axis=1)
        stft_bin_mins = np.min(stft_mag, axis=1)

        # --- Mel Spectrogram ---
        mel_spec = librosa.feature.melspectrogram(y=y, sr=sr)
        mel_means = np.mean(mel_spec, axis=1)
        mel_stds = np.std(mel_spec, axis=1)
        # Avoid division by zero in skewness/kurtosis
        mel_skews = skew(mel_spec, axis=1)
        mel_kurt = kurtosis(mel_spec, axis=1)

        # --- Poly Features ---
        try:
            poly_feats = librosa.feature.poly_features(S=stft_mag, sr=sr, order=1)
            poly_slope = poly_feats[0]  # First-order coefficient is the slope
            poly_intercept = poly_feats[1]
        except Exception:
            poly_slope = np.zeros(stft_mag.shape[1])
            poly_intercept = np.zeros(stft_mag.shape[1])

        # --- Spectral Statistics (Temporal statistics of the spectrum) ---
        # Calculate statistical descriptors of the spectral shape per frame
        # We treat the normalized magnitude spectrum as a probability distribution
        freqs = librosa.fft_frequencies(sr=sr)
        
        # Prevent division by zero
        mag_sum = np.sum(stft_mag, axis=0)
        mag_sum_safe = np.where(mag_sum == 0, 1.0, mag_sum)
        
        # Calculate shape characteristics
        spectral_centroid_calc = np.sum(stft_mag * freqs[:, np.newaxis], axis=0) / mag_sum_safe
        
        # Variance / Spread
        diff_sq = (freqs[:, np.newaxis] - spectral_centroid_calc[np.newaxis, :]) ** 2
        spectral_variance = np.sum(stft_mag * diff_sq, axis=0) / mag_sum_safe
        spectral_std = np.sqrt(spectral_variance)
        
        # Skewness (3rd standardized moment)
        diff_cube = (freqs[:, np.newaxis] - spectral_centroid_calc[np.newaxis, :]) ** 3
        spectral_skewness = (np.sum(stft_mag * diff_cube, axis=0) / mag_sum_safe) / (spectral_std ** 3 + 1e-8)
        
        # Kurtosis (4th standardized moment)
        diff_fourth = (freqs[:, np.newaxis] - spectral_centroid_calc[np.newaxis, :]) ** 4
        spectral_kurtosis = (np.sum(stft_mag * diff_fourth, axis=0) / mag_sum_safe) / (spectral_std ** 4 + 1e-8) - 3.0

        # -------------------------------------------------------------
        # LAYER 2: Custom DSP Features
        # -------------------------------------------------------------
        
        # --- Band Energies ---
        # Define frequency bands for guitar tone
        bands = {
            "sub_bass": (0, 60),
            "bass": (60, 250),
            "low_mid": (250, 500),
            "mid": (500, 2000),
            "presence_mid": (2000, 4000),
            "brilliance": (4000, 6000),
            "fizz_high": (6000, sr / 2)
        }
        
        band_energies = {}
        total_energy = np.sum(stft_mag ** 2, axis=0)
        total_energy_mean = np.mean(total_energy) + 1e-8
        
        for band_name, (f_min, f_max) in bands.items():
            # Get indexes corresponding to frequencies
            idx = np.where((freqs >= f_min) & (freqs <= f_max))[0]
            if len(idx) > 0:
                band_energy = np.sum(stft_mag[idx, :] ** 2, axis=0)
                band_energies[band_name] = {
                    "raw_mean": float(np.mean(band_energy)),
                    "relative_mean": float(np.mean(band_energy) / total_energy_mean)
                }
            else:
                band_energies[band_name] = {"raw_mean": 0.0, "relative_mean": 0.0}

        # --- Clipping Percentage ---
        # Percentage of samples that hit close to digital ceiling (representing hard clipping distortion)
        clipping_threshold = 0.98
        clipping_pct = float(np.sum(np.abs(y) >= clipping_threshold) / len(y))

        # --- Crest Factor ---
        peak_amp = float(np.max(np.abs(y)))
        rms_mean = float(np.mean(rms))
        crest_factor = float(peak_amp / (rms_mean + 1e-8))

        # --- Dynamic Range ---
        # Ratio of 99th percentile amplitude to the noise floor (estimated from 1st percentile amplitude) in dB
        amp_envelope = np.abs(y)
        p99 = np.percentile(amp_envelope, 99)
        p1 = np.percentile(amp_envelope, 1)
        dynamic_range_db = float(20 * np.log10((p99 + 1e-8) / (p1 + 1e-8)))

        # --- Harmonic-to-Noise Ratio (HNR) ---
        # An approximation derived from autocorrelation
        autocorr = librosa.autocorrelate(y)
        if len(autocorr) > 1 and autocorr[0] > 0:
            # Find the first peak after the first zero crossing or minimum
            zero_crossings = np.where(np.diff(np.sign(autocorr)))[0]
            if len(zero_crossings) > 0:
                first_zero = zero_crossings[0]
                peak_idx = np.argmax(autocorr[first_zero:]) + first_zero
                r_xx = autocorr[peak_idx] / autocorr[0]
                # Avoid log of <= 0
                r_xx = max(1e-4, min(0.9999, r_xx))
                hnr_est = float(10 * np.log10(r_xx / (1 - r_xx)))
            else:
                hnr_est = 0.0
        else:
            hnr_est = 0.0

        # --- Spectral Slope ---
        # Manual linear regression fit on mean spectral magnitude to find global spectral slope
        mean_spectrum = np.mean(stft_mag, axis=1)
        log_freqs = np.log10(freqs + 1.0)
        # Avoid NaN in fit
        slope, intercept = np.polyfit(log_freqs, mean_spectrum, 1)
        spectral_slope = float(slope)

        # -------------------------------------------------------------
        # LAYER 3: Music-Aware Features (High-level descriptors)
        # -------------------------------------------------------------
        
        # 1. Brightness
        # High relative energy above 2kHz vs below 2kHz, combined with spectral centroid
        high_freq_energy = band_energies["presence_mid"]["raw_mean"] + band_energies["brilliance"]["raw_mean"] + band_energies["fizz_high"]["raw_mean"]
        low_freq_energy = band_energies["sub_bass"]["raw_mean"] + band_energies["bass"]["raw_mean"] + band_energies["low_mid"]["raw_mean"]
        brightness_ratio = high_freq_energy / (low_freq_energy + 1e-8)
        norm_centroid = float(np.mean(centroid) / (sr / 2))
        music_brightness = float(0.4 * norm_centroid + 0.6 * min(1.0, brightness_ratio / 0.5))

        # 2. Warmth
        # Relies on the low-mid (250-500Hz) and bass (60-250Hz) energy relative to upper mids/presence,
        # combined with a lack of fizz/highs.
        warmth_ratio = (band_energies["bass"]["relative_mean"] + band_energies["low_mid"]["relative_mean"]) / (band_energies["presence_mid"]["relative_mean"] + band_energies["brilliance"]["relative_mean"] + 1e-8)
        music_warmth = float(min(1.0, warmth_ratio / 3.0))

        # 3. Gain / Distortion Level
        # Estimated using flatness (high flat = more distorted/noisy), clipping percentage,
        # crest factor (lower crest factor = more compressed/distorted), and HNR (lower HNR = more distortion)
        # We map these to a 0.0 to 1.0 index
        norm_flatness = float(min(1.0, np.mean(flatness) / 0.1))
        norm_crest = float(max(0.0, 1.0 - (crest_factor / 15.0))) # 1.0 is highly compressed (distorted)
        norm_clipping = float(min(1.0, clipping_pct / 0.05))
        music_gain = float(0.3 * norm_flatness + 0.3 * norm_crest + 0.4 * norm_clipping)

        # 4. Presence
        # The specific bite in the 2kHz-4kHz range. We look at relative presence_mid energy.
        music_presence = float(min(1.0, band_energies["presence_mid"]["relative_mean"] / 0.15))

        # 5. Fizz
        # High-frequency harshness (above 6kHz).
        fizz_ratio = band_energies["fizz_high"]["relative_mean"]
        # Distorted fizz is often flat/noisy in high frequencies
        music_fizz = float(min(1.0, fizz_ratio / 0.08))

        # 6. Sustain
        # How slowly the energy decays. We look at the RMS variance normalized by the mean.
        # Standard deviation divided by the mean (Coefficient of Variation).
        # A sustained signal has low RMS variability over its active duration.
        rms_active = rms[rms > (np.max(rms) * 0.05)] # Focus only on active playing portions
        if len(rms_active) > 0:
            rms_cv = np.std(rms_active) / (np.mean(rms_active) + 1e-8)
            # A low CV (variance) implies high sustain (volume stays level)
            music_sustain = float(max(0.0, 1.0 - (rms_cv / 1.5)))
        else:
            music_sustain = 0.0

        # 7. Compression
        # Derived from Crest Factor and variance of RMS energy
        # A heavily compressed tone has a narrow dynamic range and low peak-to-RMS ratio.
        music_compression = float(0.5 * norm_crest + 0.5 * (1.0 - min(1.0, np.var(rms) / 0.02)))

        # Build feature dictionary
        features = {
            "metadata": {
                "sample_rate": sr,
                "duration_seconds": float(len(y) / sr),
                "num_samples": len(y)
            },
            "raw_librosa": {
                "rms": {
                    "mean": float(np.mean(rms)),
                    "std": float(np.std(rms)),
                    "max": float(np.max(rms))
                },
                "zero_crossing_rate": {
                    "mean": float(np.mean(zcr)),
                    "std": float(np.std(zcr))
                },
                "spectral_centroid": {
                    "mean": float(np.mean(centroid)),
                    "variance": centroid_var
                },
                "spectral_bandwidth": {
                    "mean": float(np.mean(bandwidth)),
                    "std": float(np.std(bandwidth))
                },
                "spectral_contrast": {
                    "bands_mean": [float(val) for val in np.mean(contrast, axis=1)]
                },
                "spectral_flatness": {
                    "mean": float(np.mean(flatness))
                },
                "spectral_rolloff_85": {
                    "mean": float(np.mean(rolloff_85))
                },
                "spectral_rolloff_95": {
                    "mean": float(np.mean(rolloff_95))
                },
                "spectral_flux": {
                    "mean": float(np.mean(spectral_flux)),
                    "std": float(np.std(spectral_flux))
                },
                "mfcc": {
                    "means": [float(val) for val in np.mean(mfccs, axis=1)],
                    "stds": [float(val) for val in np.std(mfccs, axis=1)]
                },
                "delta_mfcc": {
                    "means": [float(val) for val in np.mean(delta_mfccs, axis=1)]
                },
                "delta2_mfcc": {
                    "means": [float(val) for val in np.mean(delta2_mfccs, axis=1)]
                },
                "chroma_stft": {
                    "means": [float(val) for val in np.mean(chroma_stft, axis=1)]
                },
                "chroma_cqt": {
                    "means": [float(val) for val in np.mean(chroma_cqt, axis=1)]
                },
                "chroma_cens": {
                    "means": [float(val) for val in np.mean(chroma_cens, axis=1)]
                },
                "tonnetz": {
                    "means": [float(val) for val in np.mean(tonnetz, axis=1)]
                },
                "rhythm": {
                    "tempo": tempo,
                    "onset_strength_mean": float(np.mean(onset_env))
                },
                "separation": {
                    "harmonic_rms_mean": float(np.mean(rms_harmonic)),
                    "percussive_rms_mean": float(np.mean(rms_percussive))
                },
                "pitch": {
                    "f0_mean_active": float(np.mean(f0[f0 > 0])) if np.any(f0 > 0) else 0.0,
                    "f0_std_active": float(np.std(f0[f0 > 0])) if np.any(f0 > 0) else 0.0
                },
                "cqt": {
                    "means": [float(val) for val in cqt_mean],
                    "stds": [float(val) for val in cqt_std]
                },
                "stft_stats": {
                    "means_summary": float(np.mean(stft_bin_means)),
                    "stds_summary": float(np.mean(stft_bin_stds))
                },
                "mel_stats": {
                    "means": [float(val) for val in mel_means],
                    "stds": [float(val) for val in mel_stds],
                    "skews": [float(val) for val in mel_skews],
                    "kurtosis": [float(val) for val in mel_kurt]
                },
                "poly_features": {
                    "slope_mean": float(np.mean(poly_slope)),
                    "intercept_mean": float(np.mean(poly_intercept))
                },
                "spectral_stats": {
                    "centroid_mean": float(np.mean(spectral_centroid_calc)),
                    "variance_mean": float(np.mean(spectral_variance)),
                    "skewness_mean": float(np.mean(spectral_skewness)),
                    "kurtosis_mean": float(np.mean(spectral_kurtosis))
                }
            },
            "custom_dsp": {
                "band_energies": band_energies,
                "clipping_percentage": clipping_pct,
                "crest_factor": crest_factor,
                "dynamic_range_db": dynamic_range_db,
                "hnr_est_db": hnr_est,
                "spectral_slope": spectral_slope
            },
            "music_aware": {
                "brightness": music_brightness,
                "warmth": music_warmth,
                "gain_level": music_gain,
                "presence": music_presence,
                "fizz": music_fizz,
                "sustain": music_sustain,
                "compression": music_compression
            }
        }

        return features

    def extract_from_file(self, file_path, duration=None, offset=0.0):
        """Loads an audio file and extracts the features."""
        y, sr = self.load_audio(file_path, duration=duration, offset=offset)
        return self.extract_features(y, sr)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Guitar Tone Feature Extractor")
    parser.add_argument("audio_path", type=str, help="Path to input guitar audio file")
    parser.add_argument("--output", "-o", type=str, default=None, help="Path to save JSON feature output")
    parser.add_argument("--duration", "-d", type=float, default=None, help="Duration to analyze in seconds")
    parser.add_argument("--offset", type=float, default=0.0, help="Offset to start analysis in seconds")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.audio_path):
        print(f"Error: Audio file not found at {args.audio_path}")
        exit(1)
        
    print(f"Extracting features from: {args.audio_path}...")
    extractor = GuitarToneFeatureExtractor()
    features = extractor.extract_from_file(args.audio_path, duration=args.duration, offset=args.offset)
    
    # Pretty print the high-level Music-Aware features and custom DSP features
    print("\n=== Music-Aware Descriptors ===")
    for k, v in features["music_aware"].items():
        print(f"{k.capitalize():<15}: {v:.3f}")
        
    print("\n=== Custom DSP Descriptors ===")
    print(f"{'Clipping Pct':<15}: {features['custom_dsp']['clipping_percentage']*100:.3f}%")
    print(f"{'Crest Factor':<15}: {features['custom_dsp']['crest_factor']:.3f}")
    print(f"{'Dynamic Range':<15}: {features['custom_dsp']['dynamic_range_db']:.3f} dB")
    print(f"{'Est HNR':<15}: {features['custom_dsp']['hnr_est_db']:.3f} dB")
    print(f"{'Spectral Slope':<15}: {features['custom_dsp']['spectral_slope']:.3f}")
    
    if args.output:
        with open(args.output, "w") as f:
            json.dump(features, f, indent=4)
        print(f"\nAll features successfully saved to {args.output}")
