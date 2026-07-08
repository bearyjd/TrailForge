---
name: Job error handling — intentionally no cleanup on failure
description: Failed job directories are preserved for post-mortem debugging
type: project
---

In `map_tasks.py`, the `except` block re-raises the exception without deleting `job_dir`. This is explicit — failed jobs leave their working directory intact under `DATA_DIR/<job_id>/`.

**Why:** The intermediate files (downloaded OSM XML, PBF, splitter tiles) are needed to diagnose what went wrong. Silent cleanup would destroy the debugging trail.

**How to apply:** Do not add cleanup logic to the failure path without providing an alternative way to inspect failed jobs (e.g., a separate cleanup command or TTL-based expiry). Successful jobs also retain their files — there is currently no expiry mechanism.
