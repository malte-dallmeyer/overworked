from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OVERWORKED_", extra="ignore")

    database_url: str = "sqlite:///./data/overworked.db"
    static_dir: str | None = None

    ntfy_url: str = "https://ntfy.sh"
    ntfy_topic: str | None = None
    ntfy_token: str | None = None

    alarm_check_interval_seconds: float = 15
    # Address of this instance, e.g. https://overworked.example.com. Needed for the buttons in
    # the notification and for opening the app from it; without it there are none.
    public_url: str | None = None

    # Web push to browsers (desktop), see scripts/generate-vapid-keys.mjs. Off without keys.
    vapid_public_key: str | None = None
    vapid_private_key: SecretStr | None = None
    # Contact for push services; defaults to public_url.
    vapid_subject: str | None = None

    @property
    def web_push_enabled(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key)

    # Login. Without a password the API is open, which is meant for local development only.
    password: SecretStr | None = None
    secret_key: SecretStr | None = None
    require_password: bool = False

    @property
    def login_required(self) -> bool:
        return bool(self.password and self.password.get_secret_value())

    @model_validator(mode="after")
    def _check_login(self) -> "Settings":
        if self.require_password and not self.login_required:
            raise ValueError("OVERWORKED_PASSWORD must be set: this instance requires a login")
        if self.login_required:
            key = self.secret_key.get_secret_value() if self.secret_key else ""
            if len(key) < MIN_SECRET_KEY_LENGTH:
                raise ValueError(
                    f"OVERWORKED_SECRET_KEY must have at least {MIN_SECRET_KEY_LENGTH} characters "
                    "when a password is set, e.g. `openssl rand -hex 32`"
                )
        return self
