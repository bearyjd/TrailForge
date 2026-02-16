"""Celery application instance and worker configuration."""

from celery import Celery
from app.config import REDIS_URL

celery_app = Celery(
    "garmin_maps",
    broker=REDIS_URL,
    backend=REDIS_URL,
    # Auto-discover task modules so the worker registers all tasks on startup
    include=["app.tasks.map_tasks"],
)

celery_app.conf.update(
    task_serializer="json",          # Use JSON for safe cross-language compat
    result_serializer="json",
    accept_content=["json"],         # Reject pickle payloads for security
    task_track_started=True,         # Emit STARTED state so the UI can show progress
    task_time_limit=600,             # Hard kill after 10 minutes
    task_soft_time_limit=540,        # Raise SoftTimeLimitExceeded at 9 minutes
)
