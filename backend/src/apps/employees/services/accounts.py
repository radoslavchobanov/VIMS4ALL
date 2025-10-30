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
from django.core.mail import EmailMultiAlternatives

from apps.employees.models import Employee
from apps.common.mailer import mailer
from apps.employees.models import Employee
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
    # Attach institute (your User has FK institute)
    if getattr(user, "institute_id", None) != iid:
        user.institute_id = iid
        user.save(update_fields=["institute_id"])

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
    # Align institute FK
    if getattr(user, "institute_id", None) != emp.institute_id:
        user.institute_id = emp.institute_id
        user.save(update_fields=["institute_id"])

    # Link back to employee
    emp.system_user = user
    if not emp.entry_date:
        emp.entry_date = timezone.now().date()
    emp.save(update_fields=["system_user", "entry_date"])

    subject = "Your VIMS account"
    text = (
        f"Hello {emp.first_name or ''},\n\n"
        f"Your VIMS account has been created.\n\n"
        f"Username: {username}\n"
        f"Temporary password: {password}\n\n"
        f"Please sign in and change your password immediately."
    )
    html = (
        f"<p>Hello {emp.first_name or ''},</p>"
        f"<p>Your VIMS account has been created.</p>"
        f"<p><b>Username:</b> {username}<br>"
        f"<b>Temporary password:</b> {password}</p>"
        f"<p>Please sign in and change your password immediately.</p>"
    )

    def _send():
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text,
            from_email=settings.DEFAULT_FROM_EMAIL,  # e.g. "VIMS <service@vims4all.eu>"
            to=[username],
            reply_to=["service@vims4all.eu"],
        )
        msg.attach_alternative(html, "text/html")
        msg.send(fail_silently=False)

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
    user.save()

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

    subject = "Your VIMS account – set your password"
    text = (
        f"Hello {emp.first_name},\n\n"
        f"Your VIMS account has been created.\n\n"
        f"Username (email): {username}\n"
        f"Set your password here (valid once):\n{set_password_url}\n\n"
        f"If you did not request this, ignore this email."
    )
    html = (
        f"<p>Hello {emp.first_name},</p>"
        f"<p>Your VIMS account has been created.</p>"
        f"<p><b>Username:</b> {username}</p>"
        f"<p><a href='{set_password_url}'>Click here to set your password</a></p>"
        f"<p>If you did not request this, ignore this email.</p>"
    )

    # Ensure mail is sent only after DB commit
    transaction.on_commit(
        lambda: mailer.send(subject=subject, to=[username], text=text, html=html)
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
