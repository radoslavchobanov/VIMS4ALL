import contextvars
from typing import Optional
from django.utils.deprecation import MiddlewareMixin
from django.http import HttpRequest
from rest_framework.authentication import BaseAuthentication

_current_institute_id: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "current_institute_id", default=None
)


def set_current_institute_id(value: Optional[int]) -> None:
    _current_institute_id.set(value)


def get_current_institute_id() -> Optional[int]:
    return _current_institute_id.get()


class InstituteContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest):
        iid = None
        user = getattr(request, "user", None)
        if getattr(user, "is_authenticated", False):
            iid = getattr(user, "institute_id", None)
        set_current_institute_id(iid)
        return self.get_response(request)
