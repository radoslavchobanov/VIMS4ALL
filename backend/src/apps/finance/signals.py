from django.db import transaction
from django.db.models.signals import post_migrate
from django.dispatch import receiver
from django.db.models import Q

from .models import AccountType
from .constants import DEFAULT_ACCOUNT_TYPES


@receiver(post_migrate)
def ensure_default_account_types(sender, **kwargs):
    """
    Runs after 'migrate'. Creates or updates global AccountType rows
    based on DEFAULT_ACCOUNT_TYPES. Safe to run many times.
    """
    # Only react when our app's models are ready
    if getattr(sender, "name", None) != "apps.finance":
        return

    created_count = 0
    updated_count = 0
    with transaction.atomic():
        for code, raw_name, section in DEFAULT_ACCOUNT_TYPES:
            name = raw_name.strip()

            # Reconcile by (code) OR (acc_category case-insensitive) to avoid unique clashes
            obj = AccountType.objects.filter(
                Q(code=code) | Q(acc_category__iexact=name)
            ).first()

            if obj:
                changed = False
                if obj.code != code:
                    obj.code = code
                    changed = True
                if obj.acc_category != name:
                    obj.acc_category = name
                    changed = True
                if obj.section != section:
                    obj.section = section
                    changed = True
                if not obj.is_active:
                    obj.is_active = True
                    changed = True
                if changed:
                    obj.save()
                    updated_count += 1
            else:
                AccountType.objects.create(
                    code=code,
                    acc_category=name,
                    section=section,
                    is_active=True,
                )
                created_count += 1

    if created_count or updated_count:
        print(
            f"[finance] Seeded AccountTypes – created: {created_count}, updated: {updated_count}"
        )
