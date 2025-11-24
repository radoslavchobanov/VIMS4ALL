from __future__ import annotations
import secrets
import string
from dataclasses import dataclass
from typing import Optional

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils import timezone
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

from apps.employees.models import Employee
from apps.common.mailer import mailer
from apps.common.email_templates import (
    account_created_with_password,
    account_created_with_invite_link,
)
from apps.accounts.services import assign_default_role

User = get_user_model()


def _random_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@dataclass(frozen=True)
class CreateAccountResult:
    user_id: int
    username: str
    # Only populated in custom mode; never include for email mode
    temporary_password: Optional[str] = None


@transaction.atomic
def create_employee_account_custom(
    *, employee: Employee, username: str, password: str
) -> CreateAccountResult:
    if employee.system_user_id:
        raise ValueError("Employee already has a system account.")
    if not username or not password:
        raise ValueError("username and password are required.")

    # Enforce same institute
    iid = employee.institute_id
    user = User.objects.create_user(
        username=username,
        email=employee.email or "",
        password=password,
        first_name=employee.first_name,
        last_name=employee.last_name,
        is_active=True,
    )
    assign_default_role(user)

    # enforce first-login password change
    user.must_change_password = True

    # Attach institute (your User has FK institute)
    update_fields = ["must_change_password"]
    if getattr(user, "institute_id", None) != iid:
        user.institute_id = iid
        update_fields.append("institute_id")
    user.save(update_fields=update_fields)

    employee.system_user = user
    if not employee.entry_date:
        employee.entry_date = timezone.now().date()
    employee.save(update_fields=["system_user", "entry_date"])
    return CreateAccountResult(
        user_id=user.id, username=user.username, temporary_password=password
    )


@transaction.atomic
def create_employee_account_send_email(*, employee: Employee) -> CreateAccountResult:
    """
    v1 flow: create a system user with a random temporary password
    and send it to the employee's email. Email is dispatched AFTER commit.
    """
    emp = Employee.all_objects.select_for_update().get(pk=employee.pk)

    if emp.system_user_id:
        raise ValueError("Employee already has a system account.")
    if not emp.email:
        raise ValueError("Employee has no email to send credentials to.")

    username = emp.email.strip().lower()
    password = _random_password(12)

    # Create user
    user = User.objects.create_user(
        username=username,
        email=username,
        password=password,
        first_name=emp.first_name,
        last_name=emp.last_name,
        is_active=True,
    )
    assign_default_role(user)

    # enforce first-login password change
    user.must_change_password = True
    update_fields = ["must_change_password"]

    # Align institute FK
    if getattr(user, "institute_id", None) != emp.institute_id:
        user.institute_id = emp.institute_id
        update_fields.append("institute_id")
    user.save(update_fields=update_fields)

    # Link back to employee
    emp.system_user = user
    if not emp.entry_date:
        emp.entry_date = timezone.now().date()
    emp.save(update_fields=["system_user", "entry_date"])

    # Generate email from template
    email_template = account_created_with_password(
        first_name=emp.first_name or "",
        username=username,
        password=password,
        institute_name=emp.institute.name if emp.institute else "VIMS4ALL",
    )

    def _send():
        mailer.send(
            subject=email_template.subject,
            to=[username],
            text=email_template.text,
            html=email_template.html,
        )

    # Only send if DB commit succeeds
    transaction.on_commit(_send)

    # Do NOT return the password here for email mode (avoid logging/exposure)
    return CreateAccountResult(user_id=user.id, username=user.username)


@transaction.atomic
def create_employee_account_invite(*, employee: Employee) -> CreateAccountResult:
    # Use the same manager as the view (all_objects), then lock the row.
    emp = Employee.all_objects.select_for_update().get(pk=employee.pk)

    if emp.system_user_id:
        raise ValueError("Employee already has a system account.")
    if not emp.email:
        raise ValueError("Employee has no email to send invitation to.")

    username = emp.email.strip().lower()

    user = User(
        username=username,
        email=username,
        first_name=emp.first_name,
        last_name=emp.last_name,
        is_active=True,
        institute=(
            getattr(emp, "institute", None) if hasattr(User, "institute") else None
        ),
    )
    user.set_unusable_password()
    # enforce first-login password change
    user.must_change_password = True
    user.save(
        update_fields=[
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "institute",
            "password",
            "must_change_password",
        ]
    )

    emp.system_user = user
    if not emp.entry_date:
        emp.entry_date = timezone.now().date()
    emp.save(update_fields=["system_user", "entry_date"])

    # Build secure one-time link (frontend handles token-based set password)
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    # Provide a configurable front-end URL in settings, e.g. https://app.vims4all.eu
    base = getattr(settings, "PORTAL_URL", "https://vims4all.eu")
    set_password_url = f"{base}/auth/set-password?uid={uidb64}&token={token}"

    # Generate email from template
    email_template = account_created_with_invite_link(
        first_name=emp.first_name,
        username=username,
        set_password_url=set_password_url,
        institute_name=emp.institute.name if emp.institute else "VIMS4ALL",
    )

    # Ensure mail is sent only after DB commit
    transaction.on_commit(
        lambda: mailer.send(
            subject=email_template.subject,
            to=[username],
            text=email_template.text,
            html=email_template.html,
        )
    )

    return CreateAccountResult(
        user_id=user.id, username=user.username, temporary_password=None
    )


@transaction.atomic
def reset_employee_account(*, employee: Employee) -> None:
    """
    Deletes the User and unlinks it from the employee.
    Policy: hard delete the User only if not superuser; otherwise refuse.
    """
    user = employee.system_user
    if not user:
        return

    if getattr(user, "is_superuser", False):
        raise ValueError("Refusing to delete a superuser account.")

    # Optionally: revoke tokens/sessions here if you use SimpleJWT/etc.
    uid = user.id
    employee.system_user = None
    employee.save(update_fields=["system_user"])

    # Clean up only after unlinking
    user.delete()


def close_exited_employee_accounts() -> dict:
    """
    Close (deactivate) accounts for employees whose exit_date has arrived or passed.
    This should run automatically via cron/scheduled task.

    Returns:
        dict with counts: {
            'processed': int,  # employees checked
            'closed': int,     # accounts deactivated
            'skipped': int,    # already inactive or no account
            'errors': list     # any errors encountered
        }
    """
    from django.utils import timezone

    today = timezone.now().date()
    result = {
        'processed': 0,
        'closed': 0,
        'skipped': 0,
        'errors': []
    }

    # Find employees with exit_date <= today who have active system accounts
    exited_employees = Employee.all_objects.filter(
        exit_date__lte=today,
        system_user__isnull=False,
        system_user__is_active=True
    ).select_related('system_user')

    for employee in exited_employees:
        result['processed'] += 1

        try:
            user = employee.system_user
            if not user:
                result['skipped'] += 1
                continue

            if not user.is_active:
                result['skipped'] += 1
                continue

            # Don't deactivate superusers automatically
            if user.is_superuser:
                result['skipped'] += 1
                result['errors'].append(
                    f"Skipped superuser account for {employee.epin} - {employee.first_name} {employee.last_name}"
                )
                continue

            # Deactivate the account
            user.is_active = False
            user.save(update_fields=['is_active'])
            result['closed'] += 1

        except Exception as e:
            result['errors'].append(
                f"Error processing {employee.epin}: {str(e)}"
            )

    return result
