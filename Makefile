.PHONY: install db db-stop migrate generate dev build start clean

# One-command targets
up: install db migrate generate dev        ## Start everything in dev mode
up-prod: install db migrate generate build start  ## Start everything in production mode

# Individual targets
install:                                   ## Install npm dependencies
	npm install

db:                                        ## Start Docker Postgres (create if needed)
	@if docker ps --format '{{.Names}}' | grep -q '^agentprint-db$$'; then \
		echo "✅ Postgres already running"; \
	elif docker ps -a --format '{{.Names}}' | grep -q '^agentprint-db$$'; then \
		echo "▶ Starting Postgres..."; \
		docker start agentprint-db; \
	else \
		echo "📦 Creating Postgres..."; \
		docker run -d \
			--name agentprint-db \
			-e POSTGRES_DB=agentprint \
			-e POSTGRES_USER=postgres \
			-e POSTGRES_PASSWORD=postgres \
			-p 5432:5432 \
			postgres:16-alpine; \
	fi
	@echo "⏳ Waiting for Postgres..."
	@until docker exec agentprint-db pg_isready -U postgres -q 2>/dev/null; do sleep 1; done
	@echo "✅ Postgres is ready"

db-stop:                                   ## Stop Docker Postgres
	docker stop agentprint-db

db-rm: db-stop                             ## Remove Docker Postgres container
	docker rm agentprint-db

migrate:                                   ## Run Prisma migrations
	npx prisma migrate dev

generate:                                  ## Generate Prisma client
	npx prisma generate

dev:                                       ## Start dev server (hot-reload)
	npm run dev

build:                                     ## Build for production
	npm run build

start:                                     ## Start production server
	npm start

clean:                                     ## Remove build artifacts
	rm -rf .next node_modules

help:                                      ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
