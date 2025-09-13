import contextvars
from typing import Optional
from django.utils.deprecation import MiddlewareMixin
from django.http import HttpRequest

_current_institute_id: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "current_institute_id", default=None
)


def set_current_institute_id(value: Optional[int]) -> None:
    _current_institute_id.set(value)


def get_current_institute_id() -> Optional[int]:
    return _current_institute_id.get()


class InstituteContextMiddleware(MiddlewareMixin):
    """
    Sets current institute from the authenticated user for the duration of the request.
    Safe on unauthenticated requests (leaves None).
    """

    def process_request(self, request: HttpRequest):
        iid = None
        user = getattr(request, "user", None)
        if getattr(user, "is_authenticated", False):
            iid = getattr(
                user, "institute_id", None
            )  # accounts.User must have institute FK (nullable ok)
        set_current_institute_id(iid)
