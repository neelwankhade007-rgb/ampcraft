import React from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Download, Volume2, VolumeX, Mic2, Guitar, Drum, Music2, Piano, MoreHorizontal, Waves } from 'lucide-react'
import { formatTime } from '../utils/formatTime'
import WaveformPlayer from './WaveformPlayer'

const BASE = 'http://localhost:8000'

// Map stem name → color + lucide icon
const STEM_META = {
  vocals: { label: 'Vocals', color: 'var(--stem-vocals)', icon: Mic2 },
  guitar: { label: 'Guitar', color: 'var(--stem-guitar)', icon: Guitar },
  drums:  { label: 'Drums',  color: 'var(--stem-drums)',  icon: Drum },
  bass:   { label: 'Bass',   color: 'var(--stem-bass)',   icon: Waves },
  piano:  { label: 'Piano',  color: 'var(--stem-piano)',  icon: Piano },
  other:  { label: 'Other',  color: 'var(--stem-other)',  icon: MoreHorizontal },
}

export default function StemRow({
  name,
  url,
  mutedStems = {},
  soloedStems = {},
  volume = 0.8,
  globalTime = 0,
  globalDuration = 0,
  globalPlaying = false,
  onMuteToggle,
  onSoloToggle,
  onVolumeChange,
  onSeek,
  onPlayToggle,
  index = 0,
}) {
  const hasAnySolo    = Object.values(soloedStems).some(v => v)
  const isMutedBySolo = hasAnySolo && !soloedStems[name]
  const isMuted       = mutedStems[name] || isMutedBySolo
  const isSoloed      = soloedStems[name]

  const meta = STEM_META[name] || { label: name, color: 'var(--stem-other)', icon: Music2 }
  const Icon = meta.icon

  // Build download URL via force-download endpoint
  const parts = url.split('/')
  const downloadUrl = `${BASE}/download-stem/${parts[parts.length - 2]}/${parts[parts.length - 1]}`

  return (
    <motion.div
      className="stem-card"
      data-stem={name}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      {/* Header: icon + label + time */}
      <div className="stem-card-header">
        <div className="stem-card-identity">
          <div className="stem-card-icon" data-stem={name}>
            <Icon size={14} />
          </div>
          <span className="stem-card-label">{meta.label}</span>
        </div>
        <span className="stem-card-time">
          {formatTime(globalTime)} / {formatTime(globalDuration)}
        </span>
      </div>

      {/* Waveform mini */}
      <WaveformPlayer
        currentTime={globalTime}
        duration={globalDuration}
        onSeek={onSeek}
        fileName={name}
        customColor={meta.color}
        height={42}
      />

      {/* Controls strip */}
      <div className="stem-controls">
        {/* Play toggle (master) */}
        <button
          className={`stem-play-btn ${globalPlaying ? 'playing' : ''}`}
          onClick={onPlayToggle}
          title={globalPlaying ? 'Pause All' : 'Play All'}
        >
          {globalPlaying ? <Pause size={11} /> : <Play size={11} />}
        </button>

        {/* Volume */}
        <div className="stem-vol-wrap">
          <button
            className="stem-vol-btn"
            onClick={() => onMuteToggle && onMuteToggle(name)}
            title="Mute"
          >
            {isMuted || volume === 0
              ? <VolumeX size={12} />
              : <Volume2 size={12} />
            }
          </button>
          <input
            type="range"
            className="stem-vol-slider"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange && onVolumeChange(name, parseFloat(e.target.value))}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>

        {/* M | S */}
        <div className="stem-ms-group">
          <button
            className={`stem-ms-btn ${mutedStems[name] ? 'mute-active' : ''}`}
            onClick={() => onMuteToggle && onMuteToggle(name)}
            title="Mute"
          >
            M
          </button>
          <button
            className={`stem-ms-btn ${isSoloed ? 'solo-active' : ''}`}
            onClick={() => onSoloToggle && onSoloToggle(name)}
            title="Solo"
          >
            S
          </button>
        </div>

        {/* Download */}
        <a
          href={downloadUrl}
          className="stem-download-btn"
          title="Download WAV"
        >
          <Download size={12} />
        </a>
      </div>
    </motion.div>
  )
}
