"""Celery task that orchestrates the full OSM-to-Garmin-IMG pipeline."""

import os
import shutil

from app.config import DATA_DIR
from app.tasks.celery_app import celery_app
from app.services.osm_downloader import download_osm_data
from app.services.map_compiler import convert_to_pbf, run_splitter, run_mkgmap


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
    job_dir = os.path.join(DATA_DIR, self.request.id)
    os.makedirs(job_dir, exist_ok=True)

    try:
        # Step 1: Fetch OSM data from the Overpass API (auto-tiles large areas)
        def on_progress(msg):
            self.update_state(state="PROGRESS", meta={"step": msg})

        self.update_state(state="PROGRESS", meta={"step": "Downloading OSM data..."})
        osm_file = download_osm_data(bbox, job_dir, progress_callback=on_progress)

        # Step 2: Convert .osm XML to .osm.pbf for lower memory usage
        self.update_state(state="PROGRESS", meta={"step": "Converting to PBF..."})
        pbf_file = convert_to_pbf(osm_file, job_dir)

        # Step 3: Split the PBF into manageable tile chunks
        self.update_state(state="PROGRESS", meta={"step": "Splitting map tiles..."})
        run_splitter(pbf_file, job_dir)

        # Step 4: Compile split tiles into the final Garmin IMG file
        self.update_state(state="PROGRESS", meta={"step": "Compiling Garmin IMG..."})
        run_mkgmap(job_dir)

        img_path = os.path.join(job_dir, "gmapsupp.img")
        if not os.path.isfile(img_path):
            raise FileNotFoundError("mkgmap did not produce gmapsupp.img")

        return {"filename": "gmapsupp.img"}

    except Exception as e:
        # Keep the job directory around for post-mortem debugging
        raise e
