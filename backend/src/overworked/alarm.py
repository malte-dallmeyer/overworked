import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from overworked.clock import Clock
from overworked.models import WorkSession
from overworked.notifier import Notifier

log = logging.getLogger(__name__)


def format_duration(minutes: int) -> str:
    return f"{minutes // 60}:{minutes % 60:02d} h"


def send_due_alarms(
    session_factory: sessionmaker[Session], now: datetime, notifier: Notifier
) -> None:
    with session_factory() as db:
        active = db.scalars(select(WorkSession).where(WorkSession.ended_at.is_(None))).all()
        for session in active:
            if not session.needs_alarm(now):
                continue
            try:
                notifier.send(
                    "Feierabend!",
                    f"Deine Sollzeit von {format_duration(session.target_minutes)} ist erreicht.",
                )
            except Exception:
                log.exception("Sending alarm for session %s failed, retrying later", session.id)
                continue
            session.mark_alarm_sent(now)
            db.commit()


async def alarm_loop(
    session_factory: sessionmaker[Session],
    clock: Clock,
    notifier: Notifier,
    interval_seconds: float,
) -> None:
    while True:
        try:
            await asyncio.to_thread(send_due_alarms, session_factory, clock(), notifier)
        except Exception:
            log.exception("Alarm check failed")
        await asyncio.sleep(interval_seconds)
