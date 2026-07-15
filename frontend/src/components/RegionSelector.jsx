import React, { useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Play, Square, Scissors } from 'lucide-react'
import { formatTime } from '../utils/formatTime'

export default function RegionSelector({
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
  fileName,
  buttonLabel,
  buttonIcon,
}) {
  const trackRef = useRef(null)
  const dragging = useRef(null)

  const total    = duration || 1
  const startPct = (startSec / total) * 100
  const endPct   = (endSec   / total) * 100
  const selDur   = endSec - startSec

  // Deterministic fake waveform from filename
  const bars = useMemo(() => {
    let seed = 0
    const name = fileName || 'waveform'
    for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i)
    const rng = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s) }
    return Array.from({ length: 90 }, (_, i) => Math.round(12 + rng(seed + i * 7.3) * 78))
  }, [fileName])

  // Timeline ticks (5 evenly spaced)
  const ticks = Array.from({ length: 5 }, (_, i) => (total / 4) * i)

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
    window.addEventListener('mouseup',   onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend',  onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onUp)
    }
  }, [startSec, endSec, total])

  return (
    <div className="region-selector">
      {/* Header */}
      <div className="rs-header">
        <span className="rs-title">Audio Region</span>
        <span className="rs-badge">
          {formatTime(selDur)} / {formatTime(total)}
        </span>
      </div>

      {/* Waveform Track */}
      <div className="rs-track-wrap" ref={trackRef}>
        {/* Waveform bars */}
        <div className="rs-waveform">
          {bars.map((h, i) => {
            const pct = (i / bars.length) * 100
            const active = pct >= startPct && pct <= endPct
            return (
              <div
                key={i}
                className={`rs-bar ${active ? 'rs-bar-active' : ''}`}
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>

        {/* Selection overlay */}
        <div
          className="rs-selection"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />

        {/* Start handle */}
        <motion.div
          className="rs-handle"
          style={{ left: `${startPct}%` }}
          onMouseDown={(e) => { e.preventDefault(); dragging.current = 'start' }}
          onTouchStart={(e) => { e.preventDefault(); dragging.current = 'start' }}
          whileHover={{ scale: 1.15 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <div className="rs-handle-grip" />
        </motion.div>

        {/* End handle */}
        <motion.div
          className="rs-handle"
          style={{ left: `${endPct}%` }}
          onMouseDown={(e) => { e.preventDefault(); dragging.current = 'end' }}
          onTouchStart={(e) => { e.preventDefault(); dragging.current = 'end' }}
          whileHover={{ scale: 1.15 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <div className="rs-handle-grip" />
        </motion.div>
      </div>

      {/* Timeline ticks */}
      <div className="rs-timeline">
        {ticks.map((t, i) => (
          <span key={i} className="rs-tick">{formatTime(t)}</span>
        ))}
      </div>

      {/* Controls */}
      <div className="rs-controls">
        <div className="rs-inputs">
          <div className="rs-input-group">
            <label className="rs-input-label">Start</label>
            <input
              type="number"
              className="rs-input"
              value={startSec}
              min={0}
              max={endSec - 1}
              step={0.1}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) onStartChange(Math.max(0, Math.min(v, endSec - 1.0)))
              }}
            />
          </div>
          <span className="rs-sep">→</span>
          <div className="rs-input-group">
            <label className="rs-input-label">End</label>
            <input
              type="number"
              className="rs-input"
              value={endSec}
              min={startSec + 1}
              max={total}
              step={0.1}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) onEndChange(Math.min(total, Math.max(v, startSec + 1.0)))
              }}
            />
          </div>
        </div>

        <div className="rs-actions">
          <motion.button
            className={`btn btn-ghost ${playing ? 'btn-danger' : ''}`}
            onClick={playing ? onStop : onPlay}
            disabled={!duration}
            whileTap={{ scale: 0.96 }}
          >
            {playing
              ? <><Square size={13} /> Stop Preview</>
              : <><Play size={13} /> Preview</>
            }
          </motion.button>

          <motion.button
            className="btn btn-primary"
            onClick={onSeparate}
            disabled={loading || selDur < 1.0}
            whileTap={{ scale: 0.96 }}
          >
            {loading
              ? <><span className="spinner" /> Processing…</>
              : <>{buttonIcon || <Scissors size={13} />} {buttonLabel || 'Separate Stems'}</>
            }
          </motion.button>
        </div>
      </div>
    </div>
  )
}
