import json
import logging
from collections.abc import Callable, Sequence

from pywebpush import webpush
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from overworked.models import PushSubscription
from overworked.notifier import Action

log = logging.getLogger(__name__)

# A push older than this is pointless: the alarm repeats anyway.
TTL_SECONDS = 600
GONE = {404, 410}


class WebPushNotifier:
    """Notifications to subscribed browsers; the service worker (frontend/public/sw.js) shows
    them. Best effort: ntfy is the phone's alarm, so failures are only logged."""

    def __init__(
        self,
        session_factory: sessionmaker[Session],
        private_key: str,
        subject: str,
        push: Callable[..., object] = webpush,
    ) -> None:
        self._session_factory = session_factory
        self._private_key = private_key
        self._subject = subject
        self._push = push

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
        payload = {
            "type": "show",
            "title": title,
            "body": message,
            "tag": key,
            "urgent": urgent,
            "click": click,
            "actions": [
                {"action": f"action-{i}", "title": a.label, "url": a.url}
                for i, a in enumerate(actions)
            ],
        }
        self._push_all(payload, urgent, user_id)

    def clear(self, key: str, *, user_id: int | None = None) -> None:
        self._push_all({"type": "clear", "tag": key}, False, user_id)

    def _push_all(self, payload: dict, urgent: bool, user_id: int | None) -> None:
        with self._session_factory() as db:
            query = select(PushSubscription)
            if user_id is not None:
                query = query.where(PushSubscription.user_id == user_id)
            for subscription in db.scalars(query).all():
                try:
                    self._push(
                        subscription_info={
                            "endpoint": subscription.endpoint,
                            "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                        },
                        data=json.dumps(payload),
                        vapid_private_key=self._private_key,
                        vapid_claims={"sub": self._subject},
                        ttl=TTL_SECONDS,
                        headers={"Urgency": "high" if urgent else "normal"},
                    )
                except Exception as error:
                    status = getattr(getattr(error, "response", None), "status_code", None)
                    if status in GONE:
                        log.info("Forgetting expired push subscription %s", subscription.id)
                        db.delete(subscription)
                    else:
                        log.exception("Web push to subscription %s failed", subscription.id)
            db.commit()
