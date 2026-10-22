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
