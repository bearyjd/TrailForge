import pytest
from pydantic import ValidationError
from unittest.mock import patch

from app.models.schemas import BBox
from app.tasks.map_tasks import generate_map


def test_from_coords_pads_and_clamps():
    box = BBox.from_coords([89.9995, 89.9996], [179.9995, 179.9996], padding=0.001)
    assert box.north == 90.0 and box.east == 180.0
    assert box.south == pytest.approx(89.9985)


def test_from_coords_straight_trail_gets_nonzero_area():
    box = BBox.from_coords([10.0, 10.0], [20.0, 20.5])
    assert box.area_deg2() > 0


def test_from_coords_oversized_raises_value_error():
    with pytest.raises(ValueError, match="exceeds maximum"):
        BBox.from_coords([0.0, 50.0], [0.0, 50.0])


def test_from_coords_invalid_raises_validation_error():
    with pytest.raises(ValidationError):
        BBox.from_coords([float("nan"), 1.0], [200.0, 300.0])


@pytest.mark.parametrize(
    "bad",
    [
        {"south": 1.0, "west": 1.0, "north": 2.0},  # missing key
        {"south": 95.0, "west": 1.0, "north": 96.0, "east": 2.0},  # out of range
        {"south": 0.0, "west": 0.0, "north": 50.0, "east": 50.0},  # oversized
        {"south": 1.0, "west": 1.0, "north": 1.0, "east": 1.0},  # zero area
    ],
)
def test_generate_map_rejects_malformed_bbox_before_any_work(bad):
    with patch("app.tasks.map_tasks.download_osm_data") as dl, patch(
        "app.tasks.map_tasks.os.makedirs"
    ) as mk:
        with pytest.raises(ValueError):
            generate_map.run(bad)
    dl.assert_not_called()
    mk.assert_not_called()
