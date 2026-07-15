import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function SeparationLoader({ isComplete, onFinish, isBacking = false }) {
  const [currentStage, setCurrentStage]         = useState(0)
  const [overallProgress, setOverallProgress]   = useState(0)
  const overallProgressRef                       = useRef(0)
  overallProgressRef.current                     = overallProgress

  useEffect(() => {
    let startTime       = Date.now()
    let completedTime   = null
    let completedStart  = 0

    const interval = setInterval(() => {
      if (isComplete) {
        if (completedTime === null) {
          completedTime  = Date.now()
          completedStart = overallProgressRef.current
        }
        const elapsed = (Date.now() - completedTime) / 1000
        const pct     = Math.min(1, elapsed / 0.6)
        const prog    = Math.round(completedStart + (100 - completedStart) * pct)
        setOverallProgress(prog)
        if (pct > 0.2) setCurrentStage(3)
        if (pct > 0.6) setCurrentStage(4)
        if (prog >= 100) {
          clearInterval(interval)
          setTimeout(onFinish, 300)
        }
        return
      }

      const elapsed = (Date.now() - startTime) / 1000
      let stage = 0, prog = 0

      if      (elapsed < 3)  { stage = 0; prog = (elapsed / 3) * 15 }
      else if (elapsed < 8)  { stage = 1; prog = 15 + ((elapsed - 3)  / 5)  * 15 }
      else if (elapsed < 38) { stage = 2; prog = 30 + ((elapsed - 8)  / 30) * 45 }
      else if (elapsed < 48) { stage = 3; prog = 75 + ((elapsed - 38) / 10) * 15 }
      else {
        stage = 4
        prog  = 90 + (1 - Math.exp(-(elapsed - 48) / 20)) * 8
      }

      setCurrentStage(stage)
      setOverallProgress(Math.min(99, Math.round(prog)))
    }, 100)

    return () => clearInterval(interval)
  }, [isComplete, onFinish])

  const STAGES = isBacking ? [
    { title: 'Loading Audio',           sub: 'Reading audio data…' },
    { title: 'Analyzing Mix',           sub: 'Locating instruments…' },
    { title: 'Separating Instruments',  sub: 'Running Demucs AI…' },
    { title: 'Mixing Backing Track',    sub: 'Summing stems…' },
    { title: 'Finalizing Output',       sub: 'Encoding MP3 & WAV…' },
  ] : [
    { title: 'Loading Audio',           sub: 'Reading audio data…' },
    { title: 'Analyzing Mix',           sub: 'Identifying components…' },
    { title: 'Separating Instruments',  sub: 'Running Demucs AI…' },
    { title: 'Rendering Stems',         sub: 'Preparing outputs…' },
    { title: 'Finalizing Output',       sub: 'Almost done…' },
  ]

  const strokeOffset = CIRCUMFERENCE - (overallProgress / 100) * CIRCUMFERENCE

  return (
    <motion.div
      className="processing-workspace"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Circular progress ring */}
      <div className="processing-ring-wrap">
        <svg
          className="processing-ring-svg"
          width="140"
          height="140"
          viewBox="0 0 140 140"
        >
          <circle
            className="processing-ring-track"
            cx="70" cy="70"
            r={RADIUS}
          />
          <circle
            className="processing-ring-fill"
            cx="70" cy="70"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
          />
        </svg>
        <div className="processing-ring-center">
          <span className="processing-pct">{overallProgress}%</span>
        </div>
      </div>

      {/* Title + subtitle */}
      <div className="processing-info">
        <h2 className="processing-title">
          {isBacking ? 'Generating Backing Track' : 'Separating Stems'}
        </h2>
        <p className="processing-subtitle">
          {STAGES[currentStage]?.sub || 'Please wait…'}
        </p>
      </div>

      {/* Stage checklist */}
      <div className="processing-stages">
        {STAGES.map((stage, idx) => {
          let stateClass = 'pending'
          if (idx < currentStage)  stateClass = 'completed'
          if (idx === currentStage) stateClass = 'active'

          return (
            <motion.div
              key={idx}
              className={`processing-stage ${stateClass}`}
              animate={{ opacity: stateClass === 'pending' ? 0.3 : stateClass === 'completed' ? 0.6 : 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="processing-stage-node">
                {stateClass === 'completed'
                  ? <CheckCircle2 size={11} />
                  : idx + 1
                }
              </div>
              <div className="processing-stage-text">
                <span className="processing-stage-name">{stage.title}</span>
                {stateClass === 'active' && (
                  <span className="processing-stage-sub">{stage.sub}</span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
