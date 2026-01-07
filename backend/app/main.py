from fastapi import FastAPI
from app.api.v1.files import router as files_router
from app.db.base import Base, engine

app = FastAPI(title="File Manager Backend")

app.include_router(files_router, prefix="/api/v1")

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)