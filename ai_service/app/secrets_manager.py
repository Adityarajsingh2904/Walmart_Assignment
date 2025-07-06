from __future__ import annotations

import os
import boto3

_CACHE: str | None = None


def get_openai_api_key() -> str:
    global _CACHE
    if _CACHE:
        return _CACHE
    region = os.getenv("AWS_REGION") or boto3.session.Session().region_name
    client = boto3.client("secretsmanager", region_name=region)
    resp = client.get_secret_value(SecretId="openai/api_key")
    _CACHE = resp["SecretString"]
    return _CACHE
