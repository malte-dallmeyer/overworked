import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from overworked.auth import get_current_user
from overworked.clock import Clock, get_clock
from overworked.db import get_db
from overworked.models import (
    CannotSnooze,
    InvalidPause,
    InvalidStart,
    Pause,
    User,
    WorkSession,
)
from overworked.notifier import Notifier

log = logging.getLogger(__name__)

# Operation IDs are the function names, so the generated frontend client gets
# readable names (startSession instead of start_session_api_session_post).
router = APIRouter(prefix="/api", generate_unique_id_function=lambda route: route.name)

Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Now = Annotated[Clock, Depends(get_clock)]


def get_notifier(request: Request) -> Notifier:
    return request.app.state.notifier


Notify = Annotated[Notifier, Depends(get_notifier)]


class StartSession(BaseModel):
    target_minutes: int = Field(ge=1, le=24 * 60)
    started_at: AwareDatetime | None = Field(
        default=None, description="When work began, if earlier than now (at most 24 hours ago)."
    )


class PauseIn(BaseModel):
    started_at: AwareDatetime
    ended_at: AwareDatetime


class PauseOut(BaseModel):
    id: int
    started_at: datetime
    ended_at: datetime | None = Field(description="None while a spontaneous pause is running.")


class SessionOut(BaseModel):
    """Raw state; clients derive end time and countdown from it with their own clock."""

    started_at: datetime
    target_minutes: int
    required_break_minutes: int = Field(
        description="Break the law requires for the target (ArbZG §4). Pauses of at least "
        "15 min (or the running one) count towards it; what is missing extends the end."
    )
    pauses: list[PauseOut] = Field(description="Past, running and planned pauses, by start.")
    snoozed_until: datetime | None = Field(
        description="Set once the one snooze is used: the alarm comes back then."
    )

    @classmethod
    def of(cls, session: WorkSession) -> "SessionOut":
        return cls(
            started_at=session.started_at,
            target_minutes=session.target_minutes,
            required_break_minutes=int(session.required_break.total_seconds() // 60),
            pauses=[
                PauseOut(id=p.id, started_at=p.started_at, ended_at=p.ended_at)
                for p in sorted(session.pauses, key=lambda p: p.started_at)
            ],
            snoozed_until=session.snoozed_until,
        )


def find_active(db: Session, user: User) -> WorkSession | None:
    return db.scalar(
        select(WorkSession).where(WorkSession.user_id == user.id, WorkSession.ended_at.is_(None))
    )


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/session/current")
def get_current_session(db: Db, user: CurrentUser) -> SessionOut | None:
    session = find_active(db, user)
    return SessionOut.of(session) if session else None


@router.post("/session", status_code=status.HTTP_201_CREATED)
def start_session(body: StartSession, db: Db, user: CurrentUser, clock: Now) -> SessionOut:
    conflict = HTTPException(status.HTTP_409_CONFLICT, "A session is already running")
    if find_active(db, user):
        raise conflict
    try:
        session = WorkSession.start(user.id, body.target_minutes, clock(), body.started_at)
    except InvalidStart as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None
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


def stop_ringing(notifier: Notifier, session: WorkSession) -> None:
    """Takes the alarm off the phone; confirmed in the app, so it must not keep ringing."""
    try:
        notifier.clear(session.alarm_token)
    except Exception:
        log.exception("Clearing the alarm of session %s failed", session.id)


@router.post("/session/current/end", status_code=status.HTTP_204_NO_CONTENT)
def end_session(db: Db, user: CurrentUser, clock: Now, notifier: Notify) -> Response:
    session = get_active(db, user)
    ringing = session.alarm_started_at is not None
    session.end(clock())
    db.commit()
    if ringing:
        stop_ringing(notifier, session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def cannot_snooze(error: CannotSnooze) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, str(error))


@router.post("/session/current/snooze", responses={409: {"description": "Not due or used"}})
def snooze_session(db: Db, user: CurrentUser, clock: Now, notifier: Notify) -> SessionOut:
    """The one snooze: the alarm comes back in 10 minutes."""
    session = get_active(db, user)
    ringing = session.alarm_started_at is not None
    try:
        session.snooze(clock())
    except CannotSnooze as error:
        raise cannot_snooze(error) from None
    db.commit()
    if ringing:
        stop_ringing(notifier, session)
    return SessionOut.of(session)


# Buttons in the notification. ntfy sends no login cookie, so the session's secret in the
# URL is the authorization; it allows nothing but these two actions.


def get_by_alarm_token(db: Session, token: str) -> WorkSession:
    session = db.scalar(select(WorkSession).where(WorkSession.alarm_token == token))
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown alarm")
    return session


@router.post("/alarm/{token}/end", status_code=status.HTTP_204_NO_CONTENT)
def end_session_from_notification(token: str, db: Db, clock: Now) -> Response:
    """Also fine if the session has ended already: the notification just goes away."""
    get_by_alarm_token(db, token).end(clock())
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/alarm/{token}/snooze",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={409: {"description": "Not due or used"}},
)
def snooze_session_from_notification(token: str, db: Db, clock: Now) -> Response:
    try:
        get_by_alarm_token(db, token).snooze(clock())
    except CannotSnooze as error:
        raise cannot_snooze(error) from None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def get_pause(session: WorkSession, pause_id: int) -> Pause:
    pause = next((p for p in session.pauses if p.id == pause_id), None)
    if pause is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such pause")
    return pause


def invalid(error: InvalidPause) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error))


@router.post("/session/current/pauses", status_code=status.HTTP_201_CREATED)
def add_pause(body: PauseIn, db: Db, user: CurrentUser) -> SessionOut:
    """Adds a pause with start and end: forgotten earlier or planned ahead."""
    session = get_active(db, user)
    try:
        session.add_pause(body.started_at, body.ended_at)
    except InvalidPause as error:
        raise invalid(error) from None
    db.commit()
    return SessionOut.of(session)


@router.put("/session/current/pauses/{pause_id}")
def change_pause(pause_id: int, body: PauseIn, db: Db, user: CurrentUser) -> SessionOut:
    session = get_active(db, user)
    try:
        session.change_pause(get_pause(session, pause_id), body.started_at, body.ended_at)
    except InvalidPause as error:
        raise invalid(error) from None
    db.commit()
    return SessionOut.of(session)


@router.delete("/session/current/pauses/{pause_id}")
def remove_pause(pause_id: int, db: Db, user: CurrentUser) -> SessionOut:
    session = get_active(db, user)
    session.remove_pause(get_pause(session, pause_id))
    db.commit()
    return SessionOut.of(session)
