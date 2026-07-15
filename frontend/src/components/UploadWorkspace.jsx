import React from 'react'
import { motion } from 'framer-motion'
import { Upload, Music2 } from 'lucide-react'

const FORMATS = ['MP3', 'WAV', 'FLAC', 'M4A', 'OGG', 'AIFF']

export default function UploadWorkspace({
  dragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  fileInputRef,
}) {
  return (
    <div className="upload-workspace">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`upload-drop-target ${dragging ? 'drag-over' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <motion.div
          className="upload-drop-icon"
          animate={dragging ? { scale: 1.12, color: 'var(--accent)' } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Upload size={26} />
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <span className="upload-drop-title">
            {dragging ? 'Release to load audio' : 'Drop your song here'}
          </span>
          <span className="upload-drop-sub">
            or <span>click to browse files</span>
          </span>
        </div>

        <div className="upload-formats">
          {FORMATS.map(f => (
            <span key={f} className="upload-format-chip">{f}</span>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </motion.div>
    </div>
  )
}
