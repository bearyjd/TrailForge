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

## Repo scope — two loosely-coupled products

This repo actually contains two products sharing infra, not one:

1. **OSM → Garmin map builder** — `backend/app/` (FastAPI + Celery) + `frontend/` (React/Vite). Draw a bbox, generate a `gmapsupp.img`.
2. **Trail discovery mobile app** — `mobile/` (Expo/React Native + Zustand). Search trails, view/save/record routes offline, community ratings/conditions.

They share exactly three HTTP routes: `GET /api/trails/search`, `GET /api/trails/{id}`, `POST /api/trails/{id}/export/garmin` (defined in `backend/app/api/trail_routes.py`, which calls back into the same `generate_map` Celery task as tier 1). Everything else in `mobile/` — auth, ratings, conditions, offline storage — talks **directly to Supabase**, not to this FastAPI backend. `backend/app/api/routes.py` (health/geocode/generate/status/download) is tier-1-only and mobile never calls it directly except via `pollJobStatus`/`exportTrailToGarmin` in `mobile/src/api/trailApi.ts`.

When fixing a bug, check which product it's in before touching shared code — e.g. changing `MAX_BBOX_AREA_DEG2` affects trail search validation in `trail_routes.py` too, since both reuse `app.config`.

### Community feature data model lives outside this repo's codebase

`trail_ratings` and `trail_conditions` tables plus their Row Level Security policies exist only in the managed Supabase project — the canonical schema is currently written as SQL inside `docs/superpowers/specs/2026-04-16-trailforge-community-design.md` (prose, not a migration file). There is no `supabase/migrations/` directory yet. If you need to reproduce a community-feature bug, you currently have to hand-copy that SQL into a local Supabase instance (`supabase start` via the Supabase CLI) — see `.agent_native/agent_roadmap.md` item 4 for the planned fix.

`elevation_gain_m` on trail features is *always* `None` by design — it requires DEM integration, deferred to a future sub-project (see `trail_search.py:_way_to_feature`). This is expected, not a bug.

## Build, lint, and test — verified commands

**Backend** (Python 3.12+ intended; verified working on 3.14):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt   # requirements.txt + pytest/celery/redis for testing
pytest -q
```

`requirements.txt` pins `pydantic>=2.10,<3` (widened from an exact `2.10.4` pin that had no prebuilt wheel and failed to build from source on Python 3.14 — PyO3 doesn't support 3.14 yet). `backend/pytest.ini` sets `pythonpath = .`, so `pytest` runs from `backend/` with no `PYTHONPATH` env var needed. Two of the test files (`test_trail_schemas.py`, `test_trail_search.py`) run without `celery` installed at all since they don't import `app.main`; only `test_trail_routes.py` needs the full dependency set.

**Frontend**: no test suite exists (`frontend/package.json` has no test script). `npm install && npm run build` (from `frontend/`) is the only currently-verifiable check.

**Mobile**: `cd mobile && npm install && npx jest` runs the Jest suite (47 test files, mocks for Expo/Supabase/MapLibre/AsyncStorage already set up in `mobile/jest.config.js` and `mobile/__mocks__/`).

**Do not run `docker-compose build`/`up`** as a verification step for routine changes — it requires network access to pull `mkgmap`/`splitter`/`osmium` and is not part of the fast feedback loop. Reserve it for changes to `backend/Dockerfile`, `frontend/Dockerfile`, or the compose files themselves.

## Test coverage gaps (read before "fixing" a pipeline bug)

`backend/tests/test_osm_downloader.py` and `backend/tests/test_map_compiler.py` cover the pipeline's pure logic and subprocess-argv-building (tiling math, retry/gateway-code classification, osmium/splitter/mkgmap command construction and error paths, `template.args` preference) with `subprocess.run` and the tile-download function mocked — no real network/Java needed. They do not cover actually running `osmium`/`splitter`/`mkgmap` against real data; that still requires the Docker pipeline. `trail_routes.py`, `trail_search.py`, `trail_schemas.py` remain covered by the original trail-search tests.
