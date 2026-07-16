import { useState, useRef, useCallback, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// useProject — single source of truth for the entire AmpCraft project lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export default function useProject() {
  // ── File & metadata ─────────────────────────────────────────────────────────
  const [file, setFile] = useState(null)
  const [audioDuration, setAudioDuration] = useState(0)
  const [sampleRate, setSampleRate] = useState(null)
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(30)
  const [hasSelection, setHasSelection] = useState(false)
  const [dragging, setDragging] = useState(false)

  // ── Project assets ──────────────────────────────────────────────────────────
  const [stemResult, setStemResult] = useState(null)       // { job_id, stems, original_filename }
  const [backingResult, setBackingResult] = useState(null)  // { job_id, backing_type, mp3_url, wav_url }

  // ── AudioContext (shared across hooks) ──────────────────────────────────────
  const audioCtxRef = useRef(null)
  const audioBufferRef = useRef(null)

  // ── Derived ─────────────────────────────────────────────────────────────────
  const stemsExist = !!stemResult

  // ── File loading & decoding ─────────────────────────────────────────────────
  const loadFile = useCallback(async (f) => {
    setFile(f)
    setStemResult(null)
    setBackingResult(null)
    audioBufferRef.current = null

    if (f) {
      try {
        const ab = await f.arrayBuffer()
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        const decoded = await audioCtxRef.current.decodeAudioData(ab)
        audioBufferRef.current = decoded
        const total = Math.floor(decoded.duration)
        setAudioDuration(total)
        setSampleRate(decoded.sampleRate)
        setStartSec(0)
        setEndSec(total)
        setHasSelection(false)
      } catch (err) {
        console.warn('Could not decode audio for preview:', err)
        setSampleRate(null)
      }
    } else {
      setSampleRate(null)
      setAudioDuration(0)
      setHasSelection(false)
    }
  }, [])

  // ── Clear everything (Replace File) ─────────────────────────────────────────
  const clearProject = useCallback(() => {
    setFile(null)
    setStemResult(null)
    setBackingResult(null)
    setAudioDuration(0)
    setSampleRate(null)
    setStartSec(0)
    setEndSec(30)
    setHasSelection(false)
    setDragging(false)
    audioBufferRef.current = null
  }, [])

  // ── Cleanup AudioContext on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close() } catch (_) {}
      }
    }
  }, [])

  return {
    // File & metadata
    file,
    audioDuration,
    sampleRate,
    startSec,
    endSec,
    hasSelection,
    dragging,
    setStartSec,
    setEndSec,
    setHasSelection,
    setDragging,

    // Project assets
    stemResult,
    setStemResult,
    backingResult,
    setBackingResult,
    stemsExist,

    // Audio refs (shared)
    audioCtxRef,
    audioBufferRef,

    // Actions
    loadFile,
    clearProject,
  }
}
