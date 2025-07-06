from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment or .env."""

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str
    KAFKA_SASL_USERNAME: str | None = None
    KAFKA_SASL_PASSWORD: str | None = None
    KAFKA_SSL_CA: str | None = None   # path to CA file

    # Postgres
    PG_HOST: str
    PG_PORT: int = 5432
    PG_DB: str
    PG_USER: str
    PG_PASS: str

    # OpenAI / models
    OPENAI_API_KEY: str
    MODEL_DIR: str = "models/"

    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = False

    def __repr__(self) -> str:  # pragma: no cover - simple utility
        data = self.model_dump()
        for field in {"KAFKA_SASL_PASSWORD", "PG_PASS", "OPENAI_API_KEY"}:
            if field in data and data[field] is not None:
                data[field] = "***"
        items = ", ".join(f"{k}={v!r}" for k, v in data.items())
        return f"Settings({items})"


# module level singleton
settings = Settings.model_validate({})
