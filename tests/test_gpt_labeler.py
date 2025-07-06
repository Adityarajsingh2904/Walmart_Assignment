import os
import json
import sys
import importlib

import pytest
import openai

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ensure real structlog is loaded
mod = sys.modules.get("structlog")
if mod is not None and getattr(mod, "__file__", None) is None:
    sys.modules.pop("structlog", None)
    importlib.invalidate_caches()
import structlog  # noqa: F401

from ai_service.app.labeler import label_event, GPTLabel
from ai_service.app.normalize import Normalizer
from ai_service.app.scoring_engine import ScoreResult


@pytest.fixture
def patch_openai(monkeypatch):
    calls = []

    def fake_create(*args, **kwargs):
        calls.append((args, kwargs))
        content = json.dumps({"class": "Account Compromise", "severity": "Low", "reason": "test"})
        return {"choices": [{"message": {"content": content}}], "usage": {"total_tokens": 99}}

    monkeypatch.setattr(openai.ChatCompletion, "create", fake_create)
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setattr("ai_service.app.labeler.get_openai_api_key", lambda: "sk-test")
    return calls


def test_mock_mode(monkeypatch, patch_openai):
    monkeypatch.setenv("OPENAI_MOCK", "1")
    raw = {"src_ip": "1.1.1.1", "timestamp": 0, "id": "01BX5ZZKBKACTAV9WEVGEMMVRZ"}
    event = Normalizer.normalize(raw)
    scores = ScoreResult(0.1, 0.1, 0.1)
    res = label_event(event, scores)
    assert isinstance(res, GPTLabel)
    assert res.gpt_tokens == 0
    assert res.reason == "Mock mode"
    assert not patch_openai  # should not be called


def test_real_call(monkeypatch, patch_openai):
    monkeypatch.delenv("OPENAI_MOCK", raising=False)
    raw = {"src_ip": "2.2.2.2", "timestamp": 0, "id": "01BX5ZZKBKACTAV9WEVGEMMVRZ"}
    event = Normalizer.normalize(raw)
    scores = ScoreResult(0.5, 0.5, 0.85)
    res = label_event(event, scores)
    assert res.class_ == "Account Compromise"
    assert res.severity == "High"  # from score 0.85
    assert res.reason == "test"
    assert res.gpt_tokens == 99
    assert patch_openai  # called
