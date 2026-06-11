import React, { useState, useEffect, useRef } from 'react'
import { formatTime } from '../utils/formatTime'

const BASE = 'http://localhost:8000'

// A custom row player for each isolated stem
export default function StemRow({ name, url, icon, label, registerAudio }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      // Pause all other audio elements if any
      document.querySelectorAll('audio').forEach(aud => {
        if (aud !== audioRef.current) {
          aud.pause()
        }
      })
      audioRef.current.play()
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    // Set initial volume
    audio.volume = volume

    // Register audio element with parent
    if (registerAudio) {
      registerAudio(audio)
    }

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      if (registerAudio) {
        registerAudio(null)
      }
    }
  }, [url, registerAudio])

  const handleSeek = (e) => {
    if (audioRef.current) {
      audioRef.current.currentTime = parseFloat(e.target.value)
    }
  }

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (audioRef.current) {
      audioRef.current.volume = val
    }
  }

  const toggleMute = () => {
    if (volume > 0) {
      setVolume(0)
      if (audioRef.current) audioRef.current.volume = 0
    } else {
      setVolume(0.8)
      if (audioRef.current) audioRef.current.volume = 0.8
    }
  }

  const fullUrl = `${BASE}${url}`
  // url is /stems/{job_id}/{filename} — route downloads through the force-download endpoint
  const urlParts = url.split('/')
  const downloadUrl = `${BASE}/download-stem/${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`

  return (
    <div className="stem-row-card">
      <div className="stem-info">
        <span className="stem-icon">{icon}</span>
        <div className="stem-meta">
          <span className="stem-label">{label}</span>
          <span className="stem-time">
            {formatTime(currentTime)} / {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      <div className="stem-player-controls">
        <button className={`stem-play-btn ${playing ? 'playing' : ''}`} onClick={togglePlay}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="16" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <input
          type="range"
          className="stem-seek-bar"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
        />

        <div className="stem-volume-container">
          <button className="stem-volume-btn" onClick={toggleMute} title="Mute/Unmute">
            {volume === 0 ? (
              <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
          <input
            type="range"
            className="stem-volume-slider"
            min={0}
            max={1.0}
            step={0.05}
            value={volume}
            onChange={handleVolumeChange}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>

        <a href={downloadUrl} className="stem-download-btn" title="Download WAV">
          <svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
      </div>

      <audio ref={audioRef} src={fullUrl} preload="metadata" />
    </div>
  )
}
