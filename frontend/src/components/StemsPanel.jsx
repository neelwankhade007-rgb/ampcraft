import React from 'react'
import { motion } from 'framer-motion'
import StemRow from './StemRow'

const STEM_ORDER = ['vocals', 'guitar', 'drums', 'bass', 'piano', 'other']

export default function StemsPanel({
  stemResult,
  mutedStems,
  soloedStems,
  stemVolumes,
  onMuteToggle,
  onSoloToggle,
  onVolumeChange,
}) {
  if (!stemResult || !stemResult.stems) return null

  // Sort stems in preferred order (vocals, guitar, drums, bass, piano, other)
  const stemEntries = Object.entries(stemResult.stems).sort(([a], [b]) => {
    const ai = STEM_ORDER.indexOf(a)
    const bi = STEM_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <motion.div
      className="results-workspace"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="stems-grid-area">
        <div className="stems-grid-header">
          <h3 className="mixer-title">Stem Mixer</h3>
          <span className="mixer-subtitle">Channel Controls & Stems Export</span>
        </div>
        <div className="stems-grid">
          {stemEntries.map(([name, url], i) => (
            <StemRow
              key={name}
              name={name}
              url={url}
              index={i}
              mutedStems={mutedStems}
              soloedStems={soloedStems}
              volume={stemVolumes[name] ?? 1.0}
              onMuteToggle={onMuteToggle}
              onSoloToggle={onSoloToggle}
              onVolumeChange={onVolumeChange}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
