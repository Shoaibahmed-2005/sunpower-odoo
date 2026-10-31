"""Upload endpoint — accepts image files, saves with a random name.
Perm: any logged-in user.
"""

import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File
from app.auth import get_current_user
from app.config import settings
from app.errors import ApiError

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("")
def upload_file(
    file: UploadFile = File(...),
    _user=Depends(get_current_user),  # any authenticated user can upload
):
    """Any logged-in user can upload an image (≤5 MB). Returns {url}."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise ApiError(400, "Only image files are allowed")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ApiError(400, f"File type {ext} not allowed")

    data = file.file.read()
    if len(data) > MAX_SIZE:
        raise ApiError(400, "File too large (max 5 MB)")

    settings.upload_dir.mkdir(exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (settings.upload_dir / name).write_bytes(data)

    return {"url": f"/uploads/{name}"}
