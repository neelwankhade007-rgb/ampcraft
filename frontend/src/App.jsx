import React, { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import './App.css'


// Helper for formatting duration e.g. 75.3 -> "1:15"
const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// A custom row player for each isolated stem
function StemRow({ name, url, icon, label, registerAudio }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      // Pause all other audio elements if any
      document.querySelectorAll('audio').forEach(aud => {
        if (aud !== audioRef.current) {
          aud.pause()
        }
      })
      audioRef.current.play()
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    // Set initial volume
    audio.volume = volume

    // Register audio element with parent
    if (registerAudio) {
      registerAudio(audio)
    }

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      if (registerAudio) {
        registerAudio(null)
      }
    }
  }, [url, registerAudio])

  const handleSeek = (e) => {
    if (audioRef.current) {
      audioRef.current.currentTime = parseFloat(e.target.value)
    }
  }

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (audioRef.current) {
      audioRef.current.volume = val
    }
  }

  const toggleMute = () => {
    if (volume > 0) {
      setVolume(0)
      if (audioRef.current) audioRef.current.volume = 0
    } else {
      setVolume(0.8)
      if (audioRef.current) audioRef.current.volume = 0.8
    }
  }

  const BASE = 'http://localhost:8000'
  const fullUrl = `${BASE}${url}`

  return (
    <div className="stem-row-card">
      <div className="stem-info">
        <span className="stem-icon">{icon}</span>
        <div className="stem-meta">
          <span className="stem-label">{label}</span>
          <span className="stem-time">
            {formatTime(currentTime)} / {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      <div className="stem-player-controls">
        <button className={`stem-play-btn ${playing ? 'playing' : ''}`} onClick={togglePlay}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="16" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <input
          type="range"
          className="stem-seek-bar"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
        />

        <div className="stem-volume-container">
          <button className="stem-volume-btn" onClick={toggleMute} title="Mute/Unmute">
            {volume === 0 ? (
              <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
          <input
            type="range"
            className="stem-volume-slider"
            min={0}
            max={1.0}
            step={0.05}
            value={volume}
            onChange={handleVolumeChange}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>

        <a href={fullUrl} download={`${label.toLowerCase()}_stem.wav`} className="stem-download-btn" target="_blank" rel="noreferrer" title="Download WAV">
          <svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
      </div>

      <audio ref={audioRef} src={fullUrl} preload="metadata" />
    </div>
  )
}

// Region Selector component for selecting trim duration of uploaded song before separating
function RegionSelector({
  duration,
  startSec,
  endSec,
  onStartChange,
  onEndChange,
  onPlay,
  onStop,
  onSeparate,
  playing,
  loading,
  fileName
}) {
  const trackRef = useRef(null)
  const dragging = useRef(null)

  const total = duration || 1
  const startPct = (startSec / total) * 100
  const endPct = (endSec / total) * 100
  const selDur = endSec - startSec

  const bars = React.useMemo(() => {
    let seed = 0
    for (let i = 0; i < fileName.length; i++) seed += fileName.charCodeAt(i)
    const rng = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s) }
    return Array.from({ length: 80 }, (_, i) => Math.round(15 + rng(seed + i * 7.3) * 70))
  }, [fileName])

  const secFromEvent = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(pct * total * 10) / 10
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !trackRef.current) return
      const sec = secFromEvent(e)
      if (dragging.current === 'start') {
        onStartChange(Math.max(0, Math.min(sec, endSec - 1.0)))
      } else {
        onEndChange(Math.min(total, Math.max(sec, startSec + 1.0)))
      }
    }
    const onUp = () => { dragging.current = null }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [startSec, endSec, total])

  return (
    <div className="region-selector">
      <div className="rs-header">
        <span className="rs-title">Select Region to Separate</span>
        <span className="rs-duration-badge">
          {formatTime(selDur)} selected · {formatTime(total)} total
        </span>
      </div>

      <div className="rs-track-wrap" ref={trackRef}>
        <div className="rs-waveform">
          {bars.map((h, i) => {
            const pct = (i / bars.length) * 100
            return (
              <div
                key={i}
                className={`rs-bar ${pct >= startPct && pct <= endPct ? 'rs-bar-active' : ''}`}
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>

        <div
          className="rs-selection"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />

        <div
          className="rs-handle rs-handle-start"
          style={{ left: `${startPct}%` }}
          onMouseDown={(e) => { e.preventDefault(); dragging.current = 'start' }}
          onTouchStart={(e) => { e.preventDefault(); dragging.current = 'start' }}
        >
          <div className="rs-handle-grip" />
          <span className="rs-handle-label rs-handle-label-left">{formatTime(startSec)}</span>
        </div>

        <div
          className="rs-handle rs-handle-end"
          style={{ left: `${endPct}%` }}
          onMouseDown={(e) => { e.preventDefault(); dragging.current = 'end' }}
          onTouchStart={(e) => { e.preventDefault(); dragging.current = 'end' }}
        >
          <div className="rs-handle-grip" />
          <span className="rs-handle-label rs-handle-label-right">{formatTime(endSec)}</span>
        </div>
      </div>

      <div className="rs-controls">
        <div className="rs-inputs">
          <div className="rs-input-group">
            <label className="rs-input-label">Start (sec)</label>
            <input
              type="number"
              className="rs-input"
              value={startSec}
              min={0}
              max={endSec - 1}
              step={0.1}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) onStartChange(Math.max(0, Math.min(val, endSec - 1.0)))
              }}
            />
          </div>
          <div className="rs-sep">→</div>
          <div className="rs-input-group">
            <label className="rs-input-label">End (sec)</label>
            <input
              type="number"
              className="rs-input"
              value={endSec}
              min={startSec + 1}
              max={total}
              step={0.1}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) onEndChange(Math.min(total, Math.max(val, startSec + 1.0)))
              }}
            />
          </div>
        </div>

        <div className="rs-actions">
          <button
            className={`rs-btn-play ${playing ? 'rs-btn-stop' : ''}`}
            onClick={playing ? onStop : onPlay}
            disabled={!duration}
          >
            {playing ? 'Stop Preview' : 'Preview Selection'}
          </button>

          <button
            className="rs-btn-separate"
            onClick={onSeparate}
            disabled={loading || selDur < 1.0}
          >
            {loading ? <span className="spinner spinner-dark" /> : 'Separate Stems ✂️'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SeparationLoader({ isComplete, onFinish }) {
  const [currentStage, setCurrentStage] = useState(0)
  const [overallProgress, setOverallProgress] = useState(0)
  const overallProgressRef = useRef(0)
  overallProgressRef.current = overallProgress

  useEffect(() => {
    let startTime = Date.now()
    let completedTime = null
    let completedStartProgress = 0

    let interval = setInterval(() => {
      if (isComplete) {
        if (completedTime === null) {
          completedTime = Date.now()
          completedStartProgress = overallProgressRef.current
        }
        const elapsedSinceComplete = (Date.now() - completedTime) / 1000 // seconds
        // Fast transition to 100 in 0.6 seconds
        const pct = Math.min(1, elapsedSinceComplete / 0.6)
        const currentProg = Math.round(completedStartProgress + (100 - completedStartProgress) * pct)
        
        setOverallProgress(currentProg)
        if (currentProg >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            onFinish()
          }, 300)
        }
        
        if (pct > 0.2) setCurrentStage(3)
        if (pct > 0.6) setCurrentStage(4)
        return
      }

      const elapsed = (Date.now() - startTime) / 1000 // seconds

      let stage = 0
      let prog = 0

      if (elapsed < 3) {
        // Stage 0: Loading Audio (0 to 3s)
        stage = 0
        prog = (elapsed / 3) * 15
      } else if (elapsed < 8) {
        // Stage 1: Analyzing Mix (3s to 8s)
        stage = 1
        prog = 15 + ((elapsed - 3) / 5) * 15
      } else if (elapsed < 38) {
        // Stage 2: Separating Instruments (8s to 38s)
        stage = 2
        prog = 30 + ((elapsed - 8) / 30) * 45
      } else if (elapsed < 48) {
        // Stage 3: Rendering Stems (38s to 48s)
        stage = 3
        prog = 75 + ((elapsed - 38) / 10) * 15
      } else {
        // Stage 4: Finalizing Output (48s+)
        stage = 4
        const extraTime = elapsed - 48
        const rate = 1 - Math.exp(-extraTime / 20)
        prog = 90 + rate * 8
      }

      setCurrentStage(stage)
      setOverallProgress(Math.min(99, Math.round(prog)))
    }, 100)

    return () => clearInterval(interval)
  }, [isComplete, onFinish])

  const STAGES = [
    { title: 'Loading Audio', subtitle: 'Reading audio data...' },
    { title: 'Analyzing Mix', subtitle: 'Identifying track components...' },
    { title: 'Separating Instruments', subtitle: 'Creating individual stem tracks...' },
    { title: 'Rendering Stems', subtitle: 'Preparing high-quality outputs...' },
    { title: 'Finalizing Output', subtitle: 'Almost done...' }
  ]

  return (
    <div className="daw-loader-container">
      <div className="daw-loader-header">
        <span className="daw-loader-percentage">{overallProgress}%</span>
        <h3 className="daw-loader-title">Processing Mix</h3>
        <p className="daw-loader-subtitle">Please wait while Demucs AI processes your request...</p>
      </div>

      <div className="daw-progress-bar-track">
        <div className="daw-progress-bar-fill" style={{ width: `${overallProgress}%` }} />
      </div>

      <div className="daw-stages-list">
        {STAGES.map((stage, idx) => {
          let stateClass = 'pending'
          if (idx < currentStage) stateClass = 'completed'
          else if (idx === currentStage) stateClass = 'active'

          return (
            <div key={idx} className={`daw-stage-item ${stateClass}`}>
              <div className="daw-stage-node">
                {idx < currentStage ? (
                  <svg className="check-icon" viewBox="0 0 24 24" width="12" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="node-number">{idx + 1}</span>
                )}
              </div>
              <div className="daw-stage-content">
                <div className="daw-stage-title-row">
                  <span className="daw-stage-prefix">Stage {idx + 1}</span>
                  <span className="daw-stage-title">{stage.title}</span>
                </div>
                <span className="daw-stage-subtitle">{stage.subtitle}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  const [file, setFile] = useState(null)
  const [dragging, setDrag] = useState(false)
  const [separating, setSeparating] = useState(false)
  const [stemResult, setStemResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  // Delayed complete state for loader transition
  const [separationComplete, setSeparationComplete] = useState(false)
  const [pendingResult, setPendingResult] = useState(null)

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

  // Global stems playback refs and states
  const audioElementsRef = useRef({})
  const [globalPlaying, setGlobalPlaying] = useState(false)
  const [globalTime, setGlobalTime] = useState(0)
  const [globalDuration, setGlobalDuration] = useState(0)

  // Synchronization effect for playing multiple audio elements in sync
  useEffect(() => {
    let animFrame
    const updateProgress = () => {
      const audios = Object.values(audioElementsRef.current).filter(Boolean)
      if (audios.length === 0) {
        setGlobalPlaying(false)
        return
      }

      const playingAudio = audios.find(a => !a.paused)
      if (playingAudio) {
        const leadTime = playingAudio.currentTime
        setGlobalTime(leadTime)
        
        // Sync duration dynamically
        const dur = audios.find(a => a.duration && !isNaN(a.duration))?.duration
        if (dur) setGlobalDuration(dur)

        // Prevent drift by aligning other playing tracks to the leader's currentTime
        audios.forEach(aud => {
          if (!aud.paused && Math.abs(aud.currentTime - leadTime) > 0.05) {
            aud.currentTime = leadTime
          }
        })
      } else {
        // If none are playing, update state
        if (audios.every(a => a.paused)) {
          setGlobalPlaying(false)
        }
      }
      animFrame = requestAnimationFrame(updateProgress)
    }

    if (globalPlaying) {
      animFrame = requestAnimationFrame(updateProgress)
    }
    return () => cancelAnimationFrame(animFrame)
  }, [globalPlaying])

  const handleGlobalPlayToggle = () => {
    const audios = Object.values(audioElementsRef.current).filter(Boolean)
    if (audios.length === 0) return

    if (globalPlaying) {
      audios.forEach(aud => aud.pause())
      setGlobalPlaying(false)
    } else {
      // Stop raw track preview if playing
      stopPreview()

      const anyEnded = audios.some(aud => aud.ended || aud.currentTime >= aud.duration - 0.1)
      const targetTime = anyEnded ? 0 : Math.max(...audios.map(a => a.currentTime))

      audios.forEach(aud => {
        aud.currentTime = targetTime
        aud.play().catch(err => console.warn("Failed to play stem:", err))
      })
      setGlobalPlaying(true)
    }
  }

  const handleGlobalSeek = (e) => {
    const time = parseFloat(e.target.value)
    setGlobalTime(time)
    const audios = Object.values(audioElementsRef.current).filter(Boolean)
    audios.forEach(aud => {
      aud.currentTime = time
    })
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false)
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
    const duration = Math.max(0.1, endSec - startSec)
    source.start(0, offset, duration)

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

    const fd = new FormData()
    fd.append('file', file)
    fd.append('start_sec', String(startSec))
    fd.append('end_sec', String(endSec))

    try {
      const res = await axios.post('http://localhost:8000/separate', fd, {
        timeout: 300000,
      })
      setPendingResult(res.data)
      setSeparationComplete(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Separation failed. Please check if the backend is running.')
      setSeparating(false)
    }
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
    setGlobalPlaying(false)
    setGlobalTime(0)
    setGlobalDuration(0)
    audioElementsRef.current = {}
    setSeparationComplete(false)
    setPendingResult(null)
  }

  useEffect(() => {
    return () => {
      stopPreview()
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
      }
    }
  }, [])

  const STEM_METADATA = {
    vocals: { label: 'Vocals', icon: '🎤' },
    guitar: { label: 'Guitar', icon: '🎸' },
    drums: { label: 'Drums', icon: '🥁' },
    bass: { label: 'Bass', icon: '🎸' },
    piano: { label: 'Piano', icon: '🎹' },
    other: { label: 'Other', icon: '🎵' }
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1 className="brand">AmpCraft</h1>
          <p className="tagline">High-Quality AI Stem Separation</p>
        </header>

        <section className="upload-section">
          <div
            className={`drop-zone ${dragging ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="dz-file-info">
                <span className="dz-file-icon">🎵</span>
                <p className="dz-filename">{file.name}</p>
              </div>
            ) : (
              <>
                <p className="dz-main">Drag &amp; drop audio</p>
                <p className="dz-sub">or <span>click to browse</span></p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) selectFile(e.target.files[0])
            }}
          />
          {error && <p className="error-msg">{error}</p>}

          {file && (
            <button className="reset-btn" onClick={resetState}>
              Clear File
            </button>
          )}
        </section>
      </aside>

      <main className="main-content">
        {separating && (
          <div className="loading-overlay">
            <SeparationLoader
              isComplete={separationComplete}
              onFinish={() => {
                setStemResult(pendingResult)
                setSeparating(false)
                setSeparationComplete(false)
                setPendingResult(null)
              }}
            />
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

        {!separating && stemResult && (
          <div className="splitter-canvas">
            <div className="canvas-header">
              <h2>Isolated Audio Stems</h2>
              <p>Separation complete for <strong>{stemResult.original_filename}</strong>. Play or download the separated tracks below.</p>
            </div>

            <div className="global-mixer-panel">
              <div className="mixer-header">
                <span className="mixer-title">🎛️ Master Mix</span>
                <span className="mixer-time">
                  {formatTime(globalTime)} / {formatTime(globalDuration || 0)}
                </span>
              </div>
              <div className="mixer-controls">
                <button
                  className={`mixer-play-btn ${globalPlaying ? 'playing' : ''}`}
                  onClick={handleGlobalPlayToggle}
                  title={globalPlaying ? 'Pause All' : 'Play All Stems'}
                >
                  {globalPlaying ? (
                    <svg viewBox="0 0 24 24" width="18" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                  <span>{globalPlaying ? 'Pause All' : 'Play All'}</span>
                </button>
                <input
                  type="range"
                  className="mixer-seek-bar"
                  min={0}
                  max={globalDuration || 100}
                  step={0.1}
                  value={globalTime}
                  onChange={handleGlobalSeek}
                />
                {stemResult.job_id && (
                  <div className="mixer-download-group">
                    <div className="format-toggle">
                      <button
                        className={`format-btn ${downloadFormat === 'mp3' ? 'active' : ''}`}
                        onClick={() => setDownloadFormat('mp3')}
                      >MP3</button>
                      <button
                        className={`format-btn ${downloadFormat === 'wav' ? 'active' : ''}`}
                        onClick={() => setDownloadFormat('wav')}
                      >WAV</button>
                    </div>
                    <a
                      href={`http://localhost:8000/download-stems/${stemResult.job_id}?format=${downloadFormat}`}
                      download={`${stemResult.original_filename.split('.')[0]}_stems_${downloadFormat}.zip`}
                      className="mixer-download-btn"
                      title={`Download all stems as ${downloadFormat.toUpperCase()} ZIP`}
                    >
                      <svg viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Download All</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="stems-list-container">
              {Object.entries(stemResult.stems).map(([name, url]) => {
                const meta = STEM_METADATA[name] || { label: name, icon: '🎵' }
                return (
                  <StemRow
                    key={name}
                    name={name}
                    url={url}
                    icon={meta.icon}
                    label={meta.label}
                    registerAudio={(el) => {
                      if (el) {
                        audioElementsRef.current[name] = el
                      } else {
                        delete audioElementsRef.current[name]
                      }
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}

        {!separating && !file && (
          <div className="empty-state">
            <div className="empty-state-graphic">✂️</div>
            <h3>Ready to Split Stems</h3>
            <p>Upload a track from the sidebar to extract vocal, guitar, bass, drum, and piano stems.</p>
          </div>
        )}
      </main>
    </div>
  )
}