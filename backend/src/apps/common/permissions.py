from rest_framework.permissions import BasePermission


def _is_institute_admin(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.groups.filter(name="institute_admin").exists()
    )


class IsSuperuser(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_superuser)


class IsSuperuserOrInstituteAdminOfSameInstitute(BasePermission):
    """
    Superuser: full access.
    Institute admin: only to their own Institute object (obj.id == user.institute_id).
    """

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated and (u.is_superuser or _is_institute_admin(u))
        )

    def has_object_permission(self, request, view, obj):
        u = request.user
        if u.is_superuser:
            return True
        return _is_institute_admin(u) and getattr(u, "institute_id", None) == obj.id
