from datetime import UTC, datetime, timedelta

from overworked.models import WorkSession

START = datetime(2026, 10, 22, 8, 0, tzinfo=UTC)


def a_session(target_minutes: int = 480) -> WorkSession:
    return WorkSession(user_id=1, started_at=START, target_minutes=target_minutes)


def test_ends_after_target_duration():
    session = a_session(target_minutes=450)

    assert session.end_at == START + timedelta(hours=7, minutes=30)


def test_ends_on_next_day_when_work_crosses_midnight():
    session = WorkSession(
        user_id=1, started_at=datetime(2026, 10, 22, 20, 0, tzinfo=UTC), target_minutes=300
    )

    assert session.end_at == datetime(2026, 10, 23, 1, 0, tzinfo=UTC)


def test_is_not_due_before_end():
    session = a_session()

    assert not session.is_due(session.end_at - timedelta(seconds=1))


def test_is_due_from_end_on():
    session = a_session()

    assert session.is_due(session.end_at)
    assert session.is_due(session.end_at + timedelta(hours=1))


def test_ended_session_is_never_due():
    session = a_session()
    session.end(START + timedelta(hours=2))

    assert not session.is_due(session.end_at + timedelta(minutes=1))


def test_ending_twice_keeps_first_end_time():
    session = a_session()
    session.end(START + timedelta(hours=2))
    session.end(START + timedelta(hours=3))

    assert session.ended_at == START + timedelta(hours=2)


def test_needs_alarm_once_due():
    session = a_session()

    assert not session.needs_alarm(session.end_at - timedelta(seconds=1))
    assert session.needs_alarm(session.end_at)


def test_needs_no_alarm_after_it_was_sent():
    session = a_session()
    session.mark_alarm_sent(session.end_at)

    assert not session.needs_alarm(session.end_at + timedelta(minutes=5))
