# TrailForge — Trail Discovery Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trail discovery core — backend trail search/detail/export endpoints and a React Native + Expo mobile app (iOS + Android) for browsing, filtering, bookmarking, and exporting OSM trails to Garmin.

**Architecture:** FastAPI backend adds three trail endpoints on top of the existing Overpass/Celery pipeline. A new Expo (React Native) mobile app in `mobile/` communicates exclusively with the backend, using MapLibre GL for map rendering and Zustand for local state.

**Tech Stack:** Python/FastAPI, Pydantic v2, httpx, pytest — React Native 0.76, Expo 52, Expo Router 4, MapLibre GL Native, Zustand 5, AsyncStorage, Jest, React Native Testing Library

---

## File Map

```
backend/
  app/
    models/
      trail_schemas.py          ← NEW: Trail Pydantic models + GeoJSON types
    services/
      trail_search.py           ← NEW: Overpass trail query, GeoJSON conversion
    api/
      trail_routes.py           ← NEW: /trails/search, /trails/{id}, /trails/{id}/export/garmin
    main.py                     ← MODIFY: include trail router
  tests/
    test_trail_routes.py        ← NEW: integration tests for trail endpoints
    test_trail_search.py        ← NEW: unit tests for trail_search service

mobile/                         ← NEW: entire Expo project
  app.json
  package.json
  tsconfig.json
  babel.config.js
  jest.config.js
  app/
    _layout.tsx                 ← Root layout (Expo Router)
    (tabs)/
      _layout.tsx               ← Bottom tab navigator
      index.tsx                 ← Explore (Map) tab
      list.tsx                  ← List / Filter tab
      saved.tsx                 ← Saved tab
    trail/
      [id].tsx                  ← Trail Detail screen
  src/
    types/
      trail.ts                  ← TypeScript interfaces for trail data
    api/
      trailApi.ts               ← Typed API client (fetch wrappers)
    stores/
      mapStore.ts               ← Viewport bbox, selected trail, loading state
      filterStore.ts            ← Difficulty/distance/type filters (persisted)
      savedStore.ts             ← Bookmarked trails (persisted)
    components/
      DifficultyBadge.tsx       ← Color-coded difficulty pill
      TrailRow.tsx              ← Row for list and saved tabs
      FilterBar.tsx             ← Difficulty + distance + type filter bar
      SearchBar.tsx             ← Place-name geocode search
      OfflineBanner.tsx         ← Network status banner
      TrailMap.tsx              ← MapLibre GL map with trail polylines
      TrailBottomSheet.tsx      ← Bottom sheet on trail tap
    hooks/
      useDebounce.ts            ← Generic debounce hook
      useNetworkStatus.ts       ← Online/offline detection
  __tests__/
    stores/
      mapStore.test.ts
      filterStore.test.ts
      savedStore.test.ts
    components/
      TrailDetail.test.tsx
```

---

## Task 1: Trail Pydantic schemas

**Files:**
- Create: `backend/app/models/trail_schemas.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_trail_schemas.py`:

```python
from app.models.trail_schemas import TrailFeature, TrailSearchResponse, TrailDetail

def test_trail_feature_serializes_geojson():
    feature = TrailFeature(
        id="way_123",
        name="Pine Ridge Trail",
        difficulty="moderate",
        distance_m=4200.0,
        elevation_gain_m=None,
        trail_type="hiking",
        description="A scenic ridge trail.",
        geometry={"type": "LineString", "coordinates": [[8.5, 47.1], [8.6, 47.2]]},
    )
    data = feature.model_dump()
    assert data["id"] == "way_123"
    assert data["geometry"]["type"] == "LineString"


def test_trail_search_response_wraps_features():
    resp = TrailSearchResponse(features=[])
    assert resp.type == "FeatureCollection"
    assert resp.features == []
```

- [ ] **Step 2: Run test to verify it fails**

```
cd backend && python -m pytest tests/test_trail_schemas.py -v
```
Expected: `ImportError: cannot import name 'TrailFeature'`

- [ ] **Step 3: Implement schemas**

Create `backend/app/models/trail_schemas.py`:

```python
"""Pydantic schemas for trail search, detail, and export responses."""

from typing import Any
from pydantic import BaseModel


class TrailFeature(BaseModel):
    """A single trail represented as a GeoJSON-compatible feature."""

    id: str                      # e.g. "way_123456" or "relation_789"
    name: str
    difficulty: str              # "easy" | "moderate" | "hard"
    distance_m: float            # total length in metres
    elevation_gain_m: float | None = None  # None until DEM integration
    trail_type: str              # "hiking" | "running" | "biking"
    description: str | None = None
    geometry: dict[str, Any]    # GeoJSON LineString geometry


class TrailSearchResponse(BaseModel):
    """GeoJSON FeatureCollection of trails matching a search query."""

    type: str = "FeatureCollection"
    features: list[TrailFeature]


class TrailDetail(TrailFeature):
    """Full trail detail — same as TrailFeature; extended in future sub-projects."""
    pass


class TrailExportResponse(BaseModel):
    """Response from the trail Garmin export endpoint."""

    job_id: str
    status: str
```

- [ ] **Step 4: Run test to verify it passes**

```
cd backend && python -m pytest tests/test_trail_schemas.py -v
```
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/trail_schemas.py backend/tests/test_trail_schemas.py
git commit -m "feat: add trail Pydantic schemas"
```

---

## Task 2: Trail search service (Overpass → GeoJSON)

**Files:**
- Create: `backend/app/services/trail_search.py`
- Create: `backend/tests/test_trail_search.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_trail_search.py`:

```python
import math
from unittest.mock import patch, MagicMock
from app.services.trail_search import (
    _haversine_distance,
    _compute_length_m,
    _difficulty,
    _trail_type,
    _way_to_feature,
    search_trails,
)


def test_haversine_distance_known_pair():
    # ~111km per degree of latitude
    d = _haversine_distance(0.0, 0.0, 1.0, 0.0)
    assert 110_000 < d < 112_000


def test_compute_length_m_two_points():
    geom = [{"lat": 0.0, "lon": 0.0}, {"lat": 1.0, "lon": 0.0}]
    length = _compute_length_m(geom)
    assert 110_000 < length < 112_000


def test_difficulty_sac_scale():
    assert _difficulty({"sac_scale": "hiking"}) == "easy"
    assert _difficulty({"sac_scale": "mountain_hiking"}) == "moderate"
    assert _difficulty({"sac_scale": "alpine_hiking"}) == "hard"
    assert _difficulty({}) == "easy"


def test_trail_type_defaults_to_hiking():
    assert _trail_type({}) == "hiking"
    assert _trail_type({"route": "bicycle"}) == "biking"
    assert _trail_type({"route": "running"}) == "running"
    assert _trail_type({"bicycle": "yes"}) == "biking"


def test_way_to_feature_basic():
    element = {
        "id": 999,
        "tags": {"name": "Ridge Path", "highway": "path"},
        "geometry": [{"lat": 47.0, "lon": 8.0}, {"lat": 47.01, "lon": 8.01}],
    }
    feature = _way_to_feature(element)
    assert feature.id == "way_999"
    assert feature.name == "Ridge Path"
    assert feature.difficulty == "easy"
    assert feature.trail_type == "hiking"
    assert feature.distance_m > 0
    assert feature.geometry["type"] == "LineString"


def test_search_trails_returns_features():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "elements": [
            {
                "type": "way",
                "id": 1,
                "tags": {"name": "Forest Trail", "highway": "path"},
                "geometry": [{"lat": 47.0, "lon": 8.0}, {"lat": 47.01, "lon": 8.01}],
            }
        ]
    }
    mock_response.raise_for_status = MagicMock()

    with patch("app.services.trail_search.httpx.Client") as MockClient:
        MockClient.return_value.__enter__.return_value.post.return_value = mock_response
        result = search_trails(south=46.9, west=7.9, north=47.1, east=8.1)

    assert len(result.features) == 1
    assert result.features[0].name == "Forest Trail"
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd backend && python -m pytest tests/test_trail_search.py -v
```
Expected: `ImportError: cannot import name '_haversine_distance'`

- [ ] **Step 3: Implement the trail search service**

Create `backend/app/services/trail_search.py`:

```python
"""Query the Overpass API for trails within a bounding box.

Returns a GeoJSON FeatureCollection of named trails, with difficulty,
distance, and trail type derived from OSM tags.
"""

import math
import httpx
from app.config import OVERPASS_URL, OVERPASS_MIRRORS
from app.models.trail_schemas import TrailFeature, TrailSearchResponse

_SAC_DIFFICULTY: dict[str, str] = {
    "hiking": "easy",
    "mountain_hiking": "moderate",
    "demanding_mountain_hiking": "moderate",
    "alpine_hiking": "hard",
    "demanding_alpine_hiking": "hard",
    "difficult_alpine_hiking": "hard",
}


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in metres between two lat/lon points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _compute_length_m(geometry: list[dict]) -> float:
    """Sum Haversine distances along an ordered list of {lat, lon} points."""
    total = 0.0
    for i in range(len(geometry) - 1):
        p1, p2 = geometry[i], geometry[i + 1]
        total += _haversine_distance(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
    return total


def _difficulty(tags: dict) -> str:
    """Map OSM sac_scale tag to easy / moderate / hard."""
    return _SAC_DIFFICULTY.get(tags.get("sac_scale", ""), "easy")


def _trail_type(tags: dict) -> str:
    """Derive trail type (hiking / running / biking) from OSM tags."""
    route = tags.get("route", "")
    if route == "bicycle" or tags.get("bicycle") == "yes":
        return "biking"
    if route == "running":
        return "running"
    return "hiking"


def _way_to_feature(element: dict) -> TrailFeature:
    """Convert a single Overpass way element to a TrailFeature."""
    tags = element.get("tags", {})
    geom = element.get("geometry", [])
    coordinates = [[p["lon"], p["lat"]] for p in geom]
    return TrailFeature(
        id=f"way_{element['id']}",
        name=tags.get("name", "Unnamed Trail"),
        difficulty=_difficulty(tags),
        distance_m=_compute_length_m(geom),
        elevation_gain_m=None,  # requires DEM — deferred to sub-project 2
        trail_type=_trail_type(tags),
        description=tags.get("description") or tags.get("note"),
        geometry={"type": "LineString", "coordinates": coordinates},
    )


def _build_search_query(south: float, west: float, north: float, east: float) -> str:
    return f"""
    [out:json][timeout:60][bbox:{south},{west},{north},{east}];
    (
      way["highway"~"^(footway|path|track)$"]["name"];
      way["route"~"^(hiking|running|bicycle)$"]["name"];
    );
    out geom;
    """


def search_trails(
    south: float, west: float, north: float, east: float
) -> TrailSearchResponse:
    """Fetch named trails within a bbox from the Overpass API.

    Returns a TrailSearchResponse (GeoJSON FeatureCollection).
    Raises httpx.HTTPError on network failure.
    """
    query = _build_search_query(south, west, north, east)
    urls = [OVERPASS_URL] + list(OVERPASS_MIRRORS)

    last_exc: Exception | None = None
    for url in urls:
        try:
            with httpx.Client(timeout=60) as client:
                resp = client.post(url, data={"data": query})
                resp.raise_for_status()
            elements = resp.json().get("elements", [])
            features = [
                _way_to_feature(el)
                for el in elements
                if el.get("type") == "way" and el.get("geometry")
            ]
            return TrailSearchResponse(features=features)
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            last_exc = exc
            continue

    raise last_exc  # type: ignore[misc]


def fetch_trail(trail_id: str) -> TrailFeature | None:
    """Fetch a single trail by ID (e.g. 'way_123456') from Overpass.

    Returns None if the element is not found.
    """
    if not trail_id.startswith("way_"):
        return None
    osm_id = trail_id.removeprefix("way_")
    query = f"[out:json]; way({osm_id}); out geom;"

    with httpx.Client(timeout=30) as client:
        resp = client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()

    elements = resp.json().get("elements", [])
    if not elements or not elements[0].get("geometry"):
        return None
    return _way_to_feature(elements[0])
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd backend && python -m pytest tests/test_trail_search.py -v
```
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/trail_search.py backend/tests/test_trail_search.py
git commit -m "feat: add Overpass trail search service"
```

---

## Task 3: Trail API routes

**Files:**
- Create: `backend/app/api/trail_routes.py`
- Create: `backend/tests/test_trail_routes.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the failing integration tests**

Create `backend/tests/test_trail_routes.py`:

```python
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.models.trail_schemas import TrailSearchResponse, TrailFeature, TrailDetail

client = TestClient(app)

_SAMPLE_FEATURE = TrailFeature(
    id="way_1",
    name="Oak Loop",
    difficulty="easy",
    distance_m=2100.0,
    elevation_gain_m=None,
    trail_type="hiking",
    description=None,
    geometry={"type": "LineString", "coordinates": [[8.5, 47.1], [8.6, 47.2]]},
)


def test_search_trails_returns_geojson():
    with patch("app.api.trail_routes.search_trails") as mock_search:
        mock_search.return_value = TrailSearchResponse(features=[_SAMPLE_FEATURE])
        resp = client.get("/api/trails/search?south=47.0&west=8.0&north=47.2&east=8.8")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 1
    assert data["features"][0]["name"] == "Oak Loop"


def test_search_trails_rejects_oversized_bbox():
    # Area = 5*5 = 25 deg² > MAX_BBOX_AREA_DEG2 (4.0)
    resp = client.get("/api/trails/search?south=40.0&west=0.0&north=45.0&east=5.0")
    assert resp.status_code == 400
    assert "too large" in resp.json()["detail"].lower()


def test_get_trail_found():
    with patch("app.api.trail_routes.fetch_trail") as mock_fetch:
        mock_fetch.return_value = TrailDetail(**_SAMPLE_FEATURE.model_dump())
        resp = client.get("/api/trails/way_1")
    assert resp.status_code == 200
    assert resp.json()["id"] == "way_1"


def test_get_trail_not_found():
    with patch("app.api.trail_routes.fetch_trail") as mock_fetch:
        mock_fetch.return_value = None
        resp = client.get("/api/trails/way_999")
    assert resp.status_code == 404


def test_export_trail_enqueues_job():
    with patch("app.api.trail_routes.fetch_trail") as mock_fetch, \
         patch("app.api.trail_routes.generate_map") as mock_task:
        mock_fetch.return_value = TrailDetail(**_SAMPLE_FEATURE.model_dump())
        mock_result = MagicMock()
        mock_result.id = "celery-job-abc"
        mock_task.delay.return_value = mock_result

        resp = client.post("/api/trails/way_1/export/garmin")
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == "celery-job-abc"
    assert data["status"] == "queued"
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd backend && python -m pytest tests/test_trail_routes.py -v
```
Expected: `404 Not Found` for `/api/trails/search` (route doesn't exist yet)

- [ ] **Step 3: Implement trail routes**

Create `backend/app/api/trail_routes.py`:

```python
"""Trail discovery API routes."""

from fastapi import APIRouter, HTTPException

from app.config import MAX_BBOX_AREA_DEG2
from app.models.trail_schemas import TrailDetail, TrailExportResponse, TrailSearchResponse
from app.services.trail_search import fetch_trail, search_trails
from app.tasks.map_tasks import generate_map

router = APIRouter(prefix="/trails", tags=["trails"])


@router.get("/search", response_model=TrailSearchResponse)
def search(south: float, west: float, north: float, east: float):
    """Return trails within a bounding box.

    Validates bbox area against MAX_BBOX_AREA_DEG2, then queries Overpass.
    """
    area = abs(north - south) * abs(east - west)
    if area > MAX_BBOX_AREA_DEG2:
        raise HTTPException(
            status_code=400,
            detail=f"Bbox too large ({area:.2f} deg²). Zoom in and try again.",
        )
    return search_trails(south=south, west=west, north=north, east=east)


@router.get("/{trail_id}", response_model=TrailDetail)
def get_trail(trail_id: str):
    """Return full detail for a single trail by its OSM ID (e.g. 'way_123456')."""
    trail = fetch_trail(trail_id)
    if trail is None:
        raise HTTPException(status_code=404, detail="Trail not found")
    return trail


@router.post("/{trail_id}/export/garmin", response_model=TrailExportResponse)
def export_trail(trail_id: str):
    """Enqueue a Garmin export job for the given trail.

    Fetches the trail bbox from Overpass and enqueues the existing
    generate_map Celery task with that bbox.
    """
    trail = fetch_trail(trail_id)
    if trail is None:
        raise HTTPException(status_code=404, detail="Trail not found")

    coords = trail.geometry["coordinates"]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    bbox = {
        "south": min(lats),
        "west": min(lons),
        "north": max(lats),
        "east": max(lons),
    }

    result = generate_map.delay(bbox)
    return TrailExportResponse(job_id=result.id, status="queued")
```

- [ ] **Step 4: Wire the trail router into `main.py`**

Edit `backend/app/main.py`:

```python
"""FastAPI application entry point for the TrailForge service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.trail_routes import router as trail_router

app = FastAPI(title="TrailForge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(trail_router, prefix="/api")
```

- [ ] **Step 5: Run tests to verify they pass**

```
cd backend && python -m pytest tests/test_trail_routes.py -v
```
Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/trail_routes.py backend/app/main.py backend/tests/test_trail_routes.py
git commit -m "feat: add trail search, detail, and export API endpoints"
```

---

## Task 4: Scaffold Expo mobile project

**Files:**
- Create: `mobile/package.json`, `mobile/app.json`, `mobile/tsconfig.json`, `mobile/babel.config.js`, `mobile/jest.config.js`

- [ ] **Step 1: Create the Expo project**

```bash
cd /home/user/Documents/vibe-code/TrailForge
npx create-expo-app@latest mobile --template blank-typescript
```

- [ ] **Step 2: Install dependencies**

```bash
cd mobile
npx expo install expo-router expo-location @react-native-async-storage/async-storage react-native-safe-area-context react-native-screens
npm install @maplibre/maplibre-react-native zustand @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler
npm install --save-dev @testing-library/react-native @testing-library/jest-native jest-expo
```

- [ ] **Step 3: Configure `app.json` for Expo Router and MapLibre**

Replace `mobile/app.json`:

```json
{
  "expo": {
    "name": "TrailForge",
    "slug": "trailforge",
    "version": "1.0.0",
    "scheme": "trailforge",
    "platforms": ["ios", "android"],
    "plugins": [
      "expo-router",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "TrailForge needs your location to show nearby trails."
        }
      ],
      "@maplibre/maplibre-react-native"
    ],
    "android": {
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png" }
    },
    "ios": {
      "supportsTablet": true
    },
    "extra": {
      "router": { "origin": false },
      "eas": { "projectId": "YOUR_EAS_PROJECT_ID" }
    }
  }
}
```

- [ ] **Step 4: Configure `jest.config.js`**

Create `mobile/jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|zustand)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

- [ ] **Step 5: Configure `tsconfig.json`**

Replace `mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 6: Create folder structure**

```bash
mkdir -p mobile/src/{types,api,stores,components,hooks}
mkdir -p mobile/app/\(tabs\) mobile/app/trail
mkdir -p mobile/__tests__/{stores,components}
```

- [ ] **Step 7: Commit**

```bash
git add mobile/
git commit -m "feat: scaffold Expo mobile project with dependencies"
```

---

## Task 5: TypeScript types and API client

**Files:**
- Create: `mobile/src/types/trail.ts`
- Create: `mobile/src/api/trailApi.ts`

- [ ] **Step 1: Define TypeScript interfaces**

Create `mobile/src/types/trail.ts`:

```typescript
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
```

- [ ] **Step 2: Create the API client**

Create `mobile/src/api/trailApi.ts`:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/types/trail.ts mobile/src/api/trailApi.ts
git commit -m "feat: add TypeScript trail types and API client"
```

---

## Task 6: Zustand stores

**Files:**
- Create: `mobile/src/stores/mapStore.ts`
- Create: `mobile/src/stores/filterStore.ts`
- Create: `mobile/src/stores/savedStore.ts`
- Create: `mobile/__tests__/stores/mapStore.test.ts`
- Create: `mobile/__tests__/stores/filterStore.test.ts`
- Create: `mobile/__tests__/stores/savedStore.test.ts`

- [ ] **Step 1: Write the failing store tests**

Create `mobile/__tests__/stores/mapStore.test.ts`:

```typescript
import { useMapStore } from '@/stores/mapStore';

describe('mapStore', () => {
  it('starts with no selected trail', () => {
    const { selectedTrailId } = useMapStore.getState();
    expect(selectedTrailId).toBeNull();
  });

  it('sets and clears selected trail', () => {
    useMapStore.getState().setSelectedTrailId('way_1');
    expect(useMapStore.getState().selectedTrailId).toBe('way_1');
    useMapStore.getState().setSelectedTrailId(null);
    expect(useMapStore.getState().selectedTrailId).toBeNull();
  });

  it('tracks loading state', () => {
    useMapStore.getState().setLoading(true);
    expect(useMapStore.getState().isLoading).toBe(true);
    useMapStore.getState().setLoading(false);
    expect(useMapStore.getState().isLoading).toBe(false);
  });
});
```

Create `mobile/__tests__/stores/filterStore.test.ts`:

```typescript
import { useFilterStore } from '@/stores/filterStore';

describe('filterStore', () => {
  beforeEach(() => useFilterStore.setState({ difficulty: null, trailType: null, maxDistanceKm: null }));

  it('defaults to no active filters', () => {
    const { difficulty, trailType, maxDistanceKm } = useFilterStore.getState();
    expect(difficulty).toBeNull();
    expect(trailType).toBeNull();
    expect(maxDistanceKm).toBeNull();
  });

  it('sets difficulty filter', () => {
    useFilterStore.getState().setDifficulty('moderate');
    expect(useFilterStore.getState().difficulty).toBe('moderate');
  });

  it('clears all filters', () => {
    useFilterStore.getState().setDifficulty('hard');
    useFilterStore.getState().clearFilters();
    expect(useFilterStore.getState().difficulty).toBeNull();
  });
});
```

Create `mobile/__tests__/stores/savedStore.test.ts`:

```typescript
import { useSavedStore } from '@/stores/savedStore';
import type { Trail } from '@/types/trail';

const TRAIL: Trail = {
  id: 'way_1',
  name: 'Test Trail',
  difficulty: 'easy',
  distance_m: 1000,
  elevation_gain_m: null,
  trail_type: 'hiking',
  description: null,
  geometry: { type: 'LineString', coordinates: [[8.5, 47.1]] },
};

describe('savedStore', () => {
  beforeEach(() => useSavedStore.setState({ savedTrails: {} }));

  it('saves and retrieves a trail', () => {
    useSavedStore.getState().saveTrail(TRAIL);
    const saved = useSavedStore.getState().savedTrails;
    expect(saved['way_1']).toBeDefined();
    expect(saved['way_1'].name).toBe('Test Trail');
  });

  it('removes a saved trail', () => {
    useSavedStore.getState().saveTrail(TRAIL);
    useSavedStore.getState().removeTrail('way_1');
    expect(useSavedStore.getState().savedTrails['way_1']).toBeUndefined();
  });

  it('checks if a trail is saved', () => {
    expect(useSavedStore.getState().isSaved('way_1')).toBe(false);
    useSavedStore.getState().saveTrail(TRAIL);
    expect(useSavedStore.getState().isSaved('way_1')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest __tests__/stores/ --no-coverage
```
Expected: `Cannot find module '@/stores/mapStore'`

- [ ] **Step 3: Implement mapStore**

Create `mobile/src/stores/mapStore.ts`:

```typescript
import { create } from 'zustand';
import type { BBox } from '@/types/trail';

interface MapState {
  bbox: BBox | null;
  selectedTrailId: string | null;
  isLoading: boolean;
  setBbox: (bbox: BBox | null) => void;
  setSelectedTrailId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useMapStore = create<MapState>()((set) => ({
  bbox: null,
  selectedTrailId: null,
  isLoading: false,
  setBbox: (bbox) => set({ bbox }),
  setSelectedTrailId: (id) => set({ selectedTrailId: id }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

- [ ] **Step 4: Implement filterStore (persisted)**

Create `mobile/src/stores/filterStore.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Difficulty, TrailType } from '@/types/trail';

interface FilterState {
  difficulty: Difficulty | null;
  trailType: TrailType | null;
  maxDistanceKm: number | null;
  setDifficulty: (d: Difficulty | null) => void;
  setTrailType: (t: TrailType | null) => void;
  setMaxDistanceKm: (km: number | null) => void;
  clearFilters: () => void;
  getInitialState: () => Omit<FilterState, 'setDifficulty' | 'setTrailType' | 'setMaxDistanceKm' | 'clearFilters' | 'getInitialState'>;
}

const INITIAL = { difficulty: null, trailType: null, maxDistanceKm: null };

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setDifficulty: (difficulty) => set({ difficulty }),
      setTrailType: (trailType) => set({ trailType }),
      setMaxDistanceKm: (maxDistanceKm) => set({ maxDistanceKm }),
      clearFilters: () => set(INITIAL),
      getInitialState: () => INITIAL,
    }),
    {
      name: 'trailforge-filters',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- [ ] **Step 5: Implement savedStore (persisted)**

Create `mobile/src/stores/savedStore.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trail } from '@/types/trail';

interface SavedState {
  savedTrails: Record<string, Trail>;
  saveTrail: (trail: Trail) => void;
  removeTrail: (id: string) => void;
  isSaved: (id: string) => boolean;
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      savedTrails: {},
      saveTrail: (trail) =>
        set((state) => ({ savedTrails: { ...state.savedTrails, [trail.id]: trail } })),
      removeTrail: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.savedTrails;
          return { savedTrails: rest };
        }),
      isSaved: (id) => id in get().savedTrails,
    }),
    {
      name: 'trailforge-saved',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd mobile && npx jest __tests__/stores/ --no-coverage
```
Expected: 8 passed

- [ ] **Step 7: Commit**

```bash
git add mobile/src/stores/ mobile/__tests__/stores/
git commit -m "feat: add Zustand stores (map, filter, saved) with persistence"
```

---

## Task 7: Shared UI components

**Files:**
- Create: `mobile/src/components/DifficultyBadge.tsx`
- Create: `mobile/src/components/TrailRow.tsx`
- Create: `mobile/src/components/FilterBar.tsx`
- Create: `mobile/src/components/SearchBar.tsx`
- Create: `mobile/src/components/OfflineBanner.tsx`
- Create: `mobile/src/hooks/useNetworkStatus.ts`
- Create: `mobile/src/hooks/useDebounce.ts`

- [ ] **Step 1: useDebounce hook**

Create `mobile/src/hooks/useDebounce.ts`:

```typescript
import { useEffect, useRef } from 'react';

export function useDebounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return (...args: T) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  };
}
```

- [ ] **Step 2: useNetworkStatus hook**

Create `mobile/src/hooks/useNetworkStatus.ts`:

```typescript
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
    return unsub;
  }, []);
  return isOnline;
}
```

Note: install `@react-native-community/netinfo` if not already present:
```bash
cd mobile && npx expo install @react-native-community/netinfo
```

- [ ] **Step 3: DifficultyBadge component**

Create `mobile/src/components/DifficultyBadge.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Difficulty } from '@/types/trail';

const COLORS: Record<Difficulty, string> = {
  easy: '#2d9a4e',
  moderate: '#2979c0',
  hard: '#1a1a1a',
};

interface Props { difficulty: Difficulty }

export function DifficultyBadge({ difficulty }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: COLORS[difficulty] }]}>
      <Text style={styles.label}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  label: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
```

- [ ] **Step 4: TrailRow component**

Create `mobile/src/components/TrailRow.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Trail } from '@/types/trail';
import { DifficultyBadge } from './DifficultyBadge';

interface Props {
  trail: Trail;
  onPress: (trail: Trail) => void;
}

export function TrailRow({ trail, onPress }: Props) {
  const km = (trail.distance_m / 1000).toFixed(1);
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(trail)}>
      <View style={styles.info}>
        <Text style={styles.name}>{trail.name}</Text>
        <Text style={styles.meta}>{km} km · {trail.trail_type}</Text>
      </View>
      <DifficultyBadge difficulty={trail.difficulty} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 13, color: '#666', marginTop: 2 },
});
```

- [ ] **Step 5: FilterBar component**

Create `mobile/src/components/FilterBar.tsx`:

```typescript
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { useFilterStore } from '@/stores/filterStore';
import type { Difficulty, TrailType } from '@/types/trail';

const DIFFICULTIES: Difficulty[] = ['easy', 'moderate', 'hard'];
const TYPES: TrailType[] = ['hiking', 'running', 'biking'];

export function FilterBar() {
  const { difficulty, trailType, setDifficulty, setTrailType } = useFilterStore();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bar}>
      {DIFFICULTIES.map((d) => (
        <Chip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(difficulty === d ? null : d)} />
      ))}
      <View style={styles.divider} />
      {TYPES.map((t) => (
        <Chip key={t} label={t} active={trailType === t} onPress={() => setTrailType(trailType === t ? null : t)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#ccc', marginRight: 8 },
  chipActive: { backgroundColor: '#2979c0', borderColor: '#2979c0' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  divider: { width: 1, backgroundColor: '#e0e0e0', marginHorizontal: 4 },
});
```

- [ ] **Step 6: SearchBar component**

Create `mobile/src/components/SearchBar.tsx`:

```typescript
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = 'Search trails…' }: Props) {
  const [query, setQuery] = useState('');
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        returnKeyType="search"
        onSubmitEditing={() => onSearch(query)}
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={() => { setQuery(''); }} style={styles.clear}>
          <Text style={styles.clearText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 12, marginVertical: 8, paddingHorizontal: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  input: { flex: 1, height: 40, fontSize: 15 },
  clear: { padding: 4 },
  clearText: { color: '#999', fontSize: 16 },
});
```

- [ ] **Step 7: OfflineBanner component**

Create `mobile/src/components/OfflineBanner.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  if (isOnline) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No connection — trail loading paused</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#e53935', paddingVertical: 6, alignItems: 'center' },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
```

- [ ] **Step 8: Commit**

```bash
git add mobile/src/components/ mobile/src/hooks/
git commit -m "feat: add shared UI components and hooks"
```

---

## Task 8: Explore (Map) tab screen

**Files:**
- Create: `mobile/src/components/TrailMap.tsx`
- Create: `mobile/src/components/TrailBottomSheet.tsx`
- Create: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: TrailMap component**

Create `mobile/src/components/TrailMap.tsx`:

```typescript
import React, { useRef, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import type { FeatureCollection, Feature } from 'geojson';
import type { Trail, BBox } from '@/types/trail';
import { useMapStore } from '@/stores/mapStore';
import { MAX_BBOX_AREA_DEG2 } from '@/constants';

MapLibreGL.setAccessToken(null); // No token needed for OSM tiles

const TILE_URL = 'https://demotiles.maplibre.org/style.json';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#2d9a4e',
  moderate: '#2979c0',
  hard: '#1a1a1a',
};

interface Props {
  trails: Trail[];
  onViewportChange: (bbox: BBox) => void;
  onTrailTap: (trail: Trail) => void;
}

export function TrailMap({ trails, onViewportChange, onTrailTap }: Props) {
  const { isLoading } = useMapStore();
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  const handleRegionDidChange = useCallback(
    (feature: GeoJSON.Feature) => {
      const [west, south, east, north] = (feature.properties as any).visibleBounds.flat();
      const area = Math.abs(north - south) * Math.abs(east - west);
      if (area <= MAX_BBOX_AREA_DEG2) {
        onViewportChange({ south, west, north, east });
      }
    },
    [onViewportChange]
  );

  const geojson: FeatureCollection = {
    type: 'FeatureCollection',
    features: trails.map((t) => ({
      type: 'Feature',
      id: t.id,
      properties: { id: t.id, difficulty: t.difficulty, name: t.name },
      geometry: t.geometry as GeoJSON.Geometry,
    })),
  };

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL={TILE_URL}
        onRegionDidChange={handleRegionDidChange}
      >
        <MapLibreGL.Camera ref={cameraRef} zoomLevel={12} followUserLocation />
        <MapLibreGL.UserLocation visible />
        <MapLibreGL.ShapeSource
          id="trails"
          shape={geojson}
          onPress={(e) => {
            const feature = e.features[0];
            if (!feature) return;
            const trailId = feature.properties?.id as string;
            const trail = trails.find((t) => t.id === trailId);
            if (trail) onTrailTap(trail);
          }}
        >
          <MapLibreGL.LineLayer
            id="trail-lines"
            style={{
              lineColor: ['match', ['get', 'difficulty'],
                'easy', DIFFICULTY_COLORS.easy,
                'moderate', DIFFICULTY_COLORS.moderate,
                DIFFICULTY_COLORS.hard],
              lineWidth: 3,
              lineCap: 'round',
            }}
          />
        </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>
      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color="#2979c0" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loader: { position: 'absolute', top: 12, right: 12 },
});
```

- [ ] **Step 2: Create constants file**

Create `mobile/src/constants.ts`:

```typescript
// Must match backend MAX_BBOX_AREA_DEG2
export const MAX_BBOX_AREA_DEG2 = 4.0;
```

- [ ] **Step 3: TrailBottomSheet component**

Create `mobile/src/components/TrailBottomSheet.tsx`:

```typescript
import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import type { Trail } from '@/types/trail';
import { DifficultyBadge } from './DifficultyBadge';

interface Props {
  trail: Trail | null;
  onDismiss: () => void;
}

export function TrailBottomSheet({ trail, onDismiss }: Props) {
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (trail) sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [trail]);

  const handleChange = useCallback(
    (index: number) => { if (index === -1) onDismiss(); },
    [onDismiss]
  );

  if (!trail) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['25%']}
      enablePanDownToClose
      onChange={handleChange}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{trail.name}</Text>
          <DifficultyBadge difficulty={trail.difficulty} />
        </View>
        <Text style={styles.meta}>
          {(trail.distance_m / 1000).toFixed(1)} km · {trail.trail_type}
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push(`/trail/${trail.id}`)}
        >
          <Text style={styles.buttonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 18, fontWeight: '600', flex: 1, marginRight: 8 },
  meta: { color: '#666', marginTop: 4, marginBottom: 12 },
  button: { backgroundColor: '#2979c0', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
```

- [ ] **Step 4: Explore tab screen**

Create `mobile/app/(tabs)/index.tsx`:

```typescript
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { SearchBar } from '@/components/SearchBar';
import { TrailMap } from '@/components/TrailMap';
import { TrailBottomSheet } from '@/components/TrailBottomSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useMapStore } from '@/stores/mapStore';
import { searchTrails, geocodePlace } from '@/api/trailApi';
import { useDebounce } from '@/hooks/useDebounce';
import { MAX_BBOX_AREA_DEG2 } from '@/constants';
import type { Trail, BBox } from '@/types/trail';

export default function ExploreScreen() {
  const { setBbox, setLoading, setSelectedTrailId } = useMapStore();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [tooBig, setTooBig] = useState(false);

  const loadTrails = useCallback(async (bbox: BBox) => {
    const area = Math.abs(bbox.north - bbox.south) * Math.abs(bbox.east - bbox.west);
    if (area > MAX_BBOX_AREA_DEG2) { setTooBig(true); return; }
    setTooBig(false);
    setLoading(true);
    setBbox(bbox);
    try {
      const response = await searchTrails(bbox);
      setTrails(response.features);
    } catch {
      // keep existing trails visible on error
    } finally {
      setLoading(false);
    }
  }, [setBbox, setLoading]);

  const debouncedLoad = useDebounce(loadTrails, 500);

  const handleSearch = useCallback(async (query: string) => {
    try {
      const results = await geocodePlace(query);
      if (results.length === 0) return;
      const { lat, lon } = results[0];
      const delta = 0.1;
      const bbox: BBox = { south: +lat - delta, west: +lon - delta, north: +lat + delta, east: +lon + delta };
      loadTrails(bbox);
    } catch { /* ignore */ }
  }, [loadTrails]);

  const handleNearMe = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    const delta = 0.05;
    const bbox: BBox = {
      south: loc.coords.latitude - delta,
      west: loc.coords.longitude - delta,
      north: loc.coords.latitude + delta,
      east: loc.coords.longitude + delta,
    };
    loadTrails(bbox);
  }, [loadTrails]);

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <SearchBar onSearch={handleSearch} />
      {tooBig && (
        <View style={styles.tooBig}>
          <Text style={styles.tooBigText}>Zoom in to see trails</Text>
        </View>
      )}
      <TrailMap
        trails={trails}
        onViewportChange={debouncedLoad}
        onTrailTap={(t) => { setSelectedTrail(t); setSelectedTrailId(t.id); }}
      />
      <TouchableOpacity style={styles.nearMe} onPress={handleNearMe}>
        <Text style={styles.nearMeText}>📍 Near Me</Text>
      </TouchableOpacity>
      <TrailBottomSheet
        trail={selectedTrail}
        onDismiss={() => { setSelectedTrail(null); setSelectedTrailId(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tooBig: { position: 'absolute', top: 100, alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tooBigText: { color: '#fff', fontWeight: '600' },
  nearMe: { position: 'absolute', bottom: 32, right: 16, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  nearMeText: { fontWeight: '600', fontSize: 14 },
});
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/TrailMap.tsx mobile/src/components/TrailBottomSheet.tsx mobile/src/constants.ts mobile/app/\(tabs\)/index.tsx
git commit -m "feat: add Explore map screen with MapLibre trail overlays"
```

---

## Task 9: List/Filter and Saved tab screens

**Files:**
- Create: `mobile/app/(tabs)/list.tsx`
- Create: `mobile/app/(tabs)/saved.tsx`
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/_layout.tsx`

- [ ] **Step 1: Root layout**

Create `mobile/app/_layout.tsx`:

```typescript
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trail/[id]" options={{ title: 'Trail Details' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
```

- [ ] **Step 2: Tab navigator layout**

Create `mobile/app/(tabs)/_layout.tsx`:

```typescript
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2979c0' }}>
      <Tabs.Screen name="index" options={{ title: 'Explore', tabBarIcon: ({ color }) => <Text style={{ color }}>🗺</Text> }} />
      <Tabs.Screen name="list" options={{ title: 'Trails', tabBarIcon: ({ color }) => <Text style={{ color }}>📋</Text> }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: ({ color }) => <Text style={{ color }}>🔖</Text> }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: List/Filter tab screen**

Create `mobile/app/(tabs)/list.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { FilterBar } from '@/components/FilterBar';
import { TrailRow } from '@/components/TrailRow';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useMapStore } from '@/stores/mapStore';
import { useFilterStore } from '@/stores/filterStore';
import { searchTrails } from '@/api/trailApi';
import type { Trail } from '@/types/trail';

export default function ListScreen() {
  const { bbox } = useMapStore();
  const { difficulty, trailType, maxDistanceKm } = useFilterStore();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bbox) return;
    let active = true;
    setLoading(true);
    searchTrails(bbox)
      .then((res) => {
        if (!active) return;
        let filtered = res.features;
        if (difficulty) filtered = filtered.filter((t) => t.difficulty === difficulty);
        if (trailType) filtered = filtered.filter((t) => t.trail_type === trailType);
        if (maxDistanceKm) filtered = filtered.filter((t) => t.distance_m / 1000 <= maxDistanceKm);
        setTrails(filtered);
      })
      .catch(() => { if (active) setTrails([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bbox, difficulty, trailType, maxDistanceKm]);

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <FilterBar />
      {loading ? (
        <View style={styles.center}><Text>Loading trails…</Text></View>
      ) : trails.length === 0 ? (
        <View style={styles.center}><Text>No trails in this area. Explore the map first.</Text></View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrailRow trail={item} onPress={() => router.push(`/trail/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
```

- [ ] **Step 4: Saved tab screen**

Create `mobile/app/(tabs)/saved.tsx`:

```typescript
import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { TrailRow } from '@/components/TrailRow';
import { useSavedStore } from '@/stores/savedStore';

export default function SavedScreen() {
  const { savedTrails } = useSavedStore();
  const trails = Object.values(savedTrails);

  if (trails.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No saved trails yet.</Text>
        <Text style={styles.hint}>Tap "Save" on any trail detail to bookmark it here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={trails}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <TrailRow trail={item} onPress={() => router.push(`/trail/${item.id}`)} />
      )}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  hint: { color: '#888', textAlign: 'center' },
});
```

- [ ] **Step 5: Commit**

```bash
git add mobile/app/
git commit -m "feat: add tab navigation, List/Filter screen, and Saved screen"
```

---

## Task 10: Trail Detail screen with Garmin export

**Files:**
- Create: `mobile/app/trail/[id].tsx`
- Create: `mobile/__tests__/components/TrailDetail.test.tsx`

- [ ] **Step 1: Write Trail Detail component tests**

Create `mobile/__tests__/components/TrailDetail.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { jest } from '@jest/globals';

// Mock API client
jest.mock('@/api/trailApi', () => ({
  fetchTrail: jest.fn(),
  exportTrailToGarmin: jest.fn(),
  pollJobStatus: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'way_1' }),
  router: { back: jest.fn() },
}));

import * as api from '@/api/trailApi';
import TrailDetailScreen from '../../app/trail/[id]';
import type { Trail, JobStatus } from '@/types/trail';

const TRAIL: Trail = {
  id: 'way_1', name: 'Oak Loop', difficulty: 'easy',
  distance_m: 2100, elevation_gain_m: null, trail_type: 'hiking',
  description: 'A pleasant loop.', geometry: { type: 'LineString', coordinates: [[8.5, 47.1]] },
};

beforeEach(() => jest.clearAllMocks());

it('renders trail name and difficulty', async () => {
  (api.fetchTrail as jest.Mock).mockResolvedValue(TRAIL);
  render(<TrailDetailScreen />);
  await waitFor(() => screen.getByText('Oak Loop'));
  expect(screen.getByText('Easy')).toBeTruthy();
  expect(screen.getByText('2.1 km')).toBeTruthy();
});

it('export button triggers polling', async () => {
  (api.fetchTrail as jest.Mock).mockResolvedValue(TRAIL);
  (api.exportTrailToGarmin as jest.Mock).mockResolvedValue({ job_id: 'job1', status: 'queued' });
  (api.pollJobStatus as jest.Mock).mockResolvedValue({ job_id: 'job1', status: 'completed', filename: 'gmapsupp.img' } as JobStatus);

  render(<TrailDetailScreen />);
  await waitFor(() => screen.getByText('Export to Garmin'));
  fireEvent.press(screen.getByText('Export to Garmin'));
  await waitFor(() => expect(api.exportTrailToGarmin).toHaveBeenCalledWith('way_1'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest __tests__/components/TrailDetail.test.tsx --no-coverage
```
Expected: `Cannot find module '../../app/trail/[id]'`

- [ ] **Step 3: Implement Trail Detail screen**

Create `mobile/app/trail/[id].tsx`:

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Share, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DifficultyBadge } from '@/components/DifficultyBadge';
import { useSavedStore } from '@/stores/savedStore';
import { fetchTrail, exportTrailToGarmin, pollJobStatus } from '@/api/trailApi';
import type { Trail } from '@/types/trail';

type ExportState = 'idle' | 'loading' | 'done' | 'error';

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSaved, saveTrail, removeTrail } = useSavedStore();

  const [trail, setTrail] = useState<Trail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportProgress, setExportProgress] = useState('');

  useEffect(() => {
    fetchTrail(id)
      .then(setTrail)
      .catch(() => setLoadError(true));
  }, [id]);

  const handleExport = useCallback(async () => {
    if (!trail) return;
    setExportState('loading');
    setExportProgress('Starting export…');
    try {
      const { job_id } = await exportTrailToGarmin(trail.id);
      // Poll until done
      let status = 'queued';
      while (status !== 'completed' && status !== 'failed') {
        await new Promise((r) => setTimeout(r, 3000));
        const jobStatus = await pollJobStatus(job_id);
        status = jobStatus.status;
        if (jobStatus.progress) setExportProgress(jobStatus.progress);
      }
      if (status === 'completed') {
        setExportState('done');
        const downloadUrl = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api'}/download/${job_id}/gmapsupp.img`;
        await Share.share({ url: downloadUrl, message: `TrailForge: ${trail.name} — Garmin map ready` });
      } else {
        setExportState('error');
        Alert.alert('Export failed', 'The Garmin export did not complete. Please try again.');
      }
    } catch {
      setExportState('error');
      Alert.alert('Export failed', 'Could not start the export. Check your connection.');
    }
  }, [trail]);

  if (loadError) {
    return <View style={styles.center}><Text>Trail not found.</Text></View>;
  }
  if (!trail) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  const saved = isSaved(trail.id);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{trail.name}</Text>
        <DifficultyBadge difficulty={trail.difficulty} />
      </View>

      <View style={styles.stats}>
        <Stat label="Distance" value={`${(trail.distance_m / 1000).toFixed(1)} km`} />
        <Stat label="Elevation" value={trail.elevation_gain_m ? `${trail.elevation_gain_m} m` : '—'} />
        <Stat label="Type" value={trail.trail_type} />
      </View>

      {trail.description ? (
        <Text style={styles.description}>{trail.description}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.btn, saved ? styles.btnOutline : styles.btnPrimary]}
        onPress={() => saved ? removeTrail(trail.id) : saveTrail(trail)}
      >
        <Text style={[styles.btnText, saved && styles.btnTextOutline]}>
          {saved ? '🔖 Saved' : 'Save Trail'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnGarmin, exportState === 'loading' && styles.btnDisabled]}
        onPress={handleExport}
        disabled={exportState === 'loading'}
      >
        {exportState === 'loading' ? (
          <View style={styles.exportLoading}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={[styles.btnText, { marginLeft: 8 }]}>{exportProgress}</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>
            {exportState === 'done' ? '✓ Export complete — share again' : 'Export to Garmin'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnOutline]}
        onPress={() => Alert.alert('Coming soon', 'Trail sharing arrives in sub-project 3.')}
      >
        <Text style={styles.btnTextOutline}>Share Trail</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  name: { fontSize: 22, fontWeight: '700', flex: 1, marginRight: 8 },
  stats: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  description: { padding: 16, color: '#444', lineHeight: 22 },
  btn: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2979c0' },
  btnGarmin: { backgroundColor: '#1a6e34' },
  btnOutline: { borderWidth: 1.5, borderColor: '#2979c0' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnTextOutline: { color: '#2979c0', fontWeight: '600', fontSize: 15 },
  exportLoading: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile && npx jest __tests__/components/TrailDetail.test.tsx --no-coverage
```
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add mobile/app/trail/ mobile/__tests__/components/
git commit -m "feat: add Trail Detail screen with Garmin export and bookmark"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && python -m pytest tests/ -v
```
Expected: all tests pass

- [ ] **Step 2: Run all mobile unit tests**

```bash
cd mobile && npx jest --no-coverage
```
Expected: all tests pass

- [ ] **Step 3: Verify backend starts**

```bash
cd backend && uvicorn app.main:app --reload
```
Expected: server starts, visit `http://localhost:8000/docs` and confirm `/api/trails/search`, `/api/trails/{trail_id}`, `/api/trails/{trail_id}/export/garmin` appear

- [ ] **Step 4: Verify Expo builds**

```bash
cd mobile && npx expo start --no-dev
```
Expected: QR code appears, no build errors

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: trail discovery core — backend endpoints + Expo mobile app complete"
```
