import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import httpx

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Action:
    """A button in the notification that POSTs to `url`."""

    label: str
    url: str


class Notifier(Protocol):
    def send(
        self,
        title: str,
        message: str,
        *,
        key: str | None = None,
        actions: Sequence[Action] = (),
        click: str | None = None,
        urgent: bool = True,
        user_id: int | None = None,
    ) -> None:
        """`key` groups messages: a later one replaces the earlier one on the device.
        Urgent messages ring (and keep ringing, if the ntfy app is set up for it).
        `user_id` picks the user's devices where a notifier knows them (web push)."""
        ...

    def clear(self, key: str, *, user_id: int | None = None) -> None:
        """Removes the notification sent with `key` from the devices."""
        ...


class CompositeNotifier:
    """Sends to each notifier (ntfy, web push); fails only if all of them fail."""

    def __init__(self, *notifiers: Notifier) -> None:
        self._notifiers = notifiers

    def _each(self, call) -> None:
        errors = []
        for notifier in self._notifiers:
            try:
                call(notifier)
            except Exception as error:
                log.exception("%s failed", type(notifier).__name__)
                errors.append(error)
        if errors and len(errors) == len(self._notifiers):
            raise errors[0]

    def send(self, title: str, message: str, **options) -> None:
        self._each(lambda n: n.send(title, message, **options))

    def clear(self, key: str, **options) -> None:
        self._each(lambda n: n.clear(key, **options))


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

    def send(
        self,
        title: str,
        message: str,
        *,
        key: str | None = None,
        actions: Sequence[Action] = (),
        click: str | None = None,
        urgent: bool = True,
        user_id: int | None = None,
    ) -> None:
        # As JSON: HTTP headers are ASCII only, and "10 min später" is not.
        message_json: dict = {
            "topic": self._topic,
            "title": title,
            "message": message,
            "priority": 5 if urgent else 3,
        }
        if urgent:
            message_json["tags"] = ["alarm_clock"]
        if key:
            message_json["sequence_id"] = key
        if actions:
            message_json["actions"] = [
                {"action": "http", "label": a.label, "url": a.url, "method": "POST", "clear": True}
                for a in actions
            ]
        if click:
            message_json["click"] = click
        self._client.post("/", json=message_json).raise_for_status()

    def clear(self, key: str, *, user_id: int | None = None) -> None:
        self._client.put(f"/{self._topic}/{key}/clear").raise_for_status()


class LogNotifier:
    """Used when no ntfy topic is configured."""

    def send(self, title: str, message: str, **_options) -> None:
        log.warning("Notification (no ntfy topic configured): %s - %s", title, message)

    def clear(self, key: str, **_options) -> None:
        pass
