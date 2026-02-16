import { useEffect, useRef } from 'react'

/** Leaflet is loaded globally via index.html (includes leaflet-draw plugin). */
const L = window.L

/**
 * Interactive map component that lets the user draw a rectangle to define
 * a bounding box for map generation. Also provides a geolocation button.
 *
 * @param {Object} props
 * @param {(bbox: object|null) => void} props.onBboxChange - Called when the selection changes.
 * @param {React.MutableRefObject} props.mapInstanceRef - Ref populated with the Leaflet map instance.
 * @param {{ lat: number, lon: number }|null} props.initialCenter - Optional initial map center (e.g. from last search).
 */
export default function MapSelector({ onBboxChange, mapInstanceRef, initialCenter }) {
  const containerRef = useRef(null)
  const initedRef = useRef(false)

  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true

    // Fix default marker icons (vite breaks the default paths)
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    // Start at last searched location if available, otherwise default to Zurich
    const center = initialCenter ? [initialCenter.lat, initialCenter.lon] : [47.4, 8.5]
    const zoom = initialCenter ? 13 : 10
    const map = L.map(containerRef.current).setView(center, zoom)
    if (mapInstanceRef) mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // --- Leaflet-Draw setup ---
    // Only the rectangle tool is enabled; all other shape tools are disabled
    // because the backend expects an axis-aligned bounding box.
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
      draw: {
        rectangle: {
          shapeOptions: {
            color: '#e94560',
            weight: 2,
          },
        },
        polygon: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
      edit: {
        featureGroup: drawnItems,
      },
    })
    map.addControl(drawControl)

    // Replace any previous selection with the newly drawn rectangle
    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers()
      drawnItems.addLayer(e.layer)
      const bounds = e.layer.getBounds()
      onBboxChange({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      })
    })

    map.on(L.Draw.Event.DELETED, () => {
      onBboxChange(null)
    })

    // Custom Leaflet control that uses the browser Geolocation API to
    // centre the map on the user's current position.
    const LocateControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
        btn.innerHTML = '<a href="#" title="My Location" style="font-size:18px;line-height:30px;text-align:center;display:block;width:30px;height:30px;cursor:pointer;">&#8982;</a>'
        btn.onclick = (ev) => {
          ev.preventDefault()
          ev.stopPropagation()
          if (!navigator.geolocation) return
          navigator.geolocation.getCurrentPosition(
            (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
            () => alert('Could not get your location'),
            { enableHighAccuracy: true }
          )
        }
        return btn
      },
    })
    map.addControl(new LocateControl())

    return () => {
      map.remove()
      if (mapInstanceRef) mapInstanceRef.current = null
      initedRef.current = false
    }
  }, [])

  return <div ref={containerRef} className="map-container" />
}
