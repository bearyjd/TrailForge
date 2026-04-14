import math
from unittest.mock import patch, MagicMock
from app.services.trail_search import (
    _haversine_distance,
    _compute_length_m,
    _difficulty,
    _trail_type,
    _way_to_feature,
    search_trails,
)


def test_haversine_distance_known_pair():
    # ~111km per degree of latitude
    d = _haversine_distance(0.0, 0.0, 1.0, 0.0)
    assert 110_000 < d < 112_000


def test_compute_length_m_two_points():
    geom = [{"lat": 0.0, "lon": 0.0}, {"lat": 1.0, "lon": 0.0}]
    length = _compute_length_m(geom)
    assert 110_000 < length < 112_000


def test_difficulty_sac_scale():
    assert _difficulty({"sac_scale": "hiking"}) == "easy"
    assert _difficulty({"sac_scale": "mountain_hiking"}) == "moderate"
    assert _difficulty({"sac_scale": "alpine_hiking"}) == "hard"
    assert _difficulty({}) == "easy"


def test_trail_type_defaults_to_hiking():
    assert _trail_type({}) == "hiking"
    assert _trail_type({"route": "bicycle"}) == "biking"
    assert _trail_type({"route": "running"}) == "running"
    assert _trail_type({"bicycle": "yes"}) == "biking"


def test_way_to_feature_basic():
    element = {
        "id": 999,
        "tags": {"name": "Ridge Path", "highway": "path"},
        "geometry": [{"lat": 47.0, "lon": 8.0}, {"lat": 47.01, "lon": 8.01}],
    }
    feature = _way_to_feature(element)
    assert feature.id == "way_999"
    assert feature.name == "Ridge Path"
    assert feature.difficulty == "easy"
    assert feature.trail_type == "hiking"
    assert feature.distance_m > 0
    assert feature.geometry["type"] == "LineString"


def test_search_trails_returns_features():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "elements": [
            {
                "type": "way",
                "id": 1,
                "tags": {"name": "Forest Trail", "highway": "path"},
                "geometry": [{"lat": 47.0, "lon": 8.0}, {"lat": 47.01, "lon": 8.01}],
            }
        ]
    }
    mock_response.raise_for_status = MagicMock()

    with patch("app.services.trail_search.httpx.Client") as MockClient:
        MockClient.return_value.__enter__.return_value.post.return_value = mock_response
        result = search_trails(south=46.9, west=7.9, north=47.1, east=8.1)

    assert len(result.features) == 1
    assert result.features[0].name == "Forest Trail"
