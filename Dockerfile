# --- Frontend build ---
FROM node:24-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Runtime: FastAPI serves API and the built frontend ---
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.8.3 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/src ./src
RUN uv sync --locked --no-dev
COPY --from=frontend /app/dist ./static

RUN useradd --system --uid 1000 app && mkdir /data && chown app /data
USER app
ENV PATH="/app/.venv/bin:$PATH" \
    OVERWORKED_STATIC_DIR=/app/static \
    OVERWORKED_REQUIRE_PASSWORD=true \
    OVERWORKED_DATABASE_URL=sqlite:////data/overworked.db
VOLUME /data
EXPOSE 8000
# Open live-update streams (server-sent events) never end by themselves: stop waiting for them.
CMD ["uvicorn", "overworked.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "3"]
