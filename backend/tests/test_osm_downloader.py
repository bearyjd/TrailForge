import httpx
import pytest

from app.services.osm_downloader import _compute_tiles, _is_retriable, download_osm_data


def test_compute_tiles_single_tile_when_under_limit():
    bbox = {"south": 47.0, "west": 8.0, "north": 47.1, "east": 8.1}
    tiles = _compute_tiles(bbox, max_tile_area=1.0)
    assert tiles == [bbox]


def test_compute_tiles_splits_large_bbox_into_grid():
    bbox = {"south": 0.0, "west": 0.0, "north": 1.0, "east": 1.0}
    tiles = _compute_tiles(bbox, max_tile_area=0.25)

    assert len(tiles) >= 4
    for tile in tiles:
        area = (tile["north"] - tile["south"]) * (tile["east"] - tile["west"])
        assert area <= 0.25 + 1e-9


def test_compute_tiles_grid_covers_original_bbox_exactly():
    bbox = {"south": 10.0, "west": 20.0, "north": 12.0, "east": 24.0}
    tiles = _compute_tiles(bbox, max_tile_area=1.0)

    souths = [t["south"] for t in tiles]
    wests = [t["west"] for t in tiles]
    norths = [t["north"] for t in tiles]
    easts = [t["east"] for t in tiles]

    assert min(souths) == pytest.approx(bbox["south"])
    assert min(wests) == pytest.approx(bbox["west"])
    assert max(norths) == pytest.approx(bbox["north"])
    assert max(easts) == pytest.approx(bbox["east"])


def test_compute_tiles_handles_zero_lat_span():
    bbox = {"south": 5.0, "west": 0.0, "north": 5.0, "east": 2.0}
    tiles = _compute_tiles(bbox, max_tile_area=0.01)
    assert len(tiles) >= 1


def test_is_retriable_timeout_is_retriable():
    exc = httpx.TimeoutException("timed out")
    assert _is_retriable(exc) is True


@pytest.mark.parametrize("status_code", [502, 503, 504, 429])
def test_is_retriable_gateway_codes_are_retriable(status_code):
    request = httpx.Request("POST", "https://example.com")
    response = httpx.Response(status_code, request=request)
    exc = httpx.HTTPStatusError("gateway error", request=request, response=response)
    assert _is_retriable(exc) is True


def test_is_retriable_client_error_is_not_retriable():
    request = httpx.Request("POST", "https://example.com")
    response = httpx.Response(400, request=request)
    exc = httpx.HTTPStatusError("bad request", request=request, response=response)
    assert _is_retriable(exc) is False


def test_is_retriable_non_http_exception_is_not_retriable():
    assert _is_retriable(ValueError("not an http error")) is False


def test_download_osm_data_raises_on_undersized_output(tmp_path, monkeypatch):
    # Force a single-tile download that "succeeds" but writes a tiny file —
    # exercises the too-small-area guard without hitting the network.
    def fake_download_tile(tile, output_path):
        with open(output_path, "wb") as f:
            f.write(b"x")

    monkeypatch.setattr(
        "app.services.osm_downloader._download_tile", fake_download_tile
    )

    bbox = {"south": 47.0, "west": 8.0, "north": 47.01, "east": 8.01}
    with pytest.raises(ValueError, match="too small"):
        download_osm_data(bbox, str(tmp_path))


def test_download_osm_data_single_tile_returns_output_path(tmp_path, monkeypatch):
    def fake_download_tile(tile, output_path):
        with open(output_path, "wb") as f:
            f.write(b"x" * 200)

    monkeypatch.setattr(
        "app.services.osm_downloader._download_tile", fake_download_tile
    )

    bbox = {"south": 47.0, "west": 8.0, "north": 47.01, "east": 8.01}
    result = download_osm_data(bbox, str(tmp_path))
    assert result == str(tmp_path / "map.osm")
