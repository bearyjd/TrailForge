export interface OfflinePack {
  id: string;
  name: string;
  type: 'trail-local' | 'regional';
  trail_id?: string;       // set for trail-local packs
  region_key?: string;     // set for regional packs
  local_path?: string;     // filesystem path for regional PMTiles
  size_bytes: number;
  downloaded_at: number;   // Unix ms; 0 while downloading
  status: 'downloading' | 'complete' | 'error';
}

export interface RegionDefinition {
  key: string;
  name: string;
  description: string;
  pmtiles_url: string;
  size_bytes_approx: number;
}
