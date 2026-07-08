---
name: Docker Compose setup — two files, shared image
description: Dev vs prod compose file distinction, shared backend image for API and worker
type: project
---

`docker-compose.yml` is the standard file (includes `build:` directives for local dev). `docker-compose.prod.yml` is identical but omits `build:` — it pulls pre-built images from `ghcr.io/bearyjd/trailforge-*:latest`. The backend image is shared between the `backend` (API) and `worker` (Celery) services; the worker overrides `command` to run Celery with `--concurrency=2`.

**Why:** Separating prod from dev avoids accidentally building images in production. The shared image for API + worker reduces image count and ensures they always run identical code.

**How to apply:** When adding new environment variables, add them to both compose files. When changing the Celery concurrency, update the `worker` service `command` in both files. CI publishes to ghcr.io on pushes to main.
