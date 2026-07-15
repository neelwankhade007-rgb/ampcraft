import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { formatTime } from '../utils/formatTime'
import WaveformPlayer from './WaveformPlayer'

export default function BackingPlayer({ src }) {
  const audioRef                      = useRef(null)
  const [playing, setPlaying]         = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]       = useState(0)
  const [muted, setMuted]             = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay        = () => setPlaying(true)
    const onPause       = () => setPlaying(false)
    const onTimeUpdate  = () => setCurrentTime(audio.currentTime)
    const onLoadedMeta  = () => setDuration(audio.duration)
    const onEnded       = () => { setPlaying(false); setCurrentTime(0) }

    audio.addEventListener('play',           onPlay)
    audio.addEventListener('pause',          onPause)
    audio.addEventListener('timeupdate',     onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMeta)
    audio.addEventListener('ended',          onEnded)

    return () => {
      audio.removeEventListener('play',           onPlay)
      audio.removeEventListener('pause',          onPause)
      audio.removeEventListener('timeupdate',     onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMeta)
      audio.removeEventListener('ended',          onEnded)
    }
  }, [src])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    playing ? audio.pause() : audio.play()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        className={`btn btn-primary btn-icon ${playing ? '' : ''}`}
        style={playing ? { background: 'rgba(255,255,255,0.1)', color: 'var(--text)' } : {}}
        onClick={togglePlay}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>

      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, minWidth: 32 }}>
        {formatTime(currentTime)}
      </span>

      <WaveformPlayer
        currentTime={currentTime}
        duration={duration}
        onSeek={(time) => {
          if (audioRef.current) {
            audioRef.current.currentTime = time
            setCurrentTime(time)
          }
        }}
        fileName={src}
        height={42}
      />

      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
        {formatTime(duration || 0)}
      </span>

      <button
        onClick={() => setMuted(m => !m)}
        className="btn btn-ghost btn-icon btn-sm"
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </button>
    </div>
  )
}
