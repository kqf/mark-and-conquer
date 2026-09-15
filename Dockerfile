# One container for the whole app: Node builds the SPA, then Flask serves it
# alongside the API from a single origin.

FROM node:24-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build
