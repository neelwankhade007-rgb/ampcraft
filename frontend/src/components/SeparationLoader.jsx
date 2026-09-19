import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { API_BASE_URL } from '../config/api'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// ── Configurable Duration-Aware Progress Estimation Constants ───────────────
// Note: This is an estimated progress heuristic based on input duration.
// It is used as a fallback if real backend progress polling is not active.
const DEFAULT_ESTIMATED_DURATION_SEC = 48    // Fallback if audio duration is missing/invalid
const ESTIMATE_FACTOR_PER_AUDIO_SEC  = 1.0   // Estimated processing seconds per second of audio
const MIN_ESTIMATED_PROCESSING_SEC   = 15    // Minimum processing estimate floor for short snippets
const PROGRESS_CEILING               = 96    // Safety ceiling (%) while awaiting backend response
const ASYMPTOTIC_RATE_SEC            = 25    // Smoothing factor for asymptotic approach past expected time

// Proportional stage milestone ratios matching the original baseline (3s, 8s, 38s, 48s out of 48s)
const STAGE_RATIO_1 = 3 / 48   // ~0.0625 (Stage 0 -> Stage 1 at 15% progress)
const STAGE_RATIO_2 = 8 / 48   // ~0.1667 (Stage 1 -> Stage 2 at 30% progress)
const STAGE_RATIO_3 = 38 / 48  // ~0.7917 (Stage 2 -> Stage 3 at 75% progress)

export default function SeparationLoader({ isComplete, onFinish, isBacking = false, duration, jobId }) {
  const [currentStage, setCurrentStage]         = useState(0)
  const [overallProgress, setOverallProgress]   = useState(0)
  const [backendStageText, setBackendStageText] = useState(null)
  const overallProgressRef                       = useRef(0)
  overallProgressRef.current                     = overallProgress

  const maxProgressRef = useRef(0)
  const initialDurationRef = useRef(duration)
  const isRealProgressRef = useRef(false)

  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const startTimeRef = useRef(Date.now())

  // ── Real Backend Demucs Progress Polling ──────────────────────────────────
  useEffect(() => {
    if (!jobId || isComplete) return

    let isMounted = true
    let pollTimer = null

    const pollStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/separate/status/${encodeURIComponent(jobId)}`)
        if (!isMounted) return
        if (res.ok) {
          const data = await res.json()
          if (data && typeof data.progress === 'number') {
            isRealProgressRef.current = true
            const realProg = Math.max(maxProgressRef.current, Math.min(PROGRESS_CEILING, data.progress))
            maxProgressRef.current = realProg
            setOverallProgress(realProg)

            if (data.stage) {
              setBackendStageText(data.stage)
            }

            // Map progress percentage to high-level stage index (0-4)
            if (realProg < 5) setCurrentStage(0)
            else if (realProg < 10) setCurrentStage(1)
            else if (realProg < 90) setCurrentStage(2)
            else if (realProg < 100) setCurrentStage(3)
            else setCurrentStage(4)
          }
        }
      } catch (err) {
        // Network drop or offline: synthetic curve continues as fallback
      } finally {
        if (isMounted && !isComplete) {
          pollTimer = setTimeout(pollStatus, 450)
        }
      }
    }

    pollStatus()

    return () => {
      isMounted = false
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [jobId, isComplete])

  useEffect(() => {
    let completedTime   = null
    let completedStart  = 0

    // Compute expected duration once per separation task
    const rawDuration = initialDurationRef.current
    const isValidDuration = typeof rawDuration === 'number' && !isNaN(rawDuration) && rawDuration > 0
    const expectedTotalSec = isValidDuration
      ? Math.max(MIN_ESTIMATED_PROCESSING_SEC, rawDuration * ESTIMATE_FACTOR_PER_AUDIO_SEC)
      : DEFAULT_ESTIMATED_DURATION_SEC

    const t1 = expectedTotalSec * STAGE_RATIO_1
    const t2 = expectedTotalSec * STAGE_RATIO_2
    const t3 = expectedTotalSec * STAGE_RATIO_3
    const t4 = expectedTotalSec

    const interval = setInterval(() => {
      if (isComplete) {
        if (completedTime === null) {
          completedTime  = Date.now()
          completedStart = overallProgressRef.current
        }
        const elapsed = (Date.now() - completedTime) / 1000
        const pct     = Math.min(1, elapsed / 0.6)
        const prog    = Math.round(completedStart + (100 - completedStart) * pct)
        const safeProg = Math.max(maxProgressRef.current, Math.min(100, prog))
        maxProgressRef.current = safeProg
        setOverallProgress(safeProg)
        if (pct > 0.2) setCurrentStage(3)
        if (pct > 0.6) setCurrentStage(4)
        if (safeProg >= 100) {
          clearInterval(interval)
          setTimeout(() => onFinishRef.current?.(), 300)
        }
        return
      }

      // If we are actively receiving real backend Demucs progress, do NOT advance synthetic estimate
      if (isRealProgressRef.current) {
        return
      }

      const elapsed = (Date.now() - startTimeRef.current) / 1000
      let stage = 0, prog = 0

      if (elapsed < t1) {
        stage = 0
        prog = (elapsed / t1) * 15
      } else if (elapsed < t2) {
        stage = 1
        prog = 15 + ((elapsed - t1) / (t2 - t1)) * 15
      } else if (elapsed < t3) {
        stage = 2
        prog = 30 + ((elapsed - t2) / (t3 - t2)) * 45
      } else if (elapsed < t4) {
        stage = 3
        prog = 75 + ((elapsed - t3) / (t4 - t3)) * 15
      } else {
        stage = 4
        const maxDelta = PROGRESS_CEILING - 90
        prog = 90 + (1 - Math.exp(-(elapsed - t4) / ASYMPTOTIC_RATE_SEC)) * maxDelta
      }

      const clampedProg = Math.min(PROGRESS_CEILING, Math.round(prog))
      const safeProg = Math.max(maxProgressRef.current, clampedProg)
      maxProgressRef.current = safeProg

      setCurrentStage(stage)
      setOverallProgress(safeProg)
    }, 100)

    return () => clearInterval(interval)
  }, [isComplete])

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

  const displaySubtitle = (() => {
    if (isComplete || overallProgress >= 100) return 'Separation Complete'
    if (!backendStageText) return STAGES[currentStage]?.sub || 'Please wait…'
    if (backendStageText.startsWith('Separating instruments')) return 'Separating instruments'
    if (backendStageText.startsWith('Rendering') || backendStageText === 'Analyzing stems') return 'Rendering stems'
    if (backendStageText.toLowerCase() === 'separation complete') return 'Separation Complete'
    return backendStageText.replace(/\s*\(\d+\/\d+\)/g, '').trim()
  })()

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
          {displaySubtitle}
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
