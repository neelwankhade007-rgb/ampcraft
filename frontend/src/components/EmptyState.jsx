import React from 'react'

// Placeholder shown in the main area when no file has been loaded yet
export default function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-graphic">✂️</div>
      <h3>Ready to Split Stems</h3>
      <p>Upload a track from the sidebar to extract vocal, guitar, bass, drum, and piano stems.</p>
    </div>
  )
}
