from fastapi import APIRouter

from app.api.v1 import auth, batches, events, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
# api_router.include_router(batches.router)
# api_router.include_router(events.router)
