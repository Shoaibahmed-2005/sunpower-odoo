"""Upload endpoint — accepts image files, saves with a random name.
Perm: any logged-in user.
"""

import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File
from app.auth import require_perm
from app.errors import ApiError

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("")
def upload_file(
    file: UploadFile = File(...),
    _user=Depends(require_perm("dashboard:read")),  # any logged-in user has at least one perm
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

    UPLOAD_DIR.mkdir(exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)

    return {"url": f"/uploads/{name}"}
