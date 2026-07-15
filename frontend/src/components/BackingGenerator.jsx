import React, { useState, useCallback } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Guitar, Music2, Drum, Piano, Mic2, Download, RotateCcw, Waves } from 'lucide-react'
import RegionSelector from './RegionSelector'
import SeparationLoader from './SeparationLoader'
import BackingPlayer from './BackingPlayer'

const BASE_URL = 'http://localhost:8000'

const PRESETS = [
  {
    id: 'guitar',
    name: 'Guitar',
    desc: 'Mute guitar, keep everything else',
    icon: Guitar,
  },
  {
    id: 'bass',
    name: 'Bass',
    desc: 'Backing without bass line',
    icon: Waves,
  },
  {
    id: 'drums',
    name: 'Drums',
    desc: 'Drumless practice track',
    icon: Drum,
  },
  {
    id: 'piano',
    name: 'Piano',
    desc: 'Remove piano from the mix',
    icon: Piano,
  },
  {
    id: 'karaoke',
    name: 'Karaoke',
    desc: 'Vocal-free instrumental',
    icon: Mic2,
  },
]

export default function BackingGenerator({
  // Shared audio state from App
  file,
  audioDuration,
  startSec,
  endSec,
  previewPlaying,
  onStartChange,
  onEndChange,
  onPlay,
  onStop,
  // Panel mode callback so WorkspacePanel updates
  onPanelModeChange,
  onProcessingProgress,
  onProcessingStage,
  onAbortRef,
}) {
  const [backingType,        setBackingType]        = useState('guitar')
  const [generating,         setGenerating]         = useState(false)
  const [result,             setResult]             = useState(null)
  const [error,              setError]              = useState(null)
  const [generationComplete, setGenerationComplete] = useState(false)
  const [pendingResult,      setPendingResult]      = useState(null)

  const handleGenerate = async () => {
    if (endSec - startSec < 1.0) {
      setError('Select at least 1 second of audio.')
      return
    }
    setGenerating(true)
    setGenerationComplete(false)
    setPendingResult(null)
    setError(null)
    if (onPanelModeChange) onPanelModeChange('processing')

    const controller = new AbortController()
    if (onAbortRef) onAbortRef.current = controller

    const fd = new FormData()
    fd.append('file',         file)
    fd.append('backing_type', backingType)
    fd.append('start_sec',    String(startSec))
    fd.append('end_sec',      String(endSec))

    try {
      const response = await axios.post(`${BASE_URL}/generate-backing`, fd, {
        timeout: 300000,
        signal:  controller.signal,
      })
      setPendingResult(response.data)
      setGenerationComplete(true)
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'CanceledError') {
        // cancelled by user
      } else {
        setError(err.response?.data?.detail || 'Backing generation failed.')
        if (onPanelModeChange) onPanelModeChange('file')
      }
      setGenerating(false)
    }
  }

  const handleReset = () => {
    setResult(null)
    setError(null)
    setGenerationComplete(false)
    setPendingResult(null)
    if (onPanelModeChange) onPanelModeChange('file')
  }

  // ── Generating ──
  if (generating) {
    return (
      <SeparationLoader
        isBacking
        isComplete={generationComplete}
        onFinish={() => {
          setResult(pendingResult)
          setGenerating(false)
          setGenerationComplete(false)
          setPendingResult(null)
          if (onPanelModeChange) onPanelModeChange('backing-result')
        }}
      />
    )
  }

  // ── Result ──
  if (result) {
    return (
      <motion.div
        className="configure-workspace"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="workspace-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="workspace-title">Backing Track Ready</div>
              <div className="workspace-sub">
                Preset: <strong style={{ color: 'var(--accent)', textTransform: 'capitalize' }}>{result.backing_type}</strong>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleReset}>
              <RotateCcw size={12} />
              New Backing
            </button>
          </div>
        </div>

        <div className="workspace-content">
          <div className="backing-result">
            <BackingPlayer src={`${BASE_URL}${result.mp3_url}`} />

            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={`${BASE_URL}/download-backing/${result.job_id}/${result.mp3_url.split('/').pop()}`}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}
              >
                <Download size={12} />
                MP3
              </a>
              <a
                href={`${BASE_URL}/download-backing/${result.job_id}/${result.wav_url.split('/').pop()}`}
                className="btn btn-primary btn-sm"
                style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}
              >
                <Download size={12} />
                WAV
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Configure ──
  return (
    <motion.div
      className="configure-workspace"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="workspace-header">
        <div className="workspace-title">Backing Maker</div>
        <div className="workspace-sub">Select an instrument preset and region to generate a custom backing track.</div>
      </div>

      <div className="workspace-content">
        {/* Preset Cards */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
            Backing Preset
          </div>
          <div className="preset-grid">
            {PRESETS.map((preset) => {
              const Icon = preset.icon
              return (
                <motion.button
                  key={preset.id}
                  className={`preset-card ${backingType === preset.id ? 'selected' : ''}`}
                  onClick={() => setBackingType(preset.id)}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', width: '100%' }}
                >
                  <div className="preset-icon">
                    <Icon size={18} />
                  </div>
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-desc">{preset.desc}</span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="error-bar">
            {error}
          </div>
        )}

        {/* Region Selector */}
        <RegionSelector
          duration={audioDuration}
          startSec={startSec}
          endSec={endSec}
          onStartChange={onStartChange}
          onEndChange={onEndChange}
          onPlay={onPlay}
          onStop={onStop}
          onSeparate={handleGenerate}
          playing={previewPlaying}
          loading={generating}
          fileName={file?.name}
          buttonLabel="Generate Backing"
          buttonIcon={<Music2 size={13} />}
        />
      </div>
    </motion.div>
  )
}
