import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Mic2, Guitar, Drum, Music2, Piano, Waves, ChevronDown } from 'lucide-react'
import { API_BASE_URL } from '../config/api'

const BASE = API_BASE_URL

const STEM_META = {
  vocals: { label: 'Vocals', color: '#a855f7', icon: Mic2 },
  guitar: { label: 'Guitar', color: '#eab308', icon: Guitar },
  drums:  { label: 'Drums',  color: '#06b6d4', icon: Drum },
  bass:   { label: 'Bass',   color: '#10b981', icon: Waves },
  piano:  { label: 'Piano',  color: '#f97316', icon: Piano },
  other:  { label: 'Other',  color: '#6366f1', icon: Music2 },
}

export default function StemRow({
  name,
  url,
  mutedStems = {},
  soloedStems = {},
  volume = 1.0,
  onMuteToggle,
  onSoloToggle,
  onVolumeChange,
  index = 0,
}) {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const menuRef = useRef(null)

  const hasAnySolo = Object.values(soloedStems).some(v => Boolean(v))
  const isDirectlyMuted = Boolean(mutedStems[name])
  const isSoloed = Boolean(soloedStems[name])
  const isSilencedBySolo = hasAnySolo && !isSoloed
  const isEffectiveMuted = isDirectlyMuted || isSilencedBySolo

  const meta = STEM_META[name] || { label: name, color: '#6366f1', icon: Music2 }
  const Icon = meta.icon

  // Extract path components for downloads
  const parts = url ? url.split('/') : []
  const jobId = parts.length >= 2 ? parts[parts.length - 2] : ''
  const filename = parts.length >= 1 ? parts[parts.length - 1] : ''
  const baseName = filename.replace(/\.(wav|mp3)$/i, '')

  const wavUrl = `${BASE}/download-stem/${jobId}/${baseName}.wav`
  const mp3Url = `${BASE}/download-stem/${jobId}/${baseName}.mp3`

  // Close download dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDownloadOpen(false)
      }
    }
    if (downloadOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [downloadOpen])

  return (
    <motion.div
      className={`stem-card ${isEffectiveMuted ? 'muted' : ''} ${isSoloed ? 'soloed' : ''}`}
      data-stem={name}
      data-purpose="stem-channel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      {/* Top Stem Color Accent Stripe */}
      <div className="stem-card-stripe" style={{ background: meta.color }} />

      {/* Header Row: Left (Icon + Name) & Right (M / S buttons) */}
      <div className="stem-card-header">
        <div className="stem-card-identity">
          <div className="stem-card-icon" style={{ background: `${meta.color}1a`, borderColor: `${meta.color}4d`, color: meta.color }}>
            <Icon size={16} />
          </div>
          <div className="stem-card-name-group">
            <h3 className="stem-card-label">{meta.label}</h3>
            <div className="stem-status-indicator">
              <span className="status-dot" style={{ background: isEffectiveMuted ? '#ef4444' : meta.color }} />
              <span className="status-text">
                {isDirectlyMuted ? 'Muted' : isSoloed ? 'Soloed' : isSilencedBySolo ? 'Silenced' : `${Math.round(volume * 100)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* DAW Mute / Solo Buttons */}
        <div className="stem-ms-group">
          <button
            className={`stem-ms-btn btn-m ${isDirectlyMuted ? 'active' : ''}`}
            onClick={() => onMuteToggle && onMuteToggle(name)}
            title="Mute Track (M)"
          >
            M
          </button>
          <button
            className={`stem-ms-btn btn-s ${isSoloed ? 'active' : ''}`}
            onClick={() => onSoloToggle && onSoloToggle(name)}
            title="Solo Track (S)"
          >
            S
          </button>
        </div>
      </div>

      {/* Mixer Row: Volume Level Slider & Download Dropdown */}
      <div className="stem-mixer-row">
        <div className="stem-fader-group">
          <span className="stem-fader-label">VOL</span>
          <input
            type="range"
            className="audio-fader stem-vol-slider"
            min={0}
            max={1.5}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange && onVolumeChange(name, parseFloat(e.target.value))}
            title={`${meta.label} Volume: ${Math.round(volume * 100)}%`}
          />
          <span className="stem-fader-value">{Math.round(volume * 100)}%</span>
        </div>

        {/* Download Menu */}
        <div className="stem-download-wrapper" ref={menuRef}>
          <button
            className={`stem-download-trigger ${downloadOpen ? 'open' : ''}`}
            onClick={() => setDownloadOpen(prev => !prev)}
            title="Download Stem Options"
          >
            <Download size={13} className="text-slate-400" />
            <span>Download</span>
            <ChevronDown size={12} className="text-slate-400 arrow-icon" />
          </button>

          <AnimatePresence>
            {downloadOpen && (
              <motion.div
                className="stem-download-menu"
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.12 }}
              >
                <a
                  href={mp3Url}
                  download={`${baseName}.mp3`}
                  className="download-option"
                  onClick={() => setDownloadOpen(false)}
                >
                  <span className="fmt-tag">MP3</span>
                  <span className="fmt-desc">Compressed</span>
                </a>
                <a
                  href={wavUrl}
                  download={`${baseName}.wav`}
                  className="download-option"
                  onClick={() => setDownloadOpen(false)}
                >
                  <span className="fmt-tag">WAV</span>
                  <span className="fmt-desc">Lossless</span>
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

