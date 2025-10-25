from pathlib import Path
import environ
import os

BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_SECRET_KEY=(str, ""),
    DJANGO_ALLOWED_HOSTS=(str, "localhost"),
    DJANGO_TIME_ZONE=(str, "UTC"),
)

# Load .env if present
env_file = os.getenv("DJANGO_ENV_FILE", ".env.dev")
env_path = os.path.join(BASE_DIR, env_file)
if os.path.exists(env_path):
    environ.Env.read_env(env_path)

DEBUG = env("DJANGO_DEBUG")
SECRET_KEY = env("DJANGO_SECRET_KEY") or "dev-insecure"
ALLOWED_HOSTS = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS").split(",")]
TIME_ZONE = env("DJANGO_TIME_ZONE")
USE_TZ = True

INSTALLED_APPS = [
    # Django core (admin needs these)
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_filters",
    # Third-party
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    # Your apps
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
    # your tenancy middleware can go here later
    "apps.common.middleware.InstituteContextMiddleware",
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CORS_ALLOW_CREDENTIALS = False  # set to True if you use cookies for auth
CORS_ALLOW_HEADERS = ["*"]
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

ROOT_URLCONF = "vims.urls"
WSGI_APPLICATION = "vims.wsgi.application"
ASGI_APPLICATION = "vims.asgi.application"

# --- TEMPLATES: required for admin ---
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "templates"
        ],  # create src/templates if you need custom templates
        "APP_DIRS": True,  # loads templates from app_name/templates/
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

# Static/Media
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- Primary key type (silences W042 and is the modern default) ---
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF / schema (optional but useful) ---
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
    "COMPONENT_SPLIT_REQUEST": True,
}

# S3/MinIO storages
if env.bool("S3_USE_SSL", default=False):
    use_ssl = True
else:
    use_ssl = False


DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
AWS_S3_ENDPOINT_URL = env(
    "AWS_S3_ENDPOINT_URL",
    default=f"http{'s' if env.bool('S3_USE_SSL', False) else ''}://minio:9000",
)
AWS_S3_REGION_NAME = env("S3_REGION")
AWS_S3_USE_SSL = use_ssl
AWS_ACCESS_KEY_ID = env("MINIO_ROOT_USER")
AWS_SECRET_ACCESS_KEY = env("MINIO_ROOT_PASSWORD")
AWS_STORAGE_BUCKET_NAME = env("MINIO_MEDIA_BUCKET")
AWS_DEFAULT_ACL = None

# Internationalization
LANGUAGE_CODE = "en-us"

# --- Email backend (Plesk SMTP) ---
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "mail.vims4all.eu")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() == "true"  # STARTTLS on 587
EMAIL_USE_SSL = False  # don't set both TLS and SSL
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "15"))
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "VIMS <service@vims4all.eu>")
SERVER_EMAIL = os.getenv("SERVER_EMAIL", "service@vims4all.eu")  # error emails
# Optional niceties
EMAIL_SUBJECT_PREFIX = "[VIMS] "

# --- Permissions ---
ACCOUNT_MGMT_ALLOWED_FUNCTION_CODES = {"director", "registrar"}
