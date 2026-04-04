import React, { useState, useCallback, useEffect } from 'react'
import axios from 'axios'
import './App.css'

// ── Tone style meta ─────────────────────────────────────────────────────────
const STYLE_META = {
  jazz:      { color: '#7c6fcd', desc: 'Warm, mellow, full jazz voicing' },
  clean:     { color: '#4caf90', desc: 'Glassy, transparent, studio clean' },
  blues:     { color: '#e07030', desc: 'Gritty, soulful, vocal overdrive' },
  rock:      { color: '#f5a623', desc: 'Punchy crunch, classic rock drive' },
  high_gain: { color: '#f5c842', desc: 'Aggressive, tight, modern gain' },
  metal:     { color: '#e84040', desc: 'Heavy, tight, crushing distortion' },
  bass:      { color: '#4c8faf', desc: 'Deep, warm, low-end foundation' },
}

// ── Signal chain config ───────────────────────────────────────────────────────
function getChainBlocks(chain) {
  return [
    {
      key:     'noise_gate',
      title:   'Noise Gate',
      enabled: chain.noise_gate?.enabled ?? true,
      settings: [
        { label: 'Type',      value: chain.noise_gate?.type ?? '—' },
        { label: 'Threshold', value: `${chain.noise_gate?.threshold ?? '—'} dB` },
      ],
    },
    {
      key:     'efx',
      title:   'Overdrive / EFX',
      enabled: chain.efx?.type !== 'None',
      settings: [
        { label: 'Pedal', value: chain.efx?.type ?? '—' },
        { label: 'Gain',  value: chain.efx?.gain ?? '—' },
      ],
    },
    {
      key:     'amp',
      title:   'Amplifier',
      enabled: true,
      settings: [
        { label: 'Model',  value: chain.amp?.type   ?? '—' },
        { label: 'Gain',   value: chain.amp?.gain   ?? '—' },
        { label: 'Volume', value: chain.amp?.volume ?? '—' },
        { label: 'Treble', value: chain.amp?.treble ?? '—' },
        { label: 'Mid',    value: chain.amp?.mid    ?? '—' },
        { label: 'Bass',   value: chain.amp?.bass   ?? '—' },
      ],
    },
    {
      key:     'cab',
      title:   'Cabinet',
      enabled: true,
      settings: [
        { label: 'Model', value: chain.cab?.type ?? '—' },
        { label: 'Mic',   value: chain.cab?.mic  ?? '—' },
      ],
    },
    {
      key:     'mod',
      title:   'Modulation',
      enabled: chain.mod?.type !== 'None',
      settings: [
        { label: 'Effect', value: chain.mod?.type  ?? '—' },
        { label: 'Depth',  value: chain.mod?.depth ?? '—' },
      ],
    },
    {
      key:     'delay',
      title:   'Delay',
      enabled: chain.delay?.type !== 'None',
      settings: [
        { label: 'Type',     value: chain.delay?.type     ?? '—' },
        { label: 'Time',     value: chain.delay?.time     != null ? `${chain.delay.time} ms` : '—' },
        { label: 'Feedback', value: chain.delay?.feedback ?? '—' },
      ],
    },
    {
      key:     'reverb',
      title:   'Reverb',
      enabled: chain.reverb?.type !== 'None',
      settings: [
        { label: 'Type',  value: chain.reverb?.type  ?? '—' },
        { label: 'Level', value: chain.reverb?.level ?? '—' },
      ],
    },
  ]
}

// ── Components ────────────────────────────────────────────────────────────────
function ChainBlock({ title, enabled, settings }) {
  return (
    <div className={`chain-block ${enabled ? 'block-on' : 'block-off'}`}>
      <div className="block-header">
        <span className="block-title">{title}</span>
        <span className={`block-pill ${enabled ? 'pill-on' : 'pill-off'}`}>
          {enabled ? 'ON' : 'OFF'}
        </span>
      </div>
      <div className="block-settings">
        {settings.map((s, idx) => (
          <div key={idx} className="block-row">
            <span className="block-label">{s.label}</span>
            <span className="block-value">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Knob({ label, value, max = 10 }) {
  const numVal = Number(value) || 0
  const normalized = Math.min(Math.max(numVal, 0), max)
  const angle = -135 + (normalized / max) * 270

  return (
    <div className="knob-wrap">
      <div className="knob">
        <div className="knob-dot" style={{ '--angle': `${angle}deg` }} />
      </div>
      <div className="knob-value">{value}</div>
      <div className="knob-label">{label}</div>
    </div>
  )
}

function ResultDashboard({ chain, features }) {
  const styleKey = (chain.style ?? 'clean').toLowerCase().replace(' ', '_')
  const meta     = STYLE_META[styleKey] ?? STYLE_META.clean
  const charKey  = chain.tone_character ?? 'balanced'
  const blocks   = getChainBlocks(chain)

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', meta.color);
    return () => document.documentElement.style.setProperty('--accent', '#f5a623');
  }, [meta.color]);

  return (
    <div className="dashboard-canvas">
      <div className="panel">
        
        {/* Style + Tone Header */}
        <header className="dashboard-header">
          <div className="tone-title-group">
            <div className="tone-char-badge">{chain.style ?? styleKey.toUpperCase()}</div>
            <h2 className="tone-name">{chain.amp?.type ?? 'Unknown Amp'}</h2>
            <p className="tone-desc">{meta.desc} &middot; <strong style={{color: meta.color}}>{charKey}</strong></p>
          </div>
        </header>

        {/* EQ Section */}
        <div className="section-label">EQ Profile</div>
        <div className="eq-section">
          <div className="knobs-grid">
            <Knob label="Gain"   value={chain.amp?.gain} />
            <Knob label="Treble" value={chain.amp?.treble} />
            <Knob label="Mid"    value={chain.amp?.mid} />
            <Knob label="Bass"   value={chain.amp?.bass} />
            <Knob label="Volume" value={chain.amp?.volume} />
          </div>
        </div>

        {/* Signal Chain Matrix */}
        <div className="section-label">Signal Chain</div>
        <div className="chain-grid">
          {blocks.map((block) => (
            <div key={block.key} className="chain-item">
              <ChainBlock {...block} />
            </div>
          ))}
        </div>

        {/* Extraction Features */}
        <div className="section-label">Audio Features Analyzed</div>
        <div className="features-grid">
          <div className="feature-chip">
            <span className="chip-label">Centroid</span>
            <span className="chip-value">{Math.round(features.centroid)} Hz</span>
          </div>
          <div className="feature-chip">
            <span className="chip-label">RMS Energy</span>
            <span className="chip-value">{features.rms.toFixed(4)}</span>
          </div>
          <div className="feature-chip">
            <span className="chip-label">Zero Crossing Range</span>
            <span className="chip-value">{features.zcr.toFixed(4)}</span>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Main App Shell ────────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile] = useState(null)
  const [dragging, setDrag] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDrag(false)
    if (e.dataTransfer.files?.[0]) {
      selectFile(e.dataTransfer.files[0])
    }
  }, [])

  const selectFile = (f) => {
    setFile(f)
    setResult(null)
    setError(null)
  }

  const analyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post('http://localhost:8000/analyze', formData)
      setResult(res.data)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Analysis failed. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      {/* ── Sidebar Control Panel ── */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1 className="brand">AmpCraft</h1>
          <p className="tagline">AI-powered guitar tone analyzer</p>
        </header>

        <section className="upload-section">
          <div
            id="drop-zone"
            className={`drop-zone ${dragging ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            {file
              ? <p className="dz-filename">{file.name}</p>
              : <>
                  <p className="dz-main">Drag &amp; drop your audio</p>
                  <p className="dz-sub">or <span>click to browse</span></p>
                </>
            }
          </div>

          <input
            id="file-input"
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={(e) => selectFile(e.target.files[0])}
          />

          {error && <p className="error-msg">{error}</p>}
        </section>

        <button
          id="analyze-btn"
          className="btn-analyze"
          disabled={!file || loading}
          onClick={analyze}
        >
          {loading ? <span className="spinner" /> : 'Analyze Tone'}
        </button>
      </aside>

      {/* ── Main Dashboard Workspace ── */}
      <main className="main-content">
        {result ? (
          <ResultDashboard chain={result.chain} features={result.features} />
        ) : (
          <div className="empty-state">
            Please upload a guitar track to generate a processing chain.
          </div>
        )}
      </main>
    </div>
  )
}
