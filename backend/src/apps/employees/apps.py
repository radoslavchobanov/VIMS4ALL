from django.apps import AppConfig
from django.db import transaction


class EmployeesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.employees"

    def ready(self):
        from .models import EmployeeFunction
        from .constants import DEFAULT_GLOBAL_EMPLOYEE_FUNCTIONS

        try:
            with transaction.atomic():
                for name, code in DEFAULT_GLOBAL_EMPLOYEE_FUNCTIONS:
                    EmployeeFunction.objects.get_or_create(
                        institute=None, name=name, defaults={"code": code}
                    )
        except Exception as e:
            pass
