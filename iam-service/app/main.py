from fastapi import FastAPI

from .config import settings
from .logging import get_logger
from .metrics import init_metrics

logger = get_logger()

app = FastAPI()
init_metrics(app)

@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("service_started")
