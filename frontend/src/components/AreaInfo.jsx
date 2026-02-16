/**
 * Displays the coordinates and approximate area of the selected bounding box.
 * Shows a warning when the selection exceeds the server-side size limit.
 *
 * @param {Object} props
 * @param {{ south: number, west: number, north: number, east: number }|null} props.bbox
 *   The selected bounding box, or null if nothing is selected.
 */
export default function AreaInfo({ bbox }) {
  if (!bbox) {
    return (
      <div className="area-info">
        <p className="no-selection">
          Use the rectangle tool on the map to select an area
        </p>
      </div>
    )
  }

  // Approximate area in km² using the Equirectangular projection:
  // 1 degree of latitude ≈ 111 km. Longitude is scaled by cos(midLatitude)
  // to account for meridian convergence toward the poles.
  const latSpan = Math.abs(bbox.north - bbox.south)
  const lonSpan = Math.abs(bbox.east - bbox.west)
  const areaDeg = latSpan * lonSpan
  const areaKm = areaDeg * 111 * 111 * Math.cos(((bbox.south + bbox.north) / 2) * Math.PI / 180)

  return (
    <div className="area-info">
      <h3>Selected Area</h3>
      <div className="detail">
        <span>North</span><span>{bbox.north.toFixed(4)}</span>
      </div>
      <div className="detail">
        <span>South</span><span>{bbox.south.toFixed(4)}</span>
      </div>
      <div className="detail">
        <span>East</span><span>{bbox.east.toFixed(4)}</span>
      </div>
      <div className="detail">
        <span>West</span><span>{bbox.west.toFixed(4)}</span>
      </div>
      <div className="detail">
        <span>Approx. area</span><span>{areaKm.toFixed(0)} km²</span>
      </div>
      {areaDeg > 4.0 && (
        <p style={{ color: '#e94560', marginTop: '0.5rem', fontSize: '0.8rem' }}>
          Area exceeds maximum limit (4 deg²). Please select a smaller region.
        </p>
      )}
      {areaDeg > 0.25 && areaDeg <= 4.0 && (
        <p style={{ color: '#d4a84e', marginTop: '0.5rem', fontSize: '0.8rem' }}>
          Large area — will be downloaded in {Math.ceil(areaDeg / 0.25)} tiles. This may take several minutes.
        </p>
      )}
    </div>
  )
}
