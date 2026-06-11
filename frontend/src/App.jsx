import React, { useState } from 'react'
import StemSeparator from './components/StemSeparator'
import BackingGenerator from './components/BackingGenerator'
import './index.css'

export default function App() {
  const [activeTab, setActiveTab] = useState('separator')
  const [jobId, setJobId] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* ── Top Navbar ── */}
      <nav className="navbar">
        <div className="navbar-brand-group">
          <span className="navbar-brand">AmpCraft</span>
          <span className="navbar-tagline">Audio separation utility</span>
        </div>

        <div className="navbar-tabs">
          <button
            className={`navbar-tab-btn ${activeTab === 'separator' ? 'active' : ''}`}
            onClick={() => setActiveTab('separator')}
          >
            Stem Separator
          </button>
          <button
            className={`navbar-tab-btn ${activeTab === 'backing' ? 'active' : ''}`}
            onClick={() => setActiveTab('backing')}
          >
            Backing Maker
          </button>
          <button
            className="navbar-tab-btn disabled"
            disabled
          >
            Tone Matcher
            <span className="soon-badge">Soon</span>
          </button>
        </div>

        {/* Empty placeholder to keep navbar tabs centered or just right-aligned spacing */}
        <div style={{ width: '180px' }}></div>
      </nav>

      {/* ── Page Contents ── */}
      <div style={{ flex: 1, height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {activeTab === 'separator' && (
          <StemSeparator onJobIdChange={setJobId} />
        )}
        {activeTab === 'backing' && (
          <div className="app-container" style={{ height: '100%' }}>
            <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>Backing Maker</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Generate custom instrumental backing tracks by selectively muting instruments from the source audio.
                </p>
              </div>
            </aside>
            <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <div style={{ maxWidth: '600px', width: '100%', padding: '24px' }}>
                <BackingGenerator jobId={jobId} />
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  )
}
