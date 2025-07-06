import datetime as dt
import ipaddress
import sys
import importlib
import os

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ensure real pydantic module is loaded (tests may stub it)
mod = sys.modules.get("pydantic")
if mod is not None and getattr(mod, "__file__", None) is None:
    sys.modules.pop("pydantic", None)
    importlib.invalidate_caches()
import pydantic  # noqa: F401

# ensure real structlog is loaded
mod = sys.modules.get("structlog")
if mod is not None and getattr(mod, "__file__", None) is None:
    sys.modules.pop("structlog", None)
    importlib.invalidate_caches()
import structlog  # noqa: F401

from ai_service.app.normalize import Normalizer, NormalizationError, NormalizedEvent


def test_basic_normalization():
    raw = {"src_ip": "192.168.1.10", "timestamp": "2024-01-01T12:00:00Z"}
    ev = Normalizer.normalize(raw)
    assert ev.src_ip == "192.168.1.10"
    assert ev.is_internal is True
    assert ev.dst_ip is None
    assert ev.user_id is None
    assert ev.timestamp == dt.datetime(2024, 1, 1, 12, 0, tzinfo=dt.timezone.utc)
    assert ev.raw_extra == {}


def test_ulid_generated_when_missing():
    raw = {"src_ip": "8.8.8.8", "timestamp": 0}
    ev = Normalizer.normalize(raw)
    assert len(ev.id) == 26


def test_ulid_preserved():
    raw = {"id": "01BX5ZZKBKACTAV9WEVGEMMVRZ", "src_ip": "8.8.8.8", "timestamp": 0}
    ev = Normalizer.normalize(raw)
    assert ev.id == "01BX5ZZKBKACTAV9WEVGEMMVRZ"


def test_dst_ip_parsed():
    raw = {"src_ip": "8.8.8.8", "dst_ip": "1.1.1.1", "timestamp": 0}
    ev = Normalizer.normalize(raw)
    assert ev.dst_ip == "1.1.1.1"


def test_invalid_src_ip():
    with pytest.raises(NormalizationError):
        Normalizer.normalize({"src_ip": "999.999.999.999", "timestamp": 0})


def test_invalid_dst_ip():
    raw = {"src_ip": "8.8.8.8", "dst_ip": "bad", "timestamp": 0}
    with pytest.raises(NormalizationError):
        Normalizer.normalize(raw)


def test_timestamp_epoch_ms():
    ms = 1_600_000_000_000
    ev = Normalizer.normalize({"src_ip": "8.8.8.8", "timestamp": ms})
    assert ev.timestamp == dt.datetime.fromtimestamp(ms / 1000, tz=dt.timezone.utc)


def test_timestamp_string_epoch():
    ev = Normalizer.normalize({"src_ip": "8.8.8.8", "timestamp": "0"})
    assert ev.timestamp == dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)


def test_timestamp_iso_no_tz():
    ev = Normalizer.normalize({"src_ip": "8.8.8.8", "timestamp": "2024-01-01T00:00:00"})
    assert ev.timestamp == dt.datetime(2024, 1, 1, tzinfo=dt.timezone.utc)


def test_bytes_int():
    raw = {"src_ip": "8.8.8.8", "timestamp": 0, "bytes": 10}
    ev = Normalizer.normalize(raw)
    assert ev.bytes == 10


def test_bytes_str():
    raw = {"src_ip": "8.8.8.8", "timestamp": 0, "bytes": "20"}
    ev = Normalizer.normalize(raw)
    assert ev.bytes == 20


def test_bytes_invalid():
    raw = {"src_ip": "8.8.8.8", "timestamp": 0, "bytes": "abc"}
    with pytest.raises(NormalizationError):
        Normalizer.normalize(raw)


def test_extra_fields_preserved():
    raw = {"src_ip": "8.8.8.8", "timestamp": 0, "foo": "bar"}
    ev = Normalizer.normalize(raw)
    assert ev.raw_extra == {"foo": "bar"}


def test_method_endpoint():
    raw = {"src_ip": "8.8.8.8", "timestamp": 0, "method": "GET", "endpoint": "/"}
    ev = Normalizer.normalize(raw)
    assert ev.method == "GET"
    assert ev.endpoint == "/"


def test_invalid_timestamp():
    with pytest.raises(NormalizationError):
        Normalizer.normalize({"src_ip": "8.8.8.8", "timestamp": "not"})


def test_src_ip_required():
    with pytest.raises(NormalizationError):
        Normalizer.normalize({"timestamp": 0})


def test_timestamp_required():
    with pytest.raises(NormalizationError):
        Normalizer.normalize({"src_ip": "8.8.8.8"})


def test_is_internal_ipv6_ula():
    raw = {"src_ip": "fd00::1", "timestamp": 0}
    ev = Normalizer.normalize(raw)
    assert ev.is_internal is True
    assert ipaddress.ip_address(ev.src_ip).version == 6
