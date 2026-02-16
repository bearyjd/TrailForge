"""Pydantic schemas for API request/response validation."""

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
