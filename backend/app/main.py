"""FastAPI application entry point for the TrailForge service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.trail_routes import router as trail_router

app = FastAPI(title="TrailForge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(trail_router, prefix="/api")
