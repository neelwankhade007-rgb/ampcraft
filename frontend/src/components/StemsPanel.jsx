import React from 'react'
import GlobalMixer from './GlobalMixer'
import StemRow from './StemRow'

const STEM_METADATA = {
  vocals: { label: 'Vocals', icon: '🎤' },
  guitar: { label: 'Guitar', icon: '🎸' },
  drums: { label: 'Drums', icon: '🥁' },
  bass: { label: 'Bass', icon: '🎸' },
  piano: { label: 'Piano', icon: '🎹' },
  other: { label: 'Other', icon: '🎵' }
}

// Full results panel: canvas header + master mixer + individual stem rows
export default function StemsPanel({
  stemResult,
  globalPlaying,
  globalTime,
  globalDuration,
  downloadFormat,
  onPlayToggle,
  onSeek,
  onFormatChange,
  registerAudio
}) {
  return (
    <div className="splitter-canvas">
      <div className="canvas-header">
        <h2>Isolated Audio Stems</h2>
        <p>Separation complete for <strong>{stemResult.original_filename}</strong>. Play or download the separated tracks below.</p>
      </div>

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

      <div className="stems-list-container">
        {Object.entries(stemResult.stems).map(([name, url]) => {
          const meta = STEM_METADATA[name] || { label: name, icon: '🎵' }
          return (
            <StemRow
              key={name}
              name={name}
              url={url}
              icon={meta.icon}
              label={meta.label}
              registerAudio={(el) => registerAudio(name, el)}
            />
          )
        })}
      </div>
    </div>
  )
}
