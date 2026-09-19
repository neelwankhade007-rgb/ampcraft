import React, { useRef, useMemo, useEffect, memo } from 'react'
import { Play, Pause, RotateCcw, SkipBack, Volume2, VolumeX, Download } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatTime } from '../utils/formatTime'
import DawWaveformCanvas from './DawWaveformCanvas'
import { API_BASE_URL } from '../config/api'

function StudioTimeline({
  fileName,
  duration,
  currentTime,
  isPlaying,
  onPlayToggle,
  onRestart,
  onSeek,
  masterVolume = 1.0,
  onMasterVolumeChange,
  // Stem ZIP download & format options
  stemResult = null,
  downloadFormat = 'mp3',
  onFormatChange,
  // Selection region
  startSec = 0,
  endSec = 0,
  onStartChange,
  onEndChange,
  hasSelection = false,
  setHasSelection,
  showSelection = false,
  // Real waveform peaks
  peaks = null,
}) {
  const trackRef = useRef(null)
  const dragging = useRef(null)
  const dragStart = useRef({ clientX: 0, start: 0, end: 0 })

  const total = Math.max(0.1, duration || 1)
  const startPct = Math.max(0, Math.min(100, (startSec / total) * 100))
  const endPct = Math.max(0, Math.min(100, (endSec / total) * 100))
  const progressRatio = Math.max(0, Math.min(1, currentTime / total))
  const progressPct = progressRatio * 100

  // Timecode Ruler ticks (9 evenly spaced time marks across the actual duration)
  const ticks = useMemo(() => {
    const count = 9
    return Array.from({ length: count }, (_, i) => (total / (count - 1)) * i)
  }, [total])

  const secFromEvent = (e) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(pct * total * 10) / 10
  }

  // Handle waveform click / drag for seek
  const handleTrackMouseDown = (e) => {
    if (dragging.current) return
    const clickSec = secFromEvent(e)
    
    if (showSelection && setHasSelection && hasSelection) {
      if (clickSec < startSec || clickSec > endSec) {
        setHasSelection(false)
        onStartChange && onStartChange(0)
        onEndChange && onEndChange(total)
        onSeek && onSeek(clickSec)
      } else {
        onSeek && onSeek(clickSec)
      }
    } else {
      onSeek && onSeek(clickSec)
    }
  }

  // Handle region handle dragging
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const sec = secFromEvent(e)

      if (setHasSelection) setHasSelection(true)

      if (dragging.current === 'start' && onStartChange) {
        onStartChange(Math.max(0, Math.min(sec, endSec - 1.0)))
      } else if (dragging.current === 'end' && onEndChange) {
        onEndChange(Math.min(total, Math.max(sec, startSec + 1.0)))
      } else if (dragging.current === 'body' && onStartChange && onEndChange) {
        const deltaX = clientX - dragStart.current.clientX
        const deltaSec = (deltaX / rect.width) * total
        const selWidth = dragStart.current.end - dragStart.current.start
        
        let newStart = dragStart.current.start + deltaSec
        let newEnd = dragStart.current.end + deltaSec

        if (newStart < 0) {
          newStart = 0
          newEnd = selWidth
        } else if (newEnd > total) {
          newEnd = total
          newStart = total - selWidth
        }

        onStartChange(parseFloat(newStart.toFixed(1)))
        onEndChange(parseFloat(newEnd.toFixed(1)))
      }
    }

    const onUp = () => {
      dragging.current = null
    }

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
  }, [startSec, endSec, total, setHasSelection, onStartChange, onEndChange])

  return (
    <div className="studio-timeline" data-purpose="master-waveform-card">
      {/* Top Header Row (Metadata + ZIP Downloads if available) */}
      <div className="st-header">
        <div className="st-info">
          <h1 className="st-filename">{fileName || 'Master Audio Track'}</h1>
          <p className="st-meta">
            {stemResult ? `${Object.keys(stemResult.stems || {}).length} Stems • ` : ''}{formatTime(total)}
          </p>
        </div>

        {stemResult?.job_id && (
          <div className="st-header-actions">
            <div className="format-toggle">
              {['mp3', 'wav'].map(f => (
                <button
                  key={f}
                  className={`format-btn ${downloadFormat === f ? 'active' : ''}`}
                  onClick={() => onFormatChange && onFormatChange(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <a
              href={`${API_BASE_URL}/download-stems/${stemResult.job_id}?format=${downloadFormat}`}
              download={`${fileName?.split('.')[0] || 'master'}_stems.zip`}
              className="btn-all-stems-zip"
              style={{ textDecoration: 'none' }}
            >
              <Download size={14} />
              <span>All Stems (ZIP)</span>
            </a>
          </div>
        )}
      </div>

      {/* Real DAW Waveform Canvas display with interactive seek & selection */}
      <div
        className="st-track-wrap"
        ref={trackRef}
        onMouseDown={handleTrackMouseDown}
        onMouseMove={(e) => { if (e.buttons === 1 && !dragging.current) handleTrackMouseDown(e) }}
      >
        <DawWaveformCanvas
          peaks={peaks}
          progress={progressRatio}
          height={120}
          playedColor="#f59e0b"
          unplayedColor="#2a3142"
          centerLineColor="rgba(255, 255, 255, 0.05)"
          interactive={false}
        />

        {/* Selection overlay (for trim/region selector mode) */}
        {showSelection && hasSelection && (
          <div
            className="st-selection-overlay"
            style={{
              left: `${startPct}%`,
              width: `${Math.max(0, endPct - startPct)}%`,
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dragging.current = 'body'
              const clientX = e.touches ? e.touches[0].clientX : e.clientX
              dragStart.current = { clientX, start: startSec, end: endSec }
            }}
          />
        )}

        {/* Selection Handles */}
        {showSelection && (
          <motion.div
            className="st-handle"
            style={{ left: `${startPct}%` }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dragging.current = 'start'
            }}
            onTouchStart={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dragging.current = 'start'
            }}
            whileHover={{ scale: 1.12 }}
          >
            <div className="st-handle-grip" />
          </motion.div>
        )}

        {showSelection && (
          <motion.div
            className="st-handle"
            style={{ left: `${endPct}%` }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dragging.current = 'end'
            }}
            onTouchStart={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dragging.current = 'end'
            }}
            whileHover={{ scale: 1.12 }}
          >
            <div className="st-handle-grip" />
          </motion.div>
        )}

        {/* Playhead Scrub Line with Bead & Tooltip */}
        <div
          className="st-playhead"
          style={{ left: `${progressPct}%` }}
        >
          <div className="st-playhead-cap" />
          <div className="st-playhead-tag">
            {formatTime(currentTime)}
          </div>
        </div>
      </div>

      {/* Axis timeline ticks */}
      <div className="st-time-axis">
        {ticks.map((t, i) => (
          <span key={i}>{formatTime(t)}</span>
        ))}
      </div>

      {/* Master Controls: Compact Transport (Play + Restart), Time Display, Master Volume */}
      <div className="st-controls">
        {/* Compact Transport Group: [ Play/Pause ] [ Restart ] */}
        <div className="master-transport-group">
          <button
            className={`master-btn play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={onPlayToggle}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button
            className="master-btn restart-btn"
            onClick={onRestart}
            title="Restart to 0:00"
          >
            <SkipBack size={18} />
          </button>
        </div>

        {/* Master Position & Duration Display */}
        <div className="st-time-display">
          <span className="current-time">{formatTime(currentTime)}</span>
          <span className="time-sep">/</span>
          <span className="total-time">{formatTime(total)}</span>
        </div>

        {/* Master Volume Control */}
        <div className="master-vol-control">
          <button
            className="master-vol-btn"
            onClick={() => onMasterVolumeChange && onMasterVolumeChange(masterVolume === 0 ? 1.0 : 0)}
            title={masterVolume === 0 ? 'Unmute Master' : 'Mute Master'}
          >
            {masterVolume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            className="audio-fader master-vol-slider"
            min={0}
            max={1.5}
            step={0.01}
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange && onMasterVolumeChange(parseFloat(e.target.value))}
            title={`Master Volume: ${Math.round(masterVolume * 100)}%`}
          />
          <span className="master-vol-readout">{Math.round(masterVolume * 100)}%</span>
        </div>

        {showSelection && hasSelection && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              if (setHasSelection && onStartChange && onEndChange) {
                setHasSelection(false)
                onStartChange(0)
                onEndChange(total)
              }
            }}
          >
            Clear Selection
          </button>
        )}
      </div>
    </div>
  )
}

export default memo(StudioTimeline)
