import React from 'react'
import { Play, Pause, Download } from 'lucide-react'
import { formatTime } from '../utils/formatTime'
import WaveformPlayer from './WaveformPlayer'

export default function GlobalMixer({
  globalPlaying,
  globalTime,
  globalDuration,
  stemResult,
  downloadFormat,
  onPlayToggle,
  onSeek,
  onFormatChange,
}) {
  return (
    <div className="master-transport">
      {/* Top row: file info + time + download */}
      <div className="master-transport-top">
        <div className="master-info">
          <div className="master-filename">
            {stemResult.original_filename || 'Master Mix'}
          </div>
          <div className="master-meta">
            {Object.keys(stemResult.stems || {}).length} stems · {formatTime(globalDuration)}
          </div>
        </div>

        <div className="master-transport-controls">
          {stemResult.job_id && (
            <div className="format-toggle">
              {['mp3', 'wav'].map(f => (
                <button
                  key={f}
                  className={`format-btn ${downloadFormat === f ? 'active' : ''}`}
                  onClick={() => onFormatChange(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {stemResult.job_id && (
            <a
              href={`http://localhost:8000/download-stems/${stemResult.job_id}?format=${downloadFormat}`}
              download={`${stemResult.original_filename?.split('.')[0]}_stems.zip`}
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              <Download size={13} />
              All Stems
            </a>
          )}
        </div>
      </div>

      {/* Transport controls + waveform */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className={`btn btn-primary btn-icon ${globalPlaying ? 'playing' : ''}`}
          onClick={onPlayToggle}
          style={globalPlaying ? { background: 'rgba(255,255,255,0.1)', color: 'var(--text)' } : {}}
          title={globalPlaying ? 'Pause' : 'Play All'}
        >
          {globalPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <WaveformPlayer
          currentTime={globalTime}
          duration={globalDuration}
          onSeek={onSeek}
          fileName={stemResult.original_filename}
          height={52}
        />

        <span className="master-time">
          {formatTime(globalTime)} / {formatTime(globalDuration || 0)}
        </span>
      </div>
    </div>
  )
}
