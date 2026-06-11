import React from 'react'
import { formatTime } from '../utils/formatTime'

// Master mix panel: global play/seek/download controls for all stems
export default function GlobalMixer({
  globalPlaying,
  globalTime,
  globalDuration,
  stemResult,
  downloadFormat,
  onPlayToggle,
  onSeek,
  onFormatChange
}) {
  return (
    <div className="global-mixer-panel">
      <div className="mixer-header">
        <span className="mixer-title">🎛️ Master Mix</span>
        <span className="mixer-time">
          {formatTime(globalTime)} / {formatTime(globalDuration || 0)}
        </span>
      </div>
      <div className="mixer-controls">
        <button
          className={`mixer-play-btn ${globalPlaying ? 'playing' : ''}`}
          onClick={onPlayToggle}
          title={globalPlaying ? 'Pause All' : 'Play All Stems'}
        >
          {globalPlaying ? (
            <svg viewBox="0 0 24 24" width="18" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          <span>{globalPlaying ? 'Pause All' : 'Play All'}</span>
        </button>
        <input
          type="range"
          className="mixer-seek-bar"
          min={0}
          max={globalDuration || 100}
          step={0.1}
          value={globalTime}
          onChange={onSeek}
        />
        {stemResult.job_id && (
          <div className="mixer-download-group">
            <div className="format-toggle">
              <button
                className={`format-btn ${downloadFormat === 'mp3' ? 'active' : ''}`}
                onClick={() => onFormatChange('mp3')}
              >MP3</button>
              <button
                className={`format-btn ${downloadFormat === 'wav' ? 'active' : ''}`}
                onClick={() => onFormatChange('wav')}
              >WAV</button>
            </div>
            <a
              href={`http://localhost:8000/download-stems/${stemResult.job_id}?format=${downloadFormat}`}
              download={`${stemResult.original_filename.split('.')[0]}_stems_${downloadFormat}.zip`}
              className="mixer-download-btn"
              title={`Download all stems as ${downloadFormat.toUpperCase()} ZIP`}
            >
              <svg viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download All</span>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
