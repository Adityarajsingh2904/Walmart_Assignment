import sys
import os
import asyncio
import json
import datetime as dt
from unittest.mock import patch

import pytest
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ai_service.app.alert_emitter import AlertEmitter, AlertIn
from ai_service.app.normalize import NormalizedEvent
from ai_service.app.scoring_engine import ScoreResult
from ai_service.app.labeler import GPTLabel

pytestmark = pytest.mark.asyncio


class DummyProducer:
    def __init__(self):
        self.messages = []
        self.transactions = []
        self.fail_commit = False

    def init_transactions(self):
        pass

    def begin_transaction(self):
        self.transactions.append("begin")

    def produce(self, topic, key=None, value=None, headers=None):
        self.messages.append((topic, value, headers))

    def commit_transaction(self):
        if self.fail_commit:
            raise RuntimeError("commit failure")
        self.transactions.append("commit")

    def abort_transaction(self):
        self.transactions.append("abort")

    def flush(self, timeout=None):
        pass


class DummyConn:
    def __init__(self, pool):
        self.pool = pool

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def execute(self, *args, **kw):
        self.pool.rows.append(args)

    async def fetchval(self, *args, **kw):
        self.pool.rows.append(args)
        return "id"


class DummyPool:
    def __init__(self):
        self.rows = []

    def acquire(self):
        return DummyConn(self)

    async def close(self):
        pass


async def _example_alert():
    event = NormalizedEvent(id="01BX5ZZKBKACTAV9WEVGEMMVRZ", src_ip="1.1.1.1", timestamp=dt.datetime.utcnow(), is_internal=True)
    scores = ScoreResult(score_if=0.1, score_lstm=0.2, aggregate=0.3)
    label = GPTLabel(class_="Test", severity="Low", reason="", gpt_tokens=0)
    return AlertIn(event=event, scores=scores, label=label)


async def test_success(monkeypatch):
    emitter = AlertEmitter()
    emitter._pool = DummyPool()
    prod = DummyProducer()
    emitter._producer = prod
    emitter._stmt = object()

    alert = await _example_alert()
    await emitter.emit(alert)

    assert prod.transactions == ["begin", "commit"]
    topic, value, _hdr = prod.messages[0]
    assert topic == "alerts"


async def test_kafka_failure(monkeypatch):
    emitter = AlertEmitter()
    emitter._pool = DummyPool()
    prod = DummyProducer()
    prod.fail_commit = True
    emitter._producer = prod
    emitter._stmt = object()

    alert = await _example_alert()
    await emitter.emit(alert)

    assert "abort" in prod.transactions
    topic, value, hdr = prod.messages[-1]
    assert topic == "alerts_dlq"


async def test_db_failure(monkeypatch):
    class FailPool(DummyPool):
        def acquire(self):
            class Conn(DummyConn):
                async def fetchval(self, *a, **kw):
                    raise Exception("db error")

            return Conn(self)

    emitter = AlertEmitter()
    emitter._pool = FailPool()
    prod = DummyProducer()
    emitter._producer = prod
    emitter._stmt = object()

    alert = await _example_alert()
    await emitter.emit(alert)

    assert "abort" in prod.transactions
    topic, value, hdr = prod.messages[-1]
    assert topic == "alerts_dlq"
