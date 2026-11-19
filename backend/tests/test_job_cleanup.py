import os
import time

import pytest
from unittest.mock import patch

from app.services.job_cleanup import JOB_MARKER, cleanup_old_jobs, mark_job_dir, touch_job_dir


def _make_job(root, name, age_seconds, marked=True):
    path = root / name
    path.mkdir()
    (path / "gmapsupp.img").write_bytes(b"x")
    if marked:
        mark_job_dir(str(path))
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


def test_keeps_old_dirs_without_job_marker(tmp_path):
    foreign = _make_job(tmp_path, "lost+found", 48 * 3600, marked=False)
    other = _make_job(tmp_path, "someone-elses-data", 48 * 3600, marked=False)

    assert cleanup_old_jobs(str(tmp_path), retention_hours=24) == 0
    assert foreign.exists() and other.exists()


def test_marker_does_not_age_out_job_dir_itself(tmp_path):
    job = tmp_path / "job"
    job.mkdir()
    mark_job_dir(str(job))
    assert (job / JOB_MARKER).is_file()


def test_skips_symlinked_dirs(tmp_path):
    target = _make_job(tmp_path, "outside", 48 * 3600)
    root = tmp_path / "root"
    root.mkdir()
    (root / "link").symlink_to(target, target_is_directory=True)

    assert cleanup_old_jobs(str(root), retention_hours=24) == 0
    assert target.exists()


def test_rmtree_failure_is_tolerated(tmp_path):
    bad = _make_job(tmp_path, "bad", 48 * 3600)
    good = _make_job(tmp_path, "good", 48 * 3600)

    real_rmtree = __import__("shutil").rmtree

    def flaky(path, *a, **k):
        if path.endswith("bad"):
            raise OSError("nope")
        return real_rmtree(path, *a, **k)

    with patch("app.services.job_cleanup.shutil.rmtree", side_effect=flaky):
        assert cleanup_old_jobs(str(tmp_path), retention_hours=24) == 1
    assert bad.exists() and not good.exists()


def test_scandir_error_is_logged_not_raised(tmp_path):
    with patch("app.services.job_cleanup.os.scandir", side_effect=PermissionError("denied")):
        assert cleanup_old_jobs(str(tmp_path), retention_hours=24) == 0


def test_generate_map_survives_cleanup_failure(tmp_path):
    from app.tasks import map_tasks

    def fake_mkgmap(job_dir):
        (open(os.path.join(job_dir, "gmapsupp.img"), "wb")).close()

    with patch.object(map_tasks, "DATA_DIR", str(tmp_path)), \
         patch.object(map_tasks, "cleanup_old_jobs", side_effect=OSError("boom")), \
         patch.object(map_tasks, "download_osm_data", return_value="a.osm"), \
         patch.object(map_tasks, "convert_to_pbf", return_value="a.pbf"), \
         patch.object(map_tasks, "run_splitter"), \
         patch.object(map_tasks, "run_mkgmap", side_effect=fake_mkgmap), \
         patch.object(map_tasks.generate_map, "update_state"):
        result = map_tasks.generate_map.apply(args=[{"south": 0, "west": 0, "north": 1, "east": 1}])

    assert result.get() == {"filename": "gmapsupp.img"}
    job_dirs = [d for d in tmp_path.iterdir() if d.is_dir()]
    assert len(job_dirs) == 1 and (job_dirs[0] / JOB_MARKER).is_file()


def test_touch_job_dir_protects_a_running_job_from_cleanup(tmp_path):
    job = _make_job(tmp_path, "running", 48 * 3600)
    touch_job_dir(str(job))

    assert cleanup_old_jobs(str(tmp_path), retention_hours=1) == 0
    assert job.exists()


def test_touch_job_dir_ignores_missing_dir(tmp_path):
    touch_job_dir(str(tmp_path / "gone"))


def test_generate_map_refreshes_job_dir_mtime_on_progress(tmp_path):
    from app.tasks import map_tasks

    seen = []

    def fake_download(bbox, job_dir, progress_callback=None):
        old = time.time() - 48 * 3600
        os.utime(job_dir, (old, old))
        progress_callback("tile 1/9")
        seen.append(os.stat(job_dir).st_mtime)
        return "a.osm"

    def fake_mkgmap(job_dir):
        open(os.path.join(job_dir, "gmapsupp.img"), "wb").close()

    with patch.object(map_tasks, "DATA_DIR", str(tmp_path)), \
         patch.object(map_tasks, "download_osm_data", side_effect=fake_download), \
         patch.object(map_tasks, "convert_to_pbf", return_value="a.pbf"), \
         patch.object(map_tasks, "run_splitter"), \
         patch.object(map_tasks, "run_mkgmap", side_effect=fake_mkgmap), \
         patch.object(map_tasks.generate_map, "update_state"):
        map_tasks.generate_map.apply(args=[{"south": 0, "west": 0, "north": 1, "east": 1}]).get()

    assert time.time() - seen[0] < 60


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(None, 24.0), ("6", 6.0), ("", 24.0), ("abc", 24.0), ("0", 24.0), ("-3", 24.0), ("nan", 24.0), ("inf", 24.0)],
)
def test_parse_retention_hours_falls_back_safely(raw, expected, caplog):
    from app.config import parse_retention_hours

    assert parse_retention_hours(raw) == expected
    if raw not in (None, "6"):
        assert "JOB_RETENTION_HOURS" in caplog.text


def test_parse_retention_hours_raises_tiny_values_to_the_floor(caplog):
    from app.config import MIN_RETENTION_HOURS, parse_retention_hours

    assert MIN_RETENTION_HOURS == 1.0
    assert parse_retention_hours("0.01") == 1.0
    assert "JOB_RETENTION_HOURS" in caplog.text
    caplog.clear()
    assert parse_retention_hours("24") == 24.0
    assert parse_retention_hours("1") == 1.0
    assert caplog.text == ""


def test_generate_map_touches_job_dir_after_each_long_step(tmp_path):
    from app.tasks import map_tasks

    events = []

    def step(name, ret=None):
        def f(*a, **k):
            events.append(name)
            if name == "mkgmap":
                open(os.path.join(a[0], "gmapsupp.img"), "wb").close()
            return ret
        return f

    with patch.object(map_tasks, "DATA_DIR", str(tmp_path)), \
         patch.object(map_tasks, "touch_job_dir", side_effect=lambda d: events.append("touch")), \
         patch.object(map_tasks, "download_osm_data", side_effect=step("download", "a.osm")), \
         patch.object(map_tasks, "convert_to_pbf", side_effect=step("pbf", "a.pbf")), \
         patch.object(map_tasks, "run_splitter", side_effect=step("split")), \
         patch.object(map_tasks, "run_mkgmap", side_effect=step("mkgmap")), \
         patch.object(map_tasks.generate_map, "update_state"):
        map_tasks.generate_map.apply(args=[{"south": 0, "west": 0, "north": 1, "east": 1}]).get()

    for name in ("pbf", "split", "mkgmap"):
        assert events[events.index(name) + 1] == "touch", name
