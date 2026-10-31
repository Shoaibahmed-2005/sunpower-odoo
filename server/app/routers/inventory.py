"""Owner: A. prefix="/api", so each path is written in full (e.g. "/leads/{id}")."""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["Inventory"])
