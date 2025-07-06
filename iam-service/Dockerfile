FROM python:3.11-slim AS builder
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip wheel \
    && python -m pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*
RUN groupadd -g 1002 aiuser \
    && useradd -g aiuser -u 1002 -s /usr/sbin/nologin aiuser
COPY --from=builder /install /usr/local
WORKDIR /app
COPY app /app
USER aiuser
EXPOSE 8002
HEALTHCHECK --interval=30s CMD curl -f http://localhost:8002/healthz || exit 1
ENTRYPOINT ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
