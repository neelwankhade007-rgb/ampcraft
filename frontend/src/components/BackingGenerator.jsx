import React, { useState } from 'react'
import axios from 'axios'
import '../index.css'
import BackingPlayer from './BackingPlayer'

const BASE_URL = 'http://localhost:8000'

export default function BackingGenerator({ jobId }) {
  const [backingType, setBackingType] = useState('guitar')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleGenerate = async () => {
    if (!jobId) {
      setError('Please separate stems first under the Stem Separator tab.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await axios.post(`${BASE_URL}/generate-backing`, {
        job_id: jobId,
        backing_type: backingType
      })
      setResult(response.data)
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        'Backing generation failed. Please check if the backend is running.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Empty State when no active jobId exists
  if (!jobId) {
    return (
      <div className="empty-state" style={{ padding: '48px 24px' }}>
        <div className="empty-state-graphic">🎸</div>
        <h3>No Active Track Found</h3>
        <p>Please upload and separate a track first to generate custom backing tracks.</p>
      </div>
    )
  }

  // Active State when jobId exists
  return (
    <div className="region-selector" style={{ marginTop: '24px' }}>
      <div className="canvas-header" style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Backing Generator</h2>
        <p>Generate backing tracks by muting a selected instrument.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Backing Type
          </label>
          <select
            value={backingType}
            onChange={(e) => setBackingType(e.target.value)}
            disabled={loading}
            className="rs-input"
            style={{ width: '100%', height: '40px', padding: '0 12px' }}
          >
            <option value="guitar">Guitar Backing</option>
            <option value="bass">Bass Backing</option>
            <option value="drums">Drums Backing</option>
            <option value="piano">Piano Backing</option>
            <option value="karaoke">Karaoke</option>
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rs-btn-separate"
          style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Generating...' : 'Generate Backing'}
        </button>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent)', marginTop: '8px' }}>
            <span className="spinner" style={{ borderColor: 'rgba(251, 191, 36, 0.2)', borderTopColor: 'var(--accent)' }}></span>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Generating backing track...</span>
          </div>
        )}

        {error && (
          <div className="error-msg" style={{ marginTop: '8px' }}>
            {error}
          </div>
        )}

        {result && result.success && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>✅</span> Backing Generated
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <BackingPlayer src={`${BASE_URL}${result.mp3_url}`} />

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                {/* Download buttons route through the force-download endpoint */}
                <a
                  href={`${BASE_URL}/download-backing/${result.job_id}/${result.mp3_url.split('/').pop()}`}
                  className="rs-btn-play"
                  style={{ flex: 1, textAlign: 'center', display: 'inline-block', textDecoration: 'none', padding: '10px 0' }}
                >
                  Download MP3
                </a>
                <a
                  href={`${BASE_URL}/download-backing/${result.job_id}/${result.wav_url.split('/').pop()}`}
                  className="rs-btn-play"
                  style={{ flex: 1, textAlign: 'center', display: 'inline-block', textDecoration: 'none', padding: '10px 0' }}
                >
                  Download WAV
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
