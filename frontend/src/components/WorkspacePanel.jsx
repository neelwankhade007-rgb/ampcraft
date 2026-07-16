import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, AlertCircle } from 'lucide-react'
import { formatTime } from '../utils/formatTime'

// ────────────────────────────────────────────────────────────────
// WorkspacePanel — Left sidebar. Metadata, status, and replace only.
// No upload zone. No progress bar. No download controls.
// ────────────────────────────────────────────────────────────────

export default function WorkspacePanel({
  mode = 'upload',   // 'upload' | 'file' | 'processing' | 'result' | 'backing-result'
  file,
  audioDuration,
  sampleRate,
  error,
  onReplaceFile,
  onCancelProcessing,
}) {
  // Status computation
  let statusText = 'No file'
  if (mode === 'file') statusText = 'Ready'
  else if (mode === 'processing') statusText = 'Processing'
  else if (mode === 'result' || mode === 'backing-result') statusText = 'Completed'

  const panelVariants = {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.18 } },
    exit:    { opacity: 0, x: -8, transition: { duration: 0.12 } },
  }

  return (
    <aside className="workspace-panel">
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          {...panelVariants}
          style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
        >
          {/* ── AUDIO SOURCE METADATA ── */}
          <div className="wp-section">
            <span className="wp-label">Audio Source</span>
            <div className="wp-metadata-group">
              <div className="wp-metadata-item">
                <span className="wp-metadata-label">File</span>
                <span className="wp-metadata-value truncate" title={file?.name || 'No file selected'}>
                  {file ? file.name : 'No file selected'}
                </span>
              </div>
              <div className="wp-metadata-item">
                <span className="wp-metadata-label">Duration</span>
                <span className="wp-metadata-value">
                  {file && audioDuration > 0 ? formatTime(audioDuration) : '—'}
                </span>
              </div>
              <div className="wp-metadata-item">
                <span className="wp-metadata-label">Sample Rate</span>
                <span className="wp-metadata-value">
                  {file && sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : '—'}
                </span>
              </div>
              <div className="wp-metadata-item">
                <span className="wp-metadata-label">Status</span>
                <span className={`wp-metadata-value status-${statusText.toLowerCase().replace(' ', '-')}`}>
                  {statusText}
                </span>
              </div>
            </div>
          </div>

          {/* ── SUPPORTED FORMATS ── */}
          <div className="wp-section">
            <span className="wp-label">Supported Formats</span>
            <div className="wp-formats">
              {['MP3', 'WAV', 'FLAC', 'M4A', 'OGG', 'AIFF'].map(f => (
                <span key={f} className="wp-format-chip">{f}</span>
              ))}
            </div>
          </div>

          {/* ── ERROR ── */}
          {error && (
            <div className="wp-section">
              <div className="error-bar">
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                {error}
              </div>
            </div>
          )}

          {/* ── BOTTOM ACTIONS ── */}
          {mode !== 'upload' && (
            <div style={{ marginTop: 'auto' }}>
              <div className="wp-section">
                {mode === 'processing' ? (
                  <button
                    className="btn btn-danger btn-sm btn-full"
                    onClick={onCancelProcessing}
                  >
                    <X size={12} />
                    Cancel Task
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm btn-full"
                    onClick={onReplaceFile}
                  >
                    <Upload size={12} />
                    Replace File
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </aside>
  )
}
