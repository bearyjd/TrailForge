"""Pydantic schemas for API request/response validation."""

from collections.abc import Sequence

from pydantic import BaseModel, field_validator
from app.config import MAX_BBOX_AREA_DEG2


class BBox(BaseModel):
    """Geographic bounding box defined by its four edges in decimal degrees."""

    south: float
    west: float
    north: float
    east: float

    @field_validator("south", "north")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        """Ensure latitude is within [-90, 90]."""
        if not -90 <= v <= 90:
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @field_validator("west", "east")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        """Ensure longitude is within [-180, 180]."""
        if not -180 <= v <= 180:
            raise ValueError("Longitude must be between -180 and 180")
        return v

    @classmethod
    def from_coords(
        cls, lats: Sequence[float], lons: Sequence[float], padding: float = 0.001
    ) -> "BBox":
        """Build a padded, area-validated bbox enclosing the given coordinates.

        Padding lets short or straight trails (thin/zero-area boxes) still
        export; edges are clamped to valid lat/lon. Raises ``ValueError``
        (``ValidationError`` for invalid coordinates) otherwise.
        """
        box = cls(
            south=max(min(lats) - padding, -90.0),
            west=max(min(lons) - padding, -180.0),
            north=min(max(lats) + padding, 90.0),
            east=min(max(lons) + padding, 180.0),
        )
        box.validate_area()
        return box

    def area_deg2(self) -> float:
        """Calculate the approximate area of the bounding box in square degrees."""
        return abs(self.north - self.south) * abs(self.east - self.west)

    def validate_area(self) -> None:
        """Raise ``ValueError`` if the area is too large or too small."""
        area = self.area_deg2()
        if area > MAX_BBOX_AREA_DEG2:
            raise ValueError(
                f"Selected area ({area:.4f} deg²) exceeds maximum "
                f"({MAX_BBOX_AREA_DEG2} deg²). Please select a smaller region."
            )
        if area < 1e-6:
            raise ValueError("Selected area is too small.")


class GenerateRequest(BaseModel):
    """POST body for the /generate endpoint."""

    bbox: BBox


class GenerateResponse(BaseModel):
    """Response returned when a map-generation job is successfully queued."""

    job_id: str
    status: str


class JobStatus(BaseModel):
    """Response returned by the /status endpoint for a given job."""

    job_id: str
    status: str
    progress: str | None = None
    error: str | None = None
    filename: str | None = None
    file_size: int | None = None
