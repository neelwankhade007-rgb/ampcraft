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
  const blocks = [
    { key: 'noise_gate', title: 'GATE', data: chain.noise_gate },
    { key: 'efx',        title: 'EFX',  data: chain.efx },
    { key: 'amp',        title: 'AMP',  data: chain.amp },
    { key: 'cab',        title: 'CAB',  data: chain.cab },
    { key: 'mod',        title: 'MOD',  data: chain.mod },
    { key: 'delay',      title: 'DLY',  data: chain.delay },
    { key: 'reverb',     title: 'RVB',  data: chain.reverb },
  ];

    return blocks.map(b => {
    const isEnabled = b.data?.enabled !== false && b.data?.type !== 'None';
    const colors = {
      noise_gate: '#a3e635', efx: '#fbbf24', amp: '#f87171',
      cab: '#22d3ee', mod: '#c084fc', delay: '#60a5fa', reverb: '#fb923c'
    };
    
    const settings = (b.data?.settings || []).map(s => ({
      label: s.label,
      value: typeof s.value === 'number' ? s.value.toFixed(0) : s.value
    }));

    if (b.data?.type && b.data.type !== 'None' && !settings.some(s => s.label === 'Model' || s.label === 'Pedal' || s.label === 'Type')) {
      settings.unshift({ label: 'Model', value: b.data.type });
    }

    return {
      key: b.key,
      title: b.title,
      enabled: isEnabled,
      settings: settings,
      color: colors[b.key] || '#f5a623'
    };
  });
}

// ── Components ────────────────────────────────────────────────────────────────
function ChainBlock({ title, enabled, settings, color }) {
  return (
    <div className={`chain-block ${enabled ? 'block-on' : 'block-off'}`} style={{ '--block-accent': color }}>
      <div className="block-header">
        <span className="block-title">{title}</span>
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

// Helper: Tone Chain Icon SVGs
const ChainIcons = {
  noise_gate: (color) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h3l2-5 4 10 2-5h9" />
      <path d="M5 12h14" strokeOpacity="0.2" strokeDasharray="2 2" />
    </svg>
  ),
  efx: (color) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <circle cx="12" cy="9" r="2" />
      <circle cx="9" cy="15" r="1" /><circle cx="15" cy="15" r="1" />
    </svg>
  ),
  amp: (color) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" /><path d="M6 7h1" /><path d="M9 7h1" /><path d="M12 7h1" />
      <path d="M7 12l10 4" strokeOpacity="0.3" /><path d="M7 14l10 2" strokeOpacity="0.3" />
    </svg>
  ),
  cab: (color) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  mod: (color) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12c4-8 8 8 12 0s8-8 12 0" />
    </svg>
  ),
  delay: (color) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7" />
      <path d="M12 12l4 4" /><path d="M8 8l2 2" />
    </svg>
  ),
  reverb: (color) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="10" height="10" strokeOpacity="0.4" />
      <rect x="7" y="7" width="10" height="10" strokeOpacity="0.7" />
      <rect x="10" y="10" width="10" height="10" />
    </svg>
  )
};

function ToneChain({ chain }) {
  const blocks = [
    { key: 'noise_gate', label: 'GATE', color: '#a3e635' },
    { key: 'efx',        label: 'EFX',  color: '#fbbf24' },
    { key: 'amp',        label: 'AMP',  color: '#f87171' },
    { key: 'cab',        label: 'IR',   color: '#22d3ee' },
    { key: 'mod',        label: 'MOD',  color: '#c084fc' },
    { key: 'delay',      label: 'DLY',  color: '#60a5fa' },
    { key: 'reverb',     label: 'RVB',  color: '#fb923c' },
  ];

  return (
    <div className="tone-chain-container">
      <div className="signal-cable" />
      {blocks.map((b) => {
        const item = chain[b.key];
        const isEnabled = item && item.enabled && item.type !== 'None';
        const color = isEnabled ? b.color : '#4b5563';
        
        return (
          <div key={b.key} className={`chain-block ${isEnabled ? 'active' : 'bypassed'}`} style={{ '--glow-color': b.color }}>
            <div className="icon-box">
              {ChainIcons[b.key](color)}
            </div>
            <div className="block-label">{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function Knob({ label, value, max = 100 }) {
  // ── Animation Logic ────────────────────────────────────────────────────────
  // To make the knobs 'spin' into place, we start at 0 and transition to the target.
  const [displayValue, setDisplayValue] = useState(0); 
  const numVal = Number(value) || 0;
  
  useEffect(() => {
    // A small delay ensures the component is mounted before the transition starts
    const timer = setTimeout(() => setDisplayValue(numVal), 50);
    return () => clearTimeout(timer);
  }, [numVal]);

  const normalized = Math.min(Math.max(displayValue, 0), max);
  const angle = -135 + (normalized / max) * 270;

  return (
    <div className="knob-wrap">
      <div className="knob">
        {/* The 'angle' variable controls the rotation of the white indicator dot */}
        <div className="knob-dot" style={{ '--angle': `${angle}deg` }} />
      </div>
      {/* Show the target value as an integer */}
      <div className="knob-value">{typeof value === 'number' ? value.toFixed(0) : value}</div>
      <div className="knob-label">{label}</div>
    </div>
  );
}

function ResultDashboard({ chain, features, debug }) {
  const styleKey = (chain.style ?? 'clean').toLowerCase().replace(' ', '_')
  const meta     = STYLE_META[styleKey] ?? STYLE_META.clean
  const charKey  = chain.tone_character ?? 'balanced'
  const blocks   = getChainBlocks(chain)

  // Filter out amp knobs for the EQ section
  const ampSettings = chain.amp?.settings || [];

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
        {/* Tone Chain Visualizer */}
        <ToneChain chain={chain} />

        {/* EQ Section — no floating label, section is self-evident */}
        <div className="eq-section">
          <div className="knobs-grid">
            {ampSettings.map((s, idx) => (
              <Knob key={idx} label={s.label} value={s.value} />
            ))}
          </div>
        </div>

        {/* Signal Chain Details: Only show active blocks — no floating label */}
        <div className="chain-grid">
          {blocks.filter(b => b.enabled).map((block) => (
            <div key={block.key} className="chain-item">
              <ChainBlock {...block} />
            </div>
          ))}
        </div>

        {/* Debug Features — compact single row at the bottom */}
        <div className="features-row">
          <span className="feature-pill">ZCR <strong>{debug?.zcr ? (debug.zcr * 100).toFixed(1) : 0}%</strong></span>
          <span className="feature-pill">Flatness <strong>{debug?.flatness ? (debug.flatness * 100).toFixed(1) : 0}%</strong></span>
          <span className="feature-pill">RMS <strong>{debug?.rms ? (debug.rms * 100).toFixed(1) : 0}%</strong></span>
          <span className="feature-pill">Centroid <strong>{Math.round(debug?.centroid || 0)} Hz</strong></span>
          <span className="feature-pill">Gain Score <strong>{debug?.gain_score || 0}</strong></span>
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
          <ResultDashboard
            chain={result.chain}
            features={result.features}
            debug={result.debug}
          />
        ) : (
          <div className="empty-state">
            Please upload a guitar track to generate a processing chain.
          </div>
        )}
      </main>
    </div>
  )
}
