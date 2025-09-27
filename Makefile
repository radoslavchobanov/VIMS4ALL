ENV=.env.dev
COMPOSE=docker compose -f docker-compose.dev.yml --env-file $(ENV)

build:
	$(COMPOSE) build
up:
	$(COMPOSE) up
up-d:
	$(COMPOSE) up -d
down:
	$(COMPOSE) down
logs:
	$(COMPOSE) logs -f web
migrate:
	$(COMPOSE) exec web python src/manage.py migrate
createsu:
	$(COMPOSE) exec web python src/manage.py createsuperuser

# Generic manage.py runner: make manage ARGS="makemigrations institutes"
manage:
	$(COMPOSE) exec web python src/manage.py $(ARGS)
# Convenience: make mm APP=institutes  (or APP="students employees")
mm:
	$(COMPOSE) exec web python src/manage.py makemigrations $(APP)

# Export fresh schema from the running web container
schema-json:
	$(COMPOSE) exec web python src/manage.py spectacular --format openapi-json > frontend/openapi.json

gen-types:
	npx openapi-typescript frontend/openapi.json -o frontend/src/api/__generated__/vims-types.ts

regen-types: schema-json gen-types