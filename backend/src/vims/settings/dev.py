from .base import *  # noqa
from pathlib import Path

# Base.py should define: BASE_DIR, INSTALLED_APPS, MIDDLEWARE, env = environ.Env()

DEBUG = True
SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-unsafe-secret")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
TIME_ZONE = env("DJANGO_TIME_ZONE", default="UTC")

CORS_ALLOW_ALL_ORIGINS = True

# ---- DB (internal docker network) ----
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="vims"),
        "USER": env("POSTGRES_USER", default="vims"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="vims"),
        "HOST": env("POSTGRES_HOST", default="db"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
    }
}

# ---- Static/Media ----
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # noqa
MEDIA_URL = "/media/"

# Use MinIO (S3) for media; local staticfiles in dev
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        "OPTIONS": {
            "endpoint_url": env("AWS_S3_ENDPOINT_URL", default="http://minio:9000"),
            "region_name": env("S3_REGION", default="us-east-1"),
            "use_ssl": env.bool("S3_USE_SSL", default=False),
        },
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
AWS_S3_ADDRESSING_STYLE = "path"
AWS_ACCESS_KEY_ID = env("MINIO_ROOT_USER", default="minio")
AWS_SECRET_ACCESS_KEY = env("MINIO_ROOT_PASSWORD", default="minio12345")
AWS_STORAGE_BUCKET_NAME = env("MINIO_MEDIA_BUCKET", default="vims-media")
AWS_QUERYSTRING_AUTH = False
AWS_DEFAULT_ACL = None
AWS_S3_FILE_OVERWRITE = False

MEDIA_PUBLIC_BASE = env("MEDIA_PUBLIC_BASE", default=None)

# ---- Dev ergonomics ----
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Optional debug toolbar
if DEBUG:
    INSTALLED_APPS += ["debug_toolbar"]  # noqa
    MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")  # noqa
    INTERNAL_IPS = ["127.0.0.1", "10.0.2.2"]

# CORS/CSRF (adjust if you add a separate FE on a different port)
CORS_ALLOWED_ORIGINS = ["http://localhost:8000", "http://127.0.0.1:8000"]
CSRF_TRUSTED_ORIGINS = ["http://localhost:8000", "http://127.0.0.1:8000"]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
