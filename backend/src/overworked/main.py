import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import sessionmaker

from overworked import api, auth
from overworked.alarm import alarm_loop
from overworked.auth import ensure_single_user
from overworked.clock import Clock, utc_now
from overworked.config import Settings
from overworked.db import make_engine
from overworked.migrations import upgrade_to_head
from overworked.notifier import LogNotifier, Notifier, NtfyNotifier


def make_notifier(settings: Settings) -> Notifier:
    if settings.ntfy_topic:
        return NtfyNotifier(settings.ntfy_url, settings.ntfy_topic, settings.ntfy_token)
    return LogNotifier()


def create_app(
    settings: Settings | None = None,
    *,
    clock: Clock = utc_now,
    notifier: Notifier | None = None,
    run_alarm_loop: bool = True,
    login_delay_seconds: float = 1,
) -> FastAPI:
    settings = settings or Settings()
    engine = make_engine(settings.database_url)
    session_factory = sessionmaker(engine, expire_on_commit=False)
    notifier = notifier or make_notifier(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        upgrade_to_head(engine)
        with session_factory() as db:
            ensure_single_user(db)
        loop = None
        if run_alarm_loop:
            loop = asyncio.create_task(
                alarm_loop(session_factory, clock, notifier, settings.alarm_check_interval_seconds)
            )
        yield
        if loop:
            loop.cancel()
            with suppress(asyncio.CancelledError):
                await loop
        engine.dispose()

    app = FastAPI(title="Overworked", lifespan=lifespan)
    app.state.settings = settings
    app.state.session_factory = session_factory
    app.state.clock = clock
    app.state.notifier = notifier
    app.state.login_delay_seconds = login_delay_seconds
    app.include_router(auth.router)
    app.include_router(api.router)

    if settings.static_dir and Path(settings.static_dir).is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="static")

    return app
