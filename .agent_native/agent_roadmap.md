# TrailForge — Agent-Native Roadmap

Goal: an AI coding agent can pick up a raw bug report or feature request, reproduce it, implement a fix, test it, and verify correctness with minimal human input.

Ranked by **Human-Attention-Saved per Unit of Effort** (HASpUE) — items a human currently has to intervene on manually, divided by how cheap they are to fix.

All findings below were verified directly against the repo on 2026-07-07 (commands actually run, not inferred).

---

## Top 5 — immediately actionable

### 1. ✅ DONE (2026-07-07) — `backend/requirements.txt` cannot install on the pinned Python version — every agent run silently blocked at step 0

**Evidence:** `pip install -r backend/requirements.txt` in a fresh venv fails: `pydantic==2.10.4` has no prebuilt wheel for Python 3.14 and its source build fails (`PyO3 0.22.6` does not support CPython 3.14 yet — `maturin failed`). The system Python in this environment is 3.14.5. A pinned, unpinned-adjacent version (`pydantic 2.12.5`, already present in user site-packages) installs and works fine.

**Why this matters for agents:** an autonomous agent's very first step on a bug report is almost always "set up a venv and install deps." If that fails, the agent has no path forward and will either hallucinate a fix without running anything, or stall. This is the single highest-leverage fix in the repo.

**Fix:**
- Widen the pin to `pydantic>=2.10,<3` (or bump the floor to a version with 3.14 wheels) in `backend/requirements.txt`.
- Add a `backend/requirements-dev.txt` (or a `[project.optional-dependencies].dev` in a new `pyproject.toml`) containing `pytest`, `celery[redis]`, `redis` so a single `pip install -r requirements-dev.txt` gives a fully test-capable environment without Docker.
- Document the exact supported Python version(s) in CLAUDE.md (see item — already added, see the CLAUDE.md diff).

**Acceptance criteria:** `python3 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt -r backend/requirements-dev.txt && PYTHONPATH=backend pytest backend/tests -q` succeeds with 0 collection errors on a clean machine, no Docker required.

**Files:** `backend/requirements.txt`, new `backend/requirements-dev.txt`, `CLAUDE.md`.

**Resolution:** Widened `pydantic==2.10.4` to `pydantic>=2.10,<3` in `backend/requirements.txt`. Added `backend/requirements-dev.txt` (`-r requirements.txt` plus `pytest`, `celery[redis]`, `redis`). Verified with a fresh venv on the system Python 3.14.5: `python3 -m venv .venv && pip install -r backend/requirements-dev.txt` installs cleanly (resolved `pydantic-2.13.4`), and `python -c "import app.main; import app.services.osm_downloader; import app.services.map_compiler; import app.services.trail_search"` succeeds with no errors.

---

### 2. ✅ DONE (2026-07-07) — No `pytest.ini`/`conftest.py` — tests only pass with a hand-set `PYTHONPATH`, and this isn't written down anywhere

**Evidence:** `cd backend && pytest tests/` fails with `ModuleNotFoundError: No module named 'app'` because nothing adds `backend/` to `sys.path`. It only works with `PYTHONPATH=backend pytest backend/tests` (or `cd backend && PYTHONPATH=. pytest tests/`). This isn't in CLAUDE.md, CONTRIBUTING.md, or the README's test instructions — there effectively are **no test-running instructions anywhere in the repo**.

**Why this matters:** an agent asked to "add a test and make sure it passes" has to rediscover this by trial and error every single time, burning turns on `ModuleNotFoundError` before it even gets to real work.

**Fix:** Add `backend/pytest.ini`:
```ini
[pytest]
pythonpath = .
testpaths = tests
```
Then document the one-liner `cd backend && pytest` in CLAUDE.md (done — see CLAUDE.md diff) and README.

**Acceptance criteria:** `cd backend && pytest` passes with no `PYTHONPATH` env var set.

**Files:** new `backend/pytest.ini`.

**Resolution:** Added `backend/pytest.ini` with `pythonpath = .` and `testpaths = tests`. Verified `cd backend && pytest -q` passes with no `PYTHONPATH` set in the environment.

---

### 3. ✅ DONE (2026-07-07) — The core map-generation pipeline (the actual product) has zero test coverage; only the newer trail-search feature is tested

**Evidence:** `backend/tests/` contains exactly 3 files — `test_trail_routes.py`, `test_trail_schemas.py`, `test_trail_search.py` — covering only the trail-discovery sub-feature added later. `osm_downloader.py` (tiling math, retry/mirror fallback, `osmium merge`), `map_compiler.py` (`osmium sort`, splitter, mkgmap subprocess wrapping), and `map_tasks.py` (the Celery orchestration + error handling) have **no tests at all**. These are exactly the modules a bug report about "map generation failed" or "Garmin file is corrupt" would touch — and an agent has no regression harness to verify a fix against.

**Why this matters:** this is the highest-value area for an agent's self-verification loop. Without it, "did my fix work" for the actual core feature can only be checked by running the full Docker pipeline against live Overpass/mkgmap/splitter — which the audit was explicitly told not to do, and which a bug-fixing agent shouldn't need to do for every iteration either.

**Fix:** Add `backend/tests/test_osm_downloader.py` (unit-test `_compute_tiles` grid math and `_is_retriable` classification — pure functions, no subprocess needed) and `backend/tests/test_map_compiler.py` (mock `subprocess.run` to verify `convert_to_pbf`/`run_splitter`/`run_mkgmap` build the correct argv, handle non-zero exit codes, and prefer `template.args` when present — this is exactly the `.claude/agent-memory` note about mkgmap's template.args preference, now made verifiable instead of just documented in prose).

**Acceptance criteria:** new tests pass under `cd backend && pytest`; coverage of `services/osm_downloader.py` and `services/map_compiler.py` moves from 0% to covering the branching logic (tile math, retry/backoff, error paths) without invoking real Java/osmium binaries.

**Files:** new `backend/tests/test_osm_downloader.py`, new `backend/tests/test_map_compiler.py`.

**Resolution:** Added both files. `test_osm_downloader.py` covers `_compute_tiles` (single-tile passthrough, grid splitting, full-bbox coverage, zero-lat-span edge case) and `_is_retriable` (timeout, each gateway status code, non-retriable 4xx, non-HTTP exception), plus `download_osm_data`'s too-small-output guard and success path with `_download_tile` monkeypatched (no network). `test_map_compiler.py` mocks `subprocess.run` to assert exact argv for `convert_to_pbf`/`run_splitter`/`run_mkgmap`, non-zero-exit → `RuntimeError` for all three, `run_mkgmap`'s `FileNotFoundError` when no PBF tiles exist, and — the specific `template.args` preference behavior called out in this item — that `-c template.args` is used and the raw PBF list is *not* appended when `template.args` is present, versus the raw PBF list being passed when it's absent. Full suite (35 tests, up from 13) passes via `cd backend && pytest -q` with no real Java/osmium invoked.

---

### 4. Community feature's entire data model exists only as prose SQL inside a design doc — no migration files, no fixture, no way to stand up a test backend

**Evidence:** `mobile/src/stores/communityStore.ts` and the community components (`CommunityTab.tsx`, `StarRating.tsx`, etc.) call `supabase.from('trail_ratings')` / `trail_conditions` directly from the mobile app — there is no FastAPI backend involvement for this feature at all (confirmed: `backend/app/` has no ratings/conditions routes, models, or tables). The actual `CREATE TABLE` + Row Level Security policy SQL lives only inside `docs/superpowers/specs/2026-04-16-trailforge-community-design.md` as a markdown code block. A `grep` for `*.sql` or `migration` anywhere in the repo returns nothing. `mobile/__mocks__/@supabase/supabase-js.js` mocks the client in unit tests, so component/store tests pass today, but there is no way to reproduce a real bug report like "rating submission silently fails due to an RLS policy" without a human manually re-typing the SQL from the design doc into a Supabase project by hand.

**Why this matters:** this is the single biggest reproduction gap in the repo. A bug report against community features cannot be reproduced end-to-end by an agent at all right now — the schema is tribal knowledge trapped in prose.

**Fix:** Extract the SQL in that design doc into real, ordered migration files (e.g. `supabase/migrations/0001_trail_ratings.sql`, `0002_trail_conditions.sql`, `0003_rls_policies.sql`), and add a `supabase/README.md` documenting `supabase start` / `supabase db reset` for spinning up a local instance (Supabase CLI supports a fully local Docker-based stack — this does not require touching the hosted project). Point `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` at the local instance for tests.

**Acceptance criteria:** `supabase db reset` (local CLI) applies all migrations cleanly from empty; a smoke test can insert a rating via the anon key and confirm RLS blocks writes without auth and allows public reads.

**Files:** new `supabase/migrations/*.sql`, new `supabase/README.md`, `docs/superpowers/specs/2026-04-16-trailforge-community-design.md` (add a pointer to the real migration files instead of being the source of truth).

---

### 5. Zero fixtures/replay harness for the two things bug reports will actually be about: a bounding box and an OSM extract

**Evidence:** There is no sample `.osm`/`.pbf` file, no recorded Overpass response fixture, and no way to run `download_osm_data` / `map_compiler` functions against known-good input without hitting the live Overpass API and live mkgmap/splitter JARs (which requires the full Docker image). `backend/tests/test_trail_search.py` mocks `httpx` responses inline per-test but there's no shared fixture directory reusable across the pipeline tests this roadmap also proposes (item 3), and the mobile side has no recorded GPX fixture despite `mobile/src/utils/gpx.ts` and offline/recording stores existing.

**Why this matters:** almost every real bug report in this domain ("this trail doesn't show up," "this area fails to generate," "GPX import produces the wrong distance") is reproduced by feeding a specific bbox or GPX file through the pipeline. Without a fixture library, an agent must either hit live external services (flaky, rate-limited, non-deterministic, explicitly disallowed for this audit) or fabricate synthetic data that doesn't match the real bug.

**Fix:** Add `backend/tests/fixtures/` with 1–2 small recorded Overpass JSON responses (a real small-area query result, trimmed) and a tiny hand-built `.osm` XML sample (a few ways/nodes, valid enough for `osmium sort` to run against in a test). Add `mobile/src/__tests__/fixtures/sample.gpx` for `gpx.ts` round-trip tests. Document in CLAUDE.md that these are the canonical inputs for reproducing pipeline bugs offline.

**Acceptance criteria:** a new test can load `fixtures/small_area.osm` and run it through `convert_to_pbf` (real `osmium` binary, no network) to produce a valid `.pbf`, entirely offline.

**Files:** new `backend/tests/fixtures/*.json`, `backend/tests/fixtures/*.osm`, new `mobile/src/__tests__/fixtures/sample.gpx`.

---

## Full audit findings (beyond the top 5)

### A. Human-judgment chokepoints (tribal knowledge)

- The richest tribal knowledge in the repo already lives in `.claude/agent-memory/claude-memory-signal-discoverer/*.md` (pipeline order, Java tool flags, Overpass resilience design, bbox validation split, job error-handling policy, output format/Range support, Docker Compose dev/prod split). Most of this is now folded into the root `CLAUDE.md` (see diff) so it survives even if that agent-memory directory is pruned or not loaded.
- **Not yet codified anywhere:** the mobile app is a second, mostly independent product (Expo/React Native + Zustand + Supabase, trail discovery/community/offline-GPS/recording) layered on top of the original OSM→Garmin map builder (FastAPI/Celery + React/Vite). The two share only the `/api/trails/*` and `/api/generate` HTTP surface — nothing else. This split is invisible to a fresh agent unless they read every directory; CLAUDE.md previously described only tier 1. **Now added to CLAUDE.md.**
- **Not yet codified:** why `.env` in this workspace contains a real hostname (`maps.grepon.cc`) for `VITE_ALLOWED_HOSTS` — presumably a personal/staging deployment. Not a secret, but worth a one-line comment in `.env.example` clarifying this var is a Vite dev-server host allowlist, not an auth token, so an agent doesn't flag it as an exposed credential.
- **Not yet codified:** `elevation_gain_m` is deliberately always `None` on trail features — "requires DEM, deferred to sub-project 2" is a comment in `trail_search.py` but not mentioned in any planning doc's status/roadmap, so an agent fixing "elevation shows blank" would need to know this is expected-not-a-bug, not a missing calculation.

### B. Verification gaps

- No frontend (`frontend/`) tests exist at all — no Vitest/Jest config, no `package.json` test script, zero `*.test.*` files. The React/Vite tier (Leaflet map selection, area validation UI, job polling/download UI) is entirely unverified. Recommend adding Vitest + React Testing Library for `MapSelector`, `AreaInfo`, and `JobStatus` (polling state machine is a good pure-logic candidate).
- Mobile (`mobile/`) is comparatively well-covered — 47 test files under Jest with mocks for Expo/Supabase/MapLibre/AsyncStorage — but has no E2E/screenshot testing (no Detox/Maestro config found), so full user flows (auth → search → export → offline save) aren't verified end-to-end.
- No log-based or structured-error assertions anywhere: Celery task failures raise generic `RuntimeError`/`FileNotFoundError` with only `str(e)` surfaced through `/status/{job_id}`; there's no structured error taxonomy (e.g., `OverpassTimeoutError`, `MkgmapCompileError`) an agent could assert against programmatically instead of substring-matching error text.
- CI (`.github/workflows/docker-publish.yml`) only builds and pushes Docker images — there is no test-on-PR workflow at all. Recommend a second workflow running `pytest` (backend) and `jest` (mobile) on every PR before the image-publish step is ever reached.

### C. Reproduction paths

- Covered above (items 3, 4, 5) — the pipeline and community-data-model reproduction gaps are the dominant issue.
- Bug reports about a *specific real-world area* (e.g., "generating a map for Zermatt fails") cannot be replayed deterministically today since the pipeline always hits live Overpass. A `--replay-from-fixture` mode or an injectable `osm_downloader` fixture path (env var like `OSM_FIXTURE_OVERRIDE`) would let an agent reproduce a user's exact reported bbox from a one-time recorded snapshot instead of needing live network access on every debug iteration.

### D. Structural obstacles

- **Two products sharing one repo without a clear boundary doc:** the OSM/Garmin map-builder (backend + frontend) and the trail-discovery/community mobile app are only loosely coupled (mobile calls 3 of the backend's routes; everything else is Supabase-direct). This isn't necessarily wrong, but nothing in the repo states it explicitly, so an agent might assume changes to `backend/app/api/trail_routes.py` need to stay in lockstep with mobile screens that don't actually depend on most of it, or vice versa. Recommend a short `ARCHITECTURE.md` (or a section in README) with an explicit diagram of which tier owns which data and which calls cross the boundary — the community design spec (`docs/superpowers/specs/2026-04-16-...md`) already contains a good version of this diagram; it should be promoted to a top-level, always-loaded doc rather than left in `docs/superpowers/specs/`.
- `backend/app/tasks/map_tasks.py`'s `except Exception as e: raise e` is a no-op re-raise (same as no try/except at all) — harmless but slightly misleading to a reader/agent scanning for "where is cleanup skipped intentionally"; a comment referencing the `.claude/agent-memory` rationale (now also in CLAUDE.md) would make the intent explicit at the point of the code rather than only in a design-doc-adjacent memory file.
- No dependency direction enforcement between `backend/app/api` → `services` → `tasks`: `trail_routes.py` imports `generate_map` directly from `app.tasks.map_tasks`, coupling the trail-discovery route layer to the Celery task layer of the *other* sub-project. Not broken, but a future split of the two products into separate deployables would need to untangle this import.

---

## Suggested execution order

1. Fix `requirements.txt` pin (#1) — unblocks everything else.
2. Add `pytest.ini` (#2) — near-zero effort, immediate agent unblock.
3. Add pipeline unit tests (#3) — highest coverage ROI.
4. Extract Supabase migrations (#4) — unblocks community-feature reproduction.
5. Add fixtures (#5) — makes #3 and #4 fully offline-reproducible.
6. Frontend test harness, CI test workflow, structured error taxonomy, `ARCHITECTURE.md` — secondary wave once the top 5 are in place.
