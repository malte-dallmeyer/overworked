from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from overworked.config import Settings
from overworked.main import create_app


class FakeClock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def advance(self, delta: timedelta) -> None:
        self.now += delta


class SpyNotifier:
    """ntfy is an unmanaged out-of-process dependency, so it is the one thing we replace."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []
        self.fail_next = False

    def send(self, title: str, message: str) -> None:
        if self.fail_next:
            self.fail_next = False
            raise ConnectionError("ntfy unreachable")
        self.sent.append((title, message))


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(datetime(2026, 10, 22, 8, 0, tzinfo=UTC))


@pytest.fixture
def notifier() -> SpyNotifier:
    return SpyNotifier()


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}")


@pytest.fixture
def app(settings, clock, notifier):
    return create_app(
        settings, clock=clock, notifier=notifier, run_alarm_loop=False, login_delay_seconds=0
    )


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client
