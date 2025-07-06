FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY src ./src
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 8084
HEALTHCHECK --interval=30s --timeout=5s CMD \ 
  wget -qO- http://localhost:${PORT:-8084}/health || exit 1
CMD ["node", "dist/server.js"]
