from django.db import models
from django.db.models import Exists, OuterRef
from apps.common.managers import InstituteScopedManager
from apps.common.middleware import get_current_institute_id


class EmployeeQuerySet(models.QuerySet):
    def active(self):
        return self.filter(exit_date__isnull=True)

    def instructors(self):
        """
        Employees with an OPEN EmployeeCareer row for function 'Instructor',
        restricted to the SAME institute as the employee.
        Uses function.code='instructor' when present, otherwise falls back to name.
        """
        from .models import EmployeeCareer, EmployeeFunction  # late imports

        has_code = any(
            getattr(f, "name", None) == "code"
            for f in EmployeeFunction._meta.get_fields()
        )

        subq_filters = {
            "employee_id": OuterRef("pk"),
            "institute_id": OuterRef("institute_id"),
            "end_date__isnull": True,
        }
        if has_code:
            subq_filters["function__code"] = "instructor"
        else:
            subq_filters["function__name__iexact"] = "instructor"

        return self.annotate(
            is_instructor=Exists(EmployeeCareer.all_objects.filter(**subq_filters))
        ).filter(is_instructor=True)

    def active_instructors(self):
        # roll both rules into one helper if you prefer
        return self.active().instructors()


class EmployeeScopedManager(InstituteScopedManager):
    def get_queryset(self):
        iid = get_current_institute_id()
        base = EmployeeQuerySet(model=self.model, using=self._db)
        return base.filter(institute_id=iid) if iid is not None else base.none()

    def active(self):
        return self.get_queryset().active()

    def instructors(self):
        return self.get_queryset().instructors()

    def active_instructors(self):
        return self.get_queryset().active_instructors()
