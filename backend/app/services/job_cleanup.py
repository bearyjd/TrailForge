"""Retention-based cleanup of per-job output directories."""

import logging
import os
import shutil
import time

logger = logging.getLogger(__name__)

# Written into every job directory this app creates. Cleanup only deletes
# directories carrying it, so unrelated directories under DATA_DIR are safe.
JOB_MARKER = ".trailforge-job"


def mark_job_dir(job_dir: str) -> None:
    """Flag ``job_dir`` as created by this app so cleanup may expire it."""
    with open(os.path.join(job_dir, JOB_MARKER), "w"):
        pass


def touch_job_dir(job_dir: str) -> None:
    """Refresh ``job_dir``'s mtime so a long-running job is not expired mid-run."""
    try:
        os.utime(job_dir)
    except OSError:
        logger.warning("Failed to refresh mtime of %s", job_dir, exc_info=True)


def cleanup_old_jobs(data_dir: str, retention_hours: float) -> int:
    """Delete app-created job directories (see ``JOB_MARKER``) under ``data_dir`` older than the retention window.

    Args:
        data_dir: Root directory containing one sub-directory per job.
        retention_hours: Maximum age in hours; non-positive values are ignored (defence in depth; config never produces them).

    Returns:
        Number of job directories removed.
    """
    if retention_hours <= 0 or not os.path.isdir(data_dir):
        return 0

    cutoff = time.time() - retention_hours * 3600
    removed = 0
    try:
        entries = list(os.scandir(data_dir))
    except OSError:
        logger.warning("Failed to scan %s for old jobs", data_dir, exc_info=True)
        return 0
    for entry in entries:
        try:
            if not entry.is_dir(follow_symlinks=False):
                continue
            if not os.path.isfile(os.path.join(entry.path, JOB_MARKER)):
                continue
            if entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry.path)
                removed += 1
        except OSError:
            logger.warning("Failed to clean up job directory %s", entry.path, exc_info=True)
    return removed
