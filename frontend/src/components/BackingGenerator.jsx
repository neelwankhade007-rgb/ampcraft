import React, { useState } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Guitar, Music2, Drum, Piano, Mic2, Download, RotateCcw, Waves, CheckCircle2, Check, ChevronDown, Loader2, Scissors } from 'lucide-react'
import SeparationLoader from './SeparationLoader'
import BackingPlayer from './BackingPlayer'
import StemsPanel from './StemsPanel'

const BASE_URL = 'http://localhost:8000'

const PRESETS = [
  { id: 'guitar', name: 'Guitar',  desc: 'Mute guitar, keep everything else', icon: Guitar },
  { id: 'bass',   name: 'Bass',    desc: 'Backing without bass line',          icon: Waves  },
  { id: 'drums',  name: 'Drums',   desc: 'Drumless practice track',            icon: Drum   },
  { id: 'piano',  name: 'Piano',   desc: 'Remove piano from the mix',          icon: Piano  },
  { id: 'karaoke', name: 'Karaoke', desc: 'Vocal-free instrumental',           icon: Mic2   },
]

export default function BackingGenerator({
  // From project
  file,
  audioDuration,
  startSec,
  endSec,
  hasSelection,
  stemResult,            // existing stems from Separator (if any)
  onStemResult,          // callback to store stems back into project
  backingResult,         // backing track result from project
  onBackingResult,       // callback to store backing results back into project
  // Panel mode
  onPanelModeChange,
  onAbortRef,
  // Stem mixer props (for manual mode)
  mutedStems,
  soloedStems,
  stemVolumes,
  onMuteToggle,
  onSoloToggle,
  onVolumeChange,
}) {
  const [backingType, setBackingType] = useState('guitar')
  const [mode, setMode] = useState('auto') // 'auto' or 'manual'
  const result = backingResult
  const setResult = onBackingResult
  const [error, setError] = useState(null)

  // Separation-phase state (for auto-pipeline)
  const [separating, setSeparating] = useState(false)
  const [separationComplete, setSeparationComplete] = useState(false)
  const [pendingSepResult, setPendingSepResult] = useState(null)

  // Mixing-phase state
  const [generatingDirectly, setGeneratingDirectly] = useState(false)

  // Dropdown & download state
  const [selectedFormat, setSelectedFormat] = useState('wav')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const stemsExist = !!stemResult

  const handleDownload = async () => {
    if (!result) return
    const wavFilename = result.wav_url.split('/').pop()
    const baseWithoutExt = wavFilename.replace(/\.wav$/i, '')
    const targetFilename = `${baseWithoutExt}.${selectedFormat}`
    const downloadEndpoint = `${BASE_URL}/download-backing/${result.job_id}/${targetFilename}`

    setDownloading(true)
    try {
      const response = await fetch(downloadEndpoint)
      if (!response.ok) throw new Error("Download request failed")
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = targetFilename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error("Download failed:", err)
      setError("Failed to download backing track.")
    } finally {
      setDownloading(false)
    }
  }

  // ── Generate backing: reuses stems or auto-chains separation → backing ──
  const handleGenerate = async () => {
    setError(null)
    setResult(null)

    if (stemsExist) {
      // Fast path: stems already exist — just mix them
      setGeneratingDirectly(true)
      if (onPanelModeChange) onPanelModeChange('processing')

      const controller = new AbortController()
      if (onAbortRef) onAbortRef.current = controller

      const fd = new FormData()
      fd.append('job_id', stemResult.job_id)

      if (mode === 'manual') {
        fd.append('backing_type', 'manual')
        const effectiveVolumes = {}
        const hasAnySolo = Object.values(soloedStems || {}).some(v => Boolean(v))
        Object.keys(stemVolumes || {}).forEach(name => {
          const isMuted = mutedStems[name] || (hasAnySolo && !soloedStems[name])
          effectiveVolumes[name] = isMuted ? 0 : stemVolumes[name]
        })
        fd.append('volumes', JSON.stringify(effectiveVolumes))
      } else {
        fd.append('backing_type', backingType)
      }

      try {
        const response = await axios.post(`${BASE_URL}/generate-backing-from-stems`, fd, {
          timeout: 60000,
          signal: controller.signal,
        })
        setResult(response.data)
        if (onPanelModeChange) onPanelModeChange('backing-result')
      } catch (err) {
        if (!axios.isCancel(err) && err.name !== 'CanceledError') {
          setError(err.response?.data?.detail || 'Backing generation failed.')
          if (onPanelModeChange) onPanelModeChange('file')
        }
      } finally {
        setGeneratingDirectly(false)
      }
    } else {
      // Auto-pipeline: separate first, then generate backing
      if (file?.isRestored) {
        setError('Please upload the original audio file again to separate stems.')
        return
      }
      if (endSec - startSec < 1.0) {
        setError('Select at least 1 second of audio.')
        return
      }
      setSeparating(true)
      setSeparationComplete(false)
      setPendingSepResult(null)
      if (onPanelModeChange) onPanelModeChange('processing')

      const controller = new AbortController()
      if (onAbortRef) onAbortRef.current = controller

      const fd = new FormData()
      fd.append('file', file)
      fd.append('start_sec', String(startSec))
      fd.append('end_sec', String(endSec))

      try {
        // Phase 1: Separate stems
        const sepRes = await axios.post(`${BASE_URL}/separate`, fd, {
          timeout: 300000,
          signal: controller.signal,
        })
        setPendingSepResult(sepRes.data)
        setSeparationComplete(true)
      } catch (err) {
        if (!axios.isCancel(err) && err.name !== 'CanceledError') {
          setError(err.response?.data?.detail || 'Separation failed.')
          if (onPanelModeChange) onPanelModeChange('file')
        }
        setSeparating(false)
      }
    }
  }

  // Prepares stems for manual mode without generating a track immediately
  const handlePrepareManual = async () => {
    setError(null)
    if (file?.isRestored) {
      setError('Please upload the original audio file again to separate stems.')
      return
    }
    if (endSec - startSec < 1.0) {
      setError('Select at least 1 second of audio.')
      return
    }
    setSeparating(true)
    setSeparationComplete(false)
    setPendingSepResult(null)
    if (onPanelModeChange) onPanelModeChange('processing')

    const controller = new AbortController()
    if (onAbortRef) onAbortRef.current = controller

    const fd = new FormData()
    fd.append('file', file)
    fd.append('start_sec', String(startSec))
    fd.append('end_sec', String(endSec))

    try {
      const sepRes = await axios.post(`${BASE_URL}/separate`, fd, {
        timeout: 300000,
        signal: controller.signal,
      })
      if (onStemResult) onStemResult(sepRes.data)
      setSeparating(false)
      setSeparationComplete(false)
      setPendingSepResult(null)
      if (onPanelModeChange) onPanelModeChange('file')
    } catch (err) {
      if (!axios.isCancel(err) && err.name !== 'CanceledError') {
        setError(err.response?.data?.detail || 'Separation failed.')
        if (onPanelModeChange) onPanelModeChange('file')
      }
      setSeparating(false)
    }
  }

  // Called by SeparationLoader onFinish after the separation animation completes
  const handleSeparationFinished = async () => {
    const sepData = pendingSepResult
    setSeparating(false)
    setSeparationComplete(false)
    setPendingSepResult(null)

    // Store stems into project so other modules can reuse them
    if (onStemResult) onStemResult(sepData)

    // Phase 2: Now generate backing from the freshly separated stems
    setGeneratingDirectly(true)

    const fd = new FormData()
    fd.append('job_id', sepData.job_id)
    if (mode === 'manual') {
      fd.append('backing_type', 'manual')
      const effectiveVolumes = {}
      const hasAnySolo = Object.values(soloedStems || {}).some(v => Boolean(v))
      Object.keys(stemVolumes || {}).forEach(name => {
        const isMuted = mutedStems[name] || (hasAnySolo && !soloedStems[name])
        effectiveVolumes[name] = isMuted ? 0 : stemVolumes[name]
      })
      fd.append('volumes', JSON.stringify(effectiveVolumes))
    } else {
      fd.append('backing_type', backingType)
    }

    try {
      const response = await axios.post(`${BASE_URL}/generate-backing-from-stems`, fd, {
        timeout: 60000,
      })
      setResult(response.data)
      if (onPanelModeChange) onPanelModeChange('backing-result')
    } catch (err) {
      setError(err.response?.data?.detail || 'Backing generation failed.')
      if (onPanelModeChange) onPanelModeChange('file')
    } finally {
      setGeneratingDirectly(false)
    }
  }

  const handleReset = () => {
    setResult(null)
    setError(null)
    if (onPanelModeChange) onPanelModeChange('file')
  }

  // ── Phase 1: Separating (auto-pipeline only) ──
  if (separating) {
    return (
      <SeparationLoader
        isBacking
        isComplete={separationComplete}
        onFinish={handleSeparationFinished}
      />
    )
  }

  // ── Phase 2: Generating backing (mixing) ──
  if (generatingDirectly) {
    return (
      <div className="processing-workspace" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 size={36} className="spinner" style={{ color: 'var(--accent)', marginBottom: 16 }} />
        <h2 className="processing-title">Mixing Backing Track</h2>
        <p className="processing-subtitle">Summing stems for {backingType} preset...</p>
      </div>
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
                Preset: <strong style={{ color: 'var(--accent)', textTransform: 'capitalize' }}>{result.backing_type === 'manual' ? 'Custom Mix' : result.backing_type}</strong>
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
            <BackingPlayer src={`${BASE_URL}${result.wav_url}`} />

            <div className="backing-download-row">
              {/* Dropdown Container */}
              <div className="format-dropdown-container">
                <button
                  className="format-dropdown-trigger"
                  onClick={() => setDropdownOpen(prev => !prev)}
                >
                  <span>{selectedFormat.toUpperCase()}</span>
                  <ChevronDown size={14} />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      className="format-dropdown-menu"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      {['wav', 'mp3'].map((fmt) => (
                        <button
                          key={fmt}
                          className={`format-dropdown-item ${selectedFormat === fmt ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedFormat(fmt)
                            setDropdownOpen(false)
                          }}
                        >
                          <span className="format-dropdown-item-check">
                            {selectedFormat === fmt && <Check size={12} />}
                          </span>
                          <span>{fmt.toUpperCase()}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Primary Download Button */}
              <button
                className="btn-download-backing"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 size={16} className="spinner" />
                ) : (
                  <Download size={16} />
                )}
                <span>
                  {downloading ? 'Downloading...' : 'Download Backing Track'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Configure: Preset selection ──
  return (
    <motion.div
      className="configure-workspace"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="workspace-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="workspace-title">Backing Maker</div>
            <div className="workspace-sub">
              {stemsExist
                ? (mode === 'auto' ? 'Stems are ready. Select a preset and generate your backing track.' : 'Stems are ready. Adjust the mix manually to create your custom backing track.')
                : (mode === 'auto' ? 'Select a preset. Stems will be separated automatically before generating.' : 'Stems will be separated first so you can manually adjust the mix.')}
            </div>
          </div>
          
          <div className="mode-toggle" style={{ display: 'flex', background: 'var(--surface)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button
              onClick={() => setMode('auto')}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 4, border: 'none', background: mode === 'auto' ? 'var(--accent)' : 'transparent', color: mode === 'auto' ? '#fff' : 'var(--text-2)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Auto
            </button>
            <button
              onClick={() => setMode('manual')}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 4, border: 'none', background: mode === 'manual' ? 'var(--accent)' : 'transparent', color: mode === 'manual' ? '#fff' : 'var(--text-2)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Manual
            </button>
          </div>
        </div>
      </div>

      <div className="workspace-content">
        {/* Stems status banner */}
        {stemsExist && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            background: 'var(--green-soft)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 'var(--r-md)',
            fontSize: 12, fontWeight: 600, color: 'var(--green)',
          }}>
            <CheckCircle2 size={14} />
            Stems available — no re-separation needed
          </div>
        )}

        {/* Auto / Manual Mode Content */}
        {mode === 'auto' ? (
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
        ) : (
          <div>
            {stemsExist ? (
              <StemsPanel
                stemResult={stemResult}
                mutedStems={mutedStems}
                soloedStems={soloedStems}
                stemVolumes={stemVolumes}
                onMuteToggle={onMuteToggle}
                onSoloToggle={onSoloToggle}
                onVolumeChange={onVolumeChange}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface-hover)', borderRadius: 'var(--r-lg)', border: '1px dashed var(--border)' }}>
                <Waves size={32} style={{ color: 'var(--text-3)', margin: '0 auto 16px auto' }} />
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>Stems Required</h3>
                <p style={{ margin: '8px 0 20px 0', fontSize: 14, color: 'var(--text-2)' }}>
                  Manual mixing requires the stems to be separated first. 
                </p>
                <button className="btn btn-outline" onClick={handlePrepareManual}>
                  <Scissors size={14} />
                  Separate Stems Now
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="error-bar" style={{ marginTop: 16 }}>{error}</div>
        )}

        {/* Generate Button */}
        {mode === 'auto' || (mode === 'manual' && stemsExist) ? (
          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={handleGenerate}
            disabled={!file}
            style={{ marginTop: 16 }}
          >
            <Music2 size={15} />
            {mode === 'manual' ? 'Create Custom Backing Track' : 'Generate Backing Track'}
          </button>
        ) : null}
      </div>
    </motion.div>
  )
}
