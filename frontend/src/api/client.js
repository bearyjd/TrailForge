/**
 * API client for the Garmin map generation backend.
 * All requests are relative to the `/api` base path (handled by the dev proxy
 * during development and by the reverse proxy in production).
 * @module api/client
 */

const API_BASE = '/api'

/**
 * Submit a map generation job for the given bounding box.
 * @param {{ south: number, west: number, north: number, east: number }} bbox - Geographic bounding box.
 * @returns {Promise<{ job_id: string }>} The created job's ID.
 * @throws {Error} If the server responds with a non-OK status.
 */
export async function startGeneration(bbox) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bbox }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed (${res.status})`)
  }
  return res.json()
}

/**
 * Poll the current status of a generation job.
 * @param {string} jobId - The job ID returned by {@link startGeneration}.
 * @returns {Promise<{ status: string, progress?: string, error?: string, filename?: string }>} Job status object.
 * @throws {Error} If the server responds with a non-OK status.
 */
export async function getJobStatus(jobId) {
  const res = await fetch(`${API_BASE}/status/${jobId}`)
  if (!res.ok) {
    throw new Error(`Status check failed (${res.status})`)
  }
  return res.json()
}
