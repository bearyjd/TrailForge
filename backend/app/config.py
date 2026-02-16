"""Application configuration loaded from environment variables.

All settings have sensible defaults for running inside the Docker Compose stack.
Override via environment variables in production or .env files in development.
"""

import os

# Redis connection used as both Celery broker and result backend
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Root directory where per-job working directories are created
DATA_DIR = os.getenv("DATA_DIR", "/data/jobs")

# Path to the mkgmap JAR (converts OSM data to Garmin IMG format)
MKGMAP_JAR = os.getenv("MKGMAP_JAR", "/opt/mkgmap/mkgmap.jar")

# Path to the splitter JAR (splits large OSM files into tileable chunks)
SPLITTER_JAR = os.getenv("SPLITTER_JAR", "/opt/splitter/splitter.jar")

# Overpass API endpoint for downloading raw OSM data
OVERPASS_URL = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")

# Maximum bounding-box area in square degrees (~40,000 km² at mid-latitudes)
MAX_BBOX_AREA_DEG2 = float(os.getenv("MAX_BBOX_AREA_DEG2", "4.0"))

# Maximum area per Overpass tile — large requests are split into tiles of this size
OVERPASS_TILE_DEG2 = float(os.getenv("OVERPASS_TILE_DEG2", "0.25"))
