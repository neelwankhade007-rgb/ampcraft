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

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGlobalPlayToggle = () => {
    const audios = Object.values(audioElementsRef.current).filter(Boolean)
    if (audios.length === 0) return

    if (globalPlaying) {
      audios.forEach(aud => aud.pause())
      setGlobalPlaying(false)
    } else {
      stopPreview()
      const anyEnded = audios.some(aud => aud.ended || aud.currentTime >= aud.duration - 0.1)
      const targetTime = anyEnded ? 0 : Math.max(...audios.map(a => a.currentTime))
      audios.forEach(aud => {
        aud.currentTime = targetTime
        aud.play().catch(err => console.warn('Failed to play stem:', err))
      })
      setGlobalPlaying(true)
    }
  }

  const handleGlobalSeek = (e) => {
    const time = parseFloat(e.target.value)
    setGlobalTime(time)
    Object.values(audioElementsRef.current).filter(Boolean).forEach(aud => {
      aud.currentTime = time
    })
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

    const fd = new FormData()
    fd.append('file', file)
    fd.append('start_sec', String(startSec))
    fd.append('end_sec', String(endSec))

    try {
      const res = await axios.post('http://localhost:8000/separate', fd, { timeout: 300000 })
      setPendingResult(res.data)
      setSeparationComplete(true)
      if (onJobIdChange) {
        onJobIdChange(res.data.job_id)
      }
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
          <StemsPanel
            stemResult={stemResult}
            globalPlaying={globalPlaying}
            globalTime={globalTime}
            globalDuration={globalDuration}
            downloadFormat={downloadFormat}
            onPlayToggle={handleGlobalPlayToggle}
            onSeek={handleGlobalSeek}
            onFormatChange={setDownloadFormat}
            registerAudio={(name, el) => {
              if (el) {
                audioElementsRef.current[name] = el
              } else {
                delete audioElementsRef.current[name]
              }
            }}
          />
        )}

        {!separating && !file && <EmptyState />}
      </main>
    </div>
  )
}
