from django.db.models import Exists, OuterRef
from .models import Employee, EmployeeCareer, EmployeeFunction


def q_active_instructors(iid: int):
    """Explicitly institute-scoped read-model for active instructors."""
    has_code = any(
        getattr(f, "name", None) == "code" for f in EmployeeFunction._meta.get_fields()
    )
    func_filter = (
        {"function__code": "instructor"}
        if has_code
        else {"function__name__iexact": "instructor"}
    )

    return (
        Employee.all_objects.filter(institute_id=iid, exit_date__isnull=True)
        .annotate(
            is_instructor=Exists(
                EmployeeCareer.all_objects.filter(
                    employee_id=OuterRef("pk"),
                    institute_id=iid,
                    **func_filter,
                )
            )
        )
        .filter(is_instructor=True)
    )
