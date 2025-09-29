#!/usr/bin/env bash
set -euo pipefail

echo "DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-vims.settings.dev}"

# --- Wait for DB using Django itself (no netcat needed) ---
python - <<'PY'
import os, sys, time
os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.getenv("DJANGO_SETTINGS_MODULE","vims.settings.dev"))
from django.db import connections
from django.db.utils import OperationalError
for i in range(120):
    try:
        connections['default'].cursor()
        print("DB is ready")
        sys.exit(0)
    except OperationalError:
        time.sleep(1)
print("DB not ready after timeout", file=sys.stderr)
sys.exit(1)
PY

# --- Optional: auto-makemigrations in dev ---
if [[ "${DJANGO_MAKEMIGRATIONS:-0}" == "1" ]]; then
  if [[ -n "${DJANGO_MAKEMIGRATIONS_APPS:-}" ]]; then
    echo "Running makemigrations for apps: ${DJANGO_MAKEMIGRATIONS_APPS}"
    python src/manage.py makemigrations ${DJANGO_MAKEMIGRATIONS_APPS}
  else
    echo "Running makemigrations for all local apps"
    python src/manage.py makemigrations
  fi
fi

# --- Always migrate (idempotent) ---
python src/manage.py migrate --no-input

# --- Optional: auto-create superuser (dev only) ---
if [[ "${DJANGO_CREATE_SUPERUSER:-0}" == "1" ]]; then
  python src/manage.py shell <<'PY'
from django.contrib.auth import get_user_model
import os
U = get_user_model()
u = os.environ.get("DJANGO_SUPERUSER_USERNAME","admin")
e = os.environ.get("DJANGO_SUPERUSER_EMAIL","admin@example.com")
p = os.environ.get("DJANGO_SUPERUSER_PASSWORD","admin")
if not U.objects.filter(username=u).exists():
    U.objects.create_superuser(u, e, p)
    print(f"Created superuser: {u}")
else:
    print(f"Superuser exists: {u}")
PY
fi

# --- Run dev server ---
exec python src/manage.py runserver 0.0.0.0:8000
