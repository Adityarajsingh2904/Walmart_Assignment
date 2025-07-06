import asyncio
import json
import sys
from pathlib import Path
from typing import List

# Ensure project root is on the path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from aiokafka.structs import ConsumerRecord, TopicPartition

from ai_service import kafka_orchestrator as ko
from ai_service.settings import get_settings


class KafkaMockProducer:
    def __init__(self):
        self.sent: List[tuple] = []
        self.offsets = []

    async def start(self):
        pass

    async def stop(self):
        pass

    async def init_transactions(self):
        pass

    async def begin_transaction(self):
        pass

    async def send(self, topic, value, headers=None):
        self.sent.append((topic, value, headers))

    async def send_offsets_to_transaction(self, offsets, group_id):
        self.offsets.append(offsets)

    async def commit_transaction(self):
        pass

    async def abort_transaction(self):
        pass


class KafkaMockConsumer:
    def __init__(self, records):
        self.records = records
        self._assignment = {TopicPartition("rau_events", 0)}
        self._paused = set()

    async def start(self):
        pass

    async def stop(self):
        pass

    def highwater(self, tp):
        return len(self.records)

    async def getone(self):
        if not self.records:
            raise asyncio.TimeoutError()
        return self.records.pop(0)

    def assignment(self):
        return self._assignment

    def paused(self):
        return self._paused

    def pause(self, tp):
        self._paused.add(tp)

    def resume(self, tp):
        self._paused.discard(tp)


@pytest.fixture
def kafka_mock(monkeypatch):
    record = ConsumerRecord(
        topic="rau_events",
        partition=0,
        offset=0,
        timestamp=0,
        timestamp_type=0,
        key=None,
        value=json.dumps({"id": "1"}).encode(),
        checksum=None,
        serialized_key_size=0,
        serialized_value_size=0,
        headers=[],
    )
    consumer = KafkaMockConsumer([record])
    producer = KafkaMockProducer()

    monkeypatch.setattr(ko, "AIOKafkaConsumer", lambda *a, **k: consumer)
    monkeypatch.setattr(ko, "AIOKafkaProducer", lambda *a, **k: producer)

    return consumer, producer


@pytest.mark.asyncio
async def test_at_least_once(kafka_mock):
    consumer, producer = kafka_mock
    settings = get_settings()

    await ko._handle_message(await consumer.getone(), consumer, producer, settings)

    assert producer.sent, "Message should be produced at least once"
    assert producer.offsets, "Offset should be committed"
