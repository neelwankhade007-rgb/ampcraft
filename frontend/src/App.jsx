import React, { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import { AnimatePresence, motion } from 'framer-motion'
import './index.css'

import TitleBar        from './components/TitleBar'
import WorkspacePanel  from './components/WorkspacePanel'
import UploadWorkspace from './components/UploadWorkspace'
import RegionSelector  from './components/RegionSelector'
import SeparationLoader from './components/SeparationLoader'
import StemsPanel      from './components/StemsPanel'
import BackingGenerator from './components/BackingGenerator'

// ─────────────────────────────────────────────────────────────────────────────
// App — owns all shared audio state so switching modules doesn't clear the file
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeModule, setActiveModule] = useState('separator')

  // ── Shared audio state ──────────────────────────────────────────────────────
  const [file,          setFile]          = useState(null)
  const [audioDuration, setAudioDuration] = useState(0)
  const [startSec,      setStartSec]      = useState(0)
  const [endSec,        setEndSec]        = useState(30)
  const [dragging,      setDragging]      = useState(false)
  const [previewPlaying, setPreviewPlaying] = useState(false)

  // AudioContext refs
  const audioCtxRef    = useRef(null)
  const audioBufferRef = useRef(null)
  const sourceNodeRef  = useRef(null)

  // ── Stem Separator state ────────────────────────────────────────────────────
  const [separating,         setSeparating]         = useState(false)
  const [stemResult,         setStemResult]         = useState(null)
  const [separationComplete, setSeparationComplete] = useState(false)
  const [pendingResult,      setPendingResult]      = useState(null)
  const [separatorError,     setSeparatorError]     = useState(null)
  const [downloadFormat,     setDownloadFormat]     = useState('mp3')

  const [mutedStems,  setMutedStems]  = useState({ vocals: false, guitar: false, drums: false, bass: false, piano: false, other: false })
  const [soloedStems, setSoloedStems] = useState({ vocals: false, guitar: false, drums: false, bass: false, piano: false, other: false })
  const [stemVolumes, setStemVolumes] = useState({ vocals: 0.8,  guitar: 0.8,  drums: 0.8,  bass: 0.8,  piano: 0.8,  other: 0.8  })

  const [loadingStems,         setLoadingStems]         = useState(false)
  const [loadingStemsProgress, setLoadingStemsProgress] = useState(0)

  const stemBuffersRef  = useRef({})
  const stemSourcesRef  = useRef({})
  const stemGainsRef    = useRef({})
  const startTimeRef    = useRef(0)
  const offsetTimeRef   = useRef(0)
  const animFrameRef    = useRef(null)
  const sepAbortRef     = useRef(null)

  const [globalPlaying,  setGlobalPlaying]  = useState(false)
  const [globalTime,     setGlobalTime]     = useState(0)
  const [globalDuration, setGlobalDuration] = useState(0)

  // Backing state
  const backingAbortRef = useRef(null)
  const [panelMode, setPanelMode] = useState('upload')  // 'upload'|'file'|'processing'|'result'|'backing-result'

  // ── Shared: Load & decode audio file ────────────────────────────────────────
  const selectFile = async (f) => {
    setFile(f)
    setStemResult(null)
    setSeparatorError(null)
    stopPreview()
    pauseAll()
    stemBuffersRef.current = {}

    if (f) {
      try {
        const ab = await f.arrayBuffer()
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        const decoded = await audioCtxRef.current.decodeAudioData(ab)
        audioBufferRef.current = decoded
        const total = Math.floor(decoded.duration)
        setAudioDuration(total)
        setStartSec(0)
        setEndSec(Math.min(30, total))
      } catch (err) {
        console.warn('Could not decode audio for preview:', err)
      }
      setPanelMode('file')
    } else {
      setPanelMode('upload')
    }
  }

  const handleFileChange = (e) => { if (e.target.files?.[0]) selectFile(e.target.files[0]) }
  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0])
  }, [])

  const handleReplaceFile = () => {
    // Reset everything; panel goes back to upload which shows the file input
    setFile(null)
    setStemResult(null)
    setSeparatorError(null)
    setAudioDuration(0)
    setStartSec(0)
    setEndSec(30)
    audioBufferRef.current = null
    pauseAll()
    stemBuffersRef.current = {}
    setGlobalTime(0)
    setGlobalDuration(0)
    offsetTimeRef.current = 0
    setPanelMode('upload')
  }

  // ── Preview playback ─────────────────────────────────────────────────────────
  const playPreview = () => {
    if (!audioBufferRef.current || !audioCtxRef.current) return
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop() } catch (_) {} }

    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(ctx.destination)
    source.start(0, Math.max(0, startSec), Math.max(0.1, endSec - startSec))
    source.onended = () => { setPreviewPlaying(false); sourceNodeRef.current = null }
    sourceNodeRef.current = source
    setPreviewPlaying(true)
  }

  const stopPreview = () => {
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop() } catch (_) {} ; sourceNodeRef.current = null }
    setPreviewPlaying(false)
  }

  // ── Web Audio stem playback ──────────────────────────────────────────────────
  const loadStemBuffers = async (stems) => {
    setLoadingStems(true)
    setLoadingStemsProgress(0)
    const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    const names = Object.keys(stems)
    let loaded = 0

    try {
      await Promise.all(names.map(async (name) => {
        const url      = `http://localhost:8000${stems[name]}`
        const response = await axios.get(url, { responseType: 'arraybuffer' })
        const buffer   = await ctx.decodeAudioData(response.data)
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
  }

  useEffect(() => {
    if (stemResult) loadStemBuffers(stemResult.stems)
    else { stemBuffersRef.current = {}; setLoadingStems(false) }
  }, [stemResult])

  // Transport animation loop
  useEffect(() => {
    const updateProgress = () => {
      if (globalPlaying && audioCtxRef.current) {
        let current = audioCtxRef.current.currentTime - startTimeRef.current + offsetTimeRef.current
        if (current >= globalDuration && globalDuration > 0) { current = 0; pauseAll() }
        setGlobalTime(current)
        animFrameRef.current = requestAnimationFrame(updateProgress)
      }
    }
    if (globalPlaying) animFrameRef.current = requestAnimationFrame(updateProgress)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [globalPlaying, globalDuration])

  // Apply gain changes
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
  }, [mutedStems, soloedStems, stemVolumes])

  const playAll = (offset) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    pauseAll()
    const names      = Object.keys(stemBuffersRef.current)
    const hasAnySolo = Object.values(soloedStems).some(v => v)

    names.forEach(name => {
      const source   = ctx.createBufferSource()
      const gainNode = ctx.createGain()
      source.buffer  = stemBuffersRef.current[name]
      const isMuted  = mutedStems[name] || (hasAnySolo && !soloedStems[name])
      gainNode.gain.value = isMuted ? 0 : stemVolumes[name]
      source.connect(gainNode)
      gainNode.connect(ctx.destination)
      source.start(0, offset)
      stemSourcesRef.current[name] = source
      stemGainsRef.current[name]   = gainNode
    })
    startTimeRef.current  = ctx.currentTime
    offsetTimeRef.current = offset
    setGlobalPlaying(true)
  }

  const pauseAll = () => {
    Object.values(stemSourcesRef.current).forEach(s => { try { s.stop() } catch (e) {} })
    stemSourcesRef.current = {}
    setGlobalPlaying(false)
  }

  const handleGlobalPlayToggle = () => {
    if (globalPlaying) { pauseAll(); offsetTimeRef.current = globalTime }
    else { stopPreview(); playAll(offsetTimeRef.current) }
  }

  const handleGlobalSeek = (timeOrEvent) => {
    const time = typeof timeOrEvent === 'number' ? timeOrEvent : parseFloat(timeOrEvent?.target?.value || 0)
    setGlobalTime(time)
    offsetTimeRef.current = time
    if (globalPlaying) playAll(time)
  }

  // ── Stem Separation ──────────────────────────────────────────────────────────
  const handleSeparate = async () => {
    stopPreview()
    if (endSec - startSec < 1.0) { setSeparatorError('Select at least 1 second of audio.'); return }
    setSeparating(true)
    setSeparationComplete(false)
    setPendingResult(null)
    setSeparatorError(null)
    setPanelMode('processing')

    const controller = new AbortController()
    sepAbortRef.current = controller

    const fd = new FormData()
    fd.append('file',      file)
    fd.append('start_sec', String(startSec))
    fd.append('end_sec',   String(endSec))

    try {
      const res = await axios.post('http://localhost:8000/separate', fd, {
        timeout: 300000,
        signal:  controller.signal,
      })
      setPendingResult(res.data)
      setSeparationComplete(true)
    } catch (err) {
      if (!axios.isCancel(err) && err.name !== 'CanceledError') {
        setSeparatorError(err.response?.data?.detail || 'Separation failed.')
        setPanelMode('file')
      }
      setSeparating(false)
    }
  }

  const handleCancelSeparate = () => {
    if (sepAbortRef.current) { sepAbortRef.current.abort(); sepAbortRef.current = null }
    setSeparating(false)
    setPanelMode('file')
  }

  const handleCancelBacking = () => {
    if (backingAbortRef.current) { backingAbortRef.current.abort(); backingAbortRef.current = null }
    setPanelMode('file')
  }

  // Cleanup
  useEffect(() => {
    return () => {
      stopPreview()
      if (audioCtxRef.current) audioCtxRef.current.close()
    }
  }, [])

  // ── Derived panel mode for the Separator ────────────────────────────────────
  const effectivePanelMode = (() => {
    if (!file) return 'upload'
    if (separating || panelMode === 'processing') return 'processing'
    if (panelMode === 'backing-result') return 'backing-result'
    if (stemResult) return 'result'
    return 'file'
  })()

  const handleCancelProcessing = activeModule === 'separator' ? handleCancelSeparate : handleCancelBacking

  // ── Render ───────────────────────────────────────────────────────────────────
  const fileInputRef = useRef(null)

  return (
    <div className="app-shell">
      <TitleBar
        activeModule={activeModule}
        onModuleChange={(mod) => {
          setActiveModule(mod)
          // If result or processing, don't forcibly reset panel
          if (!file) setPanelMode('upload')
          else if (effectivePanelMode !== 'processing') {
            if (mod === 'separator' && stemResult) setPanelMode('result')
            else if (mod === 'separator') setPanelMode('file')
            else if (mod === 'backing' && panelMode === 'backing-result') setPanelMode('backing-result')
            else if (mod !== 'separator') setPanelMode('file')
          }
        }}
        file={file}
      />

      <div className="app-body">
        {/* Left workspace panel */}
        <WorkspacePanel
          mode={effectivePanelMode}
          file={file}
          audioDuration={audioDuration}
          dragging={dragging}
          error={activeModule === 'separator' ? separatorError : null}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onFileChange={handleFileChange}
          onReplaceFile={handleReplaceFile}
          processingProgress={0}   // SeparationLoader owns its own progress display
          processingStage="AI Processing…"
          onCancelProcessing={handleCancelProcessing}
          stemResult={stemResult}
          downloadFormat={downloadFormat}
          onFormatChange={setDownloadFormat}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </WorkspacePanel>

        {/* Center workspace */}
        <main className="module-workspace">
          <AnimatePresence mode="wait">

            {/* ── No file: upload workspace ── */}
            {!file && (
              <motion.div
                key="upload"
                style={{ height: '100%' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <UploadWorkspace
                  dragging={dragging}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onFileChange={handleFileChange}
                  fileInputRef={fileInputRef}
                />
              </motion.div>
            )}

            {/* ── Stem Separator Module ── */}
            {file && activeModule === 'separator' && (
              <motion.div
                key="separator"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {/* Processing */}
                {separating && (
                  <SeparationLoader
                    isComplete={separationComplete}
                    onFinish={() => {
                      setStemResult(pendingResult)
                      setSeparating(false)
                      setSeparationComplete(false)
                      setPendingResult(null)
                      setPanelMode('result')
                    }}
                  />
                )}

                {/* Loading stems after separation */}
                {!separating && stemResult && loadingStems && (
                  <div className="loading-stems-overlay">
                    <div className="spinner spinner-light" style={{ width: 28, height: 28, borderWidth: 3 }} />
                    <span className="loading-stems-title">Loading Stems…</span>
                    <span className="loading-stems-sub">{Math.round(loadingStemsProgress * 100)}%</span>
                    <div className="loading-stems-track">
                      <div className="loading-stems-fill" style={{ width: `${loadingStemsProgress * 100}%` }} />
                    </div>
                  </div>
                )}

                {/* Results */}
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
                    onMuteToggle={(n) => setMutedStems(p => ({ ...p, [n]: !p[n] }))}
                    onSoloToggle={(n) => setSoloedStems(p => ({ ...p, [n]: !p[n] }))}
                    onVolumeChange={(n, v) => setStemVolumes(p => ({ ...p, [n]: v }))}
                  />
                )}

                {/* Configure */}
                {!separating && !stemResult && (
                  <div className="configure-workspace">
                    <div className="workspace-header">
                      <div className="workspace-title">Stem Separator</div>
                      <div className="workspace-sub">Configure the region of your track to separate into individual stems.</div>
                    </div>
                    <div className="workspace-content">
                      {separatorError && (
                        <div className="error-bar">{separatorError}</div>
                      )}
                      <RegionSelector
                        duration={audioDuration}
                        startSec={startSec}
                        endSec={endSec}
                        onStartChange={(v) => { stopPreview(); setStartSec(parseFloat(v.toFixed(1))) }}
                        onEndChange={(v)   => { stopPreview(); setEndSec(parseFloat(v.toFixed(1))) }}
                        onPlay={playPreview}
                        onStop={stopPreview}
                        onSeparate={handleSeparate}
                        playing={previewPlaying}
                        loading={separating}
                        fileName={file.name}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Backing Maker Module ── */}
            {file && activeModule === 'backing' && (
              <motion.div
                key="backing"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <BackingGenerator
                  file={file}
                  audioDuration={audioDuration}
                  startSec={startSec}
                  endSec={endSec}
                  previewPlaying={previewPlaying}
                  onStartChange={(v) => { stopPreview(); setStartSec(parseFloat(v.toFixed(1))) }}
                  onEndChange={(v)   => { stopPreview(); setEndSec(parseFloat(v.toFixed(1))) }}
                  onPlay={playPreview}
                  onStop={stopPreview}
                  onPanelModeChange={setPanelMode}
                  onAbortRef={backingAbortRef}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
