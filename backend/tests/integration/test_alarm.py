from datetime import timedelta

import pytest

from overworked.alarm import send_due_alarms


@pytest.fixture
def check_alarms(app, settings, clock, notifier):
    return lambda: send_due_alarms(
        app.state.session_factory, clock(), notifier, settings.public_url
    )


def start(client, target_minutes=360):
    """6 h by default: no legal break, so the alarm comes exactly after the target."""
    client.post("/api/session", json={"target_minutes": target_minutes})


def test_no_alarm_before_target_is_reached(client, clock, notifier, check_alarms):
    start(client)
    clock.advance(timedelta(hours=5, minutes=59))

    check_alarms()

    assert notifier.sent == []


def test_alarm_when_target_is_reached(client, clock, notifier, check_alarms):
    start(client)
    clock.advance(timedelta(hours=6))

    check_alarms()

    assert notifier.sent == [("Feierabend!", "Deine Sollzeit von 6:00 h ist erreicht.")]


def test_alarm_is_not_repeated_within_two_minutes(client, clock, notifier, check_alarms):
    start(client)
    clock.advance(timedelta(hours=6))

    check_alarms()
    clock.advance(timedelta(minutes=1))
    check_alarms()

    assert len(notifier.sent) == 1


def test_no_alarm_for_ended_session(client, clock, notifier, check_alarms):
    start(client)
    client.post("/api/session/current/end")
    clock.advance(timedelta(hours=6))

    check_alarms()

    assert notifier.sent == []


def test_failed_alarm_is_retried(client, clock, notifier, check_alarms):
    start(client)
    clock.advance(timedelta(hours=6))
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
    client.post("/api/session", json={"target_minutes": 360, "started_at": "2026-10-22T07:00:00Z"})
    clock.advance(timedelta(hours=5))

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


def test_alarm_waits_for_the_legal_break_not_taken(client, clock, notifier, check_alarms):
    start(client, target_minutes=480)

    clock.advance(timedelta(hours=8))
    check_alarms()
    assert notifier.sent == []

    clock.advance(timedelta(minutes=30))
    check_alarms()
    assert len(notifier.sent) == 1


# --- Repeated until confirmed, buttons in the notification, snooze, auto-end ---


def alarm_now(client, clock, check_alarms):
    """Starts a 6 h session and lets the alarm go off."""
    start(client)
    clock.advance(timedelta(hours=6))
    check_alarms()


def button(notifier, label):
    action = next(a for a in notifier.messages[-1].actions if a.label == label)
    return action.url.removeprefix("https://overworked.example")


def test_alarm_repeats_every_two_minutes_until_confirmed(client, clock, notifier, check_alarms):
    alarm_now(client, clock, check_alarms)

    for _ in range(3):
        clock.advance(timedelta(minutes=2))
        check_alarms()

    assert len(notifier.messages) == 4
    assert notifier.messages[1].message == "Noch nicht bestätigt. Automatisches Ende in 18 min."
    assert len({m.key for m in notifier.messages}) == 1, "repeats replace the earlier message"


def test_alarm_offers_to_end_or_snooze_and_opens_the_app(client, clock, notifier, check_alarms):
    alarm_now(client, clock, check_alarms)

    [message] = notifier.messages
    assert [a.label for a in message.actions] == ["Feierabend", "10 min später"]
    assert message.click == "https://overworked.example"
    assert message.urgent


def test_feierabend_button_ends_the_session(client, clock, notifier, check_alarms):
    alarm_now(client, clock, check_alarms)

    response = client.post(button(notifier, "Feierabend"))

    assert response.status_code == 204
    assert client.get("/api/session/current").json() is None


def test_feierabend_button_still_works_after_ending_in_the_app(
    client, clock, notifier, check_alarms
):
    alarm_now(client, clock, check_alarms)
    client.post("/api/session/current/end")

    assert client.post(button(notifier, "Feierabend")).status_code == 204


def test_buttons_with_an_unknown_secret_do_nothing(client, clock, notifier, check_alarms):
    alarm_now(client, clock, check_alarms)

    assert client.post("/api/alarm/guessed/end").status_code == 404
    assert client.get("/api/session/current").json() is not None


def test_snooze_button_postpones_the_alarm_once(client, clock, notifier, check_alarms):
    alarm_now(client, clock, check_alarms)

    assert client.post(button(notifier, "10 min später")).status_code == 204
    clock.advance(timedelta(minutes=9))
    check_alarms()
    assert len(notifier.messages) == 1

    clock.advance(timedelta(minutes=1))
    check_alarms()
    assert len(notifier.messages) == 2
    assert [a.label for a in notifier.messages[-1].actions] == ["Feierabend"]


def test_ends_by_itself_after_20_minutes_without_confirmation(
    client, clock, notifier, check_alarms
):
    alarm_now(client, clock, check_alarms)

    for _ in range(10):
        clock.advance(timedelta(minutes=2))
        check_alarms()

    assert client.get("/api/session/current").json() is None
    last = notifier.messages[-1]
    assert last.title == "Automatisch beendet"
    assert not last.urgent, "the last message replaces the ringing alarm without ringing itself"
    assert last.key == notifier.messages[0].key


def test_ending_in_the_app_stops_the_phone_ringing(client, clock, notifier, check_alarms):
    alarm_now(client, clock, check_alarms)

    client.post("/api/session/current/end")

    assert notifier.cleared == [notifier.messages[0].key]


def test_ending_before_the_alarm_needs_no_clearing(client, notifier):
    start(client)

    client.post("/api/session/current/end")

    assert notifier.cleared == []


def test_snoozing_in_the_app(client, clock, notifier, check_alarms):
    alarm_now(client, clock, check_alarms)

    response = client.post("/api/session/current/snooze")

    assert response.status_code == 200
    assert response.json()["snoozed_until"] == "2026-10-22T14:10:00Z"
    assert notifier.cleared == [notifier.messages[0].key]


def test_snoozing_is_refused_before_the_alarm(client):
    start(client)

    assert client.post("/api/session/current/snooze").status_code == 409


def test_snoozing_is_refused_the_second_time(client, clock, check_alarms):
    alarm_now(client, clock, check_alarms)
    client.post("/api/session/current/snooze")
    clock.advance(timedelta(minutes=10))

    assert client.post("/api/session/current/snooze").status_code == 409
