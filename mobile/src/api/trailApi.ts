import { BBox, ExportResponse, JobStatus, Trail, TrailSearchResponse } from '@/types/trail';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST' });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function searchTrails(bbox: BBox): Promise<TrailSearchResponse> {
  const { south, west, north, east } = bbox;
  return get<TrailSearchResponse>(
    `/trails/search?south=${south}&west=${west}&north=${north}&east=${east}`
  );
}

export async function fetchTrail(id: string): Promise<Trail> {
  return get<Trail>(`/trails/${id}`);
}

export async function exportTrailToGarmin(id: string): Promise<ExportResponse> {
  return post<ExportResponse>(`/trails/${id}/export/garmin`);
}

export async function pollJobStatus(jobId: string): Promise<JobStatus> {
  return get<JobStatus>(`/status/${jobId}`);
}

export async function geocodePlace(query: string): Promise<{ lat: string; lon: string; display_name: string }[]> {
  return get(`/geocode?q=${encodeURIComponent(query)}`);
}
