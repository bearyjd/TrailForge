import { useState, useRef, useEffect } from 'react'

const STORAGE_KEY = 'garmin-maps-search-history'
const MAX_HISTORY = 50

/**
 * Load search history from localStorage.
 * @returns {Array<{ query: string, lat: number, lon: number, displayName: string, timestamp: string }>}
 */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

/**
 * Save a search entry to localStorage history.
 */
function saveToHistory(entry) {
  const history = loadHistory()
  const filtered = history.filter(h => h.query.toLowerCase() !== entry.query.toLowerCase())
  filtered.unshift(entry)
  if (filtered.length > MAX_HISTORY) filtered.length = MAX_HISTORY
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

/**
 * Get the most recent search entry, or null.
 */
export function getLastSearched() {
  const history = loadHistory()
  return history.length > 0 ? history[0] : null
}

/**
 * Geocoding search bar with persistent history. Queries the Nominatim API
 * for a place name and saves results to localStorage for future recall.
 *
 * @param {Object} props
 * @param {(lat: number, lon: number, displayName: string) => void} props.onPlaceFound
 *   Called when a matching place is found.
 */
export default function PlaceSearch({ onPlaceFound }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [history, setHistory] = useState(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const wrapperRef = useRef(null)

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    setShowHistory(false)
    const q = query.trim()
    if (!q) return
    setSearching(true)
    try {
      // Proxy through backend to avoid CORS issues and set proper User-Agent
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lon = parseFloat(data[0].lon)
        const displayName = data[0].display_name
        saveToHistory({ query: q, lat, lon, displayName, timestamp: new Date().toISOString() })
        setHistory(loadHistory())
        onPlaceFound(lat, lon, displayName)
      } else {
        alert('Place not found')
      }
    } catch {
      alert('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleHistoryClick = (entry) => {
    setQuery(entry.query)
    setShowHistory(false)
    onPlaceFound(entry.lat, entry.lon, entry.displayName)
  }

  const toggleHistory = () => {
    if (history.length > 0) setShowHistory(prev => !prev)
  }

  return (
    <div className="place-search-wrapper" ref={wrapperRef}>
      <form className="place-search" onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a place..."
          disabled={searching}
        />
        <button type="submit" disabled={searching || !query.trim()}>
          {searching ? '...' : 'Go'}
        </button>
        {history.length > 0 && (
          <button type="button" className="history-toggle" onClick={toggleHistory} title="Recent searches">
            &#9776;
          </button>
        )}
      </form>

      {showHistory && (
        <div className="search-history">
          <div className="search-history-header">
            <span>Recent searches</span>
            <button
              className="history-close"
              onClick={() => setShowHistory(false)}
            >
              &times;
            </button>
          </div>
          {history.map((entry, i) => (
            <button
              key={i}
              className="history-item"
              onClick={() => handleHistoryClick(entry)}
            >
              <span className="history-query">{entry.query}</span>
              <span className="history-date">
                {new Date(entry.timestamp).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
