from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from overworked.auth import get_current_user
from overworked.clock import Clock, get_clock
from overworked.db import get_db
from overworked.models import User, WorkSession

router = APIRouter(prefix="/api")

Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Now = Annotated[Clock, Depends(get_clock)]


class StartSession(BaseModel):
    target_minutes: int = Field(ge=1, le=24 * 60)


class SessionOut(BaseModel):
    """Raw state; clients derive end time and countdown from it with their own clock."""

    started_at: datetime
    target_minutes: int
    paused_seconds: int  # finished pauses only
    paused_since: datetime | None  # start of the running pause

    @classmethod
    def of(cls, session: WorkSession) -> "SessionOut":
        open_pause = session.open_pause
        return cls(
            started_at=session.started_at,
            target_minutes=session.target_minutes,
            paused_seconds=int(session.finished_pauses_duration.total_seconds()),
            paused_since=open_pause.started_at if open_pause else None,
        )


def find_active(db: Session, user: User) -> WorkSession | None:
    return db.scalar(
        select(WorkSession).where(WorkSession.user_id == user.id, WorkSession.ended_at.is_(None))
    )


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/session/current")
def current_session(db: Db, user: CurrentUser) -> SessionOut | None:
    session = find_active(db, user)
    return SessionOut.of(session) if session else None


@router.post("/session", status_code=status.HTTP_201_CREATED)
def start_session(body: StartSession, db: Db, user: CurrentUser, clock: Now) -> SessionOut:
    conflict = HTTPException(status.HTTP_409_CONFLICT, "A session is already running")
    if find_active(db, user):
        raise conflict
    session = WorkSession(user_id=user.id, started_at=clock(), target_minutes=body.target_minutes)
    db.add(session)
    try:
        db.commit()
    except IntegrityError:  # another device started one in the meantime
        raise conflict from None
    return SessionOut.of(session)


def get_active(db: Session, user: User) -> WorkSession:
    session = find_active(db, user)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No session is running")
    return session


@router.post("/session/current/pause")
def pause_session(db: Db, user: CurrentUser, clock: Now) -> SessionOut:
    session = get_active(db, user)
    session.pause(clock())
    db.commit()
    return SessionOut.of(session)


@router.post("/session/current/resume")
def resume_session(db: Db, user: CurrentUser, clock: Now) -> SessionOut:
    session = get_active(db, user)
    session.resume(clock())
    db.commit()
    return SessionOut.of(session)


@router.post("/session/current/end", status_code=status.HTTP_204_NO_CONTENT)
def end_session(db: Db, user: CurrentUser, clock: Now) -> Response:
    get_active(db, user).end(clock())
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
