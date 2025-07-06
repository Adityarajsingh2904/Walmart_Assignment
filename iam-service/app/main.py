from fastapi import FastAPI
from .config import settings

app = FastAPI()

@app.get("/healthz")
def healthz():
    return {"status": "ok"}
