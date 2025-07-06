FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN corepack enable && pnpm install --prod --frozen-lockfile
COPY src ./src
ENV NODE_ENV=production
EXPOSE 8083
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1
CMD ["node", "--loader", "ts-node/esm", "src/index.ts"]
