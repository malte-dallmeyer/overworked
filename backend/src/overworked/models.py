from datetime import UTC, datetime, timedelta

from sqlalchemy import DateTime, ForeignKey, Index, String, TypeDecorator, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class UTCDateTime(TypeDecorator[datetime]):
    """Stores timezone-aware datetimes as naive UTC; SQLite has no timezone support."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetime not allowed")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        return None if value is None else value.replace(tzinfo=UTC)


class Base(DeclarativeBase):
    pass


MAX_BACKDATING = timedelta(hours=24)
# Device clocks differ a little; a start "from the future" within this margin is fine.
CLOCK_SKEW_TOLERANCE = timedelta(minutes=1)


class InvalidStart(ValueError):
    pass


class InvalidPause(ValueError):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))


class WorkSession(Base):
    __tablename__ = "work_sessions"
    __table_args__ = (
        Index(
            "one_active_session_per_user",
            "user_id",
            unique=True,
            sqlite_where=text("ended_at IS NULL"),
            postgresql_where=text("ended_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime)
    target_minutes: Mapped[int]
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    alarm_sent_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    pauses: Mapped[list["Pause"]] = relationship(
        order_by="Pause.started_at", cascade="all, delete-orphan", lazy="selectin"
    )

    @classmethod
    def start(
        cls, user_id: int, target_minutes: int, now: datetime, started_at: datetime | None = None
    ) -> "WorkSession":
        """Starts now, or at `started_at` if work began earlier (forgot to start the timer)."""
        started_at = started_at or now
        if started_at > now + CLOCK_SKEW_TOLERANCE:
            raise InvalidStart("start is in the future")
        if started_at < now - MAX_BACKDATING:
            raise InvalidStart("start is more than 24 hours ago")
        return cls(user_id=user_id, started_at=started_at, target_minutes=target_minutes)

    @property
    def is_active(self) -> bool:
        return self.ended_at is None

    def pauses_at(self, moment: datetime) -> list["Pause"]:
        return [p for p in self.pauses if p.covers(moment)]

    def is_paused(self, now: datetime) -> bool:
        return self.is_active and bool(self.pauses_at(now))

    def paused_duration(self, now: datetime) -> timedelta:
        """Total pause time, planned pauses included. Overlapping pauses count once."""
        merged: list[tuple[datetime, datetime]] = []
        for start, end in sorted((p.started_at, p.ended_at or now) for p in self.pauses):
            if merged and start <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
            else:
                merged.append((start, end))
        return sum((end - start for start, end in merged), timedelta())

    def end_at(self, now: datetime) -> datetime:
        """When work is done; during a running pause without end this moves along with `now`."""
        return self.started_at + timedelta(minutes=self.target_minutes) + self.paused_duration(now)

    def is_due(self, now: datetime) -> bool:
        return self.is_active and not self.is_paused(now) and now >= self.end_at(now)

    def needs_alarm(self, now: datetime) -> bool:
        return self.is_due(now) and self.alarm_sent_at is None

    def mark_alarm_sent(self, now: datetime) -> None:
        self.alarm_sent_at = now

    def pause(self, now: datetime) -> None:
        """Starts a spontaneous pause; its end is set by resume()."""
        if self.is_active and not self.is_paused(now):
            self.pauses.append(Pause(started_at=now))

    def resume(self, now: datetime) -> None:
        """Back to work: ends every pause going on right now, planned ones included."""
        for pause in self.pauses_at(now):
            pause.ended_at = now
        self.pauses = [p for p in self.pauses if p.ended_at is None or p.ended_at > p.started_at]

    def add_pause(self, started_at: datetime, ended_at: datetime) -> "Pause":
        """A pause with start and end: forgotten earlier or planned ahead."""
        self._check_pause(started_at, ended_at)
        pause = Pause(started_at=started_at, ended_at=ended_at)
        self.pauses.append(pause)
        return pause

    def change_pause(self, pause: "Pause", started_at: datetime, ended_at: datetime) -> None:
        self._check_pause(started_at, ended_at, ignore=pause)
        pause.started_at = started_at
        pause.ended_at = ended_at

    def remove_pause(self, pause: "Pause") -> None:
        self.pauses.remove(pause)

    def end(self, now: datetime) -> None:
        if self.is_active:
            self.resume(now)
            self.pauses = [p for p in self.pauses if p.started_at <= now]
            self.ended_at = now

    def _check_pause(self, started_at: datetime, ended_at: datetime, ignore=None) -> None:
        if ended_at <= started_at:
            raise InvalidPause("pause must end after it starts")
        if started_at < self.started_at:
            raise InvalidPause("pause must not start before work started")
        if any(p.overlaps(started_at, ended_at) for p in self.pauses if p is not ignore):
            raise InvalidPause("pause overlaps another pause")


class Pause(Base):
    __tablename__ = "pauses"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("work_sessions.id", ondelete="CASCADE"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(UTCDateTime)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)

    def covers(self, moment: datetime) -> bool:
        return self.started_at <= moment and (self.ended_at is None or moment < self.ended_at)

    def overlaps(self, started_at: datetime, ended_at: datetime) -> bool:
        # A running pause has no end yet, so it overlaps everything after its start.
        return started_at < (self.ended_at or datetime.max.replace(tzinfo=UTC)) and (
            self.started_at < ended_at
        )
