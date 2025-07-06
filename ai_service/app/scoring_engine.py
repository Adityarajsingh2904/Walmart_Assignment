from __future__ import annotations

import asyncio
import json
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Deque, Dict, List

import joblib
import numpy as np
from prometheus_client import Histogram, Gauge, start_http_server
import structlog
import tensorflow as tf

from .normalize import NormalizedEvent


@dataclass
class ScoreResult:
    score_if: float
    score_lstm: float
    aggregate: float


# configure logging
structlog.configure(processors=[structlog.processors.JSONRenderer()])
logger = structlog.get_logger().bind(service="scoring-engine")


class ScoringEngine:
    """Compute anomaly scores for events."""

    def __init__(self, model_dir: str = "models") -> None:
        self.model_if = joblib.load(Path(model_dir) / "isolation_forest.joblib")
        self.model_lstm = tf.saved_model.load(str(Path(model_dir) / "lstm_encoder"))
        with open(Path(model_dir) / "if_stats.json", "r") as f:
            self.stats = json.load(f)
        self.history: Dict[str, Deque[np.ndarray]] = defaultdict(lambda: deque(maxlen=50))
        self._lock = asyncio.Lock()

        self.latency_hist = Histogram(
            "scoring_latency_seconds",
            "Time taken for scoring",
            buckets=[0.001, 0.005, 0.01, 0.05, 0.1],
        )
        self.queue_gauge = Gauge("inference_queue_size", "Inference queue size")
        # Expose metrics
        try:
            start_http_server(9101)
        except Exception:
            pass

    # -------------------------- feature extraction --------------------------
    def _event_to_vector(self, event: NormalizedEvent) -> np.ndarray:
        """Convert event into a 32-element feature vector."""
        import ipaddress

        src = int(ipaddress.ip_address(event.src_ip)) % 65535 / 65535
        dst = (
            int(ipaddress.ip_address(event.dst_ip)) % 65535 / 65535
            if event.dst_ip
            else 0.0
        )
        is_int = 1.0 if event.is_internal else 0.0
        user_len = float(len(event.user_id)) if event.user_id else 0.0
        ts = event.timestamp.timestamp() % 1e6 / 1e6
        method = (hash(event.method) % 1000) / 1000 if event.method else 0.0
        endpoint = (hash(event.endpoint) % 1000) / 1000 if event.endpoint else 0.0
        bytes_v = (event.bytes or 0) % 1e6 / 1e6

        base = np.array(
            [src, dst, is_int, user_len, ts, method, endpoint, bytes_v], dtype=np.float32
        )
        vec = np.tile(base, 4)  # 8 * 4 = 32 features
        return vec.astype(np.float32)

    # ----------------------------- core scoring -----------------------------
    async def score(self, event: NormalizedEvent) -> ScoreResult:
        start = time.perf_counter()
        vec = self._event_to_vector(event)
        score_if = float(self.model_if.score_samples([vec])[0])

        if event.user_id is None:
            score_lstm = 0.0
        else:
            async with self._lock:
                history = self.history[event.user_id]
                history.append(vec)
                seq = np.stack(history).astype(np.float32)
            tensor = tf.constant(seq[np.newaxis])
            output = self.model_lstm.signatures["serve"](tensor)
            key = list(output.keys())[0]
            recon = output[key].numpy()
            score_lstm = float(np.mean(np.square(seq[np.newaxis] - recon)))

        stats = self.stats
        z_if = (score_if - stats["mu_if"]) / stats["sigma_if"]
        z_lstm = (score_lstm - stats["mu_lstm"]) / stats["sigma_lstm"]
        agg_raw = max(z_if, z_lstm)
        agg = (agg_raw - stats["min_raw"]) / (stats["max_raw"] - stats["min_raw"])
        agg = float(min(1.0, max(0.0, agg)))

        latency = time.perf_counter() - start
        self.latency_hist.observe(latency)

        logger.info(
            "scored",
            score_if=score_if,
            score_lstm=score_lstm,
            aggregate=agg,
        )
        return ScoreResult(score_if=score_if, score_lstm=score_lstm, aggregate=agg)

    # ------------------------------- worker -------------------------------
    async def run(self, queue: asyncio.Queue, out_queue: asyncio.Queue | None = None) -> None:
        """Consume events from queue and optionally push results."""
        while True:
            event = await queue.get()
            self.queue_gauge.set(queue.qsize())
            try:
                res = await self.score(event)
                if out_queue is not None:
                    await out_queue.put(res)
            finally:
                queue.task_done()
                self.queue_gauge.set(queue.qsize())

