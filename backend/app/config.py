"""Application configuration loaded from environment variables.

All settings have sensible defaults for running inside the Docker Compose stack.
Override via environment variables in production or .env files in development.
"""

import logging
import math
import os

# Redis connection used as both Celery broker and result backend
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Root directory where per-job working directories are created
DATA_DIR = os.getenv("DATA_DIR", "/data/jobs")

DEFAULT_JOB_RETENTION_HOURS = 24.0


def parse_retention_hours(raw: str | None) -> float:
    """Parse JOB_RETENTION_HOURS; fall back to the default (with a warning) if unusable."""
    if raw is None:
        return DEFAULT_JOB_RETENTION_HOURS
    try:
        value = float(raw)
    except ValueError:
        value = math.nan
    if not math.isfinite(value) or value <= 0:
        logging.getLogger(__name__).warning(
            "Invalid JOB_RETENTION_HOURS=%r (need a positive number); using %s",
            raw,
            DEFAULT_JOB_RETENTION_HOURS,
        )
        return DEFAULT_JOB_RETENTION_HOURS
    return value


# Hours to keep job directories before they are deleted
JOB_RETENTION_HOURS = parse_retention_hours(os.getenv("JOB_RETENTION_HOURS"))

# Path to the mkgmap JAR (converts OSM data to Garmin IMG format)
MKGMAP_JAR = os.getenv("MKGMAP_JAR", "/opt/mkgmap/mkgmap.jar")

# Path to the splitter JAR (splits large OSM files into tileable chunks)
SPLITTER_JAR = os.getenv("SPLITTER_JAR", "/opt/splitter/splitter.jar")

# Overpass API endpoint for downloading raw OSM data
OVERPASS_URL = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")

# Comma-separated list of fallback Overpass mirrors used when the primary times out
OVERPASS_MIRRORS = [
    url.strip()
    for url in os.getenv(
        "OVERPASS_MIRRORS",
        "https://overpass.kumi.systems/api/interpreter,"
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
    ).split(",")
    if url.strip()
]

# Maximum bounding-box area in square degrees (~40,000 km² at mid-latitudes)
MAX_BBOX_AREA_DEG2 = float(os.getenv("MAX_BBOX_AREA_DEG2", "4.0"))

# Maximum area per Overpass tile — large requests are split into tiles of this size
OVERPASS_TILE_DEG2 = float(os.getenv("OVERPASS_TILE_DEG2", "0.25"))
