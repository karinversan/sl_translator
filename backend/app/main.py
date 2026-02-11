from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import router
from app.config import settings
from app.db import Base, engine
from app.storage import ensure_bucket_exists


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_bucket_exists()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(router)

