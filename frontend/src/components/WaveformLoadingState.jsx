import React from 'react'

/**
 * WaveformLoadingState
 * Displays a minimal loading state while audio data is being fetched and decoded.
 * No fake waveform - just an empty container with center line.
 */
export default function WaveformLoadingState({
  height = 120,
  centerLineColor = 'rgba(255, 255, 255, 0.05)'
}) {
  return (
    <div
      className="daw-waveform-loading"
      style={{
        width: '100%',
        height: `${height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'transparent',
      }}
    >
      {/* Center line only - no fake waveform */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: '1px',
          background: centerLineColor,
          transform: 'translateY(-50%)',
        }}
      />
      {/* Subtle loading indicator */}
      <div
        style={{
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Loading...
      </div>
    </div>
  )
}
