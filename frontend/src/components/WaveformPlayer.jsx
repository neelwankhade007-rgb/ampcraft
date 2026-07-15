import React, { useRef, useMemo } from 'react'

export default function WaveformPlayer({
  currentTime,
  duration,
  onSeek,
  fileName,
  customColor = null,
  height = 52,
}) {
  const trackRef = useRef(null)
  const total     = duration || 1
  const progress  = (currentTime / total) * 100

  const bars = useMemo(() => {
    let seed = 0
    const name = fileName || 'waveform'
    for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i)
    const rng = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s) }
    return Array.from({ length: 120 }, (_, i) => Math.round(10 + rng(seed + i * 7.3) * 80))
  }, [fileName])

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
        {bars.map((h, i) => {
          const barPct  = (i / bars.length) * 100
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
