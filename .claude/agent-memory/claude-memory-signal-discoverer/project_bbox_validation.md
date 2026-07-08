---
name: Bounding box validation — two separate size limits
description: MAX_BBOX_AREA_DEG2 is the user API guard; OVERPASS_TILE_DEG2 is the internal chunking threshold
type: project
---

`MAX_BBOX_AREA_DEG2` (default 4.0 deg²) is validated at the API layer in `BBox.validate_area()` — requests exceeding it are rejected HTTP 400 before any work starts. `OVERPASS_TILE_DEG2` (default 0.25 deg²) controls how the downloader internally splits any accepted bbox into Overpass tiles.

**Why:** The 4.0 deg² cap (~40,000 km² at mid-latitudes) exists to prevent runaway jobs that would OOM or timeout. The 0.25 deg² tile size keeps individual Overpass requests small enough not to be rate-limited.

**How to apply:** These two values are independent and both configurable via env. Raising `MAX_BBOX_AREA_DEG2` without also tuning `OVERPASS_TILE_DEG2` and JVM heap is unsafe. The minimum area (1e-6 deg²) guard is hardcoded in `BBox.validate_area()`.
