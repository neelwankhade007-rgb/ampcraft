import React, { useRef } from 'react'

// Sidebar with drag-and-drop upload zone, file info, error display, and reset button
export default function UploadSidebar({ file, dragging, error, onDragOver, onDragLeave, onDrop, onFileChange, onReset }) {
  const fileInputRef = useRef(null)

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1 className="brand">AmpCraft</h1>
        <p className="tagline">High-Quality AI Stem Separation</p>
      </header>

      <section className="upload-section">
        <div
          className={`drop-zone ${dragging ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? (
            <div className="dz-file-info">
              <span className="dz-file-icon">🎵</span>
              <p className="dz-filename">{file.name}</p>
            </div>
          ) : (
            <>
              <p className="dz-main">Drag &amp; drop audio</p>
              <p className="dz-sub">or <span>click to browse</span></p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        {error && <p className="error-msg">{error}</p>}

        {file && (
          <button className="reset-btn" onClick={onReset}>
            Clear File
          </button>
        )}
      </section>
    </aside>
  )
}
