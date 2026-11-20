"""Single source of truth for where a job's output lives on disk."""

import os

from app.config import DATA_DIR

# mkgmap's ``--gmapsupp`` flag emits a file with this fixed name; it is not
# configurable on our side, so run_mkgmap() and consumers must agree on it.
OUTPUT_FILENAME = "gmapsupp.img"


def job_dir(job_id: str) -> str:
    """Return the working directory for ``job_id``."""
    return os.path.join(DATA_DIR, job_id)


def output_path(job_id: str) -> str:
    """Return the path of the compiled Garmin IMG for ``job_id``."""
    return os.path.join(job_dir(job_id), OUTPUT_FILENAME)
