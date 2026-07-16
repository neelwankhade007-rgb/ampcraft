import React, { useRef, useMemo, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatTime } from '../utils/formatTime'

export default function StudioTimeline({
  fileName,
  duration,
  currentTime,
  isPlaying,
  onPlayToggle,
  onSeek,
  // Selection
  startSec,
  endSec,
  onStartChange,
  onEndChange,
  hasSelection,
  setHasSelection,
  showSelection,
}) {
  const trackRef = useRef(null)
  const dragging = useRef(null)
  const dragStart = useRef({ clientX: 0, start: 0, end: 0 })

  const total = duration || 1
  const startPct = (startSec / total) * 100
  const endPct = (endSec / total) * 100
  const progressPct = (currentTime / total) * 100

  // Deterministic fake waveform from filename
  const bars = useMemo(() => {
    let seed = 0
    const name = fileName || 'waveform'
    for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i)
    const rng = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s) }
    return Array.from({ length: 100 }, (_, i) => Math.round(15 + rng(seed + i * 7.3) * 75))
  }, [fileName])

  // Timeline ticks (5 evenly spaced ticks)
  const ticks = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => (total / 4) * i)
  }, [total])

  const secFromEvent = (e) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(pct * total * 10) / 10
  }

  // Handle outside track clicks (seeks or clears selection)
  const handleTrackMouseDown = (e) => {
    // Prevent triggering seek if dragging a handle
    if (dragging.current) return

    const clickSec = secFromEvent(e)
    
    if (showSelection) {
      if (clickSec < startSec || clickSec > endSec) {
        // Clicked outside: clear selection, reset start/end, and seek
        setHasSelection(false)
        onStartChange(0)
        onEndChange(total)
        onSeek(clickSec)
      } else {
        // Clicked inside selection: just seek
        onSeek(clickSec)
      }
    } else {
      // Direct seek
      onSeek(clickSec)
    }
  }

  // Dragging event loop
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const sec = secFromEvent(e)

      setHasSelection(true)

      if (dragging.current === 'start') {
        onStartChange(Math.max(0, Math.min(sec, endSec - 1.0)))
      } else if (dragging.current === 'end') {
        onEndChange(Math.min(total, Math.max(sec, startSec + 1.0)))
      } else if (dragging.current === 'body') {
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
  }, [startSec, endSec, total, setHasSelection])

  return (
    <div className="studio-timeline">
      {/* Waveform track wrapper */}
      <div
        className="st-track-wrap"
        ref={trackRef}
        onMouseDown={handleTrackMouseDown}
      >
        {/* Waveform bars */}
        <div className="st-waveform">
          {bars.map((h, i) => {
            const barPct = (i / bars.length) * 100
            
            // Check if inside selection range
            const inSelection = !showSelection || !hasSelection || (barPct >= startPct && barPct <= endPct)
            // Check if past current playhead
            const active = barPct <= progressPct

            let barClass = 'st-bar'
            if (inSelection) barClass += ' highlighted'
            if (active) barClass += ' active'

            return (
              <div
                key={i}
                className={barClass}
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>

        {/* Selection overlay (Backing Generator range selector) */}
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

        {/* Start selection handle */}
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

        {/* End selection handle */}
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

        {/* Playhead indicator */}
        <div
          className="st-playhead"
          style={{ left: `${progressPct}%` }}
        >
          <div className="st-playhead-cap" />
        </div>
      </div>

      {/* Axis timeline grid */}
      <div className="st-time-axis">
        {ticks.map((t, i) => (
          <span key={i}>{formatTime(t)}</span>
        ))}
      </div>

      {/* Playback action controls bar */}
      <div className="st-controls">
        <div className="st-play-info">
          <button
            className={`btn btn-primary btn-icon ${isPlaying ? 'playing' : ''}`}
            onClick={onPlayToggle}
            style={isPlaying ? { background: 'rgba(255,255,255,0.1)', color: 'var(--text)' } : {}}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          
          <div className="st-time-display">
            {formatTime(currentTime)} / {formatTime(total)}
          </div>
        </div>

        {showSelection && hasSelection && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setHasSelection(false)
              onStartChange(0)
              onEndChange(total)
            }}
          >
            Clear Selection
          </button>
        )}
      </div>
    </div>
  )
}
