import React from 'react'
import { Download } from 'lucide-react'
import { formatTime } from '../utils/formatTime'

export default function GlobalMixer({
  globalDuration,
  stemResult,
  downloadFormat,
  onFormatChange,
}) {
  return (
    <div className="master-transport">
      {/* Top row: file info + time + download */}
      <div className="master-transport-top" style={{ borderBottom: 'none', paddingBottom: 0 }}>
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
    </div>
  )
}
