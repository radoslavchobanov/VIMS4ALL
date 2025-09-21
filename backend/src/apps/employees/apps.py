from django.apps import AppConfig


class EmployeesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.employees"

    def ready(self):
        # Import signal handlers
        from . import signals  # noqa
