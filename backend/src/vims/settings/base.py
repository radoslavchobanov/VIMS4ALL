from pathlib import Path
import os
import environ

BASE_DIR = Path(__file__).resolve().parents[2]
env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_SECRET_KEY=(str, ""),
    DJANGO_ALLOWED_HOSTS=(str, "localhost"),
    DJANGO_TIME_ZONE=(str, "UTC"),
)

# Load .env file dynamically
env_file = os.getenv("DJANGO_ENV_FILE", ".env.dev")
env_path = BASE_DIR / env_file
if env_path.exists():
    environ.Env.read_env(env_path)

# --- Core ---
DEBUG = env("DJANGO_DEBUG")
SECRET_KEY = env("DJANGO_SECRET_KEY") or "unsafe-dev-secret"
ALLOWED_HOSTS = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS").split(",")]
TIME_ZONE = env("DJANGO_TIME_ZONE")
USE_TZ = True

# --- Apps ---
INSTALLED_APPS = [
    # Django core
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "django_filters",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    # Project apps
    "apps.accounts",
    "apps.institutes",
    "apps.common",
    "apps.students",
    "apps.employees",
    "apps.courses",
    "apps.finance",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.common.middleware.InstituteContextMiddleware",
]

ROOT_URLCONF = "vims.urls"
WSGI_APPLICATION = "vims.wsgi.application"
ASGI_APPLICATION = "vims.asgi.application"

# --- Templates ---
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

# --- Database ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB"),
        "USER": env("POSTGRES_USER"),
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
    }
}

AUTH_USER_MODEL = "accounts.User"

# --- Static & Media ---
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

SPECTACULAR_SETTINGS = {
    "TITLE": "VIMS API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_SETTINGS": {"persistAuthorization": True},
    "SECURITY": [{"BearerAuth": []}],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "BearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
        }
    },
}

# --- S3 / MinIO ---
DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
AWS_S3_ENDPOINT_URL = env(
    "AWS_S3_ENDPOINT_URL",
    default=f"http{'s' if env.bool('S3_USE_SSL', False) else ''}://minio:9000",
)
AWS_ACCESS_KEY_ID = env("MINIO_ROOT_USER")
AWS_SECRET_ACCESS_KEY = env("MINIO_ROOT_PASSWORD")
AWS_STORAGE_BUCKET_NAME = env("MINIO_MEDIA_BUCKET")
AWS_S3_REGION_NAME = env("S3_REGION", default="us-east-1")
AWS_S3_USE_SSL = env.bool("S3_USE_SSL", default=False)
AWS_S3_ADDRESSING_STYLE = "path"
AWS_QUERYSTRING_AUTH = False
AWS_DEFAULT_ACL = None
AWS_S3_FILE_OVERWRITE = False

MEDIA_PUBLIC_BASE = env("MEDIA_PUBLIC_BASE", default=None)

# --- Email (SMTP / Plesk) ---
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("EMAIL_HOST", default="mail.vims4all.eu")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default=None)
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default=None)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="VIMS <service@vims4all.eu>")
SERVER_EMAIL = env("SERVER_EMAIL", default="service@vims4all.eu")
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=15)
EMAIL_SUBJECT_PREFIX = "[VIMS] "

LANGUAGE_CODE = "en-us"
ACCOUNT_MGMT_ALLOWED_FUNCTION_CODES = {"director", "registrar"}
