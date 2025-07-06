import asyncio
import json

import sys
import types
import os
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from aiokafka.errors import KafkaError
except Exception:  # pragma: no cover - fallback when aiokafka isn't installed
    aiokafka = types.ModuleType("aiokafka")
    errors = types.ModuleType("aiokafka.errors")
    prometheus_client = types.ModuleType("prometheus_client")
    aiohttp = types.ModuleType("aiohttp")
    aiohttp.web = types.ModuleType("aiohttp.web")
    aiohttp.web.Application = object
    aiohttp.web.AppRunner = object
    aiohttp.web.TCPSite = object
    aiohttp.web.Response = object
    aiohttp.web.Request = object
    class DummyMetric:
        def __init__(self, *a, **kw):
            pass
        def inc(self, *a, **k):
            pass
        def set(self, *a, **k):
            pass

    prometheus_client.Gauge = DummyMetric
    prometheus_client.Counter = DummyMetric
    prometheus_client.CONTENT_TYPE_LATEST = "text/plain"
    prometheus_client.CollectorRegistry = object
    prometheus_client.generate_latest = lambda *a, **kw: b""
    structlog = types.ModuleType("structlog")
    structlog.processors = types.SimpleNamespace(JSONRenderer=lambda: None)
    structlog.BoundLogger = object
    def get_logger():
        class Logger:
            def bind(self, **kw):
                return self
            def warning(self, *a, **k):
                pass
            def error(self, *a, **k):
                pass
        return Logger()
    structlog.get_logger = get_logger
    structlog.configure = lambda *a, **k: None
    pydantic = types.ModuleType("pydantic")
    class BaseSettings:
        pass
    class Field:
        def __init__(self, default=None, env=None):
            pass
    pydantic.BaseSettings = BaseSettings
    pydantic.Field = Field

    class KafkaError(Exception):
        pass

    class Dummy:
        def __init__(self, *a, **k):
            pass

    aiokafka.AIOKafkaProducer = Dummy
    aiokafka.AIOKafkaConsumer = Dummy
    aiokafka.TopicPartition = Dummy
    aiokafka.OffsetAndMetadata = Dummy
    errors.KafkaError = KafkaError
    sys.modules.setdefault("aiokafka", aiokafka)
    sys.modules.setdefault("aiokafka.errors", errors)
    sys.modules.setdefault("prometheus_client", prometheus_client)
    sys.modules.setdefault("aiohttp", aiohttp)
    sys.modules.setdefault("structlog", structlog)
    sys.modules.setdefault("pydantic", pydantic)

from ai_service.kafka_orchestrator import process_kafka_message


class KafkaMockProducer:
    def __init__(self, fail_first=False):
        self.fail_first = fail_first
        self.calls = 0
        self.sent = []
        self.offsets = []
        self.aborted = 0
        self.commits = 0

    def begin_transaction(self):
        pass

    async def send_and_wait(self, topic, value, headers=None):
        self.calls += 1
        if self.fail_first and self.calls == 1:
            raise KafkaError("temporary error")
        self.sent.append((topic, value, headers))

    async def send_offsets_to_transaction(self, offsets, group_id):
        self.offsets.append((offsets, group_id))

    async def commit_transaction(self):
        self.commits += 1

    async def abort_transaction(self):
        self.aborted += 1


class Message:
    def __init__(self, value, topic="rau_events", partition=0, offset=0):
        self.value = value
        self.topic = topic
        self.partition = partition
        self.offset = offset


class KafkaMockConsumer:
    def __init__(self, group_id="test-group"):
        self._group_id = group_id


class DummyLogger:
    def warning(self, *a, **k):
        pass

    def error(self, *a, **k):
        pass


def test_at_least_once_delivery():
    producer = KafkaMockProducer(fail_first=True)
    consumer = KafkaMockConsumer()
    msg = Message(json.dumps({"foo": "bar"}).encode())
    asyncio.run(process_kafka_message(msg, producer, consumer._group_id, DummyLogger()))
    assert len(producer.sent) == 1
    assert producer.commits == 1
    assert producer.aborted == 1


def test_bad_json_to_dlq():
    producer = KafkaMockProducer()
    consumer = KafkaMockConsumer()
    bad = Message(b"not-json")
    asyncio.run(process_kafka_message(bad, producer, consumer._group_id, DummyLogger()))
    topic, value, headers = producer.sent[0]
    assert topic == "rau_events_dlq"
    assert value == b"not-json"
    assert headers == [("reason", b"deserialization_error")]
