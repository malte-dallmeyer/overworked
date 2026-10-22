import asyncio
import logging
import math
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from overworked.clock import Clock
from overworked.models import AUTO_END_AFTER, SNOOZE, WorkSession
from overworked.notifier import Action, Notifier

log = logging.getLogger(__name__)


def format_duration(minutes: int) -> str:
    return f"{minutes // 60}:{minutes % 60:02d} h"


def alarm_message(session: WorkSession, now: datetime) -> str:
    if session.alarm_started_at is None:
        return f"Deine Sollzeit von {format_duration(session.target_minutes)} ist erreicht."
    left = math.ceil((session.alarm_started_at + AUTO_END_AFTER - now).total_seconds() / 60)
    return f"Noch nicht bestätigt. Automatisches Ende in {left} min."


def alarm_actions(session: WorkSession, public_url: str | None) -> list[Action]:
    """Buttons in the notification; their URLs carry the session's secret instead of a login."""
    if not public_url:
        return []
    base = f"{public_url.rstrip('/')}/api/alarm/{session.alarm_token}"
    actions = [Action("Feierabend", f"{base}/end")]
    if session.can_snooze:
        actions.append(Action(f"{int(SNOOZE.total_seconds() // 60)} min später", f"{base}/snooze"))
    return actions


def send_due_alarms(
    session_factory: sessionmaker[Session],
    now: datetime,
    notifier: Notifier,
    public_url: str | None = None,
) -> None:
    with session_factory() as db:
        active = db.scalars(select(WorkSession).where(WorkSession.ended_at.is_(None))).all()
        for session in active:
            try:
                if session.needs_auto_end(now):
                    # Same key: replaces the ringing alarm on the phone, without ringing itself.
                    # Sent first, so the session stays open and it is retried if ntfy fails.
                    notifier.send(
                        "Automatisch beendet",
                        "Der Alarm wurde nicht bestätigt. Schönen Feierabend!",
                        key=session.alarm_token,
                        click=public_url,
                        urgent=False,
                    )
                    session.auto_end(now)
                    db.commit()
                elif session.needs_alarm(now):
                    notifier.send(
                        "Feierabend!",
                        alarm_message(session, now),
                        key=session.alarm_token,
                        actions=alarm_actions(session, public_url),
                        click=public_url,
                    )
                    session.mark_alarm_sent(now)
                    db.commit()
            except Exception:
                log.exception("Alarm for session %s failed, retrying later", session.id)
                db.rollback()


async def alarm_loop(
    session_factory: sessionmaker[Session],
    clock: Clock,
    notifier: Notifier,
    interval_seconds: float,
    public_url: str | None = None,
) -> None:
    while True:
        try:
            await asyncio.to_thread(send_due_alarms, session_factory, clock(), notifier, public_url)
        except Exception:
            log.exception("Alarm check failed")
        await asyncio.sleep(interval_seconds)
