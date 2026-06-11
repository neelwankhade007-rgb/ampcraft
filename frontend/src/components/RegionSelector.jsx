import React, { useEffect, useRef } from 'react'
import { formatTime } from '../utils/formatTime'

// Region Selector component for selecting trim duration of uploaded song before separating
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
