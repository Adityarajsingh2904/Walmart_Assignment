"""Kafka Consumer and Orchestrator for AI service."""
from __future__ import annotations

import asyncio
import json
import signal
from typing import Any, Dict, List, Optional, Set

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer, ConsumerRecord
from aiokafka.structs import OffsetAndMetadata, TopicPartition
from prometheus_client import Counter, Gauge, start_http_server
from pydantic import BaseModel
import structlog

from .settings import get_settings, Settings


logger = structlog.get_logger().bind(phase="ai-service", component="orchestrator")


class NormalizedEvent(BaseModel):
    """Normalized representation of an incoming event."""

    id: str
    payload: Dict[str, Any]


class ScoreResult(BaseModel):
    """Score produced by scoring engine."""

    score: float


class GPTLabel(BaseModel):
    """Label produced by GPT model."""

    label: str


# Metrics
PROCESSED_TOTAL = Counter("processed_total", "Total processed messages")
FAILURES_TOTAL = Counter("failures_total", "Total failed messages")
CONSUMER_LAG = Gauge("consumer_lag", "Current consumer lag")


async def normalize_event(raw: Dict[str, Any]) -> NormalizedEvent:
    """Stub normalizer that wraps the raw payload."""

    return NormalizedEvent(id=str(raw.get("id", "unknown")), payload=raw)


async def score_event(event: NormalizedEvent) -> ScoreResult:
    """Stub scoring engine."""

    # Example scoring logic
    return ScoreResult(score=0.5)


async def label_event(event: NormalizedEvent, score: ScoreResult) -> GPTLabel:
    """Stub GPT labeler."""

    return GPTLabel(label="ok")


async def emit_alert(event: NormalizedEvent, score: ScoreResult, label: GPTLabel) -> None:
    """Stub alert emitter."""

    logger.info("Alert emitted", event_id=event.id, score=score.score, label=label.label)


async def _handle_message(
    record: ConsumerRecord,
    consumer: AIOKafkaConsumer,
    producer: AIOKafkaProducer,
    settings: Settings,
) -> None:
    """Process a single Kafka record."""

    tp = TopicPartition(record.topic, record.partition)
    try:
        raw = json.loads(record.value.decode("utf-8"))
    except Exception:
        logger.exception("Deserialization error")
        await producer.begin_transaction()
        await producer.send(
            settings.dlq_topic,
            record.value,
            headers=[("reason", b"deserialization_error")],
        )
        await producer.send_offsets_to_transaction({tp: OffsetAndMetadata(record.offset + 1, None)}, settings.group_id)
        await producer.commit_transaction()
        FAILURES_TOTAL.inc()
        return

    await producer.begin_transaction()
    try:
        normalized = await normalize_event(raw)
        scored = await score_event(normalized)
        label = await label_event(normalized, scored)
        await emit_alert(normalized, scored, label)
        await producer.send(
            settings.output_topic,
            json.dumps({"id": normalized.id, "score": scored.score, "label": label.label}).encode(),
        )

        await producer.send_offsets_to_transaction({tp: OffsetAndMetadata(record.offset + 1, None)}, settings.group_id)
        await producer.commit_transaction()
        PROCESSED_TOTAL.inc()
    except Exception:
        logger.exception("Processing failed")
        await producer.abort_transaction()
        FAILURES_TOTAL.inc()

    # update lag metric
    highwater = consumer.highwater(tp)
    if highwater is not None:
        lag = highwater - record.offset - 1
        CONSUMER_LAG.set(max(lag, 0))


async def _consumer_loop(consumer: AIOKafkaConsumer, producer: AIOKafkaProducer, settings: Settings, stop_event: asyncio.Event) -> None:
    """Consume messages from Kafka and process them."""

    in_flight: Set[asyncio.Task[None]] = set()

    while not stop_event.is_set():
        try:
            record = await asyncio.wait_for(consumer.getone(), timeout=1.0)
        except asyncio.TimeoutError:
            record = None
        if record is None:
            continue

        task = asyncio.create_task(
            _handle_message(record, consumer, producer, settings)
        )
        in_flight.add(task)
        task.add_done_callback(lambda t: in_flight.discard(t))

        if len(in_flight) > 10000:
            for tp in consumer.assignment():
                consumer.pause(tp)
        elif len(in_flight) < 1000:
            for tp in consumer.paused():
                consumer.resume(tp)

    # wait for outstanding tasks
    if in_flight:
        await asyncio.wait(in_flight)


async def main() -> None:
    """Entry point for running the orchestrator."""

    settings = get_settings()
    structlog.configure(processors=[structlog.processors.JSONRenderer()])

    start_http_server(8001)

    consumer = AIOKafkaConsumer(
        settings.input_topic,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.group_id,
        enable_auto_commit=False,
    )

    producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap_servers,
        transactional_id="ai-service-txn",
    )

    await consumer.start()
    await producer.start()
    await producer.init_transactions()

    stop_event = asyncio.Event()

    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    try:
        await _consumer_loop(consumer, producer, settings, stop_event)
    finally:
        await producer.stop()
        await consumer.stop()


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main())
