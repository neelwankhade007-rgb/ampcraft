import React, { useState, useEffect, useRef } from 'react'

export default function SeparationLoader({ isComplete, onFinish }) {
  const [currentStage, setCurrentStage] = useState(0)
  const [overallProgress, setOverallProgress] = useState(0)
  const overallProgressRef = useRef(0)
  overallProgressRef.current = overallProgress

  useEffect(() => {
    let startTime = Date.now()
    let completedTime = null
    let completedStartProgress = 0

    let interval = setInterval(() => {
      if (isComplete) {
        if (completedTime === null) {
          completedTime = Date.now()
          completedStartProgress = overallProgressRef.current
        }
        const elapsedSinceComplete = (Date.now() - completedTime) / 1000 // seconds
        // Fast transition to 100 in 0.6 seconds
        const pct = Math.min(1, elapsedSinceComplete / 0.6)
        const currentProg = Math.round(completedStartProgress + (100 - completedStartProgress) * pct)

        setOverallProgress(currentProg)
        if (currentProg >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            onFinish()
          }, 300)
        }

        if (pct > 0.2) setCurrentStage(3)
        if (pct > 0.6) setCurrentStage(4)
        return
      }

      const elapsed = (Date.now() - startTime) / 1000 // seconds

      let stage = 0
      let prog = 0

      if (elapsed < 3) {
        // Stage 0: Loading Audio (0 to 3s)
        stage = 0
        prog = (elapsed / 3) * 15
      } else if (elapsed < 8) {
        // Stage 1: Analyzing Mix (3s to 8s)
        stage = 1
        prog = 15 + ((elapsed - 3) / 5) * 15
      } else if (elapsed < 38) {
        // Stage 2: Separating Instruments (8s to 38s)
        stage = 2
        prog = 30 + ((elapsed - 8) / 30) * 45
      } else if (elapsed < 48) {
        // Stage 3: Rendering Stems (38s to 48s)
        stage = 3
        prog = 75 + ((elapsed - 38) / 10) * 15
      } else {
        // Stage 4: Finalizing Output (48s+)
        stage = 4
        const extraTime = elapsed - 48
        const rate = 1 - Math.exp(-extraTime / 20)
        prog = 90 + rate * 8
      }

      setCurrentStage(stage)
      setOverallProgress(Math.min(99, Math.round(prog)))
    }, 100)

    return () => clearInterval(interval)
  }, [isComplete, onFinish])

  const STAGES = [
    { title: 'Loading Audio', subtitle: 'Reading audio data...' },
    { title: 'Analyzing Mix', subtitle: 'Identifying track components...' },
    { title: 'Separating Instruments', subtitle: 'Creating individual stem tracks...' },
    { title: 'Rendering Stems', subtitle: 'Preparing high-quality outputs...' },
    { title: 'Finalizing Output', subtitle: 'Almost done...' }
  ]

  return (
    <div className="daw-loader-container">
      <div className="daw-loader-header">
        <span className="daw-loader-percentage">{overallProgress}%</span>
        <h3 className="daw-loader-title">Processing Mix</h3>
        <p className="daw-loader-subtitle">Please wait while Demucs AI processes your request...</p>
      </div>

      <div className="daw-progress-bar-track">
        <div className="daw-progress-bar-fill" style={{ width: `${overallProgress}%` }} />
      </div>

      <div className="daw-stages-list">
        {STAGES.map((stage, idx) => {
          let stateClass = 'pending'
          if (idx < currentStage) stateClass = 'completed'
          else if (idx === currentStage) stateClass = 'active'

          return (
            <div key={idx} className={`daw-stage-item ${stateClass}`}>
              <div className="daw-stage-node">
                {idx < currentStage ? (
                  <svg className="check-icon" viewBox="0 0 24 24" width="12" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="node-number">{idx + 1}</span>
                )}
              </div>
              <div className="daw-stage-content">
                <div className="daw-stage-title-row">
                  <span className="daw-stage-prefix">Stage {idx + 1}</span>
                  <span className="daw-stage-title">{stage.title}</span>
                </div>
                <span className="daw-stage-subtitle">{stage.subtitle}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
