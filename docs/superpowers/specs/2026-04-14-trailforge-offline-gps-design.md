# TrailForge — Offline + GPS: Design Spec

**Date:** 2026-04-14
**Sub-project:** 2 of 3 (Discovery Core → Offline+GPS → Community)
**Status:** Approved

---

## Purpose

Sub-project 2 adds offline map access, a live blue dot, and route recording with GPX export to the React Native + Expo app built in sub-project 1. The Garmin export pipeline and trail discovery features are unchanged.

---

## Scope

### In scope
- Trail-local offline tile packs (MapLibre offline SDK)
- Regional offline tile packs (PMTiles files from OpenFreeMap)
- Blue dot GPS — foreground and background tracking
- Route recording with on-device stats (distance, duration, elevation gain)
- GPX export via device share sheet
- Offline Manager screen for viewing and deleting packs
- Crash recovery for routes interrupted by force-quit

### Out of scope (future sub-projects)
- Community: sharing recorded routes, ratings, condition reports (sub-project 3)
- Turn-by-turn navigation or route planning
- Server-side route storage or sync

---

## Architecture

```
[React Native + Expo app]
        ↓ MLRNOfflineManager (trail-local packs)
[MapLibre tile cache — device storage]

        ↓ expo-file-system (regional packs)
[OpenFreeMap PMTiles — downloaded to device]

        ↓ expo-location + expo-task-manager
[Device GPS — foreground + background]

[FastAPI backend — unchanged]
```

No new backend endpoints are required. All offline tile data comes from OpenFreeMap's public PMTiles regional extracts. The existing Overpass pipeline and trail endpoints are untouched.

---

## New Libraries

| Library | Purpose |
|---------|---------|
| `expo-location` | Foreground + background GPS |
| `expo-task-manager` | Background location task registration |
| `expo-file-system` | Store PMTiles files on device |
| `expo-sharing` | Share GPX files via device share sheet |

`@maplibre/maplibre-react-native` is already installed; its `MLRNOfflineManager` is used for trail-local packs.

---

## Screens

### Explore tab (modified)
- `MapLibreGL.UserLocation` component renders the blue dot with heading indicator
- "Record" FAB added alongside the existing "Near Me" button
  - Idle: grey circle with record icon
  - Active: pulsing red dot + elapsed timer (`MM:SS`)
- Tapping Record while active stops recording and opens a save dialog: enter a route name, then **Save** or **Discard**

### Routes tab (new — 4th bottom tab)
- FlatList of saved routes: name, date, distance, duration badge
- Empty state: "No recorded routes yet — start recording from the map"
- Tap row → Route Detail screen (pushed)

### Route Detail screen (pushed from Routes tab)
- Inline MapLibre map snippet showing the recorded polyline in blue
- Stats row: distance, duration, elevation gain
- **Export GPX** button → generates GPX XML on-device → `expo-sharing` share sheet
- **Delete** button with confirmation alert

### Trail Detail screen (modified)
- Adds **"Download for offline"** button below the existing Garmin export button
- Taps queue a trail-local pack for that trail's bbox (zoom 12–17)
- Button changes to "Downloaded ✓" once the pack is complete; shows progress while downloading

### Offline Manager screen (new)
- Accessible via a "Manage Downloads" button in the Saved tab header
- Two sections: **Trail Packs** and **Regional Packs**
- Each row: name, size (human-readable), status badge (Downloading / Ready / Error), delete button
- Regional pack section has an "Add region" button → sheet listing available regions with size estimates → download with progress bar

---

## State Management

Four new Zustand stores following the existing pattern:

| Store | Contents | Persisted |
|-------|----------|-----------|
| `locationStore` | `coords`, `heading`, `accuracy`, `isWatching` | No |
| `recordingStore` | `isRecording`, `currentRoute: RoutePoint[]`, `startTime` | Yes (crash recovery) |
| `savedRoutesStore` | `routes: Record<string, SavedRoute>` | Yes |
| `offlineStore` | `packs: Record<string, OfflinePack>`, download progress map | Yes |

---

## Data Types

New types added to `mobile/src/types/route.ts` and `mobile/src/types/offline.ts`:

```typescript
// route.ts
interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number; // Unix ms
}

interface SavedRoute {
  id: string;
  name: string;
  points: RoutePoint[];
  distance_m: number;
  duration_s: number;
  elevation_gain_m: number;
  created_at: number; // Unix ms
}

// offline.ts
interface OfflinePack {
  id: string;
  name: string;
  type: 'trail-local' | 'regional';
  trail_id?: string;      // set for trail-local packs
  region_key?: string;    // set for regional packs
  size_bytes: number;
  downloaded_at: number;  // Unix ms; 0 while downloading
  status: 'downloading' | 'complete' | 'error';
}

interface RegionDefinition {
  key: string;
  name: string;
  description: string;
  pmtiles_url: string;
  size_bytes_approx: number;
}
```

`REGIONS` — a static list of `RegionDefinition` objects — lives in `mobile/src/constants/regions.ts`.

---

## Data Flow

### Trail-local offline pack
1. User taps "Download for offline" on Trail Detail screen
2. App computes bbox from trail geometry + 500m buffer
3. `MLRNOfflineManager.createPack(packId, styleURL, bounds, 12, 17)` is called
4. `offlineStore` records the pack as `downloading`
5. Pack progress events update the download button; on completion status → `complete`

### Regional PMTiles download
1. User opens Offline Manager → "Add region" → selects a region
2. `expo-file-system.downloadAsync(pmtilesUrl, localPath)` streams the file to the app document directory
3. `offlineStore` records progress; on completion the local file path is stored
4. MapLibre style is updated to prefer the local PMTiles source for that region's bbox when offline

### GPS background tracking
1. App launch: `expo-location.requestForegroundPermissionsAsync()` and `requestBackgroundPermissionsAsync()`
2. `expo-task-manager.defineTask(LOCATION_TASK, handler)` registered at module scope
3. When recording starts: `expo-location.startLocationUpdatesAsync(LOCATION_TASK, { accuracy: High, distanceInterval: 10, timeInterval: 5000 })`
4. Each location event appends a `RoutePoint` to `recordingStore.currentRoute`
5. Android: foreground service notification shown while task is active
6. When recording stops: `expo-location.stopLocationUpdatesAsync(LOCATION_TASK)`

### GPX export
1. User taps "Export GPX" on Route Detail screen
2. `generateGpx(route: SavedRoute): string` produces a GPX 1.1 XML string
3. `expo-file-system.writeAsStringAsync(tempPath, gpxString)` writes the file
4. `expo-sharing.shareAsync(tempPath, { mimeType: 'application/gpx+xml' })` opens the share sheet

### Crash recovery
1. On app launch, `recordingStore` is rehydrated from AsyncStorage
2. If `isRecording === true` but `expo-task-manager.isTaskRegisteredAsync(LOCATION_TASK)` returns false, the background task was killed
3. Alert: **"Unfinished route found"** — options: "Save & stop", "Resume recording", "Discard"
4. "Resume recording" re-registers the background task and continues appending to the existing `currentRoute`

---

## Error Handling

| Condition | Behaviour |
|-----------|-----------|
| Location permission denied | Blue dot hidden; Record FAB tap opens system permission dialog |
| Background location denied | Foreground-only recording; banner: "Recording pauses when app is backgrounded" |
| Tile download fails mid-way | Toast with retry button; partial file deleted; pack status → `error` |
| Insufficient device storage | Size estimate shown before download; blocked with warning if < 200 MB free |
| App force-quit during recording | Crash recovery dialog on next launch |
| Regional PMTiles unavailable | Falls back to live tile source; offline banner shown |

---

## Testing

### Unit tests (Jest + React Native Testing Library)
- `recordingStore`: start/stop transitions, point accumulation, distance + elevation gain calculation from fixture points
- `savedRoutesStore`: save, delete, get routes; persistence round-trip
- `offlineStore`: pack lifecycle (downloading → complete → deleted); progress update
- `locationStore`: coords update, clear on permission revoke
- `generateGpx()`: valid GPX 1.1 XML output, correct coordinate order, ISO 8601 timestamps
- Haversine distance utility: known coordinate pairs
- Elevation gain utility: positive-delta accumulation from fixture altitude array

### Integration tests (pytest — backend unchanged, no new tests required)

### E2E tests (Detox)
- Grant location permission → blue dot visible on map
- Tap Record → timer appears → tap stop → save dialog → route appears in Routes tab
- Open Route Detail → tap Export GPX → share sheet opens with `.gpx` attachment
- Trail Detail "Download for offline" → pack appears in Offline Manager with status Ready
- Kill app mid-recording → relaunch → crash recovery dialog appears

---

## Decomposition: Full Project Roadmap

| Sub-project | Scope | Depends on |
|-------------|-------|------------|
| 1 — Discovery Core | Discover, filter, view, bookmark, export | — |
| 2 — Offline + GPS *(this spec)* | Tile packs, blue dot, route recording, GPX export | Sub-project 1 |
| 3 — Community | User accounts, trail ratings, condition reports, photos, shared routes | Sub-project 1 |
