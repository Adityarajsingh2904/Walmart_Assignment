from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration for Kafka orchestrator."""

    kafka_bootstrap_servers: str = Field("localhost:9092", alias="KAFKA_BOOTSTRAP_SERVERS")
    group_id: str = Field("ai-service", alias="KAFKA_GROUP_ID")
    input_topic: str = Field("rau_events", alias="KAFKA_INPUT_TOPIC")
    dlq_topic: str = Field("rau_events_dlq", alias="KAFKA_DLQ_TOPIC")
    output_topic: str = Field("alerts", alias="KAFKA_OUTPUT_TOPIC")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
