# Ledger Service

This package logs SOAR alerts and actions to Hyperledger Fabric and exposes integrity APIs.

## Development

```bash
pnpm install
pnpm --filter ledger-service dev
```

## Production

```bash
pnpm --filter ledger-service build
pnpm --filter ledger-service start
```

To run with Docker:

```bash
docker compose -f ledger-service/docker-compose.override.yml up --build
```
