from collections.abc import Callable
from datetime import UTC, datetime

from fastapi import Request

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


def get_clock(request: Request) -> Clock:
    return request.app.state.clock
