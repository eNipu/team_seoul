# ---- widget ----
FROM node:22-alpine AS widget
WORKDIR /widget
COPY widget/package.json widget/package-lock.json ./
RUN npm ci
COPY shared/ /shared/
COPY backend/app/services/interest_families.json /backend/app/services/interest_families.json
COPY widget/ ./
RUN npm run build

# ---- website ----
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY shared/ /shared/
COPY backend/app/services/interest_families.json /backend/app/services/interest_families.json
COPY docs/Venn-Quickstart.pdf /docs/Venn-Quickstart.pdf
COPY web/ ./
RUN npm run build

# ---- backend ----
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/ ./
COPY --from=widget /widget/dist /app/widget/dist
COPY --from=web /web/dist /app/web/dist
RUN useradd --create-home venn
USER venn
EXPOSE 8081
CMD ["sh", "-c", "uv run --no-sync alembic upgrade head && uv run --no-sync uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8081 --proxy-headers"]
