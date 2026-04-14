from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.models.trail_schemas import TrailSearchResponse, TrailFeature, TrailDetail

client = TestClient(app)

_SAMPLE_FEATURE = TrailFeature(
    id="way_1",
    name="Oak Loop",
    difficulty="easy",
    distance_m=2100.0,
    elevation_gain_m=None,
    trail_type="hiking",
    description=None,
    geometry={"type": "LineString", "coordinates": [[8.5, 47.1], [8.6, 47.2]]},
)


def test_search_trails_returns_geojson():
    with patch("app.api.trail_routes.search_trails") as mock_search:
        mock_search.return_value = TrailSearchResponse(features=[_SAMPLE_FEATURE])
        resp = client.get("/api/trails/search?south=47.0&west=8.0&north=47.2&east=8.8")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 1
    assert data["features"][0]["name"] == "Oak Loop"


def test_search_trails_rejects_oversized_bbox():
    # Area = 5*5 = 25 deg² > MAX_BBOX_AREA_DEG2 (4.0)
    resp = client.get("/api/trails/search?south=40.0&west=0.0&north=45.0&east=5.0")
    assert resp.status_code == 400
    assert "too large" in resp.json()["detail"].lower()


def test_get_trail_found():
    with patch("app.api.trail_routes.fetch_trail") as mock_fetch:
        mock_fetch.return_value = TrailDetail(**_SAMPLE_FEATURE.model_dump())
        resp = client.get("/api/trails/way_1")
    assert resp.status_code == 200
    assert resp.json()["id"] == "way_1"


def test_get_trail_not_found():
    with patch("app.api.trail_routes.fetch_trail") as mock_fetch:
        mock_fetch.return_value = None
        resp = client.get("/api/trails/way_999")
    assert resp.status_code == 404


def test_export_trail_enqueues_job():
    with patch("app.api.trail_routes.fetch_trail") as mock_fetch, \
         patch("app.api.trail_routes.generate_map") as mock_task:
        mock_fetch.return_value = TrailDetail(**_SAMPLE_FEATURE.model_dump())
        mock_result = MagicMock()
        mock_result.id = "celery-job-abc"
        mock_task.delay.return_value = mock_result

        resp = client.post("/api/trails/way_1/export/garmin")
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == "celery-job-abc"
    assert data["status"] == "queued"
