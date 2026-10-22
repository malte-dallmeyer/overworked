from datetime import UTC, datetime, timedelta

from sqlalchemy import DateTime, ForeignKey, Index, String, TypeDecorator, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


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

    @property
    def end_at(self) -> datetime:
        return self.started_at + timedelta(minutes=self.target_minutes)

    @property
    def is_active(self) -> bool:
        return self.ended_at is None

    def is_due(self, now: datetime) -> bool:
        return self.is_active and now >= self.end_at

    def needs_alarm(self, now: datetime) -> bool:
        return self.is_due(now) and self.alarm_sent_at is None

    def mark_alarm_sent(self, now: datetime) -> None:
        self.alarm_sent_at = now

    def end(self, now: datetime) -> None:
        if self.is_active:
            self.ended_at = now
