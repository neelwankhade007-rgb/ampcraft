import React, { useRef, useEffect, memo, useState } from 'react'
import WaveformLoadingState from './WaveformLoadingState'

/**
 * DawWaveformCanvas
 * Renders a traditional, continuous audio envelope on a canvas from real AudioBuffer/Float32Array min-max peaks.
 * Non-destructive, high performance, handles DPR scaling, seeking and playhead progress.
 * When peaks become available, progressively reveals the REAL waveform from left to right with a slow animation.
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
  const [revealProgress, setRevealProgress] = useState(1) // 0 to 1, controls reveal animation
  const animationRef = useRef(null)
  const prevPeaksRef = useRef(null)

  // Detect when new peaks arrive and trigger reveal animation
  useEffect(() => {
    if (peaks && peaks !== prevPeaksRef.current && peaks.length > 0) {
      // New real waveform data loaded - start slow reveal animation
      setRevealProgress(0)
      prevPeaksRef.current = peaks

      let start = null
      const duration = 1500 // 1.5 seconds for slow, smooth reveal

      const animate = (timestamp) => {
        if (!start) start = timestamp
        const elapsed = timestamp - start
        const progress = Math.min(elapsed / duration, 1)

        // Ease-out for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3)
        setRevealProgress(eased)

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }

      animationRef.current = requestAnimationFrame(animate)

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    } else if (!peaks) {
      // Reset when peaks are cleared
      prevPeaksRef.current = null
      setRevealProgress(1)
    }
  }, [peaks])

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
      const revealX = revealProgress * width // Only render real waveform up to this X position

      for (let i = 0; i < totalPoints; i++) {
        const x = i * step

        // Only draw bars that are within the revealed region
        if (x > revealX) break

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
  }, [peaks, progress, height, playedColor, unplayedColor, centerLineColor, revealProgress])

  const handleClick = (e) => {
    if (!interactive || !onSeek || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeek(ratio)
  }

  // Show empty loading state while waiting for real peaks data
  if (!peaks || peaks.length === 0) {
    return (
      <WaveformLoadingState
        height={height}
        centerLineColor={centerLineColor}
      />
    )
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
