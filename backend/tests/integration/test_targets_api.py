from datetime import timedelta

from sqlalchemy import func, select

from overworked.models import Pause, WorkSession


def work(client, clock, target_minutes, with_pause=False):
    """One session from start to end."""
    client.post("/api/session", json={"target_minutes": target_minutes})
    if with_pause:
        client.post("/api/session/current/pause")
        clock.advance(timedelta(minutes=30))
        client.post("/api/session/current/resume")
    clock.advance(timedelta(hours=1))
    client.post("/api/session/current/end")


def count(app, model):
    with app.state.session_factory() as db:
        return db.scalar(select(func.count()).select_from(model))


def test_quick_targets_before_the_first_session(client):
    assert client.get("/api/targets").json() == {
        "last": 480,
        "choices": [450, 480],
        "max_minutes": 600,
    }


def test_quick_targets_follow_the_sessions_started(client, clock):
    work(client, clock, 300)

    assert client.get("/api/targets").json() == {
        "last": 300,
        "choices": [300, 450, 480],
        "max_minutes": 600,
    }


def test_keeps_only_the_last_five_sessions_with_their_pauses(app, client, clock):
    work(client, clock, 300, with_pause=True)
    for _ in range(6):
        work(client, clock, 420)

    assert count(app, WorkSession) == 5
    assert count(app, Pause) == 0
    assert client.get("/api/targets").json() == {"last": 420, "choices": [420], "max_minutes": 600}
