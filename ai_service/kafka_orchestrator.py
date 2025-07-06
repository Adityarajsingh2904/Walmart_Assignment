import asyncio
import json
import logging
import signal
from typing import Any, Tuple

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer, TopicPartition, OffsetAndMetadata
from aiokafka.errors import KafkaError
from prometheus_client import Gauge, Counter, CONTENT_TYPE_LATEST, CollectorRegistry, generate_latest
from aiohttp import web
import structlog

from .settings import Settings
from .pipeline import process_event


# Prometheus metrics
registry = CollectorRegistry()
QUEUE_GAUGE = Gauge("in_flight_queue", "In-flight queue size", registry=registry)
LAG_GAUGE = Gauge("consumer_lag", "Kafka consumer lag", registry=registry)
PROCESSED_COUNTER = Counter("events_processed_total", "Processed events", registry=registry)


def configure_logging(env: str) -> structlog.BoundLogger:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    structlog.configure(processors=[structlog.processors.JSONRenderer()])
    return structlog.get_logger().bind(service="ai-orchestrator", environment=env)


async def metrics_app() -> web.AppRunner:
    async def handle(_request: web.Request) -> web.Response:
        data = generate_latest(registry)
        return web.Response(body=data, content_type=CONTENT_TYPE_LATEST)

    app = web.Application()
    app.router.add_get("/metrics", handle)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 9000)
    await site.start()
    return runner


async def process_kafka_message(
    msg: Any,
    producer: AIOKafkaProducer,
    group_id: str,
    logger: structlog.BoundLogger,
) -> None:
    attempts = 0
    while True:
        producer.begin_transaction()
        try:
            try:
                event_dict = json.loads(msg.value.decode("utf-8"))
            except json.JSONDecodeError:
                await producer.send_and_wait(
                    "rau_events_dlq",
                    msg.value,
                    headers=[("reason", b"deserialization_error")],
                )
                offsets = {
                    TopicPartition(msg.topic, msg.partition): OffsetAndMetadata(
                        msg.offset + 1, None
                    )
                }
                await producer.send_offsets_to_transaction(offsets, group_id)
                await producer.commit_transaction()
                return

            topic, value, headers = await process_event(event_dict)
            headers = [
                (str(k), str(v).encode("utf-8")) for k, v in (headers or {}).items()
            ]
            await producer.send_and_wait(
                topic, json.dumps(value).encode("utf-8"), headers=headers
            )
            offsets = {
                TopicPartition(msg.topic, msg.partition): OffsetAndMetadata(
                    msg.offset + 1, None
                )
            }
            await producer.send_offsets_to_transaction(offsets, group_id)
            await producer.commit_transaction()
            PROCESSED_COUNTER.inc()
            return
        except KafkaError as e:
            await producer.abort_transaction()
            attempts += 1
            if attempts > 3:
                logger.error("kafka_error", error=str(e), attempt=attempts)
                raise
            wait = 2 ** attempts
            logger.warning("kafka_retry", attempt=attempts, wait=wait)
            await asyncio.sleep(wait)


async def consume_loop(
    consumer: AIOKafkaConsumer,
    queue: asyncio.Queue,
    stop_event: asyncio.Event,
    logger: structlog.BoundLogger,
) -> None:
    while not stop_event.is_set():
        msg = await consumer.getone()
        await queue.put(msg)
        QUEUE_GAUGE.set(queue.qsize())
        tp = TopicPartition(msg.topic, msg.partition)
        try:
            lag = consumer.highwater(tp) - msg.offset - 1
            LAG_GAUGE.set(lag)
        except Exception:
            pass
        if queue.qsize() > 10000:
            consumer.pause(*consumer.assignment())
        elif queue.qsize() < 1000:
            consumer.resume(*consumer.paused())
    logger.info("consume_loop_stopped")


async def process_loop(
    consumer: AIOKafkaConsumer,
    producer: AIOKafkaProducer,
    queue: asyncio.Queue,
    stop_event: asyncio.Event,
    logger: structlog.BoundLogger,
) -> None:
    while not stop_event.is_set() or not queue.empty():
        msg = await queue.get()
        try:
            await process_kafka_message(msg, producer, consumer._group_id, logger)
        except Exception as e:
            logger.error("process_error", error=str(e))
        finally:
            queue.task_done()
            QUEUE_GAUGE.set(queue.qsize())
    logger.info("process_loop_stopped")


async def shutdown(
    consumer: AIOKafkaConsumer,
    producer: AIOKafkaProducer,
    runner: web.AppRunner,
    stop_event: asyncio.Event,
    tasks: Tuple[asyncio.Task, ...],
    logger: structlog.BoundLogger,
) -> None:
    stop_event.set()
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    await consumer.stop()
    await producer.stop()
    await runner.cleanup()
    logger.info("shutdown_complete")


async def main() -> None:
    settings = Settings()
    logger = configure_logging(settings.ENVIRONMENT)

    consumer = AIOKafkaConsumer(
        "rau_events",
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="ai-orchestrator",
        enable_auto_commit=False,
        isolation_level="read_committed",
        security_protocol=settings.KAFKA_SECURITY_PROTOCOL,
        sasl_mechanism=settings.KAFKA_SASL_MECHANISM,
        sasl_plain_username=settings.KAFKA_USERNAME,
        sasl_plain_password=settings.KAFKA_PASSWORD,
        ssl_cafile=settings.KAFKA_SSL_CAFILE,
    )

    producer = AIOKafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        transactional_id="trustvault-ai",
        security_protocol=settings.KAFKA_SECURITY_PROTOCOL,
        sasl_mechanism=settings.KAFKA_SASL_MECHANISM,
        sasl_plain_username=settings.KAFKA_USERNAME,
        sasl_plain_password=settings.KAFKA_PASSWORD,
        ssl_cafile=settings.KAFKA_SSL_CAFILE,
    )

    await consumer.start()
    await producer.start()

    runner = await metrics_app()

    queue: asyncio.Queue = asyncio.Queue()
    stop_event = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    consume_task = asyncio.create_task(consume_loop(consumer, queue, stop_event, logger))
    process_task = asyncio.create_task(process_loop(consumer, producer, queue, stop_event, logger))

    try:
        await stop_event.wait()
    finally:
        await shutdown(
            consumer,
            producer,
            runner,
            stop_event,
            (consume_task, process_task),
            logger,
        )


if __name__ == "__main__":
    asyncio.run(main())
