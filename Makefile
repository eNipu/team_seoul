.PHONY: setup dev test test-postgres lint format build-widget migrate migration seed seed-remove db-up db-down docker-up docker-down

BACKEND := backend
WIDGET := widget

setup: ## Install backend + widget dependencies and build the widget
	cd $(BACKEND) && uv sync
	cd $(WIDGET) && npm install
	$(MAKE) build-widget
	@test -f .env || cp .env.example .env

dev: ## Run the MCP server with autoreload on :8081
	cd $(BACKEND) && uv run uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8081

test: ## Run backend tests (SQLite)
	cd $(BACKEND) && uv run pytest

test-postgres: db-up ## Run backend tests against the docker-compose Postgres
	cd $(BACKEND) && TEST_DATABASE_URL=postgresql://heldly:heldly@localhost:5432/heldly uv run pytest

lint: ## Lint backend (ruff) and typecheck widget
	cd $(BACKEND) && uv run ruff check . && uv run ruff format --check .
	cd $(WIDGET) && npm run typecheck

format:
	cd $(BACKEND) && uv run ruff check --fix . && uv run ruff format .

build-widget: ## Build the single-file widget bundle (widget/dist/index.html)
	cd $(WIDGET) && npm run build

migrate: ## Apply Alembic migrations to $$DATABASE_URL
	cd $(BACKEND) && uv run alembic upgrade head

migration: ## Autogenerate a migration: make migration m="describe change"
	cd $(BACKEND) && uv run alembic revision --autogenerate -m "$(m)"

seed: ## Add demo friends to a dev account: make seed me=<dev username>
	@test -n "$(me)" || (echo "usage: make seed me=<dev username>" && exit 2)
	cd $(BACKEND) && uv run python scripts/seed_demo.py --me "$(me)"

seed-remove: ## Remove the demo friends again: make seed-remove me=<dev username>
	@test -n "$(me)" || (echo "usage: make seed-remove me=<dev username>" && exit 2)
	cd $(BACKEND) && uv run python scripts/seed_demo.py --me "$(me)" --remove

db-up:
	docker compose up -d --wait db

db-down:
	docker compose down

docker-up: ## Run Postgres + the server in Docker
	docker compose up --build

docker-down:
	docker compose down
