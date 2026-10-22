from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from overworked.alarm import send_due_alarms
from overworked.config import Settings
from overworked.main import create_app

PASSWORD = "correct horse battery staple"
SECRET_KEY = "k" * 32


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        password=PASSWORD,
        secret_key=SECRET_KEY,
        public_url="https://overworked.example",
    )


@pytest.fixture
def client(app):
    # https, because the session cookie is Secure and would not be sent back over http.
    with TestClient(app, base_url="https://testserver") as client:
        yield client


def log_in(client, password=PASSWORD):
    return client.post("/api/login", json={"password": password})


def test_api_requires_login(client):
    response = client.get("/api/session/current")

    assert response.status_code == 401


def test_health_check_needs_no_login(client):
    assert client.get("/api/health").status_code == 200


def test_logged_in_with_the_password(client):
    assert log_in(client).status_code == 204

    assert client.get("/api/session/current").status_code == 200


def test_wrong_password_is_rejected(client):
    response = log_in(client, password="guess")

    assert response.status_code == 401
    assert client.get("/api/session/current").status_code == 401


def test_session_cookie_is_protected_and_lasts_a_year(client):
    cookie = log_in(client).headers["set-cookie"]

    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=lax" in cookie
    assert f"Max-Age={365 * 24 * 3600}" in cookie


def test_a_cookie_with_a_tampered_expiry_is_rejected(client):
    log_in(client)
    user_id, expires, signature = client.cookies["overworked_session"].split(".")
    client.cookies = {"overworked_session": f"{user_id}.{int(expires) + 1}.{signature}"}

    assert client.get("/api/session/current").status_code == 401


def test_login_expires_after_a_year(client, clock):
    log_in(client)
    clock.advance(timedelta(days=365, seconds=1))

    assert client.get("/api/session/current").status_code == 401


def test_changing_the_password_logs_everyone_out(client, settings, clock, notifier):
    log_in(client)
    changed = Settings(
        database_url=settings.database_url, password="a new password", secret_key=SECRET_KEY
    )

    other_app = create_app(
        changed, clock=clock, notifier=notifier, run_alarm_loop=False, login_delay_seconds=0
    )
    with TestClient(other_app, base_url="https://testserver", cookies=client.cookies) as other:
        assert other.get("/api/session/current").status_code == 401


def test_logging_out_ends_the_login(client):
    log_in(client)

    assert client.post("/api/logout").status_code == 204
    assert client.get("/api/session/current").status_code == 401


def test_buttons_in_the_notification_work_without_login(app, client, clock, notifier):
    """ntfy calls them without the login cookie; the secret in the URL is enough."""
    log_in(client)
    client.post("/api/session", json={"target_minutes": 360})
    clock.advance(timedelta(hours=6))
    send_due_alarms(app.state.session_factory, clock(), notifier, "https://overworked.example")
    end_url = notifier.messages[0].actions[0].url.removeprefix("https://overworked.example")
    client.post("/api/logout")

    assert client.post(end_url).status_code == 204
    log_in(client)
    assert client.get("/api/session/current").json() is None
