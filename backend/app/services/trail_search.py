"""Query the Overpass API for trails within a bounding box.

Returns a GeoJSON FeatureCollection of named trails, with difficulty,
distance, and trail type derived from OSM tags.
"""

import math
import httpx
from app.config import OVERPASS_URL, OVERPASS_MIRRORS
from app.models.trail_schemas import TrailFeature, TrailSearchResponse

_SAC_DIFFICULTY: dict[str, str] = {
    "hiking": "easy",
    "mountain_hiking": "moderate",
    "demanding_mountain_hiking": "moderate",
    "alpine_hiking": "hard",
    "demanding_alpine_hiking": "hard",
    "difficult_alpine_hiking": "hard",
}


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in metres between two lat/lon points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _compute_length_m(geometry: list[dict]) -> float:
    """Sum Haversine distances along an ordered list of {lat, lon} points."""
    total = 0.0
    for i in range(len(geometry) - 1):
        p1, p2 = geometry[i], geometry[i + 1]
        total += _haversine_distance(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
    return total


def _difficulty(tags: dict) -> str:
    """Map OSM sac_scale tag to easy / moderate / hard."""
    return _SAC_DIFFICULTY.get(tags.get("sac_scale", ""), "easy")


def _trail_type(tags: dict) -> str:
    """Derive trail type (hiking / running / biking) from OSM tags."""
    route = tags.get("route", "")
    if route == "bicycle" or tags.get("bicycle") == "yes":
        return "biking"
    if route == "running":
        return "running"
    return "hiking"


def _way_to_feature(element: dict) -> TrailFeature:
    """Convert a single Overpass way element to a TrailFeature."""
    tags = element.get("tags", {})
    geom = element.get("geometry", [])
    coordinates = [[p["lon"], p["lat"]] for p in geom]
    return TrailFeature(
        id=f"way_{element['id']}",
        name=tags.get("name", "Unnamed Trail"),
        difficulty=_difficulty(tags),
        distance_m=_compute_length_m(geom),
        elevation_gain_m=None,  # requires DEM — deferred to sub-project 2
        trail_type=_trail_type(tags),
        description=tags.get("description") or tags.get("note"),
        geometry={"type": "LineString", "coordinates": coordinates},
    )


def _build_search_query(south: float, west: float, north: float, east: float) -> str:
    return f"""
    [out:json][timeout:60][bbox:{south},{west},{north},{east}];
    (
      way["highway"~"^(footway|path|track)$"]["name"];
      way["route"~"^(hiking|running|bicycle)$"]["name"];
    );
    out geom;
    """


def search_trails(
    south: float, west: float, north: float, east: float
) -> TrailSearchResponse:
    """Fetch named trails within a bbox from the Overpass API.

    Returns a TrailSearchResponse (GeoJSON FeatureCollection).
    Raises httpx.HTTPError on network failure.
    """
    query = _build_search_query(south, west, north, east)
    urls = [OVERPASS_URL] + list(OVERPASS_MIRRORS)

    last_exc: Exception | None = None
    for url in urls:
        try:
            with httpx.Client(timeout=60) as client:
                resp = client.post(url, data={"data": query})
                resp.raise_for_status()
            elements = resp.json().get("elements", [])
            features = [
                _way_to_feature(el)
                for el in elements
                if el.get("type") == "way" and el.get("geometry")
            ]
            return TrailSearchResponse(features=features)
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            last_exc = exc
            continue

    raise last_exc  # type: ignore[misc]


def fetch_trail(trail_id: str) -> TrailFeature | None:
    """Fetch a single trail by ID (e.g. 'way_123456') from Overpass.

    Returns None if the element is not found.
    """
    if not trail_id.startswith("way_"):
        return None
    osm_id = trail_id.removeprefix("way_")
    query = f"[out:json]; way({osm_id}); out geom;"

    with httpx.Client(timeout=30) as client:
        resp = client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()

    elements = resp.json().get("elements", [])
    if not elements or not elements[0].get("geometry"):
        return None
    return _way_to_feature(elements[0])
