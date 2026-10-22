import json
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from overworked.alarm import send_due_alarms
from overworked.config import Settings
from overworked.main import create_app

# A test key pair (scripts/generate-vapid-keys.mjs); no secret.
PUBLIC_KEY = (
    "BJWtSgFf0_HHUW1HHY-vNpPZmjK8FpqgPQqsm5rtti0ZFAaqR9ABwrAHYrY9zLyKWGJJIeX9bpY8KG2ZEvCqahA"
)
PRIVATE_KEY = "GMd15A0xXcn_kURPrBPYzD6zTurg_6jyYk_OaLGyXjg"

SUBSCRIPTION = {
    "endpoint": "https://push.example/send/abc",
    "keys": {"p256dh": "BPublicKeyOfTheBrowser", "auth": "authsecret"},
}


class SpyPushService:
    """The browser's push service is an unmanaged out-of-process dependency."""

    def __init__(self):
        self.pushed: list[tuple[str, dict]] = []
        self.gone: set[str] = set()

    def __call__(self, subscription_info, data, **_options):
        endpoint = subscription_info["endpoint"]
        if endpoint in self.gone:
            raise PushGone()
        self.pushed.append((endpoint, json.loads(data)))


class PushGone(Exception):
    """Like pywebpush's WebPushException for an expired subscription."""

    class response:  # noqa: N801
        status_code = 410


@pytest.fixture
def push_service():
    return SpyPushService()


@pytest.fixture
def settings(tmp_path):
    return Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        public_url="https://overworked.example",
        vapid_public_key=PUBLIC_KEY,
        vapid_private_key=PRIVATE_KEY,
    )


@pytest.fixture
def app(settings, clock, notifier, push_service):
    return create_app(
        settings,
        clock=clock,
        notifier=notifier,
        push_service=push_service,
        run_alarm_loop=False,
        login_delay_seconds=0,
    )


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client


def alarm_now(app, client, clock):
    client.post("/api/session", json={"target_minutes": 360})
    clock.advance(timedelta(hours=6))
    send_due_alarms(
        app.state.session_factory, clock(), app.state.notifier, "https://overworked.example"
    )


def test_tells_the_public_key(client):
    assert client.get("/api/push/key").json() == {"public_key": PUBLIC_KEY}


def test_no_key_without_web_push(tmp_path, clock, notifier):
    plain = Settings(database_url=f"sqlite:///{tmp_path / 'plain.db'}")
    with TestClient(create_app(plain, clock=clock, notifier=notifier, run_alarm_loop=False)) as c:
        assert c.get("/api/push/key").json() == {"public_key": None}


def test_alarm_reaches_subscribed_browsers_and_the_phone(
    app, client, clock, notifier, push_service
):
    client.post("/api/push/subscriptions", json=SUBSCRIPTION)

    alarm_now(app, client, clock)

    [(endpoint, payload)] = push_service.pushed
    assert endpoint == SUBSCRIPTION["endpoint"]
    assert payload["type"] == "show"
    assert payload["title"] == "Feierabend!"
    assert payload["tag"] == notifier.messages[0].key
    assert [a["title"] for a in payload["actions"]] == ["Feierabend", "10 min später"]
    assert payload["click"] == "https://overworked.example"
    assert len(notifier.messages) == 1, "ntfy as well"


def test_subscribing_twice_counts_once(app, client, clock, push_service):
    client.post("/api/push/subscriptions", json=SUBSCRIPTION)
    client.post("/api/push/subscriptions", json=SUBSCRIPTION)

    alarm_now(app, client, clock)

    assert len(push_service.pushed) == 1


def test_unsubscribed_browsers_get_nothing(app, client, clock, push_service):
    client.post("/api/push/subscriptions", json=SUBSCRIPTION)
    client.request("DELETE", "/api/push/subscriptions", json={"endpoint": SUBSCRIPTION["endpoint"]})

    alarm_now(app, client, clock)

    assert push_service.pushed == []


def test_forgets_expired_subscriptions(app, client, clock, push_service):
    client.post("/api/push/subscriptions", json=SUBSCRIPTION)
    push_service.gone.add(SUBSCRIPTION["endpoint"])
    alarm_now(app, client, clock)
    push_service.gone.clear()

    clock.advance(timedelta(minutes=2))
    send_due_alarms(app.state.session_factory, clock(), app.state.notifier, None)

    assert push_service.pushed == []


def test_confirming_clears_the_browser_notification(app, client, clock, push_service):
    client.post("/api/push/subscriptions", json=SUBSCRIPTION)
    alarm_now(app, client, clock)

    client.post("/api/session/current/end")

    _, payload = push_service.pushed[-1]
    assert payload == {"type": "clear", "tag": push_service.pushed[0][1]["tag"]}
