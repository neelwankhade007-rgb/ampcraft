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

function RegionSelector({
  duration,       // number: total stem seconds
  startSec,       // number: current start (controlled from App state)
  endSec,         // number: current end (controlled from App state)
  onStartChange,  // (newVal: number) => void
  onEndChange,    // (newVal: number) => void
  onPlay,         // () => void
  onStop,         // () => void
  onAnalyze,      // () => void
  playing,        // boolean: is audio currently playing
  loading,        // boolean: is /analyze-stem-region in flight
  stemUrl,        // string: full URL to guitar.wav, used to seed fake waveform
  analyzeLabel = 'Analyze Selection',
}) {
  const trackRef = useRef(null)
  const dragging = useRef(null)   // null | 'start' | 'end'

  const total    = duration || 1
  const startPct = (startSec / total) * 100
  const endPct   = (endSec   / total) * 100
  const selDur   = endSec - startSec

  // ── Fake waveform bars — seeded from stemUrl for determinism ───────────────
  // No canvas, no external lib. 80 SVG-like divs with heights generated from
  // a simple sin-based hash of the URL string. Same URL → same bar pattern.
  const bars = React.useMemo(() => {
    let seed = 0
    for (let i = 0; i < stemUrl.length; i++) seed += stemUrl.charCodeAt(i)
    const rng = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s) }
    return Array.from({ length: 80 }, (_, i) => Math.round(15 + rng(seed + i * 7.3) * 70))
  }, [stemUrl])

  // ── Drag logic ─────────────────────────────────────────────────────────────
  const secFromEvent = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(pct * total * 10) / 10   // snap to 0.1s precision
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !trackRef.current) return
      const sec = secFromEvent(e)
      if (dragging.current === 'start') {
        onStartChange(Math.max(0, Math.min(sec, endSec - 1.0)))
      } else {
        onEndChange(Math.min(total, Math.max(sec, startSec + 1.0)))
      }
    }
    const onUp = () => { dragging.current = null }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend',  onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onUp)
    }
  }, [startSec, endSec, total])

  // ── Input change handler ───────────────────────────────────────────────────
  const onInputChange = (which, raw) => {
    const v = parseFloat(raw)
    if (isNaN(v)) return
    if (which === 'start') onStartChange(Math.max(0, Math.min(v, endSec - 1.0)))
    else                   onEndChange(Math.min(total, Math.max(v, startSec + 1.0)))
  }

  // ── Time formatter: 75.3 → "1:15" ─────────────────────────────────────────
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="region-selector">

      {/* Header */}
      <div className="rs-header">
        <span className="rs-title">Select Region</span>
        <span className="rs-duration-badge">
          {fmt(selDur)} selected · {fmt(total)} total
        </span>
      </div>

      {/* Waveform Track */}
      <div className="rs-track-wrap" ref={trackRef}>

        {/* Fake waveform bars */}
        <div className="rs-waveform">
          {bars.map((h, i) => {
            const pct = (i / bars.length) * 100
            return (
              <div
                key={i}
                className={`rs-bar ${pct >= startPct && pct <= endPct ? 'rs-bar-active' : ''}`}
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>

        {/* Shaded selection region */}
        <div
          className="rs-selection"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />

        {/* Start handle */}
        <div
          className="rs-handle rs-handle-start"
          style={{ left: `${startPct}%` }}
          onMouseDown={(e) => { e.preventDefault(); dragging.current = 'start' }}
          onTouchStart={(e) => { e.preventDefault(); dragging.current = 'start' }}
        >
          <div className="rs-handle-grip" />
          <span className="rs-handle-label rs-handle-label-left">{fmt(startSec)}</span>
        </div>

        {/* End handle */}
        <div
          className="rs-handle rs-handle-end"
          style={{ left: `${endPct}%` }}
          onMouseDown={(e) => { e.preventDefault(); dragging.current = 'end' }}
          onTouchStart={(e) => { e.preventDefault(); dragging.current = 'end' }}
        >
          <div className="rs-handle-grip" />
          <span className="rs-handle-label rs-handle-label-right">{fmt(endSec)}</span>
        </div>

      </div>

      {/* Manual time inputs + action buttons */}
      <div className="rs-controls">

        <div className="rs-inputs">
          <div className="rs-input-group">
            <label className="rs-input-label">Start (sec)</label>
            <input
              type="number"
              className="rs-input"
              value={startSec}
              min={0}
              max={endSec - 1}
              step={0.1}
              onChange={(e) => onInputChange('start', e.target.value)}
            />
            <span className="rs-input-fmt">{fmt(startSec)}</span>
          </div>

          <div className="rs-sep">→</div>

          <div className="rs-input-group">
            <label className="rs-input-label">End (sec)</label>
            <input
              type="number"
              className="rs-input"
              value={endSec}
              min={startSec + 1}
              max={total}
              step={0.1}
              onChange={(e) => onInputChange('end', e.target.value)}
            />
            <span className="rs-input-fmt">{fmt(endSec)}</span>
          </div>
        </div>

        <div className="rs-actions">

          <button
            className={`rs-btn-play ${playing ? 'rs-btn-stop' : ''}`}
            onClick={playing ? onStop : onPlay}
            disabled={!duration || selDur < 0.5}
            title={playing ? 'Stop preview' : `Preview ${fmt(startSec)} – ${fmt(endSec)}`}
          >
            {playing
              ? <svg viewBox="0 0 16 16" width="14" fill="currentColor"><rect x="2" y="2" width="5" height="12" rx="1"/><rect x="9" y="2" width="5" height="12" rx="1"/></svg>
              : <svg viewBox="0 0 16 16" width="14" fill="currentColor"><path d="M3 2l11 6-11 6V2z"/></svg>
            }
            {playing ? 'Stop' : 'Preview'}
          </button>

          <button
            className="rs-btn-analyze"
            onClick={onAnalyze}
            disabled={loading || selDur < 1.0}
            title={selDur < 1.0 ? 'Select at least 1 second' : `${analyzeLabel} ${fmt(startSec)} – ${fmt(endSec)}`}
          >
            {loading
              ? <span className="spinner spinner-dark" />
              : analyzeLabel
            }
          </button>

        </div>
      </div>

      {/* Validation warning */}
      {selDur < 1.0 && (
        <p className="rs-warning">⚠ Select at least 1 second of audio to analyze</p>
      )}

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

  // ── Region selector state ───────────────────────────────────────────────────
  const [regionStep, setRegionStep]       = useState(false)
  const [regionTarget, setRegionTarget]   = useState(null) // 'upload' | 'stem'
  // regionStep: true = show RegionSelector in main content
  // false = show empty state or result dashboard

  const [stemDuration, setStemDuration]   = useState(0)
  // Total duration of the guitar stem in seconds (set after audio is decoded)

  const [startSec, setStartSec]           = useState(0)
  const [endSec, setEndSec]               = useState(30)
  // Current selection bounds in seconds (floats, e.g. 12.5, 47.0)

  const [previewPlaying, setPreviewPlaying] = useState(false)
  // true while Web Audio is actively playing the selected region

  // ── Web Audio API refs (not state — mutations don't trigger re-render) ───────
  const audioCtxRef    = useRef(null)
  // Holds the AudioContext singleton. Created lazily on first play.

  const sourceNodeRef  = useRef(null)
  // Holds the currently playing AudioBufferSourceNode. Replaced on each play.

  const audioBufferRef = useRef(null)
  // Holds the decoded AudioBuffer of the guitar stem WAV file.
  // Decoded once when stem is loaded, reused for every preview.

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false)
    if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0])
  }, [])

  const selectFile = async (f) => {
    setFile(f)
    setResult(null)
    setError(null)
    setSepError(null)
    setStemResult(null)
    stopPreview()

    if (f && mode) {
      setRegionTarget('upload')
      setRegionStep(true)
      try {
        const arrayBuffer = await f.arrayBuffer()
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        const decoded = await audioCtxRef.current.decodeAudioData(arrayBuffer)
        audioBufferRef.current = decoded
        const totalSecs = Math.floor(decoded.duration)
        setStemDuration(totalSecs)
        setStartSec(0)
        setEndSec(Math.min(30, totalSecs))
      } catch (err) {
        console.warn('Could not decode uploaded file for preview:', err)
      }
    }
  }

  const analyzeFromStem = (jobId) => {
    setResult(null)
    setRegionTarget('stem')
    setRegionStep(true)
  }

  const loadStemAudio = async (stemData) => {
    // stemData is the response body from POST /separate
    // stemData.guitar_stem is a path like "/stems/abc123/guitar.wav"
    const url = `http://localhost:8000${stemData.guitar_stem}`
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()

      // Create AudioContext once — browsers need a user gesture first,
      // and the user has already clicked "Separate Stems" by this point
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }

      const decoded = await audioCtxRef.current.decodeAudioData(arrayBuffer)
      audioBufferRef.current = decoded

      const totalSecs = Math.floor(decoded.duration)
      setStemDuration(totalSecs)
      setStartSec(0)
      // Default end: first 30s or full duration if shorter
      setEndSec(Math.min(30, totalSecs))
    } catch (err) {
      // Non-fatal: region selector still works, preview button will be disabled
      console.warn('[loadStemAudio] Could not decode audio for preview:', err)
    }
  }

  const playPreview = () => {
    if (!audioBufferRef.current || !audioCtxRef.current) return

    // Stop anything currently playing
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch (_) {}
      sourceNodeRef.current = null
    }

    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(ctx.destination)

    const offset   = Math.max(0, startSec)
    const duration = Math.max(0.1, endSec - startSec)
    // start(when, offset, duration):
    //   when=0     → play immediately
    //   offset     → start from this position in the AudioBuffer
    //   duration   → play for this many seconds then stop automatically
    source.start(0, offset, duration)

    source.onended = () => {
      setPreviewPlaying(false)
      sourceNodeRef.current = null
    }

    sourceNodeRef.current = source
    setPreviewPlaying(true)
  }

  const stopPreview = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch (_) {}
      sourceNodeRef.current = null
    }
    setPreviewPlaying(false)
  }

  const analyzeUploadRegion = async () => {
    stopPreview()
    if (endSec - startSec < 1.0) {
      setError('Select at least 1 second of audio before analyzing.')
      return
    }
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('start_sec', String(startSec))
    fd.append('end_sec', String(endSec))
    try {
      const res = await axios.post('http://localhost:8000/analyze-upload-region', fd)
      setResult(res.data)
      setRegionStep(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const separateSongRegion = async () => {
    stopPreview()
    if (endSec - startSec < 1.0) {
      setSepError('Select at least 1 second of audio before separating.')
      return
    }
    setSeparating(true)
    setSepError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('start_sec', String(startSec))
    fd.append('end_sec', String(endSec))
    try {
      const res = await axios.post('http://localhost:8000/separate', fd, {
        timeout: 300000,
      })
      setStemResult(res.data)
      setRegionTarget('stem')
      setRegionStep(true)
      loadStemAudio(res.data)
    } catch (err) {
      setSepError(err.response?.data?.detail || 'Separation failed. Check backend.')
    } finally {
      setSeparating(false)
    }
  }

  const analyzeStemRegion = async () => {
    if (!stemResult) return
    stopPreview()

    // Client-side guard — backend also validates
    if (endSec - startSec < 1.0) {
      setError('Select at least 1 second of audio before analyzing.')
      return
    }

    setLoading(true)
    setError(null)

    const fd = new FormData()
    fd.append('job_id',    stemResult.job_id)
    fd.append('stem',      'guitar')
    fd.append('start_sec', String(startSec))
    fd.append('end_sec',   String(endSec))

    try {
      const res = await axios.post(
        'http://localhost:8000/analyze-stem-region',
        fd
        // No Content-Type header — axios sets multipart/form-data automatically
      )
      setResult(res.data)
      setRegionStep(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      stopPreview()
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
        audioCtxRef.current = null
      }
    }
  }, [])

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
            <button className="mode-change" onClick={() => {
              setMode(null);
              setFile(null);
              setStemResult(null);
              stopPreview();
              setRegionStep(false);
              setStemDuration(0);
              setStartSec(0);
              setEndSec(30);
              audioBufferRef.current = null;
            }}>
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


        {mode === 'mix' && stemResult && (
          <StemResultPanel
            stemResult={stemResult}
            onAnalyze={analyzeFromStem}
            loading={loading}
          />
        )}
      </aside>

      <main className="main-content">

        {/* ── A: Stem separation in progress ── */}
        {separating && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <p className="loading-text">Separating stems…</p>
            <p className="loading-subtext">1–3 min on CPU · 10–30s on GPU</p>
          </div>
        )}

        {/* ── B: Region selector step ── */}
        {!separating && regionStep && (regionTarget === 'upload' ? file : stemResult) && !result && (
          <div className="region-step-canvas">
            <div className="region-step-header">
              <h3 className="region-step-title">{regionTarget === 'upload' ? 'Audio Loaded' : 'Guitar Stem Ready'}</h3>
              <p className="region-step-sub">
                Drag the handles or type exact times to select the part you want to
                {regionTarget === 'upload' && mode === 'mix' ? ' separate.' : ' analyze.'}
                Hit Preview to hear it, then {regionTarget === 'upload' && mode === 'mix' ? 'Separate Region' : 'Analyze Selection'}.
              </p>
            </div>

            <RegionSelector
              duration={stemDuration}
              startSec={startSec}
              endSec={endSec}
              onStartChange={(v) => { stopPreview(); setStartSec(parseFloat(v.toFixed(1))) }}
              onEndChange={(v)   => { stopPreview(); setEndSec(parseFloat(v.toFixed(1))) }}
              onPlay={playPreview}
              onStop={stopPreview}
              onAnalyze={() => {
                if (regionTarget === 'upload') {
                  if (mode === 'stem') analyzeUploadRegion()
                  if (mode === 'mix') separateSongRegion()
                } else {
                  analyzeStemRegion()
                }
              }}
              playing={previewPlaying}
              loading={loading || separating}
              stemUrl={regionTarget === 'stem' && stemResult ? `http://localhost:8000${stemResult.guitar_stem}` : file?.name || 'fake'}
              analyzeLabel={regionTarget === 'upload' && mode === 'mix' ? 'Separate Region' : 'Analyze Selection'}
            />

            {error && <p className="error-msg" style={{ marginTop: '12px' }}>{error}</p>}
            {sepError && <p className="error-msg" style={{ marginTop: '12px' }}>{sepError}</p>}
          </div>
        )}

        {/* ── C: Analysis in progress (from region) ── */}
        {!separating && loading && !result && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <p className="loading-text">Analyzing region…</p>
            <p className="loading-subtext">
              {startSec.toFixed(1)}s → {endSec.toFixed(1)}s
              &nbsp;·&nbsp;{(endSec - startSec).toFixed(1)}s
            </p>
          </div>
        )}

        {/* ── D: Result dashboard ── */}
        {!separating && !loading && result && (
          <>
            {/* "Try different region" bar — only shown in mix mode */}
            {mode === 'mix' && stemResult && (
              <div className="region-back-bar">
                <button
                  className="region-back-btn"
                  onClick={() => { setResult(null); setRegionStep(true) }}
                >
                  ← Try different region
                </button>
                {result.region && (
                  <span className="region-back-info">
                    Analyzed {result.region.start?.toFixed(1)}s – {result.region.end?.toFixed(1)}s
                    &nbsp;({result.region.duration}s)
                  </span>
                )}
              </div>
            )}

            <ResultDashboard
              chain={result.chain}
              features={result.features}
              debug={result.debug}
            />
          </>
        )}

        {/* ── E: Empty state ── */}
        {!separating && !loading && !result && !regionStep && (
          <div className="empty-state">
            Upload a guitar track or stem to generate a NUX Mighty Lite BT MK II patch.
          </div>
        )}

      </main>
    </div>
  )
}