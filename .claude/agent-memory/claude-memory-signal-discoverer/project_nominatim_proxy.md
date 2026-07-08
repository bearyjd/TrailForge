---
name: Nominatim geocoding proxied through backend
description: Why geocoding goes through the FastAPI backend rather than direct from the browser
type: project
---

The `/api/geocode` endpoint proxies place-name searches to Nominatim rather than calling it directly from the frontend.

**Why:** Two reasons — (1) CORS: Nominatim does not allow browser requests from arbitrary origins; (2) policy: Nominatim's usage policy requires a descriptive `User-Agent` header (`TrailForge/1.0`), which cannot be set by browser fetch without a proxy.

**How to apply:** Do not move geocoding to a direct frontend call. If switching geocoding providers, maintain the proxy pattern and set an appropriate `User-Agent`.
