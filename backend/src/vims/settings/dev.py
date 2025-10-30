from .base import *  # noqa

DEBUG = True
SECRET_KEY = env("DJANGO_SECRET_KEY", default="unsafe-dev-secret")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CORS_ALLOW_ALL_ORIGINS = True

# Development DB via internal network
DATABASES["default"].update(
    {
        "HOST": env("POSTGRES_HOST", default="db"),
        "CONN_MAX_AGE": 60,
    }
)

# Static/Media
STORAGES = {
    "default": {"BACKEND": "storages.backends.s3boto3.S3Boto3Storage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# Dev extras
if DEBUG:
    INSTALLED_APPS += ["debug_toolbar"]
    MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")
    INTERNAL_IPS = ["127.0.0.1", "10.0.2.2"]

CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
CSRF_TRUSTED_ORIGINS = ["http://localhost:8000", "http://127.0.0.1:8000"]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "django.security.csrf": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "apps": {"handlers": ["console"], "level": "INFO"},
    },
}
