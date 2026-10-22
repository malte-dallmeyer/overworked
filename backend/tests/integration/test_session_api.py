def start(client, target_minutes=480):
    return client.post("/api/session", json={"target_minutes": target_minutes})


def test_no_current_session_initially(client):
    response = client.get("/api/session/current")

    assert response.status_code == 200
    assert response.json() is None


def test_starting_a_session_returns_its_end_time(client):
    response = start(client, target_minutes=450)

    assert response.status_code == 201
    assert response.json() == {
        "started_at": "2026-10-22T08:00:00Z",
        "target_minutes": 450,
        "end_at": "2026-10-22T15:30:00Z",
    }


def test_started_session_is_current(client):
    start(client, target_minutes=450)

    response = client.get("/api/session/current")

    assert response.json()["end_at"] == "2026-10-22T15:30:00Z"


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
