import { useState, useRef, useMemo } from 'react'
import MapSelector from './components/MapSelector'
import PlaceSearch, { getLastSearched } from './components/PlaceSearch'
import AreaInfo from './components/AreaInfo'
import JobStatus from './components/JobStatus'
import { startGeneration } from './api/client'

/**
 * Root application component.
 * Manages the map selection workflow: choose an area, submit a generation
 * job, and track its progress until the Garmin IMG file is ready to download.
 */
export default function App() {
  /** @type {[object|null, Function]} Bounding box of the selected map area */
  const [bbox, setBbox] = useState(null)
  /** @type {[string|null, Function]} Backend job ID once generation is submitted */
  const [jobId, setJobId] = useState(null)
  /** @type {[string|null, Function]} User-facing error message */
  const [error, setError] = useState(null)
  /** @type {[boolean, Function]} True while the generation request is in flight */
  const [submitting, setSubmitting] = useState(false)
  /** Ref forwarded to MapSelector so PlaceSearch can pan the map */
  const mapRef = useRef(null)
  /** Restore the last searched location as the initial map center */
  const initialCenter = useMemo(() => {
    const last = getLastSearched()
    return last ? { lat: last.lat, lon: last.lon } : null
  }, [])

  const handleGenerate = async () => {
    if (!bbox) return
    setError(null)
    setSubmitting(true)
    try {
      const data = await startGeneration(bbox)
      setJobId(data.job_id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setJobId(null)
    setError(null)
    setBbox(null)
  }

  const handlePlaceFound = (lat, lon, displayName) => {
    if (mapRef.current) {
      mapRef.current.setView([lat, lon], 13)
    }
  }

  return (
    <div className="app">
      <header>
        <h1>TrailForge</h1>
        <p>Select an area on the map to generate a Garmin IMG file</p>
      </header>

      <div className="main-content">
        <MapSelector onBboxChange={setBbox} mapInstanceRef={mapRef} initialCenter={initialCenter} />

        <div className="sidebar">
          <PlaceSearch onPlaceFound={handlePlaceFound} />
          <AreaInfo bbox={bbox} />

          {error && <div className="error-box">{error}</div>}

          {!jobId && (
            <button
              className="generate-btn"
              onClick={handleGenerate}
              disabled={!bbox || submitting}
            >
              {submitting ? 'Submitting...' : 'Generate Garmin Map'}
            </button>
          )}

          {jobId && (
            <>
              <JobStatus jobId={jobId} />
              <button className="reset-btn" onClick={handleReset}>
                New Map
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
