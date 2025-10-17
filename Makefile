# -------- Global switches --------
MODE ?= dev                               # dev | prod
ENV  ?= .env.$(MODE)                      # .env.dev or .env.prod
FILE ?= docker-compose.$(MODE).yml        # docker-compose.dev.yml or docker-compose.prod.yml

COMPOSE = docker compose -f $(FILE) --env-file $(ENV)

# So `make` knows these are not files
.PHONY: build up up-d down logs migrate createsu manage mm \
        schema-json gen-types regen-types \
        build-dev up-dev up-d-dev down-dev logs-dev migrate-dev createsu-dev \
        build-prod up-prod up-d-prod down-prod logs-prod migrate-prod

# -------- Generic (honors MODE) --------
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
	$(COMPOSE) exec web python src/manage.py migrate --noinput

# ⚠️ Usually not used in prod; keep for dev convenience
createsu:
	$(COMPOSE) exec web python src/manage.py createsuperuser

# Generic manage.py runner: make manage ARGS="makemigrations institutes"
manage:
	$(COMPOSE) exec web python src/manage.py $(ARGS)

# Convenience: make mm APP=institutes (or APP="students employees")
mm:
	$(COMPOSE) exec web python src/manage.py makemigrations $(APP)

# OpenAPI (keep as dev-only usage; will also work in prod if needed)
schema-json:
	$(COMPOSE) exec web python src/manage.py spectacular --format openapi-json > frontend/openapi.json

gen-types:
	npx openapi-typescript frontend/openapi.json -o frontend/src/api/__generated__/vims-types.ts

regen-types: schema-json gen-types

# -------- Explicit shortcuts (no need to type MODE=...) --------
# Dev
build-dev:  ; $(MAKE) build  MODE=dev
up-dev:     ; $(MAKE) up     MODE=dev
up-d-dev:   ; $(MAKE) up-d   MODE=dev
down-dev:   ; $(MAKE) down   MODE=dev
logs-dev:   ; $(MAKE) logs   MODE=dev
migrate-dev:; $(MAKE) migrate MODE=dev
createsu-dev:; $(MAKE) createsu MODE=dev

# Prod
build-prod:  ; $(MAKE) build  MODE=prod
up-prod:     ; $(MAKE) up     MODE=prod
up-d-prod:   ; $(MAKE) up-d   MODE=prod
down-prod:   ; $(MAKE) down   MODE=prod
logs-prod:   ; $(MAKE) logs   MODE=prod
migrate-prod:; $(MAKE) migrate MODE=prod
