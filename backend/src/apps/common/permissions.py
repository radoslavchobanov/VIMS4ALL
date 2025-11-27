from typing import Iterable
from django.conf import settings
from rest_framework.permissions import BasePermission
from apps.employees.models import Employee, EmployeeCareer


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


def _is_director(user) -> bool:
    """
    Check if the user is an employee with the 'director' function code.
    """
    if not user or not user.is_authenticated:
        return False

    iid = getattr(user, "institute_id", None)
    if not iid:
        return False

    # Get employee profile for this user
    emp = (
        Employee.all_objects.filter(
            system_user_id=user.id, institute_id=iid
        )
        .only("id")
        .first()
    )
    if not emp:
        return False

    # Check if they have an open director career
    return EmployeeCareer.all_objects.filter(
        institute_id=iid,
        employee_id=emp.id,
        function__code="director",
    ).exists()


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


class IsSuperuserOrInstituteAdminOrDirectorOfSameInstitute(BasePermission):
    """
    Superuser: full access.
    Institute admin: only to their own Institute object (obj.id == user.institute_id).
    Director: only to their own Institute object (obj.id == user.institute_id).
    """

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated and (u.is_superuser or _is_institute_admin(u) or _is_director(u))
        )

    def has_object_permission(self, request, view, obj):
        u = request.user
        if u.is_superuser:
            return True

        # Check if user belongs to the same institute
        user_institute_id = getattr(u, "institute_id", None)
        if user_institute_id != obj.id:
            return False

        # Allow institute admins or directors
        return _is_institute_admin(u) or _is_director(u)


class HasInstitute(BasePermission):
    def has_permission(self, request, view):
        return bool(
            getattr(request.user, "is_authenticated", False)
            and getattr(request.user, "institute_id", None)
        )


class HasEmployeeFunctionCode(BasePermission):
    """
    Allows access if the authenticated user (linked to an Employee via Employee.system_user)
    currently holds an open career row whose function.code is in the required set.
    The set of codes is taken from view.required_function_codes or settings.ACCOUNT_MGMT_ALLOWED_FUNCTION_CODES.
    """

    message = "You don't have permission to perform this action."

    def has_permission(self, request, view) -> bool:
        # Superusers always allowed
        if getattr(request.user, "is_superuser", False):
            return True

        iid = getattr(request.user, "institute_id", None)
        if not iid or not request.user.is_authenticated:
            return False

        # Resolve the employee profile for this user within the tenant
        emp = (
            Employee.all_objects.filter(
                system_user_id=request.user.id, institute_id=iid
            )
            .only("id")
            .first()
        )
        if not emp:
            return False

        required: Iterable[str] = getattr(
            view,
            "required_function_codes",
            getattr(settings, "ACCOUNT_MGMT_ALLOWED_FUNCTION_CODES", {"director"}),
        )
        required = set([c for c in required if c])  # normalize

        if not required:
            # If someone misconfigures, safer to deny
            return False

        # Check open (current) assignment
        return EmployeeCareer.all_objects.filter(
            institute_id=iid,
            employee_id=emp.id,
            function__code__in=required,
        ).exists()
