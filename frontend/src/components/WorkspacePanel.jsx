import React, { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Music2, X, Loader2, Download, AlertCircle } from 'lucide-react'
import { formatTime } from '../utils/formatTime'

// ────────────────────────────────────────────────────────────────
// Modes:
//   'upload'     — no file selected
//   'file'       — file loaded, idle
//   'processing' — AI job running
//   'result'     — job complete (separator)
//   'backing-result' — job complete (backing)
// ────────────────────────────────────────────────────────────────

export default function WorkspacePanel({
  mode = 'upload',
  file,
  audioDuration,
  dragging,
  error,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  onReplaceFile,
  // processing
  processingProgress,
  processingStage,
  onCancelProcessing,
  // result (stems)
  stemResult,
  downloadFormat,
  onFormatChange,
  // children slot for module-specific panel content
  children,
}) {
  const fileInputRef = useRef(null)

  const fileExt  = file ? file.name.split('.').pop().toUpperCase() : ''
  const fileSize = file ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' : ''

  const panelVariants = {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0,  transition: { duration: 0.18 } },
    exit:    { opacity: 0, x: -8, transition: { duration: 0.12 } },
  }

  return (
    <aside className="workspace-panel">
      <AnimatePresence mode="wait">

        {/* ── UPLOAD MODE ── */}
        {mode === 'upload' && (
          <motion.div key="upload" {...panelVariants} style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
            <div className="wp-section">
              <span className="wp-label">Audio Source</span>
              <div
                className={`wp-drop-zone ${dragging ? 'drag-over' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="wp-drop-icon">
                  <Upload size={16} />
                </div>
                <span className="wp-drop-title">Drop audio here</span>
                <span className="wp-drop-sub">or <span>click to browse</span></span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
            </div>

            <div className="wp-section">
              <span className="wp-label">Supported Formats</span>
              <div className="wp-formats">
                {['MP3', 'WAV', 'FLAC', 'M4A', 'OGG', 'AIFF'].map(f => (
                  <span key={f} className="wp-format-chip">{f}</span>
                ))}
              </div>
            </div>

            {error && (
              <div className="wp-section">
                <div className="error-bar">
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── FILE MODE ── */}
        {(mode === 'file' || mode === 'result' || mode === 'backing-result') && (
          <motion.div key="file" {...panelVariants} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* File Info */}
            <div className="wp-section">
              <span className="wp-label">Current File</span>
              <div className="wp-file-card">
                <div className="wp-file-icon-row">
                  <div className="wp-file-icon">
                    <Music2 size={16} />
                  </div>
                  <span className="wp-file-name" title={file?.name}>{file?.name}</span>
                </div>
                <div className="wp-meta-row">
                  {fileExt  && <span className="wp-meta-chip">{fileExt}</span>}
                  {fileSize && <span className="wp-meta-chip">{fileSize}</span>}
                  {audioDuration > 0 && (
                    <span className="wp-meta-chip">{formatTime(audioDuration)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Replace File */}
            <div className="wp-section">
              <button
                className="btn btn-ghost btn-sm btn-full"
                onClick={onReplaceFile}
              >
                <Upload size={12} />
                Replace File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
            </div>

            {error && (
              <div className="wp-section">
                <div className="error-bar">
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              </div>
            )}

            {/* Result exports */}
            {mode === 'result' && stemResult?.job_id && (
              <div className="wp-section">
                <span className="wp-label">Download All Stems</span>
                <div className="wp-export">
                  <div className="format-toggle" style={{ alignSelf: 'flex-start' }}>
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
                  <a
                    href={`http://localhost:8000/download-stems/${stemResult.job_id}?format=${downloadFormat}`}
                    download={`${stemResult.original_filename?.split('.')[0]}_stems.zip`}
                    className="btn btn-secondary btn-sm btn-full"
                    style={{ textDecoration: 'none' }}
                  >
                    <Download size={12} />
                    Download ZIP
                  </a>
                </div>
              </div>
            )}

            {/* Module-specific panel slot */}
            {children}
          </motion.div>
        )}

        {/* ── PROCESSING MODE ── */}
        {mode === 'processing' && (
          <motion.div key="processing" {...panelVariants} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="wp-section">
              <span className="wp-label">Processing</span>
              <div className="wp-processing">
                <div className="wp-progress-label">
                  <span className="wp-stage-name">{processingStage || 'Working…'}</span>
                  <span className="wp-pct">{processingProgress || 0}%</span>
                </div>
                <div className="wp-progress-track">
                  <div
                    className="wp-progress-fill"
                    style={{ width: `${processingProgress || 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="wp-section">
              <button
                className="btn btn-danger btn-sm btn-full"
                onClick={onCancelProcessing}
              >
                <X size={12} />
                Cancel Task
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </aside>
  )
}
