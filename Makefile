.PHONY: install dev down logs debug-api db-shell test test-unit test-integration test-e2e test-watch lint typecheck studio build deploy migrate undeploy

install:
	npm install

dev:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

debug-api:
	npm run dev:debug -w @ezscout/api

db-shell:
	docker compose exec postgres psql -U ezscout -d ezscout

test:
	npm test

test-unit:
	npm test --workspaces --if-present

test-watch:
	npm run test:watch --workspaces --if-present

lint:
	npm run lint --workspaces --if-present

typecheck:
	npm run typecheck --workspaces --if-present

build:
	docker compose -f docker-compose.prod.yml build

deploy:
	docker compose -f docker-compose.prod.yml up -d --build

migrate:
	docker compose exec api npm run db:migrate

test-integration:
	npm run test:integration -w @ezscout/api

test-e2e: ## Run e2e tests against test stack
	docker compose -f docker-compose.test.yml up -d --build
	@echo "Waiting for stack..."
	@sleep 15
	npm run test:e2e
	docker compose -f docker-compose.test.yml down

studio:
	npm run db:studio -w @ezscout/api

undeploy:
	docker compose -f docker-compose.prod.yml down
