"""Trail discovery API routes."""

from fastapi import APIRouter, HTTPException

from app.config import MAX_BBOX_AREA_DEG2
from app.models.schemas import BBox
from app.models.trail_schemas import TrailDetail, TrailExportResponse, TrailSearchResponse
from app.services.trail_search import fetch_trail, search_trails
from app.tasks.map_tasks import generate_map

_BBOX_PADDING_DEG = 0.001

router = APIRouter(prefix="/trails", tags=["trails"])


@router.get("/search", response_model=TrailSearchResponse)
def search(south: float, west: float, north: float, east: float):
    """Return trails within a bounding box.

    Validates bbox area against MAX_BBOX_AREA_DEG2, then queries Overpass.
    """
    area = abs(north - south) * abs(east - west)
    if area > MAX_BBOX_AREA_DEG2:
        raise HTTPException(
            status_code=400,
            detail=f"Bbox too large ({area:.2f} deg²). Zoom in and try again.",
        )
    return search_trails(south=south, west=west, north=north, east=east)


@router.get("/{trail_id}", response_model=TrailDetail)
def get_trail(trail_id: str):
    """Return full detail for a single trail by its OSM ID (e.g. 'way_123456')."""
    trail = fetch_trail(trail_id)
    if trail is None:
        raise HTTPException(status_code=404, detail="Trail not found")
    return trail


@router.post("/{trail_id}/export/garmin", response_model=TrailExportResponse)
def export_trail(trail_id: str):
    """Enqueue a Garmin export job for the given trail."""
    trail = fetch_trail(trail_id)
    if trail is None:
        raise HTTPException(status_code=404, detail="Trail not found")

    coords = trail.geometry["coordinates"]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    # Pad so short or straight trails (thin/zero-area boxes) still export;
    # only an oversized area is rejected.
    try:
        bbox = BBox(
            south=max(min(lats) - _BBOX_PADDING_DEG, -90.0),
            west=max(min(lons) - _BBOX_PADDING_DEG, -180.0),
            north=min(max(lats) + _BBOX_PADDING_DEG, 90.0),
            east=min(max(lons) + _BBOX_PADDING_DEG, 180.0),
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Trail has invalid coordinates")
    try:
        bbox.validate_area()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = generate_map.delay(bbox.model_dump())
    return TrailExportResponse(job_id=result.id, status="queued")
