import secrets
from datetime import UTC, datetime, timedelta
from typing import Literal

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


# ArbZG §4: more than 6 h of work need 30 min break in total, more than 9 h need 45 min;
# only break parts of at least 15 min count.
LEGAL_BREAKS = (
    (timedelta(hours=9), timedelta(minutes=45)),
    (timedelta(hours=6), timedelta(minutes=30)),
)
MIN_LEGAL_BREAK_PART = timedelta(minutes=15)

ALARM_REPEAT = timedelta(minutes=2)
SNOOZE = timedelta(minutes=10)
# Unconfirmed for this long after the alarm began: the session ends by itself.
AUTO_END_AFTER = timedelta(minutes=20)


class InvalidStart(ValueError):
    pass


class InvalidPause(ValueError):
    pass


class CannotSnooze(ValueError):
    pass


class InvalidTarget(ValueError):
    pass


# ArbZG §3: at most 10 hours of work a day, pauses not counted.
MAX_WORK = timedelta(hours=10)
MAX_TARGET_MINUTES = int(MAX_WORK.total_seconds() // 60)
LIMIT_WARNING_AHEAD = timedelta(minutes=15)

LimitWarning = Literal["soon", "reached"]


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
    # Secret in the URLs of the notification buttons, which have no login cookie.
    alarm_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # First and latest alarm of the current round; a snooze starts a new round.
    alarm_started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    last_alarm_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    snoozed_until: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    # Latest warning about the 10-hour limit sent: "soon" or "reached".
    limit_warning: Mapped[str | None] = mapped_column(String(10), default=None)
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
        return cls(
            user_id=user_id,
            started_at=started_at,
            target_minutes=target_minutes,
            alarm_token=secrets.token_urlsafe(24),
        )

    @property
    def is_active(self) -> bool:
        return self.ended_at is None

    def pauses_at(self, moment: datetime) -> list["Pause"]:
        return [p for p in self.pauses if p.covers(moment)]

    def is_paused(self, now: datetime) -> bool:
        return self.is_active and bool(self.pauses_at(now))

    def _merged_pauses(self, now: datetime) -> list[tuple[datetime, datetime, bool]]:
        """Pause spans (start, end, contains the running pause); overlapping pauses merged."""
        merged: list[tuple[datetime, datetime, bool]] = []
        spans = sorted((p.started_at, p.ended_at or now, p.ended_at is None) for p in self.pauses)
        for start, end, running in spans:
            if merged and start <= merged[-1][1]:
                last_start, last_end, last_running = merged[-1]
                merged[-1] = (last_start, max(last_end, end), last_running or running)
            else:
                merged.append((start, end, running))
        return merged

    def paused_duration(self, now: datetime) -> timedelta:
        """Total pause time, planned pauses included. Overlapping pauses count once."""
        return sum((end - start for start, end, _ in self._merged_pauses(now)), timedelta())

    @property
    def required_break(self) -> timedelta:
        """Break the law requires for the target work time."""
        target = timedelta(minutes=self.target_minutes)
        return next((brk for threshold, brk in LEGAL_BREAKS if target > threshold), timedelta())

    def missing_break(self, now: datetime) -> timedelta:
        """Required break not covered by pauses yet. A running pause counts right away;
        otherwise the end would first move and then jump back once it reaches 15 min."""
        counted = sum(
            (
                end - start
                for start, end, running in self._merged_pauses(now)
                if running or end - start >= MIN_LEGAL_BREAK_PART
            ),
            timedelta(),
        )
        return max(timedelta(), self.required_break - counted)

    def end_at(self, now: datetime) -> datetime:
        """When work is done: target plus pauses plus the legal break not taken yet.
        During a running pause beyond the legal break this moves along with `now`."""
        return (
            self.started_at
            + timedelta(minutes=self.target_minutes)
            + self.paused_duration(now)
            + self.missing_break(now)
        )

    def worked(self, now: datetime) -> timedelta:
        """Time worked so far: since the start, without pauses up to now."""
        paused = sum(
            (min(end, now) - start for start, end, _ in self._merged_pauses(now) if start < now),
            timedelta(),
        )
        return now - self.started_at - paused

    def limit_warning_due(self, now: datetime) -> LimitWarning | None:
        """Escalation towards the 10-hour limit, independent of snooze and extending."""
        if not self.is_active or self.is_paused(now) or self.limit_warning == "reached":
            return None
        worked = self.worked(now)
        if worked >= MAX_WORK:
            return "reached"
        if worked >= MAX_WORK - LIMIT_WARNING_AHEAD and self.limit_warning is None:
            return "soon"
        return None

    def mark_limit_warning_sent(self, warning: LimitWarning) -> None:
        self.limit_warning = warning

    def alarm_at(self, now: datetime) -> datetime:
        """Feierabend, or the end of the snooze if that is later."""
        end = self.end_at(now)
        return max(end, self.snoozed_until) if self.snoozed_until else end

    def is_due(self, now: datetime) -> bool:
        return self.is_active and not self.is_paused(now) and now >= self.alarm_at(now)

    def needs_alarm(self, now: datetime) -> bool:
        """Due, and the first alarm of the round or the last one long enough ago."""
        return (
            self.is_due(now)
            and not self.needs_auto_end(now)
            and (self.last_alarm_at is None or now - self.last_alarm_at >= ALARM_REPEAT)
        )

    def mark_alarm_sent(self, now: datetime) -> None:
        self.alarm_started_at = self.alarm_started_at or now
        self.last_alarm_at = now

    def change_target(self, target_minutes: int, now: datetime) -> None:
        """Adjusts the remaining time. If the end moves past `now` again, a ringing alarm stops
        and comes back at the new end."""
        if not 1 <= target_minutes <= MAX_TARGET_MINUTES:
            raise InvalidTarget("target must be between 1 minute and 10 hours (ArbZG §3)")
        self.target_minutes = target_minutes
        if not self.is_due(now):
            self.alarm_started_at = self.last_alarm_at = None

    @property
    def can_snooze(self) -> bool:
        return self.snoozed_until is None

    def snooze(self, now: datetime) -> None:
        """Once per session: the alarm comes back after SNOOZE and starts a new round."""
        if not self.is_due(now) or not self.can_snooze:
            raise CannotSnooze("only once, and only after the alarm")
        self.snoozed_until = now + SNOOZE
        self.alarm_started_at = self.last_alarm_at = None

    def needs_auto_end(self, now: datetime) -> bool:
        return (
            self.is_active
            and self.alarm_started_at is not None
            and now >= self.alarm_started_at + AUTO_END_AFTER
        )

    def auto_end(self, now: datetime) -> None:
        """Nobody confirmed: probably work stopped long ago, so Feierabend counts from the alarm."""
        self.end(min(self.alarm_at(now), now))

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
