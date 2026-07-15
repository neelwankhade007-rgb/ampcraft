import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music2 } from 'lucide-react'

export default function TitleBar({ activeModule, onModuleChange, file }) {
  const modules = [
    { id: 'separator', label: 'Stem Separator' },
    { id: 'backing',   label: 'Backing Maker'  },
    { id: 'tone',      label: 'Tone Matcher', disabled: true },
  ]

  return (
    <header className="titlebar">
      {/* Brand */}
      <div className="titlebar-brand">
        <Music2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="brand-wordmark">AmpCraft</span>
        <span className="brand-badge">Studio</span>
      </div>

      {/* Module Tabs */}
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
    </header>
  )
}
