import os
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services import job_paths
from app.services.job_paths import OUTPUT_FILENAME, job_dir, output_path

client = TestClient(app)


def test_output_filename_is_mkgmap_default():
    assert OUTPUT_FILENAME == "gmapsupp.img"


def test_job_dir_and_output_path(tmp_path):
    with patch.object(job_paths, "DATA_DIR", str(tmp_path)):
        assert job_dir("abc") == os.path.join(str(tmp_path), "abc")
        assert output_path("abc") == os.path.join(str(tmp_path), "abc", OUTPUT_FILENAME)


def test_download_rejects_other_filename(tmp_path):
    with patch.object(job_paths, "DATA_DIR", str(tmp_path)):
        resp = client.get("/api/download/abc/other.img")
    assert resp.status_code == 400


def test_download_serves_output_file(tmp_path):
    (tmp_path / "abc").mkdir()
    (tmp_path / "abc" / OUTPUT_FILENAME).write_bytes(b"data")
    with patch.object(job_paths, "DATA_DIR", str(tmp_path)):
        resp = client.get(f"/api/download/abc/{OUTPUT_FILENAME}")
    assert resp.status_code == 200
    assert resp.content == b"data"
