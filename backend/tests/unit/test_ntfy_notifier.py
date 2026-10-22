import httpx

from overworked.notifier import NtfyNotifier


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
