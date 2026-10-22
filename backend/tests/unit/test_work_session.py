from datetime import UTC, datetime, timedelta

import pytest

from overworked.models import InvalidPause, WorkSession


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

    assert not session.is_paused(at(13))
    assert session.paused_duration(at(14)) == timedelta(hours=1)


def test_an_ended_session_cannot_be_paused():
    session = a_session()
    session.end(at(12))
    session.pause(at(12, 30))

    assert not session.is_paused(at(12, 30))


# --- Pauses with start and end: added afterwards or planned ahead ---


def test_a_planned_pause_shifts_the_end_right_away():
    session = a_session()
    session.add_pause(at(12), at(12, 45))

    assert session.end_at(at(9)) == at(16, 45)


def test_a_forgotten_pause_can_be_added_afterwards():
    session = a_session()
    session.add_pause(at(10), at(10, 30))

    assert session.end_at(at(14)) == at(16, 30)


def test_is_paused_only_during_a_planned_pause():
    session = a_session()
    session.add_pause(at(12), at(12, 45))

    assert not session.is_paused(at(11, 59))
    assert session.is_paused(at(12))
    assert not session.is_paused(at(12, 45))


def test_resuming_during_a_planned_pause_ends_it_early():
    session = a_session()
    session.add_pause(at(12), at(13))
    session.resume(at(12, 15))

    assert session.end_at(at(14)) == at(16, 15)


def test_a_spontaneous_pause_overlapping_a_planned_one_counts_once():
    session = a_session()
    session.add_pause(at(12, 30), at(13))
    session.pause(at(12))
    session.resume(at(13, 15))

    assert session.end_at(at(14)) == at(17, 15)


def test_resuming_ends_every_running_pause():
    """Pressing "Weiter" means working again, even if a planned pause is still going on."""
    session = a_session()
    session.add_pause(at(12, 30), at(13))
    session.pause(at(12))
    session.resume(at(12, 45))

    assert not session.is_paused(at(12, 50))
    assert session.end_at(at(14)) == at(16, 45)


def test_ending_drops_pauses_planned_for_later():
    session = a_session()
    session.add_pause(at(15), at(15, 30))
    session.end(at(14))

    assert session.pauses == []


def test_pausing_during_a_planned_pause_changes_nothing():
    session = a_session()
    session.add_pause(at(12), at(12, 45))
    session.pause(at(12, 10))

    assert session.end_at(at(13)) == at(16, 45)


def test_a_pause_can_be_corrected():
    session = a_session()
    pause = session.add_pause(at(12), at(12, 45))
    session.change_pause(pause, at(12), at(13))

    assert session.end_at(at(9)) == at(17)


def test_a_pause_can_be_moved_within_its_own_time():
    session = a_session()
    pause = session.add_pause(at(12), at(13))
    session.change_pause(pause, at(12, 30), at(13, 30))

    assert session.end_at(at(9)) == at(17)


def test_a_pause_can_be_removed():
    session = a_session()
    pause = session.add_pause(at(12), at(12, 45))
    session.remove_pause(pause)

    assert session.end_at(at(9)) == at(16)


def test_rejects_a_pause_that_ends_before_it_starts():
    with pytest.raises(InvalidPause):
        a_session().add_pause(at(13), at(12))


def test_rejects_a_pause_before_work_started():
    with pytest.raises(InvalidPause):
        a_session().add_pause(at(7), at(7, 30))


def test_rejects_overlapping_pauses():
    session = a_session()
    session.add_pause(at(12), at(13))

    with pytest.raises(InvalidPause):
        session.add_pause(at(12, 30), at(13, 30))


def test_rejects_a_pause_overlapping_the_running_one():
    session = a_session()
    session.pause(at(12))

    with pytest.raises(InvalidPause):
        session.add_pause(at(11, 30), at(12, 15))
