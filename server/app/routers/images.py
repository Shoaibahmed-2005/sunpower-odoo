"""Public image serving endpoint for binary stored images."""
from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.models import Image

router = APIRouter(prefix="/api/images", tags=["images"])


@router.get("/{public_id}")
def get_image(public_id: str, db: Session = Depends(get_db)):
    """Serve binary image by public_id."""
    stmt = select(Image).where(Image.public_id == public_id)
    image_record = db.execute(stmt).scalar_one_or_none()
    if not image_record:
        raise ApiError(404, "Image not found")

    return Response(
        content=image_record.data,
        media_type=image_record.content_type or "image/png",
        headers={
            "Content-Type": image_record.content_type or "image/png",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=86400",
        },
    )
