"""Celery task that orchestrates the full OSM-to-Garmin-IMG pipeline."""

import logging
import os

from app.config import DATA_DIR, JOB_RETENTION_HOURS
from app.tasks.celery_app import celery_app
from app.services.osm_downloader import download_osm_data
from app.services.job_cleanup import cleanup_old_jobs, mark_job_dir, touch_job_dir
from app.services.map_compiler import convert_to_pbf, run_splitter, run_mkgmap

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="generate_map")
def generate_map(self, bbox: dict):
    """Run the end-to-end map generation pipeline for a bounding box.

    Pipeline steps:
        1. Download raw OSM XML from Overpass API.
        2. Convert XML to PBF (smaller, faster for downstream tools).
        3. Split the PBF into map tiles with splitter.
        4. Compile tiles into a single Garmin ``gmapsupp.img`` with mkgmap.

    Args:
        bbox: Dict with keys ``south``, ``west``, ``north``, ``east``.

    Returns:
        Dict with key ``filename`` on success.

    Raises:
        FileNotFoundError: If mkgmap does not produce the expected output.
    """
    # Expire old job directories (including failed ones kept for debugging)
    try:
        cleanup_old_jobs(DATA_DIR, JOB_RETENTION_HOURS)
    except Exception:
        logger.warning("Old-job cleanup failed; continuing", exc_info=True)

    job_dir = os.path.join(DATA_DIR, self.request.id)
    os.makedirs(job_dir, exist_ok=True)
    mark_job_dir(job_dir)

    try:
        # Step 1: Fetch OSM data from the Overpass API (auto-tiles large areas)
        def on_progress(msg):
            touch_job_dir(job_dir)  # dir mtime drives retention; keep running jobs fresh
            self.update_state(state="PROGRESS", meta={"step": msg})

        on_progress("Downloading OSM data...")
        osm_file = download_osm_data(bbox, job_dir, progress_callback=on_progress)

        # Step 2: Convert .osm XML to .osm.pbf for lower memory usage
        on_progress("Converting to PBF...")
        pbf_file = convert_to_pbf(osm_file, job_dir)
        touch_job_dir(job_dir)

        # Step 3: Split the PBF into manageable tile chunks
        on_progress("Splitting map tiles...")
        run_splitter(pbf_file, job_dir)
        touch_job_dir(job_dir)

        # Step 4: Compile split tiles into the final Garmin IMG file
        on_progress("Compiling Garmin IMG...")
        run_mkgmap(job_dir)
        touch_job_dir(job_dir)

        img_path = os.path.join(job_dir, "gmapsupp.img")
        if not os.path.isfile(img_path):
            raise FileNotFoundError("mkgmap did not produce gmapsupp.img")

        return {"filename": "gmapsupp.img"}

    except Exception as e:
        # Keep the job directory for post-mortem debugging; retention cleanup expires it
        raise e
