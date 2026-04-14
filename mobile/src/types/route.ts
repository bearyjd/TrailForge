export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number; // Unix ms
}

export interface SavedRoute {
  id: string;
  name: string;
  points: RoutePoint[];
  distance_m: number;
  duration_s: number;
  elevation_gain_m: number;
  created_at: number; // Unix ms
}
