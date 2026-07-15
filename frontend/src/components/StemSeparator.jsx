import React, { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import '../index.css'

import UploadSidebar from './UploadSidebar'
import RegionSelector from './RegionSelector'
import SeparationLoader from './SeparationLoader'
import StemsPanel from './StemsPanel'
import EmptyState from './EmptyState'

/**
 * StemSeparator — self-contained feature component.
 * Owns all state, Web Audio context, API calls, and layout
 * for the full stem separation workflow.
 */
export default function StemSeparator({ onJobIdChange }) {
  const [file, setFile] = useState(null)
  const [dragging, setDrag] = useState(false)
  const [separating, setSeparating] = useState(false)
  const [stemResult, setStemResult] = useState(null)
  const [error, setError] = useState(null)

  // Delayed complete state for loader transition
  const [separationComplete, setSeparationComplete] = useState(false)
  const [pendingResult, setPendingResult] = useState(null)

  // Mute & Solo states for each track
  const [mutedStems, setMutedStems] = useState({
    vocals: false,
    guitar: false,
    drums: false,
    bass: false,
    piano: false,
    other: false
  })
  const [soloedStems, setSoloedStems] = useState({
    vocals: false,
    guitar: false,
    drums: false,
    bass: false,
    piano: false,
    other: false
  })
  const [stemVolumes, setStemVolumes] = useState({
    vocals: 0.8,
    guitar: 0.8,
    drums: 0.8,
    bass: 0.8,
    piano: 0.8,
    other: 0.8
  })

  // Loading stems for Web Audio
  const [loadingStems, setLoadingStems] = useState(false)
  const [loadingStemsProgress, setLoadingStemsProgress] = useState(0)


  // Download format preference for all-stems ZIP
  const [downloadFormat, setDownloadFormat] = useState('mp3')

  // Region Selector states
  const [audioDuration, setAudioDuration] = useState(0)
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(30)
  const [previewPlaying, setPreviewPlaying] = useState(false)

  // Web Audio refs
  const audioCtxRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const audioBufferRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Global stems playback refs and states
  const stemBuffersRef = useRef({})
  const stemSourcesRef = useRef({})
  const stemGainsRef = useRef({})
  const startTimeRef = useRef(0)
  const offsetTimeRef = useRef(0)
  const animFrameRef = useRef(null)

  const [globalPlaying, setGlobalPlaying] = useState(false)
  const [globalTime, setGlobalTime] = useState(0)
  const [globalDuration, setGlobalDuration] = useState(0)

  // Load buffers when separation is complete
  useEffect(() => {
    if (stemResult) {
      loadStemBuffers(stemResult.stems)
    } else {
      stemBuffersRef.current = {}
      setLoadingStems(false)
    }
  }, [stemResult])

  const loadStemBuffers = async (stems) => {
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
      setError('Failed to load separated stems for playback.')
    }
    setLoadingStems(false)
  }

  // Master UI transport loop
  useEffect(() => {
    const updateProgress = () => {
      if (globalPlaying && audioCtxRef.current) {
        let current = audioCtxRef.current.currentTime - startTimeRef.current + offsetTimeRef.current
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
  }, [globalPlaying, globalDuration])

  // Apply volume/mute/solo dynamically
  useEffect(() => {
    const hasAnySolo = Object.values(soloedStems).some(v => v)
    const ctx = audioCtxRef.current
    if (!ctx) return

    Object.keys(stemGainsRef.current).forEach(name => {
      const gainNode = stemGainsRef.current[name]
      if (gainNode) {
        const isMuted = mutedStems[name] || (hasAnySolo && !soloedStems[name])
        gainNode.gain.setTargetAtTime(
          isMuted ? 0 : stemVolumes[name], 
          ctx.currentTime, 
          0.015
        )
      }
    })
  }, [mutedStems, soloedStems, stemVolumes])

  // ── Transport Handlers ────────────────────────────────────────────────────

  const playAll = (offset) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    
    pauseAll() // Ensure clean state
    
    const names = Object.keys(stemBuffersRef.current)
    const hasAnySolo = Object.values(soloedStems).some(v => v)
    
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
    
    startTimeRef.current = ctx.currentTime
    offsetTimeRef.current = offset
    setGlobalPlaying(true)
  }

  const pauseAll = () => {
    Object.values(stemSourcesRef.current).forEach(source => {
      try { source.stop() } catch (e) {}
    })
    stemSourcesRef.current = {}
    setGlobalPlaying(false)
  }

  const handleGlobalPlayToggle = () => {
    if (globalPlaying) {
      pauseAll()
      offsetTimeRef.current = globalTime
    } else {
      stopPreview()
      playAll(offsetTimeRef.current)
    }
  }

  const handleGlobalSeek = (timeOrEvent) => {
    const time = typeof timeOrEvent === 'number' ? timeOrEvent : parseFloat(timeOrEvent?.target?.value || 0)
    setGlobalTime(time)
    offsetTimeRef.current = time
    if (globalPlaying) {
      playAll(time)
    }
  }

  const handleMuteToggle = (name) => {
    setMutedStems(prev => ({
      ...prev,
      [name]: !prev[name]
    }))
  }

  const handleSoloToggle = (name) => {
    setSoloedStems(prev => ({
      ...prev,
      [name]: !prev[name]
    }))
  }

  const handleVolumeChange = (name, volume) => {
    setStemVolumes(prev => ({
      ...prev,
      [name]: volume
    }))
  }


  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDrag(false)
    if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0])
  }, [])

  const selectFile = async (f) => {
    setFile(f)
    setStemResult(null)
    setError(null)
    stopPreview()

    if (f) {
      try {
        const arrayBuffer = await f.arrayBuffer()
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        const decoded = await audioCtxRef.current.decodeAudioData(arrayBuffer)
        audioBufferRef.current = decoded
        const totalSecs = Math.floor(decoded.duration)
        setAudioDuration(totalSecs)
        setStartSec(0)
        setEndSec(Math.min(30, totalSecs))
      } catch (err) {
        console.warn('Could not decode file for preview selection:', err)
      }
    }
  }

  const playPreview = () => {
    if (!audioBufferRef.current || !audioCtxRef.current) return
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch (_) { }
    }

    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(ctx.destination)

    const offset = Math.max(0, startSec)
    const dur = Math.max(0.1, endSec - startSec)
    source.start(0, offset, dur)

    source.onended = () => {
      setPreviewPlaying(false)
      sourceNodeRef.current = null
    }

    sourceNodeRef.current = source
    setPreviewPlaying(true)
  }

  const stopPreview = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch (_) { }
      sourceNodeRef.current = null
    }
    setPreviewPlaying(false)
  }

  const handleSeparate = async () => {
    stopPreview()
    if (endSec - startSec < 1.0) {
      setError('Select at least 1 second of audio to separate.')
      return
    }
    setSeparating(true)
    setSeparationComplete(false)
    setPendingResult(null)
    setError(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const fd = new FormData()
    fd.append('file', file)
    fd.append('start_sec', String(startSec))
    fd.append('end_sec', String(endSec))

    try {
      const res = await axios.post('http://localhost:8000/separate', fd, { 
        timeout: 300000,
        signal: controller.signal
      })
      setPendingResult(res.data)
      setSeparationComplete(true)
      if (onJobIdChange) {
        onJobIdChange(res.data.job_id)
      }
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'CanceledError') {
        console.log('Separation task was canceled.')
      } else {
        setError(err.response?.data?.detail || 'Separation failed. Please check if the backend is running.')
      }
      setSeparating(false)
    }
  }

  const handleCancelSeparate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setSeparating(false)
  }

  const resetState = () => {
    setFile(null)
    setStemResult(null)
    setError(null)
    stopPreview()
    setAudioDuration(0)
    setStartSec(0)
    setEndSec(30)
    audioBufferRef.current = null
    
    pauseAll()
    stemBuffersRef.current = {}
    setGlobalTime(0)
    setGlobalDuration(0)
    offsetTimeRef.current = 0
    
    setSeparationComplete(false)
    setPendingResult(null)
    setMutedStems({ vocals: false, guitar: false, drums: false, bass: false, piano: false, other: false })
    setSoloedStems({ vocals: false, guitar: false, drums: false, bass: false, piano: false, other: false })
    setStemVolumes({ vocals: 0.8, guitar: 0.8, drums: 0.8, bass: 0.8, piano: 0.8, other: 0.8 })
  }


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview()
      if (audioCtxRef.current) audioCtxRef.current.close()
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app-container">
      <UploadSidebar
        file={file}
        dragging={dragging}
        error={error}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onFileChange={(e) => { if (e.target.files?.[0]) selectFile(e.target.files[0]) }}
        onReset={resetState}
      />

      <main className="main-content">
        {separating && (
          <div className="loading-overlay" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <SeparationLoader
              isComplete={separationComplete}
              onFinish={() => {
                setStemResult(pendingResult)
                setSeparating(false)
                setSeparationComplete(false)
                setPendingResult(null)
              }}
            />
            <button 
              onClick={handleCancelSeparate}
              className="reset-btn" 
              style={{ maxWidth: '200px', marginTop: '24px' }}
            >
              Stop Task ⏹️
            </button>
          </div>
        )}

        {!separating && file && !stemResult && (
          <div className="splitter-canvas">
            <div className="canvas-header">
              <h2>Configure Audio Selection</h2>
              <p>Verify or trim the region of your track you want to extract stems from.</p>
            </div>
            <RegionSelector
              duration={audioDuration}
              startSec={startSec}
              endSec={endSec}
              onStartChange={(v) => { stopPreview(); setStartSec(parseFloat(v.toFixed(1))) }}
              onEndChange={(v) => { stopPreview(); setEndSec(parseFloat(v.toFixed(1))) }}
              onPlay={playPreview}
              onStop={stopPreview}
              onSeparate={handleSeparate}
              playing={previewPlaying}
              loading={separating}
              fileName={file.name}
            />
          </div>
        )}

        {!separating && stemResult && loadingStems && (
          <div className="loading-overlay" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '50vh', justifyContent: 'center' }}>
            <div className="loader-spinner" style={{ marginBottom: '1rem', width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Loading Stems for Playback...</h3>
            <p style={{ color: 'var(--text-muted)' }}>{Math.round(loadingStemsProgress * 100)}%</p>
          </div>
        )}

        {!separating && stemResult && !loadingStems && (
          <StemsPanel
            stemResult={stemResult}
            globalPlaying={globalPlaying}
            globalTime={globalTime}
            globalDuration={globalDuration}
            downloadFormat={downloadFormat}
            onPlayToggle={handleGlobalPlayToggle}
            onSeek={handleGlobalSeek}
            onFormatChange={setDownloadFormat}
            mutedStems={mutedStems}
            soloedStems={soloedStems}
            stemVolumes={stemVolumes}
            onMuteToggle={handleMuteToggle}
            onSoloToggle={handleSoloToggle}
            onVolumeChange={handleVolumeChange}
          />
        )}


        {!separating && !file && <EmptyState />}
      </main>
    </div>
  )
}
