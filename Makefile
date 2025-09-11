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