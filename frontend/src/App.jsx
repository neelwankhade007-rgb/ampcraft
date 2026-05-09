import React, { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import './App.css'

// ── Genre theme map ──────────────────────────────────────────────────────────
const GENRE_THEMES = {
  jazz: {
    accent:      '#a78bfa',
    accentDim:   '#7c6fcd',
    glow:        'rgba(167,139,250,0.15)',
    bgTint:      '#08070f',
    gridColor:   '#100f1a',
    panelBorder: 'rgba(167,139,250,0.18)',
    label:       'Jazz',
    desc:        'Warm, mellow, full jazz voicing',
  },
  clean: {
    accent:      '#34d399',
    accentDim:   '#4caf90',
    glow:        'rgba(52,211,153,0.12)',
    bgTint:      '#070f0b',
    gridColor:   '#0d1a12',
    panelBorder: 'rgba(52,211,153,0.16)',
    label:       'Clean',
    desc:        'Glassy, transparent, studio clean',
  },
  blues: {
    accent:      '#fb923c',
    accentDim:   '#e07030',
    glow:        'rgba(251,146,60,0.15)',
    bgTint:      '#0f0a06',
    gridColor:   '#1a1106',
    panelBorder: 'rgba(251,146,60,0.2)',
    label:       'Blues',
    desc:        'Gritty, soulful, vocal overdrive',
  },
  rock: {
    accent:      '#fbbf24',
    accentDim:   '#f5a623',
    glow:        'rgba(251,191,36,0.14)',
    bgTint:      '#0f0e06',
    gridColor:   '#191700',
    panelBorder: 'rgba(251,191,36,0.2)',
    label:       'Rock',
    desc:        'Punchy crunch, classic rock drive',
  },
  high_gain: {
    accent:      '#f472b6',
    accentDim:   '#e040a0',
    glow:        'rgba(244,114,182,0.14)',
    bgTint:      '#0f080e',
    gridColor:   '#190010',
    panelBorder: 'rgba(244,114,182,0.2)',
    label:       'High Gain',
    desc:        'Aggressive, tight, modern gain',
  },
  metal: {
    accent:      '#f87171',
    accentDim:   '#e84040',
    glow:        'rgba(248,113,113,0.16)',
    bgTint:      '#0f0707',
    gridColor:   '#1a0505',
    panelBorder: 'rgba(248,113,113,0.22)',
    label:       'Metal',
    desc:        'Heavy, tight, crushing distortion',
  },
  bass: {
    accent:      '#38bdf8',
    accentDim:   '#4c8faf',
    glow:        'rgba(56,189,248,0.12)',
    bgTint:      '#060d12',
    gridColor:   '#0a1520',
    panelBorder: 'rgba(56,189,248,0.16)',
    label:       'Bass',
    desc:        'Deep, warm, low-end foundation',
  },
}

// ── Chain order & accent colors ──────────────────────────────────────────────
const CHAIN_SLOTS = [
  { key: 'noise_gate', label: 'GATE', color: '#a3e635' },
  { key: 'efx',        label: 'EFX',  color: '#fbbf24' },
  { key: 'amp',        label: 'AMP',  color: '#f87171' },
  { key: 'cab',        label: 'IR',   color: '#22d3ee' },
  { key: 'mod',        label: 'MOD',  color: '#c084fc' },
  { key: 'delay',      label: 'DLY',  color: '#60a5fa' },
  { key: 'reverb',     label: 'RVB',  color: '#fb923c' },
]

// ── SVG icons for each slot ──────────────────────────────────────────────────
const SLOT_ICONS = {
  noise_gate: (c) => (
    <svg viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <path d="M3 14h4l2.5-6 5 12 2.5-6H25" />
      <line x1="3" y1="14" x2="25" y2="14" stroke={c} strokeOpacity="0.15" strokeDasharray="2 2" />
    </svg>
  ),
  efx: (c) => (
    <svg viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <rect x="7" y="4" width="14" height="20" rx="3" />
      <circle cx="14" cy="11" r="2.5" />
      <circle cx="10" cy="18" r="1.2" /><circle cx="18" cy="18" r="1.2" />
    </svg>
  ),
  amp: (c) => (
    <svg viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <rect x="3" y="6" width="22" height="16" rx="2" />
      <path d="M3 11h22" />
      <circle cx="8"  cy="8.5" r="1" fill={c} stroke="none" />
      <circle cx="12" cy="8.5" r="1" fill={c} stroke="none" />
      <circle cx="16" cy="8.5" r="1" fill={c} stroke="none" />
      <circle cx="14" cy="18" r="3.5" />
    </svg>
  ),
  cab: (c) => (
    <svg viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <rect x="4" y="5" width="20" height="18" rx="2" />
      <circle cx="14" cy="14" r="5" />
      <circle cx="14" cy="14" r="1.5" fill={c} stroke="none" />
    </svg>
  ),
  mod: (c) => (
    <svg viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <path d="M3 14c3-7 5 7 8 0s5-7 8 0 5 7 8 0" strokeWidth="1.8" />
    </svg>
  ),
  delay: (c) => (
    <svg viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <circle cx="14" cy="14" r="9" />
      <polyline points="14,8 14,14 18,18" />
      <path d="M5.5 14 H2" /><path d="M26 14 H22.5" strokeOpacity="0.4" />
    </svg>
  ),
  reverb: (c) => (
    <svg viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <rect x="4"  y="4"  width="8"  height="8"  rx="1" strokeOpacity="0.35" />
      <rect x="8"  y="8"  width="8"  height="8"  rx="1" strokeOpacity="0.6" />
      <rect x="12" y="12" width="12" height="12" rx="1" />
    </svg>
  ),
}

// ── Backend health check ─────────────────────────────────────────────────────
function BackendStatus() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch('http://localhost:8000/', { signal: AbortSignal.timeout(3000) })
        if (!cancelled) setStatus(res.ok ? 'online' : 'offline')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }
    check()
    const interval = setInterval(check, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const dot = { checking: '#888', online: '#4ade80', offline: '#f87171' }[status]
  const label = { checking: 'Connecting\u2026', online: 'Backend online', offline: 'Backend offline' }[status]

  return (
    <div className="backend-status">
      <span className="status-dot" style={{ background: dot, boxShadow: status === 'online' ? `0 0 6px ${dot}` : 'none' }} />
      <span className="status-label">{label}</span>
    </div>
  )
}

// ── Knob component ────────────────────────────────────────────────────────────
function Knob({ label, value, min = 0, max = 100, accent = '#f5a623' }) {
  const [display, setDisplay] = useState(0)
  const num = Number(value) || 0
  useEffect(() => {
    const t = setTimeout(() => setDisplay(num), 60)
    return () => clearTimeout(t)
  }, [num])
  const norm  = Math.min(Math.max(display, min), max)
  const angle = -135 + ((norm - min) / (max - min)) * 270
  const isOption = typeof value === 'string' && isNaN(Number(value))

  return (
    <div className="knob-wrap">
      {isOption ? (
        <div className="knob-toggle" style={{ '--ka': accent }}>
          <span className="knob-toggle-val">{value}</span>
        </div>
      ) : (
        <div className="knob" style={{ '--ka': accent }}>
          <div className="knob-ring" />
          <div className="knob-face">
            <div className="knob-dot" style={{ transform: `rotate(${angle}deg)` }} />
          </div>
        </div>
      )}
      <div className="knob-value">{isOption ? '' : (typeof value === 'number' ? value.toFixed(0) : value)}</div>
      <div className="knob-label">{label}</div>
    </div>
  )
}

// ── Detail Panel — shown when a chain slot is clicked ────────────────────────
function DetailPanel({ slotKey, data, accentColor, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [slotKey])

  if (!data) return null

  const settings = data.settings || []
  const typeName = data.type && data.type !== 'None' ? data.type : null
  const isCab = slotKey === 'cab'

  return (
    <div
      className={`detail-panel ${visible ? 'panel-visible' : 'panel-hidden'}`}
      style={{ '--panel-accent': accentColor }}
    >
      <div className="detail-header">
        <div className="detail-icon-wrap">
          {SLOT_ICONS[slotKey](accentColor)}
        </div>
        <div className="detail-title-group">
          <span className="detail-slot-label">{CHAIN_SLOTS.find(s => s.key === slotKey)?.label}</span>
          <h3 className="detail-type-name">{typeName || (isCab ? data.type : 'Off')}</h3>
        </div>
        <button className="detail-close" onClick={onClose} aria-label="Close panel">
          <svg viewBox="0 0 18 18" width="16" height="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="4" x2="14" y2="14"/><line x1="14" y1="4" x2="4" y2="14"/>
          </svg>
        </button>
      </div>

      <div className="detail-knobs">
        {settings.map((s, i) => (
          <Knob
            key={i}
            label={s.label}
            value={s.value}
            min={s.min}
            max={s.max}
            accent={accentColor}
          />
        ))}
        {settings.length === 0 && (
          <p className="detail-empty">No parameters</p>
        )}
      </div>
    </div>
  )
}

// ── Build chain data from API result ─────────────────────────────────────────
function buildChainData(chain) {
  const result = {}
  for (const slot of CHAIN_SLOTS) {
    const raw = chain[slot.key]
    if (!raw) { result[slot.key] = null; continue }
    const enabled = raw.enabled !== false && raw.type !== 'None'
    const settings = (raw.settings || [])
      .filter(s => s.label.toLowerCase() !== 'model')
      .map(s => ({
        label: s.label,
        value: typeof s.value === 'number' ? s.value : s.value,
        min: s.min,
        max: s.max
      }))
    // Model name is shown in the detail panel header — no need to duplicate as a knob tile
    result[slot.key] = { type: raw.type || null, enabled, settings }
  }
  return result
}

// ── Signal Chain Bar ──────────────────────────────────────────────────────────
function SignalChain({ chain, activeSlot, onSlotClick }) {
  return (
    <div className="signal-chain-bar">
      <div className="chain-cable-track" />
      {CHAIN_SLOTS.map((slot, idx) => {
        const data    = chain[slot.key]
        const enabled = data?.enabled
        const active  = activeSlot === slot.key
        const color   = enabled ? slot.color : '#4b5563'

        return (
          <React.Fragment key={slot.key}>
            {idx > 0 && <div className={`chain-cable-seg ${enabled ? 'cable-hot' : ''}`} />}
            <button
              className={`chain-node ${enabled ? 'node-on' : 'node-off'} ${active ? 'node-active' : ''}`}
              style={{ '--nc': slot.color }}
              onClick={() => onSlotClick(slot.key)}
              aria-pressed={active}
              title={slot.label}
            >
              <div className="node-icon">{SLOT_ICONS[slot.key](color)}</div>
              <span className="node-label">{slot.label}</span>
              {enabled && <div className="node-led" />}
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Debug Strip ──────────────────────────────────────────────────────────────
function DebugStrip({ debug }) {
  const pills = [
    { label: 'ZCR',      val: debug?.zcr       ? `${(debug.zcr * 100).toFixed(1)}%`   : '\u2014' },
    { label: 'Flatness', val: debug?.flatness  ? (debug.flatness * 100).toFixed(2)     : '\u2014' },
    { label: 'RMS',      val: debug?.rms       ? `${(debug.rms * 100).toFixed(1)}%`   : '\u2014' },
    { label: 'Centroid', val: debug?.centroid  ? `${Math.round(debug.centroid)} Hz`    : '\u2014' },
    { label: 'Flux',     val: debug?.flux      ? (debug.flux).toFixed(3)               : '\u2014' },
    { label: 'Gain',     val: debug?.gain_score !== undefined ? debug.gain_score        : '\u2014' },
  ]

  return (
    <div className="debug-strip">
      {pills.map(({ label, val }) => (
        <div key={label} className="debug-pill">
          <span className="pill-label">{label}</span>
          <span className="pill-val">{val}</span>
        </div>
      ))}
    </div>
  )
}

// ── Result Dashboard ──────────────────────────────────────────────────────────
function ResultDashboard({ chain, features, debug }) {
  const [activeSlot, setActiveSlot] = useState(null)
  const [prevSlot, setPrevSlot]     = useState(null)

  const styleKey = (chain.style ?? 'clean').toLowerCase().replace(/ /g, '_')
  const theme    = GENRE_THEMES[styleKey] ?? GENRE_THEMES.rock
  const chainData = buildChainData(chain)

  // Apply genre theme as CSS variables
  useEffect(() => {
    const t = GENRE_THEMES[styleKey] ?? GENRE_THEMES.rock
    const root = document.documentElement
    root.style.setProperty('--accent',       t.accent)
    root.style.setProperty('--accent-dim',   t.accentDim)
    root.style.setProperty('--glow',         t.glow)
    root.style.setProperty('--bg-tint',      t.bgTint)
    root.style.setProperty('--grid-color',   t.gridColor)
    root.style.setProperty('--panel-border', t.panelBorder)
    return () => {
      root.style.setProperty('--accent',       '#fbbf24')
      root.style.setProperty('--accent-dim',   '#f5a623')
      root.style.setProperty('--glow',         'rgba(251,191,36,0.14)')
      root.style.setProperty('--bg-tint',      '#060608')
      root.style.setProperty('--grid-color',   '#0d0d12')
      root.style.setProperty('--panel-border', 'rgba(255,255,255,0.08)')
    }
  }, [styleKey])

  // Default to amp on first load
  useEffect(() => {
    setActiveSlot('amp')
  }, [chain])

  const handleSlotClick = (key) => {
    if (key === activeSlot) {
      setActiveSlot(null)
    } else {
      setPrevSlot(activeSlot)
      setActiveSlot(key)
    }
  }

  const activeSlotMeta = CHAIN_SLOTS.find(s => s.key === activeSlot)
  const activeSlotData = activeSlot ? chainData[activeSlot] : null

  return (
    <div className="dashboard-canvas">
      <div className="panel">

        {/* Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <span className="genre-badge">{theme.label}</span>
            <h2 className="amp-name">{chain.amp?.type ?? 'Unknown Amp'}</h2>
            <p className="amp-desc">{theme.desc} &middot; <em>{chain.tone_character ?? 'balanced'}</em></p>
          </div>
          <div className="header-right">
            <span className="meta-badge">{chain.play_style ?? 'rhythm'}</span>
            <span className="meta-badge">{chain.tone_character ?? 'balanced'}</span>
          </div>
        </header>

        {/* Signal Chain */}
        <SignalChain chain={chainData} activeSlot={activeSlot} onSlotClick={handleSlotClick} />

        {/* Detail Panel — animated swap */}
        <section className="detail-section">
          {activeSlot && activeSlotData ? (
            <DetailPanel
              key={activeSlot}
              slotKey={activeSlot}
              data={activeSlotData}
              accentColor={activeSlotMeta?.color ?? '#f5a623'}
              onClose={() => setActiveSlot(null)}
            />
          ) : (
            <div className="detail-placeholder">
              <span>Select a component above to view settings</span>
            </div>
          )}
        </section>

        {/* Debug Strip */}
        <DebugStrip debug={debug} />

      </div>
    </div>
  )
}

// ── Stem Result Panel ─────────────────────────────────────────────────────────
function StemResultPanel({ stemResult, onAnalyze, loading }) {
  const BASE = 'http://localhost:8000'
  const STEM_LABELS = {
    guitar: { icon: '🎸', label: 'Guitar',  highlight: true },
    bass:   { icon: '🎸', label: 'Bass',    highlight: false },
    drums:  { icon: '🥁', label: 'Drums',   highlight: false },
    vocals: { icon: '🎤', label: 'Vocals',  highlight: false },
    other:  { icon: '🎵', label: 'Other',   highlight: false },
    piano:  { icon: '🎹', label: 'Piano',   highlight: false },
  }

  return (
    <div className="stem-result-panel">
      <p className="stem-result-title">Stems ready</p>
      <p className="stem-result-sub">{stemResult.original_filename}</p>

      <div className="stem-list">
        {Object.entries(stemResult.stems).map(([name, url]) => {
          const meta = STEM_LABELS[name] ?? { icon: '🎵', label: name, highlight: false }
          return (
            <div
              key={name}
              className={`stem-row ${meta.highlight ? 'stem-row-highlight' : ''}`}
            >
              <span className="stem-row-icon">{meta.icon}</span>
              <span className="stem-row-label">{meta.label}</span>
              <a
                href={`${BASE}${url}`}
                download={`${name}.wav`}
                className="stem-download-btn"
                target="_blank"
                rel="noreferrer"
              >
                ↓
              </a>
            </div>
          )
        })}
      </div>

      <button
        className="btn-analyze btn-analyze-stem"
        disabled={loading}
        onClick={() => onAnalyze(stemResult.job_id)}
      >
        {loading ? <span className="spinner spinner-dark" /> : '🎸 Analyze Guitar Tone'}
      </button>
    </div>
  )
}

// ── Main App Shell ────────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile]       = useState(null)
  const [dragging, setDrag]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  const fileInputRef          = useRef(null)

  const [mode, setMode]             = useState(null)       // null | 'stem' | 'mix'
  const [separating, setSeparating] = useState(false)
  const [stemResult, setStemResult] = useState(null)       // response from /separate
  const [sepError, setSepError]     = useState(null)

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false)
    if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0])
  }, [])

  const selectFile = (f) => { setFile(f); setResult(null); setError(null) }

  const analyze = async () => {
    if (!file) return
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await axios.post('http://localhost:8000/analyze', fd)
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const separateSong = async () => {
    if (!file) return
    setSeparating(true)
    setSepError(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await axios.post('http://localhost:8000/separate', fd, {
        timeout: 300000,   // 5 min timeout — separation can be slow on CPU
      })
      setStemResult(res.data)
    } catch (err) {
      setSepError(err.response?.data?.detail || 'Separation failed. Check backend.')
    } finally {
      setSeparating(false)
    }
  }

  const analyzeFromStem = async (jobId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(
        `http://localhost:8000/analyze-stem?job_id=${jobId}&stem=guitar`
      )
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1 className="brand">AmpCraft</h1>
          <p className="tagline">Designed for NUX Mighty Lite BT MK II</p>
        </header>

        <BackendStatus />

        {!mode && (
          <div className="mode-picker">
            <p className="mode-prompt">What are you uploading?</p>
            <button className="mode-btn mode-btn-stem" onClick={() => setMode('stem')}>
              <span className="mode-icon">🎸</span>
              <span className="mode-label">Guitar stem</span>
              <span className="mode-sub">Already isolated — analyze directly</span>
            </button>
            <button className="mode-btn mode-btn-mix" onClick={() => setMode('mix')}>
              <span className="mode-icon">🎵</span>
              <span className="mode-label">Full song / mix</span>
              <span className="mode-sub">Separate guitar stem first</span>
            </button>
          </div>
        )}

        {mode && (
          <div className="mode-selected-bar">
            <span className="mode-chip">{mode === 'stem' ? '🎸 Guitar stem' : '🎵 Full mix'}</span>
            <button className="mode-change" onClick={() => { setMode(null); setFile(null); setStemResult(null) }}>
              Change
            </button>
          </div>
        )}

        {mode && (
          <section className="upload-section">
            <div
              className={`drop-zone ${dragging ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {file
                ? <p className="dz-filename">{file.name}</p>
                : <><p className="dz-main">Drag &amp; drop your audio</p><p className="dz-sub">or <span>click to browse</span></p></>
              }
              {mode === 'stem' && (
                <p className="stem-notice">
                  ⚠️ Guitar stem only — no drums, bass, or vocals
                </p>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }}
              onChange={(e) => selectFile(e.target.files[0])} />
            {error && <p className="error-msg">{error}</p>}
            {sepError && <p className="error-msg">{sepError}</p>}
          </section>
        )}

        {mode === 'stem' && (
          <button className="btn-analyze" disabled={!file || loading} onClick={analyze}>
            {loading ? <span className="spinner" /> : 'Analyze Tone'}
          </button>
        )}

        {mode === 'mix' && !stemResult && (
          <button className="btn-separate" disabled={!file || separating} onClick={separateSong}>
            {separating
              ? <><span className="spinner spinner-dark" /><span>Separating…</span></>
              : 'Separate Stems'}
          </button>
        )}

        {mode === 'mix' && stemResult && (
          <StemResultPanel
            stemResult={stemResult}
            onAnalyze={analyzeFromStem}
            loading={loading}
          />
        )}
      </aside>

      <main className="main-content">
        {separating && !result && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <p className="loading-text">Separating stems…</p>
            <p className="loading-subtext">This takes 1–3 min on CPU · 10–30s on GPU</p>
          </div>
        )}
        {!separating && loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <p className="loading-text">Analyzing tone&hellip;</p>
          </div>
        ) : !separating && result ? (
          <ResultDashboard chain={result.chain} features={result.features} debug={result.debug} />
        ) : (
          <div className="empty-state">
            Upload a guitar track or stem to generate a NUX Mighty Lite BT MK II patch.
          </div>
        )}
      </main>
    </div>
  )
}