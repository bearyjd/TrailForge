import os
import time
from unittest.mock import patch

from app.services.job_cleanup import JOB_MARKER, cleanup_old_jobs, mark_job_dir


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
