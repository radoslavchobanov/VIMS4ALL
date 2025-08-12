import contextvars
from typing import Optional
from django.utils.deprecation import MiddlewareMixin
from django.http import HttpRequest
from apps.institutes.models import Institute

_current_institute: contextvars.ContextVar[Optional[Institute]] = (
    contextvars.ContextVar("current_institute", default=None)
)


def get_current_institute() -> Optional[Institute]:
    return _current_institute.get()


class InstituteContextMiddleware(MiddlewareMixin):
    """
    Sets a current Institute into a contextvar based on the authenticated user's profile.
    Later, managers can automatically scope queries by this value.
    For bootstrap (no user yet), the value remains None.
    """

    def process_request(self, request: HttpRequest):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            _current_institute.set(getattr(user, "institute", None))
        else:
            _current_institute.set(None)
