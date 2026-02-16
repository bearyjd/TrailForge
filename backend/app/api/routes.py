"""REST API routes for map generation, status polling, and file downloads."""

import os
import re

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from app.config import DATA_DIR
from app.models.schemas import GenerateRequest, GenerateResponse, JobStatus
from app.tasks.map_tasks import generate_map

router = APIRouter()

# Chunk size for streaming downloads (1 MB)
DOWNLOAD_CHUNK_SIZE = 1024 * 1024

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_HEADERS = {"User-Agent": "TrailForge/1.0"}


@router.get("/health")
def health():
    """Return a simple health-check response."""
    return {"status": "ok"}


@router.get("/geocode")
def geocode(q: str):
    """Proxy geocoding requests to Nominatim with a proper User-Agent.

    This avoids CORS issues and respects Nominatim's usage policy which
    requires a descriptive User-Agent header.

    Args:
        q: Place name search query.

    Returns:
        List of geocoding results from Nominatim.
    """
    with httpx.Client(timeout=10, headers=NOMINATIM_HEADERS) as client:
        resp = client.get(NOMINATIM_URL, params={"format": "json", "q": q, "limit": 1})
        resp.raise_for_status()
    return resp.json()


@router.post("/generate", response_model=GenerateResponse)
def start_generation(req: GenerateRequest):
    """Validate the bounding box and enqueue a map-generation Celery task.

    Args:
        req: Request body containing a geographic bounding box.

    Returns:
        GenerateResponse with the Celery job ID and initial status.

    Raises:
        HTTPException: 400 if the bounding box area is invalid.
    """
    try:
        req.bbox.validate_area()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = generate_map.delay(req.bbox.model_dump())
    return GenerateResponse(job_id=result.id, status="queued")


@router.get("/status/{job_id}", response_model=JobStatus)
def get_status(job_id: str):
    """Poll the current state of a map-generation job.

    Args:
        job_id: Celery task ID returned by the /generate endpoint.

    Returns:
        JobStatus reflecting the current Celery task state.
    """
    result = generate_map.AsyncResult(job_id)

    if result.state == "PENDING":
        return JobStatus(job_id=job_id, status="queued")
    elif result.state == "PROGRESS":
        info = result.info or {}
        return JobStatus(
            job_id=job_id, status="processing", progress=info.get("step", "")
        )
    elif result.state == "SUCCESS":
        # Include file size so the UI can warn about watch storage
        img_path = os.path.join(DATA_DIR, job_id, "gmapsupp.img")
        file_size = os.path.getsize(img_path) if os.path.isfile(img_path) else None
        return JobStatus(
            job_id=job_id,
            status="completed",
            filename="gmapsupp.img",
            file_size=file_size,
        )
    elif result.state == "FAILURE":
        return JobStatus(
            job_id=job_id, status="failed", error=str(result.info)
        )
    else:
        return JobStatus(job_id=job_id, status=result.state.lower())


def _parse_range(range_header: str, file_size: int) -> tuple[int, int]:
    """Parse an HTTP Range header and return (start, end) byte positions.

    Supports single range only: ``bytes=START-END`` or ``bytes=START-``.

    Raises:
        HTTPException: 416 if the range is invalid or unsatisfiable.
    """
    match = re.match(r"bytes=(\d+)-(\d*)", range_header)
    if not match:
        raise HTTPException(status_code=416, detail="Invalid Range header")

    start = int(match.group(1))
    end = int(match.group(2)) if match.group(2) else file_size - 1

    if start >= file_size or end >= file_size or start > end:
        raise HTTPException(
            status_code=416,
            detail="Range not satisfiable",
            headers={"Content-Range": f"bytes */{file_size}"},
        )
    return start, end


def _file_chunk_iterator(path: str, start: int, end: int):
    """Yield file data in chunks between byte offsets [start, end]."""
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = f.read(min(DOWNLOAD_CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/download/{job_id}/{filename}")
def download_file(job_id: str, filename: str, request: Request):
    """Serve the compiled Garmin IMG file with HTTP Range support.

    Supports resumable downloads: clients can send a ``Range`` header to
    request a specific byte range and resume interrupted transfers.

    Args:
        job_id: Celery task ID identifying the job directory.
        filename: Must be ``gmapsupp.img``; any other value is rejected.
        request: FastAPI request object (for reading the Range header).

    Returns:
        Full FileResponse (200) or partial StreamingResponse (206).

    Raises:
        HTTPException: 400 for invalid filename, 404 if file is missing,
            416 if the Range header is unsatisfiable.
    """
    if filename != "gmapsupp.img":
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_path = os.path.join(DATA_DIR, job_id, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")

    # Full download — no Range header
    if not range_header:
        return FileResponse(
            file_path,
            media_type="application/octet-stream",
            filename=filename,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
            },
        )

    # Partial download — respond with 206
    start, end = _parse_range(range_header, file_size)
    content_length = end - start + 1

    return StreamingResponse(
        _file_chunk_iterator(file_path, start, end),
        status_code=206,
        media_type="application/octet-stream",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(content_length),
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
