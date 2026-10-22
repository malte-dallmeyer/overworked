from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OVERWORKED_", extra="ignore")

    database_url: str = "sqlite:///./data/overworked.db"
    static_dir: str | None = None

    ntfy_url: str = "https://ntfy.sh"
    ntfy_topic: str | None = None
    ntfy_token: str | None = None

    alarm_check_interval_seconds: float = 15
