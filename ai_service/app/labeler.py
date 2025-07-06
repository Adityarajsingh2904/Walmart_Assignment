from __future__ import annotations

import json
import os
from typing import Tuple

import openai
from pydantic import BaseModel, Field, ConfigDict
from tenacity import retry, wait_exponential, stop_after_attempt
import structlog
import ulid

from .normalize import NormalizedEvent
from .scoring_engine import ScoreResult
from .secrets_manager import get_openai_api_key


class GPTLabel(BaseModel):
    class_: str = Field(..., alias="class")
    severity: str
    reason: str
    gpt_tokens: int

    model_config = ConfigDict(populate_by_name=True)


# configure logging
structlog.configure(processors=[structlog.processors.JSONRenderer()])
logger = structlog.get_logger().bind(service="gpt-labeler")


def _score_to_severity(score: float) -> str:
    if score >= 0.90:
        return "Critical"
    if score >= 0.75:
        return "High"
    if score >= 0.50:
        return "Medium"
    return "Low"


# hard-coded results for mock mode
_MOCK_LABELS: Tuple[Tuple[str, str], ...] = (
    ("Account Compromise", "Critical"),
    ("Data Exfiltration", "High"),
    ("Malware", "Medium"),
    ("Benign", "Low"),
)


def _mock_label(event: NormalizedEvent) -> Tuple[str, str]:
    idx = ulid.from_str(event.id).int % len(_MOCK_LABELS)
    return _MOCK_LABELS[idx]


@retry(wait=wait_exponential(min=2, max=20), stop=stop_after_attempt(5),
       retry=(lambda exc: isinstance(exc, (openai.RateLimitError, openai.APIError, openai.Timeout))))
def _call_openai(messages: list[dict]) -> openai.types.chat.chat_completion.ChatCompletion:
    api_key = get_openai_api_key()
    return openai.ChatCompletion.create(model="gpt-4o-mini", temperature=0, messages=messages, api_key=api_key)


def label_event(event: NormalizedEvent, scores: ScoreResult) -> GPTLabel:
    if os.getenv("OPENAI_MOCK") == "1":
        class_, severity = _mock_label(event)
        logger.info("labeled", event_id=event.id, severity=severity, gpt_tokens=0, mock=True)
        return GPTLabel(class_=class_, severity=severity, reason="Mock mode", gpt_tokens=0)

    sev = _score_to_severity(scores.aggregate)

    messages = [
        {
            "role": "system",
            "content": "You are a senior SOC analyst. Respond with concise JSON {class, severity, reason}. No extra keys.",
        },
        {"role": "user", "content": json.dumps({"event": event.model_dump(mode="json"), "scores": scores.__dict__})},
    ]

    response = _call_openai(messages)
    content = response["choices"][0]["message"]["content"]
    try:
        parsed = json.loads(content)
    except Exception:
        parsed = {"class": "Unknown", "reason": "Invalid GPT response"}

    gpt_tokens = int(response.get("usage", {}).get("total_tokens", 0))
    result = GPTLabel(class_=parsed.get("class", "Unknown"), severity=sev, reason=parsed.get("reason", ""), gpt_tokens=gpt_tokens)
    logger.info("labeled", event_id=event.id, severity=sev, gpt_tokens=gpt_tokens, mock=False)
    return result
