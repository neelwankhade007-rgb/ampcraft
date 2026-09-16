import React, { useRef } from 'react'

export default function WaveformPlayer({
  currentTime,
  duration,
  onSeek,
  peaks = null,
  customColor = null,
  height = 52,
}) {
  const trackRef = useRef(null)
  const total     = duration || 1
  const progress  = (currentTime / total) * 100

  // Normalize peaks to [0..1] range for rendering
  const normalizedBars = React.useMemo(() => {
    if (!peaks || peaks.length === 0) {
      // Empty placeholder bars when no peak data is available
      return Array.from({ length: 80 }, () => 5)
    }
    // Find max peak for normalization
    let maxPeak = 0
    for (let i = 0; i < peaks.length; i++) {
      if (peaks[i] > maxPeak) maxPeak = peaks[i]
    }
    if (maxPeak === 0) maxPeak = 1
    // Map to percentage heights (5% min so bars are always visible)
    return Array.from(peaks, v => Math.round(5 + (v / maxPeak) * 85))
  }, [peaks])

  const seekFromEvent = (e) => {
    if (!trackRef.current || !onSeek) return
    const rect    = trackRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const pct     = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeek(pct * total)
  }

  return (
    <div
      ref={trackRef}
      className="waveform-wrap"
      style={{ height: `${height}px` }}
      onMouseDown={seekFromEvent}
      onMouseMove={(e) => { if (e.buttons === 1) seekFromEvent(e) }}
    >
      <div className="waveform-bars">
        {normalizedBars.map((h, i) => {
          const barPct  = (i / normalizedBars.length) * 100
          const isActive = barPct <= progress

          let bg = isActive
            ? (customColor || 'color-mix(in srgb, var(--accent) 65%, transparent)')
            : 'rgba(255,255,255,0.07)'

          return (
            <div
              key={i}
              className="waveform-bar"
              style={{ height: `${h}%`, background: bg }}
            />
          )
        })}
      </div>

      {/* Playhead */}
      <div
        className="waveform-playhead"
        style={{ left: `${progress}%` }}
      />
    </div>
  )
}
