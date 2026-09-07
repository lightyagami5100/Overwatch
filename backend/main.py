"""
Overwatch Protocol (Flux) — FastAPI Application Entry Point.
Configures CORS, registers routes, and initializes the database.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routes.intel import router as intel_router
from routes.audio import router as audio_router
from routes.tools import router as tools_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize DB on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Overwatch Protocol Backend",
    description="Decentralized Cyber Command, OSINT Aggregation & Threat Intelligence API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow all local origins
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(intel_router)
app.include_router(audio_router)
app.include_router(tools_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "operational", "service": "Overwatch Protocol v2.0"}
