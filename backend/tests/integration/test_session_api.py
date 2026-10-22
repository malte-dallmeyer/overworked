from datetime import timedelta


def start(client, target_minutes=480):
    return client.post("/api/session", json={"target_minutes": target_minutes})


def test_no_current_session_initially(client):
    response = client.get("/api/session/current")

    assert response.status_code == 200
    assert response.json() is None


def test_starting_a_session_returns_it(client):
    response = start(client, target_minutes=450)

    assert response.status_code == 201
    assert response.json() == {
        "started_at": "2026-10-22T08:00:00Z",
        "target_minutes": 450,
        "required_break_minutes": 30,
        "pauses": [],
        "snoozed_until": None,
        "legal_breaks": [
            {"after_minutes": 540, "break_minutes": 45},
            {"after_minutes": 360, "break_minutes": 30},
        ],
    }


def test_started_session_is_current(client):
    start(client, target_minutes=450)

    response = client.get("/api/session/current")

    assert response.json()["target_minutes"] == 450


def test_cannot_start_a_second_session_while_one_is_running(client):
    start(client)

    response = start(client)

    assert response.status_code == 409


def test_ending_a_session_clears_current_session(client):
    start(client)

    response = client.post("/api/session/current/end")

    assert response.status_code == 204
    assert client.get("/api/session/current").json() is None


def test_can_start_again_after_ending(client):
    start(client)
    client.post("/api/session/current/end")

    assert start(client).status_code == 201


def test_ending_without_running_session_is_not_found(client):
    response = client.post("/api/session/current/end")

    assert response.status_code == 404


def test_rejects_implausible_target(client):
    assert start(client, target_minutes=0).status_code == 422
    assert start(client, target_minutes=24 * 60 + 1).status_code == 422


# --- Pauses ---


def pauses_of(response):
    return [(p["started_at"], p["ended_at"]) for p in response.json()["pauses"]]


def pause(client):
    return client.post("/api/session/current/pause")


def resume(client):
    return client.post("/api/session/current/resume")


def test_pausing_marks_the_session_as_paused(client, clock):
    start(client)
    clock.advance(timedelta(hours=2))

    response = pause(client)

    assert response.status_code == 200
    assert pauses_of(response) == [("2026-10-22T10:00:00Z", None)]


def test_resuming_adds_the_pause_to_the_paused_time(client, clock):
    start(client)
    clock.advance(timedelta(hours=2))
    pause(client)
    clock.advance(timedelta(minutes=30))

    response = resume(client)

    assert response.status_code == 200
    assert pauses_of(response) == [("2026-10-22T10:00:00Z", "2026-10-22T10:30:00Z")]


def test_pause_is_visible_on_every_device(client, clock):
    start(client)
    pause(client)

    assert pauses_of(client.get("/api/session/current")) == [("2026-10-22T08:00:00Z", None)]


def test_pausing_twice_keeps_the_first_pause(client, clock):
    """Two devices may send the same intent; the second one changes nothing."""
    start(client)
    pause(client)
    clock.advance(timedelta(minutes=5))

    response = pause(client)

    assert response.status_code == 200
    assert pauses_of(response) == [("2026-10-22T08:00:00Z", None)]


def test_resuming_a_running_session_changes_nothing(client):
    start(client)

    response = resume(client)

    assert response.status_code == 200
    assert pauses_of(response) == []


def test_pausing_without_running_session_is_not_found(client):
    assert pause(client).status_code == 404
    assert resume(client).status_code == 404


def test_ending_a_paused_session_works(client):
    start(client)
    pause(client)

    assert client.post("/api/session/current/end").status_code == 204
    assert client.get("/api/session/current").json() is None


# --- Backdating the start ---


def test_a_session_can_start_in_the_past(client):
    response = client.post(
        "/api/session", json={"target_minutes": 480, "started_at": "2026-10-22T06:15:00Z"}
    )

    assert response.status_code == 201
    assert response.json()["started_at"] == "2026-10-22T06:15:00Z"


def test_start_may_be_slightly_ahead_because_device_clocks_differ(client):
    response = client.post(
        "/api/session", json={"target_minutes": 480, "started_at": "2026-10-22T08:00:59Z"}
    )

    assert response.status_code == 201


def test_rejects_a_start_in_the_future(client):
    response = client.post(
        "/api/session", json={"target_minutes": 480, "started_at": "2026-10-22T08:02:00Z"}
    )

    assert response.status_code == 422


def test_rejects_a_start_more_than_a_day_ago(client):
    response = client.post(
        "/api/session", json={"target_minutes": 480, "started_at": "2026-10-21T07:59:00Z"}
    )

    assert response.status_code == 422


def test_rejects_a_start_without_timezone(client):
    response = client.post(
        "/api/session", json={"target_minutes": 480, "started_at": "2026-10-22T06:15:00"}
    )

    assert response.status_code == 422


# --- Pauses with start and end ---


def add_pause(client, started_at, ended_at):
    return client.post(
        "/api/session/current/pauses", json={"started_at": started_at, "ended_at": ended_at}
    )


def test_a_pause_can_be_planned_ahead(client):
    start(client)

    response = add_pause(client, "2026-10-22T12:00:00Z", "2026-10-22T12:45:00Z")

    assert response.status_code == 201
    assert pauses_of(response) == [("2026-10-22T12:00:00Z", "2026-10-22T12:45:00Z")]


def test_a_pause_can_be_corrected(client):
    start(client)
    pause_id = add_pause(client, "2026-10-22T12:00:00Z", "2026-10-22T12:45:00Z").json()["pauses"][
        0
    ]["id"]

    response = client.put(
        f"/api/session/current/pauses/{pause_id}",
        json={"started_at": "2026-10-22T12:00:00Z", "ended_at": "2026-10-22T13:00:00Z"},
    )

    assert response.status_code == 200
    assert pauses_of(response) == [("2026-10-22T12:00:00Z", "2026-10-22T13:00:00Z")]


def test_a_pause_can_be_deleted(client):
    start(client)
    pause_id = add_pause(client, "2026-10-22T12:00:00Z", "2026-10-22T12:45:00Z").json()["pauses"][
        0
    ]["id"]

    response = client.delete(f"/api/session/current/pauses/{pause_id}")

    assert response.status_code == 200
    assert pauses_of(response) == []


def test_rejects_overlapping_pauses(client):
    start(client)
    add_pause(client, "2026-10-22T12:00:00Z", "2026-10-22T13:00:00Z")

    response = add_pause(client, "2026-10-22T12:30:00Z", "2026-10-22T13:30:00Z")

    assert response.status_code == 422


def test_rejects_a_pause_ending_before_it_starts(client):
    start(client)

    assert add_pause(client, "2026-10-22T13:00:00Z", "2026-10-22T12:00:00Z").status_code == 422


def test_unknown_pause_is_not_found(client):
    start(client)

    assert client.delete("/api/session/current/pauses/999").status_code == 404
    assert (
        client.put(
            "/api/session/current/pauses/999",
            json={"started_at": "2026-10-22T12:00:00Z", "ended_at": "2026-10-22T13:00:00Z"},
        ).status_code
        == 404
    )


# --- Adjusting the remaining time ---


def test_changing_the_target_of_the_running_session(client):
    start(client, target_minutes=450)

    response = client.put("/api/session/current/target", json={"target_minutes": 465})

    assert response.status_code == 200
    assert response.json()["target_minutes"] == 465
    assert response.json()["required_break_minutes"] == 30


def test_rejects_an_impossible_target(client):
    start(client)

    assert client.put("/api/session/current/target", json={"target_minutes": 0}).status_code == 422


def test_session_tells_the_legal_break_rules(client):
    """So clients can preview a changed target, thresholds included, without copying them."""
    start(client)

    rules = client.get("/api/session/current").json()["legal_breaks"]

    assert rules == [
        {"after_minutes": 540, "break_minutes": 45},
        {"after_minutes": 360, "break_minutes": 30},
    ]
