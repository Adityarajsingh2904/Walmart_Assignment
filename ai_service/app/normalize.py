"""Data Normalizer
------------------

Utility for converting raw event dictionaries into ``NormalizedEvent`` models.

Examples
--------

>>> raw = {"src_ip": "10.0.0.5", "timestamp": "2024-01-01T00:00:00Z"}
>>> ev = Normalizer.normalize(raw)
>>> isinstance(ev.id, str)
True
>>> ev.src_ip
'10.0.0.5'
>>> ev.is_internal
True
"""

from __future__ import annotations

import datetime as _dt
import ipaddress
from typing import Any, Dict, Optional

from dateutil import parser as dt_parser
from pydantic import BaseModel, Field
import structlog
import ulid


class NormalizationError(ValueError):
    """Raised when raw data cannot be normalized."""


class NormalizedEvent(BaseModel):
    """Canonical representation of an event."""

    id: str = Field(...)
    src_ip: str = Field(...)
    dst_ip: Optional[str] = None
    is_internal: bool = Field(...)
    user_id: Optional[str] = None
    timestamp: _dt.datetime = Field(...)
    method: Optional[str] = None
    endpoint: Optional[str] = None
    bytes: Optional[int] = None
    raw_extra: Dict[str, Any] = Field(default_factory=dict)


class Normalizer:
    """Convert raw dictionaries to :class:`NormalizedEvent`."""

    @staticmethod
    def schema() -> Dict[str, Any]:
        """Return the JSON schema for :class:`NormalizedEvent`."""
        return NormalizedEvent.model_json_schema()

    @staticmethod
    def _parse_timestamp(value: Any) -> _dt.datetime:
        if value is None:
            raise NormalizationError("timestamp required")
        try:
            if isinstance(value, (int, float)):
                ts = float(value)
                if ts > 1e11:
                    ts /= 1000.0
                return _dt.datetime.fromtimestamp(ts, tz=_dt.timezone.utc)
            if isinstance(value, str) and value.isdigit():
                ts = int(value)
                if ts > 1e11:
                    ts /= 1000.0
                return _dt.datetime.fromtimestamp(ts, tz=_dt.timezone.utc)
            dt = dt_parser.isoparse(str(value))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=_dt.timezone.utc)
            else:
                dt = dt.astimezone(_dt.timezone.utc)
            return dt
        except Exception as e:  # pragma: no cover - error path
            raise NormalizationError("invalid timestamp") from e

    @staticmethod
    def _parse_ip(value: Any, field: str) -> str:
        if value in (None, ""):
            if field == "src_ip":
                raise NormalizationError("src_ip required")
            return None
        try:
            return str(ipaddress.ip_address(str(value)))
        except Exception as e:
            raise NormalizationError(f"invalid {field}") from e

    @staticmethod
    def _parse_bytes(value: Any) -> Optional[int]:
        if value in (None, ""):
            return None
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return int(value)
        if isinstance(value, str) and value.isdigit():
            return int(value)
        raise NormalizationError("invalid bytes")

    @staticmethod
    def normalize(raw: Dict[str, Any]) -> NormalizedEvent:
        if not isinstance(raw, dict):
            raise NormalizationError("raw must be a dict")

        data = dict(raw)
        raw_id = str(data.pop("id", "")).strip()
        event_id = raw_id or str(ulid.new())

        logger = structlog.get_logger().bind(event_id=event_id, stage="normalize")

        src_ip = Normalizer._parse_ip(data.pop("src_ip", None), "src_ip")
        dst_ip = Normalizer._parse_ip(data.pop("dst_ip", None), "dst_ip")
        timestamp = Normalizer._parse_timestamp(data.pop("timestamp", None))
        bytes_val = Normalizer._parse_bytes(data.pop("bytes", None))

        is_internal = ipaddress.ip_address(src_ip).is_private

        event = NormalizedEvent(
            id=event_id,
            src_ip=src_ip,
            dst_ip=dst_ip,
            is_internal=is_internal,
            user_id=data.pop("user_id", None),
            timestamp=timestamp,
            method=data.pop("method", None),
            endpoint=data.pop("endpoint", None),
            bytes=bytes_val,
            raw_extra=data,
        )
        logger.info("normalized")
        return event
