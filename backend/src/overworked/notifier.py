import logging
from typing import Protocol

import httpx

log = logging.getLogger(__name__)


class Notifier(Protocol):
    def send(self, title: str, message: str) -> None: ...


class NtfyNotifier:
    def __init__(
        self,
        base_url: str,
        topic: str,
        token: str | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = httpx.Client(
            base_url=base_url, headers=headers, timeout=10, transport=transport
        )
        self._topic = topic

    def send(self, title: str, message: str) -> None:
        response = self._client.post(
            f"/{self._topic}",
            content=message.encode(),
            headers={"Title": title, "Priority": "max", "Tags": "alarm_clock"},
        )
        response.raise_for_status()


class LogNotifier:
    """Used when no ntfy topic is configured."""

    def send(self, title: str, message: str) -> None:
        log.warning("Notification (no ntfy topic configured): %s - %s", title, message)
