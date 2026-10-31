"""Upload endpoint — accepts image files, saves with a random name.
Perm: any logged-in user.
"""

import io
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, UploadFile
from PIL import Image as PILImage
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.db import get_db
from app.errors import ApiError
from app.models import Image

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("")
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
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

    try:
        img = PILImage.open(io.BytesIO(data))
        img.verify()
    except Exception:
        raise ApiError(400, "Invalid image data")

    # Store in database as binary
    public_id = uuid.uuid4().hex
    image_record = Image(
        public_id=public_id,
        content_type=file.content_type or "image/png",
        size=len(data),
        data=data,
        uploaded_by_id=_user.id if _user else None,
    )
    db.add(image_record)
    db.commit()

    # Also save to disk for backwards compatibility with legacy /uploads/
    try:
        settings.upload_dir.mkdir(exist_ok=True)
        name = f"{public_id}{ext}"
        (settings.upload_dir / name).write_bytes(data)
    except Exception:
        pass

    return {"url": f"/api/images/{public_id}"}
