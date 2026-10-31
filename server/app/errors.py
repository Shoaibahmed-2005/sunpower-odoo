"""One error format for the whole API: {"error": "Human-readable message", "field": "phone" | null}."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    """Raise from any router: 400 bad input, 403 wrong role, 404 not found, 409 a gate or state blocks it."""

    def __init__(self, status: int, message: str, field: str | None = None):
        self.status, self.message, self.field = status, message, field


def error_body(message: str, field: str | None) -> dict:
    return {"error": message, "field": field}


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content=error_body(exc.message, exc.field))


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Pydantic can report several problems; the form only needs the first one and which field it is
    first = exc.errors()[0]
    loc = first.get("loc") or []
    field = str(loc[-1]) if loc and loc[-1] != "body" else None
    return JSONResponse(status_code=400, content=error_body(first.get("msg", "Invalid input"), field))


async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=error_body(str(exc.detail), None))


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
