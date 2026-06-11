import React, { useState, useEffect, useRef } from 'react'
import { formatTime } from '../utils/formatTime'

/**
 * BackingPlayer — a minimal custom audio player styled for AmpCraft.
 * Props:
 *   src  {string}  Full URL of the audio file to play (MP3 recommended for fast seek).
 */
export default function BackingPlayer({ src }) {
  const audioRef = useRef(null)
  const [playing, setPlaying]       = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]     = useState(0)
  const [muted, setMuted]           = useState(false)

  // Wire up audio events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay         = () => setPlaying(true)
    const onPause        = () => setPlaying(false)
    const onTimeUpdate   = () => setCurrentTime(audio.currentTime)
    const onLoadedMeta   = () => setDuration(audio.duration)
    const onEnded        = () => { setPlaying(false); setCurrentTime(0) }

    audio.addEventListener('play',            onPlay)
    audio.addEventListener('pause',           onPause)
    audio.addEventListener('timeupdate',      onTimeUpdate)
    audio.addEventListener('loadedmetadata',  onLoadedMeta)
    audio.addEventListener('ended',           onEnded)

    return () => {
      audio.removeEventListener('play',           onPlay)
      audio.removeEventListener('pause',          onPause)
      audio.removeEventListener('timeupdate',     onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMeta)
      audio.removeEventListener('ended',          onEnded)
    }
  }, [src])

  // Sync mute state to audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    playing ? audio.pause() : audio.play()
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = parseFloat(e.target.value)
    setCurrentTime(audio.currentTime)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
    }}>
      {/* Hidden audio element — source of truth */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        className={`stem-play-btn ${playing ? 'playing' : ''}`}
        style={{ flexShrink: 0 }}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="15" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="15" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Current time */}
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0, minWidth: '36px' }}>
        {formatTime(currentTime)}
      </span>

      {/* Seek bar */}
      <input
        type="range"
        className="stem-seek-bar"
        min={0}
        max={duration || 100}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        style={{ flex: 1 }}
      />

      {/* Total duration */}
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0, minWidth: '36px', textAlign: 'right' }}>
        {formatTime(duration || 0)}
      </span>

      {/* Mute toggle icon */}
      <button
        onClick={() => setMuted(m => !m)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted ? 'var(--text-dim)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '2px' }}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? (
          <svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>
    </div>
  )
}
