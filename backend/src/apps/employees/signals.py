from django.db import transaction
from django.db.models.signals import post_migrate
from django.dispatch import receiver
from .models import EmployeeFunction
from .constants import DEFAULT_GLOBAL_EMPLOYEE_FUNCTIONS


@receiver(post_migrate)
def ensure_default_employee_functions(sender, **kwargs):
    """
    Runs after 'migrate'. Creates global (institute=NULL) EmployeeFunction rows
    if they don’t exist. Safe to run many times.
    """
    # Only react when our app's models are ready
    if getattr(sender, "name", None) != "apps.employees":
        return

    # Use the unscoped manager – middleware context isn't present here
    created_count = 0
    with transaction.atomic():
        for raw_name, code in DEFAULT_GLOBAL_EMPLOYEE_FUNCTIONS:
            name = raw_name.strip()
            # Case-insensitive existence check, but store canonical casing
            exists = EmployeeFunction.all_objects.filter(
                institute__isnull=True, name__iexact=name
            ).exists()
            if not exists:
                EmployeeFunction.all_objects.create(
                    institute=None, name=name, code=code
                )
                created_count += 1

    if created_count:
        # Optional: log to stdout so it's visible in Docker/Windows console
        print(f"[employees] Seeded {created_count} global EmployeeFunction(s).")
