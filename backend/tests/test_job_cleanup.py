import os
import time

from app.services.job_cleanup import cleanup_old_jobs


def _make_job(root, name, age_seconds):
    path = root / name
    path.mkdir()
    (path / "gmapsupp.img").write_bytes(b"x")
    ts = time.time() - age_seconds
    os.utime(path, (ts, ts))
    return path


def test_removes_only_expired_job_dirs(tmp_path):
    old = _make_job(tmp_path, "old", 48 * 3600)
    fresh = _make_job(tmp_path, "fresh", 60)

    removed = cleanup_old_jobs(str(tmp_path), retention_hours=24)

    assert removed == 1
    assert not old.exists()
    assert fresh.exists()


def test_ignores_files_and_missing_root(tmp_path):
    stray = tmp_path / "stray.txt"
    stray.write_text("x")
    os.utime(stray, (0, 0))

    assert cleanup_old_jobs(str(tmp_path), retention_hours=1) == 0
    assert stray.exists()
    assert cleanup_old_jobs(str(tmp_path / "missing"), retention_hours=1) == 0


def test_zero_retention_disables_cleanup(tmp_path):
    old = _make_job(tmp_path, "old", 48 * 3600)

    assert cleanup_old_jobs(str(tmp_path), retention_hours=0) == 0
    assert old.exists()
