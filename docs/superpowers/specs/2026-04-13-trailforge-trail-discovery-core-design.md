# TrailForge — Trail Discovery Core: Design Spec

**Date:** 2026-04-13
**Sub-project:** 1 of 3 (Discovery Core → Offline+GPS → Community)
**Status:** Approved

---

## Purpose Shift

TrailForge's objective is to help people find trails and have fun outdoors. The Garmin map export is a feature, not the goal. This sub-project lays the foundation: a native iOS and Android app that lets users discover, browse, filter, and export trails backed by OpenStreetMap data.

---

## Scope

### In scope
- Browse trails on an interactive map (viewport-driven loading)
- "Near me" discovery using device GPS
- Search by place name
- Filter by difficulty, distance, trail type (hiking / running / biking)
- Trail detail view: name, distance, elevation gain, difficulty, description
- Bookmark trails (local device storage, no account required)
- Garmin export (existing backend pipeline surfaced in the app)

### Out of scope (future sub-projects)
- Offline maps and tile caching (sub-project 2)
- GPS tracking / blue dot navigation (sub-project 2)
- Community: ratings, condition reports, photos, shared routes (sub-project 3)
- User accounts and server-side saved state (sub-project 3)

---

## Architecture

```
[React Native + Expo app (iOS + Android)]
              ↓ REST
[FastAPI backend — extended with trail endpoints]
              ↓ Overpass QL
[OpenStreetMap / Overpass API]
```

The mobile app communicates exclusively with the FastAPI backend. All Overpass queries run server-side, consistent with the existing architecture. The Overpass downloader, tiling logic, retry/mirror fallback, and mkgmap pipeline are reused without modification.

### New backend endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/trails/search` | Accepts bbox or lat/lng + radius; returns GeoJSON trail features with basic stats |
| `GET` | `/trails/{id}` | Full trail detail: geometry + metadata from OSM tags |
| `POST` | `/trails/{id}/export/garmin` | Enqueues existing mkgmap Celery job; returns `job_id` |

The existing `GET /jobs/{job_id}/status` and download endpoints are reused as-is.

---

## Mobile App

### Technology
- **Framework:** React Native + Expo (managed workflow)
- **Navigation:** Expo Router (file-based, bottom tab + pushed detail screens)
- **Maps:** MapLibre GL Native (`@maplibre/maplibre-react-native`)
- **State:** Zustand (three stores; filter and saved stores persisted to device storage)

### Screens

**Tab 1 — Explore (Map)**
- Full-screen MapLibre GL map, centered on user location on launch
- Trail polylines color-coded by difficulty: green (easy) / blue (moderate) / black (hard)
- Tap trail → bottom sheet with name, distance, difficulty, "View Details" CTA
- Search bar at top: place-name search, map flies to result and loads trails
- "Near Me" FAB re-centers map on current device location
- Trails reload on viewport change with 500ms debounce
- "Zoom in to see trails" shown when viewport exceeds `MAX_BBOX_AREA_DEG2`

**Tab 2 — List / Filter**
- List of trails in current search area
- Filter bar: difficulty (easy / moderate / hard), distance range (slider), type (hiking / running / biking)
- Each row: trail name, distance, elevation gain, difficulty badge
- Tap → Trail Detail screen

**Tab 3 — Saved**
- Bookmarked trails stored on device (Zustand + AsyncStorage)
- Same row format as List tab
- Persisted across app restarts; no account required

**Trail Detail Screen** (pushed from any tab)
- Trail name, difficulty badge, distance, elevation gain
- Inline MapLibre map snippet showing the trail route
- Description from OSM tags
- Bookmark toggle (Save / Unsave)
- "Export to Garmin" button (see export flow below)
- Share button (deep link placeholder for sub-project 3)

---

## Data Flow

### Viewport trail loading
1. Map viewport changes → 500ms debounce fires
2. App sends `GET /trails/search?bbox=...` to backend
3. Backend queries Overpass, returns GeoJSON features
4. Previous viewport's trails replaced (no accumulation)
5. Loading indicator shown during request; cached results shown on error with retry

### Garmin export flow
1. User taps "Export to Garmin" on Trail Detail screen
2. App calls `POST /trails/{id}/export/garmin`
3. Backend enqueues Celery job, returns `{ job_id }`
4. App polls `GET /jobs/{job_id}/status` every 3 seconds
5. On `completed`: opens device share sheet with `gmapsupp.img` download URL
6. On `failed`: toast with error message, export button re-enabled for retry

### State management (Zustand stores)

| Store | Contents | Persisted |
|-------|----------|-----------|
| `mapStore` | Viewport bbox, selected trail ID, loading state | No |
| `filterStore` | Active difficulty, distance range, trail type | Yes (device) |
| `savedStore` | Bookmarked trail IDs + cached detail objects | Yes (device) |

TanStack Query is deferred to sub-project 3 when community content introduces more complex server cache invalidation needs.

---

## Error Handling

| Condition | Behaviour |
|-----------|-----------|
| Network offline | Banner: "No connection — trail loading paused"; cached results remain visible |
| Overpass timeout / backend error | Retry button on map; last loaded trails remain |
| Garmin export failure | Toast with error message; button re-enabled |
| Location permission denied | Map defaults to world view; "Near Me" prompts permission dialog |
| Viewport too large | "Zoom in to see trails" overlay; no backend request sent |

---

## Testing

### Unit tests (Jest + React Native Testing Library)
- `filterStore`: filter logic, persistence round-trip
- `savedStore`: bookmark add/remove, cache behaviour
- `mapStore`: bbox debounce, zoom threshold logic
- Trail Detail screen: renders correctly for each difficulty; export button state machine (idle → loading → done / error)
- Garmin export polling: mocked job status responses, state transitions verified

### Integration tests (pytest)
- `GET /trails/search` with a known bbox returns valid GeoJSON
- `GET /trails/{id}` returns expected fields
- `POST /trails/{id}/export/garmin` enqueues job and returns `job_id`
- Existing Overpass + mkgmap pipeline tests unchanged

### E2E tests (Detox)
- Launch → map loads trails in viewport
- Tap trail → detail sheet shows correct name and distance
- Apply difficulty filter → list updates accordingly
- Bookmark a trail → appears in Saved tab after app restart
- Export flow → progress indicator shown; share sheet triggered on completion

---

## Decomposition: Full Project Roadmap

| Sub-project | Scope | Depends on |
|-------------|-------|------------|
| 1 — Discovery Core *(this spec)* | Discover, filter, view, bookmark, export | — |
| 2 — Offline + GPS | Download tile packs, blue dot tracking, route recording | Sub-project 1 |
| 3 — Community | User accounts, trail ratings, condition reports, photos, shared routes | Sub-project 1 |
