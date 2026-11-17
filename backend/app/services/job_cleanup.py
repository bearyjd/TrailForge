"""Retention-based cleanup of per-job output directories."""

import logging
import os
import shutil
import time

logger = logging.getLogger(__name__)


def cleanup_old_jobs(data_dir: str, retention_hours: float) -> int:
    """Delete job directories under ``data_dir`` older than the retention window.

    Args:
        data_dir: Root directory containing one sub-directory per job.
        retention_hours: Maximum age in hours; ``<= 0`` disables cleanup.

    Returns:
        Number of job directories removed.
    """
    if retention_hours <= 0 or not os.path.isdir(data_dir):
        return 0

    cutoff = time.time() - retention_hours * 3600
    removed = 0
    for entry in os.scandir(data_dir):
        if not entry.is_dir(follow_symlinks=False):
            continue
        try:
            if entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry.path)
                removed += 1
        except OSError:
            logger.warning("Failed to clean up job directory %s", entry.path, exc_info=True)
    return removed
