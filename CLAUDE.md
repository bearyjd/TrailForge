# TrailForge — Claude Notes

## Architecture

TrailForge generates Garmin trail maps from OpenStreetMap data.
Stack: Python/FastAPI + Celery/Redis backend, React/Vite frontend, fully Dockerized.
CI publishes images to ghcr.io and Docker Hub.

### Architecture notes

Geocoding is proxied through FastAPI (`GET /geocode`), not called from the browser.
Reason: Nominatim blocks cross-origin browser requests and requires a custom User-Agent that browsers cannot set.

## Pipeline

Strict 4-stage order: Overpass download → osmium sort → splitter → mkgmap.
osmium must *sort* (not just convert) the OSM XML or splitter produces invalid tiles.
mkgmap prefers splitter's `template.args` over a raw PBF glob — it preserves tile metadata.

Both splitter and mkgmap are invoked with `-Xmx4g` — do not remove or they OOM on real areas.
JAR paths default to `/opt/mkgmap/` and `/opt/splitter/` in Docker; override via `MKGMAP_JAR`/`SPLITTER_JAR` env vars for local dev.

## Configuration gotchas

Two area limits exist — do not conflate:
- `MAX_BBOX_AREA_DEG2` (default 4.0): user-facing API guard, validated in `BBox.validate_area()`
- `OVERPASS_TILE_DEG2` (default 0.25): internal chunking threshold for Overpass requests

Raising the former without tuning the latter and JVM heap risks OOM and Overpass timeouts.
