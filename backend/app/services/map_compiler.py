"""Compile OSM data into Garmin-compatible IMG files.

This module wraps three command-line tools:

* **osmium** -- converts OSM XML to the compact PBF format.
* **splitter** -- divides a PBF file into tileable chunks.
* **mkgmap** -- compiles tiles into a single ``gmapsupp.img`` for Garmin devices.
"""

import os
import subprocess
import glob

from app.config import MKGMAP_JAR, SPLITTER_JAR


def convert_to_pbf(osm_file: str, job_dir: str) -> str:
    """Convert and sort .osm XML to .osm.pbf using osmium.

    Sorts by entity type and ID (required by splitter) and converts to
    PBF which is significantly smaller and faster for downstream tools.

    Args:
        osm_file: Path to the input ``.osm`` XML file.
        job_dir: Working directory where the PBF file will be written.

    Returns:
        Absolute path to the generated ``.osm.pbf`` file.

    Raises:
        RuntimeError: If the osmium process exits with a non-zero code.
    """
    pbf_file = os.path.join(job_dir, "map.osm.pbf")
    # "osmium sort" sorts by type then ID — splitter requires sorted input
    cmd = ["osmium", "sort", osm_file, "-o", pbf_file, "--overwrite"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"osmium convert failed: {result.stderr}")
    return pbf_file


def run_splitter(osm_file: str, job_dir: str) -> None:
    """Split a PBF file into smaller tiles suitable for mkgmap.

    Outputs are written to a ``splitter_output/`` subdirectory inside
    *job_dir*, including a ``template.args`` file that mkgmap can consume.

    Args:
        osm_file: Path to the input ``.osm.pbf`` file.
        job_dir: Working directory for this job.

    Raises:
        RuntimeError: If the splitter process exits with a non-zero code.
    """
    splitter_dir = os.path.join(job_dir, "splitter_output")
    os.makedirs(splitter_dir, exist_ok=True)

    cmd = [
        "java", "-Xmx4g", "-jar", SPLITTER_JAR,
        f"--output-dir={splitter_dir}",
        osm_file,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"Splitter failed: {result.stderr}")


def run_mkgmap(job_dir: str) -> None:
    """Compile split PBF tiles into a single ``gmapsupp.img`` Garmin map file.

    If splitter produced a ``template.args`` file it is used as input;
    otherwise the PBF files are passed directly.

    Args:
        job_dir: Working directory containing the ``splitter_output/`` folder.

    Raises:
        FileNotFoundError: If no PBF tiles exist in the splitter output.
        RuntimeError: If mkgmap exits with a non-zero code.
    """
    splitter_dir = os.path.join(job_dir, "splitter_output")
    pbf_files = glob.glob(os.path.join(splitter_dir, "*.osm.pbf"))

    if not pbf_files:
        raise FileNotFoundError("No PBF tiles found from splitter")

    template_args = os.path.join(splitter_dir, "template.args")

    cmd = [
        "java", "-Xmx4g", "-jar", MKGMAP_JAR,
        "--gmapsupp",                   # Produce a single combined IMG
        f"--output-dir={job_dir}",
        "--route",                      # Enable routable map data
        "--add-pois-to-areas",          # Create POIs from area features
        "--index",                      # Build a searchable name index
        "--family-id=6324",
        "--series-name=OSM Garmin",
        "--family-name=OSM Garmin",
        "--description=Custom OSM Map",
    ]

    # Prefer template.args (preserves tile metadata) over raw file list
    if os.path.isfile(template_args):
        cmd += ["-c", template_args]
    else:
        cmd += pbf_files

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"mkgmap failed: {result.stderr}")
