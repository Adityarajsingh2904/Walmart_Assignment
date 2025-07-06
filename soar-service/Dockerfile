# builder
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml tsconfig.json jest.config.cjs .eslintrc.cjs ./
COPY src ./src
RUN npm install -g pnpm && pnpm install --frozen-lockfile && pnpm run build

# runtime
FROM gcr.io/distroless/nodejs20-debian11
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package.json pnpm-lock.yaml ./
ENV NODE_ENV=production
EXPOSE 8003
HEALTHCHECK CMD curl -f http://localhost:${METRICS_PORT:-8003}/healthz || exit 1
CMD ["node", "dist/index.js"]
