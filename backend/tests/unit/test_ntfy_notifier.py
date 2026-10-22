import json

import httpx

from overworked.notifier import Action, NtfyNotifier


def capture_requests():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200)

    return requests, httpx.MockTransport(handler)


def published(requests) -> dict:
    """ntfy's JSON publishing: one POST to the server root with all fields in the body."""
    [request] = requests
    assert str(request.url) == "https://ntfy.example/"
    return json.loads(request.content)


def notifier_with(transport, **options):
    return NtfyNotifier("https://ntfy.example", "my-topic", transport=transport, **options)


def test_publishes_max_priority_message_to_topic():
    requests, transport = capture_requests()

    notifier_with(transport).send("Feierabend!", "Sollzeit erreicht")

    message = published(requests)
    assert message["topic"] == "my-topic"
    assert message["title"] == "Feierabend!"
    assert message["message"] == "Sollzeit erreicht"
    assert message["priority"] == 5
    assert message["tags"] == ["alarm_clock"]
    assert "Authorization" not in requests[0].headers


def test_sends_access_token_when_configured():
    requests, transport = capture_requests()

    notifier_with(transport, token="tk_secret").send("a", "b")

    assert requests[0].headers["Authorization"] == "Bearer tk_secret"


def test_umlauts_work_everywhere():
    """HTTP headers are ASCII only, which is why the message goes as JSON."""
    requests, transport = capture_requests()

    notifier_with(transport).send(
        "Schön", "Gemütlich", actions=[Action("10 min später", "https://a")]
    )

    message = published(requests)
    assert (message["title"], message["message"]) == ("Schön", "Gemütlich")
    assert message["actions"][0]["label"] == "10 min später"


def test_buttons_call_their_url_and_clear_the_notification():
    requests, transport = capture_requests()

    notifier_with(transport).send(
        "a",
        "b",
        actions=[Action("Feierabend", "https://app/end"), Action("10 min", "https://app/snooze")],
    )

    assert published(requests)["actions"] == [
        {
            "action": "http",
            "label": "Feierabend",
            "url": "https://app/end",
            "method": "POST",
            "clear": True,
        },
        {
            "action": "http",
            "label": "10 min",
            "url": "https://app/snooze",
            "method": "POST",
            "clear": True,
        },
    ]


def test_tapping_the_notification_opens_the_app():
    requests, transport = capture_requests()

    notifier_with(transport).send("a", "b", click="https://app/")

    assert published(requests)["click"] == "https://app/"


def test_a_key_makes_later_messages_replace_the_earlier_one():
    requests, transport = capture_requests()

    notifier_with(transport).send("a", "b", key="session-key")

    assert published(requests)["sequence_id"] == "session-key"


def test_a_quiet_message_does_not_ring():
    requests, transport = capture_requests()

    notifier_with(transport).send("a", "b", urgent=False)

    message = published(requests)
    assert message["priority"] == 3
    assert "tags" not in message


def test_clears_the_notification_from_the_phone():
    requests, transport = capture_requests()

    notifier_with(transport).clear("session-key")

    [request] = requests
    assert request.method == "PUT"
    assert str(request.url) == "https://ntfy.example/my-topic/session-key/clear"
