from __future__ import annotations
from django.db.models import Q
from apps.employees.models import Employee


def _clean(s: str | None) -> str:
    return (s or "").strip()


def has_potential_duplicate_employee(
    institute_id: int, first_name: str, last_name: str, date_of_birth
) -> bool:
    """
    Block creation if an employee with same (first_name, last_name, DOB)
    or swapped names exists in THIS institute and is 'active' (no exit_date).
    """
    fn = _clean(first_name)
    ln = _clean(last_name)

    return (
        Employee.all_objects.filter(
            institute_id=institute_id,
            date_of_birth=date_of_birth,
            exit_date__isnull=True,  # treat only active rows as blockers
        )
        .filter(
            Q(first_name__iexact=fn, last_name__iexact=ln)
            | Q(first_name__iexact=ln, last_name__iexact=fn)  # swapped
        )
        .exists()
    )
