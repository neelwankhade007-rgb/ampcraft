import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'

// ─────────────────────────────────────────────────────────────────────────────
// useStemMixer — DAW-style unified transport for stem playback.
//
// Architecture:
//   - ONE master timeline (globalTime / globalDuration / globalPlaying)
//   - ONE playAll() engine that schedules all stem BufferSources
//   - Audition = a mode flag (auditioningStem) that changes gain routing
//     but uses the SAME playAll engine and timeline
//   - Full mix and audition are mutually exclusive: switching between
//     them stops the current source and starts the new one at the same position
// ─────────────────────────────────────────────────────────────────────────────

export default function useStemMixer(
  audioCtxRef,
  audioBufferRef,
  audioDuration,
  stemResult,
  setSeparatorError,
  startSec = 0,
  endSec = 0,
  hasSelection = false,
  audioBuffer = null
) {
  const [mutedStems, setMutedStems] = useState({ vocals: false, guitar: false, drums: false, bass: false, piano: false, other: false })
  const [soloedStems, setSoloedStems] = useState({ vocals: false, guitar: false, drums: false, bass: false, piano: false, other: false })
  const [stemVolumes, setStemVolumes] = useState({ vocals: 1.0, guitar: 1.0, drums: 1.0, bass: 1.0, piano: 1.0, other: 1.0 })
  const [masterVolume, setMasterVolume] = useState(1.0)

  const [loadingStems, setLoadingStems] = useState(false)
  const [loadingStemsProgress, setLoadingStemsProgress] = useState(0)

  const stemBuffersRef = useRef({})
  const stemSourcesRef = useRef({})
  const stemGainsRef = useRef({})
  const masterGainNodeRef = useRef(null)
  const startTimeRef = useRef(0)
  const offsetTimeRef = useRef(0)
  const animFrameRef = useRef(null)

  const [globalPlaying, setGlobalPlaying] = useState(false)
  const [globalTime, setGlobalTime] = useState(0)
  const [globalDuration, setGlobalDuration] = useState(0)

  // Track when stem buffers are fully loaded (triggers waveform computation)
  const [stemBuffersLoaded, setStemBuffersLoaded] = useState(0)

  // Ensure Master Gain node exists and is connected
  const getMasterGainNode = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return null
    if (!masterGainNodeRef.current) {
      const gainNode = ctx.createGain()
      gainNode.gain.value = masterVolume
      gainNode.connect(ctx.destination)
      masterGainNodeRef.current = gainNode
    }
    return masterGainNodeRef.current
  }, [audioCtxRef, masterVolume])

  const handleMasterVolumeChange = useCallback((newVol) => {
    setMasterVolume(newVol)
    const ctx = audioCtxRef.current
    if (ctx && masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.setTargetAtTime(newVol, ctx.currentTime, 0.015)
    }
  }, [audioCtxRef])

  // Sync global duration when original audio duration is loaded
  useEffect(() => {
    if (audioDuration > 0) {
      setGlobalDuration(audioDuration)
    }
  }, [audioDuration])

  // Load stems if they exist
  const loadStemBuffers = useCallback(async (stems) => {
    if (!stems) {
      stemBuffersRef.current = {}
      setLoadingStems(false)
      setStemBuffersLoaded(0)
      return
    }

    setLoadingStems(true)
    setLoadingStemsProgress(0)
    const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    const names = Object.keys(stems)
    let loaded = 0

    try {
      await Promise.all(names.map(async (name) => {
        const url = `http://localhost:8000${stems[name]}`
        const response = await axios.get(url, { responseType: 'arraybuffer' })
        const buffer = await ctx.decodeAudioData(response.data)
        stemBuffersRef.current[name] = buffer
        loaded++
        setLoadingStemsProgress(loaded / names.length)
      }))
      if (names.length > 0) {
        setGlobalDuration(stemBuffersRef.current[names[0]].duration)
      }
      // Signal that buffers are ready (triggers waveform peak computation)
      setStemBuffersLoaded(prev => prev + 1)
    } catch (err) {
      console.error('Error loading stem buffers', err)
      setSeparatorError('Failed to load separated stems for playback.')
    }
    setLoadingStems(false)
  }, [audioCtxRef, setSeparatorError])

  useEffect(() => {
    if (stemResult) {
      loadStemBuffers(stemResult.stems)
    } else {
      stemBuffersRef.current = {}
      setLoadingStems(false)
      setStemBuffersLoaded(0)
    }
  }, [stemResult, loadStemBuffers])

  // ── Waveform peak data generation ─────────────────────────────────────────
  // Compute peak envelope arrays from actual AudioBuffer data.
  // Called once after stem buffers are loaded, not on every render.

  const NUM_PEAKS = 200 // number of bars for waveform visualization

  const computePeaks = useCallback((audioBuffer, numBars) => {
    if (!audioBuffer) return null
    const channel = audioBuffer.getChannelData(0) // use first channel
    const samplesPerBar = Math.floor(channel.length / numBars)
    if (samplesPerBar < 1) return null
    const peaks = new Float32Array(numBars)
    for (let i = 0; i < numBars; i++) {
      let max = 0
      const start = i * samplesPerBar
      const end = Math.min(start + samplesPerBar, channel.length)
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channel[j])
        if (abs > max) max = abs
      }
      peaks[i] = max
    }
    return peaks
  }, [])

  // Master waveform: sum of all stems (or original audio buffer)
  const waveformPeaks = useMemo(() => {
    const buffers = stemBuffersRef.current
    const names = Object.keys(buffers)

    if (names.length > 0) {
      // Sum all stems into a virtual mix, then compute peaks
      const firstBuf = buffers[names[0]]
      const length = firstBuf.length
      const mixed = new Float32Array(length)

      for (const name of names) {
        const buf = buffers[name]
        const ch = buf.getChannelData(0)
        for (let i = 0; i < Math.min(ch.length, length); i++) {
          mixed[i] += ch[i]
        }
      }

      // Compute peaks from the summed mix
      const samplesPerBar = Math.floor(length / NUM_PEAKS)
      if (samplesPerBar < 1) return null
      const peaks = new Float32Array(NUM_PEAKS)
      for (let i = 0; i < NUM_PEAKS; i++) {
        let max = 0
        const start = i * samplesPerBar
        const end = Math.min(start + samplesPerBar, length)
        for (let j = start; j < end; j++) {
          const abs = Math.abs(mixed[j])
          if (abs > max) max = abs
        }
        peaks[i] = max
      }
      return peaks
    }

    // Fall back to original audio buffer if no stems
    const activeBuf = audioBuffer || audioBufferRef.current
    if (activeBuf) {
      return computePeaks(activeBuf, NUM_PEAKS)
    }

    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stemBuffersLoaded, audioBuffer, computePeaks])

  // Per-stem waveform peaks
  const stemWaveforms = useMemo(() => {
    const buffers = stemBuffersRef.current
    const names = Object.keys(buffers)
    if (names.length === 0) return {}

    const result = {}
    for (const name of names) {
      result[name] = computePeaks(buffers[name], 120) // fewer bars for mini waveforms
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stemBuffersLoaded, computePeaks])

  // ── Transport ─────────────────────────────────────────────────────────────

  // Get the current master position (works whether playing or paused)
  const getCurrentPosition = useCallback(() => {
    if (globalPlaying && audioCtxRef.current) {
      return audioCtxRef.current.currentTime - startTimeRef.current + offsetTimeRef.current
    }
    return offsetTimeRef.current
  }, [globalPlaying, audioCtxRef])

  // Pause: stop all sources, preserve position
  const pauseAll = useCallback(() => {
    // Save position BEFORE stopping sources
    if (globalPlaying && audioCtxRef.current) {
      const pos = audioCtxRef.current.currentTime - startTimeRef.current + offsetTimeRef.current
      offsetTimeRef.current = pos
      setGlobalTime(pos)
    }
    Object.values(stemSourcesRef.current).forEach(s => {
      try { s.stop() } catch (e) {}
    })
    stemSourcesRef.current = {}
    setGlobalPlaying(false)
  }, [globalPlaying, audioCtxRef])

  // Unified playback progress timeline loop
  useEffect(() => {
    const updateProgress = () => {
      if (globalPlaying && audioCtxRef.current) {
        let current = audioCtxRef.current.currentTime - startTimeRef.current + offsetTimeRef.current

        // Stop if range selection exists and we exceed endSec
        if (hasSelection && current >= endSec) {
          current = startSec
          // Inline pause (can't call pauseAll due to closure)
          Object.values(stemSourcesRef.current).forEach(s => {
            try { s.stop() } catch (e) {}
          })
          stemSourcesRef.current = {}
          setGlobalPlaying(false)
          setGlobalTime(startSec)
          offsetTimeRef.current = startSec
          return
        }

        if (current >= globalDuration && globalDuration > 0) {
          current = 0
          Object.values(stemSourcesRef.current).forEach(s => {
            try { s.stop() } catch (e) {}
          })
          stemSourcesRef.current = {}
          setGlobalPlaying(false)
          offsetTimeRef.current = 0
        }

        setGlobalTime(current)
        animFrameRef.current = requestAnimationFrame(updateProgress)
      }
    }
    if (globalPlaying) {
      animFrameRef.current = requestAnimationFrame(updateProgress)
    }
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [globalPlaying, globalDuration, audioCtxRef, hasSelection, startSec, endSec])

  // Apply real-time volume/mute/solo adjustments to stems
  useEffect(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return

    const hasAnySolo = Object.values(soloedStems).some(v => Boolean(v))
    Object.keys(stemGainsRef.current).forEach(name => {
      const gain = stemGainsRef.current[name]
      if (gain) {
        // Mute has priority over solo!
        const isMuted = mutedStems[name] || (hasAnySolo && !soloedStems[name])
        gain.gain.setTargetAtTime(isMuted ? 0 : (stemVolumes[name] ?? 1.0), ctx.currentTime, 0.015)
      }
    })
  }, [mutedStems, soloedStems, stemVolumes, audioCtxRef])

  // Play audio — schedules all stems (or original buffer) from a given offset.
  const playAll = useCallback((offset) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    // Stop any existing sources without saving position (we already have offset)
    Object.values(stemSourcesRef.current).forEach(s => {
      try { s.stop() } catch (e) {}
    })
    stemSourcesRef.current = {}

    const masterGain = getMasterGainNode() || ctx.destination
    const names = Object.keys(stemBuffersRef.current)
    const hasAnySolo = Object.values(soloedStems).some(v => Boolean(v))

    if (names.length > 0) {
      // Stems playback — schedule ALL stems, let gain nodes handle mute/solo
      names.forEach(name => {
        const source = ctx.createBufferSource()
        const gainNode = ctx.createGain()
        source.buffer = stemBuffersRef.current[name]

        const isMuted = mutedStems[name] || (hasAnySolo && !soloedStems[name])
        gainNode.gain.value = isMuted ? 0 : (stemVolumes[name] ?? 1.0)

        source.connect(gainNode)
        gainNode.connect(masterGain)
        source.start(0, offset)
        stemSourcesRef.current[name] = source
        stemGainsRef.current[name] = gainNode
      })
    } else if (audioBufferRef.current) {
      // Original raw song playback (pre-separation)
      const source = ctx.createBufferSource()
      source.buffer = audioBufferRef.current
      source.connect(masterGain)
      source.start(0, offset)
      stemSourcesRef.current['original'] = source
    }

    startTimeRef.current = ctx.currentTime
    offsetTimeRef.current = offset
    setGlobalPlaying(true)
  }, [audioCtxRef, audioBufferRef, mutedStems, soloedStems, stemVolumes, getMasterGainNode])

  // ── Global Play/Pause Toggle ──────────────────────────────────────────────
  const handleGlobalPlayToggle = useCallback(() => {
    if (globalPlaying) {
      pauseAll()
    } else {
      let playOffset = offsetTimeRef.current
      if (hasSelection && (playOffset < startSec || playOffset > endSec)) {
        playOffset = startSec
        setGlobalTime(startSec)
      }
      playAll(playOffset)
    }
  }, [globalPlaying, playAll, pauseAll, hasSelection, startSec, endSec])

  // ── Restart Playback (0:00) ────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    if (globalPlaying) {
      Object.values(stemSourcesRef.current).forEach(s => {
        try { s.stop() } catch (e) {}
      })
      stemSourcesRef.current = {}
      offsetTimeRef.current = 0
      setGlobalTime(0)
      playAll(0)
    } else {
      offsetTimeRef.current = 0
      setGlobalTime(0)
    }
  }, [globalPlaying, playAll])

  // ── Seek ──────────────────────────────────────────────────────────────────
  const handleGlobalSeek = useCallback((timeOrEvent) => {
    const time = typeof timeOrEvent === 'number' ? timeOrEvent : parseFloat(timeOrEvent?.target?.value || 0)
    setGlobalTime(time)
    offsetTimeRef.current = time
    if (globalPlaying) playAll(time)
  }, [globalPlaying, playAll])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetMixer = useCallback(() => {
    Object.values(stemSourcesRef.current).forEach(s => {
      try { s.stop() } catch (e) {}
    })
    stemSourcesRef.current = {}
    setGlobalPlaying(false)
    stemBuffersRef.current = {}
    setGlobalTime(0)
    setGlobalDuration(0)
    offsetTimeRef.current = 0
    setStemBuffersLoaded(0)
  }, [])

  return {
    mutedStems,
    soloedStems,
    stemVolumes,
    masterVolume,
    loadingStems,
    loadingStemsProgress,
    globalPlaying,
    globalTime,
    globalDuration,
    waveformPeaks,
    setMutedStems,
    setSoloedStems,
    setStemVolumes,
    setMasterVolume,
    handleMasterVolumeChange,
    pauseAll,
    playAll,
    handleGlobalPlayToggle,
    handleRestart,
    handleGlobalSeek,
    resetMixer,
  }
}
