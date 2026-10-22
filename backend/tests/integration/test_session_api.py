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
        "paused_seconds": 0,
        "paused_since": None,
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


def pause(client):
    return client.post("/api/session/current/pause")


def resume(client):
    return client.post("/api/session/current/resume")


def test_pausing_marks_the_session_as_paused(client, clock):
    start(client)
    clock.advance(timedelta(hours=2))

    response = pause(client)

    assert response.status_code == 200
    assert response.json()["paused_since"] == "2026-10-22T10:00:00Z"


def test_resuming_adds_the_pause_to_the_paused_time(client, clock):
    start(client)
    clock.advance(timedelta(hours=2))
    pause(client)
    clock.advance(timedelta(minutes=30))

    response = resume(client)

    assert response.status_code == 200
    assert response.json()["paused_since"] is None
    assert response.json()["paused_seconds"] == 30 * 60


def test_pause_is_visible_on_every_device(client, clock):
    start(client)
    pause(client)

    assert client.get("/api/session/current").json()["paused_since"] is not None


def test_pausing_twice_keeps_the_first_pause(client, clock):
    """Two devices may send the same intent; the second one changes nothing."""
    start(client)
    pause(client)
    clock.advance(timedelta(minutes=5))

    response = pause(client)

    assert response.status_code == 200
    assert response.json()["paused_since"] == "2026-10-22T08:00:00Z"


def test_resuming_a_running_session_changes_nothing(client):
    start(client)

    response = resume(client)

    assert response.status_code == 200
    assert response.json()["paused_since"] is None


def test_pausing_without_running_session_is_not_found(client):
    assert pause(client).status_code == 404
    assert resume(client).status_code == 404


def test_ending_a_paused_session_works(client):
    start(client)
    pause(client)

    assert client.post("/api/session/current/end").status_code == 204
    assert client.get("/api/session/current").json() is None
