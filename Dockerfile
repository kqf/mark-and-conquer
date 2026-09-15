# One container for the whole app: Node builds the SPA, then Flask serves it
# alongside the API from a single origin.

FROM node:24-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build


FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    DB_PATH=/data/pixels.db \
    SESSION_COOKIE_SECURE=true

# Install the dependencies directly rather than the package itself: app.py
# finds the SPA at ../../web/dist relative to its own file, which only holds
# while the source stays in the tree, and setuptools_scm would need .git.
RUN pip install --no-cache-dir "flask>=3.1,<4" "sqlalchemy>=2,<3" "gunicorn>=23,<24"

WORKDIR /app
COPY api/markandconquer api/markandconquer
COPY --from=web /app/web/dist web/dist
RUN mkdir -p /data

WORKDIR /app/api
EXPOSE 8080

# Threads over processes:
# one worker keeps SQLite writes serialized and fits
# the small memory limits of free container tiers.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 8 'markandconquer.app:create_app()'"]
