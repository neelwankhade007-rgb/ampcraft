import React, { useRef, useEffect, memo } from 'react'

/**
 * DawWaveformCanvas
 * Renders a traditional, continuous audio envelope on a canvas from real AudioBuffer/Float32Array min-max peaks.
 * Non-destructive, high performance, handles DPR scaling, seeking and playhead progress.
 */
function DawWaveformCanvas({
  peaks,            // Array or Float32Array of min/max or peak amplitude data
  progress = 0,     // 0 to 1 progress ratio
  onSeek = null,    // callback(clickRatio: number)
  height = 96,
  playedColor = '#f59e0b',
  unplayedColor = '#2a3142',
  centerLineColor = 'rgba(255, 255, 255, 0.05)',
  interactive = true,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const width = rect.width || canvas.parentElement?.clientWidth || 600
      const canvasHeight = height

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(canvasHeight * dpr)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)

      // Clear
      ctx.clearRect(0, 0, width, canvasHeight)

      const centerY = canvasHeight / 2

      // Center zero reference line
      ctx.strokeStyle = centerLineColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(width, centerY)
      ctx.stroke()

      if (!peaks || peaks.length === 0) {
        // Draw quiet baseline if no audio data
        ctx.strokeStyle = unplayedColor
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, centerY)
        ctx.lineTo(width, centerY)
        ctx.stroke()
        return
      }

      const step = 2.4
      const barWidth = 1.6
      const totalPoints = Math.floor(width / step)

      // Find maximum peak across array for normalization
      let maxVal = 0
      for (let i = 0; i < peaks.length; i++) {
        const v = typeof peaks[i] === 'object' ? Math.max(Math.abs(peaks[i].min || 0), Math.abs(peaks[i].max || 0)) : Math.abs(peaks[i])
        if (v > maxVal) maxVal = v
      }
      if (maxVal === 0) maxVal = 1

      const playheadX = progress * width

      for (let i = 0; i < totalPoints; i++) {
        const x = i * step
        const peakIdx = Math.floor((i / totalPoints) * peaks.length)
        const rawVal = peaks[peakIdx]
        
        let amp = 0
        if (typeof rawVal === 'number') {
          amp = rawVal / maxVal
        } else if (rawVal && typeof rawVal === 'object') {
          amp = Math.max(Math.abs(rawVal.min || 0), Math.abs(rawVal.max || 0)) / maxVal
        }

        // Amplitude mapping with natural peak curves
        const normalizedAmp = Math.min(Math.max(amp, 0.03), 0.96)
        const barHeight = normalizedAmp * (centerY - 6)

        const isPlayed = x <= playheadX

        if (isPlayed) {
          ctx.fillStyle = playedColor
          ctx.shadowColor = 'rgba(245, 158, 11, 0.35)'
          ctx.shadowBlur = 2
        } else {
          ctx.fillStyle = unplayedColor
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }

        // Draw symmetric DAW peak envelope
        const topY = centerY - barHeight
        const totalH = Math.max(2, barHeight * 2)

        ctx.beginPath()
        if (ctx.roundRect) {
          ctx.roundRect(x, topY, barWidth, totalH, [0.8])
        } else {
          ctx.rect(x, topY, barWidth, totalH)
        }
        ctx.fill()
      }
    }

    render()

    const resizeObserver = new ResizeObserver(() => {
      render()
    })
    resizeObserver.observe(canvas)

    window.addEventListener('resize', render)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', render)
    }
  }, [peaks, progress, height, playedColor, unplayedColor, centerLineColor])

  const handleClick = (e) => {
    if (!interactive || !onSeek || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeek(ratio)
  }

  return (
    <canvas
      ref={canvasRef}
      className="daw-waveform-canvas"
      style={{
        width: '100%',
        height: `${height}px`,
        display: 'block',
        cursor: interactive ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onClick={handleClick}
    />
  )
}

export default memo(DawWaveformCanvas)
