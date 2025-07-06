from __future__ import annotations

import json
import os
from functools import lru_cache


@lru_cache(maxsize=None)
def get_db_dsn() -> str:
    """Return Postgres DSN from environment or defaults."""
    dsn = os.getenv("DATABASE_DSN")
    if dsn:
        return dsn
    secret_json = os.getenv("DB_SECRET_JSON")
    if secret_json:
        try:
            return json.loads(secret_json)["dsn"]
        except Exception:
            pass
    return "postgresql://postgres:postgres@localhost/postgres"


@lru_cache(maxsize=None)
def get_kafka_conf() -> dict[str, str]:
    """Return Kafka configuration dictionary."""
    conf_env = os.getenv("KAFKA_CONF_JSON")
    if conf_env:
        try:
            return json.loads(conf_env)
        except Exception:
            pass
    bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    return {"bootstrap.servers": bootstrap}
