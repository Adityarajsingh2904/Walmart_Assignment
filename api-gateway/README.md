# API Gateway

This package exposes a single REST and WebSocket endpoint in front of TrustVault services.

## Development

```bash
pnpm install
docker compose up -f docker-compose.override.yml --build
```

Curl health check:

```bash
curl http://localhost:8080/health
```

Swagger UI is available at `http://localhost:8080/docs`.
