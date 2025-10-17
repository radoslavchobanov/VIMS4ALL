#!/usr/bin/env bash
set -euo pipefail

echo "DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-vims.settings.production}"

# Wait for DB using Django
python - <<'PY'
import os, sys, time
os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.getenv("DJANGO_SETTINGS_MODULE","vims.settings.production"))
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

# Run migrations and collectstatic (idempotent)
python src/manage.py migrate --no-input
python src/manage.py collectstatic --no-input

# Serve via gunicorn
exec gunicorn vims.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --access-logfile - \
  --error-logfile -
