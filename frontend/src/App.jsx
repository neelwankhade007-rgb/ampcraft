import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { AnimatePresence, motion } from 'framer-motion'
import { Scissors } from 'lucide-react'
import './index.css'

import TitleBar         from './components/TitleBar'
import WorkspacePanel   from './components/WorkspacePanel'
import UploadWorkspace  from './components/UploadWorkspace'
import SeparationLoader from './components/SeparationLoader'
import StemsPanel       from './components/StemsPanel'
import BackingGenerator from './components/BackingGenerator'
import StudioTimeline   from './components/StudioTimeline'

import useProject      from './hooks/useProject'
import useStemMixer    from './hooks/useStemMixer'

// ─────────────────────────────────────────────────────────────────────────────
// App — coordinates active modules, shared timeline, and project playback state
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeModule, setActiveModule] = useState('separator')
  const [panelMode, setPanelMode] = useState('upload')

  // ── Project (single source of truth) ────────────────────────────────────────
  const project = useProject()
  const {
    file, audioDuration, sampleRate, startSec, endSec, hasSelection,
    stemResult, setStemResult, backingResult, setBackingResult,
    stemsExist, audioCtxRef, audioBufferRef,
    loadFile, clearProject, setStartSec, setEndSec, setHasSelection,
  } = project

  // ── Stem separation job state ───────────────────────────────────────────────
  const [separating, setSeparating]                 = useState(false)
  const [separationComplete, setSeparationComplete] = useState(false)
  const [pendingResult, setPendingResult]            = useState(null)
  const [separatorError, setSeparatorError]          = useState(null)
  const [downloadFormat, setDownloadFormat]          = useState('mp3')

  const sepAbortRef     = useRef(null)
  const backingAbortRef = useRef(null)

  // ── Unified Audio Playback & Mixer (handles raw original preview & stems) ───
  const {
    mutedStems, soloedStems, stemVolumes,
    loadingStems, loadingStemsProgress,
    globalPlaying, globalTime, globalDuration,
    setMutedStems, setSoloedStems, setStemVolumes,
    pauseAll, handleGlobalPlayToggle, handleGlobalSeek, resetMixer,
  } = useStemMixer(
    audioCtxRef,
    audioBufferRef,
    audioDuration,
    stemResult,
    setSeparatorError,
    startSec,
    endSec,
    hasSelection
  )

  // ── File handling ───────────────────────────────────────────────────────────
  const selectFile = async (f) => {
    setSeparatorError(null)
    resetMixer()
    await loadFile(f)
    setPanelMode(f ? 'file' : 'upload')
  }

  const handleFileChange = (e) => { if (e.target.files?.[0]) selectFile(e.target.files[0]) }

  const handleReplaceFile = () => {
    resetMixer()
    clearProject()
    setSeparatorError(null)
    setSeparating(false)
    setSeparationComplete(false)
    setPendingResult(null)
    setPanelMode('upload')
  }

  const onDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0])
  }

  // ── Stem Separation ─────────────────────────────────────────────────────────
  const handleSeparate = async () => {
    if (endSec - startSec < 1.0) { setSeparatorError('Select at least 1 second of audio.'); return }
    setSeparating(true)
    setSeparationComplete(false)
    setPendingResult(null)
    setSeparatorError(null)
    setPanelMode('processing')

    const controller = new AbortController()
    sepAbortRef.current = controller

    const fd = new FormData()
    fd.append('file', file)
    fd.append('start_sec', String(startSec))
    fd.append('end_sec', String(endSec))

    try {
      const res = await axios.post('http://localhost:8000/separate', fd, {
        timeout: 300000,
        signal: controller.signal,
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

  // ── Derived panel mode ──────────────────────────────────────────────────────
  const effectivePanelMode = (() => {
    if (!file) return 'upload'
    if (separating || panelMode === 'processing') return 'processing'
    if (panelMode === 'backing-result') return 'backing-result'
    if (stemResult && activeModule === 'separator') return 'result'
    return 'file'
  })()

  const handleCancelProcessing = activeModule === 'separator' ? handleCancelSeparate : handleCancelBacking

  const fileInputRef = useRef(null)

  return (
    <div className="app-shell">
      <TitleBar
        activeModule={activeModule}
        onModuleChange={(mod) => {
          setActiveModule(mod)
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
        {/* Left sidebar — metadata only */}
        <WorkspacePanel
          mode={effectivePanelMode}
          file={file}
          audioDuration={audioDuration}
          sampleRate={sampleRate}
          error={activeModule === 'separator' ? separatorError : null}
          onReplaceFile={handleReplaceFile}
          onCancelProcessing={handleCancelProcessing}
        />

        {/* Center workspace */}
        <main className="module-workspace">
          {/* Shared Timeline Header (always visible once a file is uploaded) */}
          {file && (
            <StudioTimeline
              fileName={file.name}
              duration={audioDuration}
              currentTime={globalTime}
              isPlaying={globalPlaying}
              onPlayToggle={handleGlobalPlayToggle}
              onSeek={handleGlobalSeek}
              startSec={startSec}
              endSec={endSec}
              onStartChange={setStartSec}
              onEndChange={setEndSec}
              hasSelection={hasSelection}
              setHasSelection={setHasSelection}
              showSelection={activeModule === 'backing' || (!stemResult && activeModule === 'separator')}
            />
          )}

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
                style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
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

                {!separating && !stemResult && (
                  <div className="configure-workspace" style={{ borderTop: 'none', paddingTop: 0 }}>
                    <div className="workspace-header">
                      <div className="workspace-title">Stem Separator</div>
                      <div className="workspace-sub">
                        {hasSelection
                          ? 'Selected region will be separated. Click "Clear Selection" or click outside the range on the timeline above to reset.'
                          : 'Drag the handles on the timeline above to select a region to separate, or click separate to split the entire song.'}
                      </div>
                    </div>
                    <div className="workspace-content" style={{ marginTop: 8 }}>
                      {separatorError && (
                        <div className="error-bar">{separatorError}</div>
                      )}
                      <button
                        className="btn btn-primary btn-lg btn-full"
                        onClick={handleSeparate}
                        disabled={separating}
                      >
                        <Scissors size={15} />
                        Separate Stems
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Backing Maker Module ── */}
            {file && activeModule === 'backing' && (
              <motion.div
                key="backing"
                style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
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
                  hasSelection={hasSelection}
                  stemResult={stemResult}
                  onStemResult={setStemResult}
                  onPanelModeChange={setPanelMode}
                  onAbortRef={backingAbortRef}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* Hidden file input for Replace File flow */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}
