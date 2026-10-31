"""FastAPI app. Every router is registered here."""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.errors import register_error_handlers
from app.routers import (
    auth,
    customer_messages,
    dashboard,
    images,
    inventory,
    invoices,
    jobs,
    leads,
    portal,
    portal_auth,
    quotations,
    surveys,
    tickets,
    uploads,
    users,
)

app = FastAPI(title="SunPower API")
register_error_handlers(app)

# Each router sets its own prefix inside its file ("/api" or e.g. "/api/jobs")
for module in (
    auth,
    users,
    leads,
    surveys,
    quotations,
    invoices,
    inventory,
    dashboard,
    jobs,
    tickets,
    uploads,
    images,
    portal_auth,
    portal,
    customer_messages,
):
    app.include_router(module.router)

# Uploaded photos are plain files served at /uploads/<uuid>.<ext>
settings.upload_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
