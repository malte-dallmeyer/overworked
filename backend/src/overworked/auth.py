import asyncio
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from overworked.clock import Clock, get_clock
from overworked.config import Settings
from overworked.db import get_db
from overworked.models import User

# Single-user mode: every request belongs to this user. Real accounts replace
# login() and get_current_user() and nothing else.
SINGLE_USER_ID = 1

COOKIE_NAME = "overworked_session"
LOGIN_LIFETIME = timedelta(days=365)

router = APIRouter(prefix="/api", generate_unique_id_function=lambda route: route.name)


def ensure_single_user(db: Session) -> None:
    if db.get(User, SINGLE_USER_ID) is None:
        db.add(User(id=SINGLE_USER_ID, name="me"))
        db.commit()


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def _sign(settings: Settings, payload: str) -> str:
    assert settings.password and settings.secret_key
    # The password is part of the key, so changing it logs every device out.
    key = hmac.new(
        settings.secret_key.get_secret_value().encode(),
        settings.password.get_secret_value().encode(),
        hashlib.sha256,
    ).digest()
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()


def issue_token(settings: Settings, user_id: int, now: datetime) -> str:
    """`<user id>.<expiry as unix time>.<signature>`"""
    payload = f"{user_id}.{int((now + LOGIN_LIFETIME).timestamp())}"
    return f"{payload}.{_sign(settings, payload)}"


def user_id_of(settings: Settings, token: str, now: datetime) -> int | None:
    payload, _, signature = token.rpartition(".")
    if not hmac.compare_digest(signature, _sign(settings, payload)):
        return None
    user_id, _, expires = payload.partition(".")
    if now.timestamp() >= int(expires):
        return None
    return int(user_id)


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    clock: Annotated[Clock, Depends(get_clock)],
    token: Annotated[str | None, Cookie(alias=COOKIE_NAME, include_in_schema=False)] = None,
) -> User:
    if not settings.login_required:
        user_id = SINGLE_USER_ID
    else:
        user_id = user_id_of(settings, token, clock()) if token else None
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    return user


class LoginIn(BaseModel):
    password: str


@router.post(
    "/login",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={401: {"description": "Wrong password"}},
)
async def login(
    body: LoginIn,
    request: Request,
    response: Response,
    settings: Annotated[Settings, Depends(get_settings)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> None:
    expected = settings.password.get_secret_value() if settings.password else ""
    if not hmac.compare_digest(body.password.encode(), expected.encode()):
        # Slows down guessing; enough for a single-user instance.
        await asyncio.sleep(request.app.state.login_delay_seconds)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong password")
    if settings.login_required:
        response.set_cookie(
            COOKIE_NAME,
            issue_token(settings, SINGLE_USER_ID, clock()),
            max_age=int(LOGIN_LIFETIME.total_seconds()),
            httponly=True,
            secure=True,
            samesite="lax",
        )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, httponly=True, secure=True, samesite="lax")
