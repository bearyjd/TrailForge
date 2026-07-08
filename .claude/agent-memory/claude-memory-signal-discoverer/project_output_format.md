---
name: Output file conventions and download API
description: Job directory layout, output filename, and HTTP range-request support for downloads
type: project
---

Each Celery job gets its own directory at `DATA_DIR/<job_id>/`. The only output file the API serves is `gmapsupp.img` — any other filename is rejected with HTTP 400. The download endpoint implements HTTP Range support (206 Partial Content) with 1 MB chunks so large IMG files can be resumed if interrupted.

**Why:** Garmin devices expect the file named `gmapsupp.img`. Range support was added explicitly because IMG files can be large and transfers over slow connections were failing silently. The file size is included in the `/status` response so the UI can warn users about watch storage capacity.

**How to apply:** Do not rename the output file or add additional downloadable artifacts without updating both the whitelist check in `routes.py:download_file` and the status endpoint's `img_path` logic.
