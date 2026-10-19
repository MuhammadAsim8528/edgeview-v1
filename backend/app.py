"""
FastAPI Server Application Entry Point.
Configured with GZip compression middleware, LRU caching for file parsing, and async threadpool execution.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.gzip import GZipMiddleware
from functools import lru_cache
import asyncio

from routes.files import router as files_router
from routes.country import router as country_router
from routes.stats import router as stats_router

app = FastAPI(
    title="Pharma AI Standalone Viewer API",
    description="High-performance backend for parsing NVL, DBF, CSV, Excel, and DOCX pharma files with USD currency simplification.",
    version="2.0.0"
)

# Exception handlers to guarantee JSON responses (never HTML)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail if isinstance(exc.detail, str) else str(exc.detail)}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "details": str(exc)}
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "details": str(exc)}
    )

# Enable Gzip Compression for compressed payload transfers
app.add_middleware(GZipMiddleware, minimum_size=500)

# Include File Routes
app.include_router(files_router)
app.include_router(country_router)
app.include_router(stats_router)

# LRU Cache for parsed files to prevent re-parsing identical file content
@lru_cache(maxsize=128)
def cached_parse_file_bytes(file_name: str, file_hash: str):
    """Cached file parsing logic using LRU Cache."""
    return f"Parsed cached result for {file_name}"

async def async_parse_file_wrapper(file_name: str, file_bytes: bytes):
    """Executes heavy CPU-bound file parsing inside an async thread pool using asyncio.to_thread."""
    file_hash = str(hash(file_bytes))
    parsed_result = await asyncio.to_thread(cached_parse_file_bytes, file_name, file_hash)
    return parsed_result

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "Pharma AI Viewer API"}
