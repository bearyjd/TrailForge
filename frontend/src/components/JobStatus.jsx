import { useState, useEffect, useRef } from 'react'
import { getJobStatus } from '../api/client'

/**
 * Polls the backend for job progress and displays the current status.
 * Once the job completes, renders a download link for the generated file.
 *
 * @param {Object} props
 * @param {string} props.jobId - Backend job ID to track.
 */
export default function JobStatus({ jobId }) {
  const [status, setStatus] = useState({ status: 'queued' })
  const intervalRef = useRef(null)

  // Poll every 2 seconds. The interval is cleared once the job reaches a
  // terminal state ("completed" or "failed"). Transient fetch errors are
  // silently ignored so that temporary network blips don't break the UI.
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await getJobStatus(jobId)
        setStatus(data)
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(intervalRef.current)
        }
      } catch {
        // keep polling on transient errors
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)
    return () => clearInterval(intervalRef.current)
  }, [jobId])

  return (
    <div className="job-status">
      <h3>Job Status</h3>
      <div className="status-line">
        Status: <strong>{status.status}</strong>
      </div>

      {status.progress && (
        <div className="progress-text">{status.progress}</div>
      )}

      {status.status === 'failed' && status.error && (
        <div className="error-box" style={{ marginTop: '0.5rem' }}>
          {status.error}
        </div>
      )}

      {status.status === 'completed' && status.filename && (
        <>
          <a
            className="download-link"
            href={`/api/download/${jobId}/${status.filename}`}
            download
          >
            Download {status.filename}
          </a>
          {status.file_size && (
            <div className="file-size-info" style={{ margin: '0.5rem 0', fontSize: '0.85rem' }}>
              <span>File size: <strong>{(status.file_size / (1024 * 1024)).toFixed(1)} MB</strong></span>
              {status.file_size > 200 * 1024 * 1024 && (
                <p style={{ color: '#e94560', marginTop: '0.3rem', fontSize: '0.8rem' }}>
                  Large file — make sure your device has enough free storage. Garmin Fenix 7X has ~32 GB internal storage shared with music, apps, and other data.
                </p>
              )}
            </div>
          )}
          <div className="transfer-instructions">
            <h4>Load onto Garmin</h4>
            <ol>
              <li>Connect your Garmin via USB</li>
              <li>Copy <code>gmapsupp.img</code> to the <code>GARMIN</code> folder on the device</li>
              <li>Safely eject and restart</li>
            </ol>
            <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>
              Tip: The Fenix 7X has ~32 GB of storage. Typical city-sized maps are 5–50 MB; large regions can be 100–500 MB.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
