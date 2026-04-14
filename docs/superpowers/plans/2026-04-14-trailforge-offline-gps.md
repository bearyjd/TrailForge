# TrailForge Offline + GPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add offline tile packs, background GPS route recording with stats, and GPX export to the TrailForge Expo app.

**Architecture:** Trail-local offline caches use MapLibre's `offlineManager` against the existing `demotiles.maplibre.org` style; regional packs are PMTiles files downloaded via `expo-file-system`. Background GPS tracking uses `expo-location` + `expo-task-manager`; completed routes are saved to Zustand + AsyncStorage and exported as GPX via `expo-sharing`.

**Tech Stack:** React Native + Expo (managed), `@maplibre/maplibre-react-native`, `expo-location`, `expo-task-manager`, `expo-file-system`, `expo-sharing`, Zustand 5, AsyncStorage, Jest + RNTL.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `mobile/src/types/route.ts` | RoutePoint, SavedRoute types |
| `mobile/src/types/offline.ts` | OfflinePack, RegionDefinition types |
| `mobile/src/constants/regions.ts` | Static REGIONS list (OpenFreeMap PMTiles URLs) |
| `mobile/src/utils/geo.ts` | haversineDistance, computeRouteDistance, computeElevationGain |
| `mobile/src/utils/gpx.ts` | generateGpx — produces GPX 1.1 XML string |
| `mobile/src/stores/locationStore.ts` | Current GPS coords (not persisted) |
| `mobile/src/stores/recordingStore.ts` | isRecording, currentRoute, startTime (persisted for crash recovery) |
| `mobile/src/stores/savedRoutesStore.ts` | Completed routes (persisted) |
| `mobile/src/stores/offlineStore.ts` | Offline pack metadata + download progress |
| `mobile/src/tasks/locationTask.ts` | expo-task-manager background location task |
| `mobile/src/components/RecordingFAB.tsx` | Record/Stop FAB with elapsed timer |
| `mobile/src/components/RouteRow.tsx` | List row for Routes tab |
| `mobile/app/(tabs)/routes.tsx` | 4th tab: saved routes list |
| `mobile/app/route/[id].tsx` | Route Detail: stats, GPX export, delete |
| `mobile/app/offline.tsx` | Offline Manager: trail packs + regional packs |
| `mobile/__mocks__/expo-location.js` | Jest mock |
| `mobile/__mocks__/expo-task-manager.js` | Jest mock |
| `mobile/__mocks__/expo-file-system.js` | Jest mock |
| `mobile/__mocks__/expo-sharing.js` | Jest mock |
| `mobile/__tests__/utils/geo.test.ts` | Haversine + elevation gain tests |
| `mobile/__tests__/utils/gpx.test.ts` | GPX generation tests |
| `mobile/__tests__/stores/locationStore.test.ts` | locationStore tests |
| `mobile/__tests__/stores/recordingStore.test.ts` | recordingStore tests |
| `mobile/__tests__/stores/savedRoutesStore.test.ts` | savedRoutesStore tests |
| `mobile/__tests__/stores/offlineStore.test.ts` | offlineStore tests |

### Modified files
| File | Change |
|------|--------|
| `mobile/src/constants.ts` | Add TILE_STYLE_URL export |
| `mobile/app/_layout.tsx` | Add route/[id] and offline screen registrations |
| `mobile/app/(tabs)/_layout.tsx` | Add Routes (4th) tab |
| `mobile/app/(tabs)/index.tsx` | Add RecordingFAB, save dialog, crash recovery |
| `mobile/app/(tabs)/saved.tsx` | Add "Manage Downloads" header button |
| `mobile/app/trail/[id].tsx` | Add "Download for offline" button |
| `mobile/jest.config.js` | Add module mappings for new Expo libraries |

---

## Task 1: Types and region constants

**Files:**
- Create: `mobile/src/types/route.ts`
- Create: `mobile/src/types/offline.ts`
- Create: `mobile/src/constants/regions.ts`

- [ ] **Step 1: Create route types**

```typescript
// mobile/src/types/route.ts
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
```

- [ ] **Step 2: Create offline types**

```typescript
// mobile/src/types/offline.ts
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
```

- [ ] **Step 3: Create regions constants**

```typescript
// mobile/src/constants/regions.ts
import type { RegionDefinition } from '@/types/offline';

export const REGIONS: RegionDefinition[] = [
  {
    key: 'us-west',
    name: 'US West',
    description: 'California, Oregon, Washington',
    pmtiles_url: 'https://build.protomaps.com/20240101.pmtiles',
    size_bytes_approx: 1_200_000_000,
  },
  {
    key: 'us-northeast',
    name: 'US Northeast',
    description: 'New England, New York, Pennsylvania',
    pmtiles_url: 'https://build.protomaps.com/20240101.pmtiles',
    size_bytes_approx: 900_000_000,
  },
  {
    key: 'europe-alps',
    name: 'European Alps',
    description: 'Switzerland, Austria, northern Italy, southern France',
    pmtiles_url: 'https://build.protomaps.com/20240101.pmtiles',
    size_bytes_approx: 800_000_000,
  },
];
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/types/route.ts mobile/src/types/offline.ts mobile/src/constants/regions.ts
git commit -m "feat: add route and offline types, region constants"
```

---

## Task 2: Geo utilities and tests

**Files:**
- Create: `mobile/src/utils/geo.ts`
- Create: `mobile/__tests__/utils/geo.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// mobile/__tests__/utils/geo.test.ts
import { haversineDistance, computeRouteDistance, computeElevationGain } from '@/utils/geo';

test('haversineDistance returns 0 for same point', () => {
  expect(haversineDistance(40, -74, 40, -74)).toBe(0);
});

test('haversineDistance London to Paris is ~341 km', () => {
  const dist = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
  expect(dist).toBeGreaterThan(340_000);
  expect(dist).toBeLessThan(343_000);
});

test('computeRouteDistance sums segment distances', () => {
  const points = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 0, longitude: 2 },
  ];
  const expected = haversineDistance(0, 0, 0, 1) + haversineDistance(0, 1, 0, 2);
  expect(computeRouteDistance(points)).toBeCloseTo(expected, 0);
});

test('computeRouteDistance returns 0 for single point', () => {
  expect(computeRouteDistance([{ latitude: 0, longitude: 0 }])).toBe(0);
});

test('computeElevationGain sums only positive altitude deltas', () => {
  const points = [
    { altitude: 100 },
    { altitude: 120 }, // +20
    { altitude: 110 }, // -10 (ignored)
    { altitude: 130 }, // +20
  ];
  expect(computeElevationGain(points)).toBe(40);
});

test('computeElevationGain skips null altitudes', () => {
  const points = [
    { altitude: 100 },
    { altitude: null }, // skip
    { altitude: 140 }, // null prev → skip
  ];
  expect(computeElevationGain(points)).toBe(0);
});

test('computeElevationGain returns 0 for empty array', () => {
  expect(computeElevationGain([])).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest __tests__/utils/geo.test.ts --no-coverage
```
Expected: FAIL — "Cannot find module '@/utils/geo'"

- [ ] **Step 3: Implement geo utilities**

```typescript
// mobile/src/utils/geo.ts
const EARTH_RADIUS_M = 6_371_000;

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function computeRouteDistance(
  points: Array<{ latitude: number; longitude: number }>
): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].latitude, points[i - 1].longitude,
      points[i].latitude, points[i].longitude
    );
  }
  return total;
}

export function computeElevationGain(
  points: Array<{ altitude: number | null }>
): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].altitude;
    const curr = points[i].altitude;
    if (prev !== null && curr !== null && curr > prev) {
      gain += curr - prev;
    }
  }
  return gain;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile && npx jest __tests__/utils/geo.test.ts --no-coverage
```
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add mobile/src/utils/geo.ts mobile/__tests__/utils/geo.test.ts
git commit -m "feat: add haversine distance and elevation gain utilities"
```

---

## Task 3: GPX generator and tests

**Files:**
- Create: `mobile/src/utils/gpx.ts`
- Create: `mobile/__tests__/utils/gpx.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// mobile/__tests__/utils/gpx.test.ts
import { generateGpx } from '@/utils/gpx';
import type { SavedRoute } from '@/types/route';

const route: SavedRoute = {
  id: 'r1',
  name: 'Morning Hike',
  points: [
    { latitude: 37.7749, longitude: -122.4194, altitude: 50, timestamp: 1000000000000 },
    { latitude: 37.7759, longitude: -122.4184, altitude: 60, timestamp: 1000000005000 },
  ],
  distance_m: 150,
  duration_s: 5,
  elevation_gain_m: 10,
  created_at: 1000000000000,
};

test('generateGpx produces valid GPX 1.1 XML declaration', () => {
  const gpx = generateGpx(route);
  expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  expect(gpx).toContain('<gpx version="1.1"');
  expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
});

test('generateGpx includes route name in metadata and trk', () => {
  const gpx = generateGpx(route);
  expect(gpx.match(/<name>Morning Hike<\/name>/g)?.length).toBe(2);
});

test('generateGpx includes all track points', () => {
  const gpx = generateGpx(route);
  expect(gpx).toContain('lat="37.7749" lon="-122.4194"');
  expect(gpx).toContain('lat="37.7759" lon="-122.4184"');
});

test('generateGpx includes elevation for non-null altitudes', () => {
  const gpx = generateGpx(route);
  expect(gpx).toContain('<ele>50.0</ele>');
  expect(gpx).toContain('<ele>60.0</ele>');
});

test('generateGpx timestamps are ISO 8601', () => {
  const gpx = generateGpx(route);
  expect(gpx).toMatch(/<time>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z<\/time>/);
});

test('generateGpx escapes XML special chars in route name', () => {
  const r: SavedRoute = { ...route, name: 'Tom & Jerry <Trail>' };
  const gpx = generateGpx(r);
  expect(gpx).toContain('Tom &amp; Jerry &lt;Trail&gt;');
  expect(gpx).not.toContain('Tom & Jerry');
});

test('generateGpx omits ele element when altitude is null', () => {
  const r: SavedRoute = {
    ...route,
    points: [{ latitude: 37.7749, longitude: -122.4194, altitude: null, timestamp: 1000000000000 }],
  };
  const gpx = generateGpx(r);
  expect(gpx).not.toContain('<ele>');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest __tests__/utils/gpx.test.ts --no-coverage
```
Expected: FAIL — "Cannot find module '@/utils/gpx'"

- [ ] **Step 3: Implement GPX generator**

```typescript
// mobile/src/utils/gpx.ts
import type { SavedRoute } from '@/types/route';

export function generateGpx(route: SavedRoute): string {
  const toIso = (ms: number) => new Date(ms).toISOString();

  const trkpts = route.points
    .map((p) => {
      const ele = p.altitude !== null
        ? `\n      <ele>${p.altitude.toFixed(1)}</ele>`
        : '';
      return `    <trkpt lat="${p.latitude}" lon="${p.longitude}">${ele}\n      <time>${toIso(p.timestamp)}</time>\n    </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailForge" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <time>${toIso(route.created_at)}</time>
  </metadata>
  <trk>
    <name>${escapeXml(route.name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile && npx jest __tests__/utils/gpx.test.ts --no-coverage
```
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add mobile/src/utils/gpx.ts mobile/__tests__/utils/gpx.test.ts
git commit -m "feat: add GPX 1.1 generator with XML escaping"
```

---

## Task 4: Zustand stores and tests

**Files:**
- Create: `mobile/src/stores/locationStore.ts`
- Create: `mobile/src/stores/recordingStore.ts`
- Create: `mobile/src/stores/savedRoutesStore.ts`
- Create: `mobile/src/stores/offlineStore.ts`
- Create: `mobile/__tests__/stores/locationStore.test.ts`
- Create: `mobile/__tests__/stores/recordingStore.test.ts`
- Create: `mobile/__tests__/stores/savedRoutesStore.test.ts`
- Create: `mobile/__tests__/stores/offlineStore.test.ts`

- [ ] **Step 1: Write store tests**

```typescript
// mobile/__tests__/stores/locationStore.test.ts
import { useLocationStore } from '@/stores/locationStore';

beforeEach(() => useLocationStore.setState({ coords: null, isWatching: false }));

test('setCoords updates coords', () => {
  useLocationStore.getState().setCoords({ latitude: 37.77, longitude: -122.42, altitude: 50, accuracy: 5, heading: 180 });
  expect(useLocationStore.getState().coords?.latitude).toBe(37.77);
});

test('setWatching updates isWatching', () => {
  useLocationStore.getState().setWatching(true);
  expect(useLocationStore.getState().isWatching).toBe(true);
});

test('setCoords with null clears coords', () => {
  useLocationStore.getState().setCoords({ latitude: 1, longitude: 2, altitude: null, accuracy: null, heading: null });
  useLocationStore.getState().setCoords(null);
  expect(useLocationStore.getState().coords).toBeNull();
});
```

```typescript
// mobile/__tests__/stores/recordingStore.test.ts
import { useRecordingStore } from '@/stores/recordingStore';
import type { RoutePoint } from '@/types/route';

beforeEach(() =>
  useRecordingStore.setState({ isRecording: false, currentRoute: [], startTime: null })
);

test('startRecording sets isRecording and startTime, clears route', () => {
  useRecordingStore.setState({ currentRoute: [{ latitude: 1, longitude: 1, altitude: null, timestamp: 0 }] });
  useRecordingStore.getState().startRecording();
  const s = useRecordingStore.getState();
  expect(s.isRecording).toBe(true);
  expect(s.startTime).toBeGreaterThan(0);
  expect(s.currentRoute).toHaveLength(0);
});

test('stopRecording sets isRecording false', () => {
  useRecordingStore.getState().startRecording();
  useRecordingStore.getState().stopRecording();
  expect(useRecordingStore.getState().isRecording).toBe(false);
});

test('addPoint appends to currentRoute', () => {
  const point: RoutePoint = { latitude: 37.77, longitude: -122.42, altitude: 50, timestamp: Date.now() };
  useRecordingStore.getState().addPoint(point);
  expect(useRecordingStore.getState().currentRoute).toHaveLength(1);
  expect(useRecordingStore.getState().currentRoute[0].latitude).toBe(37.77);
});

test('getStats returns zero distance for empty route', () => {
  const stats = useRecordingStore.getState().getStats();
  expect(stats.distance_m).toBe(0);
  expect(stats.elevation_gain_m).toBe(0);
});

test('getStats computes elevation gain from route points', () => {
  useRecordingStore.setState({
    isRecording: true,
    startTime: Date.now() - 10000,
    currentRoute: [
      { latitude: 37.77, longitude: -122.42, altitude: 100, timestamp: Date.now() - 10000 },
      { latitude: 37.78, longitude: -122.41, altitude: 150, timestamp: Date.now() },
    ],
  });
  const stats = useRecordingStore.getState().getStats();
  expect(stats.elevation_gain_m).toBe(50);
  expect(stats.duration_s).toBeGreaterThan(0);
});
```

```typescript
// mobile/__tests__/stores/savedRoutesStore.test.ts
import { useSavedRoutesStore } from '@/stores/savedRoutesStore';
import type { SavedRoute } from '@/types/route';

const route: SavedRoute = {
  id: 'r1',
  name: 'Test Route',
  points: [],
  distance_m: 1000,
  duration_s: 300,
  elevation_gain_m: 50,
  created_at: Date.now(),
};

beforeEach(() => useSavedRoutesStore.setState({ routes: {} }));

test('saveRoute stores the route', () => {
  useSavedRoutesStore.getState().saveRoute(route);
  expect(useSavedRoutesStore.getState().routes['r1']).toEqual(route);
});

test('deleteRoute removes the route', () => {
  useSavedRoutesStore.getState().saveRoute(route);
  useSavedRoutesStore.getState().deleteRoute('r1');
  expect(useSavedRoutesStore.getState().routes['r1']).toBeUndefined();
});

test('getRoute returns the route by id', () => {
  useSavedRoutesStore.getState().saveRoute(route);
  expect(useSavedRoutesStore.getState().getRoute('r1')).toEqual(route);
});

test('getRoute returns undefined for missing id', () => {
  expect(useSavedRoutesStore.getState().getRoute('nope')).toBeUndefined();
});
```

```typescript
// mobile/__tests__/stores/offlineStore.test.ts
import { useOfflineStore } from '@/stores/offlineStore';
import type { OfflinePack } from '@/types/offline';

const pack: OfflinePack = {
  id: 'trail-123',
  name: 'Test Trail',
  type: 'trail-local',
  trail_id: '123',
  size_bytes: 1_000_000,
  downloaded_at: 0,
  status: 'downloading',
};

beforeEach(() => useOfflineStore.setState({ packs: {}, downloadProgress: {} }));

test('addPack stores the pack', () => {
  useOfflineStore.getState().addPack(pack);
  expect(useOfflineStore.getState().packs['trail-123']).toMatchObject({ status: 'downloading' });
});

test('updatePackStatus transitions to complete', () => {
  useOfflineStore.getState().addPack(pack);
  useOfflineStore.getState().updatePackStatus('trail-123', 'complete');
  expect(useOfflineStore.getState().packs['trail-123'].status).toBe('complete');
  expect(useOfflineStore.getState().packs['trail-123'].downloaded_at).toBeGreaterThan(0);
});

test('updateProgress records fractional progress', () => {
  useOfflineStore.getState().updateProgress('trail-123', 0.42);
  expect(useOfflineStore.getState().downloadProgress['trail-123']).toBe(0.42);
});

test('deletePack removes pack and progress', () => {
  useOfflineStore.getState().addPack(pack);
  useOfflineStore.getState().updateProgress('trail-123', 0.5);
  useOfflineStore.getState().deletePack('trail-123');
  expect(useOfflineStore.getState().packs['trail-123']).toBeUndefined();
  expect(useOfflineStore.getState().downloadProgress['trail-123']).toBeUndefined();
});

test('hasPack returns false when status is not complete', () => {
  useOfflineStore.getState().addPack(pack);
  expect(useOfflineStore.getState().hasPack('trail-123')).toBe(false);
});

test('hasPack returns true after complete', () => {
  useOfflineStore.getState().addPack(pack);
  useOfflineStore.getState().updatePackStatus('trail-123', 'complete');
  expect(useOfflineStore.getState().hasPack('trail-123')).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest __tests__/stores/locationStore.test.ts __tests__/stores/recordingStore.test.ts __tests__/stores/savedRoutesStore.test.ts __tests__/stores/offlineStore.test.ts --no-coverage
```
Expected: FAIL — "Cannot find module" errors

- [ ] **Step 3: Implement locationStore**

```typescript
// mobile/src/stores/locationStore.ts
import { create } from 'zustand';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  heading: number | null;
}

interface LocationState {
  coords: LocationCoords | null;
  isWatching: boolean;
  setCoords: (coords: LocationCoords | null) => void;
  setWatching: (watching: boolean) => void;
}

export const useLocationStore = create<LocationState>()((set) => ({
  coords: null,
  isWatching: false,
  setCoords: (coords) => set({ coords }),
  setWatching: (isWatching) => set({ isWatching }),
}));
```

- [ ] **Step 4: Implement recordingStore**

```typescript
// mobile/src/stores/recordingStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoutePoint } from '@/types/route';
import { computeRouteDistance, computeElevationGain } from '@/utils/geo';

interface RecordingState {
  isRecording: boolean;
  currentRoute: RoutePoint[];
  startTime: number | null;
  startRecording: () => void;
  stopRecording: () => void;
  addPoint: (point: RoutePoint) => void;
  clearRoute: () => void;
  getStats: () => { distance_m: number; duration_s: number; elevation_gain_m: number };
}

export const useRecordingStore = create<RecordingState>()(
  persist(
    (set, get) => ({
      isRecording: false,
      currentRoute: [],
      startTime: null,
      startRecording: () =>
        set({ isRecording: true, startTime: Date.now(), currentRoute: [] }),
      stopRecording: () => set({ isRecording: false }),
      addPoint: (point) =>
        set((state) => ({ currentRoute: [...state.currentRoute, point] })),
      clearRoute: () => set({ currentRoute: [], startTime: null }),
      getStats: () => {
        const { currentRoute, startTime } = get();
        return {
          distance_m: computeRouteDistance(currentRoute),
          elevation_gain_m: computeElevationGain(currentRoute),
          duration_s: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
        };
      },
    }),
    {
      name: 'trailforge-recording',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- [ ] **Step 5: Implement savedRoutesStore**

```typescript
// mobile/src/stores/savedRoutesStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedRoute } from '@/types/route';

interface SavedRoutesState {
  routes: Record<string, SavedRoute>;
  saveRoute: (route: SavedRoute) => void;
  deleteRoute: (id: string) => void;
  getRoute: (id: string) => SavedRoute | undefined;
}

export const useSavedRoutesStore = create<SavedRoutesState>()(
  persist(
    (set, get) => ({
      routes: {},
      saveRoute: (route) =>
        set((state) => ({ routes: { ...state.routes, [route.id]: route } })),
      deleteRoute: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.routes;
          return { routes: rest };
        }),
      getRoute: (id) => get().routes[id],
    }),
    {
      name: 'trailforge-saved-routes',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- [ ] **Step 6: Implement offlineStore**

```typescript
// mobile/src/stores/offlineStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflinePack } from '@/types/offline';

interface OfflineState {
  packs: Record<string, OfflinePack>;
  downloadProgress: Record<string, number>;
  addPack: (pack: OfflinePack) => void;
  updatePackStatus: (id: string, status: OfflinePack['status'], localPath?: string) => void;
  updateProgress: (id: string, progress: number) => void;
  deletePack: (id: string) => void;
  hasPack: (id: string) => boolean;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      packs: {},
      downloadProgress: {},
      addPack: (pack) =>
        set((state) => ({ packs: { ...state.packs, [pack.id]: pack } })),
      updatePackStatus: (id, status, localPath) =>
        set((state) => ({
          packs: {
            ...state.packs,
            [id]: {
              ...state.packs[id],
              status,
              ...(localPath ? { local_path: localPath } : {}),
              ...(status === 'complete' ? { downloaded_at: Date.now() } : {}),
            },
          },
        })),
      updateProgress: (id, progress) =>
        set((state) => ({
          downloadProgress: { ...state.downloadProgress, [id]: progress },
        })),
      deletePack: (id) =>
        set((state) => {
          const { [id]: _p, ...packs } = state.packs;
          const { [id]: _d, ...downloadProgress } = state.downloadProgress;
          return { packs, downloadProgress };
        }),
      hasPack: (id) =>
        id in get().packs && get().packs[id].status === 'complete',
    }),
    {
      name: 'trailforge-offline',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ packs: state.packs }), // don't persist progress
    }
  )
);
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd mobile && npx jest __tests__/stores/locationStore.test.ts __tests__/stores/recordingStore.test.ts __tests__/stores/savedRoutesStore.test.ts __tests__/stores/offlineStore.test.ts --no-coverage
```
Expected: PASS — 20 tests

- [ ] **Step 8: Commit**

```bash
git add mobile/src/stores/locationStore.ts mobile/src/stores/recordingStore.ts mobile/src/stores/savedRoutesStore.ts mobile/src/stores/offlineStore.ts mobile/__tests__/stores/locationStore.test.ts mobile/__tests__/stores/recordingStore.test.ts mobile/__tests__/stores/savedRoutesStore.test.ts mobile/__tests__/stores/offlineStore.test.ts
git commit -m "feat: add location, recording, savedRoutes, and offline Zustand stores"
```

---

## Task 5: Background location task and Jest mocks

**Files:**
- Create: `mobile/src/tasks/locationTask.ts`
- Create: `mobile/__mocks__/expo-location.js`
- Create: `mobile/__mocks__/expo-task-manager.js`
- Create: `mobile/__mocks__/expo-file-system.js`
- Create: `mobile/__mocks__/expo-sharing.js`
- Modify: `mobile/jest.config.js`
- Modify: `mobile/src/constants.ts`

- [ ] **Step 1: Add TILE_STYLE_URL to constants**

Replace the entire `mobile/src/constants.ts` with:

```typescript
// mobile/src/constants.ts
// Must match backend MAX_BBOX_AREA_DEG2
export const MAX_BBOX_AREA_DEG2 = 4.0;

// MapLibre style URL — used for both live rendering and offline pack downloads
export const TILE_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
```

- [ ] **Step 2: Create background location task**

```typescript
// mobile/src/tasks/locationTask.ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useRecordingStore } from '@/stores/recordingStore';
import { useLocationStore } from '@/stores/locationStore';

export const LOCATION_TASK = 'TRAILFORGE_LOCATION';

interface LocationTaskData {
  locations: Location.LocationObject[];
}

TaskManager.defineTask(
  LOCATION_TASK,
  ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
    if (error || !data?.locations?.length) return;
    const loc = data.locations[data.locations.length - 1];
    const { coords } = loc;

    useLocationStore.getState().setCoords({
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude ?? null,
      accuracy: coords.accuracy ?? null,
      heading: coords.heading ?? null,
    });

    if (useRecordingStore.getState().isRecording) {
      useRecordingStore.getState().addPoint({
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude: coords.altitude ?? null,
        timestamp: loc.timestamp,
      });
    }
  }
);

export async function startLocationUpdates(): Promise<void> {
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 5000,
    foregroundService: {
      notificationTitle: 'TrailForge',
      notificationBody: 'Recording your route',
      notificationColor: '#2979c0',
    },
  });
  useLocationStore.getState().setWatching(true);
}

export async function stopLocationUpdates(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  useLocationStore.getState().setWatching(false);
}
```

- [ ] **Step 3: Create Jest mocks for Expo libraries**

```javascript
// mobile/__mocks__/expo-location.js
module.exports = {
  Accuracy: { High: 5, Balanced: 3, Low: 1 },
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  requestBackgroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 37.77, longitude: -122.42, altitude: 50, accuracy: 5, heading: 0 },
      timestamp: Date.now(),
    })
  ),
  startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
};
```

```javascript
// mobile/__mocks__/expo-task-manager.js
module.exports = {
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(() => Promise.resolve(false)),
};
```

```javascript
// mobile/__mocks__/expo-file-system.js
module.exports = {
  documentDirectory: '/mock/documents/',
  downloadAsync: jest.fn(() => Promise.resolve({ status: 200, uri: '/mock/file.pmtiles' })),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, size: 500_000_000 })),
  createDownloadResumable: jest.fn(() => ({
    downloadAsync: jest.fn(() => Promise.resolve({ status: 200, uri: '/mock/file.pmtiles' })),
  })),
};
```

```javascript
// mobile/__mocks__/expo-sharing.js
module.exports = {
  shareAsync: jest.fn(() => Promise.resolve()),
};
```

- [ ] **Step 4: Update jest.config.js to map new libraries**

Replace the entire `mobile/jest.config.js` with:

```javascript
module.exports = {
  preset: undefined,
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native/Libraries/Alert/Alert$': '<rootDir>/__mocks__/react-native-alert.js',
    '^react-native/Libraries/Share/Share$': '<rootDir>/__mocks__/react-native-share.js',
    '^expo-router$': '<rootDir>/__mocks__/expo-router.js',
    '^expo-location$': '<rootDir>/__mocks__/expo-location.js',
    '^expo-task-manager$': '<rootDir>/__mocks__/expo-task-manager.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-sharing$': '<rootDir>/__mocks__/expo-sharing.js',
    '^@testing-library/react-native$':
      '<rootDir>/node_modules/@testing-library/react-native/build/index.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zustand|@testing-library/react-native)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
```

- [ ] **Step 5: Run full test suite to confirm nothing broke**

```bash
cd mobile && npx jest --no-coverage
```
Expected: PASS — all prior tests still pass

- [ ] **Step 6: Commit**

```bash
git add mobile/src/tasks/locationTask.ts mobile/src/constants.ts mobile/__mocks__/expo-location.js mobile/__mocks__/expo-task-manager.js mobile/__mocks__/expo-file-system.js mobile/__mocks__/expo-sharing.js mobile/jest.config.js
git commit -m "feat: add background location task and Jest mocks for Expo libraries"
```

---

## Task 6: RecordingFAB component and Explore tab changes

**Files:**
- Create: `mobile/src/components/RecordingFAB.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Create RecordingFAB component**

```typescript
// mobile/src/components/RecordingFAB.tsx
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useRecordingStore } from '@/stores/recordingStore';

interface RecordingFABProps {
  onStopRecording: () => void;
}

export function RecordingFAB({ onStopRecording }: RecordingFABProps) {
  const { isRecording, startTime, startRecording, stopRecording } = useRecordingStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording || !startTime) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, startTime]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handlePress = () => {
    if (isRecording) {
      stopRecording();
      onStopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.fab, isRecording ? styles.fabActive : styles.fabIdle]}
      onPress={handlePress}
    >
      {isRecording ? (
        <View style={styles.row}>
          <View style={styles.dot} />
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        </View>
      ) : (
        <Text style={styles.idleText}>⏺ Record</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabIdle: { backgroundColor: '#fff' },
  fabActive: { backgroundColor: '#c62828' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  timerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  idleText: { fontWeight: '600', fontSize: 14, color: '#333' },
});
```

- [ ] **Step 2: Update Explore tab with RecordingFAB, save dialog, and crash recovery**

Replace the entire `mobile/app/(tabs)/index.tsx` with:

```typescript
// mobile/app/(tabs)/index.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, TextInput, Modal, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { router } from 'expo-router';
import { SearchBar } from '@/components/SearchBar';
import { TrailMap } from '@/components/TrailMap';
import { TrailBottomSheet } from '@/components/TrailBottomSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { RecordingFAB } from '@/components/RecordingFAB';
import { useMapStore } from '@/stores/mapStore';
import { useRecordingStore } from '@/stores/recordingStore';
import { useSavedRoutesStore } from '@/stores/savedRoutesStore';
import { searchTrails, geocodePlace } from '@/api/trailApi';
import { useDebounce } from '@/hooks/useDebounce';
import { LOCATION_TASK, startLocationUpdates, stopLocationUpdates } from '@/tasks/locationTask';
import { MAX_BBOX_AREA_DEG2 } from '@/constants';
import type { Trail, BBox } from '@/types/trail';

export default function ExploreScreen() {
  const { setBbox, setLoading, setSelectedTrailId } = useMapStore();
  const { isRecording, getStats, clearRoute } = useRecordingStore();
  const { saveRoute } = useSavedRoutesStore();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [routeName, setRouteName] = useState('');

  // Crash recovery: if persisted store says recording but task is dead
  useEffect(() => {
    (async () => {
      if (!isRecording) return;
      const isAlive = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
      if (!isAlive) {
        Alert.alert(
          'Unfinished route found',
          'A recording was interrupted. What would you like to do?',
          [
            {
              text: 'Resume',
              onPress: () => startLocationUpdates(),
            },
            {
              text: 'Save & stop',
              onPress: () => setShowSaveDialog(true),
            },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => clearRoute(),
            },
          ]
        );
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecordStart = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    await Location.requestBackgroundPermissionsAsync();
    await startLocationUpdates();
  }, []);

  const handleRecordStop = useCallback(() => {
    stopLocationUpdates();
    setShowSaveDialog(true);
    setRouteName('');
  }, []);

  const handleSaveRoute = useCallback(() => {
    const stats = getStats();
    const id = `route-${Date.now()}`;
    saveRoute({
      id,
      name: routeName.trim() || 'Unnamed route',
      points: useRecordingStore.getState().currentRoute,
      ...stats,
      created_at: Date.now(),
    });
    clearRoute();
    setShowSaveDialog(false);
    router.push(`/route/${id}`);
  }, [routeName, getStats, saveRoute, clearRoute]);

  const handleDiscardRoute = useCallback(() => {
    clearRoute();
    setShowSaveDialog(false);
  }, [clearRoute]);

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
      loadTrails({ south: +lat - delta, west: +lon - delta, north: +lat + delta, east: +lon + delta });
    } catch { /* ignore */ }
  }, [loadTrails]);

  const handleNearMe = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    const delta = 0.05;
    loadTrails({
      south: loc.coords.latitude - delta,
      west: loc.coords.longitude - delta,
      north: loc.coords.latitude + delta,
      east: loc.coords.longitude + delta,
    });
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
      <RecordingFAB onStopRecording={handleRecordStop} />
      <TrailBottomSheet
        trail={selectedTrail}
        onDismiss={() => { setSelectedTrail(null); setSelectedTrailId(null); }}
      />

      <Modal visible={showSaveDialog} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Save route</Text>
            <TextInput
              style={styles.input}
              placeholder="Route name"
              value={routeName}
              onChangeText={setRouteName}
              autoFocus
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.dialogBtnDiscard} onPress={handleDiscardRoute}>
                <Text style={styles.dialogBtnTextDiscard}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogBtnSave} onPress={handleSaveRoute}>
                <Text style={styles.dialogBtnTextSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tooBig: { position: 'absolute', top: 100, alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tooBigText: { color: '#fff', fontWeight: '600' },
  nearMe: { position: 'absolute', bottom: 32, right: 16, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  nearMeText: { fontWeight: '600', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  dialog: { backgroundColor: '#fff', borderRadius: 14, padding: 20, width: 300 },
  dialogTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 16 },
  dialogButtons: { flexDirection: 'row', gap: 10 },
  dialogBtnDiscard: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  dialogBtnTextDiscard: { color: '#666', fontWeight: '600' },
  dialogBtnSave: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#2979c0', alignItems: 'center' },
  dialogBtnTextSave: { color: '#fff', fontWeight: '600' },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/RecordingFAB.tsx mobile/app/(tabs)/index.tsx
git commit -m "feat: add RecordingFAB, route save dialog, and crash recovery to Explore tab"
```

---

## Task 7: Routes tab and Route Detail screen

**Files:**
- Create: `mobile/src/components/RouteRow.tsx`
- Create: `mobile/app/(tabs)/routes.tsx`
- Create: `mobile/app/route/[id].tsx`

- [ ] **Step 1: Create RouteRow component**

```typescript
// mobile/src/components/RouteRow.tsx
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import type { SavedRoute } from '@/types/route';

interface RouteRowProps {
  route: SavedRoute;
  onPress: () => void;
}

export function RouteRow({ route, onPress }: RouteRowProps) {
  const date = new Date(route.created_at).toLocaleDateString();
  const dist = (route.distance_m / 1000).toFixed(1);
  const mins = Math.round(route.duration_s / 60);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.info}>
        <Text style={styles.name}>{route.name}</Text>
        <Text style={styles.meta}>{date}</Text>
      </View>
      <View style={styles.badges}>
        <Badge text={`${dist} km`} />
        <Badge text={`${mins} min`} />
      </View>
    </TouchableOpacity>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, color: '#888', marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { backgroundColor: '#e8f0fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, color: '#2979c0', fontWeight: '600' },
});
```

- [ ] **Step 2: Create Routes tab screen**

```typescript
// mobile/app/(tabs)/routes.tsx
import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { RouteRow } from '@/components/RouteRow';
import { useSavedRoutesStore } from '@/stores/savedRoutesStore';
import type { SavedRoute } from '@/types/route';

export default function RoutesScreen() {
  const { routes } = useSavedRoutesStore();
  const routeList = Object.values(routes).sort((a, b) => b.created_at - a.created_at);

  if (routeList.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No recorded routes yet</Text>
        <Text style={styles.hint}>Start recording from the Explore tab</Text>
      </View>
    );
  }

  return (
    <FlatList<SavedRoute>
      data={routeList}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => (
        <RouteRow route={item} onPress={() => router.push(`/route/${item.id}`)} />
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

- [ ] **Step 3: Create Route Detail screen**

```typescript
// mobile/app/route/[id].tsx
import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSavedRoutesStore } from '@/stores/savedRoutesStore';
import { generateGpx } from '@/utils/gpx';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getRoute, deleteRoute } = useSavedRoutesStore();
  const route = getRoute(id);

  const handleExportGpx = useCallback(async () => {
    if (!route) return;
    const gpxString = generateGpx(route);
    const path = `${FileSystem.documentDirectory}${route.id}.gpx`;
    await FileSystem.writeAsStringAsync(path, gpxString);
    await Sharing.shareAsync(path, {
      mimeType: 'application/gpx+xml',
      dialogTitle: `Export ${route.name}`,
    });
  }, [route]);

  const handleDelete = useCallback(() => {
    if (!route) return;
    Alert.alert(
      'Delete route',
      `Delete "${route.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRoute(id);
            router.back();
          },
        },
      ]
    );
  }, [route, id, deleteRoute]);

  if (!route) {
    return <View style={styles.center}><Text>Route not found.</Text></View>;
  }

  const dist = (route.distance_m / 1000).toFixed(2);
  const mins = Math.floor(route.duration_s / 60);
  const secs = route.duration_s % 60;
  const elev = Math.round(route.elevation_gain_m);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.name}>{route.name}</Text>
      <View style={styles.stats}>
        <Stat label="Distance" value={`${dist} km`} />
        <Stat label="Duration" value={`${mins}m ${secs}s`} />
        <Stat label="Elev. gain" value={`${elev} m`} />
      </View>

      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleExportGpx}>
        <Text style={styles.btnText}>Export GPX</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnDestructive]} onPress={handleDelete}>
        <Text style={styles.btnText}>Delete Route</Text>
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
  name: { fontSize: 22, fontWeight: '700', padding: 16, paddingBottom: 8 },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  btn: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2979c0' },
  btnDestructive: { backgroundColor: '#c62828' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/RouteRow.tsx mobile/app/(tabs)/routes.tsx mobile/app/route/[id].tsx
git commit -m "feat: add Routes tab and Route Detail screen with GPX export"
```

---

## Task 8: Trail Detail offline button and Offline Manager screen

**Files:**
- Modify: `mobile/app/trail/[id].tsx`
- Create: `mobile/app/offline.tsx`
- Modify: `mobile/app/(tabs)/saved.tsx`

- [ ] **Step 1: Add "Download for offline" button to Trail Detail**

Replace the entire `mobile/app/trail/[id].tsx` with:

```typescript
// mobile/app/trail/[id].tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Share, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { DifficultyBadge } from '@/components/DifficultyBadge';
import { useSavedStore } from '@/stores/savedStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { fetchTrail, exportTrailToGarmin, pollJobStatus } from '@/api/trailApi';
import { TILE_STYLE_URL } from '@/constants';
import type { Trail } from '@/types/trail';
import type { OfflinePack } from '@/types/offline';

type ExportState = 'idle' | 'loading' | 'done' | 'error';

function getTrailBbox(trail: Trail) {
  const coords = trail.geometry.coordinates;
  const lats = coords.map(([, lat]) => lat);
  const lons = coords.map(([lon]) => lon);
  const DEG_PER_500M = 500 / 111_000;
  return {
    south: Math.min(...lats) - DEG_PER_500M,
    north: Math.max(...lats) + DEG_PER_500M,
    west: Math.min(...lons) - DEG_PER_500M,
    east: Math.max(...lons) + DEG_PER_500M,
  };
}

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSaved, saveTrail, removeTrail } = useSavedStore();
  const { packs, addPack, updatePackStatus, hasPack } = useOfflineStore();

  const [trail, setTrail] = useState<Trail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportProgress, setExportProgress] = useState('');

  const packId = `trail-${id}`;
  const pack = packs[packId] as OfflinePack | undefined;
  const isDownloaded = hasPack(packId);
  const isDownloading = pack?.status === 'downloading';

  useEffect(() => {
    fetchTrail(id).then(setTrail).catch(() => setLoadError(true));
  }, [id]);

  const handleDownloadOffline = useCallback(async () => {
    if (!trail || isDownloaded || isDownloading) return;
    const bounds = getTrailBbox(trail);
    const newPack: OfflinePack = {
      id: packId,
      name: trail.name,
      type: 'trail-local',
      trail_id: trail.id,
      size_bytes: 0,
      downloaded_at: 0,
      status: 'downloading',
    };
    addPack(newPack);
    try {
      await MapLibreGL.offlineManager.createPack(
        {
          name: packId,
          styleURL: TILE_STYLE_URL,
          bounds: [[bounds.west, bounds.south], [bounds.east, bounds.north]] as [[number, number], [number, number]],
          minZoom: 12,
          maxZoom: 17,
        },
        (_region, status) => {
          if ((status as any)?.state === 'complete') {
            updatePackStatus(packId, 'complete');
          }
        },
        (_region, error) => {
          if (error) updatePackStatus(packId, 'error');
        }
      );
    } catch {
      updatePackStatus(packId, 'error');
    }
  }, [trail, packId, isDownloaded, isDownloading, addPack, updatePackStatus]);

  const handleExport = useCallback(async () => {
    if (!trail) return;
    setExportState('loading');
    setExportProgress('Starting export…');
    try {
      const { job_id } = await exportTrailToGarmin(trail.id);
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

  const offlineLabel = isDownloaded
    ? '✓ Downloaded'
    : isDownloading
    ? 'Downloading…'
    : 'Download for offline';

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
        onPress={() => (saved ? removeTrail(trail.id) : saveTrail(trail))}
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
        style={[styles.btn, styles.btnOffline, (isDownloaded || isDownloading) && styles.btnDisabled]}
        onPress={handleDownloadOffline}
        disabled={isDownloaded || isDownloading}
      >
        {isDownloading ? (
          <View style={styles.exportLoading}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={[styles.btnText, { marginLeft: 8 }]}>{offlineLabel}</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>{offlineLabel}</Text>
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
  btnOffline: { backgroundColor: '#6a4cad' },
  btnOutline: { borderWidth: 1.5, borderColor: '#2979c0' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnTextOutline: { color: '#2979c0', fontWeight: '600', fontSize: 15 },
  exportLoading: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Create Offline Manager screen**

```typescript
// mobile/app/offline.tsx
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Modal, ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useOfflineStore } from '@/stores/offlineStore';
import { REGIONS } from '@/constants/regions';
import type { OfflinePack } from '@/types/offline';

export default function OfflineManagerScreen() {
  const { packs, downloadProgress, addPack, updatePackStatus, updateProgress, deletePack } =
    useOfflineStore();
  const [showRegions, setShowRegions] = useState(false);

  const trailPacks = Object.values(packs).filter((p) => p.type === 'trail-local');
  const regionalPacks = Object.values(packs).filter((p) => p.type === 'regional');

  const downloadRegion = async (regionKey: string) => {
    const region = REGIONS.find((r) => r.key === regionKey);
    if (!region) return;

    const packId = `regional-${regionKey}`;
    if (packs[packId]) { setShowRegions(false); return; } // already downloaded

    const localPath = `${FileSystem.documentDirectory}${regionKey}.pmtiles`;

    const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory ?? '');
    if ('size' in info && typeof info.size === 'number' && info.size < 200_000_000) {
      Alert.alert('Not enough storage', 'Need at least 200 MB free to download this region.');
      return;
    }

    const pack: OfflinePack = {
      id: packId,
      name: region.name,
      type: 'regional',
      region_key: regionKey,
      size_bytes: region.size_bytes_approx,
      downloaded_at: 0,
      status: 'downloading',
    };
    addPack(pack);
    setShowRegions(false);

    try {
      const dl = FileSystem.createDownloadResumable(
        region.pmtiles_url,
        localPath,
        {},
        (progress) => {
          const pct =
            progress.totalBytesWritten / (progress.totalBytesExpectedToWrite || 1);
          updateProgress(packId, pct);
        }
      );
      const result = await dl.downloadAsync();
      if (result?.status === 200) {
        updatePackStatus(packId, 'complete', result.uri);
      } else {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
        updatePackStatus(packId, 'error');
      }
    } catch {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      updatePackStatus(packId, 'error');
    }
  };

  const handleDelete = (pack: OfflinePack) => {
    Alert.alert('Delete pack', `Delete "${pack.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (pack.type === 'regional' && pack.region_key) {
            const path = `${FileSystem.documentDirectory}${pack.region_key}.pmtiles`;
            await FileSystem.deleteAsync(path, { idempotent: true });
          }
          deletePack(pack.id);
        },
      },
    ]);
  };

  const formatBytes = (b: number) =>
    b >= 1_000_000_000 ? `${(b / 1_000_000_000).toFixed(1)} GB` : `${(b / 1_000_000).toFixed(0)} MB`;

  const renderPack = ({ item }: { item: OfflinePack }) => {
    const progress = downloadProgress[item.id];
    const statusLabel =
      item.status === 'downloading' && progress !== undefined
        ? `${Math.round(progress * 100)}%`
        : item.status;

    return (
      <View style={styles.packRow}>
        <View style={styles.packInfo}>
          <Text style={styles.packName}>{item.name}</Text>
          <Text style={styles.packMeta}>{formatBytes(item.size_bytes)} · {statusLabel}</Text>
        </View>
        {item.status === 'downloading' ? (
          <ActivityIndicator size="small" color="#2979c0" />
        ) : (
          <TouchableOpacity onPress={() => handleDelete(item)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.section}>Trail Packs</Text>
      {trailPacks.length === 0 ? (
        <Text style={styles.empty}>
          No trail packs. Tap "Download for offline" on any trail.
        </Text>
      ) : (
        <FlatList<OfflinePack>
          data={trailPacks}
          keyExtractor={(p) => p.id}
          renderItem={renderPack}
          scrollEnabled={false}
        />
      )}

      <Text style={styles.section}>Regional Packs</Text>
      {regionalPacks.length === 0 ? (
        <Text style={styles.empty}>No regional packs downloaded.</Text>
      ) : (
        <FlatList<OfflinePack>
          data={regionalPacks}
          keyExtractor={(p) => p.id}
          renderItem={renderPack}
          scrollEnabled={false}
        />
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowRegions(true)}>
        <Text style={styles.addBtnText}>+ Add Region</Text>
      </TouchableOpacity>

      <Modal
        visible={showRegions}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRegions(false)}
      >
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Select a Region</Text>
          {REGIONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={styles.regionRow}
              onPress={() => downloadRegion(r.key)}
            >
              <Text style={styles.regionName}>{r.name}</Text>
              <Text style={styles.regionDesc}>
                {r.description} · ~{formatBytes(r.size_bytes_approx)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRegions(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  section: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  empty: { color: '#aaa', paddingHorizontal: 16, paddingBottom: 8, fontSize: 14 },
  packRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  packInfo: { flex: 1 },
  packName: { fontSize: 15, fontWeight: '600' },
  packMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  deleteText: { color: '#c62828', fontWeight: '600' },
  addBtn: { margin: 16, backgroundColor: '#2979c0', padding: 14, borderRadius: 10, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  modal: { flex: 1, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  regionRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  regionName: { fontSize: 15, fontWeight: '600' },
  regionDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  cancelBtn: { marginTop: 16, padding: 14, backgroundColor: '#f0f0f0', borderRadius: 10, alignItems: 'center' },
  cancelText: { color: '#333', fontWeight: '600' },
});
```

- [ ] **Step 3: Add "Manage Downloads" button to Saved tab**

Replace the entire `mobile/app/(tabs)/saved.tsx` with:

```typescript
// mobile/app/(tabs)/saved.tsx
import React from 'react';
import { FlatList, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { TrailRow } from '@/components/TrailRow';
import { useSavedStore } from '@/stores/savedStore';
import type { Trail } from '@/types/trail';

export default function SavedScreen() {
  const { savedTrails } = useSavedStore();
  const trails = Object.values(savedTrails);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.manageBtn} onPress={() => router.push('/offline')}>
        <Text style={styles.manageBtnText}>🗂 Manage Downloads</Text>
      </TouchableOpacity>

      {trails.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No saved trails yet.</Text>
          <Text style={styles.hint}>Tap "Save" on any trail detail to bookmark it here.</Text>
        </View>
      ) : (
        <FlatList<Trail>
          data={trails}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrailRow trail={item} onPress={() => router.push(`/trail/${item.id}`)} />
          )}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  manageBtn: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  manageBtnText: { fontSize: 15, color: '#2979c0', fontWeight: '600' },
  list: { backgroundColor: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  hint: { color: '#888', textAlign: 'center' },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/trail/[id].tsx mobile/app/offline.tsx mobile/app/(tabs)/saved.tsx
git commit -m "feat: add offline download button to Trail Detail and Offline Manager screen"
```

---

## Task 9: Navigation wiring

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Add new screens to root Stack**

Replace the entire `mobile/app/_layout.tsx` with:

```typescript
// mobile/app/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trail/[id]" options={{ title: 'Trail Details' }} />
        <Stack.Screen name="route/[id]" options={{ title: 'Route Details' }} />
        <Stack.Screen name="offline" options={{ title: 'Manage Downloads' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
```

- [ ] **Step 2: Add Routes tab to tab layout**

Replace the entire `mobile/app/(tabs)/_layout.tsx` with:

```typescript
// mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2979c0' }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Explore', tabBarIcon: ({ color }) => <Text style={{ color }}>🗺</Text> }}
      />
      <Tabs.Screen
        name="list"
        options={{ title: 'Trails', tabBarIcon: ({ color }) => <Text style={{ color }}>📋</Text> }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: 'Saved', tabBarIcon: ({ color }) => <Text style={{ color }}>🔖</Text> }}
      />
      <Tabs.Screen
        name="routes"
        options={{ title: 'Routes', tabBarIcon: ({ color }) => <Text style={{ color }}>📍</Text> }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/_layout.tsx mobile/app/(tabs)/_layout.tsx
git commit -m "feat: add Routes tab and offline/route screens to navigation stack"
```

---

## Task 10: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run all mobile tests**

```bash
cd mobile && npx jest --no-coverage
```
Expected: PASS — all test suites pass (stores, geo utils, GPX generator)

- [ ] **Step 2: Verify no TypeScript errors in new files**

```bash
cd mobile && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```
Expected: No errors in `src/` or `app/` files (IDE path alias errors are false positives if `expo/tsconfig.base` is not installed)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: offline + GPS complete — tile packs, route recording, GPX export"
```

---

## Dependency graph (for parallel execution)

```
Task 1 (types + regions)
├── Task 2 (geo utils)     ← parallel with Task 3
├── Task 3 (GPX)           ← parallel with Task 2
└── Task 4 (stores)        ← depends on 1 + 2
    └── Task 5 (task + mocks)
        ├── Task 6 (Explore tab)    ← parallel with 7, 8
        ├── Task 7 (Routes screens) ← parallel with 6, 8
        └── Task 8 (Trail Detail + Offline Manager) ← parallel with 6, 7
            └── Task 9 (navigation wiring)
                └── Task 10 (verification)
```
