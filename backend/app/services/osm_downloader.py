"""Download raw OpenStreetMap data from the Overpass API.

Large bounding boxes are automatically split into smaller tiles and
downloaded individually, then merged with osmium into a single file.
"""

import math
import os
import subprocess
import time

import httpx
from app.config import OVERPASS_URL, OVERPASS_TILE_DEG2


def _build_query(south: float, west: float, north: float, east: float) -> str:
    """Build an Overpass QL query for a single bbox tile."""
    return f"""
    [out:xml][timeout:300];
    (
      node({south},{west},{north},{east});
      way({south},{west},{north},{east});
      relation({south},{west},{north},{east});
    );
    (._;>;);
    out meta;
    """


def _compute_tiles(bbox: dict, max_tile_area: float) -> list[dict]:
    """Split a bounding box into tiles no larger than max_tile_area deg².

    Divides latitude and longitude spans into an even grid where each
    cell is approximately max_tile_area in size.

    Args:
        bbox: Dict with south, west, north, east.
        max_tile_area: Maximum tile area in square degrees.

    Returns:
        List of bbox dicts covering the original area.
    """
    south, west = bbox["south"], bbox["west"]
    north, east = bbox["north"], bbox["east"]

    lat_span = north - south
    lon_span = east - west
    total_area = lat_span * lon_span

    if total_area <= max_tile_area:
        return [bbox]

    # Compute grid dimensions that keep each tile under the limit.
    # Use the aspect ratio to distribute tiles proportionally.
    num_tiles = math.ceil(total_area / max_tile_area)
    aspect = lon_span / lat_span if lat_span > 0 else 1
    n_lat = max(1, round(math.sqrt(num_tiles / aspect)))
    n_lon = max(1, round(math.sqrt(num_tiles * aspect)))

    # Ensure we actually have enough tiles
    while n_lat * n_lon < num_tiles:
        if n_lat <= n_lon:
            n_lat += 1
        else:
            n_lon += 1

    lat_step = lat_span / n_lat
    lon_step = lon_span / n_lon

    tiles = []
    for i in range(n_lat):
        for j in range(n_lon):
            tiles.append({
                "south": south + i * lat_step,
                "west": west + j * lon_step,
                "north": min(south + (i + 1) * lat_step, north),
                "east": min(west + (j + 1) * lon_step, east),
            })
    return tiles


def _download_tile(tile: dict, output_path: str) -> None:
    """Download a single Overpass tile to a file.

    Retries once after a 5-second pause if the first attempt fails,
    to handle Overpass rate limiting gracefully.
    """
    query = _build_query(tile["south"], tile["west"], tile["north"], tile["east"])

    for attempt in range(2):
        try:
            with httpx.Client(timeout=360) as client:
                resp = client.post(OVERPASS_URL, data={"data": query})
                resp.raise_for_status()
            with open(output_path, "wb") as f:
                f.write(resp.content)
            return
        except (httpx.HTTPError, httpx.TimeoutException):
            if attempt == 0:
                time.sleep(5)
            else:
                raise


def download_osm_data(bbox: dict, job_dir: str, progress_callback=None) -> str:
    """Fetch OSM data for a bounding box, tiling large areas automatically.

    If the bbox exceeds OVERPASS_TILE_DEG2, it is split into a grid of
    smaller tiles. Each tile is downloaded separately and then merged
    with ``osmium merge`` into a single ``.osm`` file.

    Args:
        bbox: Dict with keys ``south``, ``west``, ``north``, ``east``.
        job_dir: Working directory for this job's intermediate files.
        progress_callback: Optional callable(message: str) for status updates.

    Returns:
        Absolute path to the downloaded/merged ``.osm`` file.

    Raises:
        httpx.HTTPStatusError: If the Overpass API returns an error.
        ValueError: If the downloaded data is too small.
        RuntimeError: If osmium merge fails.
    """
    tiles = _compute_tiles(bbox, OVERPASS_TILE_DEG2)
    output_path = os.path.join(job_dir, "map.osm")

    if len(tiles) == 1:
        # Single tile — download directly
        if progress_callback:
            progress_callback("Downloading OSM data...")
        _download_tile(tiles[0], output_path)
    else:
        # Multiple tiles — download each, then merge
        tile_dir = os.path.join(job_dir, "tiles")
        os.makedirs(tile_dir, exist_ok=True)
        tile_files = []

        for idx, tile in enumerate(tiles, 1):
            if progress_callback:
                progress_callback(f"Downloading tile {idx}/{len(tiles)}...")
            tile_path = os.path.join(tile_dir, f"tile_{idx:03d}.osm")
            _download_tile(tile, tile_path)
            tile_files.append(tile_path)

            # Brief pause between tiles to respect Overpass rate limits
            if idx < len(tiles):
                time.sleep(1)

        # Merge all tiles into one file
        if progress_callback:
            progress_callback(f"Merging {len(tiles)} tiles...")
        cmd = ["osmium", "merge"] + tile_files + ["-o", output_path, "--overwrite"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise RuntimeError(f"osmium merge failed: {result.stderr}")

    if os.path.getsize(output_path) < 100:
        raise ValueError("Downloaded OSM data is too small — area may be empty")

    return output_path
