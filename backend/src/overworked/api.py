import asyncio
import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from overworked.auth import get_current_user
from overworked.clock import Clock, get_clock
from overworked.db import get_db
from overworked.events import changes
from overworked.models import (
    LEGAL_BREAKS,
    MAX_TARGET_MINUTES,
    CannotSnooze,
    InvalidPause,
    InvalidStart,
    InvalidTarget,
    Pause,
    User,
    WorkSession,
)
from overworked.notifier import Notifier
from overworked.targets import KEEP_SESSIONS, quick_targets

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


class ChangeTarget(BaseModel):
    target_minutes: int = Field(ge=1, le=MAX_TARGET_MINUTES)


class QuickTargetsOut(BaseModel):
    last: int = Field(description="Target of the last session started: the prefilled value.")
    choices: list[int] = Field(description="Distinct targets of the last starts, shortest first.")


class LegalBreakOut(BaseModel):
    after_minutes: int = Field(description="Applies to targets longer than this.")
    break_minutes: int


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
    legal_breaks: list[LegalBreakOut] = Field(
        description="ArbZG §4 rules, longest first, to preview a changed target."
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
            legal_breaks=[
                LegalBreakOut(
                    after_minutes=int(after.total_seconds() // 60),
                    break_minutes=int(brk.total_seconds() // 60),
                )
                for after, brk in LEGAL_BREAKS
            ],
        )


def find_active(db: Session, user: User) -> WorkSession | None:
    return find_active_of(db, user.id)


def find_active_of(db: Session, user_id: int) -> WorkSession | None:
    return db.scalar(
        select(WorkSession).where(WorkSession.user_id == user_id, WorkSession.ended_at.is_(None))
    )


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/session/current")
def get_current_session(db: Db, user: CurrentUser) -> SessionOut | None:
    session = find_active(db, user)
    return SessionOut.of(session) if session else None


@router.get(
    "/session/events",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def stream_session(request: Request, db: Db, user: CurrentUser) -> StreamingResponse:
    """Server-sent events: the current session (as from GET /session/current) right away and
    whenever it changes, from any device or the alarm. Commands stay plain requests."""
    user_id = user.id
    # The stream stays open for long; don't hold a pooled connection for it.
    db.close()
    session_factory = request.app.state.session_factory
    poll_seconds = request.app.state.events_poll_seconds

    def load_now() -> str:
        with session_factory() as fresh:
            session = find_active_of(fresh, user_id)
            return SessionOut.of(session).model_dump_json() if session else "null"

    async def load() -> str:
        return await asyncio.to_thread(load_now)

    async def wait() -> None:
        await asyncio.sleep(poll_seconds)

    async def stream():
        async for state in changes(load, wait):
            yield f"data: {state}\n\n" if state is not None else ": keepalive\n\n"

    return StreamingResponse(
        stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"}
    )


@router.get("/targets")
def get_quick_targets(db: Db, user: CurrentUser) -> QuickTargetsOut:
    """Quick choices for the target on the start screen."""
    newest_first = db.scalars(
        select(WorkSession.target_minutes)
        .where(WorkSession.user_id == user.id)
        .order_by(WorkSession.id.desc())
        .limit(KEEP_SESSIONS)
    ).all()
    targets = quick_targets(list(reversed(newest_first)))
    return QuickTargetsOut(last=targets.last, choices=targets.choices)


def forget_old_sessions(db: Session, user: User) -> None:
    """No history: keep only what the quick choices need, the new session included."""
    old = db.scalars(
        select(WorkSession)
        .where(WorkSession.user_id == user.id, WorkSession.ended_at.is_not(None))
        .order_by(WorkSession.id.desc())
        .offset(KEEP_SESSIONS - 1)
    ).all()
    for session in old:
        db.delete(session)  # pauses go with it (ORM cascade)


@router.post("/session", status_code=status.HTTP_201_CREATED)
def start_session(body: StartSession, db: Db, user: CurrentUser, clock: Now) -> SessionOut:
    conflict = HTTPException(status.HTTP_409_CONFLICT, "A session is already running")
    if find_active(db, user):
        raise conflict
    try:
        session = WorkSession.start(user.id, body.target_minutes, clock(), body.started_at)
    except InvalidStart as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None
    forget_old_sessions(db, user)
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


@router.put("/session/current/target")
def change_target(
    body: ChangeTarget, db: Db, user: CurrentUser, clock: Now, notifier: Notify
) -> SessionOut:
    """Adjusts the remaining time. Extending after the alarm is allowed; the app warns first."""
    session = get_active(db, user)
    ringing = session.alarm_started_at is not None
    try:
        session.change_target(body.target_minutes, clock())
    except InvalidTarget as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None
    db.commit()
    if ringing and session.alarm_started_at is None:
        stop_ringing(notifier, session)
    return SessionOut.of(session)


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
