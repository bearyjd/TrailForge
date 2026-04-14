"""Pydantic schemas for trail search, detail, and export responses."""

from typing import Any
from pydantic import BaseModel


class TrailFeature(BaseModel):
    """A single trail represented as a GeoJSON-compatible feature."""

    id: str                      # e.g. "way_123456" or "relation_789"
    name: str
    difficulty: str              # "easy" | "moderate" | "hard"
    distance_m: float            # total length in metres
    elevation_gain_m: float | None = None  # None until DEM integration
    trail_type: str              # "hiking" | "running" | "biking"
    description: str | None = None
    geometry: dict[str, Any]    # GeoJSON LineString geometry


class TrailSearchResponse(BaseModel):
    """GeoJSON FeatureCollection of trails matching a search query."""

    type: str = "FeatureCollection"
    features: list[TrailFeature]


class TrailDetail(TrailFeature):
    """Full trail detail — same as TrailFeature; extended in future sub-projects."""
    pass


class TrailExportResponse(BaseModel):
    """Response from the trail Garmin export endpoint."""

    job_id: str
    status: str
