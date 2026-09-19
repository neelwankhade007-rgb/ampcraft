import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ChevronDown, Play, Pause, RotateCcw,
  Volume2, Download, Mic2, Guitar, Drum, Piano, Waves, Music2,
  Menu, X
} from 'lucide-react'
import DawWaveformCanvas from './DawWaveformCanvas'

// ──────────────────────────────────────────────────────────────────────────────
// Mock waveform peak data — procedurally generated to look like real audio,
// NOT a smooth sine wave. Uses the same format expected by DawWaveformCanvas.
// ──────────────────────────────────────────────────────────────────────────────
function generateMockPeaks(count = 300, seed = 42) {
  const peaks = new Float32Array(count)
  let val = 0.3
  // Simple deterministic pseudo-random (mulberry32)
  let s = seed
  const rand = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  for (let i = 0; i < count; i++) {
    // Simulate musical dynamics: builds, drops, phrases
    const phrase = Math.sin((i / count) * Math.PI * 6) * 0.15
    const dynamics = Math.sin((i / count) * Math.PI * 1.2) * 0.25
    const noise = (rand() - 0.5) * 0.35
    val = Math.max(0.04, Math.min(0.95, 0.4 + phrase + dynamics + noise))
    peaks[i] = val
  }
  return peaks
}

const MOCK_PEAKS = generateMockPeaks(300, 42)
const MOCK_PROGRESS = 0.185 // Playhead at 18.5% (~0:42 of 3:47)

// ──────────────────────────────────────────────────────────────────────────────
// Stem metadata matching existing StemRow.jsx colors/icons
// ──────────────────────────────────────────────────────────────────────────────
const STEM_META = {
  vocals: { label: 'Vocals', color: '#a855f7', icon: Mic2 },
  guitar: { label: 'Guitar', color: '#eab308', icon: Guitar },
  drums:  { label: 'Drums',  color: '#06b6d4', icon: Drum },
  bass:   { label: 'Bass',   color: '#10b981', icon: Waves },
  piano:  { label: 'Piano',  color: '#f97316', icon: Piano },
  other:  { label: 'Other',  color: '#6366f1', icon: Music2 },
}

const STEM_ORDER = ['vocals', 'guitar', 'drums', 'bass', 'piano', 'other']

// ──────────────────────────────────────────────────────────────────────────────
// Mini waveform bars for hero visualization (uses DawWaveformCanvas approach)
// ──────────────────────────────────────────────────────────────────────────────
function MiniWaveformBars({ color = '#f59e0b', count = 20, seed = 99 }) {
  const bars = useMemo(() => {
    let s = seed
    const rand = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296 }
    return Array.from({ length: count }, () => 15 + rand() * 85)
  }, [count, seed])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px',
      height: '100%', padding: '0 4px', overflow: 'hidden',
    }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: '2px', height: `${h}%`,
          background: color, borderRadius: '1px',
          opacity: 0.7 + (h / 100) * 0.3,
        }} />
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Landing Page Component
// ──────────────────────────────────────────────────────────────────────────────
export default function LandingPage({ onOpenStudio }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 768) setMobileMenuOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const scrollTo = (id) => {
    setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="lp-root">

      {/* ═══ NAVBAR ═══ */}
      <header className="lp-navbar">
        <div className="lp-navbar-inner">
          {/* Brand */}
          <a className="lp-brand" href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <img src="/logo.png" alt="AmpCraft logo" className="lp-brand-logo" />
            <span className="lp-brand-wordmark">AmpCraft</span>
            <span className="lp-brand-badge">STUDIO</span>
          </a>

          {/* Desktop Nav */}
          <nav className="lp-nav-links">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>Features</a>
            <a href="#" onClick={(e) => { e.preventDefault(); onOpenStudio('separator') }}>Stem Separator</a>
            <a href="#" onClick={(e) => { e.preventDefault(); onOpenStudio('backing') }}>Backing Maker</a>
          </nav>

          {/* CTA + Mobile toggle */}
          <div className="lp-nav-actions">
            <button className="lp-nav-cta" onClick={() => onOpenStudio('separator')}>
              <span>Open Studio</span>
              <ArrowRight size={14} />
            </button>
            <button className="lp-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="lp-mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>Features</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onOpenStudio('separator') }}>Stem Separator</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onOpenStudio('backing') }}>Backing Maker</a>
              <button className="lp-nav-cta mobile" onClick={() => { setMobileMenuOpen(false); onOpenStudio('separator') }}>
                Open Studio
                <ArrowRight size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="lp-hero" id="hero">
        <div className="lp-hero-glow" />
        <div className="lp-container lp-hero-content">
          <motion.h1
            className="lp-hero-headline"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Turn Any Song Into<br />Your Playground.
          </motion.h1>

          <motion.p
            className="lp-hero-sub"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Separate songs into individual stems and build playable backing tracks with AmpCraft.
          </motion.p>

          <motion.div
            className="lp-hero-buttons"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <button className="lp-btn-primary" onClick={onOpenStudio}>
              <Play size={16} fill="currentColor" />
              <span>Open AmpCraft Studio</span>
            </button>
            <a href="#features" className="lp-btn-secondary" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>
              <span>Explore Features</span>
              <ChevronDown size={16} />
            </a>
          </motion.div>

          {/* ── Hero Visualization: Input → Separation → Backing ── */}
          <motion.div
            className="lp-hero-viz"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {/* Top bar */}
            <div className="lp-viz-titlebar">
              <div className="lp-viz-dots">
                <span /><span /><span />
              </div>
              <span className="lp-viz-label">STEM SEPARATOR</span>
              <div className="lp-viz-status">
                <span className="lp-status-dot" />
                <span>READY</span>
              </div>
            </div>

            {/* Three-column flow */}
            <div className="lp-viz-flow">
              {/* Input Song */}
              <div className="lp-viz-node">
                <span className="lp-viz-node-tag accent">Input Song</span>
                <p className="lp-viz-node-title">Mephisto.mp3</p>
                <div className="lp-viz-mini-wave">
                  <MiniWaveformBars color="#f59e0b" count={22} seed={42} />
                </div>
              </div>

              {/* Arrow */}
              <div className="lp-viz-arrow">
                <span className="lp-viz-arrow-desktop">→</span>
                <span className="lp-viz-arrow-mobile">↓</span>
              </div>

              {/* Stems */}
              <div className="lp-viz-node wide">
                <div className="lp-viz-node-header">
                  <span className="lp-viz-node-tag muted">STEM SEPARATOR</span>
                  <span className="lp-viz-ready-sm">READY</span>
                </div>
                <div className="lp-viz-stems-list">
                  {['vocals', 'guitar', 'drums', 'bass'].map(name => {
                    const meta = STEM_META[name]
                    return (
                      <div key={name} className="lp-viz-stem-row" style={{ borderLeftColor: meta.color }}>
                        <span style={{ color: meta.color }} className="lp-viz-stem-name">
                          <span className="lp-viz-stem-dot" style={{ background: meta.color }} />
                          {meta.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Arrow */}
              <div className="lp-viz-arrow">
                <span className="lp-viz-arrow-desktop">→</span>
                <span className="lp-viz-arrow-mobile">↓</span>
              </div>

              {/* Backing Track Output */}
              <div className="lp-viz-node output">
                <span className="lp-viz-node-tag accent">Backing Track</span>
                <p className="lp-viz-node-title">Guitar Muted</p>
                <div className="lp-viz-output-status">
                  <span className="lp-status-dot" />
                  <span>READY</span>
                </div>
              </div>
            </div>

            {/* Bottom transport mini-bar */}
            <div className="lp-viz-transport">
              <span className="lp-viz-transport-time">
                <span className="lp-viz-time-dot" /> 0:42 / 3:47
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ TWO TOOLS SECTION ═══ */}
      <section className="lp-tools-section" id="features">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-tag">Workspace Philosophy</span>
            <h2 className="lp-section-title">Two tools. One focused workspace.</h2>
            <p className="lp-section-sub">
              Break songs into their individual layers, then turn those layers into something you can play with.
            </p>
          </div>

          <div className="lp-tools-grid">
            {/* ── Stem Separator Card ── */}
            <div className="lp-tool-card" id="stem-separator">
              <div className="lp-tool-card-header">
                <span className="lp-tool-badge purple">STEM SEPARATOR</span>
                <span className="lp-tool-badge-sub">AUDIO WORKSPACE</span>
              </div>
              <h3 className="lp-tool-title">Hear Every Layer.</h3>
              <p className="lp-tool-desc">
                Separate a song into individual stems and isolate the exact parts you want to hear, practice, or work with.
              </p>

              {/* Stem lanes visualizer */}
              <div className="lp-stem-lanes">
                {/* Vocals – Isolated */}
                <div className="lp-stem-lane" style={{ borderLeftColor: '#a855f7' }}>
                  <div className="lp-lane-left">
                    <span className="lp-lane-name">Vocals</span>
                    <span className="lp-lane-status" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.12)' }}>Isolated</span>
                  </div>
                  <div className="lp-lane-controls">
                    <span className="lp-lane-btn">M</span>
                    <span className="lp-lane-btn active-s" style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc', borderColor: 'rgba(168,85,247,0.4)' }}>S</span>
                    <span className="lp-lane-vol">Vol</span>
                  </div>
                </div>
                {/* Guitar – Soloed */}
                <div className="lp-stem-lane soloed" style={{ borderLeftColor: '#eab308', boxShadow: 'inset 0 0 0 1px rgba(234,179,8,0.2)' }}>
                  <div className="lp-lane-left">
                    <span className="lp-lane-name">Guitar</span>
                    <span className="lp-lane-status" style={{ color: '#eab308', background: 'rgba(234,179,8,0.12)' }}>Solo</span>
                  </div>
                  <div className="lp-lane-controls">
                    <span className="lp-lane-btn">M</span>
                    <span className="lp-lane-btn active-s" style={{ background: '#eab308', color: '#000', borderColor: '#eab308', fontWeight: 700 }}>S</span>
                    <span className="lp-lane-vol" style={{ color: '#eab308', fontWeight: 700 }}>Vol</span>
                  </div>
                </div>
                {/* Drums – Active */}
                <div className="lp-stem-lane" style={{ borderLeftColor: '#38bdf8' }}>
                  <div className="lp-lane-left">
                    <span className="lp-lane-name">Drums</span>
                    <span className="lp-lane-status" style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.12)' }}>Active</span>
                  </div>
                  <div className="lp-lane-controls">
                    <span className="lp-lane-btn">M</span>
                    <span className="lp-lane-btn">S</span>
                    <span className="lp-lane-vol">Vol</span>
                  </div>
                </div>
                {/* Other – Muted */}
                <div className="lp-stem-lane muted-lane" style={{ borderLeftColor: '#6366f1', opacity: 0.4 }}>
                  <div className="lp-lane-left">
                    <span className="lp-lane-name">Other</span>
                    <span className="lp-lane-status" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)' }}>Muted</span>
                  </div>
                  <div className="lp-lane-controls">
                    <span className="lp-lane-btn active-m" style={{ background: 'rgba(239,68,68,0.3)', color: '#f87171', borderColor: 'rgba(239,68,68,0.4)' }}>M</span>
                    <span className="lp-lane-btn">S</span>
                    <span className="lp-lane-vol">Muted</span>
                  </div>
                </div>
              </div>

              <div className="lp-tool-footer">
                <span className="lp-tool-footer-status">● READY • STEMS SEPARATED</span>
                <span className="lp-tool-footer-info">Export Stems (WAV / MP3)</span>
              </div>
            </div>

            {/* ── Backing Maker Card ── */}
            <div className="lp-tool-card" id="backing-maker">
              <div className="lp-tool-card-header">
                <span className="lp-tool-badge amber">BACKING MAKER</span>
                <span className="lp-tool-badge-sub">PRACTICE PLAY-ALONG</span>
              </div>
              <h3 className="lp-tool-title">Build Your Backing Track.</h3>
              <p className="lp-tool-desc">
                Choose the parts you want to keep and mute the instrument you play. Create a custom mix so you can practice with the original band.
              </p>

              {/* Backing track arrangement */}
              <div className="lp-backing-matrix">
                <div className="lp-backing-header">
                  <span>BACKING TRACK</span>
                  <span className="lp-backing-preset">Custom Jam Preset</span>
                </div>
                <div className="lp-backing-grid">
                  {[
                    { name: 'Drums', kept: true },
                    { name: 'Bass', kept: true },
                    { name: 'Vocals', kept: true },
                    { name: 'Guitar', kept: false },
                  ].map(ch => (
                    <div key={ch.name} className={`lp-backing-channel ${ch.kept ? 'keep' : 'muted-ch'}`}>
                      <span className="lp-backing-ch-name">
                        <span className="lp-backing-ch-dot" style={{ background: ch.kept ? '#22c55e' : '#ef4444' }} />
                        {ch.name}
                      </span>
                      <span className="lp-backing-ch-status">
                        {ch.kept ? 'KEEP ✓' : 'MUTED ✕'}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Output summary */}
                <div className="lp-backing-output">
                  <div>
                    <span className="lp-backing-output-title">Custom Backing Mix</span>
                    <span className="lp-backing-output-formats">Export Formats: WAV / MP3</span>
                  </div>
                  <div className="lp-backing-output-bar">
                    <div className="lp-backing-output-fill" />
                  </div>
                </div>
              </div>

              <div className="lp-tool-footer">
                <span className="lp-tool-footer-info">EXPORT FORMATS</span>
                <span className="lp-tool-footer-status">WAV / MP3</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STUDIO PREVIEW ═══ */}
      <section className="lp-studio-section" id="studio-preview">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-tag">Native Interface</span>
            <h2 className="lp-section-title">Everything starts in AmpCraft Studio.</h2>
            <p className="lp-section-sub">
              An authentic, dark-themed audio workspace tailored for stem isolation and backing tracks.
            </p>
          </div>

          {/* Studio Mockup */}
          <div className="lp-studio-mockup">
            {/* Inner Studio Header */}
            <div className="lp-studio-header">
              <div className="lp-studio-header-left">
                <div className="lp-studio-logo-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 10v4" /><path d="M6 6v12" /><path d="M10 3v18" /><path d="M14 8v8" /><path d="M18 5v14" /><path d="M22 10v4" />
                  </svg>
                </div>
                <span className="lp-studio-header-brand">Amp<span style={{ color: '#f59e0b' }}>Craft</span></span>
                <span className="lp-studio-header-badge">STUDIO</span>
              </div>
              <div className="lp-studio-tabs">
                <button className="lp-studio-tab active">
                  Stem Separator
                  <span className="lp-studio-tab-bar" />
                </button>
                <button className="lp-studio-tab">Backing Maker</button>
              </div>
              <div className="lp-studio-header-right">
                <div className="lp-studio-file-pill">
                  <Music2 size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span>Mephisto.mp3</span>
                </div>
              </div>
            </div>

            {/* Studio Body: Sidebar + Main */}
            <div className="lp-studio-body">
              {/* Left Sidebar */}
              <aside className="lp-studio-sidebar">
                <div className="lp-studio-sidebar-section">
                  <span className="lp-studio-sidebar-label">Audio Source</span>
                  <div className="lp-studio-meta-card">
                    <div className="lp-studio-meta-item">
                      <span className="lp-studio-meta-key">File</span>
                      <span className="lp-studio-meta-val">Mephisto.mp3</span>
                    </div>
                    <div className="lp-studio-meta-item">
                      <span className="lp-studio-meta-key">Duration</span>
                      <span className="lp-studio-meta-val mono">3:47</span>
                    </div>
                  </div>
                </div>
                <div className="lp-studio-sidebar-section">
                  <span className="lp-studio-sidebar-label">Supported Formats</span>
                  <div className="lp-studio-formats">
                    {['MP3', 'WAV', 'FLAC', 'M4A', 'OGG', 'AIFF'].map(f => (
                      <span key={f} className="lp-studio-format-chip">{f}</span>
                    ))}
                  </div>
                </div>
                <div className="lp-studio-sidebar-bottom">
                  <button className="lp-studio-replace-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                    <span>Replace File</span>
                  </button>
                </div>
              </aside>

              {/* Main Content */}
              <main className="lp-studio-main">
                {/* Song Header + Export Controls */}
                <div className="lp-studio-song-header">
                  <div>
                    <h3 className="lp-studio-song-title">Mephisto.mp3</h3>
                    <p className="lp-studio-song-meta">6 Stems • 3:47</p>
                  </div>
                  <div className="lp-studio-export-row">
                    <div className="lp-studio-format-toggle">
                      <button className="lp-fmt-btn active">MP3</button>
                      <button className="lp-fmt-btn">WAV</button>
                    </div>
                    <button className="lp-studio-zip-btn">
                      <Download size={14} />
                      <span>All Stems (ZIP)</span>
                    </button>
                  </div>
                </div>

                {/* Waveform Display — REAL DawWaveformCanvas */}
                <div className="lp-studio-waveform-card">
                  <div className="lp-studio-waveform-wrap">
                    <DawWaveformCanvas
                      peaks={MOCK_PEAKS}
                      progress={MOCK_PROGRESS}
                      height={96}
                      playedColor="#f59e0b"
                      unplayedColor="#2a3142"
                      centerLineColor="rgba(255, 255, 255, 0.05)"
                      interactive={false}
                    />
                    {/* Static Playhead overlay */}
                    <div className="lp-studio-playhead" style={{ left: `${MOCK_PROGRESS * 100}%` }}>
                      <div className="lp-studio-playhead-cap" />
                      <div className="lp-studio-playhead-tag">0:42</div>
                    </div>
                  </div>

                  {/* Timeline ticks */}
                  <div className="lp-studio-time-axis">
                    {['0:00', '0:30', '1:00', '1:30', '2:00', '2:30', '3:00', '3:30', '3:47'].map(t => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>

                  {/* Transport controls */}
                  <div className="lp-studio-transport">
                    <div className="lp-studio-transport-left">
                      <button className="lp-studio-play-btn">
                        <Play size={14} fill="currentColor" />
                        <span>Play</span>
                      </button>
                      <button className="lp-studio-restart-btn">
                        <RotateCcw size={13} />
                        <span>Restart</span>
                      </button>
                    </div>
                    <div className="lp-studio-time-display">
                      <span className="lp-time-current">0:42</span>
                      <span className="lp-time-sep">/</span>
                      <span className="lp-time-total">3:47</span>
                    </div>
                    <div className="lp-studio-vol-group">
                      <Volume2 size={15} style={{ color: '#94a3b8' }} />
                      <div className="lp-studio-vol-track">
                        <div className="lp-studio-vol-fill" />
                      </div>
                      <span className="lp-studio-vol-readout">100%</span>
                    </div>
                  </div>
                </div>

                {/* Stem Mixer Header */}
                <div className="lp-studio-mixer-header">
                  <h4>Stem Mixer</h4>
                  <span>Channel Controls & Stems Export</span>
                </div>

                {/* 6 Stem Channel Cards */}
                <div className="lp-studio-stems-grid">
                  {STEM_ORDER.map(name => {
                    const meta = STEM_META[name]
                    const Icon = meta.icon
                    return (
                      <div key={name} className="lp-studio-stem-card" style={{ '--stem-c': meta.color }}>
                        <div className="lp-studio-stem-stripe" style={{ background: meta.color }} />
                        <div className="lp-studio-stem-header">
                          <div className="lp-studio-stem-id">
                            <div className="lp-studio-stem-icon" style={{ background: `${meta.color}1a`, borderColor: `${meta.color}4d`, color: meta.color }}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <h5 className="lp-studio-stem-name">{meta.label}</h5>
                              <div className="lp-studio-stem-status">
                                <span className="lp-studio-stem-dot" style={{ background: meta.color }} />
                                <span>Isolated</span>
                              </div>
                            </div>
                          </div>
                          <div className="lp-studio-ms-group">
                            <span className="lp-studio-ms-btn">M</span>
                            <span className="lp-studio-ms-btn">S</span>
                          </div>
                        </div>
                        <div className="lp-studio-stem-mixer">
                          <div className="lp-studio-stem-fader">
                            <span className="lp-studio-fader-label">VOL</span>
                            <div className="lp-studio-fader-track">
                              <div className="lp-studio-fader-fill" />
                            </div>
                            <span className="lp-studio-fader-val">0.0 dB</span>
                          </div>
                          <div className="lp-studio-stem-dl-btn">
                            <Download size={13} style={{ color: '#94a3b8' }} />
                            <span>Download</span>
                            <ChevronDown size={12} style={{ color: '#94a3b8' }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="lp-cta-section">
        <div className="lp-container">
          <div className="lp-cta-card">
            <div className="lp-cta-glow-tl" />
            <div className="lp-cta-glow-br" />
            <h2 className="lp-cta-title">Ready to break down your next song?</h2>
            <p className="lp-cta-sub">
              Open AmpCraft Studio to separate stems, build backing tracks, and start playing.
            </p>
            <button className="lp-btn-primary" onClick={onOpenStudio}>
              <span>Open Studio</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            {/* Brand */}
            <div className="lp-footer-brand-col">
              <div className="lp-footer-brand">
                <img src="/logo.png" alt="AmpCraft" className="lp-footer-logo" />
                <span className="lp-footer-wordmark">AmpCraft</span>
                <span className="lp-footer-badge">STUDIO</span>
              </div>
              <p className="lp-footer-desc">
                Audio workspace designed for musicians, producers, and guitarists.
              </p>
            </div>

            {/* Product */}
            <div className="lp-footer-col">
              <h5 className="lp-footer-col-title">Product</h5>
              <ul className="lp-footer-links">
                <li><a href="#studio-preview" onClick={(e) => { e.preventDefault(); scrollTo('studio-preview') }}>AmpCraft Studio</a></li>
                <li><a href="#stem-separator" onClick={(e) => { e.preventDefault(); scrollTo('stem-separator') }}>Stem Separator</a></li>
                <li><a href="#backing-maker" onClick={(e) => { e.preventDefault(); scrollTo('backing-maker') }}>Backing Maker</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="lp-footer-bottom">
            <span>© {new Date().getFullYear()} AmpCraft Audio Systems. All rights reserved.</span>
            <div className="lp-footer-status">
              <span className="lp-status-dot" />
              <span>STUDIO READY</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
