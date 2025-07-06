FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8000
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=5s CMD \
  wget -qO- http://localhost:${PORT:-8000}/healthz || exit 1
CMD ["node", "dist/index.js"]
