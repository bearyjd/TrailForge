# Signal Discoverer Memory Index

- [OSM-to-Garmin pipeline architecture](project_pipeline.md) — 4-stage pipeline order, osmium sort requirement, template.args preference for mkgmap
- [Java tool configuration (mkgmap and splitter)](project_java_tools.md) — JAR paths, -Xmx4g heap, 300s timeout, env var overrides
- [Overpass API download resilience design](project_overpass_resilience.md) — tiling, retry/backoff, mirror fallback, 100-byte empty-response guard
- [Output file conventions and download API](project_output_format.md) — gmapsupp.img naming, job dir layout, HTTP Range/206 support
- [Nominatim geocoding proxied through backend](project_nominatim_proxy.md) — CORS + User-Agent policy reasons for server-side proxy
- [Docker Compose setup — two files, shared image](project_docker_compose.md) — dev vs prod compose, shared backend/worker image, CI publishes on main
- [Bounding box validation — two separate size limits](project_bbox_validation.md) — MAX_BBOX_AREA_DEG2 (API guard) vs OVERPASS_TILE_DEG2 (internal chunking)
- [Job error handling — intentionally no cleanup on failure](project_job_error_handling.md) — failed job dirs preserved for debugging, no expiry mechanism
- [Test coverage — none exists yet](project_no_tests.md) — no tests as of initial release; natural seams for first test pass

## Agent Run Log

### 2026-04-13
- Scanned 1 session (2026-04-13): brief orientation only, no decisions or corrections to extract
- All signal sourced from code and git history (4 commits, initial release)
- Candidates: FILL_GAP: 8, UPDATE: 0, CONTRADICT: 0, NOISE: 0
- No candidates accepted/declined by caller yet (first run)
