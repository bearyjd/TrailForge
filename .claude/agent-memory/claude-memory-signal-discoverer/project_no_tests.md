---
name: Test coverage — none exists yet
description: No test suite exists as of initial release; this is an active gap
type: project
---

As of the initial 4-commit release, there are no tests — no pytest files, no test directory, no CI test step. The CI workflow only builds and publishes Docker images.

**Why:** This is a known gap, not a deliberate choice. The project is a fresh release.

**How to apply:** When writing tests, the natural seams for unit testing are: `BBox.validate_area()`, `_compute_tiles()` tiling math, `_parse_range()` HTTP range parsing, and `convert_to_pbf` / `run_splitter` / `run_mkgmap` with subprocess mocking. Integration tests would need real Overpass access or a local OSM fixture file. Use pytest per the Python stack conventions.
