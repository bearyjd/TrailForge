# Contributing

Thanks for your interest in contributing to TrailForge! Here's how to get started.

## Development Setup

### Prerequisites

- Docker and Docker Compose (or Podman with docker-compose compatibility)
- Node.js 22+ (for frontend development outside Docker)
- Python 3.12+ (for backend development outside Docker)

### Running Locally

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/trailforge.git
cd trailforge

# Build and start all services
docker-compose build
docker-compose up
```

The frontend will be available at `http://localhost:3000` and the backend API at `http://localhost:8000`.

### Running Outside Docker

If you prefer developing without Docker (faster iteration):

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# You'll need Redis running locally
uvicorn app.main:app --reload --port 8000

# In a separate terminal, start the Celery worker
celery -A app.tasks.celery_app:celery_app worker --loglevel=info
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Note: Running outside Docker means you need mkgmap, splitter, and osmium-tool installed locally for the worker to function.

## Project Structure

See the [README](README.md#project-structure) for a full directory listing.

Key points:
- **Backend** is a FastAPI app in `backend/app/` with Celery tasks for async processing
- **Frontend** is a React app in `frontend/src/` using Leaflet for the map
- Leaflet and leaflet-draw are loaded from CDN (not npm) to avoid bundler issues

## How to Contribute

### Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS information
- Docker logs if relevant (use `docker-compose logs worker` for pipeline errors)

### Suggesting Features

Open an issue describing:
- The use case or problem you're trying to solve
- Your proposed solution (if any)
- Any alternative approaches you considered

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test locally with `docker-compose build && docker-compose up`
5. Submit a pull request

### Code Style

**Python (backend):**
- Follow PEP 8
- Use Google-style docstrings
- Type hints for function signatures

**JavaScript (frontend):**
- JSDoc comments on exported functions and components
- Functional components with hooks (no class components)

## Common Development Tasks

### Adding a New API Endpoint

1. Add the Pydantic model to `backend/app/models/schemas.py`
2. Add the route handler to `backend/app/api/routes.py`
3. Update the API client in `frontend/src/api/client.js`

### Modifying the Map Generation Pipeline

1. Edit services in `backend/app/services/` (osm_downloader.py, map_compiler.py)
2. Update the task orchestration in `backend/app/tasks/map_tasks.py`
3. If adding new tools, update `backend/Dockerfile` to install them

### Changing the Map UI

1. Map interaction is in `frontend/src/components/MapSelector.jsx`
2. Leaflet is loaded from CDN in `frontend/index.html` — update versions there
3. Styles are in `frontend/src/App.css`

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Leaflet from CDN, not npm | leaflet-draw has known bundler compatibility issues |
| Celery + Redis | Simple async task queue that handles long-running map compilation |
| osmium XML→PBF conversion | Dramatically reduces memory usage for splitter and mkgmap |
| Single `gmapsupp.img` output | Most compatible format for Garmin devices |
| Overpass API for downloads | No need to host full planet extracts; works for small areas |
