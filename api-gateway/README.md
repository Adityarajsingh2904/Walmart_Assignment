# API Gateway

Simple Express API Gateway with a health check endpoint.
Swagger UI is served at `/docs` and the raw JSON at `/docs-json`.

## Development

```bash
npm install
npm run dev
```

Visit `http://localhost:8080/healthz`.

## Production

```bash
npm run build
npm start
```

To run with Docker:

```bash
docker compose -f api-gateway/docker-compose.override.yml up --build
```
