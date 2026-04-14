from app.models.trail_schemas import TrailFeature, TrailSearchResponse, TrailDetail

def test_trail_feature_serializes_geojson():
    feature = TrailFeature(
        id="way_123",
        name="Pine Ridge Trail",
        difficulty="moderate",
        distance_m=4200.0,
        elevation_gain_m=None,
        trail_type="hiking",
        description="A scenic ridge trail.",
        geometry={"type": "LineString", "coordinates": [[8.5, 47.1], [8.6, 47.2]]},
    )
    data = feature.model_dump()
    assert data["id"] == "way_123"
    assert data["geometry"]["type"] == "LineString"


def test_trail_search_response_wraps_features():
    resp = TrailSearchResponse(features=[])
    assert resp.type == "FeatureCollection"
    assert resp.features == []
