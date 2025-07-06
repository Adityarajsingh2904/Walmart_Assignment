from fastapi import FastAPI, Response
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST

# Module-level Prometheus counters
login_total = Counter("login_total", "Total user login attempts")
mfa_challenge_total = Counter("mfa_challenge_total", "Total MFA challenges issued")
token_revoked_total = Counter("token_revoked_total", "Total revoked tokens")


def init_metrics(app: FastAPI) -> None:
    """Mount /metrics endpoint on the given FastAPI app."""

    @app.get("/metrics", include_in_schema=False)
    async def metrics() -> Response:  # pragma: no cover - trivial
        data = generate_latest()
        return Response(content=data, media_type=CONTENT_TYPE_LATEST)
