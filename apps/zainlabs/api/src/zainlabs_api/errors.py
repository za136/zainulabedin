"""One error format for every failure: {"error", "code", "fields"?}."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class APIError(Exception):
    def __init__(self, status: int, code: str, error: str, fields: dict[str, str] | None = None,
                 headers: dict[str, str] | None = None):
        self.status, self.code, self.error, self.fields, self.headers = status, code, error, fields, headers


def body(code: str, error: str, fields: dict[str, str] | None = None) -> dict:
    d = {"error": error, "code": code}
    if fields:
        d["fields"] = fields
    return d


def install(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def api_error(_: Request, e: APIError):
        return JSONResponse(body(e.code, e.error, e.fields), status_code=e.status, headers=e.headers)

    @app.exception_handler(RequestValidationError)
    async def validation(_: Request, e: RequestValidationError):
        fields: dict[str, str] = {}
        for err in e.errors():
            loc = [str(x) for x in err.get("loc", []) if x not in ("body", "query", "path")]
            key = ".".join(loc) or "body"
            msg = "Unknown field." if err.get("type") == "extra_forbidden" else err.get("msg", "Invalid value.")
            fields.setdefault(key, msg)
        first = next(iter(fields.items()))
        return JSONResponse(body("validation_error", f"Please check the field '{first[0]}': {first[1]}", fields),
                            status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, e: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed", 401: "unauthorized"}.get(e.status_code, "http_error")
        return JSONResponse(body(code, str(e.detail)), status_code=e.status_code)
