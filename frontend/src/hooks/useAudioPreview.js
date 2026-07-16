import { useState, useRef, useCallback, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// useAudioPreview — handles only timeline preview playback.
// File loading and metadata are now owned by useProject.
// ─────────────────────────────────────────────────────────────────────────────

export default function useAudioPreview(audioCtxRef, audioBufferRef, startSec, endSec) {
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const sourceNodeRef = useRef(null)

  const stopPreview = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch (_) {}
      sourceNodeRef.current = null
    }
    setPreviewPlaying(false)
  }, [])

  const playPreview = useCallback(() => {
    if (!audioBufferRef.current || !audioCtxRef.current) return
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch (_) {}
    }

    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(ctx.destination)
    source.start(0, Math.max(0, startSec), Math.max(0.1, endSec - startSec))
    source.onended = () => {
      setPreviewPlaying(false)
      sourceNodeRef.current = null
    }
    sourceNodeRef.current = source
    setPreviewPlaying(true)
  }, [audioCtxRef, audioBufferRef, startSec, endSec])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop() } catch (_) {}
      }
    }
  }, [])

  return { previewPlaying, playPreview, stopPreview }
}
