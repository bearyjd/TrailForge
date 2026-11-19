/**
 * Offline maps stay hidden until real per-region tile packs exist.
 * Today every region points at the same planet pmtiles build and the map
 * style is a placeholder demo style, so downloads would render nothing.
 */
export const OFFLINE_MAPS_ENABLED = false;
