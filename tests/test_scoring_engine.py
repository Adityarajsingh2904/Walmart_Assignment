import asyncio
import datetime as dt
import random
import importlib
import sys
import os

import pytest

# ensure real prometheus_client is loaded (tests may stub it)
mod = sys.modules.get("prometheus_client")
if mod is not None and getattr(mod, "__file__", None) is None:
    sys.modules.pop("prometheus_client", None)
    importlib.invalidate_caches()

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pathlib import Path

from ai_service.app.scoring_engine import ScoringEngine
from ai_service.app.normalize import Normalizer
from trainer import train_if, train_lstm, export_stats


def test_scoring_range():
    model_dir = Path("models")
    if not (model_dir / "isolation_forest.joblib").exists():
        train_if.main()
    if not (model_dir / "lstm_encoder").exists():
        train_lstm.main()
    if not (model_dir / "if_stats.json").exists():
        export_stats.main()

    engine = ScoringEngine(model_dir=str(model_dir))
    for _ in range(100):
        raw = {
            "src_ip": f"192.168.1.{random.randint(1, 254)}",
            "dst_ip": f"10.0.0.{random.randint(1, 254)}",
            "timestamp": dt.datetime.utcnow().isoformat(),
            "bytes": random.randint(0, 1000),
            "user_id": str(random.randint(1, 5)),
        }
        event = Normalizer.normalize(raw)
        res = asyncio.run(engine.score(event))
        assert 0.0 <= res.aggregate <= 1.0
