from datetime import timedelta

import pytest

from overworked.alarm import send_due_alarms


@pytest.fixture
def check_alarms(app, clock, notifier):
    return lambda: send_due_alarms(app.state.session_factory, clock(), notifier)


def start(client, target_minutes=480):
    client.post("/api/session", json={"target_minutes": target_minutes})


def test_no_alarm_before_target_is_reached(client, clock, notifier, check_alarms):
    start(client, target_minutes=480)
    clock.advance(timedelta(hours=7, minutes=59))

    check_alarms()

    assert notifier.sent == []


def test_alarm_when_target_is_reached(client, clock, notifier, check_alarms):
    start(client, target_minutes=480)
    clock.advance(timedelta(hours=8))

    check_alarms()

    assert notifier.sent == [("Feierabend!", "Deine Sollzeit von 8:00 h ist erreicht.")]


def test_alarm_is_sent_only_once(client, clock, notifier, check_alarms):
    start(client)
    clock.advance(timedelta(hours=8))

    check_alarms()
    clock.advance(timedelta(minutes=1))
    check_alarms()

    assert len(notifier.sent) == 1


def test_no_alarm_for_ended_session(client, clock, notifier, check_alarms):
    start(client)
    client.post("/api/session/current/end")
    clock.advance(timedelta(hours=8))

    check_alarms()

    assert notifier.sent == []


def test_failed_alarm_is_retried(client, clock, notifier, check_alarms):
    start(client)
    clock.advance(timedelta(hours=8))
    notifier.fail_next = True

    check_alarms()
    check_alarms()

    assert len(notifier.sent) == 1


def test_no_alarm_while_paused(client, clock, notifier, check_alarms):
    start(client)
    clock.advance(timedelta(hours=4))
    client.post("/api/session/current/pause")
    clock.advance(timedelta(hours=6))

    check_alarms()

    assert notifier.sent == []


def test_alarm_comes_later_by_the_length_of_the_pause(client, clock, notifier, check_alarms):
    start(client, target_minutes=480)
    clock.advance(timedelta(hours=4))
    client.post("/api/session/current/pause")
    clock.advance(timedelta(minutes=30))
    client.post("/api/session/current/resume")

    clock.advance(timedelta(hours=3, minutes=59))
    check_alarms()
    assert notifier.sent == []

    clock.advance(timedelta(minutes=1))
    check_alarms()
    assert len(notifier.sent) == 1


def test_backdated_session_alarms_at_the_shifted_end(client, clock, notifier, check_alarms):
    client.post("/api/session", json={"target_minutes": 480, "started_at": "2026-10-22T07:00:00Z"})
    clock.advance(timedelta(hours=7))

    check_alarms()

    assert len(notifier.sent) == 1


def test_no_alarm_during_a_planned_pause(client, clock, notifier, check_alarms):
    start(client, target_minutes=60)
    client.post(
        "/api/session/current/pauses",
        json={"started_at": "2026-10-22T08:30:00Z", "ended_at": "2026-10-22T10:00:00Z"},
    )
    clock.advance(timedelta(hours=2))  # 10:00, end is 10:30

    check_alarms()
    assert notifier.sent == []

    clock.advance(timedelta(minutes=30))
    check_alarms()
    assert len(notifier.sent) == 1
