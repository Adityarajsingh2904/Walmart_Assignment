from __future__ import annotations

import json
import time
import uuid

import asyncpg
from confluent_kafka import Producer
from pydantic import BaseModel
import structlog

from .normalize import NormalizedEvent
from .scoring_engine import ScoreResult
from .labeler import GPTLabel
from .metrics import DB_LATENCY_SECONDS, KAFKA_PUBLISH_SECONDS, FAILED_TX_TOTAL
from .secrets import get_db_dsn, get_kafka_conf


class AlertIn(BaseModel):
    event: NormalizedEvent
    scores: ScoreResult
    label: GPTLabel


class AlertEmitter:
    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None
        self._stmt: asyncpg.PreparedStatement | None = None
        self._producer: Producer | None = None
        structlog.configure(processors=[structlog.processors.JSONRenderer()])
        self._logger = structlog.get_logger().bind(service="alert-emitter")

    # ------------------------------------------------------------------
    async def init(self) -> None:
        """Initialize DB pool and Kafka producer."""
        dsn = get_db_dsn()
        self._pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=4)
        async with self._pool.acquire() as conn:
            self._stmt = await conn.prepare(
                """
                INSERT INTO public.alerts (
                    id, event_id, class, severity, reason, score,
                    event_ts, raw, gpt_tokens
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9
                ) ON CONFLICT (event_id) DO NOTHING RETURNING id
                """
            )
        conf = {
            **get_kafka_conf(),
            "transactional.id": "trustvault-alert-emitter",
            "enable.idempotence": True,
            "acks": "all",
            "linger.ms": 10,
            "compression.type": "zstd",
        }
        self._producer = Producer(conf)
        self._producer.init_transactions()

    async def close(self) -> None:
        if self._producer is not None:
            try:
                self._producer.flush(5000)
            except Exception:
                pass
            self._producer = None
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    # ------------------------------------------------------------------
    async def emit(self, alert: AlertIn) -> None:
        assert self._producer is not None and self._pool is not None
        producer = self._producer
        pool = self._pool
        key = alert.event.id.encode()
        payload = {
            "event": alert.event.model_dump(mode="json"),
            "scores": alert.scores.__dict__,
            "label": alert.label.model_dump(by_alias=True),
        }
        value = json.dumps(payload, separators=(",", ":")).encode()
        alert_id = str(uuid.uuid4())
        logger = self._logger.bind(alert_id=alert_id, severity=alert.label.severity)

        producer.begin_transaction()
        inserted = False
        try:
            db_start = time.perf_counter()
            async with pool.acquire() as conn:
                res = await conn.fetchval(
                    self._stmt,
                    alert_id,
                    alert.event.id,
                    alert.label.class_,
                    alert.label.severity,
                    alert.label.reason,
                    alert.scores.aggregate,
                    alert.event.timestamp,
                    json.dumps(alert.event.model_dump(mode="json"), separators=(",", ":")),
                    alert.label.gpt_tokens,
                )
            inserted = res is not None
            DB_LATENCY_SECONDS.labels(outcome="success").observe(time.perf_counter() - db_start)
        except Exception:
            DB_LATENCY_SECONDS.labels(outcome="failure").observe(time.perf_counter() - db_start)
            FAILED_TX_TOTAL.labels(stage="db").inc()
            producer.abort_transaction()
            await self._send_dlq(key, value, reason="db_failure")
            logger.error("db_error", tx_state="aborted")
            return

        try:
            k_start = time.perf_counter()
            producer.produce("alerts", key=key, value=value)
            producer.commit_transaction()
            KAFKA_PUBLISH_SECONDS.labels(outcome="success").observe(time.perf_counter() - k_start)
            logger.info("emitted", tx_state="committed")
        except Exception:
            KAFKA_PUBLISH_SECONDS.labels(outcome="failure").observe(time.perf_counter() - k_start)
            FAILED_TX_TOTAL.labels(stage="kafka").inc()
            producer.abort_transaction()
            if inserted:
                async with pool.acquire() as conn:
                    await conn.execute("DELETE FROM public.alerts WHERE event_id=$1", alert.event.id)
            await self._send_dlq(key, value, reason="kafka_failure")
            logger.error("kafka_error", tx_state="aborted")

    async def _send_dlq(self, key: bytes, value: bytes, *, reason: str) -> None:
        try:
            assert self._producer is not None
            self._producer.produce(
                "alerts_dlq",
                key=key,
                value=value,
                headers=[("reason", reason.encode())],
            )
            self._producer.flush()
        except Exception:
            pass


# module level singleton
emitter = AlertEmitter()
