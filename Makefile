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
