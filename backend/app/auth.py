from dataclasses import dataclass

from fastapi import HTTPException, Request

from app.config import settings


@dataclass
class Principal:
    user_id: str | None
    role: str
    authenticated: bool


def _split_csv(value: str) -> set[str]:
    return {part.strip() for part in value.split(",") if part.strip()}


def _extract_api_key(request: Request) -> str | None:
    if key := request.headers.get("x-api-key"):
        return key.strip()

    auth_header = request.headers.get("authorization")
    if not auth_header:
        return None
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token.strip()


def get_current_principal(request: Request) -> Principal:
    hinted_user = request.headers.get("x-user-id")

    if not settings.auth_enabled:
        return Principal(user_id=hinted_user, role="anonymous", authenticated=False)

    key = _extract_api_key(request)
    if not key:
        raise HTTPException(status_code=401, detail="auth_required")

    api_keys = _split_csv(settings.auth_api_keys)
    admin_keys = _split_csv(settings.auth_admin_api_keys)
    if key not in api_keys and key not in admin_keys:
        raise HTTPException(status_code=401, detail="invalid_api_key")

    role = "admin" if key in admin_keys else "user"
    if role == "user" and not hinted_user:
        raise HTTPException(status_code=400, detail="user_id_required")

    return Principal(
        user_id=hinted_user,
        role=role,
        authenticated=True,
    )


def assert_admin(principal: Principal) -> None:
    if settings.auth_enabled and principal.role != "admin":
        raise HTTPException(status_code=403, detail="admin_required")
