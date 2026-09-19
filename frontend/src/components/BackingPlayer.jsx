

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, SkipBack } from 'lucide-react'
import { formatTime } from '../utils/formatTime'
import DawWaveformCanvas from './DawWaveformCanvas'

export default function BackingPlayer({ src }) {
  const audioRef                      = useRef(null)
  const trackRef                      = useRef(null)
  const [playing, setPlaying]         = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]       = useState(0)
  const [muted, setMuted]             = useState(false)
  const [volume, setVolume]           = useState(1.0)
  const [peaks, setPeaks]             = useState(null)

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
    if (audioRef.current) {
      audioRef.current.muted = muted
      audioRef.current.volume = Math.min(1.0, volume)
    }
  }, [muted, volume])

  // Fetch and decode audio to generate peaks for DawWaveformCanvas
  useEffect(() => {
    let active = true
    setPeaks(null)

    const fetchPeaks = async () => {
      try {
        const response = await fetch(src)
        const arrayBuffer = await response.arrayBuffer()
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        if (!active) return

        const numBars = 200
        const channel = audioBuffer.getChannelData(0)
        const samplesPerBar = Math.floor(channel.length / numBars)
        if (samplesPerBar < 1) return

        const p = new Float32Array(numBars)
        for (let i = 0; i < numBars; i++) {
          let max = 0
          const start = i * samplesPerBar
          const end = Math.min(start + samplesPerBar, channel.length)
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channel[j])
            if (abs > max) max = abs
          }
          p[i] = max
        }
        setPeaks(p)
      } catch (err) {
        console.error("Failed to decode audio for waveform:", err)
      }
    }
    
    if (src) fetchPeaks()
    return () => { active = false }
  }, [src])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    playing ? audio.pause() : audio.play()
  }

  const handleSeek = useCallback((e) => {
    if (!trackRef.current || !audioRef.current || duration === 0) return
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const time = pct * duration
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }, [duration])

  const progressRatio = duration > 0 ? currentTime / duration : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Waveform Area */}
      <div 
        ref={trackRef}
        className="st-track-wrap" 
        onMouseDown={handleSeek}
        onMouseMove={(e) => { if (e.buttons === 1) handleSeek(e) }}
        onTouchStart={handleSeek}
        onTouchMove={handleSeek}
        style={{ cursor: 'pointer', height: 120 }}
      >
        <DawWaveformCanvas
          peaks={peaks}
          progress={progressRatio}
          height={120}
          playedColor="#f59e0b"
          unplayedColor="#2a3142"
          centerLineColor="rgba(255, 255, 255, 0.05)"
          interactive={false}
        />
        {/* Playhead line overlay */}
        <div 
          style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${progressRatio * 100}%`,
            width: 2, background: 'rgba(255,255,255,0.8)',
            transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 4
          }}
        />
      </div>

      {/* Controls Area */}
      <div className="st-controls" style={{ borderTop: 'none', paddingTop: 0 }}>
        <audio ref={audioRef} src={src} preload="metadata" />

        {/* Compact Transport Group: [ Play/Pause ] [ Restart ] */}
        <div className="master-transport-group">
          <button
            className={`master-btn play-btn ${playing ? 'playing' : ''}`}
            onClick={togglePlay}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button
            className="master-btn restart-btn"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0
                setCurrentTime(0)
              }
            }}
            title="Restart to 0:00"
          >
            <SkipBack size={18} />
          </button>
        </div>

        {/* Position & Duration Display */}
        <div className="st-time-display">
          <span className="current-time">{formatTime(currentTime)}</span>
          <span className="time-sep">/</span>
          <span className="total-time">{formatTime(duration || 0)}</span>
        </div>

        {/* Mute/Volume Control */}
        <div className="master-vol-control">
          <button
            className="master-vol-btn"
            onClick={() => {
              if (volume === 0) {
                setVolume(1.0)
                setMuted(false)
              } else {
                setMuted(m => !m)
              }
            }}
            title={muted || volume === 0 ? 'Unmute' : 'Mute'}
            style={muted || volume === 0 ? { color: '#ef4444' } : {}}
          >
            {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            className="audio-fader master-vol-slider"
            min={0}
            max={1.5}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              setVolume(v)
              if (v > 0) setMuted(false)
            }}
            title={`Volume: ${Math.round((muted ? 0 : volume) * 100)}%`}
          />
          <span className="master-vol-readout">{Math.round((muted ? 0 : volume) * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
