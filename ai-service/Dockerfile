FROM python:3.11-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential gcc curl librdkafka-dev libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY ai-service/requirements.txt ./requirements.txt

RUN python -m pip install --upgrade pip wheel && \
    python -m pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends librdkafka1 libpq5 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 aiuser && \
    useradd -g aiuser -u 1001 -s /usr/sbin/nologin aiuser

COPY --from=builder /install /usr/local
COPY ai-service /app
WORKDIR /app

USER aiuser
EXPOSE 8001

HEALTHCHECK --interval=30s CMD curl -fsSL http://localhost:8001/metrics || exit 1

ENTRYPOINT ["python", "-m", "ai_service.kafka_orchestrator"]
