.PHONY: dev down db logs migrate seed fresh

dev:
	docker compose up --build --watch

# Just the database and redis (run api locally with bun)
infra:
	docker compose up db redis -d

down:
	docker compose down

nuke:
	docker compose down -v

db:
	docker compose exec db psql -U $${DB_USER} -d $${DB_NAME}

redis:
	docker compose exec redis redis-cli

logs:
	docker compose logs -f api

# This will nuke the data before migration be warned future dev
migrate:
	bun run drizzle-kit push


#  !todo
# seed:
# 	bun run src/db/seed.ts

# # Nuke db + re-migrate + seed
# fresh: nuke
# 	docker compose up db redis -d
# 	@echo "Waiting for db..."
# 	@sleep 3
# 	$(MAKE) migrate
# 	$(MAKE) seed