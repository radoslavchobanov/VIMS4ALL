# backend/src/vims/settings/production.py
from .base import *  # noqa

DEBUG = False

ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS", default=["vims4all.eu", "www.vims4all.eu"]
)
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS", default=["https://vims4all.eu", "https://www.vims4all.eu"]
)

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = env.bool("USE_X_FORWARDED_HOST", default=True)

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"

# Static files via WhiteNoise (keeps deployment simple: no extra nginx for /static)
MIDDLEWARE.insert(
    1, "whitenoise.middleware.WhiteNoiseMiddleware"
)  # after SecurityMiddleware
STORAGES = {
    "default": {  # media -> S3/MinIO (from base env)
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    },
    "staticfiles": {  # admin static -> collected into STATIC_ROOT and served by WhiteNoise
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_PUBLIC_BASE = env("MEDIA_PUBLIC_BASE", default=None)
