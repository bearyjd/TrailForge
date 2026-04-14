export type Difficulty = 'easy' | 'moderate' | 'hard';
export type TrailType = 'hiking' | 'running' | 'biking';

export interface TrailGeometry {
  type: 'LineString';
  coordinates: [number, number][];  // [lon, lat]
}

export interface Trail {
  id: string;
  name: string;
  difficulty: Difficulty;
  distance_m: number;
  elevation_gain_m: number | null;
  trail_type: TrailType;
  description: string | null;
  geometry: TrailGeometry;
}

export interface TrailSearchResponse {
  type: 'FeatureCollection';
  features: Trail[];
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: string;
  error?: string;
  filename?: string;
  file_size?: number;
}

export interface ExportResponse {
  job_id: string;
  status: string;
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}
