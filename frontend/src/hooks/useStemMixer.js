import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'

// ─────────────────────────────────────────────────────────────────────────────
// useStemMixer — Unified audio player transport for stems AND original audio.
// If stems exist, plays back separated audio channels.
// Otherwise, plays back the original loaded audio buffer.
// ─────────────────────────────────────────────────────────────────────────────

export default function useStemMixer(
  audioCtxRef,
  audioBufferRef,
  audioDuration,
  stemResult,
  setSeparatorError,
  startSec = 0,
  endSec = 0,
  hasSelection = false
) {
  const [mutedStems, setMutedStems] = useState({ vocals: false, guitar: false, drums: false, bass: false, piano: false, other: false })
  const [soloedStems, setSoloedStems] = useState({ vocals: false, guitar: false, drums: false, bass: false, piano: false, other: false })
  const [stemVolumes, setStemVolumes] = useState({ vocals: 0.8, guitar: 0.8, drums: 0.8, bass: 0.8, piano: 0.8, other: 0.8 })

  const [loadingStems, setLoadingStems] = useState(false)
  const [loadingStemsProgress, setLoadingStemsProgress] = useState(0)

  const stemBuffersRef = useRef({})
  const stemSourcesRef = useRef({})
  const stemGainsRef = useRef({})
  const startTimeRef = useRef(0)
  const offsetTimeRef = useRef(0)
  const animFrameRef = useRef(null)

  const [globalPlaying, setGlobalPlaying] = useState(false)
  const [globalTime, setGlobalTime] = useState(0)
  const [globalDuration, setGlobalDuration] = useState(0)

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
    }
  }, [stemResult, loadStemBuffers])

  const pauseAll = useCallback(() => {
    Object.values(stemSourcesRef.current).forEach(s => {
      try { s.stop() } catch (e) {}
    })
    stemSourcesRef.current = {}
    setGlobalPlaying(false)
  }, [])

  // Unified playback progress timeline loop
  useEffect(() => {
    const updateProgress = () => {
      if (globalPlaying && audioCtxRef.current) {
        let current = audioCtxRef.current.currentTime - startTimeRef.current + offsetTimeRef.current
        
        // Stop if range selection exists and we exceed endSec
        if (hasSelection && current >= endSec) {
          current = startSec
          pauseAll()
          setGlobalTime(startSec)
          offsetTimeRef.current = startSec
          return
        }

        if (current >= globalDuration && globalDuration > 0) {
          current = 0
          pauseAll()
        }
        
        setGlobalTime(current)
        animFrameRef.current = requestAnimationFrame(updateProgress)
      }
    }
    if (globalPlaying) {
      animFrameRef.current = requestAnimationFrame(updateProgress)
    }
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [globalPlaying, globalDuration, pauseAll, audioCtxRef, hasSelection, startSec, endSec])

  // Apply real-time volume/mute/solo adjustments to stems
  useEffect(() => {
    const hasAnySolo = Object.values(soloedStems).some(v => v)
    const ctx = audioCtxRef.current
    if (!ctx) return
    Object.keys(stemGainsRef.current).forEach(name => {
      const gain = stemGainsRef.current[name]
      if (gain) {
        const isMuted = mutedStems[name] || (hasAnySolo && !soloedStems[name])
        gain.gain.setTargetAtTime(isMuted ? 0 : stemVolumes[name], ctx.currentTime, 0.015)
      }
    })
  }, [mutedStems, soloedStems, stemVolumes, audioCtxRef])

  // Play audio — handles either stems or raw original buffer
  const playAll = useCallback((offset) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    pauseAll()

    const names = Object.keys(stemBuffersRef.current)
    const hasAnySolo = Object.values(soloedStems).some(v => v)

    if (names.length > 0) {
      // Stems playback
      names.forEach(name => {
        const source = ctx.createBufferSource()
        const gainNode = ctx.createGain()
        source.buffer = stemBuffersRef.current[name]
        const isMuted = mutedStems[name] || (hasAnySolo && !soloedStems[name])
        gainNode.gain.value = isMuted ? 0 : stemVolumes[name]
        source.connect(gainNode)
        gainNode.connect(ctx.destination)
        source.start(0, offset)
        stemSourcesRef.current[name] = source
        stemGainsRef.current[name] = gainNode
      })
    } else if (audioBufferRef.current) {
      // Original raw song playback
      const source = ctx.createBufferSource()
      source.buffer = audioBufferRef.current
      source.connect(ctx.destination)
      source.start(0, offset)
      stemSourcesRef.current['original'] = source
    }

    startTimeRef.current = ctx.currentTime
    offsetTimeRef.current = offset
    setGlobalPlaying(true)
  }, [audioCtxRef, audioBufferRef, mutedStems, soloedStems, stemVolumes, pauseAll])

  const handleGlobalPlayToggle = useCallback(() => {
    if (globalPlaying) {
      pauseAll()
      offsetTimeRef.current = globalTime
    } else {
      let playOffset = offsetTimeRef.current
      // Snapping: if selection range is set and playhead is outside, start from selection start
      if (hasSelection && (playOffset < startSec || playOffset > endSec)) {
        playOffset = startSec
        setGlobalTime(startSec)
      }
      playAll(playOffset)
    }
  }, [globalPlaying, globalTime, playAll, pauseAll, hasSelection, startSec, endSec])

  const handleGlobalSeek = useCallback((timeOrEvent) => {
    const time = typeof timeOrEvent === 'number' ? timeOrEvent : parseFloat(timeOrEvent?.target?.value || 0)
    setGlobalTime(time)
    offsetTimeRef.current = time
    if (globalPlaying) playAll(time)
  }, [globalPlaying, playAll])

  const resetMixer = useCallback(() => {
    pauseAll()
    stemBuffersRef.current = {}
    setGlobalTime(0)
    setGlobalDuration(0)
    offsetTimeRef.current = 0
  }, [pauseAll])

  return {
    mutedStems,
    soloedStems,
    stemVolumes,
    loadingStems,
    loadingStemsProgress,
    globalPlaying,
    globalTime,
    globalDuration,
    setMutedStems,
    setSoloedStems,
    setStemVolumes,
    pauseAll,
    playAll,
    handleGlobalPlayToggle,
    handleGlobalSeek,
    resetMixer,
  }
}
