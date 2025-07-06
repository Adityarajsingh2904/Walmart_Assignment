# Soar Service

This package provides the scaffolding for a SOAR automation service.

## Development

```bash
pnpm install
pnpm --filter soar-service dev
```

## Production

```bash
pnpm --filter soar-service build
pnpm --filter soar-service start
```

To run with Docker:

```bash
docker compose -f soar-service/docker-compose.override.yml up --build
```
