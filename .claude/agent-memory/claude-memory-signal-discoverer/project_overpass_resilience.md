---
name: Overpass API download resilience design
description: Tiling strategy, retry logic, mirror fallback, and size validation for OSM downloads
type: project
---

Large bboxes are auto-split into tiles of ≤ `OVERPASS_TILE_DEG2` (default 0.25 deg²) using aspect-ratio-aware grid math. Each tile is attempted against the primary Overpass URL with 2 retries + exponential backoff (10s, 20s) on gateway errors (429, 502, 503, 504), then falls through to each of 2 configured mirrors once with a 5s delay. Multi-tile jobs are merged with `osmium merge`. Downloads < 100 bytes are rejected as empty/error responses.

**Why:** Overpass API rate-limits and goes down frequently; the tiling + mirror approach prevents a single large request from timing out or being rejected. The 100-byte minimum catches Overpass HTML error pages that arrive with 200 status.

**How to apply:** The primary URL and mirrors are all configurable via env (`OVERPASS_URL`, `OVERPASS_MIRRORS`). The tile size limit `OVERPASS_TILE_DEG2=0.25` is distinct from the user-facing bbox cap `MAX_BBOX_AREA_DEG2=4.0` — the former controls internal download chunking, the latter is a validation guard at the API boundary. Do not conflate them.
