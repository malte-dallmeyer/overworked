import httpx

from overworked.notifier import Action, NtfyNotifier


def capture_requests():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200)

    return requests, httpx.MockTransport(handler)


def test_publishes_max_priority_message_to_topic():
    requests, transport = capture_requests()
    notifier = NtfyNotifier("https://ntfy.example", "my-topic", transport=transport)

    notifier.send("Feierabend!", "Sollzeit erreicht")

    [request] = requests
    assert str(request.url) == "https://ntfy.example/my-topic"
    assert request.headers["Title"] == "Feierabend!"
    assert request.headers["Priority"] == "max"
    assert request.content == b"Sollzeit erreicht"
    assert "Authorization" not in request.headers


def test_sends_access_token_when_configured():
    requests, transport = capture_requests()
    notifier = NtfyNotifier("https://ntfy.example", "t", token="tk_secret", transport=transport)

    notifier.send("a", "b")

    assert requests[0].headers["Authorization"] == "Bearer tk_secret"


def test_buttons_call_their_url_and_clear_the_notification():
    requests, transport = capture_requests()
    notifier = NtfyNotifier("https://ntfy.example", "t", transport=transport)

    notifier.send(
        "a",
        "b",
        actions=[Action("Feierabend", "https://app/end"), Action("10 min", "https://app/snooze")],
    )

    assert requests[0].headers["Actions"] == (
        "http, Feierabend, https://app/end, method=POST, clear=true; "
        "http, 10 min, https://app/snooze, method=POST, clear=true"
    )


def test_tapping_the_notification_opens_the_app():
    requests, transport = capture_requests()
    notifier = NtfyNotifier("https://ntfy.example", "t", transport=transport)

    notifier.send("a", "b", click="https://app/")

    assert requests[0].headers["Click"] == "https://app/"


def test_a_key_makes_later_messages_replace_the_earlier_one():
    requests, transport = capture_requests()
    notifier = NtfyNotifier("https://ntfy.example", "t", transport=transport)

    notifier.send("a", "b", key="session-key")

    assert requests[0].headers["X-Sequence-ID"] == "session-key"


def test_a_quiet_message_does_not_ring():
    requests, transport = capture_requests()
    notifier = NtfyNotifier("https://ntfy.example", "t", transport=transport)

    notifier.send("a", "b", urgent=False)

    assert requests[0].headers["Priority"] == "default"
    assert "Tags" not in requests[0].headers


def test_clears_the_notification_from_the_phone():
    requests, transport = capture_requests()
    notifier = NtfyNotifier("https://ntfy.example", "t", transport=transport)

    notifier.clear("session-key")

    [request] = requests
    assert request.method == "PUT"
    assert str(request.url) == "https://ntfy.example/t/session-key/clear"
