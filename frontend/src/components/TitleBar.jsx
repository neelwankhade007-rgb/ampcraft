import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Music2 } from 'lucide-react'

export default function TitleBar({ activeModule, onModuleChange, file, onMenuToggle, onNavigateHome }) {
  const modules = [
    { id: 'separator', label: 'Stem Separator' },
    { id: 'backing',   label: 'Backing Maker'  },
  ]

  return (
    <header className="titlebar">
      {/* Brand - Left */}
      <button
        className="titlebar-brand"
        onClick={onNavigateHome}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        aria-label="Navigate to home"
      >
        <img src="/logo.png" alt="AmpCraft logo" className="brand-logo" style={{ height: '24px', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        <span className="brand-wordmark">AmpCraft</span>
        <span className="brand-badge">Studio</span>
      </button>

      {/* Module Tabs - Center */}
      <nav className="titlebar-modules">
        {modules.map(mod => (
          <button
            key={mod.id}
            className={`titlebar-tab ${activeModule === mod.id ? 'active' : ''}`}
            onClick={() => !mod.disabled && onModuleChange(mod.id)}
            disabled={mod.disabled}
          >
            {mod.label}
            {mod.disabled && <span className="titlebar-tab-soon">Soon</span>}
            {activeModule === mod.id && (
              <motion.div
                className="titlebar-tab-indicator"
                layoutId="tab-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Right side: File Info & Hamburger */}
      <div className="titlebar-right-actions">
        {/* Current File Pill */}
        <div className="titlebar-file">
          <AnimatePresence mode="wait">
            {file && (
              <motion.div
                key="file-pill"
                className="titlebar-file-pill"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                <Music2 size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="titlebar-file-name">{file.name}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hamburger menu button */}
        <motion.button
          onClick={onMenuToggle}
          className="btn-hamburger"
          aria-label="Open Project History"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Menu size={20} />
        </motion.button>
      </div>
    </header>
  )
}
