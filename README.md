# TrailForge

Generate custom Garmin maps from OpenStreetMap data. Select any area on an interactive map, and TrailForge downloads the OSM data, processes it through the mkgmap toolchain, and produces a `gmapsupp.img` ready to load onto your Garmin watch or GPS (Fenix 7X, Edge, eTrex, etc.).

## Features

- **Interactive map selection** — Draw a bounding box on a Leaflet map to define the area you want
- **Place search** — Search for any location by name using OpenStreetMap Nominatim geocoding
- **Geolocation** — Jump to your current location with one click
- **Async processing** — Map generation runs in the background via Celery workers; poll for status in real time
- **Intelligent tiling** — Large areas are automatically split into smaller tiles, downloaded individually, and merged — supports regions up to 4 deg² (~40,000 km²)
- **Resumable downloads** — HTTP Range support lets you resume interrupted file downloads
- **Search history** — Recent searches are saved locally and persist across sessions
- **Full pipeline** — Downloads OSM data from the Overpass API, converts to PBF, splits tiles, and compiles a Garmin IMG file using mkgmap

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend   │────▶│   Worker    │
│  React/Vite  │     │   FastAPI   │     │   Celery    │
│  Leaflet     │◀────│   uvicorn   │◀────│             │
│  port 3000   │     │  port 8000  │     │  mkgmap     │
└─────────────┘     └─────────────┘     │  splitter   │
                           │             │  osmium     │
                           ▼             └──────┬──────┘
                    ┌─────────────┐             │
                    │    Redis    │◀────────────┘
                    │   broker    │
                    │  port 6379  │
                    └─────────────┘
```

| Service    | Role                                    | Tech                        |
|------------|-----------------------------------------|-----------------------------|
| `frontend` | Interactive map UI                      | React 18, Vite, Leaflet, leaflet-draw |
| `backend`  | REST API, file serving                  | Python 3.12, FastAPI, uvicorn |
| `worker`   | Async map generation pipeline           | Celery, mkgmap r4924, splitter r654, osmium-tool |
| `redis`    | Message broker + result backend         | Redis 7                     |

## Map Generation Pipeline

1. **Download** — Fetch raw OSM XML data from the Overpass API for the selected bounding box
2. **Convert** — Use `osmium-tool` to convert XML to PBF format (reduces memory usage significantly)
3. **Split** — Use `splitter` to divide the PBF into manageable tiles
4. **Compile** — Use `mkgmap` to compile tiles into a single `gmapsupp.img` Garmin map file

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (or Podman with docker-compose compatibility)
- At least 6 GB of available RAM (Java tools need ~4 GB heap)

### Run with pre-built images

Pre-built images are published to both **ghcr.io** and **Docker Hub** on every push to `main` and on version tags.

```bash
git clone https://github.com/bearyjd/TrailForge.git
cd TrailForge
docker compose up
```

Docker Compose will automatically pull the pre-built images. To force a local build instead, run `docker compose up --build`.

You can also pull images directly:

```bash
# From GitHub Container Registry
docker pull ghcr.io/bearyjd/trailforge-backend:latest
docker pull ghcr.io/bearyjd/trailforge-frontend:latest

# From Docker Hub
docker pull bearyj/trailforge-backend:latest
docker pull bearyj/trailforge-frontend:latest
```

### Run from source

```bash
git clone https://github.com/bearyjd/TrailForge.git
cd TrailForge
docker compose build
docker compose up
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Usage

1. **Find your area** — Use the search bar to find a location, or click the crosshair button to jump to your current location
2. **Draw a rectangle** — Click the rectangle tool in the top-left toolbar, then click and drag on the map to select your area
3. **Generate** — Click "Generate Garmin Map" and wait for processing (typically 30 seconds to a few minutes depending on area size)
4. **Download** — Once complete, click the download link to get your `gmapsupp.img` file

### Load onto Garmin Device

1. Connect your Garmin device via USB
2. Copy `gmapsupp.img` to the `GARMIN` folder on the device (create it if it doesn't exist)
3. Safely eject and restart the device
4. The custom map should appear in your map settings

## API Reference

All endpoints are prefixed with `/api`.

### `POST /api/generate`

Start a new map generation job.

**Request body:**
```json
{
  "bbox": {
    "south": 47.35,
    "west": 8.48,
    "north": 47.42,
    "east": 8.58
  }
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

**Errors:**
- `400` — Bounding box exceeds maximum area (4 deg², ~40,000 km²) or is too small

### `GET /api/status/{job_id}`

Poll the status of a generation job.

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": "Compiling Garmin IMG...",
  "error": null,
  "filename": null
}
```

**Status values:** `queued`, `processing`, `completed`, `failed`

### `GET /api/download/{job_id}/gmapsupp.img`

Download the generated Garmin IMG file. Only available after status is `completed`.

### `GET /api/health`

Health check endpoint. Returns `{"status": "ok"}`.

## Configuration

Configuration is via environment variables (set in `docker-compose.yml`):

| Variable            | Default                                  | Description                          |
|---------------------|------------------------------------------|--------------------------------------|
| `REDIS_URL`         | `redis://redis:6379/0`                   | Redis connection URL                 |
| `DATA_DIR`          | `/data/jobs`                             | Directory for job output files       |
| `MKGMAP_JAR`        | `/opt/mkgmap/mkgmap.jar`                 | Path to mkgmap JAR                   |
| `SPLITTER_JAR`      | `/opt/splitter/splitter.jar`             | Path to splitter JAR                 |
| `OVERPASS_URL`      | `https://overpass-api.de/api/interpreter`| Overpass API endpoint                |
| `MAX_BBOX_AREA_DEG2`| `4.0`                                   | Max bounding box area in degrees²    |
| `OVERPASS_TILE_DEG2`| `0.25`                                  | Max tile size for Overpass downloads  |

## CI/CD — Docker Image Publishing

A GitHub Actions workflow (`.github/workflows/docker-publish.yml`) automatically builds and pushes Docker images on every push to `main` and on version tags (`v*`).

To enable Docker Hub publishing, add these secrets in your GitHub repo settings (**Settings > Secrets and variables > Actions**):

| Secret              | Description              |
|---------------------|--------------------------|
| `DOCKERHUB_USERNAME`| Docker Hub username      |
| `DOCKERHUB_TOKEN`   | Docker Hub access token  |

ghcr.io publishing uses the built-in `GITHUB_TOKEN` and requires no extra configuration.

## Project Structure

```
trailforge/
├── docker-compose.yml          # Service orchestration
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── .gitignore
├── backend/
│   ├── Dockerfile              # Python + JRE + mkgmap + splitter + osmium
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI application entry point
│       ├── config.py           # Environment-based configuration
│       ├── api/
│       │   └── routes.py       # API endpoint handlers
│       ├── models/
│       │   └── schemas.py      # Pydantic request/response models
│       ├── tasks/
│       │   ├── celery_app.py   # Celery configuration
│       │   └── map_tasks.py    # Map generation task (pipeline orchestrator)
│       └── services/
│           ├── osm_downloader.py   # Overpass API client
│           └── map_compiler.py     # osmium, splitter, mkgmap wrappers
└── frontend/
    ├── Dockerfile              # Node.js dev server
    ├── package.json
    ├── vite.config.js          # Vite config with API proxy
    ├── index.html
    └── src/
        ├── main.jsx            # React entry point
        ├── App.jsx             # Root component with state management
        ├── App.css             # Global styles
        ├── api/
        │   └── client.js       # API client functions
        └── components/
            ├── MapSelector.jsx # Leaflet map with draw controls
            ├── PlaceSearch.jsx # Nominatim geocoding search bar
            ├── AreaInfo.jsx    # Selected area details display
            └── JobStatus.jsx   # Job polling and download UI
```

## External Services and Tools

| Tool/Service | Version | Purpose | License |
|---|---|---|---|
| [mkgmap](https://www.mkgmap.org.uk/) | r4924 | Compiles OSM data into Garmin IMG format | GPL v2 |
| [splitter](https://www.mkgmap.org.uk/) | r654 | Splits large OSM files into tiles for mkgmap | GPL v2 |
| [osmium-tool](https://osmcode.org/osmium-tool/) | System package | Converts OSM XML to PBF format | GPL v3 |
| [Overpass API](https://overpass-api.de/) | Public instance | Downloads OSM data for selected regions | ODbL (data) |
| [Nominatim](https://nominatim.openstreetmap.org/) | Public instance | Geocoding (place name search) | ODbL (data) |

## Limitations

- **Area size** — Maximum selectable area is 4 deg² (~40,000 km²). Areas larger than 0.25 deg² are automatically tiled and merged
- **Overpass rate limits** — The public Overpass API has usage limits; heavy use may be throttled. Consider running a local Overpass instance for production use
- **Processing time** — Dense urban areas (e.g., Washington DC, central London) may take several minutes due to data volume
- **Memory** — The worker container needs at least 4 GB of RAM for Java tools processing large areas

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Note: mkgmap and splitter are GPL v2 licensed tools that are invoked as separate processes, not linked as libraries. OSM data is provided under the [Open Database License](https://opendatacommons.org/licenses/odbl/).
