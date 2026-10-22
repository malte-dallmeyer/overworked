from datetime import UTC, datetime, timedelta

from overworked.models import WorkSession


def at(hour: int, minute: int = 0, day: int = 22) -> datetime:
    return datetime(2026, 10, day, hour, minute, tzinfo=UTC)


def a_session(target_minutes: int = 480, started_at: datetime | None = None) -> WorkSession:
    return WorkSession(user_id=1, started_at=started_at or at(8), target_minutes=target_minutes)


def test_ends_after_target_duration():
    session = a_session(target_minutes=450)

    assert session.end_at(at(9)) == at(15, 30)


def test_ends_on_next_day_when_work_crosses_midnight():
    session = a_session(started_at=at(20), target_minutes=300)

    assert session.end_at(at(21)) == at(1, day=23)


def test_is_not_due_before_end():
    session = a_session()

    assert not session.is_due(at(15, 59))


def test_is_due_from_end_on():
    session = a_session()

    assert session.is_due(at(16))
    assert session.is_due(at(17))


def test_ended_session_is_never_due():
    session = a_session()
    session.end(at(10))

    assert not session.is_due(at(17))


def test_ending_twice_keeps_first_end_time():
    session = a_session()
    session.end(at(10))
    session.end(at(11))

    assert session.ended_at == at(10)


def test_needs_alarm_once_due():
    session = a_session()

    assert not session.needs_alarm(at(15, 59))
    assert session.needs_alarm(at(16))


def test_needs_no_alarm_after_it_was_sent():
    session = a_session()
    session.mark_alarm_sent(at(16))

    assert not session.needs_alarm(at(16, 5))


# --- Pauses ---


def test_a_pause_shifts_the_end_by_its_length():
    session = a_session()
    session.pause(at(12))
    session.resume(at(12, 30))

    assert session.end_at(at(13)) == at(16, 30)


def test_pauses_add_up():
    session = a_session()
    session.pause(at(10))
    session.resume(at(10, 15))
    session.pause(at(12))
    session.resume(at(12, 45))

    assert session.end_at(at(13)) == at(17)


def test_while_paused_the_end_moves_along_with_time():
    session = a_session()
    session.pause(at(12))

    assert session.end_at(at(13)) == at(17)
    assert session.end_at(at(14)) == at(18)


def test_is_not_due_while_paused():
    session = a_session()
    session.pause(at(12))

    assert not session.is_due(at(20))


def test_is_due_again_after_resuming():
    session = a_session()
    session.pause(at(12))
    session.resume(at(12, 30))

    assert not session.is_due(at(16, 29))
    assert session.is_due(at(16, 30))


def test_pausing_while_paused_keeps_the_first_pause():
    session = a_session()
    session.pause(at(12))
    session.pause(at(12, 10))
    session.resume(at(12, 30))

    assert session.end_at(at(13)) == at(16, 30)


def test_resuming_while_running_changes_nothing():
    session = a_session()
    session.resume(at(12))

    assert session.end_at(at(13)) == at(16)


def test_ending_while_paused_closes_the_pause():
    session = a_session()
    session.pause(at(12))
    session.end(at(13))

    assert not session.is_paused
    assert session.paused_duration(at(14)) == timedelta(hours=1)


def test_an_ended_session_cannot_be_paused():
    session = a_session()
    session.end(at(12))
    session.pause(at(12, 30))

    assert not session.is_paused
