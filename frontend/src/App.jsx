import { useState, useCallback } from 'react'
import axios from 'axios'
import './App.css'

// ── Tone style meta ─────────────────────────────────────────────────────────
const STYLE_META = {
  jazz:      { emoji: '🎷', color: '#7c6fcd', desc: 'Warm, mellow, full jazz voicing' },
  clean:     { emoji: '✨', color: '#4caf90', desc: 'Glassy, transparent, studio clean' },
  blues:     { emoji: '🎵', color: '#e07030', desc: 'Gritty, soulful, vocal overdrive' },
  rock:      { emoji: '🎸', color: '#f5a623', desc: 'Punchy crunch, classic rock drive' },
  high_gain: { emoji: '⚡', color: '#f5c842', desc: 'Aggressive, tight, modern gain' },
  metal:     { emoji: '🔥', color: '#e84040', desc: 'Heavy, tight, crushing distortion' },
  bass:      { emoji: '🎸', color: '#4c8faf', desc: 'Deep, warm, low-end foundation' },
}

// ── Signal chain config ───────────────────────────────────────────────────────
function getChainBlocks(chain) {
  return [
    {
      key:     'noise_gate',
      icon:    '🔇',
      title:   'Noise Gate',
      enabled: chain.noise_gate?.enabled ?? true,
      settings: [
        { label: 'Type',      value: chain.noise_gate?.type ?? '—' },
        { label: 'Threshold', value: `${chain.noise_gate?.threshold ?? '—'} dB` },
      ],
    },
    {
      key:     'efx',
      icon:    '🎛️',
      title:   'EFX',
      enabled: chain.efx?.type !== 'None',
      settings: [
        { label: 'Pedal', value: chain.efx?.type ?? '—' },
        { label: 'Gain',  value: chain.efx?.gain ?? '—' },
      ],
    },
    {
      key:     'amp',
      icon:    '🔊',
      title:   'Amp',
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
      icon:    '📦',
      title:   'Cabinet',
      enabled: true,
      settings: [
        { label: 'Model', value: chain.cab?.type ?? '—' },
        { label: 'Mic',   value: chain.cab?.mic  ?? '—' },
      ],
    },
    {
      key:     'mod',
      icon:    '🌀',
      title:   'Modulation',
      enabled: chain.mod?.type !== 'None',
      settings: [
        { label: 'Effect', value: chain.mod?.type  ?? '—' },
        { label: 'Depth',  value: chain.mod?.depth ?? '—' },
      ],
    },
    {
      key:     'delay',
      icon:    '⏱️',
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
      icon:    '🏔️',
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
function ChainBlock({ icon, title, enabled, settings }) {
  return (
    <div className={`chain-block ${enabled ? 'block-on' : 'block-off'}`}>
      <div className="block-header">
        <span className="block-icon">{icon}</span>
        <span className="block-title">{title}</span>
        <span className={`block-pill ${enabled ? 'pill-on' : 'pill-off'}`}>
          {enabled ? 'ON' : 'OFF'}
        </span>
      </div>
      <div className="block-settings">
        {settings.map(({ label, value }) => (
          <div key={label} className="block-row">
            <span className="block-label">{label}</span>
            <span className="block-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Knob({ label, value, max = 10 }) {
  const pct   = value / max
  const angle = -135 + pct * 270
  return (
    <div className="knob-wrap">
      <div className="knob" style={{ '--angle': `${angle}deg` }}>
        <div className="knob-dot" />
      </div>
      <span className="knob-value">{value}</span>
      <span className="knob-label">{label}</span>
    </div>
  )
}

function ResultCard({ chain, features }) {
  const styleKey = (chain.style ?? 'clean').toLowerCase().replace(' ', '_')
  const meta     = STYLE_META[styleKey] ?? STYLE_META.clean
  const charKey  = chain.tone_character ?? 'balanced'
  const blocks   = getChainBlocks(chain)

  return (
    <div className="result-card" style={{ '--accent': meta.color }}>

      {/* Style + Tone Header */}
      <div className="tone-header">
        <span className="tone-emoji">{meta.emoji}</span>
        <div>
          <div className="tone-char-badge">{chain.style ?? styleKey.toUpperCase()}</div>
          <h2 className="tone-name">{chain.amp?.type ?? 'Unknown Amp'}</h2>
          <p className="tone-desc">{meta.desc} · <span style={{color: 'var(--accent)'}}>{charKey}</span></p>
        </div>
      </div>

      {/* EQ Knobs */}
      {chain.amp && (
        <>
          <div className="section-label">EQ</div>
          <div className="knobs-row">
            <Knob label="Gain"   value={chain.amp.gain}   />
            <Knob label="Treble" value={chain.amp.treble} />
            <Knob label="Mid"    value={chain.amp.mid}    />
            <Knob label="Bass"   value={chain.amp.bass}   />
            <Knob label="Volume" value={chain.amp.volume} />
          </div>
        </>
      )}

      {/* Signal Chain */}
      <div className="section-label">Signal Chain</div>
      <div className="chain-list">
        {blocks.map((block, i) => (
          <div key={block.key} className="chain-item">
            <ChainBlock {...block} />
            {i < blocks.length - 1 && <div className="chain-arrow">↓</div>}
          </div>
        ))}
      </div>

      {/* Audio Analysis */}
      <div className="section-label">Audio Analysis</div>
      <div className="features-grid">
        {[
          { label: 'Centroid',  value: `${features.centroid?.toFixed(0)} Hz` },
          { label: 'ZCR',       value: features.zcr?.toFixed(4) },
          { label: 'RMS',       value: features.rms?.toFixed(4) },
          { label: 'Rolloff',   value: `${features.rolloff?.toFixed(0)} Hz` },
          { label: 'Flatness',  value: features.flatness?.toFixed(4) },
        ].map(({ label, value }) => (
          <div key={label} className="feature-chip">
            <span className="chip-label">{label}</span>
            <span className="chip-value">{value ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile]       = useState(null)
  const [dragging, setDrag]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  const selectFile = (f) => {
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDrag(false)
    selectFile(e.dataTransfer.files[0])
  }, [])

  const analyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post('/api/analyze', formData)
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">🎸</div>
        <h1 className="brand">AmpCraft</h1>
        <p className="tagline">AI-powered guitar tone analyzer</p>
      </header>

      <main className="main">
        <div className="card">
          <div
            id="drop-zone"
            className={`drop-zone ${dragging ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            <div className="dz-icon">{file ? '✅' : '🎵'}</div>
            {file
              ? <p className="dz-filename">📎 {file.name}</p>
              : <>
                  <p className="dz-main">Drag &amp; drop your audio here</p>
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

          <button
            id="analyze-btn"
            className="btn-analyze"
            disabled={!file || loading}
            onClick={analyze}
          >
            {loading ? <span className="spinner" /> : '🎛️ Analyze Tone'}
          </button>

          {error && <p className="error-msg">❌ {error}</p>}
        </div>

        {result && (
          <div className="result-wrap">
            <ResultCard chain={result.chain} features={result.features} />
          </div>
        )}
      </main>

      <footer className="app-footer">Built with 🎸 + AI</footer>
    </div>
  )
}
