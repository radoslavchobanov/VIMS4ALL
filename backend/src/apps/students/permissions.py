from rest_framework.permissions import BasePermission


class HasInstitute(BasePermission):
    def has_permission(self, request, view):
        return bool(
            getattr(request.user, "is_authenticated", False)
            and getattr(request.user, "institute_id", None)
        )
