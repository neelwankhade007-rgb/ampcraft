import React from 'react'
import { motion } from 'framer-motion'
import GlobalMixer from './GlobalMixer'
import StemRow from './StemRow'

const STEM_ORDER = ['vocals', 'guitar', 'drums', 'bass', 'piano', 'other']

export default function StemsPanel({
  stemResult,
  globalPlaying,
  globalTime,
  globalDuration,
  downloadFormat,
  onPlayToggle,
  onSeek,
  onFormatChange,
  mutedStems,
  soloedStems,
  stemVolumes,
  onMuteToggle,
  onSoloToggle,
  onVolumeChange,
}) {
  // Sort stems in preferred order, fall back to alphabetical for unknowns
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
      {/* Master Transport */}
      <GlobalMixer
        globalPlaying={globalPlaying}
        globalTime={globalTime}
        globalDuration={globalDuration}
        stemResult={stemResult}
        downloadFormat={downloadFormat}
        onPlayToggle={onPlayToggle}
        onSeek={onSeek}
        onFormatChange={onFormatChange}
      />

      {/* Stems Grid */}
      <div className="stems-grid-area">
        <div className="stems-grid">
          {stemEntries.map(([name, url], i) => (
            <StemRow
              key={name}
              name={name}
              url={url}
              index={i}
              mutedStems={mutedStems}
              soloedStems={soloedStems}
              volume={stemVolumes[name] ?? 0.8}
              globalTime={globalTime}
              globalDuration={globalDuration}
              globalPlaying={globalPlaying}
              onMuteToggle={onMuteToggle}
              onSoloToggle={onSoloToggle}
              onVolumeChange={onVolumeChange}
              onSeek={onSeek}
              onPlayToggle={onPlayToggle}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
