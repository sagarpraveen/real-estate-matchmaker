import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.database import init_db
from app.routers import properties, matches, calculators

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB and seed dataset on startup
    await init_db()
    yield

app = FastAPI(
    title="NestMatch - Real Estate Lifestyle Matchmaker",
    description="Swipe-to-find real estate discovery engine matching design aesthetics, neighborhood vibe, commute, and budget.",
    version="1.0.0",
    lifespan=lifespan
)

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
templates_dir = os.path.join(os.path.dirname(__file__), "templates")

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)

# Include API Routers
app.include_router(properties.router)
app.include_router(matches.router)
app.include_router(calculators.router)

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
