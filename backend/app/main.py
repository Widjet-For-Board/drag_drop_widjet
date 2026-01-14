from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.files import router as files_router
from app.db.base import Base, engine
from app.api.v1.widgets import router as widgets_router

app = FastAPI(title="File Manager Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # фронт
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files_router, prefix="/api/v1")
app.include_router(widgets_router, prefix="/api/v1")

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)