from datetime import UTC, datetime, timedelta

import pytest

from overworked.models import CannotSnooze, InvalidPause, WorkSession


def at(hour: int, minute: int = 0, day: int = 22) -> datetime:
    return datetime(2026, 10, day, hour, minute, tzinfo=UTC)


def a_session(target_minutes: int = 360, started_at: datetime | None = None) -> WorkSession:
    """By default 6 h from 08:00, which needs no legal break: ends at 14:00."""
    start = started_at or at(8)
    return WorkSession.start(user_id=1, target_minutes=target_minutes, now=start)


def test_ends_after_target_duration():
    session = a_session(target_minutes=330)

    assert session.end_at(at(9)) == at(13, 30)


def test_ends_on_next_day_when_work_crosses_midnight():
    session = a_session(started_at=at(20), target_minutes=300)

    assert session.end_at(at(21)) == at(1, day=23)


def test_is_not_due_before_end():
    session = a_session()

    assert not session.is_due(at(13, 59))


def test_is_due_from_end_on():
    session = a_session()

    assert session.is_due(at(14))
    assert session.is_due(at(15))


def test_ended_session_is_never_due():
    session = a_session()
    session.end(at(10))

    assert not session.is_due(at(15))


def test_ending_twice_keeps_first_end_time():
    session = a_session()
    session.end(at(10))
    session.end(at(11))

    assert session.ended_at == at(10)


# --- Spontaneous pauses ---


def test_a_pause_shifts_the_end_by_its_length():
    session = a_session()
    session.pause(at(12))
    session.resume(at(12, 30))

    assert session.end_at(at(13)) == at(14, 30)


def test_pauses_add_up():
    session = a_session()
    session.pause(at(10))
    session.resume(at(10, 15))
    session.pause(at(12))
    session.resume(at(12, 45))

    assert session.end_at(at(13)) == at(15)


def test_while_paused_the_end_moves_along_with_time():
    session = a_session()
    session.pause(at(12))

    assert session.end_at(at(13)) == at(15)
    assert session.end_at(at(14)) == at(16)


def test_is_not_due_while_paused():
    session = a_session()
    session.pause(at(12))

    assert not session.is_due(at(20))


def test_is_due_again_after_resuming():
    session = a_session()
    session.pause(at(12))
    session.resume(at(12, 30))

    assert not session.is_due(at(14, 29))
    assert session.is_due(at(14, 30))


def test_pausing_while_paused_keeps_the_first_pause():
    session = a_session()
    session.pause(at(12))
    session.pause(at(12, 10))
    session.resume(at(12, 30))

    assert session.end_at(at(13)) == at(14, 30)


def test_resuming_while_running_changes_nothing():
    session = a_session()
    session.resume(at(12))

    assert session.end_at(at(13)) == at(14)


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

    assert session.end_at(at(9)) == at(14, 45)


def test_a_forgotten_pause_can_be_added_afterwards():
    session = a_session()
    session.add_pause(at(10), at(10, 30))

    assert session.end_at(at(13)) == at(14, 30)


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

    assert session.end_at(at(13)) == at(14, 15)


def test_a_spontaneous_pause_overlapping_a_planned_one_counts_once():
    session = a_session()
    session.add_pause(at(12, 30), at(13))
    session.pause(at(12))
    session.resume(at(13, 15))

    assert session.end_at(at(14)) == at(15, 15)


def test_resuming_ends_every_running_pause():
    """Pressing "Weiter" means working again, even if a planned pause is still going on."""
    session = a_session()
    session.add_pause(at(12, 30), at(13))
    session.pause(at(12))
    session.resume(at(12, 45))

    assert not session.is_paused(at(12, 50))
    assert session.end_at(at(13)) == at(14, 45)


def test_ending_drops_pauses_planned_for_later():
    session = a_session()
    session.add_pause(at(13), at(13, 30))
    session.end(at(12))

    assert session.pauses == []


def test_pausing_during_a_planned_pause_changes_nothing():
    session = a_session()
    session.add_pause(at(12), at(12, 45))
    session.pause(at(12, 10))

    assert session.end_at(at(13)) == at(14, 45)


def test_a_pause_can_be_corrected():
    session = a_session()
    pause = session.add_pause(at(12), at(12, 45))
    session.change_pause(pause, at(12), at(13))

    assert session.end_at(at(9)) == at(15)


def test_a_pause_can_be_moved_within_its_own_time():
    session = a_session()
    pause = session.add_pause(at(12), at(13))
    session.change_pause(pause, at(12, 30), at(13, 30))

    assert session.end_at(at(9)) == at(15)


def test_a_pause_can_be_removed():
    session = a_session()
    pause = session.add_pause(at(12), at(12, 45))
    session.remove_pause(pause)

    assert session.end_at(at(9)) == at(14)


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


# --- Legal breaks (ArbZG §4) ---


@pytest.mark.parametrize(
    ("target_minutes", "required_minutes"),
    [(360, 0), (361, 30), (540, 30), (541, 45)],
)
def test_legal_break_depends_on_the_target(target_minutes, required_minutes):
    session = a_session(target_minutes=target_minutes)

    assert session.required_break == timedelta(minutes=required_minutes)


def test_the_end_includes_the_legal_break_not_yet_taken():
    session = a_session(target_minutes=480)

    assert session.end_at(at(9)) == at(16, 30)
    assert session.missing_break(at(9)) == timedelta(minutes=30)


def test_a_long_enough_pause_covers_the_legal_break():
    session = a_session(target_minutes=480)
    session.add_pause(at(12), at(12, 30))

    assert session.end_at(at(13)) == at(16, 30)
    assert session.missing_break(at(13)) == timedelta()


def test_a_longer_pause_moves_the_end_beyond_the_legal_break():
    session = a_session(target_minutes=480)
    session.add_pause(at(12), at(13))

    assert session.end_at(at(13)) == at(17)


def test_pauses_of_at_least_15_minutes_add_up_to_the_legal_break():
    session = a_session(target_minutes=480)
    session.add_pause(at(10), at(10, 15))
    session.add_pause(at(12), at(12, 15))

    assert session.end_at(at(13)) == at(16, 30)


def test_pauses_shorter_than_15_minutes_do_not_count_as_legal_break():
    session = a_session(target_minutes=480)
    session.add_pause(at(10), at(10, 10))

    assert session.end_at(at(13)) == at(16, 40)


def test_during_a_running_pause_the_end_holds_until_the_legal_break_is_used_up():
    session = a_session(target_minutes=480)
    session.pause(at(12))

    assert session.end_at(at(12, 20)) == at(16, 30)
    assert session.end_at(at(12, 45)) == at(16, 45)


# --- Alarm: repeated until confirmed, one snooze, auto-end ---


def alarmed(session: WorkSession, *moments: datetime) -> WorkSession:
    for moment in moments:
        session.mark_alarm_sent(moment)
    return session


def test_needs_alarm_once_due():
    session = a_session()

    assert not session.needs_alarm(at(13, 59))
    assert session.needs_alarm(at(14))


def test_repeats_the_alarm_every_two_minutes_until_confirmed():
    session = alarmed(a_session(), at(14))

    assert not session.needs_alarm(at(14, 1))
    assert session.needs_alarm(at(14, 2))


def test_needs_no_alarm_once_ended():
    session = alarmed(a_session(), at(14))
    session.end(at(14, 1))

    assert not session.needs_alarm(at(14, 5))


def test_ends_by_itself_20_minutes_after_the_alarm_began():
    session = alarmed(a_session(), at(14), at(14, 2))

    assert not session.needs_auto_end(at(14, 19))
    assert session.needs_auto_end(at(14, 20))


def test_auto_end_counts_the_end_time_as_feierabend():
    session = alarmed(a_session(), at(14))
    session.auto_end(at(14, 20))

    assert session.ended_at == at(14)


def test_no_auto_end_without_an_alarm():
    assert not a_session().needs_auto_end(at(20))


def test_snooze_postpones_the_alarm_by_ten_minutes():
    session = alarmed(a_session(), at(14))
    session.snooze(at(14, 3))

    assert session.snoozed_until == at(14, 13)
    assert not session.needs_alarm(at(14, 12))
    assert session.needs_alarm(at(14, 13))


def test_after_a_snooze_the_alarm_starts_over():
    session = alarmed(a_session(), at(14), at(14, 2))
    session.snooze(at(14, 3))
    alarmed(session, at(14, 13))

    assert not session.needs_auto_end(at(14, 32))
    assert session.needs_auto_end(at(14, 33))


def test_auto_end_after_a_snooze_counts_the_snoozed_alarm_as_feierabend():
    session = alarmed(a_session(), at(14))
    session.snooze(at(14, 3))
    alarmed(session, at(14, 13))
    session.auto_end(at(14, 33))

    assert session.ended_at == at(14, 13)


def test_snoozes_only_once():
    session = alarmed(a_session(), at(14))
    session.snooze(at(14, 3))

    with pytest.raises(CannotSnooze):
        session.snooze(at(14, 14))


def test_cannot_snooze_before_the_alarm():
    with pytest.raises(CannotSnooze):
        a_session().snooze(at(13))


def test_every_session_has_its_own_secret_for_the_notification_buttons():
    first, second = a_session(), a_session()

    assert len(first.alarm_token) >= 20
    assert first.alarm_token != second.alarm_token
